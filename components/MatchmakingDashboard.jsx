"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, X, Handshake, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import GradeBadge, { computeStats } from "./GradeBadge";
import MatchThread from "./MatchThread";

export default function MatchmakingDashboard({ user, role }) {
  const [candidates, setCandidates] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [justMatched, setJustMatched] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadEverything() {
    const { data: matchData } = await supabase
      .from("matches")
      .select("*, trucker:profiles!matches_trucker_id_fkey(id, company_name)")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false });
    setMatches(matchData || []);

    const alreadyMatchedIds = (matchData || []).map((m) => m.trucker_id);

    const { data: truckerProfiles } = await supabase
      .from("profiles")
      .select("id, company_name, trucker_details(*)")
      .eq("role", "trucker");

    const filtered = (truckerProfiles || []).filter((p) => !alreadyMatchedIds.includes(p.id) && p.trucker_details);

    // attach reviews for each candidate so grade shows correctly
    const withReviews = await Promise.all(
      filtered.map(async (p) => {
        const { data: reviews } = await supabase.from("reviews").select("on_time, condition").eq("trucker_id", p.id);
        return { ...p, reviews: reviews || [] };
      })
    );

    setCandidates(withReviews);
    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(profile) {
    const { error } = await supabase.from("matches").insert({
      trucker_id: profile.id,
      partner_id: user.id,
      partner_role: role,
    });
    if (!error) {
      setJustMatched(profile);
      setTimeout(() => {
        setJustMatched(false);
        setDeckIndex((i) => i + 1);
        loadEverything();
      }, 1200);
    }
  }

  const thisMonthCount = matches.filter((m) => {
    const created = new Date(m.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  if (loading) return <p className="text-steelgray">Loading candidates...</p>;

  const profile = candidates.length > 0 ? candidates[deckIndex % candidates.length] : null;
  const stats = profile ? computeStats(profile.reviews) : null;

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <section>
        <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4">
          {role === "broker" ? "Find a carrier" : "Find a carrier to service"}
        </h2>

        {!profile && <p className="text-sm text-steelgray italic">No new carriers to discover right now — check back soon.</p>}

        {profile && (
          <div className="flex flex-col items-center">
            <div className="w-full max-w-sm bg-white border border-gray-300 rounded-sm overflow-hidden">
              <div className="bg-asphalt px-4 py-3 flex items-center justify-between">
                <span className="text-white text-lg font-bold">{profile.company_name}</span>
                <GradeBadge grade={stats.grade} reviewCount={stats.reviewCount} />
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-steelgray">{profile.trucker_details?.bio}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-steelgray">
                  <div><span className="text-gray-400">Fleet</span><br />{profile.trucker_details?.fleet_size} trucks</div>
                  <div><span className="text-gray-400">Years active</span><br />{profile.trucker_details?.years_active}</div>
                  <div><span className="text-gray-400">Equipment</span><br />{profile.trucker_details?.equipment}</div>
                  <div><span className="text-gray-400">On-time</span><br />{stats.onTime !== null ? `${stats.onTime}%` : "—"}</div>
                  <div className="col-span-2 pt-1 border-t border-gray-100 flex items-center gap-1">
                    <span className="text-gray-400">Freight condition:</span>
                    {stats.conditionAvg ? `${stats.conditionAvg} / 5` : "no reports yet"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-steelgray">
                  <MapPin size={12} /> {profile.trucker_details?.lanes}
                </div>
                <Link
                  href={`/company/${profile.id}`}
                  className="block text-center text-xs text-steelgray hover:text-amberx underline pt-1"
                >
                  View full profile
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-5">
              <button
                onClick={() => setDeckIndex((i) => i + 1)}
                className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center text-steelgray hover:border-alertred hover:text-alertred"
              >
                <X size={20} />
              </button>
              <button
                onClick={() => connect(profile)}
                className="w-14 h-14 rounded-full bg-highway flex items-center justify-center text-white hover:bg-green-800"
              >
                <Handshake size={22} />
              </button>
            </div>

            {justMatched && (
              <div className="fixed inset-0 bg-asphalt/85 flex items-center justify-center z-20 px-4">
                <div className="bg-white rounded-sm p-8 text-center max-w-sm">
                  <h3 className="text-3xl font-bold mb-1">It's a match!</h3>
                  <p className="text-sm text-steelgray">{justMatched.company_name} is now in your matches.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold border-b border-gray-300 pb-2">Your matches</h2>
        <div className="mt-3 mb-3 bg-asphalt rounded-sm px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-3xl text-amberx font-bold leading-none">{thisMonthCount}</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Carriers matched this month</div>
          </div>
          <Handshake size={26} className="text-amberx/60" />
        </div>
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.id}
              className={`w-full bg-white border rounded-sm px-3 py-2.5 flex items-center justify-between ${
                activeMatch?.id === m.id ? "border-amberx" : "border-gray-300 hover:border-amberx/60"
              }`}
            >
              <button onClick={() => setActiveMatch(m)} className="text-left flex-1">
                <span className="text-sm">{m.trucker?.company_name}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/company/${m.trucker_id}`} className="text-[11px] text-steelgray hover:text-amberx underline whitespace-nowrap">
                  Profile
                </Link>
                <button onClick={() => setActiveMatch(m)}>
                  <MessageCircle size={14} className="text-gray-400" />
                </button>
              </div>
            </div>
          ))}
          {matches.length === 0 && <p className="text-sm text-steelgray italic py-4">No matches yet — connect with a carrier to start.</p>}
        </div>
        {activeMatch && (
          <div className="mt-4">
            <MatchThread match={activeMatch} user={user} role={role} onReviewSubmitted={loadEverything} />
          </div>
        )}
      </section>
    </div>
  );
}
