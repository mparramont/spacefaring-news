export class D1NewsStore {
  constructor(db) {
    this.db = db;
  }

  async saveSources(sources, now) {
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

    const hasOnlyXSources = sources.every((source) => source.id.startsWith("x-"));
    const hasNoXSources = sources.every((source) => !source.id.startsWith("x-"));
    const existingQuery = hasOnlyXSources
      ? "SELECT id FROM news_sources WHERE id LIKE 'x-%'"
      : hasNoXSources
        ? "SELECT id FROM news_sources WHERE id NOT LIKE 'x-%'"
        : "SELECT id FROM news_sources";
    const existing = await this.db.prepare(existingQuery).all();

    for (const source of existing.results ?? []) {
      if (!activeIds.has(source.id)) {
        await this.db
          .prepare("UPDATE news_sources SET enabled = 0, updated_at = ? WHERE id = ?")
          .bind(now, source.id)
          .run();
      }
    }
  }

  async saveItems(items) {
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

  async recordRun(run) {
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

  async sourcesWithLatest() {
    const result = await this.db
      .prepare(
        `WITH latest AS (
          SELECT
            source_id,
            id,
            title,
            url,
            published_at,
            fetched_at,
            ROW_NUMBER() OVER (
              PARTITION BY source_id
              ORDER BY COALESCE(published_at, fetched_at) DESC
            ) AS position
          FROM news_items
        )
        SELECT
          sources.id,
          sources.title,
          sources.url,
          sources.homepage,
          sources.category,
          sources.language,
          sources.region,
          sources.enabled,
          sources.updated_at,
          latest.id AS latest_item_id,
          latest.title AS latest_item_title,
          latest.url AS latest_item_url,
          latest.published_at AS latest_item_published_at,
          latest.fetched_at AS latest_item_fetched_at
        FROM news_sources AS sources
        LEFT JOIN latest
          ON latest.source_id = sources.id
          AND latest.position = 1
        WHERE sources.enabled = 1
        ORDER BY
          sources.region ASC,
          sources.language ASC,
          sources.title ASC`,
      )
      .all();

    return result.results ?? [];
  }

  async stats() {
    return this.db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM news_sources WHERE enabled = 1) AS active_source_count,
          (SELECT COUNT(*) FROM news_items) AS item_count,
          (SELECT COUNT(*) FROM ingestion_runs) AS run_count,
          (SELECT last_finished_at FROM poll_state WHERE id = 'x-daily') AS latest_x_poll_at,
          (SELECT MAX(fetched_at) FROM news_items) AS latest_fetched_at`,
      )
      .first();
  }

  async startDailyPoll(id, now) {
    const currentDate = now.slice(0, 10);
    const existing = await this.db
      .prepare("SELECT last_started_at FROM poll_state WHERE id = ?")
      .bind(id)
      .first();

    if (existing?.last_started_at?.startsWith(currentDate)) {
      return false;
    }

    await this.db
      .prepare(
        `INSERT INTO poll_state (id, last_started_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          last_started_at = excluded.last_started_at,
          updated_at = excluded.updated_at`,
      )
      .bind(id, now, now)
      .run();

    return true;
  }

  async finishDailyPoll(id, now) {
    await this.db
      .prepare("UPDATE poll_state SET last_finished_at = ?, updated_at = ? WHERE id = ?")
      .bind(now, now, id)
      .run();
  }
}

function compactRawJson(raw) {
  return JSON.stringify({
    categories: raw.category ?? raw.categories ?? null,
    enclosure: raw.enclosure ?? null,
    platform: raw.platform ?? null,
    username: raw.username ?? null,
    lang: raw.lang ?? null,
    public_metrics: raw.public_metrics ?? null,
  });
}
