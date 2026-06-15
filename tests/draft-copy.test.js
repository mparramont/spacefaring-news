import assert from "node:assert/strict";
import { test } from "node:test";

import { draftCopyMessages, generateDraftCopy, normalizeDraftCopy, parseDraftCopyResponse } from "../ingest/draft-copy.js";

test("builds bounded draft-copy prompts without editorial voice", () => {
  const messages = draftCopyMessages({
    representative_title: "Rocket launch update",
    summary: "A mission is scheduled today.",
    source_titles: "Spaceflight Now",
    status: "approved",
    editor_note: "Lead if timely",
    score_reasons: ["published in the last 24 hours"],
  });

  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Do not imitate a person's voice/);
  assert.match(messages[1].content, /Spaceflight Now/);
  assert.match(messages[1].content, /max 90 characters/);
});

test("parses and normalizes JSON draft-copy responses", () => {
  const parsed = parseDraftCopyResponse(`
    Here is the JSON:
    {
      "headline": "  Launch update   ",
      "why_it_matters": "The mission adds near-term launch context.",
      "source_context": "Based on Spaceflight Now coverage."
    }
  `);

  assert.deepEqual(normalizeDraftCopy(parsed), {
    headline: "Launch update",
    why_it_matters: "The mission adds near-term launch context.",
    source_context: "Based on Spaceflight Now coverage.",
  });
});

test("retries malformed model output once", async () => {
  const calls = [];
  const ai = {
    async run(_model, body) {
      calls.push(body);
      return calls.length === 1
        ? { response: "not json" }
        : {
            response: JSON.stringify({
              headline: "Launch update",
              why_it_matters: "The mission adds launch context.",
              source_context: "Based on Spaceflight Now coverage.",
            }),
          };
    },
  };

  const copy = await generateDraftCopy(
    {
      representative_title: "Rocket launch update",
      summary: "A mission is scheduled today.",
      source_titles: "Spaceflight Now",
      score_reasons: [],
    },
    ai,
    { model: "test-model" },
  );

  assert.equal(calls.length, 2);
  assert.equal(copy.headline, "Launch update");
});
