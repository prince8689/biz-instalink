// Server-only Instagram lookup via Gemini (Lovable AI Gateway).
// Uses the exact user-defined prompt shape and returns a normalized handle.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["google/gemini-2.5-flash"];

export function buildInstagramPrompt(businessName: string, area: string, category: string): string {
  return `Find the official Instagram profile handle of "${businessName}" in "${area}" (a ${category} business). Return the exact instagram.com URL.`;
}

export interface GeminiInstagramResult {
  url: string;
  handle: string;
}

const SYSTEM_PROMPT =
  'You verify official Instagram profiles of local businesses. Reply with ONLY a JSON object: {"url":"https://www.instagram.com/<handle>/"} when the profile plausibly belongs to that exact business, otherwise {"url":null}. Prefer handles that clearly derive from the business name (including abbreviations, initials, or name+city combinations). Never return fan pages, aggregators, hashtags, post/reel links or generic directory accounts.';

function extractHandle(content: string): GeminiInstagramResult | null {
  const match = content.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!match) return null;
  const handle = match[1]!.toLowerCase().replace(/^[._]+|[._]+$/g, "");
  if (!handle || handle.length < 2 || handle.length > 30) return null;
  return { url: `https://www.instagram.com/${handle}/`, handle };
}

async function ask(
  apiKey: string,
  model: string,
  userContent: string,
): Promise<GeminiInstagramResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return extractHandle(json.choices?.[0]?.message?.content ?? "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks Gemini for the official Instagram URL of a business. Optional web
 * search context (real instagram.com links found online) makes the answer
 * far more reliable and prevents invented handles.
 */
export async function findInstagramWithGemini(
  businessName: string,
  area: string,
  category: string,
  context?: string[],
): Promise<GeminiInstagramResult | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const base = buildInstagramPrompt(businessName, area, category);
  const withContext =
    context && context.length > 0
      ? `${base}\n\nCandidate links found on the web (pick the correct one if any matches, otherwise answer null):\n${context.slice(0, 12).join("\n")}`
      : base;

  const attempts = [
    withContext,
    `${base}\nIf you are unsure of the exact handle, return the most likely official handle that combines the business name with its city or category.`,
  ];

  for (const model of MODELS) {
    for (const attempt of attempts) {
      const result = await ask(apiKey, model, attempt);
      if (result) return result;
    }
  }
  return null;
}
