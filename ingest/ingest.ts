import { parseFeed } from "./feed";
import { NEWS_SOURCES } from "./sources";
import type { FeedSource, IngestionRun, NewsItem, NewsStore } from "./types";

type Fetcher = typeof fetch;

export type IngestOptions = {
  fetcher?: Fetcher;
  now?: Date;
  sources?: FeedSource[];
  maxConcurrency?: number;
  perSourceTimeoutMs?: number;
};

export async function ingestFeeds(store: NewsStore, options: IngestOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const sources = options.sources ?? NEWS_SOURCES;
  const startedAt = (options.now ?? new Date()).toISOString();
  const errors: IngestionRun["errors"] = [];
  const allItems: NewsItem[] = [];

  await store.saveSources(sources, startedAt);

  await eachSource(sources, options.maxConcurrency ?? 8, async (source) => {
    try {
      const xml = await fetchSource(fetcher, source, options.perSourceTimeoutMs ?? 15_000);
      allItems.push(...parseFeed(xml, source, startedAt));
    } catch (error) {
      errors.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const storedCount = await store.saveItems(allItems);
  const finishedAt = new Date().toISOString();
  const run: IngestionRun = {
    id: randomId(),
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

async function eachSource(
  sources: FeedSource[],
  maxConcurrency: number,
  work: (source: FeedSource) => Promise<void>,
) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(maxConcurrency, 1), sources.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < sources.length) {
        const source = sources[nextIndex];
        nextIndex += 1;
        await work(source);
      }
    }),
  );
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchSource(fetcher: Fetcher, source: FeedSource, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetcher(source.url, {
        signal: controller.signal,
        headers: {
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
          "user-agent": "SpacefaringNewsBot/0.1 (+https://spacefaring-news.pages.dev)",
        },
      }),
      timedOut,
    ]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await Promise.race([response.text(), timedOut]);
  } finally {
    clearTimeout(timeout!);
  }
}
