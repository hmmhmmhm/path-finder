export type GalleryEmbedding = {
  id: string;
  label: string;
  vector: number[];
  imagePath?: string;
  floor?: string;
  zone?: string;
  x?: number;
  y?: number;
};

export type SearchResult = GalleryEmbedding & {
  score: number;
  rank: number;
};

function dot(a: number[], b: number[]): number {
  let value = 0;
  for (let index = 0; index < a.length; index += 1) {
    value += a[index] * b[index];
  }
  return value;
}

function norm(vector: number[]): number {
  return Math.sqrt(dot(vector, vector));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`벡터 차원이 일치하지 않습니다: query=${a.length}, candidate=${b.length}`);
  }

  const denominator = norm(a) * norm(b);
  if (denominator === 0) {
    return 0;
  }
  return dot(a, b) / denominator;
}

export function searchEmbeddings(
  query: number[],
  gallery: GalleryEmbedding[],
  topK: number,
): SearchResult[] {
  return gallery
    .map((candidate) => ({
      ...candidate,
      score: cosineSimilarity(query, candidate.vector),
      rank: 0,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
}
