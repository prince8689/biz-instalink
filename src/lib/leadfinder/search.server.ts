// Server-only web search with a graceful provider fallback.
// Primary: Serper.dev (requires credits). Fallback: DuckDuckGo Lite (free).

export interface SearchHit {
  link: string;
  title: string;
  snippet: string;
}

const SERPER_URL = "https://google.serper.dev/search";
const DDG_URL = "https://lite.duckduckgo.com/lite/";

function decodeEntities(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function serperSearch(query: string, apiKey: string): Promise<SearchHit[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(SERPER_URL, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10 }),
      signal,
    });
    if (!res.ok) {
      // 400 "Not enough credits", 429 rate limit, 403 bad key -> use fallback.
      throw new Error(`serper ${res.status}`);
    }
    const data = (await res.json()) as {
      organic?: { link?: string; title?: string; snippet?: string }[];
    };
    return (data.organic ?? [])
      .filter((o): o is { link: string } & typeof o => Boolean(o.link))
      .map((o) => ({ link: o.link, title: o.title ?? "", snippet: o.snippet ?? "" }));
  }, 20000);
}

async function duckDuckGoSearch(query: string): Promise<SearchHit[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(`${DDG_URL}?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html",
      },
      signal,
    });
    if (!res.ok) throw new Error(`ddg ${res.status}`);
    const html = await res.text();

    const hits: SearchHit[] = [];
    const linkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) !== null) {
      const link = decodeEntities(match[1]!);
      const title = decodeEntities(match[2]!);
      const after = html.slice(match.index, match.index + 2500);
      const snippetMatch = after.match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i);
      hits.push({ link, title, snippet: snippetMatch ? decodeEntities(snippetMatch[1]!) : "" });
    }

    // Some responses use a plain layout without result-link classes.
    if (hits.length === 0) {
      const raw = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+/gi) ?? [];
      for (const link of raw) hits.push({ link, title: "", snippet: "" });
    }
    return hits;
  }, 8000);
}

async function bingSearch(query: string): Promise<SearchHit[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal,
    });
    if (!res.ok) throw new Error(`bing ${res.status}`);
    const html = await res.text();
    const hits: SearchHit[] = [];
    const re = /<h2><a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]{0,1200}?)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const snippetMatch = m[3]!.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      hits.push({
        link: decodeEntities(m[1]!),
        title: decodeEntities(m[2]!),
        snippet: snippetMatch ? decodeEntities(snippetMatch[1]!) : "",
      });
    }
    if (hits.length === 0) {
      const raw = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+/gi) ?? [];
      for (const link of raw) hits.push({ link, title: "", snippet: "" });
    }
    return hits;
  }, 10000);
}

/**
 * Runs a web search using whichever provider is available.
 * Never throws: an empty array means "no results / provider unavailable".
 */
let serperDisabledUntil = 0;
let ddgFailures = 0;
let ddgDisabledUntil = 0;

export async function webSearch(query: string, serperKey?: string): Promise<SearchHit[]> {
  const now = Date.now();
  if (serperKey && now > serperDisabledUntil) {
    try {
      const hits = await serperSearch(query, serperKey);
      if (hits.length > 0) return hits;
    } catch {
      // Out of credits / invalid key: stop hammering it for a while.
      serperDisabledUntil = Date.now() + 5 * 60_000;
    }
  }
  if (Date.now() >= ddgDisabledUntil) {
    try {
      const hits = await duckDuckGoSearch(query);
      if (hits.length === 0) {
        ddgFailures++;
      } else {
        ddgFailures = 0;
        return hits;
      }
      if (ddgFailures >= 3) ddgDisabledUntil = Date.now() + 5 * 60_000;
    } catch {
      ddgFailures++;
      if (ddgFailures >= 3) ddgDisabledUntil = Date.now() + 5 * 60_000;
    }
  }
  // Last resort: Bing HTML (free, no key).
  try {
    return await bingSearch(query);
  } catch {
    return [];
  }
}
