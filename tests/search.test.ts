import { describe, expect, it } from "vitest";
import { searchEmbeddings } from "../src/search";

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
});
