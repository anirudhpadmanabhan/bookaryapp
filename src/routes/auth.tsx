import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BookMarked } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";

const authSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: "Sign in · Bookary" }, { name: "description", content: "Sign in to rent and save Malayalam books." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Send the user back to where they came from (defaults to home).
  const dest = redirect && redirect !== "/auth" ? redirect : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: dest, replace: true });
  }, [user, loading, navigate, dest]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name || email.split("@")[0] }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to Bookary!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      navigate({ to: dest, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    // Build absolute redirect URL so the OAuth provider returns the user to the right page.
    const target = new URL(dest, window.location.origin).toString();
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: target });
    if (result.error) { toast.error("Google sign-in failed"); setBusy(false); return; }
    if (result.redirected) return;
    navigate({ to: dest, replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#4c1d95] p-12 text-white lg:flex">
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <BookMarked className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight">BOOKARY</div>
            <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Malayalam Portal</div>
          </div>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">
            <span className="font-mal text-accent">വായന</span> never ends.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Sign in to rent volumes for 30 days, save the books you love, and keep a diary of your reading journey.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© Bookary — A reading sanctuary.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Create a free reader account to start renting." : "Sign in to continue reading."}
            {redirect && redirect !== "/" && (
              <span className="ml-1 text-xs text-primary">You'll return to {redirect} after signing in.</span>
            )}
          </p>

          <button onClick={google} disabled={busy} className="mt-6 flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:bg-surface-elevated disabled:opacity-50">
            <GoogleIcon /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Password" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={busy} className="w-full cursor-pointer rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Bookary?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="cursor-pointer font-medium text-primary hover:underline">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.3 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.5 6.7 28.9 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1.1 7.3 2.8l5.7-5.7C33.5 6.7 28.9 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 43c5.2 0 9.8-2 13.3-5.2l-6.1-5c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-2.7-11.3-7l-6.5 5C9.6 38.7 16.2 43 24 43z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.1 5C40.8 36 43 30.5 43 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
  );
}
