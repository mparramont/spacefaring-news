CREATE TABLE IF NOT EXISTS ranking_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  cluster_count INTEGER NOT NULL,
  method TEXT NOT NULL,
  notes TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ranking_runs_run_date ON ranking_runs(run_date DESC);

CREATE TABLE IF NOT EXISTS story_clusters (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  cluster_key TEXT NOT NULL,
  representative_title TEXT NOT NULL,
  representative_url TEXT NOT NULL,
  summary TEXT,
  source_count INTEGER NOT NULL,
  region_count INTEGER NOT NULL,
  language_count INTEGER NOT NULL,
  importance_score REAL NOT NULL,
  score_reasons_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_review',
  editor_note TEXT,
  selected_position INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_story_clusters_run_key ON story_clusters(run_date, cluster_key);
CREATE INDEX IF NOT EXISTS idx_story_clusters_run_score ON story_clusters(run_date, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_story_clusters_status ON story_clusters(status);

CREATE TABLE IF NOT EXISTS story_cluster_items (
  cluster_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (cluster_id, item_id),
  FOREIGN KEY (cluster_id) REFERENCES story_clusters(id),
  FOREIGN KEY (item_id) REFERENCES news_items(id)
);
