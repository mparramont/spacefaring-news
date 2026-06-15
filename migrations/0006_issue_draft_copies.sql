CREATE TABLE IF NOT EXISTS issue_draft_copies (
  cluster_id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  headline TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  source_context TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (cluster_id) REFERENCES story_clusters(id)
);

CREATE INDEX IF NOT EXISTS idx_issue_draft_copies_run_date ON issue_draft_copies(run_date DESC);
