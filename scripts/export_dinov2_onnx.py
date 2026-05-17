#!/usr/bin/env python3
"""DINOv2-small을 브라우저 후보 ONNX 임베딩 모델로 변환한다."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[1]


class DinoV2Embedding(torch.nn.Module):
    def __init__(self) -> None:
        super().__init__()
        from transformers import AutoModel

        self.model = AutoModel.from_pretrained("facebook/dinov2-small")

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        outputs = self.model(pixel_values=pixel_values)
        return outputs.last_hidden_state[:, 0, :]


def file_size_mb(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)


def export_fp32(output: Path) -> None:
    model = DinoV2Embedding().eval()
    dummy = torch.zeros((1, 3, 224, 224), dtype=torch.float32)
    output.parent.mkdir(parents=True, exist_ok=True)
    with torch.inference_mode():
        torch.onnx.export(
            model,
            dummy,
            output,
            input_names=["pixel_values"],
            output_names=["embedding"],
            opset_version=17,
            external_data=False,
            dynamic_axes={"pixel_values": {0: "batch"}, "embedding": {0: "batch"}},
        )


def quantize_int8(source: Path, target: Path) -> None:
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(
        model_input=str(source),
        model_output=str(target),
        weight_type=QuantType.QInt8,
        per_channel=False,
    )


def benchmark(model_path: Path, runs: int) -> dict:
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    sample = np.zeros((1, 3, 224, 224), dtype=np.float32)
    times = []

    # warmup
    session.run([output_name], {input_name: sample})
    for _ in range(runs):
        start = time.perf_counter()
        output = session.run([output_name], {input_name: sample})[0]
        times.append((time.perf_counter() - start) * 1000)

    return {
        "input": input_name,
        "output": output_name,
        "shape": list(output.shape),
        "runs": runs,
        "medianMs": float(np.median(times)),
        "minMs": float(np.min(times)),
        "maxMs": float(np.max(times)),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "models")
    parser.add_argument("--runs", type=int, default=5)
    args = parser.parse_args()

    fp32 = args.output_dir / "dinov2-small-embed-fp32.onnx"
    int8 = args.output_dir / "dinov2-small-embed-int8.onnx"
    report_path = args.output_dir / "dinov2-small-onnx-report.json"

    start = time.perf_counter()
    if not fp32.exists():
        export_fp32(fp32)
    fp32_export_s = time.perf_counter() - start

    if not int8.exists():
        quantize_int8(fp32, int8)

    report = {
        "model": "facebook/dinov2-small",
        "inputSize": 224,
        "dimensions": 384,
        "files": {
            "fp32": {"path": str(fp32.relative_to(ROOT)), "sizeMiB": round(file_size_mb(fp32), 2)},
            "int8": {"path": str(int8.relative_to(ROOT)), "sizeMiB": round(file_size_mb(int8), 2)},
        },
        "workersAssetsLimitMiB": 25,
        "fp32ExportSeconds": round(fp32_export_s, 2),
        "onnxruntimeCpu": {
            "fp32": benchmark(fp32, args.runs),
            "int8": benchmark(int8, args.runs),
        },
    }

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
