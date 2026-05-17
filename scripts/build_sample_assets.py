#!/usr/bin/env python3
"""브라우저 ONNX 추론과 Worker 검색을 검증하기 위한 샘플 자산 생성기."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MODEL_PATH = PUBLIC / "models" / "tiny-image-embed.onnx"
GALLERY_DIR = PUBLIC / "gallery"
QUERY_DIR = PUBLIC / "samples"
GENERATED_TS = ROOT / "src" / "generated" / "sample-gallery.ts"


class TinyImageEmbed(torch.nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.pool = torch.nn.AvgPool2d(kernel_size=4, stride=4)
        self.flatten = torch.nn.Flatten()
        self.projection = torch.nn.Linear(3 * 8 * 8, 64)

        generator = torch.Generator().manual_seed(20260517)
        with torch.no_grad():
            weight = torch.randn(self.projection.weight.shape, generator=generator) * 0.08
            bias = torch.linspace(-0.05, 0.05, self.projection.bias.shape[0])
            self.projection.weight.copy_(weight)
            self.projection.bias.copy_(bias)

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        x = self.pool(image)
        x = self.flatten(x)
        return self.projection(x)


def ensure_dirs() -> None:
    for path in [MODEL_PATH.parent, GALLERY_DIR, QUERY_DIR, GENERATED_TS.parent]:
        path.mkdir(parents=True, exist_ok=True)


def draw_place(index: int, label: str, color: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (320, 240), color)
    draw = ImageDraw.Draw(image)
    accent = tuple(max(0, min(255, channel + 55)) for channel in color)
    dark = tuple(max(0, channel - 70) for channel in color)

    for offset in range(0, 360, 32):
        draw.line((offset, 0, offset - 140, 240), fill=accent, width=6)
    draw.rectangle((22, 24, 298, 216), outline=dark, width=6)
    draw.rectangle((42, 52, 278, 104), fill=(245, 245, 235))
    draw.text((54, 68), label, fill=(24, 24, 24))
    draw.text((54, 130), f"COEX B{1 + index % 2} / ZONE {index + 1:02d}", fill=dark)
    draw.ellipse((232, 142, 274, 184), fill=accent, outline=dark, width=3)
    return image


def preprocess(image: Image.Image) -> torch.Tensor:
    resized = image.convert("RGB").resize((32, 32), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    chw = np.transpose(array, (2, 0, 1))
    return torch.from_numpy(chw).unsqueeze(0)


def normalize(vector: np.ndarray) -> list[float]:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        return vector.astype(float).tolist()
    return (vector / norm).astype(float).round(6).tolist()


def export_model(model: TinyImageEmbed) -> None:
    dummy = torch.zeros((1, 3, 32, 32), dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy,
        MODEL_PATH,
        input_names=["image"],
        output_names=["embedding"],
        opset_version=17,
        external_data=False,
    )


def main() -> None:
    ensure_dirs()
    model = TinyImageEmbed().eval()
    export_model(model)

    places = [
        ("별마당도서관 북측", (84, 121, 190)),
        ("삼성역 연결 통로", (63, 154, 139)),
        ("코엑스몰 동측 복도", (190, 111, 72)),
        ("전시장 연결부", (133, 105, 181)),
        ("푸드코트 진입부", (186, 91, 118)),
        ("아쿠아리움 방향", (72, 141, 184)),
        ("지하 주차장 연결부", (116, 132, 96)),
        ("봉은사역 방향", (170, 139, 69)),
    ]

    gallery_items = []
    with torch.no_grad():
        for index, (label, color) in enumerate(places):
            image = draw_place(index, label, color)
            image_path = GALLERY_DIR / f"coex-sample-{index + 1:02d}.jpg"
            image.save(image_path, quality=90)
            embedding = model(preprocess(image)).numpy()[0]
            gallery_items.append(
                {
                    "id": f"coex-sample-{index + 1:02d}",
                    "label": label,
                    "floor": f"B{1 + index % 2}",
                    "zone": f"ZONE-{index + 1:02d}",
                    "x": 20 + index * 8,
                    "y": 35 + (index % 4) * 12,
                    "imagePath": f"/gallery/{image_path.name}",
                    "vector": normalize(embedding),
                }
            )

    query = draw_place(0, "별마당도서관 북측", (84, 121, 190))
    query = ImageEnhance.Brightness(query.crop((18, 12, 310, 228)).resize((320, 240))).enhance(1.08)
    query.save(QUERY_DIR / "query-starfield-north.jpg", quality=88)

    (GALLERY_DIR / "index.json").write_text(
        json.dumps(gallery_items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "import type { GalleryEmbedding } from '../search';",
        "",
        "export const sampleGallery: GalleryEmbedding[] = ",
        json.dumps(gallery_items, ensure_ascii=False, indent=2),
        ";",
        "",
    ]
    GENERATED_TS.write_text("\n".join(lines), encoding="utf-8")

    print(f"ONNX 모델 생성: {MODEL_PATH.relative_to(ROOT)}")
    print(f"샘플 이미지 생성: {len(gallery_items)}개")
    print(f"샘플 임베딩 생성: {GENERATED_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
