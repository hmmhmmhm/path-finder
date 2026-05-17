# 메타데이터 저장 구조

## 목적

Vectorize에는 벡터 검색에 필요한 값만 두고, 위치와 운영 메타데이터는 D1/R2로 분리합니다.

## R2

R2는 큰 바이너리와 원본에 가까운 산출물을 저장합니다.

```text
models/
  dinov2-small-embed-int8.onnx
  mobileclip2-s0-vision.onnx

manifests/
  dinov2/{version}/gallery-manifest.json
  mobileclip2/{version}/gallery-manifest.json

keyframes/
  {site}/{floor}/{zone}/{keyframe_id}.jpg

scans/
  비공개 Polycam export 또는 후처리 산출물
```

공개 레포에는 샘플 manifest만 커밋하고, 실제 코엑스 원본 이미지와 스캔 데이터는 R2 또는 비공개 스토리지에 둡니다.

## Vectorize

Vectorize는 모델별로 분리합니다.

```text
path-finder-dinov2-small       384D cosine
path-finder-mobileclip2-s0     512D cosine
```

벡터 metadata에는 화면 표시와 fallback에 필요한 최소 필드만 둡니다.

```json
{
  "label": "별마당도서관 북측",
  "floor": "B1",
  "zone": "STARFIELD",
  "imagePath": "/keyframes/...",
  "x": 20,
  "y": 35
}
```

## D1

D1은 keyframe, zone, 모델 버전, 평가 결과를 저장합니다.

```sql
CREATE TABLE keyframes (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  floor TEXT NOT NULL,
  zone TEXT NOT NULL,
  label TEXT NOT NULL,
  image_r2_key TEXT NOT NULL,
  scan_id TEXT,
  x REAL,
  y REAL,
  yaw REAL,
  captured_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE embedding_models (
  id TEXT PRIMARY KEY,
  dimensions INTEGER NOT NULL,
  vectorize_index TEXT NOT NULL,
  model_r2_key TEXT,
  input_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE keyframe_embeddings (
  keyframe_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  vector_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (keyframe_id, model_id)
);

CREATE TABLE query_evaluations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  query_image_r2_key TEXT,
  expected_keyframe_id TEXT,
  top1_keyframe_id TEXT,
  top1_score REAL,
  margin REAL,
  confidence TEXT,
  topk_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Worker 응답

Worker는 Vectorize top-K를 받은 뒤 D1 metadata를 붙이는 구조로 확장합니다.

```text
1. query embedding 수신
2. Vectorize top-K 검색
3. D1에서 keyframe metadata 조회
4. confidence 계산
5. 필요하면 정밀 검증 서비스에 top-K 전달
6. 후보, confidence, metadata 반환
```
