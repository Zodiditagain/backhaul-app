"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FolderOpen, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerSidebar from "../../components/TruckerSidebar";
import MatchThread from "../../components/MatchThread";

// A paperwork-focused view over the same bols table My Loads reads — this
// page is the reference archive (find the BOL number, dates, and proof of
// delivery for a load you need to look back on), while My Loads is the
// lifecycle view (where a load currently stands). No separate document
// storage exists yet: "documents" here means the BOL record itself plus
// whatever POD photo was uploaded through the load thread — there's no PDF
// export of the BOL to link to.
export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      }
    >
      <DocumentsInner />
    </Suspense>
  );
}

function DocumentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bols, setBols] = useState([]);
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
      setBols([]);
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
      .order("created_at", { ascending: false });

    setBols((bolData || []).map((b) => ({ ...b, match: matchById[b.match_id] || null })));
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

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading your documents...
        </p>
      </div>
    );
  }

  return (
    <TruckerSidebar user={user} profile={profile} title="Documents & BOL">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Documents &amp; BOL</h2>
        </div>
        <p className="text-sm text-slate-400 -mt-4">
          Every bill of lading a broker has sent you, in one place — with proof of delivery once you've
          uploaded it.
        </p>

        {bols.length === 0 ? (
          <div className="bg-[#111827] border border-white/10 rounded-xl p-8 text-center">
            <FolderOpen size={22} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No paperwork yet — BOLs a broker sends you will show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bols.map((b) => (
              <div
                key={b.id}
                className="bg-[#111827] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <button
                  onClick={() => b.match && setOpenMatch(b.match)}
                  disabled={!b.match}
                  className="min-w-0 text-left flex-1 disabled:cursor-not-allowed"
                >
                  <p className="text-sm font-semibold text-white truncate">
                    {b.bol_number ? `BOL #${b.bol_number}` : "Bill of Lading"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {b.match?.partner?.company_name || "Unknown broker"}
                    {" · "}
                    {[b.shipper_city, b.shipper_state].filter(Boolean).join(", ") || "—"}
                    {" → "}
                    {[b.consignee_city, b.consignee_state].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                    {b.pickup_date && (
                      <span>
                        Pickup {new Date(b.pickup_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {b.equipment_type && <span>{b.equipment_type}</span>}
                    {b.rate_per_mile && <span>${b.rate_per_mile}/mi</span>}
                  </p>
                </button>
                {b.pod_url && (
                    href={b.pod_url}
                    href={b.pod_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md hover:bg-blue-500/20"
                  >
                    <ImageIcon size={13} />
                    View POD
                  </a>
                )}
              </div>
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
