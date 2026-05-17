export type ManifestModel = {
  id: string;
  dimensions: number;
};

export type ManifestItem = {
  id: string;
  label: string;
  imagePath: string;
  vector: number[];
  floor?: string;
  zone?: string;
  x?: number;
  y?: number;
};

export type EmbeddingManifest = {
  model: ManifestModel;
  items: ManifestItem[];
};

export type VectorizeRecord = {
  id: string;
  values: number[];
  metadata: {
    label: string;
    imagePath: string;
    floor?: string;
    zone?: string;
    x?: number;
    y?: number;
  };
};

export function validateManifest(manifest: EmbeddingManifest): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const item of manifest.items) {
    if (seen.has(item.id)) {
      errors.push(`${item.id}: duplicate id`);
    }
    seen.add(item.id);

    if (item.vector.length !== manifest.model.dimensions) {
      errors.push(
        `${item.id}: vector dimension ${item.vector.length} does not match model dimension ${manifest.model.dimensions}`,
      );
    }
  }

  return errors;
}

export function toVectorizeRecord(item: ManifestItem): VectorizeRecord {
  return {
    id: item.id,
    values: item.vector,
    metadata: {
      label: item.label,
      floor: item.floor,
      zone: item.zone,
      x: item.x,
      y: item.y,
      imagePath: item.imagePath,
    },
  };
}
