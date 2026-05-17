import { describe, expect, it } from "vitest";
import {
  fitSimilarity2D,
  latLonToEnu,
  mapPolycamPoint,
  transformPoint,
} from "../src/geo";

describe("latLonToEnu", () => {
  it("기준 위경도 주변의 WGS84 좌표를 동/북 meter 좌표로 변환한다", () => {
    const origin = { lat: 37.5102, lon: 127.0602 };

    const east = latLonToEnu({ lat: 37.5102, lon: 127.060313 }, origin);
    const north = latLonToEnu({ lat: 37.51029, lon: 127.0602 }, origin);

    expect(east.east).toBeCloseTo(9.99, 1);
    expect(east.north).toBeCloseTo(0, 1);
    expect(north.east).toBeCloseTo(0, 1);
    expect(north.north).toBeCloseTo(10.01, 1);
  });
});

describe("fitSimilarity2D", () => {
  it("Polycam x/z 대응점을 실제 ENU 좌표로 맞추는 similarity transform을 추정한다", () => {
    const transform = fitSimilarity2D([
      { source: { x: 0, y: 0 }, target: { x: 100, y: 200 } },
      { source: { x: 10, y: 0 }, target: { x: 100, y: 220 } },
      { source: { x: 0, y: 10 }, target: { x: 80, y: 200 } },
    ]);

    expect(transform.scale).toBeCloseTo(2, 6);
    expect(transform.rotationDeg).toBeCloseTo(90, 6);
    expect(transform.translation.x).toBeCloseTo(100, 6);
    expect(transform.translation.y).toBeCloseTo(200, 6);
    expect(transform.rmse).toBeLessThan(1e-9);

    expect(transformPoint({ x: 5, y: 5 }, transform)).toEqual({
      x: 90,
      y: 210,
    });
  });
});

describe("mapPolycamPoint", () => {
  it("Polycam x/z 좌표를 기준점 transform으로 WGS84 위경도까지 변환한다", () => {
    const origin = { lat: 37.5102, lon: 127.0602 };
    const mapped = mapPolycamPoint(
      { x: 10, z: 0 },
      {
        scale: 1,
        rotationRad: 0,
        rotationDeg: 0,
        translation: { x: 0, y: 0 },
        rmse: 0,
      },
      origin,
    );

    expect(mapped.enu.east).toBeCloseTo(10, 6);
    expect(mapped.enu.north).toBeCloseTo(0, 6);
    expect(mapped.wgs84.lat).toBeCloseTo(origin.lat, 6);
    expect(mapped.wgs84.lon).toBeGreaterThan(origin.lon);
  });
});
