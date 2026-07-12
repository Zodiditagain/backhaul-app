"use client";

import { useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("trucker");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: data.user.id, role, company_name: companyName });
      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-gray-300 text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and log in.
          </p>
          <Link href="/login" className="inline-block mt-4 text-blue-400 underline text-sm">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center px-6 py-10 text-center overflow-hidden">
      {/* Background photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1600&q=70')",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/85" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full">
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
          <h1 className="text-2xl font-bold text-white mb-1 text-center">Create an account</h1>
          <p className="text-gray-300 text-sm mb-6 text-center">
            Join the network connecting carriers, brokers, and vendors.
          </p>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">I am a...</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { id: "trucker", label: "Trucking Co." },
              { id: "broker", label: "Broker" },
              { id: "vendor", label: "Vendor" },
            ].map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`text-xs py-2 rounded-sm border transition ${
                  role === r.id
                    ? "bg-blue-600 border-blue-600 text-white font-semibold"
                    : "border-slate-700 text-gray-300 bg-slate-900/60"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Company name</label>
          <input
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />

          {role !== "trucker" && (
            <p className="text-xs text-gray-400 mb-3 italic">
              Broker/vendor accounts will need a subscription to unlock full access once billing is added.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>

          <p className="text-sm text-gray-400 mt-4 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
