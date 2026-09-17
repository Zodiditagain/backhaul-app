"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Copy, XCircle, Check, Trash2, Loader2 } from "lucide-react";
import { supabase, authHeaders } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";

function inviteStatus(invite) {
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  return "pending";
}

const STATUS_LABELS = { pending: "Pending", used: "Used", expired: "Expired" };
const STATUS_COLORS = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  used: "bg-green-500/15 text-green-300 border-green-500/40",
  expired: "bg-slate-700/40 text-slate-400 border-slate-600",
};

export default function DriversPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");

  const [driverFullName, setDriverFullName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newLink, setNewLink] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  async function loadAll() {
    const headers = await authHeaders();
    const [driversRes, invitesRes] = await Promise.all([
      fetch("/api/drivers", { headers }),
      fetch("/api/driver-invites", { headers }),
    ]);
    if (!driversRes.ok || !invitesRes.ok) {
      setError("Couldn't load your drivers.");
      return;
    }
    const driversJson = await driversRes.json();
    const invitesJson = await invitesRes.json();
    setDrivers(driversJson.drivers || []);
    setInvites(invitesJson.invites || []);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_name, role, is_admin")
        .eq("id", user.id)
        .single();

      if (profileData?.role !== "trucker") {
        router.replace("/dashboard");
        return;
      }
      setUser(user);
      setProfile(profileData);
      await loadAll();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function createInvite(e) {
    e.preventDefault();
    setCreateError("");
    setNewLink("");
    setCreating(true);

    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/driver-invites", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, driverFullName }),
    });
    const json = await res.json().catch(() => ({}));
    setCreating(false);

    if (!res.ok) {
      setCreateError(json.error || "Couldn't create the invite.");
      return;
    }

    const link = `${window.location.origin}/driver-signup?invite=${json.invite.token}`;
    setNewLink(link);
    setEmail("");
    setDriverFullName("");
    await loadAll();
  }

  async function revokeInvite(id) {
    const confirmed = window.confirm("Revoke this invite? The link will stop working immediately.");
    if (!confirmed) return;
    setRevokingId(id);
    const headers = await authHeaders();
    const res = await fetch("/api/driver-invites/" + id, { method: "DELETE", headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Couldn't revoke that invite.");
    } else {
      await loadAll();
    }
    setRevokingId(null);
  }

  async function removeDriver(driver) {
    const confirmed = window.confirm(
      `Remove ${driver.driver_full_name || "this driver"}'s account? They'll no longer be able to log in. This can't be undone.`
    );
    if (!confirmed) return;
    setRemovingId(driver.id);
    const headers = await authHeaders();
    const res = await fetch("/api/drivers/" + driver.id, { method: "DELETE", headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Couldn't remove that driver.");
    } else {
      await loadAll();
    }
    setRemovingId(null);
  }

  async function copyLink(invite) {
    const link = `${window.location.origin}/driver-signup?invite=${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading your drivers...</p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="Drivers">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Drivers</h1>
        </div>
        <p className="text-xs text-gray-500">
          Give each driver their own login instead of sharing your company password. Driver accounts are
          for identification only — they don&apos;t have access to your matches, messages, or brokers/
          vendors. That stays exclusively on this account.
        </p>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-md p-3">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <UserPlus size={13} /> Invite a Driver
          </p>
          <form onSubmit={createInvite} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Driver&apos;s name</label>
              <input
                required
                value={driverFullName}
                onChange={(e) => setDriverFullName(e.target.value)}
                placeholder="John Rivera"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Their email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md whitespace-nowrap"
            >
              {creating ? "Creating..." : "Create Invite"}
            </button>
          </form>
          {createError && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-md p-2">
              {createError}
            </div>
          )}
          {newLink && (
            <div className="bg-green-950/30 border border-green-800 text-green-300 text-xs rounded-md p-3 space-y-2">
              <p className="font-semibold">Invite created. Copy this link and send it to your driver:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-950 border border-green-800 rounded-md px-2 py-1.5 text-[11px] break-all text-green-200">
                  {newLink}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newLink)}
                  className="flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1.5 rounded-md"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <p>This link expires in 7 days and can only be used once.</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Active Drivers</p>
          <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
            {drivers.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No drivers signed up yet.</p>
            )}
            {drivers.map((driver) => (
              <div key={driver.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{driver.driver_full_name}</p>
                  <p className="text-[11px] text-gray-500">
                    Joined {new Date(driver.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {driver.currentTruck ? (
                      <>
                        Currently running: {driver.currentTruck.profile_name}
                        {driver.currentTruck.truck_number && ` — Truck #${driver.currentTruck.truck_number}`}
                        {driver.currentTruck.trailer_number && ` / Trailer #${driver.currentTruck.trailer_number}`}
                      </>
                    ) : (
                      <span className="text-gray-600">Not currently assigned to a truck</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removingId === driver.id}
                  onClick={() => removeDriver(driver)}
                  className="flex items-center gap-1 text-xs border border-red-800 text-red-300 rounded-md px-2 py-1.5 hover:bg-red-950/40 disabled:opacity-50"
                >
                  {removingId === driver.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  {removingId === driver.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Invite History</p>
          <div className="bg-slate-900 border border-slate-800 rounded-lg divide-y divide-slate-800">
            {invites.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No invites sent yet.</p>
            )}
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div key={invite.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-white">{invite.driver_full_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {invite.email} &middot; Created {new Date(invite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-1 ${STATUS_COLORS[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                    {status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyLink(invite)}
                          className="flex items-center gap-1 text-xs border border-slate-700 rounded-md px-2 py-1 text-gray-300 hover:bg-white/5"
                        >
                          {copiedId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === invite.id ? "Copied" : "Copy Link"}
                        </button>
                        <button
                          type="button"
                          disabled={revokingId === invite.id}
                          onClick={() => revokeInvite(invite.id)}
                          className="flex items-center gap-1 text-xs border border-red-800 text-red-300 rounded-md px-2 py-1 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          <XCircle size={12} /> {revokingId === invite.id ? "Revoking..." : "Revoke"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TruckerSidebar>
  );
}
