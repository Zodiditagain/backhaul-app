"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClipboardList, ArrowRight, X, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";
import MatchThread from "../../components/MatchThread";

// Same status vocabulary as MatchThread.jsx/BolForm.jsx — this page is just
// a full list view over the same bols the broker-created load threads
// already track, not a new lifecycle system.
const STATUS_LABELS = {
  draft: "Draft",
  sent: "Needs Your Review",
  correction_requested: "Correction Requested",
  accepted: "Accepted",
  ready_for_pickup: "Ready for Pickup",
  signed_at_pickup: "Signed at Pickup",
  in_transit: "In Transit",
  delivered: "Delivered",
  receiver_signed: "Receiver Signed",
  completed: "Completed",
};
const STATUS_COLORS = {
  sent: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  correction_requested: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  accepted: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  ready_for_pickup: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  signed_at_pickup: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  in_transit: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  delivered: "text-green-300 bg-green-500/10 border-green-500/30",
  receiver_signed: "text-green-300 bg-green-500/10 border-green-500/30",
  completed: "text-slate-300 bg-white/5 border-white/10",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action", statuses: ["sent", "correction_requested"] },
  { key: "active", label: "Active", statuses: ["accepted", "ready_for_pickup", "signed_at_pickup", "in_transit"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered", "receiver_signed"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
];

export default function MyLoadsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      }
    >
      <MyLoadsInner />
    </Suspense>
  );
}

function MyLoadsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loads, setLoads] = useState([]);
  const [filter, setFilter] = useState("all");
  const [openMatch, setOpenMatch] = useState(null);

  const loadAll = useCallback(async (currentUser) => {
    const { data: matchData } = await supabase
      .from("matches")
      .select("*, partner:profiles!matches_partner_id_fkey(id, company_name, role)")
      .eq("trucker_id", currentUser.id);
    const matches = matchData || [];
    const matchById = {};
    matches.forEach((m) => (matchById[m.id] = m));

    if (matches.length === 0) {
      setLoads([]);
      return;
    }

    const { data: bolData } = await supabase
      .from("bols")
      .select("*")
      .in(
        "match_id",
        matches.map((m) => m.id)
      )
      .neq("status", "draft")
      .order("updated_at", { ascending: false });

    const combined = (bolData || []).map((b) => ({ ...b, match: matchById[b.match_id] || null }));
    setLoads(combined);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_name, role, is_admin")
        .eq("id", currentUser.id)
        .single();
      setProfile(profileData);

      await loadAll(currentUser);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadAll]);

  // Deep-link support, same convention as the rest of the app: ?openMatch=<id>
  useEffect(() => {
    const id = searchParams.get("openMatch");
    if (!id || !user) return;
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, partner:profiles!matches_partner_id_fkey(id, company_name, role)")
        .eq("id", id)
        .eq("trucker_id", user.id)
        .maybeSingle();
      if (data) setOpenMatch(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  const visibleLoads = loads.filter((b) => {
    if (filter === "all") return true;
    const def = FILTERS.find((f) => f.key === filter);
    return def?.statuses?.includes(b.status);
  });

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your loads...
        </p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="My Loads">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">My loads</h2>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border transition-colors ${
                filter === f.key
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-[#111827] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visibleLoads.length === 0 ? (
          <div className="bg-[#111827] border border-white/10 rounded-xl p-8 text-center">
            <ClipboardList size={22} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              {loads.length === 0
                ? "No loads yet — accepted loads from brokers will show up here."
                : "Nothing in this filter right now."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleLoads.map((b) => (
              <button
                key={b.id}
                onClick={() => b.match && setOpenMatch(b.match)}
                disabled={!b.match}
                className="w-full text-left bg-[#111827] border border-white/10 hover:border-blue-500/40 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {b.bol_number ? `Load #${b.bol_number}` : "Load"}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 shrink-0 ${
                        STATUS_COLORS[b.status] || "text-slate-300 bg-white/5 border-white/10"
                      }`}
                    >
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {b.match?.partner?.company_name || "Unknown broker"}
                    {" · "}
                    {[b.shipper_city, b.shipper_state].filter(Boolean).join(", ") || "—"}
                    {" → "}
                    {[b.consignee_city, b.consignee_state].filter(Boolean).join(", ") || "—"}
                  </p>
                  {b.pickup_date && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pickup {new Date(b.pickup_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                {b.match && <ArrowRight size={16} className="text-slate-500 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {openMatch && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpenMatch(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">{openMatch.partner?.company_name || "Conversation"}</h3>
              <button onClick={() => setOpenMatch(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <MatchThread
              match={openMatch}
              user={user}
              role="trucker"
              onMessageSent={() => loadAll(user)}
              onReviewSubmitted={() => loadAll(user)}
            />
          </div>
        </div>
      )}
    </TruckerSidebar>
  );
}
