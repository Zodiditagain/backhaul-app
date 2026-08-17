"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Flag, ExternalLink, MapPin } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

const CATEGORY_LABELS = {
  low_bridge: "Low Bridge",
  weight_restriction: "Weight Restriction",
  truck_prohibited: "Truck Prohibited",
  road_closure: "Road Closure",
  bad_turn: "Bad Turn",
  wrong_entrance: "Wrong Entrance",
  construction: "Construction",
  other: "Other",
};

const STATUS_OPTIONS = ["new", "under_review", "confirmed", "rejected", "resolved"];

const STATUS_COLORS = {
  new: "bg-amber-100 text-amber-800 border-amber-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  confirmed: "bg-red-100 text-red-800 border-red-300",
  rejected: "bg-gray-100 text-gray-600 border-gray-300",
  resolved: "bg-green-100 text-green-800 border-green-300",
};

function statusLabel(s) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminRouteReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  async function loadReports() {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/route-reports", { headers });
    if (!res.ok) {
      setError("Couldn't load route reports.");
      return;
    }
    const json = await res.json();
    setReports(json.reports || []);
    const nextDrafts = {};
    (json.reports || []).forEach((r) => {
      nextDrafts[r.id] = { status: r.status, admin_notes: r.admin_notes || "" };
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
      await loadReports();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function updateDraft(id, field, value) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveReport(id) {
    setBusyId(id);
    setError("");
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const draft = drafts[id] || {};
    const res = await fetch("/api/admin/route-reports/" + id, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: draft.status, admin_notes: draft.admin_notes }),
    });
    if (!res.ok) {
      setError("That update failed. Try again.");
    } else {
      await loadReports();
    }
    setBusyId(null);
  }

  if (loading) return <div className="p-8 text-steelgray">Loading route reports...</div>;
  if (!authorized) return null;

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
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
              <h1 className="text-white text-xl font-bold leading-none">ROUTE REPORTS</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">
                Driver-Reported Route Problems
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
          Drivers report a problem while viewing or navigating a route — a low bridge, a
          restriction, a bad turn, and so on. Nothing here changes routing automatically; review
          each report and update its status as your team confirms or resolves it.
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
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
            >
              <option value="all">All</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredReports.length === 0 && (
          <div className="bg-white border border-gray-300 rounded-sm p-6 text-center text-sm text-gray-500">
            No route reports match this filter.
          </div>
        )}

        {filteredReports.map((r) => {
          const draft = drafts[r.id] || { status: r.status, admin_notes: r.admin_notes || "" };
          return (
            <div key={r.id} className="bg-white border border-gray-300 rounded-sm p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Flag size={14} className="text-alertred" />
                  <span className="font-semibold text-sm">
                    {CATEGORY_LABELS[r.category] || r.category}
                  </span>
                  <span
                    className={
                      "text-[10px] font-mono uppercase tracking-wide border rounded-sm px-2 py-0.5 " +
                      (STATUS_COLORS[r.status] || STATUS_COLORS.new)
                    }
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-steelgray">
                <p>
                  <span className="text-gray-400">Driver: </span>
                  {r.reporter?.company_name || "Unknown"}
                  {r.reporter?.role ? " (" + r.reporter.role + ")" : ""}
                </p>
                <p>
                  <span className="text-gray-400">Truck Profile: </span>
                  {r.truck_profile?.profile_name || "—"}
                </p>
                <p>
                  <span className="text-gray-400">Route: </span>
                  {r.route_ref || "—"}
                </p>
                <p className="flex items-center gap-1">
                  <span className="text-gray-400">Location: </span>
                  {r.lat && r.lng ? (
                    <span className="flex items-center gap-0.5 text-steelgray">
                      <MapPin size={11} /> {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
              </div>

              {r.description && (
                <p className="text-sm text-steelgray bg-gray-50 border border-gray-200 rounded-sm p-2">
                  {r.description}
                </p>
              )}

              {r.photo_url && (
                
                  href={r.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                >
                  <ExternalLink size={12} /> View submitted photo
                </a>
              )}

              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">
                    Status
                  </label>
                  <select
                    value={draft.status}
                    onChange={(e) => updateDraft(r.id, "status", e.target.value)}
                    className="border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-gray-400 text-[10px] uppercase font-mono tracking-wide block mb-1">
                    Admin Notes
                  </label>
                  <input
                    value={draft.admin_notes}
                    onChange={(e) => updateDraft(r.id, "admin_notes", e.target.value)}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1.5 text-xs"
                    placeholder="Internal notes..."
                  />
                </div>
                <button
                  onClick={() => saveReport(r.id)}
                  disabled={busyId === r.id}
                  className="text-[11px] uppercase tracking-wide rounded-sm px-3 py-1.5 font-mono disabled:opacity-50 bg-asphalt text-white hover:bg-black"
                >
                  {busyId === r.id ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
