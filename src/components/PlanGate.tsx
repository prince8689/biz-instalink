import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { confirmWeeklyPayment, createWeeklyOrder } from "@/lib/billing.functions";
import { useAccount } from "@/hooks/useAccount";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window."));
    document.body.appendChild(script);
  });
}

export function formatMoney(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(paise / 100);
}

/** Shows plan status and the weekly Razorpay payment button. */
export function PlanGate() {
  const { data: account } = useAccount();
  const queryClient = useQueryClient();
  const startOrder = useServerFn(createWeeklyOrder);
  const confirmPayment = useServerFn(confirmWeeklyPayment);
  const [busy, setBusy] = useState(false);

  if (!account || account.isAdmin) return null;

  const expires = account.currentPeriodEnd ? new Date(account.currentPeriodEnd) : null;

  const pay = async () => {
    setBusy(true);
    try {
      await loadCheckout();
      const order = await startOrder({});
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "LeadRadar AI",
        description: "Weekly access",
        prefill: { email: account.email ?? "", name: account.fullName ?? "" },
        theme: { color: "#0f766e" },
        handler: (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          confirmPayment({
            data: {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            },
          })
            .then(() => {
              toast.success("Payment confirmed — your week of access is active.");
              queryClient.invalidateQueries({ queryKey: ["account"] });
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : "Payment verification failed."),
            )
            .finally(() => setBusy(false));
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not start the payment.");
    }
  };

  const price = formatMoney(account.weeklyPricePaise, account.currency);

  if (account.blocked) {
    return (
      <section className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Access blocked</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account has been blocked by the admin. Please contact support to restore access.
        </p>
      </section>
    );
  }

  if (account.active) {
    return (
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <p className="text-sm text-foreground">
          <span className="font-semibold text-primary">Plan active</span>
          {expires && ` · renews / expires ${expires.toLocaleString()}`}
        </p>
        <button
          onClick={pay}
          disabled={busy || !account.paymentsConfigured}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
        >
          {busy ? "Processing..." : `Extend one week · ${price}`}
        </button>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Activate your weekly plan
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Searching is unlocked for 7 days after payment. Weekly price set by the admin:{" "}
        <span className="font-semibold text-foreground">{price}</span>.
        {expires && ` Your last plan ended ${expires.toLocaleString()}.`}
      </p>
      <button
        onClick={pay}
        disabled={busy || !account.paymentsConfigured}
        className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Processing..." : `Pay ${price} for one week`}
      </button>
      {!account.paymentsConfigured && (
        <p className="mt-2 text-xs text-destructive">Payments are not configured yet.</p>
      )}
    </section>
  );
}
