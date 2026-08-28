// Server-only access gate: only users with an active weekly plan (or admins)
// may run searches.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccessState {
  isAdmin: boolean;
  active: boolean;
  blocked: boolean;
  currentPeriodEnd: string | null;
}

export async function getAccessState(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccessState> {
  const [{ data: isAdmin }, { data: sub }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, blocked")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const end = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
  const blocked = Boolean(sub?.blocked);
  const active = Boolean(isAdmin) || (!blocked && end !== null && end.getTime() > Date.now());

  return {
    isAdmin: Boolean(isAdmin),
    active,
    blocked,
    currentPeriodEnd: (sub?.current_period_end as string | null) ?? null,
  };
}

export async function requireActiveAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccessState> {
  const state = await getAccessState(supabase, userId);
  if (!state.active) {
    throw new Error(
      state.blocked
        ? "Your access has been blocked by the admin. Please contact support."
        : "Your weekly plan is not active. Please pay the weekly fee to continue.",
    );
  }
  return state;
}
