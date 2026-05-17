#!/usr/bin/env python3
"""후보 이미지 임베딩 모델을 같은 샘플 데이터로 비교한다."""

from __future__ import annotations

import argparse
import json
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "public" / "gallery"
QUERY = ROOT / "public" / "samples" / "query-starfield-north.jpg"
OUT = ROOT / "artifacts" / "benchmarks" / "candidate-models.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class Embedder:
    model_id: str
    display_name: str
    dimensions: int
    model_size_mib: float | None
    load_seconds: float
    embed: Callable[[Image.Image], np.ndarray]


def normalize(vector: np.ndarray) -> np.ndarray:
    vector = vector.astype(np.float32)
    norm = float(np.linalg.norm(vector))
    if norm == 0:
        return vector
    return vector / norm


def image_paths(input_dir: Path) -> list[Path]:
    return sorted(path for path in input_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)


def file_size_mib(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)


def cosine_search(query: np.ndarray, gallery: list[tuple[Path, np.ndarray]], top_k: int) -> list[dict]:
    results = []
    for path, vector in gallery:
        results.append(
            {
                "id": path.stem,
                "score": float(np.dot(query, vector)),
            }
        )
    results.sort(key=lambda item: item["score"], reverse=True)
    return [{**item, "rank": index + 1} for index, item in enumerate(results[:top_k])]


def load_dinov2() -> Embedder:
    started_at = time.perf_counter()
    import torch
    from transformers import AutoImageProcessor, AutoModel

    processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
    model = AutoModel.from_pretrained("facebook/dinov2-small").eval()
    torch.set_num_threads(1)

    def embed(image: Image.Image) -> np.ndarray:
        inputs = processor(images=[image.convert("RGB")], return_tensors="pt")
        with torch.inference_mode():
            output = model(**inputs).last_hidden_state[:, 0, :].cpu().numpy()[0]
        return normalize(output)

    model_path = ROOT / "artifacts" / "models" / "dinov2-small-embed-int8.onnx"
    size = file_size_mib(model_path) if model_path.exists() else None
    return Embedder(
        model_id="dinov2-small-v1",
        display_name="DINOv2-small",
        dimensions=384,
        model_size_mib=size,
        load_seconds=time.perf_counter() - started_at,
        embed=embed,
    )


def load_mobileclip_s0() -> Embedder:
    started_at = time.perf_counter()
    import mobileclip
    import torch
    from huggingface_hub import hf_hub_download

    checkpoint = Path(hf_hub_download("apple/MobileCLIP-S0", "mobileclip_s0.pt"))
    model, _, preprocess = mobileclip.create_model_and_transforms(
        "mobileclip_s0",
        pretrained=str(checkpoint),
    )
    model.eval()
    torch.set_num_threads(1)

    def embed(image: Image.Image) -> np.ndarray:
        tensor = preprocess(image.convert("RGB")).unsqueeze(0)
        with torch.inference_mode():
            output = model.encode_image(tensor).cpu().numpy()[0]
        return normalize(output)

    return Embedder(
        model_id="mobileclip-s0",
        display_name="MobileCLIP-S0",
        dimensions=512,
        model_size_mib=file_size_mib(checkpoint),
        load_seconds=time.perf_counter() - started_at,
        embed=embed,
    )


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


def load_mobileclip2_s0_onnx() -> Embedder:
    started_at = time.perf_counter()
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download

    model_path = Path(hf_hub_download("plhery/mobileclip2-onnx", "onnx/s0/vision_model.onnx"))
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    def embed(image: Image.Image) -> np.ndarray:
        output = session.run([output_name], {input_name: mobileclip2_preprocess(image)})[0][0]
        return normalize(output)

    return Embedder(
        model_id="mobileclip2-s0-onnx",
        display_name="MobileCLIP2-S0 ONNX",
        dimensions=512,
        model_size_mib=file_size_mib(model_path),
        load_seconds=time.perf_counter() - started_at,
        embed=embed,
    )


def load_siglip_base() -> Embedder:
    started_at = time.perf_counter()
    import torch
    from huggingface_hub import hf_hub_download
    from transformers import AutoImageProcessor, AutoModel

    model_id = "google/siglip-base-patch16-224"
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id).eval()
    torch.set_num_threads(1)

    def embed(image: Image.Image) -> np.ndarray:
        inputs = processor(images=[image.convert("RGB")], return_tensors="pt")
        with torch.inference_mode():
            output = model.get_image_features(pixel_values=inputs["pixel_values"])
        vector = output.pooler_output if hasattr(output, "pooler_output") else output
        return normalize(vector.cpu().numpy()[0])

    model_path = Path(hf_hub_download(model_id, "model.safetensors"))
    return Embedder(
        model_id="siglip-base-patch16-224",
        display_name="SigLIP base patch16 224",
        dimensions=768,
        model_size_mib=file_size_mib(model_path),
        load_seconds=time.perf_counter() - started_at,
        embed=embed,
    )


LOADERS: dict[str, Callable[[], Embedder]] = {
    "dinov2-small": load_dinov2,
    "mobileclip-s0": load_mobileclip_s0,
    "mobileclip2-s0-onnx": load_mobileclip2_s0_onnx,
    "siglip-base": load_siglip_base,
}


def benchmark_model(embedder: Embedder, gallery_paths: list[Path], query_path: Path, top_k: int) -> dict:
    gallery_vectors: list[tuple[Path, np.ndarray]] = []
    times_ms: list[float] = []

    all_paths = [*gallery_paths, query_path]
    for path in all_paths:
        with Image.open(path) as image:
            started_at = time.perf_counter()
            vector = embedder.embed(image)
            times_ms.append((time.perf_counter() - started_at) * 1000)
        if path != query_path:
            gallery_vectors.append((path, vector))
        else:
            query_vector = vector

    top = cosine_search(query_vector, gallery_vectors, top_k)
    return {
        "modelId": embedder.model_id,
        "displayName": embedder.display_name,
        "dimensions": embedder.dimensions,
        "modelSizeMiB": None if embedder.model_size_mib is None else round(embedder.model_size_mib, 2),
        "loadSeconds": round(embedder.load_seconds, 2),
        "images": len(all_paths),
        "medianEmbedMs": round(float(statistics.median(times_ms)), 2),
        "meanEmbedMs": round(float(statistics.mean(times_ms)), 2),
        "minEmbedMs": round(float(min(times_ms)), 2),
        "maxEmbedMs": round(float(max(times_ms)), 2),
        "topK": top,
        "top1": top[0]["id"] if top else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", nargs="*", default=list(LOADERS), choices=list(LOADERS))
    parser.add_argument("--gallery", type=Path, default=GALLERY)
    parser.add_argument("--query", type=Path, default=QUERY)
    parser.add_argument("--output", type=Path, default=OUT)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    gallery_paths = image_paths(args.gallery)
    if not gallery_paths:
        raise SystemExit(f"갤러리 이미지를 찾지 못했습니다: {args.gallery}")

    results = []
    for name in args.models:
        print(f"benchmarking {name}", flush=True)
        try:
            embedder = LOADERS[name]()
            results.append(benchmark_model(embedder, gallery_paths, args.query, args.top_k))
        except Exception as error:
            results.append({"modelId": name, "error": str(error)})

    report = {
        "gallery": str(args.gallery.relative_to(ROOT)),
        "query": str(args.query.relative_to(ROOT)),
        "expectedTop1": "coex-sample-01",
        "generatedAt": int(time.time()),
        "results": results,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
