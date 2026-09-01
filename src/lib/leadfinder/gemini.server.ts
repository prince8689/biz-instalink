// Server-only Instagram lookup via Gemini (Lovable AI Gateway).
// Uses the exact user-defined prompt shape and returns a normalized handle.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export function buildInstagramPrompt(businessName: string, area: string, category: string): string {
  return `Find the official Instagram profile handle of "${businessName}" in "${area}" (a ${category} business). Return the exact instagram.com URL.`;
}

export interface GeminiInstagramResult {
  url: string;
  handle: string;
}

/**
 * Asks Gemini for the official Instagram URL of a business.
 * Returns null when the model is unsure or no key is configured.
 */
export async function findInstagramWithGemini(
  businessName: string,
  area: string,
  category: string,
): Promise<GeminiInstagramResult | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const prompt = buildInstagramPrompt(businessName, area, category);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              'You verify official Instagram profiles of local businesses. Reply with ONLY a JSON object: {"url":"https://www.instagram.com/<handle>/"} when you are confident the profile really exists and belongs to that exact business, otherwise {"url":null}. Never invent handles, never return fan pages, aggregators, hashtags, posts/reels links or generic directory accounts.',
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const match = content.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (!match) return null;
    const handle = match[1]!.toLowerCase().replace(/^[._]+|[._]+$/g, "");
    if (!handle || handle.length < 2 || handle.length > 30) return null;
    return { url: `https://www.instagram.com/${handle}/`, handle };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
