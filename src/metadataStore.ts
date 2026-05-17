import type { PublicSearchMetadata, SearchMetadataStore } from "./backends";

type D1Statement = {
  bind(...values: string[]): {
    all(): Promise<{ results?: D1KeyframeRow[] }>;
  };
};

export type D1Database = {
  prepare(sql: string): D1Statement;
};

type D1KeyframeRow = {
  id?: unknown;
  label?: unknown;
  floor?: unknown;
  zone?: unknown;
  imagePath?: unknown;
  x?: unknown;
  y?: unknown;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function rowToMetadata(row: D1KeyframeRow): PublicSearchMetadata {
  return {
    label: stringValue(row.label),
    floor: stringValue(row.floor),
    zone: stringValue(row.zone),
    imagePath: stringValue(row.imagePath),
    x: numberValue(row.x),
    y: numberValue(row.y),
  };
}

export function createD1SearchMetadataStore(db: D1Database): SearchMetadataStore {
  return {
    async getByIds(ids) {
      if (ids.length === 0) {
        return new Map();
      }

      const placeholders = ids.map(() => "?").join(", ");
      const statement = db.prepare(
        `SELECT id, label, floor, zone, image_r2_key AS imagePath, x, y FROM keyframes WHERE id IN (${placeholders})`,
      );
      const response = await statement.bind(...ids).all();
      const rows = response.results ?? [];
      const metadata = new Map<string, PublicSearchMetadata>();

      for (const row of rows) {
        const id = stringValue(row.id);
        if (id) {
          metadata.set(id, rowToMetadata(row));
        }
      }

      return metadata;
    },
  };
}
