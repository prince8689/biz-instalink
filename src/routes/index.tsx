import { createFileRoute, Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadRadar AI — Verified Business Leads with Instagram & Phone Check" },
      {
        name: "description",
        content:
          "Find local businesses by city, category and Google rating range — with verified phone numbers and official Instagram profiles. Weekly plan, instant access.",
      },
      {
        property: "og:title",
        content: "LeadRadar AI — Verified Business Leads with Instagram & Phone Check",
      },
      {
        property: "og:description",
        content:
          "Google Maps-wide business discovery with phone verification and official Instagram profiles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Maps-wide search",
    body: "Multiple query variants per city and category, just like searching on Google Maps — nearby businesses are included too.",
  },
  {
    title: "Phone verification",
    body: "Every number is validated for dialability and line type, so you only get real, reachable mobile lines.",
  },
  {
    title: "Official Instagram only",
    body: "Handles are matched against the business name and city, with generic and fan pages filtered out.",
  },
  {
    title: "Export in one click",
    body: "Download verified leads as CSV or JSON, copy to clipboard, and revisit every past search.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BrandMark />
          </span>
          <span className="font-display text-xl font-bold text-foreground">
            LeadRadar <span className="text-primary">AI</span>
          </span>
        </div>
        <Link
          to="/auth"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <section className="py-12 sm:py-20">
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Verified local business leads —{" "}
            <span className="text-primary">phone checked, Instagram confirmed</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Search any city and category, set your Google rating range, and get a clean table of
            businesses with working mobile numbers and their official Instagram profiles.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Create your account
            </Link>
            <Link
              to="/dashboard"
              className="rounded-lg border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Go to dashboard
            </Link>
          </div>
        </section>

        <section aria-label="Features" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Simple weekly access
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Register, pay the weekly fee securely with Razorpay, and search for 7 days. When the
            week ends, just renew — no long commitments.
          </p>
        </section>
      </main>
    </div>
  );
}
