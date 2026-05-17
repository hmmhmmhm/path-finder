import { describe, expect, it } from "vitest";
import { createD1SearchMetadataStore } from "../src/metadataStore";

describe("createD1SearchMetadataStore", () => {
  it("keyframes 테이블에서 위치 후보 metadata를 id 기준으로 반환한다", async () => {
    const store = createD1SearchMetadataStore({
      prepare(sql: string) {
        expect(sql).toContain("FROM keyframes");
        expect(sql).toContain("id IN (?, ?)");
        return {
          bind(...ids: string[]) {
            expect(ids).toEqual(["coex-001", "coex-002"]);
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
    });

    const metadata = await store.getByIds(["coex-001", "coex-002"]);

    expect(metadata.get("coex-001")).toEqual({
      label: "별마당도서관 북측",
      floor: "B1",
      zone: "STARFIELD",
      imagePath: "/keyframes/coex-001.jpg",
      x: 20,
      y: 35,
    });
    expect(metadata.has("coex-002")).toBe(false);
  });

  it("빈 id 목록이면 D1 쿼리를 실행하지 않는다", async () => {
    const store = createD1SearchMetadataStore({
      prepare() {
        throw new Error("D1 query should not run");
      },
    });

    await expect(store.getByIds([])).resolves.toEqual(new Map());
  });
});
