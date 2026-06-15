export const DRAFT_COPY_MODEL = "@cf/meta/llama-3.2-1b-instruct";
export const DRAFT_COPY_PROVIDER = "cloudflare-workers-ai";

const MAX_FIELD_LENGTH = 220;

export async function generateDraftCopy(cluster, ai, options = {}) {
  if (!ai?.run) {
    throw new Error("Workers AI binding is not configured");
  }

  const model = options.model ?? DRAFT_COPY_MODEL;
  const response = await ai.run(model, {
    messages: draftCopyMessages(cluster),
    max_tokens: 220,
    temperature: 0.2,
  });
  const parsed = parseDraftCopyResponse(response?.response ?? response);
  return normalizeDraftCopy(parsed);
}

export function draftCopyMessages(cluster) {
  return [
    {
      role: "system",
      content: [
        "You draft internal newsletter planning copy for an editor.",
        "Do not imitate a person's voice. Do not add hype.",
        "Be concise, factual, and provisional.",
        "Return only valid JSON with keys: headline, why_it_matters, source_context.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        title: cluster.representative_title,
        summary: cluster.summary,
        main_source: mainSourceTitle(cluster),
        status: cluster.status,
        editor_note: cluster.editor_note,
        score_reasons: cluster.score_reasons ?? [],
        constraints: {
          headline: "one factual line, max 90 characters",
          why_it_matters: "one sentence, max 180 characters",
          source_context: "one sentence naming source/context, max 180 characters",
        },
      }),
    },
  ];
}

export function parseDraftCopyResponse(value) {
  if (typeof value === "object" && value !== null) {
    return value;
  }

  const text = String(value ?? "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Draft copy model did not return JSON");
  }
}

export function normalizeDraftCopy(copy) {
  return {
    headline: cleanField(copy.headline),
    why_it_matters: cleanField(copy.why_it_matters),
    source_context: cleanField(copy.source_context),
  };
}

function cleanField(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

function mainSourceTitle(cluster) {
  return String(cluster.source_titles ?? "")
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean)[0] ?? "";
}
