# Polycam 스캔 전달 가이드

이 문서는 iPhone 15 Pro Max와 Polycam으로 코엑스 내부를 스캔한 뒤, `path-finder` 위치추정 실험에 필요한 파일을 어떤 형태로 전달해야 하는지 정리합니다.

## 결론

가장 중요한 파일은 Polycam의 **Raw Data ZIP**입니다.

```text
필수:
  1. Polycam Raw Data ZIP
  2. 같은 구역에서 별도로 촬영한 query 사진
  3. 구역/층/대략 위치를 적은 metadata 파일

있으면 좋음:
  4. GLB 또는 GLTF
  5. PLY point cloud
  6. floorplan PDF/PNG/DXF
  7. 촬영 경로를 설명한 메모 또는 영상
```

Raw Data ZIP에는 키프레임 이미지, 카메라 내부 파라미터, 카메라 포즈, depth map, confidence map이 들어갈 수 있습니다. 이 데이터가 있어야 “이 이미지가 스캔 좌표계의 어디에서 찍혔는지”를 추적할 수 있습니다. GLB/OBJ/PLY만 있으면 3D 모델 확인은 가능하지만, 이미지 기반 위치추정용 키프레임 데이터로 쓰기 어렵습니다.

## 먼저 확인할 점

Polycam 공식 문서 기준으로 다음 제약이 있습니다.

- LiDAR Raw Data export는 Developer Mode를 켠 뒤 새로 촬영한 LiDAR 캡처에서만 가능합니다.
- Raw Data는 원래 촬영한 같은 iPhone에서 export해야 합니다.
- Developer Mode를 켜기 전에 이미 찍은 캡처는 Raw Data로 export할 수 없습니다.
- Space Mode LiDAR는 mesh, floorplan, point cloud export를 지원하지만, point cloud 일부 형식은 Business/Enterprise 플랜이 필요할 수 있습니다.
- Free 플랜은 export 형식이 제한됩니다.

따라서 현장에 가기 전에 반드시 Polycam Developer Mode와 export 가능 플랜을 확인해야 합니다.

참고:

- Polycam export formats: https://learn.poly.cam/hc/en-us/articles/27756102599572-What-File-Types-Can-Polycam-Export
- Polycam raw data export: https://learn.poly.cam/hc/en-us/articles/38276871185044-How-to-Extract-Raw-Data-and-What-Is-Included
- Polycam raw data tools: https://github.com/PolyCam/polyform

## iPhone/Polycam 설정

### 1. 장비

```text
권장 장비: iPhone 15 Pro Max
앱: Polycam
캡처 모드: Space Mode 또는 LiDAR 기반 캡처
별도 사진: iPhone 기본 카메라 앱
```

### 2. Developer Mode 켜기

Polycam 앱에서 다음을 먼저 설정합니다.

```text
Polycam 앱 실행
→ Settings
→ Developer Mode
→ On
```

중요: Developer Mode를 켠 뒤 새로 찍은 캡처부터 Raw Data export가 가능합니다. 이미 찍은 캡처에 나중에 Developer Mode를 켜도 raw data가 생기지 않을 수 있습니다.

### 3. 캡처 모드 선택

우리는 다음 순서로 받으면 좋습니다.

```text
1순위: Space Mode (LiDAR) Raw Data ZIP
2순위: GLB 또는 GLTF mesh
3순위: PLY point cloud
4순위: floorplan PNG/PDF/DXF
```

COEX 같은 넓은 실내에서는 한 번에 전체를 찍지 말고 구역별로 나눕니다.

```text
B1-STARFIELD-001
B1-STARFIELD-002
B1-MALL-CORRIDOR-A-001
B1-EXHIBITION-LINK-A-001
B2-PARKING-LINK-A-001
```

## 현장 촬영 방법

### 1. 구역을 작게 나누기

한 캡처는 너무 길게 찍지 않습니다.

```text
권장 길이: 20-60m 구간
권장 시간: 1-3분
권장 방식: 왕복 또는 작은 loop
```

긴 구역을 한 번에 찍으면 포즈 최적화가 실패하거나 Raw Data가 너무 커질 수 있습니다. 구역을 작게 나눠야 나중에 실패한 구간만 다시 찍기 쉽습니다.

### 2. 움직임

```text
천천히 걷기
급회전 금지
좌우 벽, 천장, 바닥, 안내판이 같이 보이게 촬영
교차점, 에스컬레이터, 엘리베이터, 출입구는 천천히 한 바퀴 둘러보기
같은 장소를 왕복하며 loop 만들기
```

나쁜 촬영:

```text
바닥만 촬영
사람 얼굴을 정면으로 오래 촬영
너무 빠른 회전
유리벽만 길게 촬영
어두운 곳에서 흔들린 촬영
매장 계산대, 보안 설비, 개인정보 화면 촬영
```

### 3. query 사진 별도 촬영

Polycam 스캔만으로 끝내지 말고, iPhone 기본 카메라 앱으로 사용자 입력에 해당하는 query 사진을 따로 찍습니다.

위치 하나마다 다음 4방향을 찍습니다.

```text
front.jpg
left.jpg
right.jpg
back.jpg
```

권장 수량:

```text
구역당 기준 위치: 10개
위치당 query 사진: 4장
구역당 query: 40장
```

query 사진은 실제 사용자가 찍을 법한 높이와 구도로 촬영합니다.

## 전달 폴더 구조

스캔 데이터를 이 레포에 직접 커밋하지 마세요. 로컬 또는 별도 스토리지에서 다음 구조로 정리해 주세요.

```text
data/polycam/coex/
  B1-STARFIELD-001/
    raw/
      polycam_raw_export.zip
      extracted/
    exports/
      scan.glb
      scan.ply
      floorplan.png
    query/
      P001_front.jpg
      P001_left.jpg
      P001_right.jpg
      P001_back.jpg
      P002_front.jpg
    metadata.json
    README.md
```

`data/polycam/`은 `.gitignore`에 들어 있습니다. 공개 GitHub에는 올라가지 않습니다.

## 파일 이름 규칙

구역 폴더:

```text
{floor}-{zone}-{sequence}
```

예:

```text
B1-STARFIELD-001
B1-MALL-CORRIDOR-A-001
B2-SAMSEONG-LINK-001
```

query 사진:

```text
P{pointNumber}_{direction}.jpg
```

예:

```text
P001_front.jpg
P001_left.jpg
P001_right.jpg
P001_back.jpg
```

## metadata.json 형식

각 구역 폴더에 `metadata.json`을 넣습니다.

```json
{
  "site": "COEX",
  "captureId": "B1-STARFIELD-001",
  "floor": "B1",
  "zone": "STARFIELD",
  "device": "iPhone 15 Pro Max",
  "app": "Polycam",
  "captureMode": "Space Mode LiDAR",
  "developerModeEnabledBeforeCapture": true,
  "capturedAt": "2026-05-18T10:30:00+09:00",
  "operator": "initials-or-name",
  "privacyChecked": false,
  "exports": {
    "rawZip": "raw/polycam_raw_export.zip",
    "meshGlb": "exports/scan.glb",
    "pointCloudPly": "exports/scan.ply",
    "floorplanPng": "exports/floorplan.png"
  },
  "queryPoints": [
    {
      "id": "P001",
      "description": "별마당도서관 북측 입구 앞",
      "floor": "B1",
      "zone": "STARFIELD",
      "approxX": null,
      "approxY": null,
      "yawDeg": null,
      "images": [
        "query/P001_front.jpg",
        "query/P001_left.jpg",
        "query/P001_right.jpg",
        "query/P001_back.jpg"
      ]
    }
  ],
  "notes": "사람이 많은 시간대. 얼굴 마스킹 필요."
}
```

좌표를 아직 모르면 `approxX`, `approxY`, `yawDeg`는 `null`로 둡니다. 나중에 평면도 정렬 후 채웁니다.

## Mac에서 받은 파일 정리

아래 명령은 레포 루트에서 실행합니다.

```bash
cd /Users/hm/Documents/path-finder
mkdir -p data/polycam/coex/B1-STARFIELD-001/raw
mkdir -p data/polycam/coex/B1-STARFIELD-001/exports
mkdir -p data/polycam/coex/B1-STARFIELD-001/query
```

다운로드한 Polycam Raw Data ZIP을 옮깁니다.

```bash
ls -lh ~/Downloads/*.zip
cp ~/Downloads/YOUR_POLYCAM_RAW_EXPORT.zip \
  data/polycam/coex/B1-STARFIELD-001/raw/polycam_raw_export.zip
```

압축을 풉니다.

```bash
unzip data/polycam/coex/B1-STARFIELD-001/raw/polycam_raw_export.zip \
  -d data/polycam/coex/B1-STARFIELD-001/raw/extracted
```

받은 구조를 확인합니다.

```bash
find data/polycam/coex/B1-STARFIELD-001 -maxdepth 4 -type f | sed -n '1,120p'
```

파일 크기를 확인합니다.

```bash
du -sh data/polycam/coex/B1-STARFIELD-001
```

Git에 올라가지 않는지 확인합니다.

```bash
git status --short --ignored data/polycam/coex/B1-STARFIELD-001
```

정상이라면 `!! data/polycam/...`처럼 ignored로 보이거나, 일반 tracked 변경으로 나오지 않아야 합니다.

## Raw Data ZIP에서 확인할 내용

압축 해제 후 보통 다음과 같은 파일을 기대합니다.

```text
raw.glb 또는 관련 glTF 파일
thumbnail.jpg
polycam.mp4
mesh_info.json
keyframes/
  images/
  corrected_images/
  cameras/
  corrected_cameras/
  depth/
  confidence/
```

우리가 우선 사용할 폴더:

```text
keyframes/corrected_images/
keyframes/corrected_cameras/
keyframes/depth/
keyframes/confidence/
```

`corrected_images`나 `corrected_cameras`가 없으면 `images`와 `cameras`를 사용합니다. 큰 세션에서는 보정 포즈가 없을 수 있으므로, 그 경우 metadata에 적어 둡니다.

## 1차 검수 명령

파일 수를 확인합니다.

```bash
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -type f | wc -l
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -type f | sed -n '1,80p'
```

키프레임 이미지 수를 확인합니다.

```bash
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*images*' -type f | wc -l
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*corrected_images*' -type f | wc -l
```

카메라 JSON 수를 확인합니다.

```bash
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*cameras*' -name '*.json' | wc -l
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*corrected_cameras*' -name '*.json' | wc -l
```

depth/confidence 수를 확인합니다.

```bash
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*depth*' -type f | wc -l
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*confidence*' -type f | wc -l
```

이미지 미리보기를 만듭니다.

```bash
mkdir -p artifacts/polycam-preview/B1-STARFIELD-001
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*corrected_images*' -type f \
  | head -20 \
  | xargs -I{} cp "{}" artifacts/polycam-preview/B1-STARFIELD-001/
```

`corrected_images`가 없으면 `images`로 바꿔 실행합니다.

## 모델 평가용 gallery 만들기

Raw Data에서 키프레임 이미지를 추출한 뒤, 우선 1-2m 간격으로 일부만 gallery로 복사합니다.

```bash
mkdir -p data/private/coex-gallery/B1-STARFIELD-001
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*corrected_images*' -type f \
  | awk 'NR % 5 == 1' \
  | xargs -I{} cp "{}" data/private/coex-gallery/B1-STARFIELD-001/
```

`corrected_images`가 없으면:

```bash
find data/polycam/coex/B1-STARFIELD-001/raw/extracted -path '*keyframes*images*' -type f \
  | awk 'NR % 5 == 1' \
  | xargs -I{} cp "{}" data/private/coex-gallery/B1-STARFIELD-001/
```

DINO manifest를 만듭니다.

```bash
mkdir -p data/private/manifests
uv run --with numpy --with pillow --with torch --with torchvision --with transformers \
  python scripts/ingest_images.py \
  --input data/private/coex-gallery/B1-STARFIELD-001 \
  --output data/private/manifests/B1-STARFIELD-001-dinov2.json \
  --public-prefix /private/coex-gallery/B1-STARFIELD-001 \
  --model dinov2-small \
  --floor B1 \
  --zone STARFIELD
```

MobileCLIP2 manifest를 만듭니다.

```bash
mkdir -p data/private/manifests
uv run --with numpy --with pillow --with onnxruntime --with huggingface-hub \
  python scripts/ingest_images.py \
  --input data/private/coex-gallery/B1-STARFIELD-001 \
  --output data/private/manifests/B1-STARFIELD-001-mobileclip2.json \
  --public-prefix /private/coex-gallery/B1-STARFIELD-001 \
  --model mobileclip2-s0 \
  --floor B1 \
  --zone STARFIELD
```

## query 사진으로 1차 검색 테스트

query 사진을 모아 둡니다.

```bash
find data/polycam/coex/B1-STARFIELD-001/query -type f | sed -n '1,80p'
```

현재 레포의 `benchmark_candidate_models.py`는 query 1장 기준입니다. 특정 query를 지정해 DINO/MobileCLIP2를 비교합니다.

```bash
uv run --with numpy --with pillow --with torch --with torchvision --with transformers --with onnxruntime --with huggingface-hub \
  python scripts/benchmark_candidate_models.py \
  --models dinov2-small mobileclip2-s0-onnx \
  --gallery data/private/coex-gallery/B1-STARFIELD-001 \
  --query data/polycam/coex/B1-STARFIELD-001/query/P001_front.jpg \
  --output artifacts/benchmarks/B1-STARFIELD-001-P001-front.json
```

결과에서 볼 것:

```text
top1
topK
score
medianEmbedMs
```

정답 위치가 top-5에 들어오면 다음 단계로 진행합니다. top-5에도 안 들어오면 gallery 간격, query 품질, 모델 후보를 다시 봅니다.

## Rerank 테스트

SIFT/RANSAC으로 query와 gallery 이미지를 다시 비교합니다.

```bash
npm run rerank:sift -- \
  --query data/polycam/coex/B1-STARFIELD-001/query/P001_front.jpg \
  --gallery data/private/coex-gallery/B1-STARFIELD-001 \
  --output artifacts/reports/B1-STARFIELD-001-P001-front-sift.json
```

ORB/RANSAC도 비교합니다.

```bash
npm run rerank:orb -- \
  --query data/polycam/coex/B1-STARFIELD-001/query/P001_front.jpg \
  --gallery data/private/coex-gallery/B1-STARFIELD-001 \
  --output artifacts/reports/B1-STARFIELD-001-P001-front-orb.json
```

확인할 값:

```text
matches
inliers
inlierRatio
score
```

전역 임베딩 top-K와 SIFT/ORB top-K가 같은 후보를 가리키면 위치 확정 가능성이 올라갑니다.

## 로컬 좌표를 위경도로 매핑하기

Polycam Raw Data의 카메라 포즈는 스캔 내부 로컬 좌표입니다. 이 좌표는 바로 코엑스 위경도가 아닙니다. 실제 위경도 또는 평면도 좌표로 쓰려면 기준점(GCP, Ground Control Point)을 잡아야 합니다.

좌표 매핑은 다음 순서입니다.

```text
Polycam 로컬 좌표 x/z
→ 기준점 기반 Sim(2) 변환
→ ENU meter 좌표
→ WGS84 lat/lon
```

### 1. GCP 파일 만들기

예시 파일:

```text
data/examples/gcp/B1-STARFIELD-001-control-points.example.json
```

형식:

```json
{
  "scanId": "B1-STARFIELD-001",
  "origin": {
    "lat": 37.5102,
    "lon": 127.0602
  },
  "points": [
    {
      "id": "GCP-001",
      "description": "스캔 시작점 근처 식별 가능한 모서리",
      "polycam": { "x": 0, "z": 0 },
      "enu": { "east": 0, "north": 0 }
    }
  ]
}
```

`enu` 대신 직접 위경도를 넣을 수도 있습니다.

```json
{
  "id": "GCP-001",
  "polycam": { "x": 0, "z": 0 },
  "wgs84": { "lat": 37.5102, "lon": 127.0602 }
}
```

권장 기준점 수:

```text
최소: 3개
권장: 4-8개
넓은 구역: 10개 이상
```

기준점은 한 줄로만 놓지 말고, 구역의 양쪽과 교차점에 분산해서 잡습니다.

### 2. 매핑할 Polycam point 파일 만들기

예시 파일:

```text
data/examples/gcp/B1-STARFIELD-001-polycam-points.example.json
```

형식:

```json
{
  "points": [
    {
      "id": "KF-000001",
      "description": "키프레임 카메라 중심",
      "polycam": { "x": 1.5, "z": 2.5 }
    }
  ]
}
```

이 파일에는 keyframe camera center, query 촬영 지점, 수동 기준점 후보 등을 넣을 수 있습니다.

### 3. 변환 리포트 만들기

```bash
npm run georef:polycam -- \
  --gcp data/examples/gcp/B1-STARFIELD-001-control-points.example.json \
  --points data/examples/gcp/B1-STARFIELD-001-polycam-points.example.json \
  --output artifacts/reports/B1-STARFIELD-001-georef.json
```

출력에는 다음이 들어갑니다.

```text
transform.scale
transform.rotationDeg
transform.translation
transform.rmse
mappedPoints[].enu
mappedPoints[].wgs84
```

`rmse`가 클수록 기준점 매칭이 틀렸거나 스캔이 휘었을 가능성이 큽니다. 첫 파일럿에서는 `rmse < 1m`를 목표로 보고, 2-3m 이상이면 기준점을 다시 찍습니다.

### 4. 현재 구현의 한계

현재 `georef:polycam`은 한 층의 작은 구역을 2D로 정렬합니다.

```text
[east, north] = scale * R * [polycam_x, polycam_z] + translation
```

다층, 경사로, 큰 루프, 긴 복도 전체를 한 번에 정렬하는 용도는 아닙니다. 큰 구역은 작은 scan chunk로 나눈 뒤 chunk별 변환을 만들고, 나중에 공통 평면도 좌표계로 병합합니다.

## R2에 올릴 파일

원본 raw data 전체를 공개 GitHub에 올리면 안 됩니다. 운영/공유용으로는 R2 같은 비공개 스토리지를 사용합니다.

권장 R2 key:

```text
scans/coex/B1-STARFIELD-001/raw/polycam_raw_export.zip
scans/coex/B1-STARFIELD-001/exports/scan.glb
scans/coex/B1-STARFIELD-001/exports/scan.ply
keyframes/coex/B1/STARFIELD/B1-STARFIELD-001/{keyframe_id}.jpg
manifests/coex/B1-STARFIELD-001/dinov2-gallery-manifest.json
manifests/coex/B1-STARFIELD-001/mobileclip2-gallery-manifest.json
```

업로드 예:

```bash
npm exec wrangler -- r2 object put path-finder-models/scans/coex/B1-STARFIELD-001/raw/polycam_raw_export.zip \
  --file data/polycam/coex/B1-STARFIELD-001/raw/polycam_raw_export.zip \
  --content-type application/zip \
  --remote
```

manifest 업로드 예:

```bash
npm exec wrangler -- r2 object put path-finder-models/manifests/coex/B1-STARFIELD-001/dinov2-gallery-manifest.json \
  --file data/private/manifests/B1-STARFIELD-001-dinov2.json \
  --content-type application/json \
  --remote
```

주의: 현재 `path-finder-models` 버킷을 모델과 실험 데이터에 같이 쓰는 예시입니다. 운영에서는 `path-finder-scans` 같은 별도 비공개 버킷을 만드는 것이 더 좋습니다.

## D1 metadata 등록 준비

최소 metadata는 다음 필드가 필요합니다.

```text
id
site
floor
zone
label
image_r2_key
scan_id
x
y
yaw
captured_at
```

아직 자동 등록 스크립트가 없으므로, 첫 파일럿에서는 JSON manifest를 먼저 만들고 수동 검수 후 D1 등록 스크립트를 추가합니다.

## 전달 전 체크리스트

- [ ] Polycam Developer Mode를 켠 뒤 새로 촬영했다.
- [ ] Raw Data ZIP이 있다.
- [ ] ZIP을 같은 iPhone에서 export했다.
- [ ] `keyframes/images` 또는 `keyframes/corrected_images`가 있다.
- [ ] `keyframes/cameras` 또는 `keyframes/corrected_cameras`가 있다.
- [ ] query 사진을 별도로 찍었다.
- [ ] metadata.json을 작성했다.
- [ ] 얼굴, 결제 화면, 민감한 매장 내부 정보가 있는지 확인했다.
- [ ] 원본 데이터가 Git에 올라가지 않는 것을 확인했다.
- [ ] R2 또는 별도 비공개 스토리지 업로드 경로를 정했다.

## 처음 전달할 최소 세트

처음에는 전체 코엑스가 아니라 한 구역만 주세요.

```text
B1-STARFIELD-001/
  raw/polycam_raw_export.zip
  query/P001_front.jpg
  query/P001_left.jpg
  query/P001_right.jpg
  query/P001_back.jpg
  query/P002_front.jpg
  metadata.json
```

이 정도면 다음을 확인할 수 있습니다.

```text
1. Raw Data ZIP 구조가 현재 파이프라인에 맞는지
2. 키프레임 이미지와 카메라 포즈를 읽을 수 있는지
3. DINO/MobileCLIP2 gallery manifest를 만들 수 있는지
4. query 사진이 top-K 후보를 제대로 찾는지
5. SIFT/ORB rerank가 후보를 좁히는지
```

이 검수가 통과하면 구역 수를 늘립니다.
