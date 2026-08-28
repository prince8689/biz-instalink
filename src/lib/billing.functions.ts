import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AccountState {
  userId: string;
  email: string | null;
  fullName: string | null;
  isAdmin: boolean;
  active: boolean;
  blocked: boolean;
  currentPeriodEnd: string | null;
  weeklyPricePaise: number;
  currency: string;
  paymentsConfigured: boolean;
}

/** Everything the app needs to decide what the signed-in user may do. */
export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountState> => {
    const { supabase, userId, claims } = context;
    const { getAccessState } = await import("./leadfinder/access.server");
    const access = await getAccessState(supabase, userId);

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
      supabase.from("app_settings").select("weekly_price_paise, currency").maybeSingle(),
    ]);

    return {
      userId,
      email: (profile?.email as string | null) ?? (claims?.email as string | undefined) ?? null,
      fullName: (profile?.full_name as string | null) ?? null,
      isAdmin: access.isAdmin,
      active: access.active,
      blocked: access.blocked,
      currentPeriodEnd: access.currentPeriodEnd,
      weeklyPricePaise: (settings?.weekly_price_paise as number | undefined) ?? 1000,
      currency: (settings?.currency as string | undefined) ?? "INR",
      paymentsConfigured: Boolean(
        process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"],
      ),
    };
  });

/** Creates a Razorpay order for one week of access. */
export const createWeeklyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { createRazorpayOrder, getPublicKeyId } = await import("./razorpay.server");

    const { data: settings } = await supabase
      .from("app_settings")
      .select("weekly_price_paise, currency")
      .maybeSingle();
    const amount = Number(settings?.weekly_price_paise ?? 1000);
    const currency = String(settings?.currency ?? "INR");
    if (!Number.isFinite(amount) || amount < 100) {
      throw new Error("The weekly price is not configured correctly. Please contact the admin.");
    }

    const order = await createRazorpayOrder(amount, currency, { user_id: userId });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      razorpay_order_id: order.id,
      amount_paise: amount,
      currency,
      status: "created",
    });

    return {
      orderId: order.id,
      amount,
      currency,
      keyId: getPublicKeyId(),
    };
  });

/** Verifies a completed checkout and extends access by 7 days. */
export const confirmWeeklyPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (data) => data as { orderId: string; paymentId: string; signature: string },
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const orderId = String(data.orderId ?? "").trim().slice(0, 120);
    const paymentId = String(data.paymentId ?? "").trim().slice(0, 120);
    const signature = String(data.signature ?? "").trim().slice(0, 200);
    if (!orderId || !paymentId || !signature) {
      throw new Error("Incomplete payment details.");
    }

    const { verifyRazorpaySignature } = await import("./razorpay.server");
    const valid = await verifyRazorpaySignature(orderId, paymentId, signature);
    if (!valid) throw new Error("Payment could not be verified.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The order must belong to this user and must not already be paid.
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();
    if (!payment || payment.user_id !== userId) {
      throw new Error("This payment does not belong to your account.");
    }
    if (payment.status === "paid") {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", userId)
        .maybeSingle();
      return { currentPeriodEnd: (sub?.current_period_end as string | null) ?? null };
    }

    await supabaseAdmin
      .from("payments")
      .update({ razorpay_payment_id: paymentId, status: "paid" })
      .eq("id", payment.id);

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const existing = sub?.current_period_end ? new Date(sub.current_period_end as string) : null;
    const base = existing && existing.getTime() > Date.now() ? existing : new Date();
    const end = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);

    await supabaseAdmin.from("subscriptions").upsert({
      user_id: userId,
      status: "active",
      current_period_end: end.toISOString(),
      blocked: false,
      updated_at: new Date().toISOString(),
    });

    return { currentPeriodEnd: end.toISOString() };
  });
