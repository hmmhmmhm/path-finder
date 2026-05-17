import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("sweep_thresholds.py", () => {
  it("여러 threshold 조합의 confidence 분포와 best 후보를 리포트한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "path-finder-threshold-"));
    const manifest = join(dir, "manifest.json");
    const output = join(dir, "sweep.json");
    writeFileSync(
      manifest,
      JSON.stringify({
        model: { id: "test-model", dimensions: 2 },
        items: [
          { id: "a", label: "A", vector: [1, 0] },
          { id: "b", label: "B", vector: [0.8, 0.6] },
          { id: "c", label: "C", vector: [0, 1] },
        ],
      }),
    );

    execFileSync("python3", [
      "scripts/sweep_thresholds.py",
      "--manifest",
      manifest,
      "--output",
      output,
      "--score-values",
      "0.9,0.99",
      "--margin-values",
      "0.1,0.3",
    ]);

    const report = JSON.parse(readFileSync(output, "utf8"));

    expect(report.model.id).toBe("test-model");
    expect(report.sweeps).toHaveLength(4);
    expect(report.best).toMatchObject({
      minScore: 0.9,
      minMargin: 0.1,
      top1SelfRecall: 1,
      confident: 3,
    });
  });
});
