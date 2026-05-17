export type RuntimeBackend = "webgpu" | "wasm";

export type ModelProfile = {
  id: string;
  label: string;
  searchModelId?: string;
  modelUrl: string;
  inputSize: number;
  dimensions: number;
  vectorizeIndex: string;
  workerAsset: boolean;
  browserRunnable: boolean;
  inferenceTimeoutMs: number;
  backendCandidates: RuntimeBackend[];
  autoRunOnSelect?: boolean;
  disabledReason?: string;
  mean: [number, number, number];
  std: [number, number, number];
  description: string;
};

export const modelProfiles: ModelProfile[] = [
  {
    id: "tiny-sample-v1",
    label: "Tiny 샘플 모델",
    modelUrl: "/models/tiny-image-embed.onnx",
    inputSize: 32,
    dimensions: 64,
    vectorizeIndex: "path-finder-sample-embeddings",
    workerAsset: true,
    browserRunnable: true,
    inferenceTimeoutMs: 30_000,
    backendCandidates: ["wasm"],
    mean: [0, 0, 0],
    std: [1, 1, 1],
    description: "Cloudflare/ONNX/Vectorize 경로 검증용 작은 샘플 모델",
  },
  {
    id: "dinov2-small-v1",
    label: "DINOv2-small",
    modelUrl: "/models/dinov2-small-embed-int8.onnx",
    inputSize: 224,
    dimensions: 384,
    vectorizeIndex: "path-finder-dinov2-small",
    workerAsset: false,
    browserRunnable: true,
    inferenceTimeoutMs: 180_000,
    backendCandidates: ["wasm"],
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    description: "실제 이미지 검색 품질 검증용 DINOv2-small 임베딩 모델",
  },
  {
    id: "dinov2-small-webgpu-v1",
    label: "DINOv2-small WebGPU 실험",
    searchModelId: "dinov2-small-v1",
    modelUrl: "/models/dinov2-small-embed-int8.onnx",
    inputSize: 224,
    dimensions: 384,
    vectorizeIndex: "path-finder-dinov2-small",
    workerAsset: false,
    browserRunnable: true,
    inferenceTimeoutMs: 180_000,
    backendCandidates: ["webgpu", "wasm"],
    autoRunOnSelect: false,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    description: "WebGPU 성능 비교용 실험 프로필. 반복 실행 안정성 검증 전까지 운영 기본값으로 쓰지 않는다.",
  },
  {
    id: "mobileclip2-s0-onnx-v1",
    label: "MobileCLIP2-S0 ONNX",
    modelUrl: "/models/mobileclip2-s0-vision.onnx",
    inputSize: 256,
    dimensions: 512,
    vectorizeIndex: "path-finder-mobileclip2-s0",
    workerAsset: false,
    browserRunnable: true,
    inferenceTimeoutMs: 120_000,
    backendCandidates: ["wasm"],
    autoRunOnSelect: false,
    mean: [0, 0, 0],
    std: [1, 1, 1],
    description: "MobileCLIP2-S0 vision ONNX 후보 모델",
  },
];

export function getDefaultModelProfile(): ModelProfile {
  return modelProfiles[0];
}

export function getModelProfile(id: string): ModelProfile | undefined {
  return modelProfiles.find((profile) => profile.id === id);
}
