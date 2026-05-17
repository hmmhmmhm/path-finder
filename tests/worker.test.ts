import { describe, expect, it } from "vitest";
import worker from "../src/worker";

function createAssetsResponse(status = 404): { fetch: () => Promise<Response> } {
  return {
    async fetch() {
      return new Response("asset fallback", { status });
    },
  };
}

describe("worker model assets", () => {
  it("R2 모델을 public 모델 경로로 서빙한다", async () => {
    const response = await worker.fetch(
      new Request("https://path-finder.test/models/mobileclip2-s0-vision.onnx"),
      {
        ASSETS: createAssetsResponse(),
        MODEL_BUCKET: {
          async get(key: string) {
            expect(key).toBe("models/mobileclip2-s0-vision.onnx");
            return {
              body: new Blob(["onnx"]).stream(),
              writeHttpMetadata(headers: Headers) {
                headers.set("content-type", "application/octet-stream");
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    await expect(response.text()).resolves.toBe("onnx");
  });

  it("R2에 모델이 없으면 404를 반환한다", async () => {
    const response = await worker.fetch(
      new Request("https://path-finder.test/models/mobileclip2-s0-vision.onnx"),
      {
        ASSETS: createAssetsResponse(),
        MODEL_BUCKET: {
          async get() {
            return null;
          },
        },
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("모델을 R2에서 찾을 수 없습니다.");
  });
});

describe("worker search metadata", () => {
  it("D1 keyframes metadata를 DINO Vectorize 검색 결과에 붙인다", async () => {
    const response = await worker.fetch(
      new Request("https://path-finder.test/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId: "dinov2-small-v1", embedding: [1, 0, 0], topK: 1 }),
      }),
      {
        ASSETS: createAssetsResponse(),
        VECTORIZE_DINOV2: {
          async query() {
            return {
              matches: [{ id: "coex-001", score: 0.98, metadata: { label: "coex-001" } }],
            };
          },
        },
        DB: {
          prepare(sql: string) {
            expect(sql).toContain("FROM keyframes");
            return {
              bind(...ids: string[]) {
                expect(ids).toEqual(["coex-001"]);
                return {
                  async all() {
                    return {
                      results: [
                        {
                          id: "coex-001",
                          label: "별마당도서관 북측",
                          floor: "B1",
                          zone: "STARFIELD",
                          imagePath: "/keyframes/coex-001.jpg",
                          x: 20,
                          y: 35,
                        },
                      ],
                    };
                  },
                };
              },
            };
          },
        },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      modelId: "dinov2-small-v1",
      results: [
        {
          id: "coex-001",
          label: "별마당도서관 북측",
          floor: "B1",
          zone: "STARFIELD",
          imagePath: "/keyframes/coex-001.jpg",
        },
      ],
    });
  });
});
