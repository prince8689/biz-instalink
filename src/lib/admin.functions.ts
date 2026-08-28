import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  is_admin: boolean;
  status: string;
  blocked: boolean;
  current_period_end: string | null;
  active: boolean;
  total_paid_paise: number;
  searches: number;
}

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin access required.");
}

/** All registered users with their plan + payment summary. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profiles, subs, roles, payments, searches] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, phone, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscriptions").select("user_id, status, blocked, current_period_end"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("payments").select("user_id, amount_paise, status"),
      supabaseAdmin.from("lead_searches").select("user_id"),
    ]);

    const subMap = new Map((subs.data ?? []).map((s) => [s.user_id as string, s]));
    const adminSet = new Set(
      (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id as string),
    );
    const paidMap = new Map<string, number>();
    for (const p of payments.data ?? []) {
      if (p.status !== "paid") continue;
      paidMap.set(p.user_id as string, (paidMap.get(p.user_id as string) ?? 0) + Number(p.amount_paise));
    }
    const searchMap = new Map<string, number>();
    for (const s of searches.data ?? []) {
      if (!s.user_id) continue;
      searchMap.set(s.user_id as string, (searchMap.get(s.user_id as string) ?? 0) + 1);
    }

    return (profiles.data ?? []).map((p) => {
      const sub = subMap.get(p.id as string);
      const end = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
      const blocked = Boolean(sub?.blocked);
      return {
        user_id: p.id as string,
        email: (p.email as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
        created_at: p.created_at as string,
        is_admin: adminSet.has(p.id as string),
        status: (sub?.status as string | undefined) ?? "inactive",
        blocked,
        current_period_end: (sub?.current_period_end as string | null) ?? null,
        active: !blocked && end !== null && end.getTime() > Date.now(),
        total_paid_paise: paidMap.get(p.id as string) ?? 0,
        searches: searchMap.get(p.id as string) ?? 0,
      };
    });
  });

/** Sets the weekly price (in paise) all users must pay. */
export const adminSetWeeklyPrice = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { rupees: number })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const rupees = Number(data.rupees);
    if (!Number.isFinite(rupees) || rupees < 1 || rupees > 100000) {
      throw new Error("Enter a weekly price between ₹1 and ₹1,00,000.");
    }
    const paise = Math.round(rupees * 100);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ weekly_price_paise: paise, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(`Could not update price: ${error.message}`);
    return { weeklyPricePaise: paise };
  });

/** Blocks or unblocks a user regardless of their plan. */
export const adminSetBlocked = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { userId: string; blocked: boolean })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const targetId = String(data.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new Error("Invalid user.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: targetId,
        blocked: Boolean(data.blocked),
        status: data.blocked ? "blocked" : "inactive",
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(`Could not update user: ${error.message}`);
    return { ok: true };
  });

/** Manually grants (or removes) weeks of access — useful for verified users. */
export const adminAdjustAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { userId: string; weeks: number })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const targetId = String(data.userId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new Error("Invalid user.");
    const weeks = Number(data.weeks);
    if (!Number.isFinite(weeks) || weeks < -52 || weeks > 52) throw new Error("Invalid week count.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", targetId)
      .maybeSingle();
    const existing = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
    const base = existing && existing.getTime() > Date.now() ? existing : new Date();
    const end = new Date(base.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    const active = end.getTime() > Date.now();

    const { error } = await supabaseAdmin.from("subscriptions").upsert({
      user_id: targetId,
      current_period_end: end.toISOString(),
      status: active ? "active" : "inactive",
      blocked: false,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Could not update access: ${error.message}`);
    return { currentPeriodEnd: end.toISOString() };
  });
