// Server-only Google Places integration. The API key never leaves the server.

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const MAX_PAGES = 3; // Places API returns at most 3 pages of 20 results.

export interface RawBusiness {
  placeId: string | null;
  name: string;
  phone: string | null;
  rating: number | null;
  ratingCount: number | null;
  address: string | null;
  mapsUrl: string | null;
  googleCategory: string | null;
}

interface TextSearchResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}

interface PlacesResponse {
  status: string;
  error_message?: string;
  next_page_token?: string;
  results?: TextSearchResult[];
}

interface DetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    name?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    rating?: number;
    user_ratings_total?: number;
    formatted_address?: string;
    url?: string;
    types?: string[];
    website?: string;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Google API HTTP error (${res.status})`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function assertOk(status: string, errorMessage: string | undefined, context: string) {
  if (status === "OK" || status === "ZERO_RESULTS") return;
  if (status === "OVER_QUERY_LIMIT") {
    throw new Error("Google Places rate limit reached. Please wait a moment and try again.");
  }
  if (status === "REQUEST_DENIED") {
    throw new Error(
      `Google Places request denied${errorMessage ? `: ${errorMessage}` : ""}. Check the API key configuration.`,
    );
  }
  if (status === "INVALID_REQUEST") {
    throw new Error(`Invalid ${context} request sent to Google Places.`);
  }
  throw new Error(`Google Places error: ${status}${errorMessage ? ` - ${errorMessage}` : ""}`);
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchDetails(placeId: string, apiKey: string): Promise<DetailsResponse["result"] | null> {
  const fields = [
    "name",
    "formatted_phone_number",
    "international_phone_number",
    "rating",
    "user_ratings_total",
    "formatted_address",
    "url",
    "types",
  ].join(",");
  const url = `${DETAILS_URL}?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${apiKey}`;
  const data = await fetchJson<DetailsResponse>(url);
  if (data.status !== "OK") return null;
  return data.result ?? null;
}

/**
 * Searches Google Places for "<category> in <city>", walks all available
 * result pages, fetches place details (phone number etc.) for each hit and
 * removes duplicates by Place ID (falling back to name+address).
 */
export async function fetchBusinesses(
  city: string,
  category: string,
  apiKey: string,
): Promise<{ businesses: RawBusiness[]; rawCount: number }> {
  const query = `${category} in ${city}`;
  const candidates: TextSearchResult[] = [];

  let url = `${TEXT_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchJson<PlacesResponse>(url);
    assertOk(data.status, data.error_message, "text search");
    if (data.status === "ZERO_RESULTS") break;
    candidates.push(...(data.results ?? []));
    if (!data.next_page_token) break;
    // Google requires a short delay before a next_page_token becomes valid.
    await sleep(2200);
    url = `${TEXT_SEARCH_URL}?pagetoken=${encodeURIComponent(data.next_page_token)}&key=${apiKey}`;
  }

  // Dedupe: place_id when available, else normalized name + address.
  const seen = new Set<string>();
  const unique: TextSearchResult[] = [];
  for (const c of candidates) {
    const key = c.place_id
      ? `pid:${c.place_id}`
      : `na:${normalizeKeyPart(c.name)}|${normalizeKeyPart(c.formatted_address)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  // Fetch details (phone numbers) with a small concurrency pool.
  const results: RawBusiness[] = new Array(unique.length);
  let cursor = 0;
  const CONCURRENCY = 5;
  async function worker() {
    while (cursor < unique.length) {
      const index = cursor++;
      const c = unique[index]!;
      let details: DetailsResponse["result"] | null = null;
      if (c.place_id) {
        try {
          details = await fetchDetails(c.place_id, apiKey);
        } catch {
          details = null; // fall back to text-search data below
        }
      }
      const phone =
        details?.international_phone_number ?? details?.formatted_phone_number ?? null;
      results[index] = {
        placeId: c.place_id ?? null,
        name: details?.name ?? c.name ?? "",
        phone,
        rating: details?.rating ?? c.rating ?? null,
        ratingCount: details?.user_ratings_total ?? c.user_ratings_total ?? null,
        address: details?.formatted_address ?? c.formatted_address ?? null,
        mapsUrl: details?.url ?? (c.place_id ? `https://www.google.com/maps/place/?q=place_id:${c.place_id}` : null),
        googleCategory: details?.types?.[0] ?? c.types?.[0] ?? null,
      };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { businesses: results.filter(Boolean), rawCount: candidates.length };
}
