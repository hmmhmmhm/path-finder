import * as ort from "onnxruntime-web/webgpu";
import type { RuntimeBackend } from "./modelProfiles";

ort.env.wasm.numThreads = 1;

type EmbedMessage = {
  type: "embed";
  id: string;
  modelUrl: string;
  inputSize: number;
  input: Float32Array;
  backendCandidates: RuntimeBackend[];
};

type ModelBytes = {
  bytes: Uint8Array;
  cacheHit: boolean;
  modelLoadMs: number;
};

type SessionLoad = {
  backend: RuntimeBackend;
  session: ort.InferenceSession;
  cacheHit: boolean;
  modelLoadMs: number;
  sessionCreateMs: number;
  sessionReused: boolean;
};

type AttemptFailure = {
  backend: RuntimeBackend;
  error: string;
};

const MODEL_CACHE_NAME = "path-finder-models-v1";
const modelBytePromises = new Map<string, Promise<ModelBytes>>();

async function loadModelBytes(modelUrl: string): Promise<ModelBytes> {
  const existing = modelBytePromises.get(modelUrl);
  if (existing) {
    const cached = await existing;
    return { ...cached, modelLoadMs: 0 };
  }

  const promise = (async () => {
    const startedAt = performance.now();
    const request = new Request(modelUrl, { cache: "force-cache" });
    const modelCache = "caches" in self ? await caches.open(MODEL_CACHE_NAME) : null;
    const cachedResponse = await modelCache?.match(request);

    if (cachedResponse) {
      return {
        bytes: new Uint8Array(await cachedResponse.arrayBuffer()),
        cacheHit: true,
        modelLoadMs: performance.now() - startedAt,
      };
    }

    const response = await fetch(request);
    if (!response.ok) {
      throw new Error(`모델 다운로드 실패: ${response.status}`);
    }
    await modelCache?.put(request, response.clone());
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      cacheHit: false,
      modelLoadMs: performance.now() - startedAt,
    };
  })();

  modelBytePromises.set(modelUrl, promise);
  return promise;
}

function isWebGpuAvailable(): boolean {
  return "gpu" in navigator;
}

async function createSession(modelUrl: string, backend: RuntimeBackend): Promise<SessionLoad> {
  if (backend === "webgpu" && !isWebGpuAvailable()) {
    throw new Error("WebGPU를 사용할 수 없습니다.");
  }

  const model = await loadModelBytes(modelUrl);
  const startedAt = performance.now();
  const session = await ort.InferenceSession.create(model.bytes, {
    executionProviders: [backend],
    graphOptimizationLevel: "all",
  });

  return {
    backend,
    session,
    cacheHit: model.cacheHit,
    modelLoadMs: model.modelLoadMs,
    sessionCreateMs: performance.now() - startedAt,
    sessionReused: false,
  };
}

async function loadFirstAvailableSession(
  modelUrl: string,
  backendCandidates: RuntimeBackend[],
): Promise<SessionLoad & { failures: AttemptFailure[] }> {
  const failures: AttemptFailure[] = [];

  for (const backend of backendCandidates) {
    try {
      return { ...(await createSession(modelUrl, backend)), failures };
    } catch (error) {
      failures.push({
        backend,
        error: error instanceof Error ? error.message : "세션 생성 실패",
      });
    }
  }

  throw new Error(failures.map((failure) => `${failure.backend}: ${failure.error}`).join(" / "));
}

self.addEventListener("message", (event: MessageEvent<EmbedMessage>) => {
  const message = event.data;
  if (message.type !== "embed") {
    return;
  }

  void (async () => {
    try {
      const sessionLoad = await loadFirstAvailableSession(
        message.modelUrl,
        message.backendCandidates.length > 0 ? message.backendCandidates : ["wasm"],
      );
      const tensor = new ort.Tensor("float32", message.input, [
        1,
        3,
        message.inputSize,
        message.inputSize,
      ]);
      const inputName = sessionLoad.session.inputNames[0];
      const outputName = sessionLoad.session.outputNames[0];
      const inferenceStartedAt = performance.now();
      const outputs = await sessionLoad.session.run({ [inputName]: tensor });
      const inferenceMs = performance.now() - inferenceStartedAt;
      const embedding = outputs.embedding ?? outputs[outputName];
      if (!embedding || !(embedding.data instanceof Float32Array)) {
        throw new Error("ONNX 모델 출력이 올바르지 않습니다.");
      }
      self.postMessage({
        type: "embedding",
        id: message.id,
        values: Array.from(embedding.data),
        backend: sessionLoad.backend,
        timings: {
          modelLoadMs: sessionLoad.modelLoadMs,
          sessionCreateMs: sessionLoad.sessionCreateMs,
          inferenceMs,
        },
        cacheHit: sessionLoad.cacheHit,
        sessionReused: sessionLoad.sessionReused,
        fallbackErrors: sessionLoad.failures,
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        id: message.id,
        error: error instanceof Error ? error.message : "추론 중 오류가 발생했습니다.",
      });
    }
  })();
});
