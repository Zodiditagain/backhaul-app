"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { logAuditEvent } from "../../lib/auditLog";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (userData?.user) {
      await logAuditEvent({
        actorId: userData.user.id,
        actorRole: null,
        companyName: null,
        eventType: "security",
        action: "Password Reset Completed",
        status: "success",
      });
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rotate-45 bg-blue-600 flex items-center justify-center rounded-md">
          <Truck className="-rotate-45" size={22} color="#ffffff" />
        </div>
        <div className="text-left">
          <p className="text-white font-bold tracking-wide leading-tight">BACKHAUL</p>
          <p className="text-blue-400 text-xs tracking-widest">NETWORK</p>
        </div>
      </div>

      {!ready && !done && (
        <p className="text-gray-400 text-sm">Verifying your reset link...</p>
      )}

      {ready && !done && (
        <form onSubmit={handleSubmit} className="w-full max-w-sm text-left">
          <h1 className="text-2xl font-bold text-white mb-1 text-center">Set a new password</h1>
          <p className="text-gray-300 text-sm mb-6 text-center">
            Choose a new password for your account.
          </p>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">New Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Confirm Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-sm px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Update Password"}
          </button>
        </form>
      )}

      {done && (
        <p className="text-highway text-sm">Password updated. Redirecting you to your dashboard...</p>
      )}
    </div>
  );
}
