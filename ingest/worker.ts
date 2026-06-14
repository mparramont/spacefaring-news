import { D1NewsStore } from "./d1-store";
import { ingestFeeds } from "./ingest";
import { ingestXPosts } from "./x";

export type Env = {
  NEWS_DB: D1Database;
  X_BEARER_TOKEN?: string;
};

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledIngestion(env));
  },

  async fetch(request, env, ctx) {
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

    if (request.method === "GET" && url.pathname === "/items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const items = await store.recentItems(limit);
      return json(items);
    }

    return json({ ok: false, error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function runScheduledIngestion(env: Env) {
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

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 100)) : 50;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
