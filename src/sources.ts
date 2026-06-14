import "./styles.css";

type SourceRow = {
  id: string;
  title: string;
  url: string;
  homepage: string;
  category: string;
  language: string;
  region: string;
  enabled: number;
  updated_at: string;
  latest_item_id: string | null;
  latest_item_title: string | null;
  latest_item_url: string | null;
  latest_item_published_at: string | null;
  latest_item_fetched_at: string | null;
};

const SOURCE_ENDPOINT =
  import.meta.env.VITE_SOURCE_ENDPOINT ?? "https://spacefaring-news-ingest.mparramont.workers.dev/sources";

const list = document.querySelector<HTMLDivElement>("#source-list");
const summary = document.querySelector<HTMLElement>("#source-summary");
const search = document.querySelector<HTMLInputElement>("#source-search");

let sources: SourceRow[] = [];

void loadSources();

search?.addEventListener("input", () => renderSources());

async function loadSources() {
  try {
    const response = await fetch(SOURCE_ENDPOINT, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    sources = (await response.json()) as SourceRow[];
    renderSources();
  } catch (error) {
    if (summary) {
      summary.textContent = `Unable to load sources: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

function renderSources() {
  if (!list || !summary) {
    return;
  }

  const query = search?.value.trim().toLowerCase() ?? "";
  const filtered = query
    ? sources.filter((source) =>
        [
          source.title,
          source.id,
          source.region,
          source.language,
          source.category,
          source.latest_item_title ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : sources;

  summary.textContent = `${filtered.length} of ${sources.length} active sources`;
  list.replaceChildren(...filtered.map(sourceCard));
}

function sourceCard(source: SourceRow) {
  const article = document.createElement("article");
  article.className = "source-card";

  const header = document.createElement("div");
  header.className = "source-card-header";

  const title = document.createElement("h2");
  const sourceLink = document.createElement("a");
  sourceLink.href = source.homepage;
  sourceLink.textContent = source.title;
  sourceLink.rel = "noopener noreferrer";
  title.appendChild(sourceLink);

  const meta = document.createElement("p");
  meta.className = "source-meta";
  meta.textContent = [source.region, source.language, source.category].join(" / ");

  header.appendChild(title);
  header.appendChild(meta);

  const latest = document.createElement("p");
  latest.className = "source-latest";

  if (source.latest_item_title && source.latest_item_url) {
    const latestLink = document.createElement("a");
    latestLink.href = source.latest_item_url;
    latestLink.textContent = source.latest_item_title;
    latestLink.rel = "noopener noreferrer";
    latest.appendChild(document.createTextNode("Latest: "));
    latest.appendChild(latestLink);

    const date = formatDate(source.latest_item_published_at ?? source.latest_item_fetched_at);
    if (date) {
      latest.appendChild(document.createTextNode(` (${date})`));
    }
  } else {
    latest.textContent = "Latest: none stored yet";
  }

  const detail = document.createElement("p");
  detail.className = "source-detail";
  detail.textContent = source.url;

  article.appendChild(header);
  article.appendChild(latest);
  article.appendChild(detail);
  return article;
}

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}
