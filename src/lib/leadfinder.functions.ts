import { createServerFn } from "@tanstack/react-start";

import { fetchBusinesses, type RawBusiness } from "./leadfinder/google.server";
import { findVerifiedInstagram } from "./leadfinder/instagram.server";
import { getDb } from "./leadfinder/db.server";
import type {
  BusinessCandidate,
  InstagramMatch,
  SearchConfig,
  SearchRecord,
  VerifiedLead,
} from "./leadfinder/types";

/**
 * STEP 2-6: search Google Places (with pagination), dedupe, apply the strict
 * rating filter and keep only businesses with all required Google fields.
 */
export const searchBusinesses = createServerFn({ method: "POST" })
  .inputValidator((data) => data as SearchConfig)
  .handler(async ({ data }) => {
    const apiKey = process.env["GOOGLE_PLACES_API_KEY"];
    if (!apiKey) {
      throw new Error("Google Places API key is not configured on the server.");
    }

    const city = data.city?.trim();
    const category = data.category?.trim();
    if (!city) throw new Error("Please enter a valid city / location.");
    if (!category) throw new Error("Please enter a valid business category.");
    const min = Number(data.minRating);
    const max = Number(data.maxRating);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 5 || min > max) {
      throw new Error("Invalid rating range. Use values between 0 and 5 with min <= max.");
    }

    const { businesses, rawCount } = await fetchBusinesses(city, category, apiKey);

    // STEP 5: strict rating filter — min <= rating <= max, max respected exactly.
    const ratingMatches = businesses.filter(
      (b) => b.rating != null && b.rating >= min && b.rating <= max,
    );

    // STEP 6: required Google fields — name, phone, rating, rating count.
    const eligible: BusinessCandidate[] = ratingMatches
      .filter(
        (b): b is RawBusiness & { phone: string; rating: number; ratingCount: number } =>
          Boolean(b.name) && Boolean(b.phone) && b.rating != null && b.ratingCount != null,
      )
      .map((b) => ({
        placeId: b.placeId,
        name: b.name,
        phone: b.phone,
        rating: b.rating,
        ratingCount: b.ratingCount,
        address: b.address,
        mapsUrl: b.mapsUrl,
        googleCategory: b.googleCategory,
      }));

    return {
      businesses: eligible,
      stats: {
        found: rawCount,
        afterDedup: businesses.length,
        ratingMatches: ratingMatches.length,
        eligible: eligible.length,
      },
    };
  });

/**
 * STEP 7-8: find and verify the official Instagram profile for one business.
 */
export const findInstagram = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { businessName: string; city: string; category: string })
  .handler(async ({ data }): Promise<InstagramMatch | null> => {
    const apiKey = process.env["SERPER_API_KEY"];
    if (!apiKey) {
      throw new Error("Web search API key is not configured on the server.");
    }
    if (!data.businessName?.trim()) return null;
    return findVerifiedInstagram(data.businessName.trim(), data.city.trim(), data.category.trim(), apiKey);
  });

/**
 * Persists a completed search plus its verified leads (STEP 10 + history).
 */
export const saveSearch = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      data as SearchConfig & {
        stats: { found: number; ratingMatches: number; verified: number };
        leads: VerifiedLead[];
      },
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: search, error: searchError } = await db
      .from("lead_searches")
      .insert({
        city: data.city,
        category: data.category,
        min_rating: data.minRating,
        max_rating: data.maxRating,
        status: "completed",
        businesses_found: data.stats.found,
        rating_matches: data.stats.ratingMatches,
        verified_leads: data.stats.verified,
      })
      .select("id")
      .single();
    if (searchError || !search) {
      throw new Error(`Could not save search: ${searchError?.message ?? "unknown error"}`);
    }

    if (data.leads.length > 0) {
      const rows = data.leads.map((lead) => ({
        search_id: search.id,
        business_name: lead.business_name,
        phone: lead.phone,
        rating: lead.rating,
        rating_count: lead.rating_count,
        address: lead.address,
        category: lead.category,
        city: lead.city,
        google_maps_url: lead.google_maps_url,
        place_id: lead.place_id,
        instagram_url: lead.instagram_url,
        instagram_handle: lead.instagram_handle,
        instagram_verified: lead.instagram_verified,
        status: "verified",
      }));
      const { error: leadsError } = await db.from("lead_results").insert(rows);
      if (leadsError) {
        throw new Error(`Could not save results: ${leadsError.message}`);
      }
    }

    return { searchId: search.id as string };
  });

/** Recent search history for the dashboard. */
export const listSearches = createServerFn({ method: "GET" }).handler(async (): Promise<
  SearchRecord[]
> => {
  const db = getDb();
  const { data, error } = await db
    .from("lead_searches")
    .select(
      "id, city, category, min_rating, max_rating, status, businesses_found, rating_matches, verified_leads, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Could not load history: ${error.message}`);
  return (data ?? []) as unknown as SearchRecord[];
});

/** Loads the verified leads of a previous search. */
export const getSearchResults = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { searchId: string })
  .handler(async ({ data }): Promise<VerifiedLead[]> => {
    const db = getDb();
    const { data: rows, error } = await db
      .from("lead_results")
      .select(
        "business_name, phone, rating, rating_count, address, category, city, google_maps_url, place_id, instagram_url, instagram_handle, instagram_verified",
      )
      .eq("search_id", data.searchId)
      .order("business_name", { ascending: true });
    if (error) throw new Error(`Could not load results: ${error.message}`);
    return (rows ?? []) as unknown as VerifiedLead[];
  });
