"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
      } else if (data.session) {
        // Email confirmation is disabled — user is signed in immediately.
        router.push("/");
        router.refresh();
      } else {
        // Email confirmation is enabled — ask the user to check their inbox.
        setSignedUp(true);
        setLoading(false);
      }
    }
  }

  if (signedUp) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 w-full max-w-sm text-center space-y-4">
          <span className="text-4xl">📬</span>
          <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
          </p>
          <button
            onClick={() => { setSignedUp(false); setMode("signin"); }}
            className="text-sm text-blue-600 font-medium underline underline-offset-2"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-1">
          <span className="text-4xl">☕</span>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kape</h1>
          <p className="text-sm text-gray-500">
            {mode === "signin" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@kapeshop.com"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {mode === "signup" && (
              <p className="text-xs text-gray-400 mt-1">At least 6 characters.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Spinner />}
            {loading
              ? mode === "signin" ? "Signing in…" : "Creating account…"
              : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          {mode === "signin" ? (
            <>
              Wala pang account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-blue-600 font-medium hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Mayroon nang account?{" "}
              <button
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-blue-600 font-medium hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
