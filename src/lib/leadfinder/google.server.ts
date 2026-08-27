// Server-only Google Places integration (Places API - New, Text Search).
// The API key never leaves the server.

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const MAX_PAGES = 3; // Places API returns at most 3 pages of 20 results.

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "nextPageToken",
].join(",");

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

interface PlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
}

interface SearchTextResponse {
  places?: PlaceResult[];
  nextPageToken?: string;
  error?: { code?: number; message?: string; status?: string };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function searchPage(
  apiKey: string,
  textQuery: string,
  pageToken?: string,
): Promise<SearchTextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(SEARCH_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(pageToken ? { textQuery, pageToken } : { textQuery }),
      signal: controller.signal,
    });
    const data = (await res.json()) as SearchTextResponse;
    if (!res.ok || data.error) {
      const status = data.error?.status ?? `HTTP ${res.status}`;
      const message = data.error?.message ?? "";
      if (res.status === 429 || data.error?.status === "RESOURCE_EXHAUSTED") {
        throw new Error("Google Places rate limit reached. Please wait a moment and try again.");
      }
      if (res.status === 403 || data.error?.status === "PERMISSION_DENIED") {
        throw new Error(
          `Google Places request denied${message ? `: ${message}` : ""}. Check the API key configuration.`,
        );
      }
      throw new Error(`Google Places error: ${status}${message ? ` - ${message}` : ""}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches Google Places the way Google Maps behaves: several natural query
 * variants (in / near / around / nearby areas) are executed, every page of
 * each is walked, and results are merged. This surfaces relevant businesses
 * from the surrounding area too, not only ones strictly inside the city.
 */
export async function fetchBusinesses(
  city: string,
  category: string,
  apiKey: string,
): Promise<{ businesses: RawBusiness[]; rawCount: number }> {
  const queries = [
    `${category} in ${city}`,
    `${category} near ${city}`,
    `best ${category} around ${city}`,
    `${category} nearby ${city}`,
    `${city} ${category}`,
  ];

  const seen = new Set<string>();
  const businesses: RawBusiness[] = [];
  let rawCount = 0;

  for (const textQuery of queries) {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      let data: SearchTextResponse;
      try {
        data = await searchPage(apiKey, textQuery, pageToken);
      } catch (error) {
        // A single failing variant must not kill the whole broadened search,
        // unless nothing at all has been collected yet.
        if (businesses.length === 0 && textQuery === queries[0]) throw error;
        break;
      }
      const places = data.places ?? [];
      rawCount += places.length;

      for (const place of places) {
        const key = place.id
          ? `pid:${place.id}`
          : `na:${normalizeKeyPart(place.displayName?.text)}|${normalizeKeyPart(place.formattedAddress)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        businesses.push({
          placeId: place.id ?? null,
          name: place.displayName?.text ?? "",
          phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
          rating: place.rating ?? null,
          ratingCount: place.userRatingCount ?? null,
          address: place.formattedAddress ?? null,
          mapsUrl:
            place.googleMapsUri ??
            (place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null),
          googleCategory: place.primaryTypeDisplayName?.text ?? null,
        });
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
      // The next page token needs a brief moment before it becomes valid.
      await sleep(2000);
    }
  }

  return { businesses, rawCount };
}

