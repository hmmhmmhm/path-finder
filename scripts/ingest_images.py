#!/usr/bin/env python3
"""이미지 폴더를 임베딩 manifest와 Vectorize NDJSON으로 변환한다."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import time
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9가-힣_-]+", "-", value.strip()).strip("-")
    return cleaned or "image"


def normalize(vector: np.ndarray) -> list[float]:
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        return vector.astype(float).tolist()
    return (vector / norm).astype(float).round(6).tolist()


def find_images(input_dir: Path) -> list[Path]:
    return sorted(path for path in input_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS)


def public_image_path(image_path: Path, input_dir: Path, public_prefix: str, output_name: str, copy_images: bool) -> str:
    if copy_images:
        relative_path = output_name
    else:
        relative_path = image_path.relative_to(input_dir).as_posix()
    return f"{public_prefix.rstrip('/')}/{relative_path}"


def build_tiny_embedder(model_path: Path) -> Callable[[Image.Image], list[float]]:
    import onnxruntime as ort

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    def embed(image: Image.Image) -> list[float]:
        resized = image.convert("RGB").resize((32, 32), Image.Resampling.BILINEAR)
        array = np.asarray(resized, dtype=np.float32) / 255.0
        chw = np.transpose(array, (2, 0, 1))[None, :, :, :]
        output = session.run(["embedding"], {"image": chw})[0][0]
        return normalize(output)

    return embed


def build_dinov2_embedder() -> Callable[[Image.Image], list[float]]:
    import torch
    from transformers import AutoImageProcessor, AutoModel

    processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
    model = AutoModel.from_pretrained("facebook/dinov2-small").eval()

    def embed(image: Image.Image) -> list[float]:
        inputs = processor(images=[image.convert("RGB")], return_tensors="pt")
        with torch.inference_mode():
            output = model(**inputs).last_hidden_state[:, 0, :].cpu().numpy()[0]
        return normalize(output)

    return embed


def mobileclip2_preprocess(image: Image.Image) -> np.ndarray:
    image = image.convert("RGB")
    width, height = image.size
    if width < height:
        resized = (256, round(height * 256 / width))
    else:
        resized = (round(width * 256 / height), 256)
    image = image.resize(resized, Image.Resampling.BICUBIC)
    left = (image.width - 256) // 2
    top = (image.height - 256) // 2
    image = image.crop((left, top, left + 256, top + 256))
    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.transpose(array, (2, 0, 1))[None, :, :, :]


def build_mobileclip2_embedder() -> Callable[[Image.Image], list[float]]:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download

    model_path = hf_hub_download("plhery/mobileclip2-onnx", "onnx/s0/vision_model.onnx")
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    def embed(image: Image.Image) -> list[float]:
        output = session.run([output_name], {input_name: mobileclip2_preprocess(image)})[0][0]
        return normalize(output)

    return embed


def vectorize_record(item: dict) -> dict:
    return {
        "id": item["id"],
        "values": item["vector"],
        "metadata": {
            "label": item["label"],
            "floor": item.get("floor"),
            "zone": item.get("zone"),
            "x": item.get("x"),
            "y": item.get("y"),
            "imagePath": item["imagePath"],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path, help="원본 이미지 폴더")
    parser.add_argument("--output", required=True, type=Path, help="manifest 출력 경로")
    parser.add_argument("--public-prefix", default="/gallery", help="프론트에서 접근할 이미지 경로 prefix")
    parser.add_argument("--copy-images-to", type=Path, help="이미지를 public 폴더로 복사할 경로")
    parser.add_argument("--model", choices=["tiny", "dinov2-small", "mobileclip2-s0-onnx"], default="tiny")
    parser.add_argument("--floor", default="")
    parser.add_argument("--zone", default="")
    args = parser.parse_args()

    images = find_images(args.input)
    if not images:
        raise SystemExit(f"이미지를 찾지 못했습니다: {args.input}")

    if args.model == "tiny":
        embed = build_tiny_embedder(ROOT / "public" / "models" / "tiny-image-embed.onnx")
        dimensions = 64
        model_id = "tiny-sample-v1"
    else:
        if args.model == "dinov2-small":
            embed = build_dinov2_embedder()
            dimensions = 384
            model_id = "dinov2-small-v1"
        else:
            embed = build_mobileclip2_embedder()
            dimensions = 512
            model_id = "mobileclip2-s0-onnx-v1"

    if args.copy_images_to:
        args.copy_images_to.mkdir(parents=True, exist_ok=True)

    items = []
    start = time.perf_counter()
    for index, image_path in enumerate(images):
        item_id = f"{slug(image_path.stem)}-{index + 1:04d}"
        output_name = f"{item_id}{image_path.suffix.lower()}"
        public_path = public_image_path(
            image_path=image_path,
            input_dir=args.input,
            public_prefix=args.public_prefix,
            output_name=output_name,
            copy_images=args.copy_images_to is not None,
        )

        if args.copy_images_to:
            shutil.copy2(image_path, args.copy_images_to / output_name)

        with Image.open(image_path) as image:
            vector = embed(image)

        items.append(
            {
                "id": item_id,
                "label": image_path.stem,
                "floor": args.floor or None,
                "zone": args.zone or None,
                "x": None,
                "y": None,
                "imagePath": public_path,
                "vector": vector,
            }
        )

        if (index + 1) % 25 == 0:
            print(f"encoded {index + 1}/{len(images)}", flush=True)

    manifest = {
        "model": {
            "id": model_id,
            "dimensions": dimensions,
        },
        "items": items,
        "source": {
            "input": str(args.input),
            "generatedAt": int(time.time()),
        },
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    ndjson_path = args.output.with_suffix(".ndjson")
    ndjson_path.write_text(
        "\n".join(json.dumps(vectorize_record(item), ensure_ascii=False) for item in items) + "\n",
        encoding="utf-8",
    )

    elapsed = time.perf_counter() - start
    print(f"manifest: {args.output}")
    print(f"vectorize: {ndjson_path}")
    print(f"images: {len(items)}")
    print(f"elapsed: {elapsed:.2f}s")


if __name__ == "__main__":
    main()
