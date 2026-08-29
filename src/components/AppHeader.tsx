import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";

export function BrandMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5" />
      <path d="M12 18.5A6.5 6.5 0 0 1 5.5 12" />
    </svg>
  );
}

export function AppHeader() {
  const { data: account } = useAccount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BrandMark />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            LeadRadar <span className="text-primary">AI</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Google Maps-wide discovery with verified phone numbers and Instagram profiles.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {account?.email && (
          <span className="rounded-lg border bg-card px-3 py-2 text-muted-foreground">
            {account.email}
          </span>
        )}
        <Link
          to="/dashboard"
          className="rounded-lg border bg-background px-3 py-2 font-medium text-foreground transition hover:bg-accent"
        >
          Dashboard
        </Link>
        {account?.isAdmin && (
          <Link
            to="/admin"
            className="rounded-lg border bg-background px-3 py-2 font-medium text-foreground transition hover:bg-accent"
          >
            Admin Panel
          </Link>
        )}
        <button
          onClick={signOut}
          className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
