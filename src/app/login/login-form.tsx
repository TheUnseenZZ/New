"use client";

import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/ui/logo";

function Inner({ hint }: { hint?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } else {
      setLoading(false);
      setError("Incorrect password");
      setShake((s) => s + 1);
    }
  };

  return (
    <main className="grain relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-30%] left-1/2 h-[80%] w-[80%] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.06), transparent)", animation: "drift 20s ease-in-out infinite" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <Logo />
        <h1 className="mt-10 font-serif text-[42px] leading-none">Welcome back.</h1>
        <p className="mt-3 text-sm text-dim">Sign in to build and manage your qualification funnels.</p>
        <motion.form
          key={shake}
          animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
          transition={{ duration: 0.4 }}
          onSubmit={submit}
          className="mt-8 space-y-3"
        >
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input h-11 text-sm"
          />
          <button type="submit" disabled={!password || loading} className="btn-primary h-11 w-full text-sm">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continue <ArrowRight className="size-4" /></>}
          </button>
          <p className="h-5 text-center text-[13px] text-bad">{error}</p>
        </motion.form>
        {hint ? <p className="text-center text-xs text-faint">{hint}</p> : null}
      </motion.div>
    </main>
  );
}

export function LoginForm({ hint }: { hint?: string }) {
  return (
    <Suspense>
      <Inner hint={hint} />
    </Suspense>
  );
}
