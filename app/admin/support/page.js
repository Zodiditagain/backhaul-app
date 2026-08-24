"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { authHeaders } from "../../../lib/supabaseClient";

export default function AdminSupportPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    const headers = await authHeaders();
    const res = await fetch("/api/admin/support", { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load support requests.");
      setLoading(false);
      return;
    }
    setRequests(data.requests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function setStatus(id, action) {
    setBusyId(id);
    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    await fetch("/api/admin/support/" + id, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action }),
    });
    await loadRequests();
    setBusyId(null);
  }

  const filtered = requests.filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Admin
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <LifeBuoy size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Support Requests</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Priority requests (from Broker/Vendor accounts) are sorted to the top automatically.
        </p>

        <div className="flex items-center gap-2 mb-4">
          {["open", "resolved", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                statusFilter === s
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

        <div className="space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </p>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <LifeBuoy size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No {statusFilter !== "all" ? statusFilter : ""} support requests.</p>
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-md px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {r.priority && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500 text-amber-400">
                          Priority
                        </span>
                      )}
                      <p className="text-sm font-semibold text-white">{r.subject}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.requester?.company_name || "Unknown"} ({r.requester?.role || "?"})
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5 max-w-2xl">{r.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === "resolved" ? (
                      <button
                        onClick={() => setStatus(r.id, "reopen")}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-md border border-slate-700 bg-slate-800 text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        <RotateCcw size={11} /> Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus(r.id, "resolve")}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-md border border-green-500/40 bg-green-500/15 text-green-400 disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
