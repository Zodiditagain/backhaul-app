"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center px-6 py-10 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
          <Truck className="-rotate-45" size={22} color="#ffffff" />
        </div>
        <div className="text-left">
          <p className="text-white font-bold tracking-wide leading-tight">BACKHAUL</p>
          <p className="text-blue-400 text-xs tracking-widest">NETWORK</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm text-left">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">Welcome back</h1>
        <p className="text-gray-300 text-sm mb-6 text-center">
          Log in to access your matches and network.
        </p>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
        />

        <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-sm text-gray-400 mt-4 text-center">
          No account?{" "}
          <Link href="/signup" className="text-blue-400 underline">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
