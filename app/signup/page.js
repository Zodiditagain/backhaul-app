"use client";

import { useState } from "react";
import Link from "next/link";
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
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-steelgray text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and log in.
          </p>
          <Link href="/login" className="inline-block mt-4 text-highway underline text-sm">Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-300 rounded-sm p-6">
        <h1 className="text-2xl font-bold mb-4">Create an account</h1>
        {error && <p className="text-alertred text-sm mb-3">{error}</p>}

        <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">I am a...</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "trucker", label: "Trucking Co." },
            { id: "broker", label: "Broker" },
            { id: "vendor", label: "Vendor" },
          ].map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`text-xs py-2 rounded-sm border ${role === r.id ? "bg-amberx border-amberx text-asphalt font-semibold" : "border-gray-300 text-steelgray"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Company name</label>
        <input
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-3 py-2 mb-3 text-sm"
        />

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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-sm px-3 py-2 mb-4 text-sm"
        />

        {role !== "trucker" && (
          <p className="text-xs text-steelgray mb-3 italic">
            Broker/vendor accounts will need a subscription to unlock full access once billing is added.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-asphalt text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide hover:bg-steelgray disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <p className="text-sm text-steelgray mt-4">
          Already have an account? <Link href="/login" className="text-highway underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
