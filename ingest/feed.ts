import { XMLParser } from "fast-xml-parser";
import type { FeedSource, NewsItem } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true,
});

export function parseFeed(xml: string, source: FeedSource, fetchedAt: string): NewsItem[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rawItems = getRssItems(parsed).concat(getAtomEntries(parsed));

  return rawItems
    .map((raw) => normalizeItem(raw, source, fetchedAt))
    .filter((item): item is NewsItem => item !== null);
}

function getRssItems(parsed: Record<string, unknown>) {
  const rss = objectAt(parsed, "rss");
  const channel = objectAt(rss, "channel") ?? objectAt(parsed, "channel");
  return asArray(unknownAt(channel, "item")).filter(isRecord);
}

function getAtomEntries(parsed: Record<string, unknown>) {
  const feed = objectAt(parsed, "feed");
  return asArray(unknownAt(feed, "entry")).filter(isRecord);
}

function normalizeItem(
  raw: Record<string, unknown>,
  source: FeedSource,
  fetchedAt: string,
): NewsItem | null {
  const title = cleanText(firstString(raw.title));
  const url = normalizeUrl(firstString(raw.link) ?? linkFromAtom(raw.link));
  const guid = cleanText(firstString(raw.guid) ?? firstString(raw.id));

  if (!title || !url) {
    return null;
  }

  const publishedAt = normalizeDate(
    firstString(raw.pubDate) ??
      firstString(raw.published) ??
      firstString(raw.updated) ??
      firstString(raw["dc:date"]),
  );

  return {
    id: stableItemId(source.id, guid ?? url, title),
    sourceId: source.id,
    sourceTitle: source.title,
    title,
    url,
    summary: truncate(
      cleanText(
        firstString(raw.description) ??
          firstString(raw.summary) ??
          firstString(raw.content) ??
          firstString(raw["content:encoded"]),
      ),
      5_000,
    ),
    author: cleanText(
      firstString(raw.author) ??
        firstString(raw.creator) ??
        firstString(raw["dc:creator"]) ??
        authorName(raw.author),
    ),
    publishedAt,
    fetchedAt,
    guid,
    raw,
  };
}

function truncate(value: string | null, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return value.slice(0, maxLength).trimEnd();
}

function stableItemId(sourceId: string, identity: string, title: string) {
  return `${sourceId}:${fnv1a(`${identity}|${title}`).toString(16)}`;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function cleanText(value: string | null) {
  if (!value) return null;
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function linkFromAtom(value: unknown) {
  const links = asArray(value).filter(isRecord);
  const alternate = links.find((link) => link["@_rel"] === "alternate") ?? links[0];
  return firstString(alternate?.["@_href"]);
}

function authorName(value: unknown) {
  if (!isRecord(value)) return null;
  return firstString(value.name);
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstString(item);
      if (text) return text;
    }
  }

  if (isRecord(value)) {
    return firstString(value["#cdata"]) ?? firstString(value["#text"]);
  }

  return null;
}

function objectAt(record: unknown, key: string) {
  const value = unknownAt(record, key);
  return isRecord(value) ? value : null;
}

function unknownAt(record: unknown, key: string) {
  return isRecord(record) ? record[key] : undefined;
}

function asArray(value: unknown) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
