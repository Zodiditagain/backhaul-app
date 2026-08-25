"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  Handshake,
  DollarSign,
  Bell,
  Search,
  MapPin,
  Crosshair,
  Star,
  MessageCircle,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
  Gift,
  BarChart3,
  LifeBuoy,
  Clock,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase, authHeaders } from "../lib/supabaseClient";
import MatchThread from "./MatchThread";

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

// Friendly, activity-feed phrasing for each stage of the existing BOL
// lifecycle (see components/BolForm.jsx / MatchThread.jsx) — no new schema,
// just a nicer label than the raw status string.
const BOL_ACTIVITY_LABEL = {
  draft: "Started a bill of lading",
  sent: "Sent a bill of lading for carrier review",
  accepted: "Carrier accepted the bill of lading",
  correction_requested: "Carrier requested a correction",
  ready_for_pickup: "Load marked ready for pickup",
  signed_at_pickup: "Carrier signed at pickup",
  in_transit: "Load in transit",
  delivered: "Load marked delivered",
  receiver_signed: "Receiver signed for the load",
  completed: "Load completed",
};

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isActive(availableNow, availableSince) {
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

export default function BrokerOverview({ user, role }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [tipOfDay, setTipOfDay] = useState(null);

  const [availableTruckers, setAvailableTruckers] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [activeOfferCount, setActiveOfferCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState([]);

  const [recommended, setRecommended] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [busyId, setBusyId] = useState(null);

  const [activity, setActivity] = useState([]);

  const [openMatch, setOpenMatch] = useState(null);

  // Quick search panel state
  const [equipmentFilter, setEquipmentFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPoint, setSearchPoint] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  // Capacity map
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersGroupRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState("");

  const loadAll = useCallback(async () => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_name, onboarding_completed")
      .eq("id", user.id)
      .single();
    setCompanyName(profileData?.company_name || "");
    setOnboardingCompleted(Boolean(profileData?.onboarding_completed));

    const { data: tipsData } = await supabase
      .from("safety_tips")
      .select("title, body")
      .in("audience", ["all", "broker_vendor"])
      .order("sort_order", { ascending: true });
    if (tipsData && tipsData.length > 0) {
      const startOfYear = new Date(new Date().getFullYear(), 0, 0);
      const dayOfYear = Math.floor((new Date() - startOfYear) / 86400000);
      setTipOfDay(tipsData[dayOfYear % tipsData.length]);
    }

    const { data: matchData } = await supabase
      .from("matches")
      .select("id, trucker_id, status, created_at, trucker:profiles!matches_trucker_id_fkey(id, company_name)")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false });
    const matches = matchData || [];
    setMatchCount(matches.filter((m) => m.status === "accepted").length);

    const acceptedIds = matches.filter((m) => m.status === "accepted").map((m) => m.id);
    let offerCount = 0;
    if (acceptedIds.length > 0) {
      const { data: rateMsgs } = await supabase
        .from("messages")
        .select("match_id")
        .in("match_id", acceptedIds)
        .not("rate", "is", null);
      offerCount = new Set((rateMsgs || []).map((m) => m.match_id)).size;
    }
    setActiveOfferCount(offerCount);

    const { data: alertsData } = await supabase
      .from("capacity_alerts")
      .select("id, location_label, location_lat, location_lng, created_at")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false });
    const alerts = alertsData || [];
    setAlertCount(alerts.length);
    setRecentAlerts(alerts);

    const { data: savedData } = await supabase
      .from("saved_carriers")
      .select("trucker_id, created_at")
      .eq("partner_id", user.id);
    const saved = savedData || [];
    setSavedIds(new Set(saved.map((s) => s.trucker_id)));

    const { data: truckerData } = await supabase
      .from("profiles")
      .select(
        "id, company_name, equipment_types, fleet_size, dot_number, available_now, available_since, available_lat, available_lng, available_location_label, created_at"
      )
      .eq("role", "trucker");
    const truckers = truckerData || [];
    const activeTruckers = truckers.filter((t) => isActive(t.available_now, t.available_since));
    setAvailableTruckers(activeTruckers);

    const matchedIds = new Set(matches.map((m) => m.trucker_id));
    const savedIdSet = new Set(saved.map((s) => s.trucker_id));
    const rec = truckers
      .filter((t) => !matchedIds.has(t.id) && !savedIdSet.has(t.id))
      .sort((a, b) => {
        const aActive = isActive(a.available_now, a.available_since);
        const bActive = isActive(b.available_now, b.available_since);
        if (aActive !== bActive) return aActive ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, 6);
    setRecommended(rec);

    // Recent activity — merged from existing tables (matches, saved
    // carriers, capacity alerts, BOL audit trail). No new table: everything
    // here already exists to back its own feature, this just reads it back
    // in one timeline.
    const events = [];
    matches.slice(0, 10).forEach((m) => {
      events.push({
        id: "match-" + m.id,
        icon: Handshake,
        label:
          m.status === "accepted"
            ? `Connected with ${m.trucker?.company_name || "a carrier"}`
            : `Match request sent to ${m.trucker?.company_name || "a carrier"}`,
        href: `/dashboard?openMatch=${m.id}`,
        at: m.created_at,
      });
    });
    saved.slice(0, 10).forEach((s) => {
      const t = truckers.find((tr) => tr.id === s.trucker_id);
      events.push({
        id: "saved-" + s.trucker_id + s.created_at,
        icon: Star,
        label: `Saved ${t?.company_name || "a carrier"} as a go-to carrier`,
        href: `/company/${s.trucker_id}`,
        at: s.created_at,
      });
    });
    alerts.slice(0, 10).forEach((a) => {
      events.push({
        id: "alert-" + a.id,
        icon: Bell,
        label: `Set a capacity alert for ${a.location_label}`,
        href: "/broker/capacity-alerts",
        at: a.created_at,
      });
    });

    const { data: bolRows } = await supabase
      .from("bols")
      .select("id, bol_number, status, trucker_id, match_id, created_at, updated_at")
      .eq("broker_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);
    (bolRows || []).forEach((b) => {
      const t = truckers.find((tr) => tr.id === b.trucker_id);
      events.push({
        id: "bol-" + b.id,
        icon: Truck,
        label: `${BOL_ACTIVITY_LABEL[b.status] || "Updated a bill of lading"} — ${
          b.bol_number ? "Load #" + b.bol_number : "a load"
        }${t ? " with " + t.company_name : ""}`,
        href: b.match_id ? `/dashboard?openMatch=${b.match_id}` : "/admin",
        at: b.updated_at || b.created_at,
      });
    });

    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    setActivity(events.slice(0, 8));

    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Deep-link support: notifications and the Messages inbox both link here
  // as /dashboard?openMatch=<id>. The redesigned overview doesn't have a
  // persistent thread panel anymore, so open the conversation in an overlay
  // instead, reusing the existing MatchThread component untouched.
  useEffect(() => {
    const id = searchParams.get("openMatch");
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, trucker:profiles!matches_trucker_id_fkey(id, company_name, role)")
        .eq("id", id)
        .eq("partner_id", user.id)
        .maybeSingle();
      if (data) setOpenMatch(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function toggleSave(truckerId) {
    setBusyId(truckerId);
    if (savedIds.has(truckerId)) {
      await supabase.from("saved_carriers").delete().eq("partner_id", user.id).eq("trucker_id", truckerId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(truckerId);
        return next;
      });
    } else {
      await supabase.from("saved_carriers").insert({ partner_id: user.id, trucker_id: truckerId });
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
      .eq("partner_id", user.id)
      .maybeSingle();
    let matchId = existing?.id;
    if (!matchId) {
      const { data: created, error } = await supabase
        .from("matches")
        .insert({ trucker_id: truckerId, partner_id: user.id, partner_role: role, status: "pending" })
        .select("id")
        .single();
      if (error) {
        alert("Couldn't start a conversation: " + error.message);
        setBusyId(null);
        return;
      }
      matchId = created.id;
    }
    const { data: fullMatch } = await supabase
      .from("matches")
      .select("*, trucker:profiles!matches_trucker_id_fkey(id, company_name, role)")
      .eq("id", matchId)
      .single();
    setBusyId(null);
    if (fullMatch) setOpenMatch(fullMatch);
    loadAll();
  }

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
      },
      (err) => {
        setLocateError("Couldn't get your location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function submitQuickSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (equipmentFilter) params.set("equipment", equipmentFilter);
    if (searchPoint) {
      params.set("lat", String(searchPoint.lat));
      params.set("lng", String(searchPoint.lng));
      params.set("q", searchPoint.label);
    } else if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    router.push("/broker/search-carriers" + (params.toString() ? "?" + params.toString() : ""));
  }

  // ---- HERE Maps: script loader (same pattern as route-map/market-pulse) --
  useEffect(() => {
    if (window.H) {
      setMapsReady(true);
      return;
    }
    const cssHref = "https://js.api.here.com/v3/3.1/mapsjs-ui.css";
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssHref;
      document.head.appendChild(link);
    }
    const scripts = [
      "https://js.api.here.com/v3/3.1/mapsjs-core.js",
      "https://js.api.here.com/v3/3.1/mapsjs-service.js",
      "https://js.api.here.com/v3/3.1/mapsjs-ui.js",
      "https://js.api.here.com/v3/3.1/mapsjs-mapevents.js",
    ];
    let loadedCount = 0;
    scripts.forEach((src) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        loadedCount += 1;
        if (loadedCount === scripts.length) setMapsReady(true);
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        loadedCount += 1;
        if (loadedCount === scripts.length) setMapsReady(true);
      };
      // Surfaces a real message on the page itself instead of leaving the
      // map area blank forever with no clue why (e.g. a network block, an
      // ad/content blocker, or the HERE CDN being unreachable).
      script.onerror = () => {
        setMapError("Map scripts failed to load — check your connection and refresh the page.");
      };
      document.body.appendChild(script);
    });
    // Belt-and-suspenders: if nothing above ever flips mapsReady (script
    // tags silently never fire load/error — has happened with some browser
    // extensions), stop waiting forever and tell the user instead of
    // leaving a permanently empty gray box.
    const timeout = setTimeout(() => {
      if (!window.H) {
        setMapError((prev) => prev || "Map is taking too long to load — refresh the page to retry.");
      }
    }, 12000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;
    const apikey = process.env.NEXT_PUBLIC_HERE_MAPS_KEY;
    if (!apikey) {
      setMapError("Map isn't configured yet — NEXT_PUBLIC_HERE_MAPS_KEY is missing.");
      return;
    }
    try {
      const H = window.H;
      const platform = new H.service.Platform({ apikey });
      const defaultLayers = platform.createDefaultLayers();
      const exploreTileService = platform.getRasterTileService({
        queryParams: { style: "explore.day", size: "512", ppi: 400 },
      });
      const exploreTileProvider = new H.service.rasterTile.Provider(exploreTileService, { tileSize: 512 });
      const exploreLayer = new H.map.layer.TileLayer(exploreTileProvider);
      const map = new H.Map(mapRef.current, exploreLayer, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        pixelRatio: window.devicePixelRatio || 1,
      });
      new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
      const ui = H.ui.UI.createDefault(map, defaultLayers);
      try {
        ui.removeControl("mapsettings");
      } catch {
        // control id not found on this SDK version — leave native control in place
      }
      markersGroupRef.current = new H.map.Group();
      map.addObject(markersGroupRef.current);
      mapInstance.current = map;
      // This map sits in a two-column CSS grid (a narrower sidebar column
      // next to it), unlike the single-column route-map/market-pulse pages.
      // HERE Maps measures its container's size once at construction — if
      // the grid hadn't finished laying out yet at that instant, the map
      // can end up thinking its container is 0x0 (or the wrong size) and
      // render nothing, with no thrown error. A one-time delayed resize
      // isn't reliable enough here, so instead watch the container with a
      // ResizeObserver and re-resize the viewport on every real size
      // change — this also keeps the map correctly sized if the sidebar
      // collapses/expands or the window resizes later.
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          try {
            mapInstance.current.getViewPort().resize();
          } catch {
            // viewport not ready yet — next observed change will retry
          }
        }
      });
      resizeObserver.observe(mapRef.current);
      const resizeHandler = () => map.getViewPort().resize();
      window.addEventListener("resize", resizeHandler);
      return () => {
        window.removeEventListener("resize", resizeHandler);
        resizeObserver.disconnect();
      };
    } catch (err) {
      console.error("Capacity map failed to initialize:", err);
      setMapError("Map failed to load: " + (err?.message || "unknown error"));
    }
  }, [mapsReady]);

  useEffect(() => {
    const H = window.H;
    const map = mapInstance.current;
    const group = markersGroupRef.current;
    if (!H || !map || !group) return;
    try {
      group.removeAll();
      // Guard against bad/partial DB rows (e.g. an alert saved before a
      // column existed, or a non-numeric type from Supabase) — an uncaught
      // exception in here would silently corrupt the map's render state
      // with zero visible indication on the page.
      const plotted = availableTruckers.filter(
        (t) => Number.isFinite(t.available_lat) && Number.isFinite(t.available_lng)
      );
      plotted.forEach((t) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="10" fill="#06b6d4" fill-opacity="0.9" stroke="white" stroke-width="2"/></svg>`;
        const icon = new H.map.Icon(svg, { size: { w: 26, h: 26 }, anchor: { x: 13, y: 13 } });
        const marker = new H.map.Marker({ lat: t.available_lat, lng: t.available_lng }, { icon });
        marker.setData(t.id);
        marker.addEventListener("tap", (evt) => router.push(`/company/${evt.target.getData()}`));
        group.addObject(marker);
      });
      const center = recentAlerts[0];
      if (center && Number.isFinite(center.location_lat) && Number.isFinite(center.location_lng)) {
        map.setCenter({ lat: center.location_lat, lng: center.location_lng });
        map.setZoom(7);
      } else if (plotted.length > 0) {
        try {
          map.getViewModel().setLookAtData({ bounds: group.getBoundingBox() });
        } catch {
          // bounding box unavailable with a single point — leave default view
        }
      }
    } catch (err) {
      console.error("Capacity map marker/recenter update failed:", err);
    }
  }, [availableTruckers, recentAlerts, mapsReady, router]);

  const firstName = (companyName || "there").split(" ")[0];

  if (loading) {
    return (
      <p className="text-slate-500 text-sm flex items-center gap-2 py-10">
        <Loader2 size={14} className="animate-spin" /> Loading your dashboard...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Good morning, {firstName}</h2>
        <p className="text-slate-500 text-sm mt-1">Here's what's happening in your network.</p>
      </div>

      {!onboardingCompleted && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-500 shrink-0" />
            <p className="text-sm text-slate-800">
              <span className="font-semibold">Your profile is incomplete.</span> Carriers can't see your
              services, coverage area, or company details yet.
            </p>
          </div>
          <Link
            href="/onboarding-partner"
            className="shrink-0 bg-slate-900 hover:bg-black text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md whitespace-nowrap"
          >
            Complete profile
          </Link>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={Truck}
          label="Available Trucks"
          value={availableTruckers.length}
          href="/available-trucks"
        />
        <StatTile icon={Handshake} label="Carrier Matches" value={matchCount} href="/messages" />
        <StatTile icon={DollarSign} label="Active Offers" value={activeOfferCount} href="/messages" />
        <StatTile icon={Bell} label="Capacity Alerts" value={alertCount} href="/broker/capacity-alerts" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Find a Carrier */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search size={17} className="text-cyan-600" />
              <h3 className="font-bold text-slate-900">Find a Carrier</h3>
            </div>
            <form onSubmit={submitQuickSearch}>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setEquipmentFilter(null)}
                  className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1.5 rounded-md border ${
                    !equipmentFilter
                      ? "bg-cyan-600 border-cyan-600 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All Equipment
                </button>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <button
                    type="button"
                    key={eq.id}
                    onClick={() => setEquipmentFilter(eq.id)}
                    className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1.5 rounded-md border ${
                      equipmentFilter === eq.id
                        ? "bg-cyan-600 border-cyan-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
              <div className="relative flex gap-2">
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-cyan-500"
                  />
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md overflow-hidden shadow-lg">
                      {searchSuggestions.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => selectSearchPlace(s)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-start gap-2"
                        >
                          <MapPin size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
                          <span>{s.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="shrink-0 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wide px-3 py-2.5 rounded-md disabled:opacity-50"
                >
                  <Crosshair size={14} />
                  {locating ? "Locating..." : "My Location"}
                </button>
                <button
                  type="submit"
                  className="shrink-0 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold uppercase tracking-wide px-4 py-2.5 rounded-md"
                >
                  Search
                </button>
              </div>
              {locateError && <p className="text-xs text-red-500 mt-1">{locateError}</p>}
            </form>
          </section>

          {/* Recommended Carriers */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star size={17} className="text-cyan-600" />
                <h3 className="font-bold text-slate-900">Recommended Carriers</h3>
              </div>
              <Link href="/broker/search-carriers" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700">
                View all
              </Link>
            </div>
            {recommended.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4">No new carriers to recommend right now — check back soon.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {recommended.map((t) => {
                  const active = isActive(t.available_now, t.available_since);
                  const unverified = !t.dot_number;
                  return (
                    <div key={t.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/company/${t.id}`} className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate hover:text-cyan-700">
                            {t.company_name}
                          </p>
                        </Link>
                        {active && (
                          <span className="text-[9px] uppercase tracking-wide text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 shrink-0 flex items-center gap-1">
                            <Clock size={9} /> Available
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {(t.equipment_types || []).slice(0, 2).map((eq) => (
                          <span key={eq} className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                            {EQUIPMENT_OPTIONS.find((o) => o.id === eq)?.label || eq}
                          </span>
                        ))}
                        {unverified ? (
                          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            <ShieldAlert size={9} /> Unverified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-1.5 py-0.5">
                            <BadgeCheck size={9} /> Verified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <button
                          onClick={() => toggleSave(t.id)}
                          disabled={busyId === t.id}
                          className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:text-amber-500 disabled:opacity-50"
                          title="Save carrier"
                        >
                          <Star size={13} />
                        </button>
                        <button
                          onClick={() => messageCarrier(t.id)}
                          disabled={busyId === t.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-cyan-200 bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 disabled:opacity-50"
                        >
                          <MessageCircle size={13} /> Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Capacity map */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={17} className="text-cyan-600" />
              <h3 className="font-bold text-slate-900">Capacity Near You</h3>
              <span className="text-xs text-slate-400 ml-auto">{availableTruckers.length} truck(s) available now</span>
            </div>
            {mapError ? (
              <p className="text-xs text-slate-400 py-6 text-center">{mapError}</p>
            ) : (
              <div ref={mapRef} className="w-full h-72 rounded-lg overflow-hidden bg-slate-100" />
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6 min-w-0">
          {tipOfDay && (
            <section className="bg-white border border-cyan-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck size={14} className="text-cyan-600" />
                <p className="text-cyan-700 text-[10px] uppercase tracking-widest font-semibold">Protect Every Shipment</p>
              </div>
              <p className="text-slate-900 font-semibold text-sm mb-1">{tipOfDay.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{tipOfDay.body}</p>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Recent Activity</h3>
            {activity.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Nothing yet — your activity will show up here.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((e) => {
                  const Icon = e.icon;
                  return (
                    <Link key={e.id} href={e.href} className="flex items-start gap-2.5 group">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-cyan-50">
                        <Icon size={12} className="text-slate-500 group-hover:text-cyan-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700 group-hover:text-slate-900 leading-snug">{e.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(e.at)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-3">
            <TeaserCard icon={Gift} title="Grow Your Network" subtitle="Earn credit for every referral" href="/broker/referrals" />
            <TeaserCard icon={BarChart3} title="Network Insights" subtitle="See your matching trends" href="/broker/analytics" />
            <TeaserCard icon={LifeBuoy} title="Need Help?" subtitle="We're here for you" href="/support" />
          </div>
        </div>
      </div>

      {openMatch && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setOpenMatch(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">{openMatch.trucker?.company_name || "Conversation"}</h3>
              <button onClick={() => setOpenMatch(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <MatchThread match={openMatch} user={user} role={role} onMessageSent={loadAll} onReviewSubmitted={loadAll} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, href }) {
  return (
    <Link href={href} className="bg-white border border-slate-200 hover:border-cyan-300 rounded-xl p-4 flex flex-col gap-2 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</span>
        <div className="w-7 h-7 rounded-md bg-cyan-50 flex items-center justify-center">
          <Icon size={14} className="text-cyan-600" />
        </div>
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
    </Link>
  );
}

function TeaserCard({ icon: Icon, title, subtitle, href }) {
  return (
    <Link href={href} className="bg-white border border-slate-200 hover:border-cyan-300 rounded-xl p-4 flex items-center gap-3 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </Link>
  );
}
