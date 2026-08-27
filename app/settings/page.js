"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

export default function SettingsPage() {
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
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_name, role, is_admin, created_at")
        .eq("id", currentUser.id)
        .single();
      setProfile(profileData);

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your settings...
        </p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon size={20} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Settings</h2>
        </div>

        <section className="bg-[#111827] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">Account</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Email</dt>
              <dd className="text-white font-medium">{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Company name</dt>
              <dd className="text-white font-medium">{profile.company_name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Account type</dt>
              <dd className="text-white font-medium capitalize">{profile.role}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Member since</dt>
              <dd className="text-white font-medium">
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500 mt-4">
            To update your company name or business details, use{" "}
            <a href="/carrier-profile" className="text-blue-400 hover:text-blue-300 underline">
              Carrier Profile
            </a>
            .
          </p>
        </section>

        <section className="bg-[#111827] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} className="text-blue-400" />
            <h3 className="font-bold text-white text-sm">Change password</h3>
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
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0b1220] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-md uppercase tracking-wide"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      </div>
    </TruckerSidebar>
  );
}
