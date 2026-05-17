from __future__ import annotations

import time
from dataclasses import dataclass
from functools import cached_property
from typing import Protocol

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image


class ImageEmbedder(Protocol):
    model_id: str
    dimensions: int

    def embed(self, image: Image.Image) -> list[float]:
        ...


def normalize(vector: list[float]) -> list[float]:
    norm = sum(value * value for value in vector) ** 0.5
    if norm == 0:
        return vector
    return [value / norm for value in vector]


@dataclass
class Dinov2SmallEmbedder:
    model_id: str = "dinov2-small-v1"
    dimensions: int = 384

    @cached_property
    def resources(self):
        import torch
        from transformers import AutoImageProcessor, AutoModel

        torch.set_num_threads(1)
        processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
        model = AutoModel.from_pretrained("facebook/dinov2-small").eval()
        return torch, processor, model

    def embed(self, image: Image.Image) -> list[float]:
        torch, processor, model = self.resources
        inputs = processor(images=[image.convert("RGB")], return_tensors="pt")
        with torch.inference_mode():
            output = model(**inputs).last_hidden_state[:, 0, :].cpu().numpy()[0]
        return normalize([float(value) for value in output])


@dataclass
class MobileClip2S0Embedder:
    model_id: str = "mobileclip2-s0-onnx-v1"
    dimensions: int = 512

    @cached_property
    def resources(self):
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download

        model_path = hf_hub_download("plhery/mobileclip2-onnx", "onnx/s0/vision_model.onnx")
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        return session, session.get_inputs()[0].name, session.get_outputs()[0].name

    def embed(self, image: Image.Image) -> list[float]:
        import numpy as np

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
        input_tensor = np.transpose(array, (2, 0, 1))[None, :, :, :]
        session, input_name, output_name = self.resources
        output = session.run([output_name], {input_name: input_tensor})[0][0]
        return normalize([float(value) for value in output])


def create_default_registry() -> dict[str, ImageEmbedder]:
    embedders: list[ImageEmbedder] = [Dinov2SmallEmbedder(), MobileClip2S0Embedder()]
    return {embedder.model_id: embedder for embedder in embedders}


def create_app(registry: dict[str, ImageEmbedder] | None = None) -> FastAPI:
    app = FastAPI(title="path-finder embed API")
    embedders = registry if registry is not None else create_default_registry()

    @app.get("/health")
    async def health() -> dict:
        return {"ok": True, "models": sorted(embedders)}

    @app.post("/embed")
    async def embed(modelId: str = Form(...), image: UploadFile = File(...)) -> dict:
        embedder = embedders.get(modelId)
        if not embedder:
            raise HTTPException(status_code=404, detail="지원하지 않는 modelId입니다.")

        preprocess_started_at = time.perf_counter()
        with Image.open(image.file) as loaded_image:
            query_image = loaded_image.convert("RGB")
        preprocess_ms = (time.perf_counter() - preprocess_started_at) * 1000
        inference_started_at = time.perf_counter()
        embedding = embedder.embed(query_image)
        inference_ms = (time.perf_counter() - inference_started_at) * 1000

        return {
            "modelId": embedder.model_id,
            "dimensions": embedder.dimensions,
            "embedding": embedding,
            "timings": {
                "preprocessMs": round(preprocess_ms, 3),
                "inferenceMs": round(inference_ms, 3),
            },
        }

    return app


app = create_app()
