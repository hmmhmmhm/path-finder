#!/usr/bin/env python3
"""DINO top-K 후보를 ORB/RANSAC 이미지 매칭 점수로 재정렬한다."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QUERY = ROOT / "public" / "samples" / "query-starfield-north.jpg"
DEFAULT_GALLERY = ROOT / "public" / "gallery"
DEFAULT_OUTPUT = ROOT / "artifacts" / "reports" / "orb-rerank-report.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def image_paths(input_dir: Path) -> list[Path]:
    input_dir = input_dir.resolve()
    return sorted(path for path in input_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)


def load_gray(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"이미지를 읽을 수 없습니다: {path}")
    return image


def match_pair(query_path: Path, candidate_path: Path) -> dict:
    orb = cv2.ORB_create(nfeatures=1500)
    query = load_gray(query_path)
    candidate = load_gray(candidate_path)
    kp1, des1 = orb.detectAndCompute(query, None)
    kp2, des2 = orb.detectAndCompute(candidate, None)

    if des1 is None or des2 is None or len(kp1) < 8 or len(kp2) < 8:
        return {"matches": 0, "inliers": 0, "inlierRatio": 0.0, "score": 0.0}

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    raw_matches = matcher.knnMatch(des1, des2, k=2)
    good = []
    for pair in raw_matches:
        if len(pair) != 2:
            continue
        left, right = pair
        if left.distance < 0.75 * right.distance:
            good.append(left)

    if len(good) < 8:
        return {"matches": len(good), "inliers": 0, "inlierRatio": 0.0, "score": float(len(good))}

    pts1 = np.float32([kp1[match.queryIdx].pt for match in good]).reshape(-1, 1, 2)
    pts2 = np.float32([kp2[match.trainIdx].pt for match in good]).reshape(-1, 1, 2)
    _, mask = cv2.findHomography(pts1, pts2, cv2.RANSAC, 5.0)
    inliers = int(mask.sum()) if mask is not None else 0
    ratio = inliers / len(good) if good else 0.0
    return {
        "matches": len(good),
        "inliers": inliers,
        "inlierRatio": round(ratio, 4),
        "score": round(inliers + ratio * 10, 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", type=Path, default=DEFAULT_QUERY)
    parser.add_argument("--gallery", type=Path, default=DEFAULT_GALLERY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()
    query_path = args.query.resolve()
    gallery_path = args.gallery.resolve()

    started_at = time.perf_counter()
    rows = []
    for path in image_paths(gallery_path):
        rows.append(
            {
                "id": path.stem,
                "imagePath": str(path.relative_to(ROOT)),
                **match_pair(query_path, path),
            }
        )
    rows.sort(key=lambda item: item["score"], reverse=True)
    report = {
        "query": str(query_path.relative_to(ROOT)),
        "gallery": str(gallery_path.relative_to(ROOT)),
        "generatedAt": int(time.time()),
        "elapsedMs": round((time.perf_counter() - started_at) * 1000, 2),
        "topK": rows[: args.top_k],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
