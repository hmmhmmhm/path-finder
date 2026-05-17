import { describe, expect, it } from "vitest";
import { handleSearchRequest } from "../src/api";
import { createLocalSearchBackend } from "../src/backends";

describe("handleSearchRequest", () => {
  it("POST 임베딩 요청에 대해 위치 후보를 JSON으로 반환한다", async () => {
    const response = await handleSearchRequest(
      new Request("https://path-finder.test/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ embedding: [1, 0, 0], topK: 1, modelId: "tiny-sample-v1" }),
      }),
      {
        "tiny-sample-v1": createLocalSearchBackend([
          { id: "a", label: "A 구역", vector: [1, 0, 0] },
          { id: "b", label: "B 구역", vector: [0, 1, 0] },
        ]),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      modelId: "tiny-sample-v1",
      confidence: { level: "confident" },
      results: [{ id: "a", label: "A 구역", rank: 1 }],
    });
  });

  it("응답에는 내부 검색용 원본 벡터를 포함하지 않는다", async () => {
    const response = await handleSearchRequest(
      new Request("https://path-finder.test/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ embedding: [1, 0, 0], topK: 1 }),
      }),
      { "tiny-sample-v1": createLocalSearchBackend([{ id: "a", label: "A 구역", vector: [1, 0, 0] }]) },
    );

    const body = await response.json();
    expect(body.results[0]).not.toHaveProperty("vector");
  });

  it("임베딩이 없는 요청은 400으로 거절한다", async () => {
    const response = await handleSearchRequest(
      new Request("https://path-finder.test/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topK: 1 }),
      }),
      { "tiny-sample-v1": createLocalSearchBackend([]) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "embedding 배열이 필요합니다.",
    });
  });

  it("알 수 없는 modelId는 400으로 거절한다", async () => {
    const response = await handleSearchRequest(
      new Request("https://path-finder.test/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ embedding: [1, 0, 0], topK: 1, modelId: "missing" }),
      }),
      { "tiny-sample-v1": createLocalSearchBackend([]) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "지원하지 않는 modelId입니다: missing",
    });
  });
});
