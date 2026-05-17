import { sampleGallery } from "./generated/sample-gallery";
import { getDefaultModelProfile, getModelProfile, modelProfiles } from "./modelProfiles";
import { pixelsToCHWTensorData } from "./preprocess";
import "./styles.css";

type ApiSearchResult = {
  id: string;
  label: string;
  floor?: string;
  zone?: string;
  x?: number;
  y?: number;
  imagePath?: string;
  score: number;
  rank: number;
};

type ApiSearchResponse = {
  modelId: string;
  topK: number;
  confidence?: {
    level: "confident" | "ambiguous" | "uncertain";
    topScore: number;
    margin: number;
    reason: string;
  };
  results: ApiSearchResult[];
};

type InferenceTimings = {
  preprocessMs: number;
  modelLoadMs: number;
  sessionCreateMs: number;
  inferenceMs: number;
  apiMs: number;
  totalMs: number;
};

type EmbeddingResult = {
  embedding: number[];
  backend: string;
  cacheHit: boolean;
  sessionReused: boolean;
  fallbackErrors: Array<{ backend: string; error: string }>;
  timings: Omit<InferenceTimings, "apiMs" | "totalMs">;
};

let modelProfile = getDefaultModelProfile();
const SAMPLE_QUERY = "/samples/query-starfield-north.jpg";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("앱 루트 요소를 찾을 수 없습니다.");
}

app.innerHTML = `
  <section class="shell">
    <header class="header">
      <div>
        <p class="eyebrow">COEX visual localization prototype</p>
        <h1>path-finder</h1>
      </div>
      <span id="modelBadge" class="badge">ONNX CPU/WASM · ${modelProfile.dimensions}D</span>
    </header>

    <section class="workspace">
      <div class="panel query-panel">
        <div class="panel-title">
          <h2>입력 이미지</h2>
          <button id="sampleButton" type="button">샘플 실행</button>
        </div>
        <label class="model-select">
          <span>모델</span>
          <select id="modelSelect">
            ${modelProfiles
              .map(
                (profile) =>
                  `<option value="${profile.id}">${profile.label} ${profile.dimensions}D</option>`,
              )
              .join("")}
          </select>
        </label>
        <img id="queryImage" alt="검색할 샘플 이미지" src="${SAMPLE_QUERY}" />
        <label class="file-input">
          <span>이미지 선택</span>
          <input id="fileInput" type="file" accept="image/*" />
        </label>
        <p id="status" class="status">모델을 준비하는 중입니다.</p>
      </div>

      <div class="panel results-panel">
        <div class="panel-title">
          <h2>위치 후보</h2>
          <span id="latency">-</span>
        </div>
        <p id="confidence" class="confidence">-</p>
        <dl id="metrics" class="metrics"></dl>
        <ol id="results" class="results"></ol>
      </div>
    </section>

    <section class="gallery-strip" aria-label="샘플 지도 이미지">
      ${sampleGallery
        .map(
          (item) => `
            <article>
              <img src="${item.imagePath}" alt="${item.label}" />
              <strong>${item.label}</strong>
              <span>${item.floor} · ${item.zone}</span>
            </article>
          `,
        )
        .join("")}
    </section>
  </section>
`;

const queryImage = document.querySelector<HTMLImageElement>("#queryImage")!;
const fileInput = document.querySelector<HTMLInputElement>("#fileInput")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#modelSelect")!;
const sampleButton = document.querySelector<HTMLButtonElement>("#sampleButton")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const latencyEl = document.querySelector<HTMLSpanElement>("#latency")!;
const resultsEl = document.querySelector<HTMLOListElement>("#results")!;
const modelBadge = document.querySelector<HTMLSpanElement>("#modelBadge")!;
const metricsEl = document.querySelector<HTMLDListElement>("#metrics")!;
const confidenceEl = document.querySelector<HTMLParagraphElement>("#confidence")!;

let inferenceWorker: Worker | null = null;
let inferenceWorkerKind: "wasm" | "webgpu" | null = null;

function getInferenceWorker(): Worker {
  const nextKind = modelProfile.backendCandidates.includes("webgpu") ? "webgpu" : "wasm";
  if (!inferenceWorker || inferenceWorkerKind !== nextKind) {
    inferenceWorker?.terminate();
    inferenceWorker =
      nextKind === "webgpu"
        ? new Worker(new URL("./webgpuInferenceWorker.ts", import.meta.url), { type: "module" })
        : new Worker(new URL("./inferenceWorker.ts", import.meta.url), { type: "module" });
    inferenceWorkerKind = nextKind;
  }
  return inferenceWorker;
}

async function imageToTensorData(image: HTMLImageElement): Promise<Float32Array> {
  if (!image.complete || image.naturalWidth === 0) {
    await image.decode();
  }

  const canvas = document.createElement("canvas");
  canvas.width = modelProfile.inputSize;
  canvas.height = modelProfile.inputSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("캔버스 컨텍스트를 만들 수 없습니다.");
  }
  context.drawImage(image, 0, 0, modelProfile.inputSize, modelProfile.inputSize);
  const pixels = context.getImageData(0, 0, modelProfile.inputSize, modelProfile.inputSize).data;
  return pixelsToCHWTensorData(pixels, modelProfile);
}

function normalizeEmbedding(values: Iterable<number>): number[] {
  const vector = Array.from(values);
  const norm = Math.hypot(...vector);
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

async function embedCurrentImage(): Promise<EmbeddingResult> {
  const preprocessStartedAt = performance.now();
  const input = await imageToTensorData(queryImage);
  const preprocessMs = performance.now() - preprocessStartedAt;
  const worker = getInferenceWorker();

  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      worker.terminate();
      if (inferenceWorker === worker) {
        inferenceWorker = null;
        inferenceWorkerKind = null;
      }
      reject(
        new Error(
          `${modelProfile.label} 브라우저 추론이 ${Math.round(
            modelProfile.inferenceTimeoutMs / 1000,
          )}초를 초과했습니다.`,
        ),
      );
    }, modelProfile.inferenceTimeoutMs);

    const onMessage = (event: MessageEvent) => {
      const message = event.data as
        | {
            type: "embedding";
            id: string;
            values: number[];
            backend: string;
            cacheHit: boolean;
            sessionReused: boolean;
            fallbackErrors: Array<{ backend: string; error: string }>;
            timings: {
              modelLoadMs: number;
              sessionCreateMs: number;
              inferenceMs: number;
            };
          }
        | { type: "error"; id: string; error: string };
      if (message.id !== id) {
        return;
      }
      window.clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);

      if (message.type === "error") {
        reject(new Error(message.error));
        return;
      }

      const result = {
        embedding: normalizeEmbedding(message.values),
        backend: message.backend,
        cacheHit: message.cacheHit,
        sessionReused: message.sessionReused,
        fallbackErrors: message.fallbackErrors,
        timings: {
          preprocessMs,
          modelLoadMs: message.timings.modelLoadMs,
          sessionCreateMs: message.timings.sessionCreateMs,
          inferenceMs: message.timings.inferenceMs,
        },
      };

      if (message.backend === "webgpu") {
        worker.terminate();
        if (inferenceWorker === worker) {
          inferenceWorker = null;
          inferenceWorkerKind = null;
        }
      }

      resolve(result);
    };

    worker.addEventListener("message", onMessage);

    worker.postMessage(
      {
        type: "embed",
        id,
        modelUrl: modelProfile.modelUrl,
        inputSize: modelProfile.inputSize,
        backendCandidates: modelProfile.backendCandidates,
        input,
      },
      [input.buffer],
    );
  });
}

async function search(embedding: number[]): Promise<ApiSearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embedding, topK: 5, modelId: modelProfile.searchModelId ?? modelProfile.id }),
  });
  if (!response.ok) {
    throw new Error(`검색 API 오류: ${response.status}`);
  }
  return (await response.json()) as ApiSearchResponse;
}

function renderResults(data: ApiSearchResponse): void {
  const confidence = data.confidence;
  confidenceEl.textContent = confidence
    ? `${confidence.level} · top ${(confidence.topScore * 100).toFixed(1)}% · margin ${(
        confidence.margin * 100
      ).toFixed(1)}%`
    : "-";
  confidenceEl.dataset.level = confidence?.level ?? "";
  resultsEl.innerHTML = data.results
    .map(
      (result) => `
        <li>
          <img src="${result.imagePath}" alt="${result.label}" />
          <div>
            <strong>${result.rank}. ${result.label}</strong>
            <span>${result.floor ?? "-"} · ${result.zone ?? "-"} · (${result.x ?? 0}, ${
              result.y ?? 0
            })</span>
          </div>
          <b>${(result.score * 100).toFixed(1)}%</b>
        </li>
      `,
    )
    .join("");
}

function formatMs(value: number): string {
  return `${value.toFixed(1)}ms`;
}

function renderMetrics(data: EmbeddingResult, apiMs: number, totalMs: number): void {
  const timings: InferenceTimings = {
    ...data.timings,
    apiMs,
    totalMs,
  };
  const fallbackText =
    data.fallbackErrors.length > 0
      ? data.fallbackErrors.map((item) => `${item.backend}: ${item.error}`).join(" / ")
      : "없음";
  const cacheText = data.sessionReused ? "session reused" : data.cacheHit ? "hit" : "miss";

  metricsEl.innerHTML = `
    <div><dt>백엔드</dt><dd>${data.backend}</dd></div>
    <div><dt>모델 캐시</dt><dd>${cacheText}</dd></div>
    <div><dt>전처리</dt><dd>${formatMs(timings.preprocessMs)}</dd></div>
    <div><dt>모델 로드</dt><dd>${formatMs(timings.modelLoadMs)}</dd></div>
    <div><dt>세션 생성</dt><dd>${formatMs(timings.sessionCreateMs)}</dd></div>
    <div><dt>추론</dt><dd>${formatMs(timings.inferenceMs)}</dd></div>
    <div><dt>API</dt><dd>${formatMs(timings.apiMs)}</dd></div>
    <div><dt>fallback</dt><dd>${fallbackText}</dd></div>
  `;
}

function setModelAvailability(): void {
  modelBadge.textContent = `${modelProfile.backendCandidates.join("→")} · ${
    modelProfile.dimensions
  }D`;
  sampleButton.disabled = !modelProfile.browserRunnable;
  fileInput.disabled = !modelProfile.browserRunnable;
}

function showDisabledModelState(): void {
  resultsEl.innerHTML = "";
  confidenceEl.textContent = "-";
  confidenceEl.dataset.level = "";
  metricsEl.innerHTML = "";
  latencyEl.textContent = "-";
  statusEl.textContent =
    modelProfile.disabledReason ?? "이 모델은 브라우저 실행을 지원하지 않습니다.";
}

async function runSearch(): Promise<void> {
  if (!modelProfile.browserRunnable) {
    showDisabledModelState();
    return;
  }

  statusEl.textContent = "브라우저에서 ONNX 임베딩을 계산하는 중입니다.";
  resultsEl.innerHTML = "";
  confidenceEl.textContent = "-";
  confidenceEl.dataset.level = "";
  metricsEl.innerHTML = "";
  const start = performance.now();

  try {
    const embeddingResult = await embedCurrentImage();
    const apiStartedAt = performance.now();
    const data = await search(embeddingResult.embedding);
    const apiMs = performance.now() - apiStartedAt;
    const elapsed = performance.now() - start;
    latencyEl.textContent = `${elapsed.toFixed(1)}ms`;
    statusEl.textContent = "검색이 완료되었습니다.";
    renderMetrics(embeddingResult, apiMs, elapsed);
    renderResults(data);
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
    latencyEl.textContent = "-";
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  queryImage.src = URL.createObjectURL(file);
  queryImage.onload = () => void runSearch();
});

modelSelect.addEventListener("change", () => {
  const nextProfile = getModelProfile(modelSelect.value);
  if (!nextProfile) {
    return;
  }
  modelProfile = nextProfile;
  inferenceWorker?.terminate();
  inferenceWorker = null;
  inferenceWorkerKind = null;
  setModelAvailability();
  if (!modelProfile.browserRunnable) {
    showDisabledModelState();
    return;
  }
  resultsEl.innerHTML = "";
  latencyEl.textContent = "-";
  statusEl.textContent = `${modelProfile.label} 모델을 준비하는 중입니다.`;
  if (modelProfile.autoRunOnSelect === false) {
    statusEl.textContent = `${modelProfile.label}은 실험 옵션입니다. 샘플 실행 버튼으로 직접 실행하세요.`;
    return;
  }
  void runSearch();
});

sampleButton.addEventListener("click", () => {
  queryImage.src = SAMPLE_QUERY;
  queryImage.onload = () => void runSearch();
  if (queryImage.complete) {
    void runSearch();
  }
});

statusEl.textContent = "모델 준비가 끝났습니다. 샘플을 실행합니다.";
setModelAvailability();
void runSearch();
