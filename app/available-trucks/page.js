"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, MapPin, Clock, Loader2, Crosshair } from "lucide-react";
import { supabase, authHeaders } from "../../lib/supabaseClient";
import { formatMinutesAgo } from "../../lib/marketPulseData";

// Available postings are treated as live only for this many hours after the
// trucker taps "I'm Available" — after that they silently drop off this list
// even if the trucker never explicitly marks themselves booked. There's no
// background job flipping a database flag; this window is applied whenever
// the list is read, both here and on the trucker's own dashboard.
const AVAILABILITY_WINDOW_HOURS = 6;

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

function minutesAgo(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function AvailableTrucksPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const [trucks, setTrucks] = useState([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);

  const [equipmentFilter, setEquipmentFilter] = useState(null); // null = all

  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPoint, setSearchPoint] = useState(null); // {lat, lng, label}
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "trucker") {
      router.push("/dashboard");
      return;
    }
    setHasAccess(true);
    setCheckingAccess(false);
  }

  const loadTrucks = useCallback(async () => {
    setLoadingTrucks(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, company_name, equipment_types, available_now, available_since, available_lat, available_lng, available_location_label"
      )
      .eq("role", "trucker")
      .eq("available_now", true);
    setTrucks((data || []).filter((t) => isActive(t.available_now, t.available_since)));
    setLoadingTrucks(false);
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    loadTrucks();
    // Postings expire on a rolling window rather than a background job, so
    // refresh periodically to drop trucks that just aged out.
    const interval = setInterval(loadTrucks, 60000);
    return () => clearInterval(interval);
  }, [hasAccess, loadTrucks]);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.trim().length < 3) {
      setSearchSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch(`/api/here/autocomplete?${params.toString()}`, { headers: await authHeaders() });
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
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSearchPoint({ lat, lng, label: "Your current location" });
        setSearchQuery("Your current location");
        setLocating(false);
      },
      (err) => {
        setLocateError("Couldn't get your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const filteredTrucks = trucks
    .filter((t) => !equipmentFilter || (t.equipment_types || []).includes(equipmentFilter))
    .map((t) => ({
      ...t,
      distanceMiles: searchPoint
        ? haversineMiles(searchPoint.lat, searchPoint.lng, t.available_lat, t.available_lng)
        : null,
    }))
    .sort((a, b) => {
      if (searchPoint) return a.distanceMiles - b.distanceMiles;
      return new Date(b.available_since) - new Date(a.available_since);
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
          <h1 className="text-2xl font-bold text-white">Available Trucks</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Truckers who've marked themselves available for a backhaul in the last{" "}
          {AVAILABILITY_WINDOW_HOURS} hours. Postings expire automatically so this list stays
          current — free for everyone, no subscription required.
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

        <div className="relative mb-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Search near a location (optional — sorts by distance)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchPoint(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="City, address, or zip"
                className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
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
              className="shrink-0 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-gray-300 text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md disabled:opacity-50"
            >
              <Crosshair size={14} />
              {locating ? "Locating..." : "Use My Location"}
            </button>
          </div>
          {locateError && <p className="text-xs text-red-400 mt-1">{locateError}</p>}
        </div>

        <div className="space-y-2 mt-6">
          {loadingTrucks ? (
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading available trucks...
            </p>
          ) : filteredTrucks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-md p-8 text-center">
              <Truck size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                No trucks currently available{equipmentFilter ? " for that equipment type" : ""}.
              </p>
              <p className="text-gray-600 text-xs mt-1">Check back soon — postings refresh automatically.</p>
            </div>
          ) : (
            filteredTrucks.map((t) => (
              <Link
                key={t.id}
                href={`/company/${t.id}`}
                className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-md px-4 py-3 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center shrink-0">
                    <Truck size={16} className="text-green-400" />
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
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {t.distanceMiles !== null && (
                    <p className="text-sm font-semibold text-white">{Math.round(t.distanceMiles)} mi away</p>
                  )}
                  <p className="text-[11px] text-gray-500 flex items-center gap-1 justify-end">
                    <MapPin size={10} /> {t.available_location_label || "Location unavailable"}
                  </p>
                  <p className="text-[11px] text-gray-600 flex items-center gap-1 justify-end mt-0.5">
                    <Clock size={10} /> {formatMinutesAgo(minutesAgo(t.available_since))}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
