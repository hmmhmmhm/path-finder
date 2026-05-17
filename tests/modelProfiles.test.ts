import { describe, expect, it } from "vitest";
import { getDefaultModelProfile, getModelProfile, modelProfiles } from "../src/modelProfiles";

describe("modelProfiles", () => {
  it("기본 프로필은 현재 배포된 tiny 샘플 모델을 가리킨다", () => {
    expect(getDefaultModelProfile()).toMatchObject({
      id: "tiny-sample-v1",
      dimensions: 64,
      vectorizeIndex: "path-finder-sample-embeddings",
      workerAsset: true,
    });
  });

  it("DINOv2-small 프로필은 384차원과 별도 Vectorize 인덱스를 사용한다", () => {
    expect(getModelProfile("dinov2-small-v1")).toMatchObject({
      dimensions: 384,
      vectorizeIndex: "path-finder-dinov2-small",
      workerAsset: false,
      browserRunnable: false,
      mean: [0.485, 0.456, 0.406],
      std: [0.229, 0.224, 0.225],
    });
  });

  it("프로필 id는 중복되지 않는다", () => {
    const ids = modelProfiles.map((profile) => profile.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
