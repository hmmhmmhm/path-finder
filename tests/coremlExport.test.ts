import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("export_coreml.py", () => {
  it("Core ML 변환 후보 모델과 dry-run을 CLI에서 노출한다", () => {
    const output = execFileSync("python3", ["scripts/export_coreml.py", "--help"], {
      encoding: "utf8",
    });

    expect(output).toContain("dinov2-small");
    expect(output).toContain("mobileclip2-s0");
    expect(output).toContain("--dry-run");
  });
});
