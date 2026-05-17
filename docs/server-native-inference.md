# 서버와 네이티브 추론 경로

## 왜 필요한가

브라우저 DINOv2-small WASM은 동작하지만 첫 실행이 수 초 걸립니다. 캐시 후에는 좋아지지만, 운영에서 일관된 응답 시간을 원하면 서버 또는 iPhone 네이티브 추론 경로가 필요합니다.

## 서버 추론 후보

```text
FastAPI + ONNX Runtime CPU
- DINOv2-small int8 기준 35-55ms 수준
- 구현 단순
- GPU 없이도 query 1장 처리 가능

Modal/RunPod/Lambda GPU
- 동시 요청과 더 큰 모델에 유리
- 운영 비용과 cold start 확인 필요

Cloudflare Workers
- Vectorize 검색에는 적합
- 대형 모델 추론에는 부적합
```

## API 형태

```http
POST /embed
content-type: multipart/form-data

image=<file>
modelId=dinov2-small-v1
```

응답:

```json
{
  "modelId": "dinov2-small-v1",
  "dimensions": 384,
  "embedding": [0.1, 0.2],
  "timings": {
    "preprocessMs": 3.2,
    "inferenceMs": 42.1
  }
}
```

서버가 원본 이미지를 받는 방식은 개인정보 부담이 있으므로, 기본은 브라우저/네이티브 추론이고 서버 추론은 옵션으로 둡니다.

## Core ML 경로

iPhone 15 Pro Max를 기준으로 하면 Core ML 변환이 가장 중요한 네이티브 경로입니다.

```text
PyTorch 또는 ONNX
→ coremltools 변환
→ float16 또는 palettization/quantization
→ iPhone 실기기 latency 측정
→ 앱에서 embedding만 Worker로 전송
```

Core ML에서 확인할 항목:

- 모델 크기
- Neural Engine 사용 여부
- 단일 이미지 latency
- 메모리 사용량
- 입력 전처리 비용
- DINOv2-small vs MobileCLIP-S0

## 현재 판단

- 브라우저 기준선: DINOv2-small WASM
- 서버 CPU 후보: DINOv2-small int8, MobileCLIP2-S0 ONNX
- iPhone 후보: DINOv2-small Core ML, MobileCLIP-S0 Core ML
