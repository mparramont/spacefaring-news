CREATE TABLE IF NOT EXISTS poll_state (
  id TEXT PRIMARY KEY,
  last_started_at TEXT,
  last_finished_at TEXT,
  updated_at TEXT NOT NULL
);
