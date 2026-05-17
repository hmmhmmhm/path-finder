import { describe, expect, it } from "vitest";
import { toVectorizeRecord, validateManifest } from "../src/manifest";

describe("manifest", () => {
  it("모델 차원과 임베딩 차원이 일치하는 manifest를 통과시킨다", () => {
    expect(
      validateManifest({
        model: { id: "test", dimensions: 3 },
        items: [{ id: "a", label: "A", imagePath: "/a.jpg", vector: [1, 0, 0] }],
      }),
    ).toEqual([]);
  });

  it("임베딩 차원이 다르면 오류를 반환한다", () => {
    expect(
      validateManifest({
        model: { id: "test", dimensions: 3 },
        items: [{ id: "a", label: "A", imagePath: "/a.jpg", vector: [1, 0] }],
      }),
    ).toContain("a: vector dimension 2 does not match model dimension 3");
  });

  it("Vectorize NDJSON 레코드에서 공개 메타데이터와 벡터를 분리한다", () => {
    expect(
      toVectorizeRecord({
        id: "a",
        label: "A",
        floor: "B1",
        zone: "Z1",
        x: 1,
        y: 2,
        imagePath: "/a.jpg",
        vector: [1, 0, 0],
      }),
    ).toEqual({
      id: "a",
      values: [1, 0, 0],
      metadata: {
        label: "A",
        floor: "B1",
        zone: "Z1",
        x: 1,
        y: 2,
        imagePath: "/a.jpg",
      },
    });
  });
});
