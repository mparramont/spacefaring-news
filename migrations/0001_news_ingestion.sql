CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  homepage TEXT NOT NULL,
  category TEXT NOT NULL,
  cadence_minutes INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_title TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  guid TEXT,
  raw_json TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES news_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_source_id ON news_items(source_id);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  fetched_count INTEGER NOT NULL,
  stored_count INTEGER NOT NULL,
  failed_count INTEGER NOT NULL,
  errors_json TEXT NOT NULL
);

