CREATE TABLE IF NOT EXISTS scoring_model_runs (
  id TEXT PRIMARY KEY,
  trained_at TEXT NOT NULL,
  model_name TEXT NOT NULL,
  example_count INTEGER NOT NULL,
  positive_count INTEGER NOT NULL,
  seed_positive_count INTEGER NOT NULL,
  editorial_example_count INTEGER NOT NULL,
  loss REAL NOT NULL,
  notes TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scoring_model_runs_trained_at ON scoring_model_runs(trained_at DESC);

CREATE TABLE IF NOT EXISTS scoring_model_weights (
  model_name TEXT NOT NULL,
  feature TEXT NOT NULL,
  weight REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (model_name, feature)
);

ALTER TABLE story_clusters ADD COLUMN deterministic_score REAL;
ALTER TABLE story_clusters ADD COLUMN model_score REAL;
ALTER TABLE story_clusters ADD COLUMN has_spacenews INTEGER NOT NULL DEFAULT 0;
ALTER TABLE story_clusters ADD COLUMN source_titles TEXT;
ALTER TABLE story_clusters ADD COLUMN primary_region TEXT;
