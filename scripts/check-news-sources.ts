import { NEWS_SOURCES } from "../ingest/sources";

const timeoutMs = 12_000;
let failed = 0;

for (const source of NEWS_SOURCES) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        "user-agent": "SpacefaringNewsBot/0.1 (+https://spacefaring-news.pages.dev)",
      },
    });
    const text = await response.text();
    const looksLikeFeed = /<(rss|feed|rdf:RDF|channel|item|entry)\b/i.test(text.slice(0, 8_000));

    if (response.ok && looksLikeFeed) {
      console.log(`OK ${source.id} ${response.status}`);
    } else {
      failed += 1;
      console.error(`FAIL ${source.id} ${response.status}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${source.id} ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}

