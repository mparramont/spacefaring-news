# Spacefaring News

Spacefaring News is a planned news and newsletter site for the spacefaring era, inspired by the editorial shape of Latent Space's AI News.

## Stack

- htmx frontend built with Vite
- Cloudflare Pages Functions for the edge request adapter
- Rust backend logic compiled to WebAssembly for the `/api/hello` fragment
- Playwright e2e tests against Wrangler's local Pages runtime

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
npm run build
npm run test:e2e
```

## Cloudflare Pages

The Pages project name is `spacefaring-news`. The GitHub Actions deploy job runs on pushes to `main` after the e2e suite passes.

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
