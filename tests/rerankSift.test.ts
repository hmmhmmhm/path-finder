import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("rerank_sift.py", () => {
  it("샘플 query와 gallery를 SIFT/RANSAC 점수로 재정렬한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "path-finder-sift-"));
    const output = join(dir, "sift.json");

    execFileSync("uv", [
      "run",
      "--with",
      "numpy",
      "--with",
      "opencv-python-headless",
      "python",
      "scripts/rerank_sift.py",
      "--output",
      output,
      "--top-k",
      "3",
    ]);

    const report = JSON.parse(readFileSync(output, "utf8"));

    expect(report.method).toBe("SIFT_RANSAC");
    expect(report.topK).toHaveLength(3);
    expect(report.topK[0].score).toBeGreaterThan(0);
  });
});
