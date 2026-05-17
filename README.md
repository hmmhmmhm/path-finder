# path-finder

`path-finder`는 코엑스 내부 전체를 대상으로, 사용자가 촬영한 단일 이미지 또는 짧은 이미지 시퀀스만으로 현재 위치를 추정하는 실내 위치추정 프로젝트입니다.

초기 목표는 “사진 한 장을 넣으면 코엑스 내부 평면도 위의 위치 후보와 신뢰도를 반환하는 시스템”입니다. 장기 목표는 지하층부터 주요 연결 통로, 몰 내부, 전시장 연결부까지 확장 가능한 시각 기반 위치추정 지도를 구축하는 것입니다.

## 목표

- 코엑스 내부 전체를 대상으로 하는 이미지 기반 위치추정 시스템을 설계하고 검증합니다.
- iPhone 15 Pro Max와 Polycam으로 수집한 공간 스캔, 키프레임 이미지, 카메라 자세, 포인트 클라우드 또는 메시 데이터를 지도 데이터로 사용합니다.
- 신규 사용자 이미지에 대해 빠른 후보 검색과 기하 검증을 조합해 위치를 추정합니다.
- 목표 정확도는 평면도 좌표 기준 1-3m입니다.
- 불확실한 상황에서는 단일 위치를 강제로 반환하지 않고 후보 위치와 신뢰도를 함께 제공합니다.

## 기본 접근

```text
오프라인 지도 구축
1. 코엑스 내부를 구역별로 스캔합니다.
2. 스캔 데이터에서 키프레임 이미지, 카메라 자세, 깊이 또는 3D 데이터를 추출합니다.
3. 각 키프레임의 전역 임베딩과 로컬 특징을 저장합니다.
4. 스캔 좌표계를 코엑스 평면도 좌표계에 정렬합니다.

온라인 위치추정
1. 사용자 이미지에서 전역 임베딩을 추출합니다.
2. 지도 이미지 데이터베이스에서 후보 위치를 빠르게 검색합니다.
3. 후보 이미지와 로컬 특징 매칭을 수행합니다.
4. 가능한 경우 2D-3D 자세 추정을 통해 위치와 방향을 계산합니다.
5. 평면도 좌표, 후보 위치, 신뢰도를 반환합니다.
```

## 초기 기술 후보

- 전역 검색: DINOv2-small, DINOv3 계열, SigLIP 계열
- 로컬 특징 및 검증: XFeat, LightGlue, SuperPoint, ALIKED
- 3D 재구성 및 위치추정: COLMAP, Hierarchical Localization, pycolmap
- 스캔 입력: Polycam LiDAR/Space Mode export, raw data export, 포인트 클라우드, 메시, 키프레임 이미지

## 데이터 원칙

코엑스 내부는 공공 접근이 가능한 상업 공간이지만, 데이터 수집과 공개에는 별도의 주의가 필요합니다.

- 촬영 및 스캔 가능 범위는 현장 정책과 허가 조건을 따릅니다.
- 사람 얼굴, 차량번호, 결제 화면, 매장 내부 민감 정보는 공개 데이터셋에 포함하지 않습니다.
- 원본 스캔 데이터는 공개 레포에 올리지 않습니다.
- 공개 레포에는 코드, 문서, 익명화된 샘플, 재현 가능한 실험 스크립트만 포함합니다.
- 지도 데이터와 운영 데이터는 별도 비공개 저장소 또는 스토리지로 관리합니다.

## 현재 단계

이 레포는 Cloudflare Workers 기반 MVP를 포함합니다. 현재 구현은 실제 코엑스 데이터가 아니라, 샘플 이미지와 로컬에서 변환한 작은 ONNX 모델로 “브라우저 임베딩 생성 → Worker 검색 API → 위치 후보 반환” 경로를 검증합니다.

DINOv2-small도 ONNX int8 변환과 384차원 Vectorize 인덱스 업서트까지 확인했습니다. 24MiB 모델 파일은 Git과 Workers Assets에 넣지 않고 Cloudflare R2의 `path-finder-models` 버킷에서 Worker가 서빙합니다. 브라우저 WASM 추론은 복구 실험을 위해 다시 열어두되, 실제 운영 기본 경로는 서버 추론 또는 네이티브 앱 추론으로 둡니다.

첫 번째 실제 데이터 마일스톤은 코엑스 일부 구간에서 소규모 데이터셋을 만들어 다음 질문에 답하는 것입니다.

- 전역 임베딩만으로 올바른 위치 후보를 얼마나 잘 찾는가?
- 로컬 특징 매칭을 붙였을 때 오탐이 얼마나 줄어드는가?
- Polycam 스캔 좌표를 평면도 좌표로 안정적으로 정렬할 수 있는가?
- 단일 이미지 기준 1m, 3m, 5m 이내 성공률은 어느 정도인가?

## 로컬 실행

```bash
npm install
npm test
npm run build
npm exec wrangler -- dev --local --port 8787
```

브라우저에서 `http://localhost:8787`을 열면 샘플 이미지 검색 화면을 볼 수 있습니다.

Python 기반 평가 스크립트는 `uv`로 필요한 패키지를 임시 환경에 설치해 실행합니다.

```bash
npm run evaluate:thresholds
npm run sweep:thresholds
npm run rerank:orb
npm run rerank:sift
npm run benchmark:core-models
```

서버 추론 프로토타입은 다음 명령으로 실행합니다.

```bash
npm run server:embed
```

## 샘플 자산 생성

현재 샘플 자산은 다음 스크립트로 생성합니다.

```bash
python3 scripts/build_sample_assets.py
```

이 스크립트는 다음 파일을 만듭니다.

- `public/models/tiny-image-embed.onnx`: 프론트에서 실행하는 작은 ONNX 이미지 임베딩 모델
- `public/gallery/*.jpg`: 샘플 지도 이미지
- `public/samples/query-starfield-north.jpg`: 샘플 query 이미지
- `src/generated/sample-gallery.ts`: Worker API가 사용하는 내장 샘플 임베딩

`tiny-image-embed.onnx`는 전체 파이프라인 검증용 모델입니다. 실제 위치추정 성능을 목표로 할 때는 DINOv2-small 또는 동급 모델에서 추출한 임베딩으로 교체합니다. 대형 모델 파일은 `artifacts/models/`에 생성한 뒤 R2에 업로드하고, 공개 레포에는 커밋하지 않습니다.

## 이미지 Ingest

반복 대조용 지도 이미지는 미리 임베딩 manifest로 변환합니다.

```bash
python3 scripts/ingest_images.py \
  --input public/gallery \
  --output data/manifests/dinov2-gallery-manifest.json \
  --public-prefix /gallery \
  --model dinov2-small \
  --floor B1 \
  --zone SAMPLE
```

자세한 절차는 [이미지 Ingest](docs/ingest.md)를 참고합니다.

## Cloudflare 구성

- 정적 프론트엔드는 Workers Assets로 배포합니다.
- `/api/search`는 Worker에서 처리합니다.
- 현재 배포는 Cloudflare Vectorize 샘플 인덱스 `path-finder-sample-embeddings`를 사용합니다.
- DINOv2-small용 384차원 인덱스는 `path-finder-dinov2-small`입니다.
- DINOv2-small ONNX 파일은 R2 버킷 `path-finder-models`의 `models/dinov2-small-embed-int8.onnx`에서 서빙합니다.
- `VECTORIZE` 또는 `VECTORIZE_SAMPLE` 바인딩이 없을 때는 `src/generated/sample-gallery.ts`의 내장 배열로 fallback합니다.
- 실제 운영에서는 Vectorize, D1, R2를 함께 사용합니다.
- 브라우저는 ONNX Runtime Web WASM으로 이미지 1장의 임베딩을 계산하고, 원본 이미지 대신 벡터만 API로 전송합니다.

## 주요 문서

- [Cloudflare Workers MVP](docs/cloudflare-worker-mvp.md)
- [Vectorize 연동](docs/vectorize.md)
- [DINOv2-small ONNX 실험](docs/dinov2-onnx.md)
- [DINO 평가와 판정 정책](docs/dino-evaluation.md)
- [DINO 모델 변형 비교](docs/dino-variants.md)
- [브라우저 성능 벤치마크](docs/browser-benchmark.md)
- [소형 이미지 임베딩 모델 후보](docs/model-candidates.md)
- [서버/네이티브 추론 경로](docs/server-native-inference.md)
- [메타데이터 저장 구조](docs/metadata-storage.md)
- [코엑스 파일럿 수집 계획](docs/pilot-coex.md)
- [정밀 검증 설계](docs/precision-verification.md)

## 저장소 구조

```text
docs/         프로젝트 설계, 실험 프로토콜, 데이터 정책
experiments/  재현 가능한 실험 스크립트와 결과 요약
data/         공개 가능한 작은 샘플 또는 자리 표시자만 보관
migrations/   Cloudflare D1 metadata schema
public/       프론트 정적 자산, 샘플 이미지, 샘플 ONNX 모델
services/     서버 추론 프로토타입
src/          Worker API와 브라우저 프론트 코드
scripts/      샘플 모델과 샘플 임베딩 생성 스크립트
tests/        검색과 API 동작 테스트
```

## 라이선스

초기 코드는 MIT 라이선스로 공개합니다. 실제 코엑스 스캔 데이터, 평면도, 운영 데이터는 별도 라이선스와 접근 정책을 적용합니다.
