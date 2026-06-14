ALTER TABLE news_sources ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE news_sources ADD COLUMN region TEXT NOT NULL DEFAULT 'global';

CREATE INDEX IF NOT EXISTS idx_news_sources_language ON news_sources(language);
CREATE INDEX IF NOT EXISTS idx_news_sources_region ON news_sources(region);
