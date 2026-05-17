# Vectorize 연동

## 목적

샘플 MVP는 내장 배열로 검색하지만, 실제 코엑스 전체 지도에서는 Worker 코드 안에 모든 임베딩을 넣을 수 없습니다. 운영 구조에서는 Cloudflare Vectorize에 이미지 임베딩을 저장하고, Worker는 query 임베딩으로 top-K 후보를 검색합니다.

## 샘플 인덱스

현재 샘플 ONNX 모델은 64차원 임베딩을 생성합니다. 샘플 인덱스는 다음 설정을 사용합니다.

```bash
npx wrangler vectorize create path-finder-sample-embeddings \
  --dimensions 64 \
  --metric cosine \
  --binding VECTORIZE \
  --update-config
```

현재 공개 배포는 다음 인덱스를 사용합니다.

```text
index_name: path-finder-sample-embeddings
binding: VECTORIZE 또는 VECTORIZE_SAMPLE
dimensions: 64
metric: cosine
stored vectors: 8
```

샘플 갤러리 임베딩은 다음 명령으로 NDJSON 파일로 내보냅니다.

```bash
npm run vectorize:sample
```

업로드는 다음 명령을 사용합니다.

```bash
npx wrangler vectorize upsert path-finder-sample-embeddings \
  --file data/vectorize/sample-gallery.ndjson
```

## DINOv2-small 인덱스

DINOv2-small CLS 임베딩은 384차원입니다. 현재 샘플 8장에 대해 별도 인덱스를 만들고 업서트했습니다.

```text
index_name: path-finder-dinov2-small
binding: VECTORIZE_DINOV2
dimensions: 384
metric: cosine
stored vectors: 8
```

생성 명령은 다음과 같습니다.

```bash
npx wrangler vectorize create path-finder-dinov2-small \
  --dimensions 384 \
  --metric cosine
```

업서트 명령은 다음과 같습니다.

```bash
npx wrangler vectorize upsert path-finder-dinov2-small \
  --file data/manifests/dinov2-gallery-manifest.ndjson \
  --json
```

## Worker 동작

- `VECTORIZE_SAMPLE` 또는 `VECTORIZE` 바인딩이 있으면 tiny 샘플 검색에 Vectorize를 사용합니다.
- `VECTORIZE_DINOV2` 바인딩이 있으면 `modelId: "dinov2-small-v1"` 검색에 384차원 Vectorize를 사용합니다.
- 바인딩이 없으면 `src/generated/sample-gallery.ts`에 내장된 샘플 배열을 사용합니다.
- `/api/search` 응답에는 `backend` 필드가 포함되어 현재 사용한 검색 백엔드를 확인할 수 있습니다.

배포된 API 검증 예시는 다음과 같습니다.

```json
{
  "backend": "vectorize",
  "topK": 2,
  "first": {
    "id": "coex-sample-01",
    "label": "별마당도서관 북측",
    "floor": "B1",
    "zone": "ZONE-01",
    "score": 0.9999987,
    "rank": 1
  }
}
```

## 실제 DINOv2 전환 시 주의점

샘플 모델은 64차원이고 DINOv2-small CLS 임베딩은 384차원입니다. 두 인덱스는 서로 호환되지 않습니다. 모델을 바꾸면 갤러리 임베딩과 query 임베딩을 같은 모델로 다시 생성해야 합니다.

브라우저 DINOv2-small WASM 추론은 현재 비활성화되어 있으므로, API 검증은 미리 생성된 384차원 벡터나 서버/네이티브 추론 결과를 사용합니다.
