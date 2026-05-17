import { describe, expect, it } from "vitest";
import { createLocalSearchBackend, createVectorizeSearchBackend } from "../src/backends";

describe("createLocalSearchBackend", () => {
  it("내장 갤러리에서 공개 가능한 위치 후보만 반환한다", async () => {
    const backend = createLocalSearchBackend([
      {
        id: "starfield",
        label: "별마당도서관 북측",
        floor: "B1",
        zone: "ZONE-01",
        x: 20,
        y: 35,
        imagePath: "/gallery/starfield.jpg",
        vector: [1, 0, 0],
      },
    ]);

    const [result] = await backend.search([1, 0, 0], 1);

    expect(result).toMatchObject({
      id: "starfield",
      label: "별마당도서관 북측",
      rank: 1,
      score: 1,
    });
    expect(result).not.toHaveProperty("vector");
  });
});

describe("createVectorizeSearchBackend", () => {
  it("Vectorize matches metadata를 위치 후보 응답으로 변환한다", async () => {
    const backend = createVectorizeSearchBackend({
      async query(vector, options) {
        expect(vector).toEqual([1, 0, 0]);
        expect(options).toMatchObject({ topK: 2, returnMetadata: "all" });
        return {
          matches: [
            {
              id: "coex-sample-01",
              score: 0.98,
              metadata: {
                label: "별마당도서관 북측",
                floor: "B1",
                zone: "ZONE-01",
                x: 20,
                y: 35,
                imagePath: "/gallery/coex-sample-01.jpg",
              },
            },
          ],
        };
      },
    });

    await expect(backend.search([1, 0, 0], 2)).resolves.toEqual([
      {
        id: "coex-sample-01",
        label: "별마당도서관 북측",
        floor: "B1",
        zone: "ZONE-01",
        x: 20,
        y: 35,
        imagePath: "/gallery/coex-sample-01.jpg",
        score: 0.98,
        rank: 1,
      },
    ]);
  });

  it("D1 metadata store가 있으면 Vectorize 결과를 위치 메타데이터로 보강한다", async () => {
    const backend = createVectorizeSearchBackend(
      {
        async query() {
          return {
            matches: [
              {
                id: "coex-keyframe-001",
                score: 0.91,
                metadata: {
                  label: "coex-keyframe-001",
                },
              },
            ],
          };
        },
      },
      {
        async getByIds(ids) {
          expect(ids).toEqual(["coex-keyframe-001"]);
          return new Map([
            [
              "coex-keyframe-001",
              {
                label: "별마당도서관 북측",
                floor: "B1",
                zone: "STARFIELD",
                x: 20,
                y: 35,
                imagePath: "/keyframes/coex/B1/starfield/coex-keyframe-001.jpg",
              },
            ],
          ]);
        },
      },
    );

    await expect(backend.search([1, 0, 0], 1)).resolves.toEqual([
      {
        id: "coex-keyframe-001",
        label: "별마당도서관 북측",
        floor: "B1",
        zone: "STARFIELD",
        x: 20,
        y: 35,
        imagePath: "/keyframes/coex/B1/starfield/coex-keyframe-001.jpg",
        score: 0.91,
        rank: 1,
      },
    ]);
  });
});
