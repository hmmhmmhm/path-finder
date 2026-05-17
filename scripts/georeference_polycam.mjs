#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EARTH_RADIUS_METERS = 6378137;

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function enuToLatLon(point, origin) {
  const originLatRad = degToRad(origin.lat);
  return {
    lat: origin.lat + radToDeg(point.north / EARTH_RADIUS_METERS),
    lon: origin.lon + radToDeg(point.east / (EARTH_RADIUS_METERS * Math.cos(originLatRad))),
  };
}

function latLonToEnu(point, origin) {
  const originLatRad = degToRad(origin.lat);
  return {
    east: degToRad(point.lon - origin.lon) * EARTH_RADIUS_METERS * Math.cos(originLatRad),
    north: degToRad(point.lat - origin.lat) * EARTH_RADIUS_METERS,
  };
}

function centroid(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function transformPoint(point, transform) {
  const cos = Math.cos(transform.rotationRad);
  const sin = Math.sin(transform.rotationRad);
  return {
    x: transform.scale * (cos * point.x - sin * point.y) + transform.translation.x,
    y: transform.scale * (sin * point.x + cos * point.y) + transform.translation.y,
  };
}

function fitSimilarity2D(points) {
  if (points.length < 2) {
    throw new Error("좌표 정렬에는 최소 2개 이상의 기준점이 필요합니다.");
  }
  const sourceCenter = centroid(points.map((point) => point.source));
  const targetCenter = centroid(points.map((point) => point.target));
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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("사용법: node scripts/georeference_polycam.mjs --gcp gcp.json --points points.json --output report.json");
    }
    args[key.slice(2)] = value;
  }
  for (const key of ["gcp", "points", "output"]) {
    if (!args[key]) {
      throw new Error(`필수 인자가 없습니다: --${key}`);
    }
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function targetFromGcp(point, origin) {
  if (point.enu) {
    return { x: point.enu.east, y: point.enu.north };
  }
  if (point.wgs84) {
    const enu = latLonToEnu(point.wgs84, origin);
    return { x: enu.east, y: enu.north };
  }
  throw new Error(`GCP ${point.id ?? "(unknown)"}에 enu 또는 wgs84 target이 없습니다.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gcp = readJson(args.gcp);
  const points = readJson(args.points);
  const origin = gcp.origin;
  if (!origin?.lat || !origin?.lon) {
    throw new Error("GCP JSON에는 origin.lat/lon이 필요합니다.");
  }

  const controlPoints = gcp.points.map((point) => ({
    id: point.id,
    source: { x: point.polycam.x, y: point.polycam.z },
    target: targetFromGcp(point, origin),
  }));
  const transform = fitSimilarity2D(controlPoints);

  const mappedPoints = points.points.map((point) => {
    const enu2d = transformPoint({ x: point.polycam.x, y: point.polycam.z }, transform);
    const enu = { east: enu2d.x, north: enu2d.y };
    return {
      id: point.id,
      polycam: point.polycam,
      enu,
      wgs84: enuToLatLon(enu, origin),
    };
  });

  const report = {
    scanId: gcp.scanId,
    origin,
    transform,
    controlPoints,
    mappedPoints,
  };
  writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
