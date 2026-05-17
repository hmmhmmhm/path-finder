import { describe, expect, it } from "vitest";
import { getDefaultModelProfile, getModelProfile, modelProfiles } from "../src/modelProfiles";

describe("modelProfiles", () => {
  it("기본 프로필은 현재 배포된 tiny 샘플 모델을 가리킨다", () => {
    expect(getDefaultModelProfile()).toMatchObject({
      id: "tiny-sample-v1",
      dimensions: 64,
      vectorizeIndex: "path-finder-sample-embeddings",
      workerAsset: true,
      backendCandidates: ["wasm"],
    });
  });

  it("DINOv2-small 프로필은 384차원과 별도 Vectorize 인덱스를 사용한다", () => {
    expect(getModelProfile("dinov2-small-v1")).toMatchObject({
      dimensions: 384,
      vectorizeIndex: "path-finder-dinov2-small",
      workerAsset: false,
      browserRunnable: true,
      inferenceTimeoutMs: 180_000,
      backendCandidates: ["wasm"],
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    });
  });

  it("WebGPU는 별도 실험 프로필로 분리한다", () => {
    expect(getModelProfile("dinov2-small-webgpu-v1")).toMatchObject({
      dimensions: 384,
      searchModelId: "dinov2-small-v1",
      vectorizeIndex: "path-finder-dinov2-small",
      backendCandidates: ["webgpu", "wasm"],
      autoRunOnSelect: false,
    });
  });

  it("MobileCLIP2-S0 ONNX 프로필은 512차원과 별도 Vectorize 인덱스를 사용한다", () => {
    expect(getModelProfile("mobileclip2-s0-onnx-v1")).toMatchObject({
      dimensions: 512,
      vectorizeIndex: "path-finder-mobileclip2-s0",
      backendCandidates: ["wasm"],
      autoRunOnSelect: false,
      mean: [0, 0, 0],
      std: [1, 1, 1],
    });
  });

  it("프로필 id는 중복되지 않는다", () => {
    const ids = modelProfiles.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
