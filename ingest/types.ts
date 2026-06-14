export type SourceCategory =
  | "agency"
  | "astronomy"
  | "commercial"
  | "defense"
  | "industry"
  | "launch"
  | "policy"
  | "science"
  | "satellite";

export type FeedSource = {
  id: string;
  title: string;
  url: string;
  homepage: string;
  category: SourceCategory;
  language: string;
  region: string;
  cadenceMinutes: number;
};

export type XSource = FeedSource & {
  username: string;
};

export type NewsItem = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  guid: string | null;
  raw: Record<string, unknown>;
};

export type IngestionRun = {
  id: string;
  startedAt: string;
  finishedAt: string;
  sourceCount: number;
  fetchedCount: number;
  storedCount: number;
  failedCount: number;
  errors: Array<{ sourceId: string; message: string }>;
};

export type NewsStore = {
  saveSources(sources: FeedSource[], now: string): Promise<void>;
  saveItems(items: NewsItem[]): Promise<number>;
  recordRun(run: IngestionRun): Promise<void>;
};
