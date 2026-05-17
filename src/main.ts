import * as ort from "onnxruntime-web/wasm";
import { sampleGallery } from "./generated/sample-gallery";
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
  topK: number;
  results: ApiSearchResult[];
};

const MODEL_URL = "/models/tiny-image-embed.onnx";
const SAMPLE_QUERY = "/samples/query-starfield-north.jpg";

ort.env.wasm.numThreads = 1;

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
      <span class="badge">ONNX CPU/WASM</span>
    </header>

    <section class="workspace">
      <div class="panel query-panel">
        <div class="panel-title">
          <h2>입력 이미지</h2>
          <button id="sampleButton" type="button">샘플 실행</button>
        </div>
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
const sampleButton = document.querySelector<HTMLButtonElement>("#sampleButton")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const latencyEl = document.querySelector<HTMLSpanElement>("#latency")!;
const resultsEl = document.querySelector<HTMLOListElement>("#results")!;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function loadSession(): Promise<ort.InferenceSession> {
  sessionPromise ??= ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return sessionPromise;
}

async function imageToTensor(image: HTMLImageElement): Promise<ort.Tensor> {
  if (!image.complete || image.naturalWidth === 0) {
    await image.decode();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("캔버스 컨텍스트를 만들 수 없습니다.");
  }
  context.drawImage(image, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  const input = new Float32Array(1 * 3 * 32 * 32);

  for (let pixel = 0; pixel < 32 * 32; pixel += 1) {
    input[pixel] = pixels[pixel * 4] / 255;
    input[32 * 32 + pixel] = pixels[pixel * 4 + 1] / 255;
    input[2 * 32 * 32 + pixel] = pixels[pixel * 4 + 2] / 255;
  }

  return new ort.Tensor("float32", input, [1, 3, 32, 32]);
}

function normalizeEmbedding(values: Iterable<number>): number[] {
  const vector = Array.from(values);
  const norm = Math.hypot(...vector);
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

async function embedCurrentImage(): Promise<number[]> {
  const session = await loadSession();
  const tensor = await imageToTensor(queryImage);
  const outputs = await session.run({ image: tensor });
  const embedding = outputs.embedding;
  if (!embedding || !(embedding.data instanceof Float32Array)) {
    throw new Error("ONNX 모델 출력이 올바르지 않습니다.");
  }
  return normalizeEmbedding(embedding.data);
}

async function search(embedding: number[]): Promise<ApiSearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ embedding, topK: 5 }),
  });
  if (!response.ok) {
    throw new Error(`검색 API 오류: ${response.status}`);
  }
  return (await response.json()) as ApiSearchResponse;
}

function renderResults(data: ApiSearchResponse): void {
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

async function runSearch(): Promise<void> {
  statusEl.textContent = "브라우저에서 ONNX 임베딩을 계산하는 중입니다.";
  resultsEl.innerHTML = "";
  const start = performance.now();

  try {
    const embedding = await embedCurrentImage();
    const data = await search(embedding);
    const elapsed = performance.now() - start;
    latencyEl.textContent = `${elapsed.toFixed(1)}ms`;
    statusEl.textContent = "검색이 완료되었습니다.";
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

sampleButton.addEventListener("click", () => {
  queryImage.src = SAMPLE_QUERY;
  queryImage.onload = () => void runSearch();
  if (queryImage.complete) {
    void runSearch();
  }
});

void loadSession()
  .then(() => {
    statusEl.textContent = "모델 준비가 끝났습니다. 샘플을 실행합니다.";
    return runSearch();
  })
  .catch((error: unknown) => {
    statusEl.textContent = error instanceof Error ? error.message : "모델 로딩에 실패했습니다.";
  });
