// Shared types for the lead finder pipeline (client + server safe).

export interface SearchConfig {
  city: string;
  category: string;
  minRating: number;
  maxRating: number;
}

/** A business collected from Google Places with all required fields present. */
export interface BusinessCandidate {
  placeId: string | null;
  name: string;
  phone: string;
  rating: number;
  ratingCount: number;
  address: string | null;
  mapsUrl: string | null;
  googleCategory: string | null;
  phoneValid: boolean;
  phoneLineType: string;
}


export interface SearchStats {
  /** Raw businesses returned by Google Places before dedupe. */
  found: number;
  afterDedup: number;
  /** Businesses inside the user's rating range. */
  ratingMatches: number;
  /** Businesses that also have name, phone, rating and rating count. */
  eligible: number;
}

export interface SearchBusinessesResult {
  businesses: BusinessCandidate[];
  stats: SearchStats;
}

export interface InstagramMatch {
  url: string;
  handle: string;
  verified: boolean;
  confidence: number;
  sourceQuery: string;
}

/** A fully verified lead — the only shape shown in the final table. */
export interface VerifiedLead {
  business_name: string;
  phone: string;
  rating: number;
  rating_count: number;
  address: string | null;
  category: string | null;
  city: string;
  google_maps_url: string | null;
  place_id: string | null;
  instagram_url: string;
  instagram_handle: string;
  instagram_verified: boolean;
}

export interface SearchRecord {
  id: string;
  city: string;
  category: string;
  min_rating: number;
  max_rating: number;
  status: string;
  businesses_found: number;
  rating_matches: number;
  verified_leads: number;
  created_at: string;
}
