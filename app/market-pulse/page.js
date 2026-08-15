"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  MapPin,
  Loader2,
  Info,
  Clock,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import {
  MARKETS,
  EQUIPMENT_TYPES,
  TIER_META,
  findMarket,
  lanesFromMarket,
  lanesBetween,
  nearestMarket,
  formatMinutesAgo,
  rateTier,
  confidenceFromCount,
} from "../../lib/marketPulseData";

export default function MarketPulsePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const [mapsReady, setMapsReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const platformRef = useRef(null);
  const marketMarkersGroup = useRef(null);

  const [equipment, setEquipment] = useState("van");
  const [selectedSlug, setSelectedSlug] = useState(null);

  const [originQuery, setOriginQuery] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [showOriginList, setShowOriginList] = useState(false);
  const [originSlug, setOriginSlug] = useState(null);

  const [destQuery, setDestQuery] = useState("");
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showDestList, setShowDestList] = useState(false);
  const [destSlug, setDestSlug] = useState(null);

  const [laneResult, setLaneResult] = useState(null);
  const [laneError, setLaneError] = useState("");
  const [laneMarketSlugs, setLaneMarketSlugs] = useState(null);

  // Real, BackHaul-verified rate data derived from completed Bills of Lading
  // (see app/api/market-pulse/real-stats/route.js). Only ever aggregates —
  // never raw loads or identities — and only appears once enough completed
  // loads exist for a given market/lane + equipment. Everything else on this
  // page (including all "Market Estimate" figures) stays synthetic until a
  // licensed rate-data provider is integrated.
  const [realStats, setRealStats] = useState({ marketStats: {}, laneStats: {} });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    fetch("/api/market-pulse/real-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setRealStats({ marketStats: data.marketStats || {}, laneStats: data.laneStats || {} });
        }
      })
      .catch(() => {
        // Real data is a bonus layer on top of the synthetic estimates —
        // silently fall back rather than blocking the page.
      });
    return () => {
      cancelled = true;
    };
  }, [hasAccess]);

  // Blends a market's synthetic per-equipment stat with real completed-load
  // data where available. "Market Estimate" is intentionally left untouched
  // (always synthetic) — only the "Verified Avg" side ever gets replaced.
  const getBlendedStat = useCallback(
    (market, equipmentKey) => {
      const base = market.equipment[equipmentKey];
      const real = realStats.marketStats?.[market.slug]?.[equipmentKey];
      if (!real) return { ...base, live: false };
      return {
        ...base,
        verifiedAvg: real.avgRate,
        transactionCount: real.count,
        confidence: confidenceFromCount(real.count),
        tier: rateTier(real.avgRate),
        live: true,
        lastUpdated: real.lastUpdated,
      };
    },
    [realStats]
  );

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("product", "market_pulse")
      .in("status", ["trialing", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      router.push("/market-pulse/subscribe");
      return;
    }
    setHasAccess(true);
    setCheckingAccess(false);
  }

  // Load the HERE Maps JS API — same script set already proven safe on the
  // Route Map page (core/service/ui/mapevents, no HARP engine).
  useEffect(() => {
    if (!hasAccess) return;
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
      document.body.appendChild(script);
    });
  }, [hasAccess]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;
    const H = window.H;
    const apikey = process.env.NEXT_PUBLIC_HERE_MAPS_KEY;
    const platform = new H.service.Platform({ apikey });
    platformRef.current = platform;
    const defaultLayers = platform.createDefaultLayers();
    const exploreTileService = platform.getRasterTileService({
      queryParams: { style: "explore.day", size: "512", ppi: 400 },
    });
    const exploreTileProvider = new H.service.rasterTile.Provider(exploreTileService, { tileSize: 512 });
    const exploreLayer = new H.map.layer.TileLayer(exploreTileProvider);
    const map = new H.Map(mapRef.current, exploreLayer, {
      center: { lat: 39.5, lng: -98.35 },
      zoom: 4,
      pixelRatio: window.devicePixelRatio || 1,
    });
    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    const ui = H.ui.UI.createDefault(map, defaultLayers);
    try {
      ui.removeControl("mapsettings");
    } catch {}
    try {
      ui.removeControl("zoom");
    } catch {}
    marketMarkersGroup.current = new H.map.Group();
    map.addObject(marketMarkersGroup.current);
    mapInstance.current = map;
    const resizeHandler = () => map.getViewPort().resize();
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
  }, [mapsReady]);

  // (Re)draw the colored market markers whenever the equipment filter or map
  // readiness changes.
  useEffect(() => {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map || !marketMarkersGroup.current) return;
    marketMarkersGroup.current.removeAll();
    MARKETS.forEach((market) => {
      const stat = getBlendedStat(market, equipment);
      const tierMeta = TIER_META[stat.tier];
      const radius = 10 + Math.min(10, stat.transactionCount / 10);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${radius * 2 + 6}" height="${radius * 2 + 6}" viewBox="0 0 ${radius * 2 + 6} ${radius * 2 + 6}">
        <circle cx="${radius + 3}" cy="${radius + 3}" r="${radius}" fill="${tierMeta.color}" fill-opacity="0.85" stroke="white" stroke-width="2"/>
      </svg>`;
      const icon = new H.map.Icon(svg, {
        size: { w: radius * 2 + 6, h: radius * 2 + 6 },
        anchor: { x: radius + 3, y: radius + 3 },
      });
      const marker = new H.map.Marker({ lat: market.lat, lng: market.lng }, { icon });
      marker.setData(market.slug);
      marker.addEventListener("tap", (evt) => {
        setSelectedSlug(evt.target.getData());
      });
      marketMarkersGroup.current.addObject(marker);
    });
  }, [equipment, mapsReady, getBlendedStat]);

  const fetchPlaceSuggestions = useCallback(async (q, kind) => {
    if (q.trim().length < 3) {
      kind === "origin" ? setOriginSuggestions([]) : setDestSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, lat: "39.5", lng: "-98.35" });
      const res = await fetch(`/api/here/autocomplete?${params.toString()}`);
      const data = await res.json();
      const items = (data.items || []).filter((i) => i.lat !== null && i.lng !== null);
      kind === "origin" ? setOriginSuggestions(items) : setDestSuggestions(items);
    } catch {
      // silent fail on suggestions
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPlaceSuggestions(originQuery, "origin"), 300);
    return () => clearTimeout(t);
  }, [originQuery, fetchPlaceSuggestions]);
  useEffect(() => {
    const t = setTimeout(() => fetchPlaceSuggestions(destQuery, "dest"), 300);
    return () => clearTimeout(t);
  }, [destQuery, fetchPlaceSuggestions]);

  function selectPlace(kind, place) {
    const nearest = nearestMarket(place.lat, place.lng);
    if (!nearest) {
      setLaneError("That location isn't near a market we cover yet.");
      return;
    }
    setLaneError("");
    if (kind === "origin") {
      setOriginQuery(place.address);
      setOriginSlug(nearest.market.slug);
      setShowOriginList(false);
    } else {
      setDestQuery(place.address);
      setDestSlug(nearest.market.slug);
      setShowDestList(false);
    }
  }

  function searchLane() {
    setLaneError("");
    setLaneResult(null);
    setLaneMarketSlugs(null);
    if (!originSlug || !destSlug) {
      setLaneError("Pick both an origin and a destination from the suggestions.");
      return;
    }
    if (originSlug === destSlug) {
      setLaneError("Origin and destination resolved to the same market — try a farther destination.");
      return;
    }
    const result = lanesBetween(originSlug, destSlug);
    setLaneResult(result);
    setLaneMarketSlugs({ origin: originSlug, dest: destSlug });
    setSelectedSlug(null);
  }

  // The lane search panel only ever compares dry-van rates (lanesBetween()
  // is van-only by design), so blending only needs to check the van bucket.
  const realLaneStat = laneMarketSlugs
    ? realStats.laneStats?.[`${laneMarketSlugs.origin}->${laneMarketSlugs.dest}`]?.van
    : null;
  const laneOutbound = laneResult
    ? realLaneStat
      ? {
          van: realLaneStat.avgRate,
          transactionCount: realLaneStat.count,
          confidence: confidenceFromCount(realLaneStat.count),
          tier: rateTier(realLaneStat.avgRate),
        }
      : laneResult.outbound
    : null;

  const selectedMarket = selectedSlug ? findMarket(selectedSlug) : null;
  const selectedLanes = selectedSlug ? lanesFromMarket(selectedSlug, 5) : [];

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={22} className="text-amber-400" />
          <h1 className="text-2xl font-bold text-white">BackHaul Market Pulse</h1>
          <span className="text-[10px] uppercase tracking-wide font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
            Nationwide
          </span>
          <span className="text-[10px] uppercase tracking-wide font-semibold bg-slate-800 text-gray-300 border border-slate-700 rounded-full px-2 py-0.5">
            Preview
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-6 max-w-2xl">
          Preview feature — market estimates blended with BackHaul's own anonymized, verified
          activity from completed loads — never a specific broker, carrier, customer, shipment,
          or rate confirmation. A green <span className="text-green-400 font-semibold">● Live</span> tag
          means that figure is a real average from completed BackHaul loads; everywhere else is
          still an illustrative estimate to help you negotiate, not a guaranteed booked rate, while
          we finish integrating a licensed rate-data source.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Equipment:</span>
          {EQUIPMENT_TYPES.map((eq) => (
            <button
              key={eq.key}
              onClick={() => setEquipment(eq.key)}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                equipment === eq.key
                  ? "bg-amber-600 border-amber-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1">Origin</label>
            <input
              value={originQuery}
              onChange={(e) => {
                setOriginQuery(e.target.value);
                setOriginSlug(null);
                setShowOriginList(true);
              }}
              onFocus={() => setShowOriginList(true)}
              placeholder="City, address, or zip"
              className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
            />
            {showOriginList && originSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                {originSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectPlace("origin", s)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 flex items-start gap-2"
                  >
                    <MapPin size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
                    <span>{s.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1">Destination</label>
            <input
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setDestSlug(null);
                setShowDestList(true);
              }}
              onFocus={() => setShowDestList(true)}
              placeholder="City, address, or zip"
              className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-amber-500"
            />
            {showDestList && destSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                {destSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectPlace("dest", s)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-800 flex items-start gap-2"
                  >
                    <MapPin size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
                    <span>{s.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={searchLane}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 px-5 rounded-md transition mb-4"
        >
          Search Lane
        </button>
        {laneError && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-md py-2 px-3 mb-4">
            {laneError}
          </div>
        )}

        {laneResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-md p-5 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {laneResult.originName} → {laneResult.destinationName} · {laneResult.miles} mi
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mt-3">
              <RateCard label="Market Estimate" value={laneResult.outbound.van} />
              <RateCard
                label="BackHaul Verified Avg"
                value={laneOutbound.van}
                highlight
                live={Boolean(realLaneStat)}
                sub={
                  realLaneStat
                    ? `Based on ${laneOutbound.transactionCount} completed, BackHaul-verified loads`
                    : `Based on ${laneOutbound.transactionCount} recent transactions`
                }
              />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Confidence</p>
                <p className="text-lg font-semibold text-white">{laneOutbound.confidence}</p>
                <TierBadge tier={laneOutbound.tier} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Reverse lane ({laneResult.destinationName} → {laneResult.originName}):{" "}
              <span className="text-gray-300 font-medium">
                $
                {(
                  (laneMarketSlugs &&
                    realStats.laneStats?.[`${laneMarketSlugs.dest}->${laneMarketSlugs.origin}`]?.van?.avgRate) ||
                  laneResult.inbound.van
                ).toFixed(2)}
                /mile
              </span>{" "}
              — directional rates can differ significantly on the same lane.
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {Object.entries(TIER_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: meta.color }} />
              {meta.label} <span className="text-gray-600">({meta.range})</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 relative">
            <div
              ref={mapRef}
              className="w-full h-[500px] rounded-md border border-slate-800 bg-slate-900"
            />
            {!mapsReady && <p className="text-gray-500 text-xs mt-2">Loading map...</p>}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-4 h-[500px] overflow-y-auto">
            {!selectedMarket ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-sm px-4">
                <Info size={20} className="mb-2 text-gray-600" />
                Tap a market on the map to see its rate breakdown and top lanes.
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {selectedMarket.name}, {selectedMarket.state} Outbound Market
                </p>
                <h3 className="text-lg font-bold text-white mb-3">
                  {EQUIPMENT_TYPES.find((e) => e.key === equipment).label}
                </h3>
                {(() => {
                  const stat = getBlendedStat(selectedMarket, equipment);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <RateCard label="Market Estimate" value={stat.marketEstimate} compact />
                        <RateCard label="Verified Avg" value={stat.verifiedAvg} compact highlight live={stat.live} />
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        Based on {stat.transactionCount} {stat.live ? "completed, BackHaul-verified loads" : "recent transactions"} · Confidence: {stat.confidence}
                      </p>
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <Clock size={12} />{" "}
                        {stat.live
                          ? `Live — updated ${formatMinutesAgo(Math.max(0, Math.round((Date.now() - new Date(stat.lastUpdated).getTime()) / 60000)))}`
                          : `Updated ${formatMinutesAgo(stat.minutesAgo)}`}
                      </p>
                      <div className="flex items-center gap-2 mb-4">
                        <TierBadge tier={stat.tier} />
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <TrendingUp size={12} /> Demand: {selectedMarket.demand}
                        </span>
                      </div>
                    </>
                  );
                })()}
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 mt-4">Top Lanes</p>
                <div className="space-y-2">
                  {selectedLanes.map((lane) => {
                    const realLane = realStats.laneStats?.[`${selectedMarket.slug}->${lane.destinationSlug}`]?.[equipment];
                    const displayRate = realLane ? realLane.avgRate : lane[equipment];
                    const displayTier = realLane ? rateTier(realLane.avgRate) : lane.tier;
                    return (
                      <div
                        key={lane.destinationSlug}
                        className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-md px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 truncate">
                            {selectedMarket.name} → {lane.destinationName}
                          </p>
                          <p className="text-[10px] text-gray-600 flex items-center gap-1">
                            {lane.miles} mi
                            {realLane && <span className="text-green-400 font-semibold">· Live</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-semibold text-white">
                            ${displayRate.toFixed(2)}/mi
                          </p>
                          <TierBadge tier={displayTier} small />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RateCard({ label, value, sub, highlight, compact, live }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
        {label}
        {live && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-green-400 normal-case tracking-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Live
          </span>
        )}
      </p>
      <p className={`font-bold ${compact ? "text-lg" : "text-2xl"} ${highlight ? "text-amber-400" : "text-white"}`}>
        ${value.toFixed(2)}<span className="text-sm font-normal text-gray-500">/mi</span>
      </p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function TierBadge({ tier, small }) {
  const meta = TIER_META[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ${
        small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
      }`}
      style={{ backgroundColor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      {meta.label}
    </span>
  );
}
