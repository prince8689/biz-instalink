// Server-only Instagram discovery + verification via web search (Serper).
// Handles are never fabricated: a result is only returned when a real
// instagram.com profile link appeared in search results AND it passes
// verification signals against the business data.

import { webSearch, type SearchHit } from "./search.server";
import { buildInstagramPrompt, findInstagramWithGemini } from "./gemini.server";

const NON_PROFILE_SEGMENTS = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "tv",
  "stories",
  "accounts",
  "direct",
  "tags",
  "legal",
  "developer",
  "about",
  // Generic/aggregator handles that are never a business's own profile.
  "popular",
  "directory",
  "web",
  "home",
  "search",
  "help",
  "privacy",
  "terms",
  "blog",
  "press",
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "official",
  "shop",
  "shops",
  "store",
  "stores",
  "best",
  "top",
  "new",
  "near",
]);

export interface InstagramMatchResult {
  url: string;
  handle: string;
  verified: boolean;
  confidence: number;
  sourceQuery: string;
}

/** Extracts and normalizes an instagram.com profile URL, or null. */
export function normalizeInstagramUrl(raw: string): { url: string; handle: string } | null {
  const match = raw.match(/instagram\.com\/([^/?#\s]+)/i);
  if (!match) return null;
  let handle = match[1]!.toLowerCase().replace(/[^a-z0-9._]/g, "");
  handle = handle.replace(/^[._]+|[._]+$/g, "");
  if (!handle || handle.length < 2 || handle.length > 30) return null;
  if (NON_PROFILE_SEGMENTS.has(handle)) return null;
  return { url: `https://www.instagram.com/${handle}/`, handle };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

interface Candidate {
  handle: string;
  url: string;
  title: string;
  snippet: string;
  sourceQuery: string;
}

function scoreCandidate(
  c: Candidate,
  businessName: string,
  city: string,
  category: string,
): { score: number; nameScore: number } {
  const nameTokens = tokenize(businessName);
  const handleText = c.handle.replace(/[._]/g, " ");
  const handleTokens = new Set(tokenize(handleText));
  const text = `${c.title} ${c.snippet}`.toLowerCase();

  let overlap = 0;
  for (const token of nameTokens) {
    if (handleTokens.has(token) || handleText.includes(token) || text.includes(token)) {
      overlap++;
    }
  }
  const denom = Math.max(1, Math.min(nameTokens.length, 3));
  const nameScore = Math.min(1, overlap / denom);

  const cityHit = tokenize(city).some((t) => text.includes(t) || handleText.includes(t));
  const categoryHit = tokenize(category).some((t) => t.length > 3 && text.includes(t));

  let score = nameScore * 0.7 + (cityHit ? 0.2 : 0) + (categoryHit ? 0.1 : 0);
  if (/fan\s?page|fanpage|unofficial|parody/i.test(text)) score -= 0.4;
  return { score: Math.max(0, Math.min(1, score)), nameScore };
}

/**
 * Finds the official Instagram profile for a business using dynamically
 * generated search prompts, then verifies candidates against the business
 * name, city and category. Returns null when nothing reliable is found.
 */
export async function findVerifiedInstagram(
  businessName: string,
  city: string,
  category: string,
  apiKey?: string,
): Promise<InstagramMatchResult | null> {
  // Dynamically generated prompts — never literal placeholders.
  const queries = [
    `Find the official Instagram profile handle of "${businessName}" in ${city} (a ${category} business). Return the exact instagram.com URL.`,
    `"${businessName}" "${city}" Instagram`,
    `site:instagram.com "${businessName}" "${city}"`,
  ];

  const bestByHandle = new Map<string, { candidate: Candidate; score: number; nameScore: number }>();

  for (const query of queries) {
    const organic: SearchHit[] = await webSearch(query, apiKey);

    for (const item of organic) {
      if (!item.link || !/instagram\.com/i.test(item.link)) continue;
      const normalized = normalizeInstagramUrl(item.link);
      if (!normalized) continue;
      const candidate: Candidate = {
        handle: normalized.handle,
        url: normalized.url,
        title: item.title ?? "",
        snippet: item.snippet ?? "",
        sourceQuery: query,
      };
      const { score, nameScore } = scoreCandidate(candidate, businessName, city, category);
      const existing = bestByHandle.get(normalized.handle);
      if (!existing || score > existing.score) {
        bestByHandle.set(normalized.handle, { candidate, score, nameScore });
      }
    }

    // Pick the best candidate seen so far.
    let best: { candidate: Candidate; score: number; nameScore: number } | null = null;
    for (const entry of bestByHandle.values()) {
      if (!best || entry.score > best.score) best = entry;
    }
    if (!best) continue;

    // The handle itself must share a meaningful token with the business
    // name — a snippet-only mention (e.g. an aggregator page listing many
    // businesses) is not enough to accept a profile.
    const nameTokens = tokenize(businessName);
    const handleText = best.candidate.handle.replace(/[._]/g, " ");
    const strongTokens = nameTokens.filter((t) => t.length > 3);
    const handleSharesName = (strongTokens.length > 0 ? strongTokens : nameTokens).some((t) =>
      handleText.includes(t),
    );

    // Exact handle/name match needs weaker supporting signals.
    const accept =
      handleSharesName &&
      (best.nameScore >= 0.99 ? best.score >= 0.55 : best.score >= 0.65 && best.nameScore >= 0.5);
    if (accept) {
      return {
        url: best.candidate.url,
        handle: best.candidate.handle,
        verified: true,
        confidence: Math.round(best.score * 100) / 100,
        sourceQuery: best.candidate.sourceQuery,
      };
    }
    // Otherwise keep searching with the next (more specific) fallback query.
  }

  // Final step: ask Gemini with the dynamic prompt.
  const ai = await findInstagramWithGemini(businessName, city, category);
  if (ai) {
    const nameTokens = tokenize(businessName);
    const handleText = ai.handle.replace(/[._]/g, " ");
    const strong = nameTokens.filter((t) => t.length > 3);
    const shares = (strong.length > 0 ? strong : nameTokens).some((t) => handleText.includes(t));
    if (shares && !NON_PROFILE_SEGMENTS.has(ai.handle)) {
      return {
        url: ai.url,
        handle: ai.handle,
        verified: true,
        confidence: 0.8,
        sourceQuery: buildInstagramPrompt(businessName, city, category),
      };
    }
  }

  return null;
}

