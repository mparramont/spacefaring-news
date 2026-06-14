import type { D1Database } from "@cloudflare/workers-types";
import type { FeedSource, IngestionRun, NewsItem, NewsStore } from "./types";

export class D1NewsStore implements NewsStore {
  constructor(private readonly db: D1Database) {}

  async saveSources(sources: FeedSource[], now: string) {
    const activeIds = new Set(sources.map((source) => source.id));

    for (const source of sources) {
      await this.db
        .prepare(
          `INSERT INTO news_sources
            (id, title, url, homepage, category, language, region, cadence_minutes, enabled, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            url = excluded.url,
            homepage = excluded.homepage,
            category = excluded.category,
            language = excluded.language,
            region = excluded.region,
            cadence_minutes = excluded.cadence_minutes,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at`,
        )
        .bind(
          source.id,
          source.title,
          source.url,
          source.homepage,
          source.category,
          source.language,
          source.region,
          source.cadenceMinutes,
          now,
        )
        .run();
    }

    const existing = await this.db.prepare("SELECT id FROM news_sources").all<{ id: string }>();

    for (const source of existing.results ?? []) {
      if (!activeIds.has(source.id)) {
        await this.db
          .prepare("UPDATE news_sources SET enabled = 0, updated_at = ? WHERE id = ?")
          .bind(now, source.id)
          .run();
      }
    }
  }

  async saveItems(items: NewsItem[]) {
    let stored = 0;

    for (const item of items) {
      const result = await this.db
        .prepare(
          `INSERT OR IGNORE INTO news_items
            (id, source_id, source_title, title, url, summary, author, published_at, fetched_at, guid, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.id,
          item.sourceId,
          item.sourceTitle,
          item.title,
          item.url,
          item.summary,
          item.author,
          item.publishedAt,
          item.fetchedAt,
          item.guid,
          compactRawJson(item.raw),
        )
        .run();

      stored += result.meta.changes ?? 0;
    }

    return stored;
  }

  async recordRun(run: IngestionRun) {
    await this.db
      .prepare(
        `INSERT INTO ingestion_runs
          (id, started_at, finished_at, source_count, fetched_count, stored_count, failed_count, errors_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        run.id,
        run.startedAt,
        run.finishedAt,
        run.sourceCount,
        run.fetchedCount,
        run.storedCount,
        run.failedCount,
        JSON.stringify(run.errors),
      )
      .run();
  }

  async recentItems(limit = 50) {
    return this.db
      .prepare(
        `SELECT id, source_id, source_title, title, url, summary, author, published_at, fetched_at, guid
         FROM news_items
         ORDER BY COALESCE(published_at, fetched_at) DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all();
  }

  async stats() {
    const result = await this.db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM news_sources WHERE enabled = 1) AS active_source_count,
          (SELECT COUNT(*) FROM news_items) AS item_count,
          (SELECT COUNT(*) FROM ingestion_runs) AS run_count,
          (SELECT MAX(fetched_at) FROM news_items) AS latest_fetched_at`,
      )
      .first<{
        active_source_count: number;
        item_count: number;
        run_count: number;
        latest_fetched_at: string | null;
      }>();

    return result;
  }
}

function compactRawJson(raw: Record<string, unknown>) {
  return JSON.stringify({
    categories: raw.category ?? raw.categories ?? null,
    enclosure: raw.enclosure ?? null,
  });
}
