"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Handshake, Fuel } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import GradeBadge, { computeStats } from "./GradeBadge";
import MatchThread from "./MatchThread";

export default function TruckerDashboard({ user }) {
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
      .select("equipment_types, fleet_size, operator_type")
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

  if (loading) return <p className="text-steelgray">Loading your dashboard...</p>;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <h2 className="text-xl font-bold">Your carrier profile</h2>
          <GradeBadge grade={stats.grade} reviewCount={stats.reviewCount} />
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
          <button type="submit" className="sm:col-span-2 bg-asphalt text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide">
            {details ? "Update profile" : "Save profile — get discovered"}
          </button>
        </form>
        {!details && (
          <p className="text-xs text-steelgray italic mt-2">
            Brokers and vendors can't find you until you save a profile.
          </p>
        )}
      </section>
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-bold border-b border-gray-300 pb-2">Companies interested in you</h2>
          <div className="space-y-2 mt-3">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMatch(m)}
                className={`w-full text-left bg-white border rounded-sm px-4 py-3 flex items-center justify-between ${activeMatch?.id === m.id ? "border-amberx" : "border-gray-300 hover:border-amberx/60"}`}
              >
                <div className="flex items-center gap-3">
                  {m.partner_role === "vendor" ? <Fuel size={16} className="text-steelgray" /> : <Handshake size={16} className="text-steelgray" />}
                  <div>
                    <div className="text-sm font-medium">{m.partner?.company_name}</div>
                    <div className="text-xs text-gray-400 capitalize">{m.partner_role}</div>
                  </div>
                </div>
                <MessageCircle size={15} className="text-gray-400" />
              </button>
            ))}
            {matches.length === 0 && <p className="text-sm text-steelgray italic py-4">No matches yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold border-b border-gray-300 pb-2">Conversation</h2>
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
