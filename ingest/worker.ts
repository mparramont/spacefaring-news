import { D1NewsStore } from "./d1-store";
import { ingestFeeds } from "./ingest";

export type Env = {
  NEWS_DB: D1Database;
};

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(ingestFeeds(new D1NewsStore(env.NEWS_DB)));
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

    if (request.method === "GET" && url.pathname === "/items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const items = await store.recentItems(limit);
      return json(items);
    }

    return json({ ok: false, error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

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
    },
  });
}
