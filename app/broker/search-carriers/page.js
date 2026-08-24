"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, MapPin, Clock, Loader2, Crosshair, Star, MessageCircle, Bell, BadgeCheck, ShieldAlert } from "lucide-react";
import { supabase, authHeaders } from "../../../lib/supabaseClient";

const AVAILABILITY_WINDOW_HOURS = 6;
const NEW_CARRIER_WINDOW_DAYS = 14;

const EQUIPMENT_OPTIONS = [
  { id: "dry_van", label: "Dry Van" },
  { id: "reefer", label: "Reefer" },
  { id: "flatbed", label: "Flatbed" },
  { id: "step_deck", label: "Step Deck" },
  { id: "hotshot", label: "Hotshot" },
  { id: "power_only", label: "Power Only" },
  { id: "box_truck", label: "Box Truck" },
];

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isActive(availableNow, availableSince) {
  if (!availableNow || !availableSince) return false;
  const hoursAgo = (Date.now() - new Date(availableSince).getTime()) / 36e5;
  return hoursAgo < AVAILABILITY_WINDOW_HOURS;
}

function isNewCarrier(createdAt) {
  if (!createdAt) return false;
  const daysAgo = (Date.now() - new Date(createdAt).getTime()) / 864e5;
  return daysAgo < NEW_CARRIER_WINDOW_DAYS;
}

export default function SearchCarriersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [userId, setUserId] = useState(null);
  const [partnerRole, setPartnerRole] = useState(null);

  const [truckers, setTruckers] = useState([]);
  const [loadingTruckers, setLoadingTruckers] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [completedTruckerIds, setCompletedTruckerIds] = useState(new Set());

  const [equipmentFilter, setEquipmentFilter] = useState(null);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [radiusMiles, setRadiusMiles] = useState(150);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPoint, setSearchPoint] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const [savingAlert, setSavingAlert] = useState(false);
  const [alertSaved, setAlertSaved] = useState(false);

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role === "trucker") {
      router.push("/dashboard");
      return;
    }
    setUserId(user.id);
    setPartnerRole(profile?.role || null);
    setCheckingAccess(false);
  }

  const loadTruckers = useCallback(async () => {
    setLoadingTruckers(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, company_name, equipment_types, fleet_size, dot_number, available_now, available_since, available_lat, available_lng, available_location_label, city, state, created_at"
      )
      .eq("role", "trucker");
    setTruckers(data || []);
    setLoadingTruckers(false);
  }, []);

  const loadSaved = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("saved_carriers").select("trucker_id").eq("partner_id", userId);
    setSavedIds(new Set((data || []).map((r) => r.trucker_id)));
  }, [userId]);

  // "No completed loads yet" is scoped to loads completed WITH this broker —
  // not a global reputation signal — so it never requires visibility into
  // another broker's history.
  const loadCompletedHistory = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("bols").select("trucker_id").eq("broker_id", userId).eq("status", "completed");
    setCompletedTruckerIds(new Set((data || []).map((r) => r.trucker_id)));
  }, [userId]);

  useEffect(() => {
    if (checkingAccess) return;
    loadTruckers();
    const interval = setInterval(loadTruckers, 60000);
    return () => clearInterval(interval);
  }, [checkingAccess, loadTruckers]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    loadCompletedHistory();
  }, [loadCompletedHistory]);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) {
      setSearchSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch("/api/here/autocomplete?" + params.toString(), { headers: await authHeaders() });
      const data = await res.json();
      setSearchSuggestions((data.items || []).filter((i) => i.lat !== null && i.lng !== null));
    } catch {
      // silent fail on suggestions
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, fetchSuggestions]);

  function selectSearchPlace(place) {
    setSearchPoint({ lat: place.lat, lng: place.lng, label: place.address });
    setSearchQuery(place.address);
    setShowSuggestions(false);
    setAlertSaved(false);
  }

  function useMyLocation() {
    setLocateError("");
    if (!navigator.geolocation) {
      setLocateError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your current location" });
        setSearchQuery("Your current location");
        setLocating(false);
        setAlertSaved(false);
      },
      (err) => {
        setLocateError("Couldn't get your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function toggleSave(truckerId) {
    setBusyId(truckerId);
    if (savedIds.has(truckerId)) {
      await supabase.from("saved_carriers").delete().eq("partner_id", userId).eq("trucker_id", truckerId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(truckerId);
        return next;
      });
    } else {
      await supabase.from("saved_carriers").insert({ partner_id: userId, trucker_id: truckerId });
      setSavedIds((prev) => new Set(prev).add(truckerId));
    }
    setBusyId(null);
  }

  async function messageCarrier(truckerId) {
    setBusyId(truckerId);
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("trucker_id", truckerId)
      .eq("partner_id", userId)
      .maybeSingle();
    let matchId = existing?.id;
    if (!matchId) {
      const { data: created, error } = await supabase
        .from("matches")
        .insert({ trucker_id: truckerId, partner_id: userId, partner_role: partnerRole, status: "pending" })
        .select("id")
        .single();
      if (error) {
        alert("Couldn't start a conversation: " + error.message);
        setBusyId(null);
        return;
      }
      matchId = created.id;
    }
    router.push("/dashboard?openMatch=" + matchId);
  }

  async function saveAlert() {
    if (!searchPoint || !userId) return;
    setSavingAlert(true);
    const { error } = await supabase.from("capacity_alerts").insert({
      broker_id: userId,
      location_label: searchPoint.label,
      location_lat: searchPoint.lat,
      location_lng: searchPoint.lng,
      radius_miles: radiusMiles,
      equipment_type: equipmentFilter || null,
    });
    setSavingAlert(false);
    if (!error) setAlertSaved(true);
  }

  const filteredTruckers = truckers
    .filter((t) => !equipmentFilter || (t.equipment_types || []).includes(equipmentFilter))
    .filter((t) => !availableOnly || isActive(t.available_now, t.available_since))
    .map((t) => ({
      ...t,
      isCurrentlyAvailable: isActive(t.available_now, t.available_since),
      isNew: isNewCarrier(t.created_at),
      isUnverified: !t.dot_number,
      hasNoCompletedLoadsWithYou: !completedTruckerIds.has(t.id),
      distanceMiles:
        searchPoint && t.available_lat != null && t.available_lng != null
          ? haversineMiles(searchPoint.lat, searchPoint.lng, t.available_lat, t.available_lng)
          : null,
    }))
    .filter((t) => {
      if (!searchPoint) return true;
      if (t.distanceMiles === null) return false;
      return t.distanceMiles <= radiusMiles;
    })
    .sort((a, b) => {
      if (searchPoint) return a.distanceMiles - b.distanceMiles;
      return (a.company_name || "").localeCompare(b.company_name || "");
    });

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Truck size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Search Carriers</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Search every carrier on Backhaul, not just those posted as available right now. Filter by
          equipment, location, and deadhead radius, save the ones you work with, and set up an alert so
          we tell you the moment new capacity opens up near a lane you care about.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setEquipmentFilter(null)}
            className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
              !equipmentFilter
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            All Equipment
          </button>
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq.id}
              onClick={() => setEquipmentFilter(eq.id)}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                equipmentFilter === eq.id
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setAvailableOnly((v) => !v)}
            className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
              availableOnly
                ? "bg-green-600/20 border-green-600 text-green-400"
                : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            {availableOnly ? "Showing: Currently Available Only" : "Showing: All Carriers"}
          </button>
        </div>

        <div className="relative mb-2 bg-slate-900 border border-slate-800 rounded-md p-3">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Search near a location (sorts by distance and enables the deadhead radius filter below)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchPoint(null);
                  setAlertSaved(false);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="City, address, or zip"
                className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                  {searchSuggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectSearchPlace(s)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 flex items-start gap-2"
                    >
                      <MapPin size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
                      <span>{s.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={useMyLocation}
              disabled={locating}
              className="shrink-0 flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-gray-300 text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md disabled:opacity-50"
            >
              <Crosshair size={14} />
              {locating ? "Locating..." : "Use My Location"}
            </button>
          </div>
          {locateError && <p className="text-xs text-red-400 mt-1">{locateError}</p>}

          {searchPoint && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800">
              <label className="text-xs text-gray-400">
                Deadhead radius:{" "}
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={radiusMiles}
                  onChange={(e) => {
                    setRadiusMiles(Number(e.target.value) || 0);
                    setAlertSaved(false);
                  }}
                  className="w-20 bg-slate-950 border border-slate-800 text-white text-xs rounded-md py-1 px-2 ml-1"
                />{" "}
                miles
              </label>
              <button
                onClick={saveAlert}
                disabled={savingAlert || alertSaved}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md"
              >
                <Bell size={13} />
                {alertSaved ? "Alert Saved" : savingAlert ? "Saving..." : "Notify Me of New Capacity Here"}
              </button>
              <span className="text-[11px] text-gray-500">
                We'll ping you when a matching carrier goes available in this radius —{" "}
                <Link href="/broker/capacity-alerts" className="underline hover:text-amber-400">
                  manage your alerts
                </Link>
                .
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 mt-6">
          {loadingTruckers ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading carriers...
            </p>
          ) : filteredTruckers.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Truck size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No carriers match these filters right now.</p>
              <p className="text-gray-600 text-xs mt-1">Try widening the radius or clearing a filter.</p>
            </div>
          ) : (
            filteredTruckers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-md px-4 py-3 transition gap-3"
              >
                <Link href={"/company/" + t.id} className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border " +
                      (t.isCurrentlyAvailable
                        ? "bg-green-500/15 border-green-500/40"
                        : "bg-slate-800 border-slate-700")
                    }
                  >
                    <Truck size={16} className={t.isCurrentlyAvailable ? "text-green-400" : "text-gray-500"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.company_name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {(t.equipment_types || []).slice(0, 3).map((eq) => (
                        <span
                          key={eq}
                          className="text-[10px] uppercase tracking-wide text-gray-500 bg-slate-800 rounded px-1.5 py-0.5"
                        >
                          {EQUIPMENT_OPTIONS.find((o) => o.id === eq)?.label || eq}
                        </span>
                      ))}
                      {t.fleet_size && (
                        <span className="text-[10px] text-gray-500">Fleet: {t.fleet_size}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <BadgeCheck size={10} /> {t.dot_number ? "DOT on file: " + t.dot_number : "No DOT on file"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {t.isNew && (
                        <span className="text-[9px] uppercase tracking-wide text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5">
                          New Carrier
                        </span>
                      )}
                      {t.isUnverified && (
                        <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                          <ShieldAlert size={9} /> Unverified
                        </span>
                      )}
                      {t.hasNoCompletedLoadsWithYou && (
                        <span className="text-[9px] uppercase tracking-wide text-gray-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                          No completed loads with you yet
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  {t.distanceMiles !== null && (
                    <p className="text-sm font-semibold text-white">{Math.round(t.distanceMiles)} mi away</p>
                  )}
                  {t.isCurrentlyAvailable && (
                    <p className="text-[11px] text-green-400 flex items-center gap-1 justify-end">
                      <Clock size={10} /> Available now
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      onClick={() => toggleSave(t.id)}
                      disabled={busyId === t.id}
                      title={savedIds.has(t.id) ? "Remove from saved carriers" : "Save carrier"}
                      className={
                        "p-1.5 rounded-md border text-xs disabled:opacity-50 " +
                        (savedIds.has(t.id)
                          ? "bg-amber-500/20 border-amber-500 text-amber-400"
                          : "bg-slate-950 border-slate-800 text-gray-400 hover:text-white")
                      }
                    >
                      <Star size={13} fill={savedIds.has(t.id) ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => messageCarrier(t.id)}
                      disabled={busyId === t.id}
                      title="Message this carrier"
                      className="p-1.5 rounded-md border border-slate-800 bg-slate-950 text-gray-400 hover:text-white disabled:opacity-50"
                    >
                      <MessageCircle size={13} />
                    </button>
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
