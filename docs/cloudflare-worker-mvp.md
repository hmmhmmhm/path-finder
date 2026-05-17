# Cloudflare Workers MVP

## 목적

이 MVP는 코엑스 실측 데이터가 준비되기 전에 배포 구조를 먼저 검증합니다. 핵심은 사용자 원본 이미지를 서버로 보내지 않고, 브라우저에서 ONNX 모델로 임베딩을 만든 뒤 벡터만 Worker API로 보내는 방식입니다.

## 현재 동작

```text
브라우저
1. 샘플 이미지를 32x32 RGB 텐서로 전처리합니다.
2. ONNX Runtime Web WASM으로 `tiny-image-embed.onnx`를 실행합니다.
3. 64차원 임베딩을 L2 정규화합니다.
4. `/api/search`로 임베딩과 topK를 전송합니다.

Cloudflare Worker
1. 요청의 임베딩 배열을 검증합니다.
2. 내장 샘플 갤러리 임베딩과 cosine similarity를 계산합니다.
3. 상위 후보를 점수와 위치 메타데이터와 함께 반환합니다.
```

## 파일 구성

- `src/main.ts`: 브라우저 UI와 ONNX/WASM 추론
- `src/worker.ts`: Cloudflare Worker 엔트리
- `src/api.ts`: `/api/search` 요청 처리
- `src/search.ts`: cosine similarity 기반 검색
- `src/generated/sample-gallery.ts`: 로컬에서 생성한 샘플 갤러리 임베딩
- `public/models/tiny-image-embed.onnx`: 브라우저용 샘플 ONNX 모델
- `scripts/build_sample_assets.py`: 샘플 이미지, ONNX 모델, 내장 임베딩 생성

## 검증된 항목

- Vitest 단위 테스트로 검색 순위와 API 입력 검증을 확인했습니다.
- TypeScript 타입 체크를 통과했습니다.
- Vite production build를 통과했습니다.
- `wrangler deploy --dry-run`으로 Workers Assets 제한을 통과했습니다.
- agent-browser로 로컬 Worker 페이지에서 샘플 검색을 실행했습니다.

## 현재 한계

- `tiny-image-embed.onnx`는 성능 검증용 모델이 아니라 파이프라인 검증용 모델입니다.
- 실제 코엑스 위치추정에는 DINOv2-small 또는 더 강한 이미지 임베딩 모델이 필요합니다.
- 현재 갤러리는 Worker 코드에 내장되어 있습니다.
- 실제 운영에서는 Cloudflare Vectorize에 임베딩을 저장하고, D1에는 위치 메타데이터를 저장해야 합니다.
- 정밀한 1-3m 위치추정에는 XFeat/LightGlue 또는 HLoc 기반 기하 검증과 2D-3D 자세 추정이 추가되어야 합니다.

## 다음 구현 단계

1. DINOv2-small ONNX 또는 Core ML 변환 실험을 추가합니다.
2. 로컬 ingest 스크립트가 실제 이미지 폴더에서 임베딩 manifest를 생성하도록 확장합니다.
3. Cloudflare Vectorize upsert/query 경로를 붙입니다.
4. R2에는 이미지와 manifest를 저장하고, D1에는 keyframe 위치 메타데이터를 저장합니다.
5. top-K 후보에 대한 로컬 특징 매칭 검증 서비스를 별도 Python API로 분리합니다.
