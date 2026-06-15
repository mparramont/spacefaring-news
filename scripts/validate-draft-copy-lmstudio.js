import { draftCopyMessages, normalizeDraftCopy, parseDraftCopyResponse } from "../ingest/draft-copy.js";

const baseUrl = process.env.LMSTUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1";
const model = process.env.LMSTUDIO_MODEL ?? "llama-3.2-3b-instruct";

const sampleCluster = {
  representative_title: "Live coverage: SpaceX to launch its first Falcon 9 rocket since Nasdaq debut",
  summary:
    "The Starlink 17-54 mission includes the 1,500th Starlink satellite launched so far in 2026. Liftoff from pad 4E at Vandenberg Space Force Base is scheduled during a window that opens at 7 a.m. PDT.",
  source_titles: "Spaceflight Now",
  status: "approved",
  editor_note: null,
  score_reasons: ["1 source", "impact terms: launch, mission, rocket, satellite", "published in the last 24 hours"],
};

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model,
    messages: draftCopyMessages(sampleCluster),
    temperature: 0.2,
    max_tokens: 220,
  }),
});

if (!response.ok) {
  throw new Error(`LM Studio returned ${response.status}: ${await response.text()}`);
}

const body = await response.json();
const text = body.choices?.[0]?.message?.content ?? "";
const parsed = normalizeDraftCopy(parseDraftCopyResponse(text));

console.log(JSON.stringify({ model, parsed }, null, 2));
