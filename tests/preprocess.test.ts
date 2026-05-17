import { describe, expect, it } from "vitest";
import { pixelsToCHWTensorData } from "../src/preprocess";

describe("pixelsToCHWTensorData", () => {
  it("RGBA 픽셀을 CHW float 배열로 변환한다", () => {
    const output = pixelsToCHWTensorData(new Uint8ClampedArray([255, 128, 0, 255]), {
      inputSize: 1,
      mean: [0, 0, 0],
      std: [1, 1, 1],
    });

    expect(Array.from(output).map((value) => Number(value.toFixed(3)))).toEqual([1, 0.502, 0]);
  });

  it("프로필 평균과 표준편차를 적용한다", () => {
    const output = pixelsToCHWTensorData(new Uint8ClampedArray([255, 128, 0, 255]), {
      inputSize: 1,
      mean: [0.5, 0.5, 0],
      std: [0.5, 0.25, 1],
    });

    expect(Array.from(output).map((value) => Number(value.toFixed(3)))).toEqual([1, 0.008, 0]);
  });
});
