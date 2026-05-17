import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("georeference_polycam.mjs", () => {
  it("GCP JSON과 Polycam point JSON을 WGS84 mapping report로 변환한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "path-finder-gcp-"));
    const gcpPath = join(dir, "gcp.json");
    const pointsPath = join(dir, "points.json");
    const outputPath = join(dir, "report.json");
    writeFileSync(
      gcpPath,
      JSON.stringify({
        scanId: "B1-TEST-001",
        origin: { lat: 37.5102, lon: 127.0602 },
        points: [
          { id: "GCP-001", polycam: { x: 0, z: 0 }, enu: { east: 100, north: 200 } },
          { id: "GCP-002", polycam: { x: 10, z: 0 }, enu: { east: 100, north: 220 } },
          { id: "GCP-003", polycam: { x: 0, z: 10 }, enu: { east: 80, north: 200 } },
        ],
      }),
    );
    writeFileSync(
      pointsPath,
      JSON.stringify({
        points: [{ id: "KF-001", polycam: { x: 5, z: 5 } }],
      }),
    );

    execFileSync("node", [
      "scripts/georeference_polycam.mjs",
      "--gcp",
      gcpPath,
      "--points",
      pointsPath,
      "--output",
      outputPath,
    ]);

    const report = JSON.parse(readFileSync(outputPath, "utf8"));

    expect(report.scanId).toBe("B1-TEST-001");
    expect(report.transform.scale).toBeCloseTo(2, 6);
    expect(report.transform.rotationDeg).toBeCloseTo(90, 6);
    expect(report.mappedPoints[0]).toMatchObject({
      id: "KF-001",
      enu: { east: 90, north: 210 },
    });
    expect(report.mappedPoints[0].wgs84.lat).toBeGreaterThan(37.5102);
  });
});
