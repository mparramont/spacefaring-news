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

  async recentItemsForRanking(since, limit = 200) {
    const result = await this.db
      .prepare(
        `SELECT
          items.id,
          items.source_id,
          items.source_title,
          items.title,
          items.url,
          items.summary,
          items.author,
          items.published_at,
          items.fetched_at,
          items.guid,
          sources.category,
          sources.language,
          sources.region
        FROM news_items AS items
        LEFT JOIN news_sources AS sources
          ON sources.id = items.source_id
        WHERE COALESCE(items.published_at, items.fetched_at) >= ?
        ORDER BY COALESCE(items.published_at, items.fetched_at) DESC
        LIMIT ?`,
      )
      .bind(since, limit)
      .all();

    return result.results ?? [];
  }

  async saveRankingRun(run) {
    await this.db
      .prepare(
        `INSERT INTO ranking_runs
          (id, run_date, started_at, finished_at, item_count, cluster_count, method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(run.id, run.run_date, run.started_at, run.finished_at, run.item_count, run.cluster_count, run.method, run.notes)
      .run();

    const currentClusterIds = run.clusters.map((cluster) => cluster.id);
    if (currentClusterIds.length > 0) {
      const placeholders = currentClusterIds.map(() => "?").join(", ");
      await this.db
        .prepare(
          `DELETE FROM story_cluster_items
           WHERE cluster_id IN (
            SELECT id FROM story_clusters
            WHERE run_date = ?
            AND id NOT IN (${placeholders})
           )`,
        )
        .bind(run.run_date, ...currentClusterIds)
        .run();
      await this.db
        .prepare(`DELETE FROM story_clusters WHERE run_date = ? AND id NOT IN (${placeholders})`)
        .bind(run.run_date, ...currentClusterIds)
        .run();
    }

    for (const cluster of run.clusters) {
      const existing = await this.db
        .prepare("SELECT status, editor_note, selected_position, created_at FROM story_clusters WHERE id = ?")
        .bind(cluster.id)
        .first();

      await this.db
        .prepare(
          `INSERT INTO story_clusters
            (id, run_date, cluster_key, representative_title, representative_url, summary,
             source_count, region_count, language_count, importance_score, score_reasons_json,
             status, editor_note, selected_position, created_at, updated_at,
             deterministic_score, model_score, has_spacenews, source_titles, primary_region)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             representative_title = excluded.representative_title,
             representative_url = excluded.representative_url,
             summary = excluded.summary,
             source_count = excluded.source_count,
             region_count = excluded.region_count,
             language_count = excluded.language_count,
             importance_score = excluded.importance_score,
             score_reasons_json = excluded.score_reasons_json,
             deterministic_score = excluded.deterministic_score,
             model_score = excluded.model_score,
             has_spacenews = excluded.has_spacenews,
             source_titles = excluded.source_titles,
             primary_region = excluded.primary_region,
             updated_at = excluded.updated_at`,
        )
        .bind(
          cluster.id,
          cluster.run_date,
          cluster.cluster_key,
          cluster.representative_title,
          cluster.representative_url,
          cluster.summary,
          cluster.source_count,
          cluster.region_count,
          cluster.language_count,
          cluster.importance_score,
          JSON.stringify(cluster.score_reasons),
          existing?.status ?? "needs_review",
          existing?.editor_note ?? null,
          existing?.selected_position ?? null,
          existing?.created_at ?? run.started_at,
          run.finished_at,
          cluster.deterministic_score ?? cluster.importance_score,
          cluster.model_score ?? null,
          cluster.has_spacenews ? 1 : 0,
          cluster.source_titles ?? null,
          cluster.primary_region ?? null,
        )
        .run();

      await this.db.prepare("DELETE FROM story_cluster_items WHERE cluster_id = ?").bind(cluster.id).run();
      for (const itemId of cluster.item_ids) {
        await this.db
          .prepare("INSERT OR IGNORE INTO story_cluster_items (cluster_id, item_id) VALUES (?, ?)")
          .bind(cluster.id, itemId)
          .run();
      }
    }
  }

  async latestRankingRun() {
    return this.db
      .prepare(
        `SELECT id, run_date, started_at, finished_at, item_count, cluster_count, method, notes
         FROM ranking_runs
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .first();
  }

  async storyClusters(runDate, limit = 50) {
    const result = await this.db
      .prepare(
        `SELECT
          id,
          run_date,
          representative_title,
          representative_url,
          summary,
          source_count,
          region_count,
          language_count,
          importance_score,
          score_reasons_json,
          status,
          editor_note,
          selected_position,
          updated_at,
          deterministic_score,
          model_score,
          has_spacenews,
          source_titles,
          primary_region
        FROM story_clusters
        WHERE run_date = ?
        ORDER BY
          CASE status
            WHEN 'approved' THEN 0
            WHEN 'needs_review' THEN 1
            WHEN 'watch' THEN 2
            WHEN 'rejected' THEN 3
            ELSE 4
          END,
          COALESCE(selected_position, 9999) ASC,
          importance_score DESC
        LIMIT ?`,
      )
      .bind(runDate, limit)
      .all();

    return (result.results ?? []).map((cluster) => ({
      ...cluster,
      has_spacenews: Boolean(cluster.has_spacenews),
      score_reasons: parseJsonArray(cluster.score_reasons_json),
    }));
  }

  async issueDraftCopies(clusterIds) {
    if (clusterIds.length === 0) return new Map();

    const placeholders = clusterIds.map(() => "?").join(", ");
    const result = await this.db
      .prepare(
        `SELECT
          cluster_id,
          run_date,
          provider,
          model,
          headline,
          why_it_matters,
          source_context,
          generated_at,
          updated_at
        FROM issue_draft_copies
        WHERE cluster_id IN (${placeholders})`,
      )
      .bind(...clusterIds)
      .all();

    return new Map((result.results ?? []).map((copy) => [copy.cluster_id, copy]));
  }

  async saveIssueDraftCopy(copy) {
    await this.db
      .prepare(
        `INSERT INTO issue_draft_copies
          (cluster_id, run_date, provider, model, headline, why_it_matters, source_context, raw_json, generated_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cluster_id) DO UPDATE SET
          run_date = excluded.run_date,
          provider = excluded.provider,
          model = excluded.model,
          headline = excluded.headline,
          why_it_matters = excluded.why_it_matters,
          source_context = excluded.source_context,
          raw_json = excluded.raw_json,
          generated_at = excluded.generated_at,
          updated_at = excluded.updated_at`,
      )
      .bind(
        copy.cluster_id,
        copy.run_date,
        copy.provider,
        copy.model,
        copy.headline,
        copy.why_it_matters,
        copy.source_context,
        JSON.stringify(copy.raw ?? {}),
        copy.generated_at,
        copy.updated_at,
      )
      .run();
  }

  async modelTrainingClusters(limit = 500) {
    const result = await this.db
      .prepare(
        `SELECT
          id,
          representative_title,
          summary,
          source_count,
          region_count,
          language_count,
          importance_score,
          score_reasons_json,
          status,
          deterministic_score,
          model_score,
          CASE
            WHEN has_spacenews = 1 THEN 1
            WHEN EXISTS (
              SELECT 1
              FROM story_cluster_items AS links
              JOIN news_items AS items ON items.id = links.item_id
              WHERE links.cluster_id = story_clusters.id
              AND (
                lower(items.source_title) LIKE '%spacenews%'
                OR lower(items.url) LIKE '%spacenews.com%'
              )
            ) THEN 1
            ELSE 0
          END AS has_spacenews,
          COALESCE(
            source_titles,
            (
              SELECT group_concat(DISTINCT items.source_title)
              FROM story_cluster_items AS links
              JOIN news_items AS items ON items.id = links.item_id
              WHERE links.cluster_id = story_clusters.id
            )
          ) AS source_titles,
          COALESCE(
            primary_region,
            (
              SELECT sources.region
              FROM story_cluster_items AS links
              JOIN news_items AS items ON items.id = links.item_id
              LEFT JOIN news_sources AS sources ON sources.id = items.source_id
              WHERE links.cluster_id = story_clusters.id
              LIMIT 1
            )
          ) AS primary_region
        FROM story_clusters
        ORDER BY updated_at DESC
        LIMIT ?`,
      )
      .bind(limit)
      .all();

    return (result.results ?? []).map((cluster) => ({
      ...cluster,
      has_spacenews: Boolean(cluster.has_spacenews),
      score_reasons: parseJsonArray(cluster.score_reasons_json),
    }));
  }

  async latestModelWeights(modelName) {
    const result = await this.db
      .prepare("SELECT feature, weight FROM scoring_model_weights WHERE model_name = ?")
      .bind(modelName)
      .all();

    return Object.fromEntries((result.results ?? []).map((row) => [row.feature, row.weight]));
  }

  async latestModelRun(modelName) {
    return this.db
      .prepare(
        `SELECT id, trained_at, model_name, example_count, positive_count, seed_positive_count,
          editorial_example_count, loss, notes
         FROM scoring_model_runs
         WHERE model_name = ?
         ORDER BY trained_at DESC
         LIMIT 1`,
      )
      .bind(modelName)
      .first();
  }

  async saveModelRun(run) {
    await this.db
      .prepare(
        `INSERT INTO scoring_model_runs
          (id, trained_at, model_name, example_count, positive_count, seed_positive_count,
           editorial_example_count, loss, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        run.id,
        run.trained_at,
        run.model_name,
        run.example_count,
        run.positive_count,
        run.seed_positive_count,
        run.editorial_example_count,
        run.loss,
        run.notes,
      )
      .run();

    for (const [feature, weight] of Object.entries(run.weights)) {
      await this.db
        .prepare(
          `INSERT INTO scoring_model_weights (model_name, feature, weight, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(model_name, feature) DO UPDATE SET
            weight = excluded.weight,
            updated_at = excluded.updated_at`,
        )
        .bind(run.model_name, feature, weight, run.trained_at)
        .run();
    }
  }

  async updateStoryClusterDecision(id, decision, now) {
    await this.db
      .prepare(
        `UPDATE story_clusters
         SET status = ?, editor_note = ?, selected_position = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(decision.status, decision.editorNote, decision.selectedPosition, now, id)
      .run();
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

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
