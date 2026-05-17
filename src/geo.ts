const EARTH_RADIUS_METERS = 6378137;

export type Wgs84Point = {
  lat: number;
  lon: number;
};

export type Point2D = {
  x: number;
  y: number;
};

export type EnuPoint = {
  east: number;
  north: number;
};

export type SimilarityTransform2D = {
  scale: number;
  rotationRad: number;
  rotationDeg: number;
  translation: Point2D;
  rmse: number;
};

export type ControlPoint2D = {
  source: Point2D;
  target: Point2D;
};

export type PolycamPoint = {
  x: number;
  z: number;
};

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

export function latLonToEnu(point: Wgs84Point, origin: Wgs84Point): EnuPoint {
  const originLatRad = degToRad(origin.lat);
  return {
    east: degToRad(point.lon - origin.lon) * EARTH_RADIUS_METERS * Math.cos(originLatRad),
    north: degToRad(point.lat - origin.lat) * EARTH_RADIUS_METERS,
  };
}

export function enuToLatLon(point: EnuPoint, origin: Wgs84Point): Wgs84Point {
  const originLatRad = degToRad(origin.lat);
  return {
    lat: origin.lat + radToDeg(point.north / EARTH_RADIUS_METERS),
    lon: origin.lon + radToDeg(point.east / (EARTH_RADIUS_METERS * Math.cos(originLatRad))),
  };
}

function centroid(points: Point2D[]): Point2D {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function transformPoint(point: Point2D, transform: SimilarityTransform2D): Point2D {
  const cos = Math.cos(transform.rotationRad);
  const sin = Math.sin(transform.rotationRad);
  return {
    x: transform.scale * (cos * point.x - sin * point.y) + transform.translation.x,
    y: transform.scale * (sin * point.x + cos * point.y) + transform.translation.y,
  };
}

export function fitSimilarity2D(points: ControlPoint2D[]): SimilarityTransform2D {
  if (points.length < 2) {
    throw new Error("좌표 정렬에는 최소 2개 이상의 기준점이 필요합니다.");
  }

  const sources = points.map((point) => point.source);
  const targets = points.map((point) => point.target);
  const sourceCenter = centroid(sources);
  const targetCenter = centroid(targets);

  let a = 0;
  let b = 0;
  let denominator = 0;

  for (const point of points) {
    const sx = point.source.x - sourceCenter.x;
    const sy = point.source.y - sourceCenter.y;
    const tx = point.target.x - targetCenter.x;
    const ty = point.target.y - targetCenter.y;
    a += sx * tx + sy * ty;
    b += sx * ty - sy * tx;
    denominator += sx * sx + sy * sy;
  }

  if (denominator === 0) {
    throw new Error("기준점의 Polycam 좌표가 모두 같아 변환을 추정할 수 없습니다.");
  }

  const scale = Math.hypot(a, b) / denominator;
  const rotationRad = Math.atan2(b, a);
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const translation = {
    x: targetCenter.x - scale * (cos * sourceCenter.x - sin * sourceCenter.y),
    y: targetCenter.y - scale * (sin * sourceCenter.x + cos * sourceCenter.y),
  };
  const transform = {
    scale,
    rotationRad,
    rotationDeg: radToDeg(rotationRad),
    translation,
    rmse: 0,
  };

  const squaredErrors = points.map((point) => {
    const mapped = transformPoint(point.source, transform);
    const dx = mapped.x - point.target.x;
    const dy = mapped.y - point.target.y;
    return dx * dx + dy * dy;
  });
  transform.rmse = Math.sqrt(
    squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length,
  );

  return transform;
}

export function mapPolycamPoint(
  point: PolycamPoint,
  transform: SimilarityTransform2D,
  origin: Wgs84Point,
): { polycam: PolycamPoint; enu: EnuPoint; wgs84: Wgs84Point } {
  const mapped = transformPoint({ x: point.x, y: point.z }, transform);
  const enu = { east: mapped.x, north: mapped.y };
  return {
    polycam: point,
    enu,
    wgs84: enuToLatLon(enu, origin),
  };
}
