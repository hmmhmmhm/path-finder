CREATE TABLE IF NOT EXISTS keyframes (
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS embedding_models (
  id TEXT PRIMARY KEY,
  dimensions INTEGER NOT NULL,
  vectorize_index TEXT NOT NULL,
  model_r2_key TEXT,
  input_size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keyframe_embeddings (
  keyframe_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  vector_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (keyframe_id, model_id),
  FOREIGN KEY (keyframe_id) REFERENCES keyframes(id),
  FOREIGN KEY (model_id) REFERENCES embedding_models(id)
);

CREATE TABLE IF NOT EXISTS query_evaluations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  query_image_r2_key TEXT,
  expected_keyframe_id TEXT,
  top1_keyframe_id TEXT,
  top1_score REAL,
  margin REAL,
  confidence TEXT,
  topk_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyframes_site_floor_zone
  ON keyframes(site, floor, zone);

CREATE INDEX IF NOT EXISTS idx_keyframe_embeddings_vector_id
  ON keyframe_embeddings(vector_id);

CREATE INDEX IF NOT EXISTS idx_query_evaluations_model_created
  ON query_evaluations(model_id, created_at);
