"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Truck, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function EmployeeSignup() {
  return (
    <Suspense fallback={null}>
      <EmployeeSignupForm />
    </Suspense>
  );
}

// useSearchParams() only works inside a Suspense boundary during Next's
// static prerendering — see app/signup/page.js for the same split and why
// it's needed for a clean `next build`.
function EmployeeSignupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("invite") || "";

  const [checking, setChecking] = useState(true);
  const [validationError, setValidationError] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function checkInvite() {
      if (!token) {
        setValidationError("This link is missing an invite code. Ask your admin for the correct link.");
        setChecking(false);
        return;
      }
      try {
        const res = await fetch(`/api/employee-invite/validate?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!data.valid) {
          setValidationError(data.reason || "This invite link isn't valid.");
        } else {
          setEmail(data.email);
        }
      } catch {
        setValidationError("Couldn't check this invite link right now. Try again in a moment.");
      }
      setChecking(false);
    }
    checkInvite();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (!data.user) {
      setError("Something went wrong creating your account.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/employee-invite/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, userId: data.user.id }),
    });
    const result = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(result.error || "Something went wrong finishing your account setup.");
      return;
    }
    setDone(true);
  }

  const shell = (children) => (
    <div className="min-h-screen relative flex flex-col items-center px-6 py-10 text-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1600&q=70')",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/85" />
      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
            <Truck className="-rotate-45" size={22} color="#ffffff" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold tracking-wide leading-tight">BACKHAUL</p>
            <p className="text-blue-400 text-xs tracking-widest">NETWORK</p>
          </div>
        </div>
        <div className="w-full max-w-sm text-left">{children}</div>
      </div>
    </div>
  );

  if (checking) {
    return shell(<p className="text-gray-300 text-sm text-center">Checking your invite link...</p>);
  }

  if (validationError) {
    return shell(
      <div className="text-center">
        <h1 className="text-xl font-bold text-white mb-2">This invite isn't valid</h1>
        <p className="text-gray-300 text-sm">{validationError}</p>
        <Link href="/login" className="inline-block mt-4 text-blue-400 underline text-sm">
          Go to login
        </Link>
      </div>
    );
  }

  if (done) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-gray-300 text-sm">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and log in — your
          account already has admin access set up.
        </p>
        <Link href="/login" className="inline-block mt-4 text-blue-400 underline text-sm">
          Go to login
        </Link>
      </div>
    );
  }

  return shell(
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-center gap-1.5 mb-3 text-amber-400 text-xs font-semibold uppercase tracking-wide">
        <ShieldCheck size={14} />
        Private employee sign-up
      </div>
      <h1 className="text-2xl font-bold text-white mb-1 text-center">Create your account</h1>
      <p className="text-gray-300 text-sm mb-6 text-center">
        This link was sent to you directly by a Backhaul admin. Set a password to finish setting up your
        account.
      </p>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Email</label>
      <input
        type="email"
        value={email}
        disabled
        className="w-full bg-slate-900/40 border border-slate-800 rounded-sm px-3 py-2 mb-4 text-sm text-gray-400 cursor-not-allowed"
      />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Password</label>
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Create password"
        className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
      />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Confirm password</label>
      <input
        type="password"
        required
        minLength={6}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create employee account"}
      </button>
    </form>
  );
}
