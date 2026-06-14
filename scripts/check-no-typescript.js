import { readdir } from "node:fs/promises";
import { join } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".wrangler",
  ".wrangler-dry-run",
  "backend/target",
  "dist",
  "node_modules",
  "pkg",
]);

const matches = [];

await walk(".");

for (const match of matches) {
  console.error(`TypeScript file remains: ${match}`);
}

if (matches.length > 0) {
  process.exitCode = 1;
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const normalized = path.replace(/^\.\//, "");

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(normalized)) {
        await walk(path);
      }
      continue;
    }

    if (/\.(tsx?|d\.ts)$/.test(entry.name)) {
      matches.push(normalized);
    }
  }
}
