import { X_SOURCES } from "./x-sources";
import type { IngestionRun, NewsItem, NewsStore, XSource } from "./types";

type Fetcher = typeof fetch;

type XUser = {
  id: string;
  username: string;
  name: string;
};

type XPost = {
  id: string;
  text: string;
  created_at?: string;
  lang?: string;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    bookmark_count?: number;
    impression_count?: number;
  };
};

export type IngestXOptions = {
  bearerToken: string;
  fetcher?: Fetcher;
  now?: Date;
  sources?: XSource[];
  maxPostsPerSource?: number;
  lookbackHours?: number;
};

export async function ingestXPosts(store: NewsStore, options: IngestXOptions) {
  const fetcher = options.fetcher ?? fetch;
  const sources = options.sources ?? X_SOURCES;
  const startedAt = (options.now ?? new Date()).toISOString();
  const errors: IngestionRun["errors"] = [];
  const allItems: NewsItem[] = [];

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
  const run: IngestionRun = {
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

async function lookupUsers(fetcher: Fetcher, bearerToken: string, sources: XSource[]) {
  const usernames = [...new Set(sources.map((source) => source.username))];
  const url = new URL("https://api.x.com/2/users/by");
  url.searchParams.set("usernames", usernames.join(","));
  url.searchParams.set("user.fields", "id,name,username");

  const json = await xFetch<{ data?: XUser[] }>(fetcher, bearerToken, url);
  return new Map((json.data ?? []).map((user) => [user.username.toLowerCase(), user]));
}

async function fetchUserPosts(
  fetcher: Fetcher,
  bearerToken: string,
  userId: string,
  options: { maxResults: number; startTime: string },
) {
  const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
  url.searchParams.set("exclude", "retweets,replies");
  url.searchParams.set("max_results", String(Math.max(5, Math.min(options.maxResults, 100))));
  url.searchParams.set("start_time", options.startTime);
  url.searchParams.set("tweet.fields", "created_at,lang,public_metrics");

  const json = await xFetch<{ data?: XPost[] }>(fetcher, bearerToken, url);
  return json.data ?? [];
}

async function xFetch<T>(fetcher: Fetcher, bearerToken: string, url: URL) {
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

  return (await response.json()) as T;
}

function postToNewsItem(post: XPost, source: XSource, fetchedAt: string): NewsItem {
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

function firstLine(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function randomId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
