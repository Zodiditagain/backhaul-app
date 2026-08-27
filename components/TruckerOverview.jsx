"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  MapPin,
  Crosshair,
  Building2,
  Package as PackageIcon,
  MessageCircle,
  Check,
  X,
  Upload,
  Wrench,
  Store,
  FileText,
  ShieldCheck,
  Newspaper,
  ArrowRight,
  Loader2,
  CircleCheck,
} from "lucide-react";
import { supabase, authHeaders } from "../lib/supabaseClient";
import GradeBadge, { computeStats } from "./GradeBadge";
import MatchThread from "./MatchThread";

const AVAILABILITY_WINDOW_HOURS = 6;

// Friendly labels for the 4-step tracker shown on the Active Load card.
// Mirrors the real BOL lifecycle used throughout MatchThread.jsx/BolForm.jsx
// (draft -> sent -> accepted -> correction_requested -> ready_for_pickup ->
// signed_at_pickup -> in_transit -> delivered -> receiver_signed ->
// completed) — this is a simplified 4-stage view of that same lifecycle,
// not a separate status system.
const TRACKER_STEPS = ["accepted", "ready_for_pickup", "in_transit", "delivered"];
const TRACKER_LABELS = {
  accepted: "Accepted",
  ready_for_pickup: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};
function trackerStepIndex(status) {
  if (status === "signed_at_pickup") return 1; // counts as "picked up" for this simplified view
  if (["receiver_signed", "completed"].includes(status)) return 3; // counts as "delivered"
  const idx = TRACKER_STEPS.indexOf(status);
  return idx === -1 ? -1 : idx;
}

function isAvailabilityActive(availableNow, availableSince) {
  if (!availableNow || !availableSince) return false;
  const hoursAgo = (Date.now() - new Date(availableSince).getTime()) / 36e5;
  return hoursAgo < AVAILABILITY_WINDOW_HOURS;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TruckerOverview({ user }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const [defaultTruck, setDefaultTruck] = useState(null);

  const [markingAvailable, setMarkingAvailable] = useState(false);
  const [availError, setAvailError] = useState("");

  const [matches, setMatches] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [reviews, setReviews] = useState([]);
  const [activeBol, setActiveBol] = useState(null);
  const [activeBolMatch, setActiveBolMatch] = useState(null);

  const [tipOfDay, setTipOfDay] = useState(null);
  const [latestPost, setLatestPost] = useState(null);

  const [openMatch, setOpenMatch] = useState(null);
  const [respondingId, setRespondingId] = useState(null);

  // Route planner mini-card
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [originPoint, setOriginPoint] = useState(null);
  const [destPoint, setDestPoint] = useState(null);
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const loadAll = useCallback(async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select(
        "company_name, equipment_types, fleet_size, dot_number, mc_number, insurance_cargo, insurance_liability, available_now, available_since, available_location_label"
      )
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: detailsData } = await supabase
      .from("trucker_details")
      .select("bio, lanes")
      .eq("id", user.id)
      .maybeSingle();
    setDetails(detailsData || null);

    const { data: truckData } = await supabase
      .from("truck_profiles")
      .select("profile_name, vehicle_type, height_inches, gross_weight_lbs, length_inches, axle_count, hazmat")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDefaultTruck(truckData || null);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*, partner:profiles!matches_partner_id_fkey(company_name, role)")
      .eq("trucker_id", user.id)
      .order("created_at", { ascending: false });
    const matchRows = matchData || [];
    setMatches(matchRows);

    const acceptedIds = matchRows.filter((m) => m.status === "accepted").map((m) => m.id);
    if (acceptedIds.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("match_id, sender_id, text, rate, created_at")
        .in("match_id", acceptedIds)
        .order("created_at", { ascending: false });
      const latestByMatch = {};
      (msgData || []).forEach((m) => {
        if (!latestByMatch[m.match_id]) latestByMatch[m.match_id] = m;
      });
      setLastMessages(latestByMatch);

      // Active Load: the most recently updated non-completed BOL tied to one
      // of this trucker's accepted matches. Reuses the existing bols table
      // untouched — no new schema.
      const { data: bolRows } = await supabase
        .from("bols")
        .select("*")
        .in("match_id", acceptedIds)
        .neq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(1);
      const bol = (bolRows || [])[0] || null;
      setActiveBol(bol);
      setActiveBolMatch(bol ? matchRows.find((m) => m.id === bol.match_id) || null : null);
    } else {
      setLastMessages({});
      setActiveBol(null);
      setActiveBolMatch(null);
    }

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("on_time, condition")
      .eq("trucker_id", user.id);
    setReviews(reviewData || []);

    const { data: tipsData } = await supabase
      .from("safety_tips")
      .select("title, body")
      .in("audience", ["all", "trucker"])
      .order("sort_order", { ascending: true });
    if (tipsData && tipsData.length > 0) {
      const startOfYear = new Date(new Date().getFullYear(), 0, 0);
      const dayOfYear = Math.floor((new Date() - startOfYear) / 86400000);
      setTipOfDay(tipsData[dayOfYear % tipsData.length]);
    }

    const { data: postData } = await supabase
      .from("blog_posts")
      .select("slug, title, headline_stat, published_at, scheduled_publish_at")
      .order("scheduled_publish_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestPost(postData || null);

    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Deep-link support, same convention as BrokerOverview: /dashboard?openMatch=<id>
  useEffect(() => {
    const id = searchParams.get("openMatch");
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, partner:profiles!matches_partner_id_fkey(company_name, role)")
        .eq("id", id)
        .eq("trucker_id", user.id)
        .maybeSingle();
      if (data) openConversation(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function markAvailable() {
    setAvailError("");
    if (!navigator.geolocation) {
      setAvailError("Geolocation isn't available in this browser.");
      return;
    }
    setMarkingAvailable(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        try {
          const res = await fetch(`/api/here/reverse?lat=${lat}&lng=${lng}`, { headers: await authHeaders() });
          const data = await res.json();
          if (data.address) label = data.address;
        } catch {
          // fall back to raw coordinates if reverse geocoding fails
        }
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("profiles")
          .update({
            available_now: true,
            available_since: nowIso,
            available_lat: lat,
            available_lng: lng,
            available_location_label: label,
          })
          .eq("id", user.id);
        setMarkingAvailable(false);
        if (!error) {
          setProfile((p) => ({ ...p, available_now: true, available_since: nowIso, available_location_label: label }));
          // Best-effort history log for the standalone Availability History
          // page — failure here shouldn't block the actual availability
          // toggle the user is waiting on.
          supabase
            .from("availability_log")
            .insert({ user_id: user.id, event: "available", location_lat: lat, location_lng: lng, location_label: label })
            .then(({ error: logError }) => {
              if (logError) console.error("Availability log insert failed:", logError);
            });
        } else {
          setAvailError("Couldn't update your availability. Try again.");
        }
      },
      (err) => {
        setAvailError("Couldn't get your location: " + err.message);
        setMarkingAvailable(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function markUnavailable() {
    setMarkingAvailable(true);
    const { error } = await supabase.from("profiles").update({ available_now: false }).eq("id", user.id);
    setMarkingAvailable(false);
    if (!error) {
      setProfile((p) => ({ ...p, available_now: false }));
      supabase
        .from("availability_log")
        .insert({ user_id: user.id, event: "unavailable" })
        .then(({ error: logError }) => {
          if (logError) console.error("Availability log insert failed:", logError);
        });
    }
  }

  async function openConversation(m) {
    setOpenMatch(m);
    await supabase.from("matches").update({ trucker_last_read_at: new Date().toISOString() }).eq("id", m.id);
    setMatches((prev) => prev.map((x) => (x.id === m.id ? { ...x, trucker_last_read_at: new Date().toISOString() } : x)));
  }

  async function respondToMatch(matchId, decision) {
    setRespondingId(matchId);
    if (decision === "accepted") {
      await supabase.from("matches").update({ status: "accepted" }).eq("id", matchId);
    } else {
      await supabase.from("matches").delete().eq("id", matchId);
    }
    setRespondingId(null);
    loadAll();
  }

  function isUnread(m) {
    const lastMsg = lastMessages[m.id];
    if (!lastMsg) return false;
    if (lastMsg.sender_id === user.id) return false;
    if (!m.trucker_last_read_at) return true;
    return new Date(lastMsg.created_at) > new Date(m.trucker_last_read_at);
  }

  // ---- Route planner mini-card: place autocomplete (same /api/here/autocomplete
  // endpoint BrokerOverview's "Find a Carrier" search already uses) ----
  const fetchOriginSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) {
      setOriginSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch("/api/here/autocomplete?" + params.toString(), { headers: await authHeaders() });
      const data = await res.json();
      setOriginSuggestions((data.items || []).filter((i) => i.lat !== null && i.lng !== null));
    } catch {
      // silent fail on suggestions
    }
  }, []);
  const fetchDestSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) {
      setDestSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch("/api/here/autocomplete?" + params.toString(), { headers: await authHeaders() });
      const data = await res.json();
      setDestSuggestions((data.items || []).filter((i) => i.lat !== null && i.lng !== null));
    } catch {
      // silent fail on suggestions
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchOriginSuggestions(originQuery), 300);
    return () => clearTimeout(t);
  }, [originQuery, fetchOriginSuggestions]);
  useEffect(() => {
    const t = setTimeout(() => fetchDestSuggestions(destQuery), 300);
    return () => clearTimeout(t);
  }, [destQuery, fetchDestSuggestions]);

  function useMyLocationForOrigin() {
    setLocateError("");
    if (!navigator.geolocation) {
      setLocateError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Your current location" });
        setOriginQuery("Your current location");
        setLocating(false);
      },
      (err) => {
        setLocateError("Couldn't get your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function submitRoutePlan(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (originPoint) {
      params.set("originLat", String(originPoint.lat));
      params.set("originLng", String(originPoint.lng));
      params.set("originAddress", originPoint.address);
    }
    if (destPoint) {
      params.set("destLat", String(destPoint.lat));
      params.set("destLng", String(destPoint.lng));
      params.set("destAddress", destPoint.address);
    }
    router.push("/route-map" + (params.toString() ? "?" + params.toString() : ""));
  }

  const acceptedMatches = matches.filter((m) => m.status === "accepted");
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const brokerMatches = acceptedMatches.filter((m) => m.partner_role === "broker");
  const vendorMatches = acceptedMatches.filter((m) => m.partner_role === "vendor");
  const unreadCount = acceptedMatches.filter((m) => isUnread(m)).length;
  const stats = computeStats(reviews);
  const firstName = (profile?.company_name || "there").split(" ")[0];

  const canUploadPod = activeBol && ["delivered", "receiver_signed"].includes(activeBol.status);

  // Profile-completeness ring — a new, client-computed percentage (not an
  // existing DB field) based on how many of these 7 real, actually-read
  // fields are filled in. Distinct from the on-time-delivery "Grade" stat
  // tile above, which comes from GradeBadge/computeStats instead.
  const completenessFields = [
    profile?.company_name,
    profile?.equipment_types && profile.equipment_types.length > 0,
    profile?.dot_number,
    profile?.mc_number,
    profile?.insurance_cargo,
    profile?.insurance_liability,
    details?.bio,
  ];
  const completenessPct = Math.round(
    (completenessFields.filter(Boolean).length / completenessFields.length) * 100
  );

  if (loading) {
    return (
      <p className="text-slate-500 text-sm flex items-center gap-2 py-10">
        <Loader2 size={14} className="animate-spin" /> Loading your dashboard...
      </p>
    );
  }

  const availabilityActive = isAvailabilityActive(profile?.available_now, profile?.available_since);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Good morning, {firstName}</h2>
        <p className="text-slate-500 text-sm mt-1">Here's what's happening with your business.</p>
      </div>

      {/* I'm Available — the main driver action */}
      <div
        className={`rounded-xl p-5 border ${
          availabilityActive ? "bg-green-500/10 border-green-500/40" : "bg-[#111827] border-white/10"
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                availabilityActive ? "bg-green-500" : "bg-white/5"
              }`}
            >
              <Truck className={availabilityActive ? "text-white" : "text-slate-400"} size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white">
                  {availabilityActive ? "You're marked Available" : "Available for a backhaul?"}
                </span>
                {availabilityActive && (
                  <span className="text-[10px] uppercase font-mono tracking-wide bg-green-500 text-white px-1.5 py-0.5 rounded">
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {availabilityActive
                  ? `Near ${profile?.available_location_label || "your location"} · brokers and vendors can see you now (expires after ${AVAILABILITY_WINDOW_HOURS}h)`
                  : "Just dropped a load? Let brokers and vendors see you're open for a backhaul nearby."}
              </p>
            </div>
          </div>
          <button
            onClick={availabilityActive ? markUnavailable : markAvailable}
            disabled={markingAvailable}
            className={`shrink-0 py-2.5 px-4 rounded-md font-semibold text-xs uppercase tracking-wide transition-colors disabled:opacity-50 ${
              availabilityActive
                ? "bg-transparent border border-green-500 text-green-400 hover:bg-green-500/10"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
          >
            {markingAvailable ? "Updating..." : availabilityActive ? "Mark Booked" : "I'm Available"}
          </button>
        </div>
        {availError && <p className="text-xs text-red-400 mt-3">{availError}</p>}
        <Link href="/availability" className="inline-block text-xs text-slate-500 hover:text-blue-400 mt-3">
          View availability history →
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Building2} label="Broker Matches" value={brokerMatches.length} href="/messages" />
        <StatTile icon={PackageIcon} label="Vendor Matches" value={vendorMatches.length} href="/messages" />
        <div className="bg-[#111827] border border-white/10 rounded-xl p-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Profile Grade</span>
          <GradeBadge grade={stats.grade} reviewCount={stats.reviewCount} />
        </div>
        <StatTile icon={MessageCircle} label="Unread Messages" value={unreadCount} href="/messages" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          icon={Upload}
          label="Upload POD"
          disabled={!canUploadPod}
          subtitle={canUploadPod ? undefined : "Available once a load is delivered"}
          onClick={canUploadPod ? () => setOpenMatch(activeBolMatch) : undefined}
        />
        <QuickAction
          icon={FileText}
          label="View Active Load"
          disabled={!activeBolMatch}
          subtitle={activeBolMatch ? undefined : "No active load right now"}
          onClick={activeBolMatch ? () => setOpenMatch(activeBolMatch) : undefined}
        />
        <QuickAction icon={Wrench} label="Update Truck Specs" href="/truck-profiles" />
        <QuickAction icon={Store} label="Find Vendors" href="/vendors" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Active Load */}
          <section className="bg-[#111827] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={17} className="text-blue-400" />
              <h3 className="font-bold text-white">Active Load</h3>
            </div>
            {!activeBol ? (
              <p className="text-sm text-slate-500 italic py-4">
                No active load right now — accepted loads will show up here with live status.
              </p>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {activeBol.bol_number ? `Load #${activeBol.bol_number}` : "Load"}
                      {activeBolMatch?.partner?.company_name ? ` — ${activeBolMatch.partner.company_name}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[activeBol.shipper_city, activeBol.shipper_state].filter(Boolean).join(", ")}
                      {activeBol.consignee_city ? " → " : ""}
                      {[activeBol.consignee_city, activeBol.consignee_state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenMatch(activeBolMatch)}
                    className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md"
                  >
                    View Load <ArrowRight size={13} />
                  </button>
                </div>
                {activeBol.status === "sent" ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 text-xs text-amber-300">
                    This load needs your review — open it to accept or request a correction.
                  </div>
                ) : (
                  <div className="flex items-center">
                    {TRACKER_STEPS.map((step, i) => {
                      const currentIdx = trackerStepIndex(activeBol.status);
                      const done = currentIdx >= i;
                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                                done ? "bg-blue-500 border-blue-500" : "bg-transparent border-white/15"
                              }`}
                            >
                              {done && <CircleCheck size={13} className="text-white" />}
                            </div>
                            <span className={`text-[10px] uppercase tracking-wide ${done ? "text-blue-300" : "text-slate-500"}`}>
                              {TRACKER_LABELS[step]}
                            </span>
                          </div>
                          {i < TRACKER_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 mb-4 ${currentIdx > i ? "bg-blue-500" : "bg-white/10"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Truck-Safe Route Planner */}
          <section className="bg-[#111827] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={17} className="text-blue-400" />
              <h3 className="font-bold text-white">Truck-Safe Route Planner</h3>
            </div>
            {defaultTruck ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {defaultTruck.height_inches && (
                  <SpecChip label={`H: ${Math.floor(defaultTruck.height_inches / 12)}' ${Math.round(defaultTruck.height_inches % 12)}"`} />
                )}
                {defaultTruck.gross_weight_lbs && (
                  <SpecChip label={`W: ${Number(defaultTruck.gross_weight_lbs).toLocaleString()} lb`} />
                )}
                {defaultTruck.length_inches && (
                  <SpecChip label={`L: ${Math.floor(defaultTruck.length_inches / 12)}' ${Math.round(defaultTruck.length_inches % 12)}"`} />
                )}
                {defaultTruck.axle_count && <SpecChip label={`Axles: ${defaultTruck.axle_count}`} />}
                {defaultTruck.hazmat && <SpecChip label="Hazmat" />}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-3">
                No truck profile saved yet —{" "}
                <Link href="/truck-profiles" className="text-blue-400 hover:text-blue-300 underline">
                  add your specs
                </Link>{" "}
                so routes avoid restrictions your vehicle can't take.
              </p>
            )}
            <form onSubmit={submitRoutePlan} className="space-y-2">
              <div className="relative">
                <input
                  value={originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setOriginPoint(null);
                    setShowOriginSuggestions(true);
                  }}
                  onFocus={() => setShowOriginSuggestions(true)}
                  placeholder="Origin — city, address, or zip"
                  className="w-full bg-[#0b1220] border border-white/10 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
                {showOriginSuggestions && originSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-[#0b1220] border border-white/10 rounded-md overflow-hidden shadow-lg">
                    {originSuggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setOriginPoint({ lat: s.lat, lng: s.lng, address: s.address });
                          setOriginQuery(s.address);
                          setShowOriginSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-start gap-2"
                      >
                        <MapPin size={14} className="mt-0.5 text-slate-500 flex-shrink-0" />
                        <span>{s.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={useMyLocationForOrigin}
                  disabled={locating}
                  className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md disabled:opacity-50"
                >
                  <Crosshair size={13} />
                  {locating ? "Locating..." : "My Location"}
                </button>
                {locateError && <p className="text-xs text-red-400 self-center">{locateError}</p>}
              </div>
              <div className="relative">
                <input
                  value={destQuery}
                  onChange={(e) => {
                    setDestQuery(e.target.value);
                    setDestPoint(null);
                    setShowDestSuggestions(true);
                  }}
                  onFocus={() => setShowDestSuggestions(true)}
                  placeholder="Destination — city, address, or zip"
                  className="w-full bg-[#0b1220] border border-white/10 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
                {showDestSuggestions && destSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-[#0b1220] border border-white/10 rounded-md overflow-hidden shadow-lg">
                    {destSuggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setDestPoint({ lat: s.lat, lng: s.lng, address: s.address });
                          setDestQuery(s.address);
                          setShowDestSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 flex items-start gap-2"
                      >
                        <MapPin size={14} className="mt-0.5 text-slate-500 flex-shrink-0" />
                        <span>{s.address}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-md"
              >
                Plan Route <ArrowRight size={14} />
              </button>
            </form>
          </section>

          {/* Companies interested in you */}
          <section className="bg-[#111827] border border-white/10 rounded-xl p-5">
            <h3 className="font-bold text-white mb-3">Companies Interested in You</h3>
            {pendingMatches.length > 0 && (
              <div className="space-y-2 mb-4">
                {pendingMatches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white/5 border border-blue-500/30 rounded-md px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.partner?.company_name}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{m.partner_role} · wants to connect</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => respondToMatch(m.id, "declined")}
                        disabled={respondingId === m.id}
                        className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-slate-400 hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={() => respondToMatch(m.id, "accepted")}
                        disabled={respondingId === m.id}
                        className="w-7 h-7 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white disabled:opacity-50"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {acceptedMatches.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-2">No matches yet.</p>
              ) : (
                acceptedMatches.map((m) => {
                  const lastMsg = lastMessages[m.id];
                  const unread = isUnread(m);
                  return (
                    <button
                      key={m.id}
                      onClick={() => openConversation(m)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm truncate ${unread ? "font-bold text-white" : "font-medium text-slate-200"}`}>
                            {m.partner?.company_name}
                          </span>
                          {unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{m.partner_role}</p>
                        {lastMsg && (
                          <p className={`text-xs truncate mt-0.5 ${unread ? "text-slate-300" : "text-slate-500"}`}>
                            {lastMsg.text || (lastMsg.rate ? `Offer: $${lastMsg.rate}/mi` : "")}
                          </p>
                        )}
                      </div>
                      <MessageCircle size={15} className={unread ? "text-blue-400 shrink-0" : "text-slate-600 shrink-0"} />
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6 min-w-0">
          <Link
            href="/carrier-profile"
            className="block bg-[#111827] border border-white/10 hover:border-blue-500/40 rounded-xl p-4 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm mb-1">Carrier Profile</h3>
                <p className="text-xs text-slate-400">
                  {completenessPct >= 100 ? "Your profile is complete" : "Finish your profile to get discovered"}
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-white"
                style={{
                  background: `conic-gradient(#3b82f6 ${completenessPct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                }}
              >
                <div className="w-9 h-9 rounded-full bg-[#111827] flex items-center justify-center">{completenessPct}%</div>
              </div>
            </div>
          </Link>

          {tipOfDay && (
            <section className="bg-[#111827] border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={14} className="text-blue-400" />
                <p className="text-blue-300 text-[10px] uppercase tracking-widest font-semibold">Safety Tip of the Day</p>
              </div>
              <p className="text-white font-semibold text-sm mb-1">{tipOfDay.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{tipOfDay.body}</p>
            </section>
          )}

          {latestPost && (
            <Link
              href={`/blog/${latestPost.slug}`}
              className="block bg-[#111827] border border-white/10 hover:border-blue-500/40 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Newspaper size={14} className="text-blue-400" />
                <p className="text-blue-300 text-[10px] uppercase tracking-widest font-semibold">From the Backhaul Blog</p>
              </div>
              <p className="text-white font-semibold text-sm">{latestPost.title}</p>
            </Link>
          )}
        </div>
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
            <MatchThread match={openMatch} user={user} role="trucker" onMessageSent={loadAll} onReviewSubmitted={loadAll} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, href }) {
  return (
    <Link href={href} className="bg-[#111827] border border-white/10 hover:border-blue-500/40 rounded-xl p-4 flex flex-col gap-2 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</span>
        <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center">
          <Icon size={14} className="text-blue-400" />
        </div>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </Link>
  );
}

function QuickAction({ icon: Icon, label, subtitle, href, onClick, disabled }) {
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${disabled ? "bg-white/5" : "bg-blue-500/15"}`}>
        <Icon size={16} className={disabled ? "text-slate-600" : "text-blue-400"} />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold truncate ${disabled ? "text-slate-500" : "text-white"}`}>{label}</p>
        {subtitle && <p className="text-[10px] text-slate-500 truncate">{subtitle}</p>}
      </div>
    </>
  );
  const className = `flex items-center gap-3 rounded-xl p-4 border transition-colors ${
    disabled
      ? "bg-[#111827]/50 border-white/5 cursor-not-allowed"
      : "bg-[#111827] border-white/10 hover:border-blue-500/40"
  }`;
  if (disabled) {
    return <div className={className}>{inner}</div>;
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${className} text-left`}>
      {inner}
    </button>
  );
}

function SpecChip({ label }) {
  return (
    <span className="text-[10px] uppercase tracking-wide text-slate-300 bg-white/5 border border-white/10 rounded px-2 py-1">
      {label}
    </span>
  );
}
