# 이미지 Ingest

## 목적

반복 검색에서는 매번 1,000장 전체를 다시 추론하지 않습니다. 지도 이미지 또는 키프레임은 미리 임베딩을 계산해 manifest와 Vectorize NDJSON으로 저장하고, 신규 query 이미지만 추론한 뒤 벡터 검색을 수행합니다.

## 입력

```text
이미지 폴더
├── zone-a-001.jpg
├── zone-a-002.jpg
└── zone-b-001.jpg
```

현재 지원 확장자는 `jpg`, `jpeg`, `png`, `webp`입니다.

## Tiny 샘플 manifest 생성

```bash
python3 scripts/ingest_images.py \
  --input public/gallery \
  --output data/manifests/tiny-gallery-manifest.json \
  --public-prefix /gallery \
  --model tiny \
  --floor B1 \
  --zone SAMPLE
```

## DINOv2-small manifest 생성

```bash
python3 scripts/ingest_images.py \
  --input public/gallery \
  --output data/manifests/dinov2-gallery-manifest.json \
  --public-prefix /gallery \
  --model dinov2-small \
  --floor B1 \
  --zone SAMPLE
```

DINOv2 경로는 `torch`, `transformers`, `Pillow`, `numpy`가 필요합니다.

## 출력

스크립트는 두 파일을 생성합니다.

```text
data/manifests/*-manifest.json
data/manifests/*-manifest.ndjson
```

`json` 파일은 실험 재현과 검수용이고, `ndjson` 파일은 Cloudflare Vectorize 업서트용입니다.

## Vectorize 업서트

```bash
npx wrangler vectorize upsert path-finder-dinov2-small \
  --file data/manifests/dinov2-gallery-manifest.ndjson \
  --json
```

현재 샘플 DINOv2 manifest는 384차원 벡터 8개를 포함합니다.

## 운영 확장

실제 코엑스 데이터에서는 manifest를 공개 레포에 직접 커밋하지 않습니다. 원본 이미지와 키프레임은 R2 또는 비공개 스토리지에 두고, 공개 레포에는 스키마, 스크립트, 익명화된 작은 샘플만 둡니다.
