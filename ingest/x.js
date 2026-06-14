import { X_SOURCES } from "./x-sources.js";

export async function ingestXPosts(store, options) {
  const fetcher = options.fetcher ?? fetch;
  const sources = options.sources ?? X_SOURCES;
  const startedAt = (options.now ?? new Date()).toISOString();
  const errors = [];
  const allItems = [];

  await store.saveSources(sources, startedAt);

  const usersByUsername = await lookupUsers(fetcher, options.bearerToken, sources);
  const startTime = new Date(
    new Date(startedAt).getTime() - (options.lookbackHours ?? 36) * 60 * 60 * 1000,
  ).toISOString();

  for (const source of sources) {
    try {
      const user = usersByUsername.get(source.username.toLowerCase());

      if (!user) {
        throw new Error(`X user not found: ${source.username}`);
      }

      const posts = await fetchUserPosts(fetcher, options.bearerToken, user.id, {
        maxResults: options.maxPostsPerSource ?? 10,
        startTime,
      });

      allItems.push(...posts.map((post) => postToNewsItem(post, source, startedAt)));
    } catch (error) {
      errors.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const storedCount = await store.saveItems(allItems);
  const finishedAt = new Date().toISOString();
  const run = {
    id: randomId("x-run"),
    startedAt,
    finishedAt,
    sourceCount: sources.length,
    fetchedCount: allItems.length,
    storedCount,
    failedCount: errors.length,
    errors,
  };

  await store.recordRun(run);

  return run;
}

async function lookupUsers(fetcher, bearerToken, sources) {
  const usernames = [...new Set(sources.map((source) => source.username))];
  const url = new URL("https://api.x.com/2/users/by");
  url.searchParams.set("usernames", usernames.join(","));
  url.searchParams.set("user.fields", "id,name,username");

  const json = await xFetch(fetcher, bearerToken, url);
  return new Map((json.data ?? []).map((user) => [user.username.toLowerCase(), user]));
}

async function fetchUserPosts(fetcher, bearerToken, userId, options) {
  const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
  url.searchParams.set("exclude", "retweets,replies");
  url.searchParams.set("max_results", String(Math.max(5, Math.min(options.maxResults, 100))));
  url.searchParams.set("start_time", options.startTime);
  url.searchParams.set("tweet.fields", "created_at,lang,public_metrics");

  const json = await xFetch(fetcher, bearerToken, url);
  return json.data ?? [];
}

async function xFetch(fetcher, bearerToken, url) {
  const response = await fetcher(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${bearerToken}`,
      "user-agent": "SpacefaringNewsBot/0.1 (+https://spacefaring-news.pages.dev)",
    },
  });

  if (!response.ok) {
    throw new Error(`X API ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function postToNewsItem(post, source, fetchedAt) {
  return {
    id: `x:${post.id}`,
    sourceId: source.id,
    sourceTitle: source.title,
    title: firstLine(post.text),
    url: `https://x.com/${source.username}/status/${post.id}`,
    summary: post.text,
    author: source.title,
    publishedAt: post.created_at ? new Date(post.created_at).toISOString() : null,
    fetchedAt,
    guid: post.id,
    raw: {
      platform: "x",
      username: source.username,
      lang: post.lang ?? null,
      public_metrics: post.public_metrics ?? null,
    },
  };
}

function firstLine(text) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function randomId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
