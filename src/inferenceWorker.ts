import * as ort from "onnxruntime-web/wasm";

ort.env.wasm.numThreads = 1;

type EmbedMessage = {
  type: "embed";
  id: string;
  modelUrl: string;
  inputSize: number;
  input: Float32Array;
};

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let sessionModelUrl = "";

function loadSession(modelUrl: string): Promise<ort.InferenceSession> {
  if (sessionModelUrl !== modelUrl) {
    sessionPromise = null;
    sessionModelUrl = modelUrl;
  }

  sessionPromise ??= ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return sessionPromise;
}

self.addEventListener("message", (event: MessageEvent<EmbedMessage>) => {
  const message = event.data;
  if (message.type !== "embed") {
    return;
  }

  void (async () => {
    try {
      const session = await loadSession(message.modelUrl);
      const tensor = new ort.Tensor("float32", message.input, [
        1,
        3,
        message.inputSize,
        message.inputSize,
      ]);
      const inputName = session.inputNames[0];
      const outputName = session.outputNames[0];
      const outputs = await session.run({ [inputName]: tensor });
      const embedding = outputs.embedding ?? outputs[outputName];
      if (!embedding || !(embedding.data instanceof Float32Array)) {
        throw new Error("ONNX 모델 출력이 올바르지 않습니다.");
      }
      self.postMessage({
        type: "embedding",
        id: message.id,
        values: Array.from(embedding.data),
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
