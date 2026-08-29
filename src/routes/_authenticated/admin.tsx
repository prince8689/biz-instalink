import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { formatMoney } from "@/components/PlanGate";
import { useAccount } from "@/hooks/useAccount";
import {
  adminAdjustAccess,
  adminListUsers,
  adminSetBlocked,
  adminSetWeeklyPrice,
  type AdminUserRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — LeadRadar AI" },
      {
        name: "description",
        content:
          "Review registered users, set the weekly access price and manage subscriptions and blocks.",
      },
      { property: "og:title", content: "Admin Panel — LeadRadar AI" },
      {
        property: "og:description",
        content: "Manage users, weekly pricing and access on LeadRadar AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: account, isLoading: accountLoading } = useAccount();
  const queryClient = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const setPrice = useServerFn(adminSetWeeklyPrice);
  const setBlocked = useServerFn(adminSetBlocked);
  const adjustAccess = useServerFn(adminAdjustAccess);
  const [priceInput, setPriceInput] = useState("");

  const users = useQuery<AdminUserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: () => listUsers(),
    enabled: Boolean(account?.isAdmin),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["account"] });
  };

  const priceMutation = useMutation({
    mutationFn: (rupees: number) => setPrice({ data: { rupees } }),
    onSuccess: () => {
      toast.success("Weekly price updated.");
      setPriceInput("");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update the price."),
  });

  const blockMutation = useMutation({
    mutationFn: (vars: { userId: string; blocked: boolean }) => setBlocked({ data: vars }),
    onSuccess: () => {
      toast.success("User access updated.");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update the user."),
  });

  const accessMutation = useMutation({
    mutationFn: (vars: { userId: string; weeks: number }) => adjustAccess({ data: vars }),
    onSuccess: () => {
      toast.success("Plan period updated.");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update access."),
  });

  if (accountLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!account?.isAdmin) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <AppHeader />
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Admin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is only available to administrators.
          </p>
        </div>
      </main>
    );
  }

  const rows = users.data ?? [];
  const activeCount = rows.filter((r) => r.active).length;
  const revenue = rows.reduce((sum, r) => sum + r.total_paid_paise, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <AppHeader />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Registered users", value: String(rows.length) },
          { label: "Active plans", value: String(activeCount) },
          { label: "Weekly price", value: formatMoney(account.weeklyPricePaise, account.currency) },
          { label: "Total collected", value: formatMoney(revenue, account.currency) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Weekly charge</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set what every user pays for 7 days of access. When their week ends, searching stops
          until they pay again.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Price in ₹ per week</span>
            <input
              type="number"
              min={1}
              step={1}
              value={priceInput}
              placeholder={String(account.weeklyPricePaise / 100)}
              onChange={(e) => setPriceInput(e.target.value)}
              className="w-40 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <button
            onClick={() => priceMutation.mutate(Number(priceInput))}
            disabled={priceMutation.isPending || !priceInput}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {priceMutation.isPending ? "Saving..." : "Save price"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Registered users</h2>
          <button
            onClick={refresh}
            className="rounded-lg border bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Searches</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              )}
              {!users.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                    No users have registered yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.email ?? "—"}</p>
                    {row.is_admin && (
                      <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.blocked
                          ? "font-semibold text-destructive"
                          : row.active
                            ? "font-semibold text-primary"
                            : "text-muted-foreground"
                      }
                    >
                      {row.blocked ? "Blocked" : row.active ? "Active" : "Expired"}
                    </span>
                    {row.current_period_end && (
                      <p className="text-xs text-muted-foreground">
                        till {new Date(row.current_period_end).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.searches}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatMoney(row.total_paid_paise, account.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          accessMutation.mutate({ userId: row.user_id, weeks: 1 })
                        }
                        className="rounded border bg-background px-2 py-1 text-xs font-medium transition hover:bg-accent"
                      >
                        +1 week
                      </button>
                      <button
                        onClick={() =>
                          accessMutation.mutate({ userId: row.user_id, weeks: -1 })
                        }
                        className="rounded border bg-background px-2 py-1 text-xs font-medium transition hover:bg-accent"
                      >
                        -1 week
                      </button>
                      <button
                        onClick={() =>
                          blockMutation.mutate({ userId: row.user_id, blocked: !row.blocked })
                        }
                        className="rounded border bg-background px-2 py-1 text-xs font-medium transition hover:bg-accent"
                      >
                        {row.blocked ? "Unblock" : "Block"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
