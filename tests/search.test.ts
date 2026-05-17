import { describe, expect, it } from "vitest";
import { classifySearchConfidence, searchEmbeddings } from "../src/search";

describe("searchEmbeddings", () => {
  it("코사인 유사도 기준으로 가장 가까운 후보를 먼저 반환한다", () => {
    const results = searchEmbeddings(
      [1, 0, 0],
      [
        { id: "east-gate", label: "동문", vector: [0.1, 1, 0] },
        { id: "starfield", label: "별마당", vector: [0.9, 0.1, 0] },
        { id: "station", label: "삼성역 연결 통로", vector: [-1, 0, 0] },
      ],
      2,
    );

    expect(results.map((result) => result.id)).toEqual(["starfield", "east-gate"]);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("query와 후보 벡터 차원이 다르면 명확한 오류를 낸다", () => {
    expect(() =>
      searchEmbeddings(
        [1, 0],
        [{ id: "bad", label: "잘못된 후보", vector: [1, 0, 0] }],
        1,
      ),
    ).toThrow("벡터 차원이 일치하지 않습니다");
  });

  it("top-1 점수와 margin으로 검색 신뢰도를 판정한다", () => {
    expect(
      classifySearchConfidence([
        { id: "a", label: "A", vector: [1], score: 0.92, rank: 1 },
        { id: "b", label: "B", vector: [1], score: 0.81, rank: 2 },
      ]),
    ).toMatchObject({ level: "confident", margin: 0.11 });

    expect(
      classifySearchConfidence([
        { id: "a", label: "A", vector: [1], score: 0.9, rank: 1 },
        { id: "b", label: "B", vector: [1], score: 0.88, rank: 2 },
      ]),
    ).toMatchObject({ level: "ambiguous" });

    expect(
      classifySearchConfidence([{ id: "a", label: "A", vector: [1], score: 0.69, rank: 1 }]),
    ).toMatchObject({ level: "uncertain" });
  });
});
