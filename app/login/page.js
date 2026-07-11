"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-300 rounded-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Log in</h1>
        {error && <p className="text-alertred text-sm mb-3">{error}</p>}
        <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-3 py-2 mb-3 text-sm"
        />
        <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-3 py-2 mb-4 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-asphalt text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide hover:bg-steelgray disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p className="text-sm text-steelgray mt-4">
          No account? <Link href="/signup" className="text-highway underline">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
