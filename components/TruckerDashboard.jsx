"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Handshake, Fuel, Building2, Package } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import GradeBadge, { computeStats } from "./GradeBadge";
import MatchThread from "./MatchThread";

export default function TruckerDashboard({ user }) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({ lanes: "", bio: "" });
  const [matches, setMatches] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadEverything() {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("equipment_types, fleet_size, operator_type, company_name")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: detailsData } = await supabase
      .from("trucker_details")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (detailsData) {
      setDetails(detailsData);
      setForm({ lanes: detailsData.lanes || "", bio: detailsData.bio || "" });
    }

    const { data: matchData } = await supabase
      .from("matches")
      .select("*, partner:profiles!matches_partner_id_fkey(company_name, role)")
      .eq("trucker_id", user.id)
      .order("created_at", { ascending: false });
    setMatches(matchData || []);

    const openMatchId = searchParams.get("openMatch");
    if (openMatchId) {
      const found = (matchData || []).find((m) => m.id === openMatchId);
      if (found) setActiveMatch(found);
    }

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("on_time, condition")
      .eq("trucker_id", user.id);
    setReviews(reviewData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveDetails(e) {
    e.preventDefault();
    const payload = {
      id: user.id,
      fleet_size: profile?.fleet_size || "",
      equipment: (profile?.equipment_types || []).join(", "),
      lanes: form.lanes,
      bio: form.bio,
      years_active: details?.years_active || 0,
    };
    const { error } = details
      ? await supabase.from("trucker_details").update(payload).eq("id", user.id)
      : await supabase.from("trucker_details").insert(payload);
    if (!error) loadEverything();
  }

  const stats = computeStats(reviews);
  const brokerMatches = matches.filter((m) => m.partner_role === "broker");
  const vendorMatches = matches.filter((m) => m.partner_role === "vendor");
  const firstName = (profile?.company_name || "there").split(" ")[0];

  if (loading) return <p className="text-steelgray">Loading your dashboard...</p>;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-asphalt">Good morning, {firstName} 👋</h1>
        <p className="text-steelgray text-sm mt-1">Here's what's happening in your network.</p>
        <div
          className="mt-4 h-px w-full"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, #F2A93B 0 16px, transparent 16px 28px)",
          }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={<Building2 size={16} />} label="Broker Matches" value={brokerMatches.length} />
        <StatCard icon={<Package size={16} />} label="Vendor Matches" value={vendorMatches.length} />
        <div className="col-span-2 sm:col-span-1 bg-asphalt rounded-sm p-4 flex flex-col justify-between">
          <span className="text-xs uppercase tracking-widest text-gray-400 font-mono">Your Grade</span>
          <div className="mt-2">
            <GradeBadge grade={stats.grade} reviewCount={stats.reviewCount} />
          </div>
        </div>
      </div>

      {/* Profile section */}
      <section>
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <h2 className="text-xl font-bold text-asphalt">Your carrier profile</h2>
        </div>
        <form onSubmit={saveDetails} className="mt-3 bg-white border border-gray-300 rounded-sm p-4 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Fleet Size</label>
            <div className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-gray-50">
              {profile?.fleet_size || "Not set"}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Equipment</label>
            <div className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-gray-50">
              {(profile?.equipment_types || []).join(", ") || "Not set"}
            </div>
          </div>
          <Field label="Lanes you run" value={form.lanes} onChange={(v) => setForm({ ...form, lanes: v })} placeholder="CA, WA, OR" />
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <button
            type="submit"
            className="sm:col-span-2 bg-asphalt hover:bg-black text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors"
          >
            {details ? "Update profile" : "Save profile — get discovered"}
          </button>
        </form>
        {!details && (
          <p className="text-xs text-steelgray italic mt-2">
            Brokers and vendors can't find you until you save a profile.
          </p>
        )}
      </section>

      {/* Connections + conversation */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-bold text-asphalt border-b border-gray-300 pb-2">Companies interested in you</h2>
          <div className="space-y-2 mt-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className={`w-full bg-white border rounded-sm px-4 py-3 flex items-center justify-between transition-colors ${
                  activeMatch?.id === m.id
                    ? "border-amberx border-l-4"
                    : "border-gray-300 border-l-4 border-l-transparent hover:border-l-amberx/60"
                }`}
              >
                <button onClick={() => setActiveMatch(m)} className="flex items-center gap-3 text-left flex-1">
                  <div className="w-8 h-8 rotate-45 bg-asphalt/5 border border-asphalt/10 flex items-center justify-center shrink-0">
                    {m.partner_role === "vendor" ? (
                      <Fuel size={14} className="-rotate-45 text-steelgray" />
                    ) : (
                      <Handshake size={14} className="-rotate-45 text-steelgray" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{m.partner?.company_name}</div>
                    <div className="text-xs text-gray-400 font-mono uppercase tracking-wide">{m.partner_role}</div>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <Link href={`/company/${m.partner_id}`} className="text-xs text-steelgray hover:text-amberx underline whitespace-nowrap">
                    View Profile
                  </Link>
                  <button onClick={() => setActiveMatch(m)}>
                    <MessageCircle size={15} className="text-gray-400" />
                  </button>
                </div>
              </div>
            ))}
            {matches.length === 0 && <p className="text-sm text-steelgray italic py-4">No matches yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold text-asphalt border-b border-gray-300 pb-2">Conversation</h2>
          <div className="mt-3">
            {activeMatch ? (
              <MatchThread match={activeMatch} user={user} role="trucker" />
            ) : (
              <p className="text-sm text-steelgray italic py-4">Select a conversation to negotiate.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-asphalt rounded-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-gray-400 font-mono">{label}</span>
        <div className="w-6 h-6 rotate-45 bg-amberx flex items-center justify-center">
          <span className="-rotate-45 text-asphalt">{icon}</span>
        </div>
      </div>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
      />
    </div>
  );
}
