import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  findInstagram,
  getSearchResults,
  listSearches,
  saveSearch,
  searchBusinesses,
} from "@/lib/leadfinder.functions";
import type { SearchRecord, VerifiedLead } from "@/lib/leadfinder/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Business Lead Finder — Verified Local Leads with Instagram" },
      {
        name: "description",
        content:
          "Find verified local businesses by city, category and Google rating range — complete with phone numbers and official Instagram profiles.",
      },
      {
        property: "og:title",
        content: "AI Business Lead Finder — Verified Local Leads with Instagram",
      },
      {
        property: "og:description",
        content:
          "Find verified local businesses by city, category and Google rating range — complete with phone numbers and official Instagram profiles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Phase =
  | "idle"
  | "searching"
  | "filtering"
  | "instagram"
  | "saving"
  | "done"
  | "error";

interface Progress {
  phase: Phase;
  message: string;
  found?: number;
  ratingMatches?: number;
  eligible?: number;
  igChecked?: number;
  igTotal?: number;
  verified?: number;
}

const IDLE_PROGRESS: Progress = { phase: "idle", message: "" };

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Failed to fetch|NetworkError|abort/i.test(message)) {
    return "Network timeout while contacting an external API. Please try again.";
  }
  return message;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Index() {
  const [city, setCity] = useState("Sri Hargobindpur");
  const [category, setCategory] = useState("Fashion Shops");
  const [minRating, setMinRating] = useState("3.0");
  const [maxRating, setMaxRating] = useState("4.5");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  const [leads, setLeads] = useState<VerifiedLead[]>([]);
  const [history, setHistory] = useState<SearchRecord[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const runIdRef = useRef(0);

  const refreshHistory = () => {
    listSearches()
      .then(setHistory)
      .catch(() => {});
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const clearSearch = () => {
    runIdRef.current++;
    setCity("");
    setCategory("");
    setMinRating("3.0");
    setMaxRating("4.5");
    setLeads([]);
    setExpanded(new Set());
    setProgress(IDLE_PROGRESS);
    setRunning(false);
  };

  const runSearch = async () => {
    const min = Number(minRating);
    const max = Number(maxRating);
    if (!city.trim()) {
      setProgress({ phase: "error", message: "Please enter a city / location." });
      return;
    }
    if (!category.trim()) {
      setProgress({ phase: "error", message: "Please enter a business category." });
      return;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 5 || min > max) {
      setProgress({
        phase: "error",
        message: "Invalid rating range. Use values between 0 and 5 with min <= max.",
      });
      return;
    }

    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;

    setRunning(true);
    setLeads([]);
    setExpanded(new Set());
    setProgress({ phase: "searching", message: "Searching Google Maps..." });

    const config = { city: city.trim(), category: category.trim(), minRating: min, maxRating: max };

    try {
      // STEP 2-6: Google search, dedupe, rating filter, required-field filter.
      const result = await searchBusinesses({ data: config });
      if (!isCurrent()) return;

      setProgress({
        phase: "filtering",
        message: `Found ${result.stats.found} businesses`,
        found: result.stats.found,
      });
      setProgress({
        phase: "filtering",
        message: "Filtering ratings...",
        found: result.stats.found,
        ratingMatches: result.stats.ratingMatches,
      });

      const eligible = result.businesses;
      setProgress({
        phase: "filtering",
        message: `${result.stats.ratingMatches} businesses match rating range`,
        found: result.stats.found,
        ratingMatches: result.stats.ratingMatches,
        eligible: eligible.length,
      });

      if (eligible.length === 0) {
        const message =
          result.stats.found === 0
            ? "No businesses found for this search."
            : "No complete verified businesses found for this search.";
        setProgress({ phase: "done", message, found: result.stats.found, verified: 0 });
        await saveSearch({
          data: { ...config, stats: { found: result.stats.found, ratingMatches: result.stats.ratingMatches, verified: 0 }, leads: [] },
        }).catch(() => {});
        refreshHistory();
        setRunning(false);
        return;
      }

      // STEP 7-9: Instagram discovery + verification per business.
      setProgress({
        phase: "instagram",
        message: "Finding Instagram profiles...",
        found: result.stats.found,
        ratingMatches: result.stats.ratingMatches,
        eligible: eligible.length,
        igChecked: 0,
        igTotal: eligible.length,
        verified: 0,
      });

      const verifiedLeads: VerifiedLead[] = [];
      const queue = [...eligible];
      let checked = 0;

      const worker = async () => {
        while (queue.length > 0) {
          if (!isCurrent()) return;
          const business = queue.shift()!;
          let match = null;
          try {
            match = await findInstagram({
              data: { businessName: business.name, city: config.city, category: config.category },
            });
          } catch {
            match = null; // treat lookup failures as "not found"
          }
          checked++;
         if (match?.url) {
  verifiedLeads.push({
    business_name: business.name,
    phone: business.phone,
    rating: business.rating,
    rating_count: business.ratingCount,
    address: business.address,
    category: config.category,
    city: config.city,
    google_maps_url: business.mapsUrl,
    place_id: business.placeId,
    instagram_url: match.url,
    instagram_handle: match.handle ?? "",
    instagram_verified: true,
  });
}
          }
          if (isCurrent()) {
            setProgress({
              phase: "instagram",
              message: `Instagram verification: ${checked} / ${eligible.length}`,
              found: result.stats.found,
              ratingMatches: result.stats.ratingMatches,
              eligible: eligible.length,
              igChecked: checked,
              igTotal: eligible.length,
              verified: verifiedLeads.length,
            });
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!isCurrent()) return;

      // STEP 10: persist + show only complete verified leads.
      setProgress({
        phase: "saving",
        message: "Saving verified leads...",
        found: result.stats.found,
        ratingMatches: result.stats.ratingMatches,
        eligible: eligible.length,
        igChecked: checked,
        igTotal: eligible.length,
        verified: verifiedLeads.length,
      });
      await saveSearch({
        data: {
          ...config,
          stats: {
            found: result.stats.found,
            ratingMatches: result.stats.ratingMatches,
            verified: verifiedLeads.length,
          },
          leads: verifiedLeads,
        },
      }).catch(() => {});
      refreshHistory();

      verifiedLeads.sort((a, b) => b.rating - a.rating);
      setLeads(verifiedLeads);
      setProgress({
        phase: "done",
        message:
          verifiedLeads.length > 0
            ? `Final verified leads: ${verifiedLeads.length}`
            : "No complete verified businesses found for this search.",
        found: result.stats.found,
        ratingMatches: result.stats.ratingMatches,
        eligible: eligible.length,
        igChecked: checked,
        igTotal: eligible.length,
        verified: verifiedLeads.length,
      });
    } catch (error) {
      if (isCurrent()) {
        setProgress({ phase: "error", message: friendlyError(error) });
      }
    } finally {
      if (isCurrent()) setRunning(false);
    }
  };

  const loadSearch = async (record: SearchRecord) => {
    setCity(record.city);
    setCategory(record.category);
    setMinRating(String(record.min_rating));
    setMaxRating(String(record.max_rating));
    setProgress({ phase: "searching", message: "Loading saved search..." });
    setRunning(true);
    try {
      const rows = await getSearchResults({ data: { searchId: record.id } });
      setLeads(rows);
      setExpanded(new Set());
      setProgress({
        phase: "done",
        message:
          rows.length > 0
            ? `Loaded ${rows.length} verified leads from a previous search.`
            : "That search produced no complete verified businesses.",
        found: record.businesses_found,
        ratingMatches: record.rating_matches,
        verified: rows.length,
      });
    } catch (error) {
      setProgress({ phase: "error", message: friendlyError(error) });
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    const header = "Business Name,Mobile Number,Rating,Number of Ratings,Instagram";
    const lines = leads.map((l) =>
      [l.business_name, l.phone, l.rating, l.rating_count, l.instagram_url].map(csvEscape).join(","),
    );
    downloadFile("business-leads.csv", [header, ...lines].join("\n"), "text/csv");
  };

  const exportJson = () => {
    const payload = leads.map((l) => ({
      business_name: l.business_name,
      mobile_number: l.phone,
      rating: l.rating,
      number_of_ratings: l.rating_count,
      instagram: l.instagram_url,
    }));
    downloadFile("business-leads.json", JSON.stringify(payload, null, 2), "application/json");
  };

  const copyResults = async () => {
    const text = leads
      .map((l) => `${l.business_name}\t${l.phone}\t${l.rating}\t${l.rating_count}\t${l.instagram_url}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const igPercent =
    progress.igTotal && progress.igTotal > 0
      ? Math.round(((progress.igChecked ?? 0) / progress.igTotal) * 100)
      : progress.phase === "done" || progress.phase === "saving"
        ? 100
        : 0;

  const active = progress.phase !== "idle" && progress.phase !== "error";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Business Lead Finder
              </h1>
              <p className="text-sm text-muted-foreground">
                Find verified local businesses with Google ratings and official Instagram profiles.
              </p>
            </div>
          </div>
        </header>

        {/* Search configuration */}
        <section
          aria-label="Search configuration"
          className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Search Configuration
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">City / Location</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder='e.g. "Sri Hargobindpur"'
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Business Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder='e.g. "Fashion Shops"'
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Minimum Rating</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Maximum Rating</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={maxRating}
                onChange={(e) => setMaxRating(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={runSearch}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                  aria-hidden="true"
                />
              )}
              {running ? "Searching..." : "Search Businesses"}
            </button>
            <button
              onClick={clearSearch}
              disabled={running}
              className="rounded-lg border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear Search
            </button>
          </div>
        </section>

        {/* Progress */}
        {active && (
          <section
            aria-live="polite"
            className="mt-6 rounded-2xl border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <ProgressChip label="Searching Google Maps" active={progress.phase === "searching"} done={progress.found != null} />
              <ProgressChip
                label="Rating filter"
                active={progress.phase === "filtering"}
                done={progress.ratingMatches != null && (progress.phase === "instagram" || progress.phase === "saving" || progress.phase === "done")}
              />
              <ProgressChip
                label="Instagram verification"
                active={progress.phase === "instagram"}
                done={progress.phase === "saving" || progress.phase === "done"}
              />
              <ProgressChip label="Verified leads" active={progress.phase === "saving"} done={progress.phase === "done"} />
            </div>

            <div className="mt-4 flex items-center gap-3">
              {running && (
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
                  aria-hidden="true"
                />
              )}
              <p className="text-sm font-medium text-foreground">{progress.message}</p>
            </div>

            {(progress.phase === "instagram" || progress.phase === "saving" || progress.phase === "done") &&
              progress.igTotal != null &&
              progress.igTotal > 0 && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${igPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    {progress.found != null && <span>Found: {progress.found}</span>}
                    {progress.ratingMatches != null && <span>In rating range: {progress.ratingMatches}</span>}
                    {progress.eligible != null && <span>Complete Google data: {progress.eligible}</span>}
                    <span>
                      Instagram verified: {progress.igChecked ?? 0} / {progress.igTotal}
                    </span>
                    {progress.verified != null && <span>Verified leads: {progress.verified}</span>}
                  </div>
                </div>
              )}
          </section>
        )}

        {/* Error */}
        {progress.phase === "error" && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive"
          >
            {progress.message}
          </div>
        )}

        {/* Empty state */}
        {progress.phase === "done" && leads.length === 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No complete verified businesses found for this search.
            </p>
          </div>
        )}

        {/* Results */}
        {leads.length > 0 && (
          <section className="mt-6 rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Verified Leads{" "}
                <span className="ml-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground">
                  {leads.length}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportCsv}
                  className="rounded-lg border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportJson}
                  className="rounded-lg border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
                >
                  Export JSON
                </button>
                <button
                  onClick={copyResults}
                  className="rounded-lg border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
                >
                  {copied ? "Copied!" : "Copy Results"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Business Name</th>
                    <th className="px-5 py-3 font-semibold">Mobile Number</th>
                    <th className="px-5 py-3 font-semibold">Rating</th>
                    <th className="px-5 py-3 font-semibold">Number of Ratings</th>
                    <th className="px-5 py-3 font-semibold">Instagram</th>
                    <th className="px-5 py-3 font-semibold">
                      <span className="sr-only">More details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <LeadRow
                      key={`${lead.place_id ?? lead.business_name}-${index}`}
                      lead={lead}
                      index={index}
                      expanded={expanded.has(index)}
                      onToggle={() => toggleExpanded(index)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Search History</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => loadSearch(record)}
                  disabled={running}
                  className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-ring hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="truncate text-sm font-semibold text-foreground">
                    {record.category} in {record.city}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rating {record.min_rating} – {record.max_rating} · {record.verified_leads} verified leads
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(record.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProgressChip({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        done
          ? "bg-success text-success-foreground"
          : active
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-primary" : "bg-muted-foreground/50"}`} />
      )}
      {label}
    </span>
  );
}

function LeadRow({
  lead,
  index,
  expanded,
  onToggle,
}: {
  lead: VerifiedLead;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
        <td className="px-5 py-3 font-medium text-foreground">{lead.business_name}</td>
        <td className="px-5 py-3 text-foreground">{lead.phone}</td>
        <td className="px-5 py-3">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-amber-500" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
            </svg>
            {lead.rating}
          </span>
        </td>
        <td className="px-5 py-3 text-foreground">{lead.rating_count}</td>
        <td className="px-5 py-3">
          <a
            href={lead.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {lead.instagram_url}
          </a>
        </td>
        <td className="px-5 py-3">
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`More details for ${lead.business_name}`}
            className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            {expanded ? "Less" : "More"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-5 py-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Address" value={lead.address ?? "—"} />
              <Detail label="Category" value={lead.category ?? "—"} />
              <Detail label="Place ID" value={lead.place_id ?? "—"} mono />
              <Detail label="Instagram Handle" value={`@${lead.instagram_handle}`} mono />
              <Detail
                label="Instagram Verification"
                value={lead.instagram_verified ? "Verified" : "Unverified"}
              />
              <Detail label="Search Status" value="Complete" />
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Google Maps</dt>
                <dd className="mt-0.5">
                  {lead.google_maps_url ? (
                    <a
                      href={lead.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-primary underline-offset-2 hover:underline"
                    >
                      {lead.google_maps_url}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-all text-foreground ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
