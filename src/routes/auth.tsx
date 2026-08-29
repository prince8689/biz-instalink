import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create an account — LeadRadar AI" },
      {
        name: "description",
        content:
          "Sign in to LeadRadar AI to search verified local business leads with phone and Instagram verification.",
      },
      { property: "og:title", content: "Sign in — LeadRadar AI" },
      {
        property: "og:description",
        content: "Access your verified business lead dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), phone: phone.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BrandMark />
          </span>
          <span className="font-display text-2xl font-bold text-foreground">
            LeadRadar <span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {checkEmail ? (
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Confirm your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click it, then come back
                and sign in.
              </p>
              <button
                onClick={() => {
                  setCheckEmail(false);
                  setMode("signin");
                }}
                className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold text-foreground">
                {mode === "signin" ? "Sign in" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Access your lead dashboard."
                  : "Register, then activate your weekly plan to start searching."}
              </p>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "signup" && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Full name</span>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        maxLength={100}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Phone (optional)</span>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={20}
                        className={inputClass}
                      />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={72}
                    className={inputClass}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-4 text-sm text-primary underline-offset-2 hover:underline"
              >
                {mode === "signin"
                  ? "New here? Create an account"
                  : "Already registered? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
