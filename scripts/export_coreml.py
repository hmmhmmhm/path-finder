#!/usr/bin/env python3
"""iPhone 네이티브 추론 후보를 Core ML 모델로 변환한다."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "artifacts" / "coreml"


def dry_run_report(model: str, output_dir: Path) -> dict:
    if model == "dinov2-small":
        return {
            "model": model,
            "source": "facebook/dinov2-small",
            "input": {"name": "pixel_values", "shape": [1, 3, 224, 224]},
            "output": {"name": "embedding", "dimensions": 384},
            "target": str(output_dir / "dinov2-small-embed.mlpackage"),
        }
    return {
        "model": model,
        "source": "MobileCLIP-S0 또는 MobileCLIP2-S0 vision checkpoint",
        "input": {"name": "image", "shape": [1, 3, 256, 256]},
        "output": {"name": "embedding", "dimensions": 512},
        "target": str(output_dir / "mobileclip2-s0-vision.mlpackage"),
        "note": "MobileCLIP 계열은 checkpoint별 PyTorch wrapper를 확정한 뒤 변환합니다.",
    }


def export_dinov2_small(output_dir: Path) -> Path:
    import coremltools as ct
    import numpy as np
    import torch
    from transformers import AutoModel

    class DinoEmbedding(torch.nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.model = AutoModel.from_pretrained("facebook/dinov2-small").eval()

        def forward(self, pixel_values):
            output = self.model(pixel_values=pixel_values).last_hidden_state[:, 0, :]
            return torch.nn.functional.normalize(output, dim=1)

    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "dinov2-small-embed.mlpackage"
    module = DinoEmbedding().eval()
    example = torch.randn(1, 3, 224, 224)
    traced = torch.jit.trace(module, example)
    model = ct.convert(
        traced,
        inputs=[ct.TensorType(name="pixel_values", shape=example.shape, dtype=np.float32)],
        outputs=[ct.TensorType(name="embedding")],
        convert_to="mlprogram",
    )
    model.save(target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["dinov2-small", "mobileclip2-s0"], default="dinov2-small")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        print(json.dumps(dry_run_report(args.model, args.output_dir), ensure_ascii=False, indent=2))
        return

    if args.model != "dinov2-small":
        raise SystemExit("현재 실제 변환 구현은 dinov2-small만 지원합니다. mobileclip2-s0는 --dry-run으로 계획을 확인하세요.")

    started_at = time.perf_counter()
    target = export_dinov2_small(args.output_dir)
    print(
        json.dumps(
            {
                "model": args.model,
                "target": str(target),
                "elapsedSeconds": round(time.perf_counter() - started_at, 2),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
