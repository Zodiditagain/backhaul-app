"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings as SettingsIcon, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

// Broker/vendor equivalent of the trucker-facing /settings page — same two
// sections (read-only account info, in-app password change via
// supabase.auth.updateUser), just styled to match the rest of app/broker/*
// (standalone dark slate-950 page with a "Back to Dashboard" link) rather
// than the newer light Sidebar shell, since that shell is only wired up on
// /dashboard and /messages so far. No subscription gate here, unlike
// Referrals/Analytics — every broker/vendor account should be able to
// change its own password regardless of Partner Pro status.
export default function BrokerSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_name, role, created_at")
        .eq("id", currentUser.id)
        .single();
      if (profileData?.role === "trucker") {
        router.push("/dashboard");
        return;
      }
      setProfile(profileData);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 4000);
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your settings...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={22} className="text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-md p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-cyan-400" />
            <h2 className="font-bold text-white text-sm">Account</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-400">Email</dt>
              <dd className="text-white font-medium">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-400">Company name</dt>
              <dd className="text-white font-medium">{profile.company_name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-400">Account type</dt>
              <dd className="text-white font-medium capitalize">{profile.role}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-400">Member since</dt>
              <dd className="text-white font-medium">
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-500 mt-4">
            To update your company name or business details, use{" "}
            <Link href="/onboarding-partner" className="text-cyan-400 hover:text-cyan-300 underline">
              Edit Profile
            </Link>
            .
          </p>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} className="text-cyan-400" />
            <h2 className="font-bold text-white text-sm">Change password</h2>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            {passwordError && (
              <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-md p-3">
                {passwordError}
              </div>
            )}
            {passwordSaved && (
              <div className="bg-green-950/40 border border-green-800 text-green-300 text-sm rounded-md p-3">
                Password updated.
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-md uppercase tracking-wide"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
