import { D1NewsStore } from "./d1-store.js";
import { ingestFeeds } from "./ingest.js";
import { ingestXPosts } from "./x.js";

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledIngestion(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const store = new D1NewsStore(env.NEWS_DB);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      return json(await store.stats());
    }

    if (request.method === "GET" && url.pathname === "/sources") {
      return json(await store.sourcesWithLatest());
    }

    if (request.method === "GET" && url.pathname === "/sources-fragment") {
      const sources = await store.sourcesWithLatest();
      return html(renderSourcesFragment(sources, url.searchParams.get("q") ?? ""));
    }

    if (request.method === "GET" && url.pathname === "/items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const items = await store.recentItems(limit);
      return json(items);
    }

    return json({ ok: false, error: "not found" }, 404);
  },
};

async function runScheduledIngestion(env) {
  const store = new D1NewsStore(env.NEWS_DB);
  const now = new Date();
  await ingestFeeds(store, { now });

  if (!env.X_BEARER_TOKEN) {
    return;
  }

  const startedAt = now.toISOString();
  const shouldPollX = await store.startDailyPoll("x-daily", startedAt);

  if (!shouldPollX) {
    return;
  }

  try {
    await ingestXPosts(store, {
      bearerToken: env.X_BEARER_TOKEN,
      now,
    });
  } catch (error) {
    console.error("X ingestion failed", error);
  } finally {
    await store.finishDailyPoll("x-daily", new Date().toISOString());
  }
}

function parseLimit(value) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 100)) : 50;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html;charset=UTF-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function renderSourcesFragment(sources, query) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? sources.filter((source) =>
        [
          source.id,
          source.title,
          source.region,
          source.language,
          source.category,
          source.latest_item_title ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : sources;

  return [
    `<section id="source-summary" class="source-summary" aria-live="polite">${filtered.length} of ${sources.length} active sources</section>`,
    `<section id="source-list" class="source-list" aria-live="polite">`,
    ...filtered.map(renderSourceCard),
    `</section>`,
  ].join("");
}

function renderSourceCard(source) {
  const latestDate = (source.latest_item_published_at ?? source.latest_item_fetched_at ?? "").slice(0, 10);
  const latest =
    source.latest_item_title && source.latest_item_url
      ? `Latest: <a href="${escapeAttr(source.latest_item_url)}" rel="noopener noreferrer">${escapeHtml(source.latest_item_title)}</a>${latestDate ? ` (${escapeHtml(latestDate)})` : ""}`
      : "Latest: none stored yet";

  return `<article class="source-card"><div class="source-card-header"><h2><a href="${escapeAttr(source.homepage)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a></h2><p class="source-meta">${escapeHtml(source.region)} / ${escapeHtml(source.language)} / ${escapeHtml(source.category)}</p></div><p class="source-latest">${latest}</p><p class="source-detail">${escapeHtml(source.url)}</p></article>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function escapeAttr(value) {
  return escapeHtml(value);
}
