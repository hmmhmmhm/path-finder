export type ModelProfile = {
  id: string;
  label: string;
  modelUrl: string;
  inputSize: number;
  dimensions: number;
  vectorizeIndex: string;
  workerAsset: boolean;
  browserRunnable: boolean;
  inferenceTimeoutMs: number;
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
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    description: "실제 이미지 검색 품질 검증용 DINOv2-small 임베딩 모델",
  },
];

export function getDefaultModelProfile(): ModelProfile {
  return modelProfiles[0];
}

export function getModelProfile(id: string): ModelProfile | undefined {
  return modelProfiles.find((profile) => profile.id === id);
}
