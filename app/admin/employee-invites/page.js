"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, UserPlus, Copy, XCircle, Check } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

function inviteStatus(invite) {
  if (invite.used_at) return "used";
  if (new Date(invite.expires_at) < new Date()) return "expired";
  return "pending";
}

const STATUS_LABELS = { pending: "Pending", used: "Used", expired: "Expired" };
const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  used: "bg-green-100 text-green-800 border-green-300",
  expired: "bg-gray-100 text-gray-600 border-gray-300",
};

export default function EmployeeInvitesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newLink, setNewLink] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  async function loadInvites() {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/employee-invites", { headers });
    if (!res.ok) {
      setError("Couldn't load employee invites.");
      return;
    }
    const json = await res.json();
    setInvites(json.invites || []);
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", sessionData.session.user.id)
        .single();

      if (!myProfile?.is_admin) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      await loadInvites();
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
    const res = await fetch("/api/admin/employee-invites", {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    setCreating(false);

    if (!res.ok) {
      setCreateError(json.error || "Couldn't create the invite.");
      return;
    }

    const link = `${window.location.origin}/employee-signup?invite=${json.invite.token}`;
    setNewLink(link);
    setEmail("");
    await loadInvites();
  }

  async function revokeInvite(id) {
    const confirmed = window.confirm("Revoke this invite? The link will stop working immediately.");
    if (!confirmed) return;
    setRevokingId(id);
    const headers = await authHeaders();
    const res = await fetch("/api/admin/employee-invites/" + id, { method: "DELETE", headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Couldn't revoke that invite.");
    } else {
      await loadInvites();
    }
    setRevokingId(null);
  }

  async function copyLink(invite) {
    const link = `${window.location.origin}/employee-signup?invite=${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
  }

  if (loading) return <div className="p-8 text-steelgray">Loading employee invites...</div>;
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Shield className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">EMPLOYEE INVITES</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">
                Admin-Only Sign-Up Links
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
          >
            <ArrowLeft size={14} /> Back to Admin
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-4">
        <div className="bg-white border border-gray-300 rounded-sm p-4 text-sm text-steelgray">
          Nobody can sign up as an employee/admin without a link generated here. Each link works once,
          only for the email address it was made for, and stops working after 7 days if it's not used.
          Nothing is emailed automatically — copy the link and send it to the new hire yourself, however
          you'd like.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-xs rounded-sm p-3">{error}</div>
        )}

        <div className="bg-white border border-gray-300 rounded-sm p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide font-mono text-gray-400 flex items-center gap-1.5">
            <UserPlus size={13} /> Invite a New Employee
          </p>
          <form onSubmit={createInvite} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">
                New hire's email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jenny@example.com"
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-asphalt hover:bg-black text-white text-sm font-semibold px-4 py-2 rounded-sm disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Invite Link"}
            </button>
          </form>
          {createError && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-xs rounded-sm p-2">
              {createError}
            </div>
          )}
          {newLink && (
            <div className="bg-green-50 border border-green-300 text-green-800 text-xs rounded-sm p-3 space-y-2">
              <p className="font-semibold">Invite created. Copy this link and send it to the new hire:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-green-300 rounded-sm px-2 py-1.5 text-[11px] break-all">
                  {newLink}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(newLink)}
                  className="flex items-center gap-1 bg-green-700 hover:bg-green-800 text-white text-xs px-2 py-1.5 rounded-sm"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <p>This link expires in 7 days and can only be used once.</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-300 rounded-sm divide-y divide-gray-200">
          {invites.length === 0 && (
            <p className="p-4 text-sm text-steelgray">No employee invites yet.</p>
          )}
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <div key={invite.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-asphalt">{invite.email}</p>
                  <p className="text-[11px] text-gray-400">
                    Created {new Date(invite.created_at).toLocaleDateString()} &middot; Expires{" "}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] uppercase tracking-wide font-mono border rounded-sm px-2 py-1 ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  {status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyLink(invite)}
                        className="flex items-center gap-1 text-xs border border-gray-300 rounded-sm px-2 py-1 text-steelgray hover:bg-gray-50"
                      >
                        {copiedId === invite.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === invite.id ? "Copied" : "Copy Link"}
                      </button>
                      <button
                        type="button"
                        disabled={revokingId === invite.id}
                        onClick={() => revokeInvite(invite.id)}
                        className="flex items-center gap-1 text-xs border border-red-300 text-red-700 rounded-sm px-2 py-1 hover:bg-red-50 disabled:opacity-50"
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
      </main>
    </div>
  );
}
