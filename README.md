# Spacefaring News

Spacefaring News is a planned news and newsletter site for the spacefaring era, inspired by the editorial shape of Latent Space's AI News.

## Stack

- htmx frontend built with Vite
- Cloudflare Pages Functions for the edge request adapter
- Rust backend logic compiled to WebAssembly for newsletter signup fragments
- Cloudflare Worker cron ingestion for RSS and Atom feeds
- Cloudflare D1 storage for normalized source and article records
- Playwright e2e tests against Wrangler's local Pages runtime

## News Ingestion

The ingestion pipeline is intentionally small:

1. `ingest/sources.ts` keeps the curated RSS/Atom source catalog.
2. `ingest/worker.ts` runs as `spacefaring-news-ingest` on a 30-minute cron.
3. `ingest/ingest.ts` fetches each source and normalizes items through `ingest/feed.ts`.
4. `ingest/d1-store.ts` upserts sources, deduplicates items, and records each run in D1.

The D1 schema is in `migrations/0001_news_ingestion.sql`.

Local ingestion setup:

```sh
npm run ingest:migrate:local
npm run ingest:dev
curl "http://127.0.0.1:8787/__scheduled?cron=*/30+*+*+*+*"
```

Manual source audit:

```sh
npm run check:sources
```

Production setup:

```sh
npx wrangler d1 create spacefaring-news
# Put the returned database_id into wrangler.ingest.toml.
npx wrangler d1 migrations apply spacefaring-news --remote --config wrangler.ingest.toml
npm run ingest:deploy
npx wrangler secret put INGEST_SHARED_SECRET --config wrangler.ingest.toml
```

## Local Development

```sh
npm install
rustup target add wasm32-unknown-unknown
npm run dev
```

## Verification

```sh
npm run typecheck
cargo test --manifest-path backend/Cargo.toml
npm run test:ingest
npm run build
npx wrangler deploy --config wrangler.ingest.toml --dry-run --outdir .wrangler-dry-run
npm run test:e2e
```

Run the same e2e flow against the live Pages URL:

```sh
npm run test:e2e:live
```

## Cloudflare Pages

The Pages project name is `spacefaring-news`. The GitHub Actions deploy job runs on pushes to `main` after the e2e suite passes, then checks the deployed site at `https://spacefaring-news.pages.dev`.

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Manual deploy:

```sh
npm run build
npx wrangler pages project create spacefaring-news --production-branch main --compatibility-date=2026-06-10
npx wrangler pages deploy dist --project-name spacefaring-news --branch main
```

## Naming

| Context | Usage |
| --- | --- |
| Site title, logo, newsletter header, formal references | Spacefaring News |
| Domain style | spacefaring.news |
| Social handle | @spacefaringnews |
| Logo wordmark, subtle | SPACEFARING NEWS |
| Product/database name | SpacefaringNews |
| Section label | SPACEFARING |
| Sentence use | "Today in Spacefaring News..." |
