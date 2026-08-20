"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Mail, Send, XCircle, Upload, ExternalLink } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

const ROLE_LABELS = { trucker: "Trucker", broker: "Broker", vendor: "Vendor" };

const STATUS_COLORS = {
  new: "bg-amber-100 text-amber-800 border-amber-300",
  rejected: "bg-gray-100 text-gray-600 border-gray-300",
  sent: "bg-green-100 text-green-800 border-green-300",
};

function statusLabel(s) {
  if (s === "new") return "Pending Review";
  if (s === "rejected") return "Rejected";
  if (s === "sent") return "Sent";
  return s;
}

export default function AdminRecruitingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [leads, setLeads] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  const [roleFilter, setRoleFilter] = useState("all");

  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  async function loadLeads() {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/recruiting", { headers });
    if (!res.ok) {
      setError("Couldn't load recruiting leads.");
      return;
    }
    const json = await res.json();
    setLeads(json.leads || []);
    const nextDrafts = {};
    (json.leads || []).forEach((l) => {
      nextDrafts[l.id] = { email_subject: l.email_subject, email_body: l.email_body };
    });
    setDrafts(nextDrafts);
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
      await loadLeads();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function updateDraft(id, field, value) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function submitImport() {
    setImportBusy(true);
    setImportError("");
    setImportSuccess("");
    let payload;
    try {
      payload = JSON.parse(importText);
    } catch (e) {
      setImportError("That's not valid JSON. Paste the exact block from the Recruiting AI's report.");
      setImportBusy(false);
      return;
    }
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/admin/recruiting/import", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportError(json.error || "Import failed. Check the JSON and try again.");
      setImportBusy(false);
      return;
    }
    setImportSuccess(
      "Imported " + json.submitted + " lead(s). Skipped " + json.skipped_duplicate +
      " duplicate(s), rejected " + json.rejected_invalid + " invalid."
    );
    setImportText("");
    await loadLeads();
    setImportBusy(false);
  }

  async function saveLead(id) {
    setBusyId(id);
    setError("");
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const draft = drafts[id] || {};
    const res = await fetch("/api/admin/recruiting/" + id, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "save", email_subject: draft.email_subject, email_body: draft.email_body }),
    });
    if (!res.ok) {
      setError("That update failed. Try again.");
    } else {
      await loadLeads();
    }
    setBusyId(null);
  }

  async function rejectLead(id) {
    setBusyId(id);
    setError("");
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/admin/recruiting/" + id, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action: "reject" }),
    });
    if (!res.ok) {
      setError("That action failed. Try again.");
    } else {
      await loadLeads();
    }
    setBusyId(null);
  }

  async function sendLead(id) {
    setBusyId(id);
    setError("");
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/admin/recruiting/" + id + "/send", {
      method: "POST",
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Send failed. Try again.");
    } else {
      await loadLeads();
    }
    setBusyId(null);
  }

  if (loading) return <div className="p-8 text-steelgray">Loading recruiting leads...</div>;
  if (!authorized) return null;

  const filteredLeads = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (roleFilter !== "all" && l.role_target !== roleFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Shield className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">RECRUITING</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">
                Recruiting AI Drafts
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
          Nothing here is ever emailed automatically. The Recruiting AI drafts short outreach
          emails to real companies it finds through web research, and every draft sits here until
          you edit, reject, or click Send yourself.
        </div>

        <div className="bg-white border border-gray-300 rounded-sm p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wide font-mono text-gray-400 flex items-center gap-1.5">
            <Upload size={13} /> Import Recruiting AI Leads
          </p>
          <p className="text-xs text-steelgray">
            The Recruiting AI can&apos;t reach this site directly from its own environment, so it
            prints its finished leads as a JSON block ({"{"}&quot;leads&quot;: [...]{"}"}) in its
            weekly report instead. Paste that block here and submit it.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"leads": [{"role_target": "...", "company_name": "...", "contact_email": "...", "source_url": "...", "email_subject": "...", "email_body": "..."}]}'
            rows={4}
            className="w-full border border-gray-300 rounded-sm px-3 py-2 text-xs font-mono"
          />
          {importError && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-xs rounded-sm p-2">
              {importError}
            </div>
          )}
          {importSuccess && (
            <div className="bg-green-50 border border-green-300 text-green-700 text-xs rounded-sm p-2">
              {importSuccess}
            </div>
          )}
          <button
            onClick={submitImport}
            disabled={importBusy || !importText.trim()}
            className="text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-asphalt text-white hover:bg-black disabled:opacity-50"
          >
            {importBusy ? "Importing..." : "Import Leads"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-sm p-3">{error}</div>
        )}

        <div className="bg-white border border-gray-300 rounded-sm p-4 flex flex-wrap gap-4">
          <div>
            <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
            >
              <option value="all">All</option>
              <option value="new">Pending Review</option>
              <option value="rejected">Rejected</option>
              <option value="sent">Sent</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
            >
              <option value="all">All</option>
              <option value="trucker">Trucker</option>
              <option value="broker">Broker</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        </div>

        {filteredLeads.length === 0 && (
          <div className="bg-white border border-gray-300 rounded-sm p-6 text-center text-sm text-gray-500">
            No recruiting leads match this filter.
          </div>
        )}

        {filteredLeads.map((l) => {
          const draft = drafts[l.id] || { email_subject: l.email_subject, email_body: l.email_body };
          const editable = l.status === "new";
          return (
            <div key={l.id} className="bg-white border border-gray-300 rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-alertred" />
                  <span className="font-semibold text-sm">{l.company_name}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wide border rounded-sm px-2 py-0.5 bg-gray-100 text-gray-600 border-gray-300">
                    {ROLE_LABELS[l.role_target] || l.role_target}
                  </span>
                  <span
                    className={
                      "text-[10px] font-mono uppercase tracking-wide border rounded-sm px-2 py-0.5 " +
                      (STATUS_COLORS[l.status] || STATUS_COLORS.new)
                    }
                  >
                    {statusLabel(l.status)}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-steelgray">
                <p>
                  <span className="text-gray-400">Contact: </span>
                  {l.contact_name ? l.contact_name + " — " : ""}
                  {l.contact_email}
                </p>
                <p>
                  <span className="text-gray-400">Source: </span>
                  {l.source || "—"}
                </p>
              </div>

              {l.source_url && (
                <button
                  type="button"
                  onClick={() => window.open(l.source_url, "_blank", "noopener,noreferrer")}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                >
                  <ExternalLink size={12} /> View source page
                </button>
              )}

              <input
                value={draft.email_subject}
                onChange={(e) => updateDraft(l.id, "email_subject", e.target.value)}
                disabled={!editable}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm font-semibold disabled:bg-gray-50 disabled:text-gray-500"
              />
              <textarea
                value={draft.email_body}
                onChange={(e) => updateDraft(l.id, "email_body", e.target.value)}
                disabled={!editable}
                rows={8}
                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />

              {l.status === "sent" && l.sent_at && (
                <p className="text-[11px] text-green-700">Sent {new Date(l.sent_at).toLocaleString()}</p>
              )}

              {editable && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveLead(l.id)}
                    disabled={busyId === l.id}
                    className="text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm border border-gray-300 text-steelgray hover:bg-gray-50"
                  >
                    Save Edits
                  </button>
                  <button
                    onClick={() => sendLead(l.id)}
                    disabled={busyId === l.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <Send size={13} /> {busyId === l.id ? "Sending..." : "Send"}
                  </button>
                  <button
                    onClick={() => rejectLead(l.id)}
                    disabled={busyId === l.id}
                    className="flex items-center gap-1 text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
