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
