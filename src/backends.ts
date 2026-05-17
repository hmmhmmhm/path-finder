import { type GalleryEmbedding, type SearchResult, searchEmbeddings } from "./search";

export type PublicSearchResult = Omit<SearchResult, "vector">;

export type PublicSearchMetadata = Partial<Omit<PublicSearchResult, "id" | "score" | "rank">>;

export type SearchMetadataStore = {
  getByIds(ids: string[]): Promise<Map<string, PublicSearchMetadata>>;
};

export type SearchBackend = {
  readonly name: string;
  search(embedding: number[], topK: number): Promise<PublicSearchResult[]>;
};

type VectorizeMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type VectorizeIndex = {
  query(
    vector: number[],
    options: {
      topK: number;
      returnMetadata: "all" | "indexed" | "none";
    },
  ): Promise<{ matches: VectorizeMatch[] }>;
};

function toPublicResults(results: SearchResult[]): PublicSearchResult[] {
  return results.map(({ vector: _vector, ...result }) => result);
}

function stringMetadata(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function numberMetadata(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createLocalSearchBackend(gallery: GalleryEmbedding[]): SearchBackend {
  return {
    name: "local",
    async search(embedding, topK) {
      return toPublicResults(searchEmbeddings(embedding, gallery, topK));
    },
  };
}

export function createVectorizeSearchBackend(
  index: VectorizeIndex,
  metadataStore?: SearchMetadataStore,
): SearchBackend {
  return {
    name: "vectorize",
    async search(embedding, topK) {
      const response = await index.query(embedding, {
        topK,
        returnMetadata: "all",
      });
      const metadataById = metadataStore
        ? await metadataStore.getByIds(response.matches.map((match) => match.id))
        : new Map<string, PublicSearchMetadata>();

      return response.matches.map((match, index) => {
        const vectorizeMetadata = match.metadata ?? {};
        const d1Metadata = metadataById.get(match.id) ?? {};
        const metadata = { ...vectorizeMetadata, ...d1Metadata };
        return {
          id: match.id,
          label: stringMetadata(metadata, "label") ?? match.id,
          floor: stringMetadata(metadata, "floor"),
          zone: stringMetadata(metadata, "zone"),
          imagePath: stringMetadata(metadata, "imagePath"),
          x: numberMetadata(metadata, "x"),
          y: numberMetadata(metadata, "y"),
          score: match.score,
          rank: index + 1,
        };
      });
    },
  };
}
