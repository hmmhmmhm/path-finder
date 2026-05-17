export type PreprocessProfile = {
  inputSize: number;
  mean: [number, number, number];
  std: [number, number, number];
};

export function pixelsToCHWTensorData(
  pixels: Uint8ClampedArray,
  profile: PreprocessProfile,
): Float32Array {
  const pixelCount = profile.inputSize * profile.inputSize;
  const input = new Float32Array(1 * 3 * pixelCount);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    input[pixel] = (pixels[pixel * 4] / 255 - profile.mean[0]) / profile.std[0];
    input[pixelCount + pixel] =
      (pixels[pixel * 4 + 1] / 255 - profile.mean[1]) / profile.std[1];
    input[2 * pixelCount + pixel] =
      (pixels[pixel * 4 + 2] / 255 - profile.mean[2]) / profile.std[2];
  }

  return input;
}
