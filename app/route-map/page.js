"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, Truck, AlertCircle } from "lucide-react";
import { decode as decodeFlexPolyline } from "@here/flexpolyline";
import { supabase } from "../../lib/supabaseClient";

export default function RouteMapPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [truckSpecs, setTruckSpecs] = useState(null);

  const [originQuery, setOriginQuery] = useState("");
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [showOriginList, setShowOriginList] = useState(false);

  const [destQuery, setDestQuery] = useState("");
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [destination, setDestination] = useState(null);
  const [showDestList, setShowDestList] = useState(false);

  const [routeResult, setRouteResult] = useState(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState("");

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const platformRef = useRef(null);
  const mapObjectsGroup = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("product", "route_map")
      .in("status", ["trialing", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      router.push("/route-map/subscribe");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("truck_height_inches, truck_weight_lbs, truck_length_feet, truck_axle_count")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setTruckSpecs(profile);
    }

    setHasAccess(true);
    setCheckingAccess(false);
  }

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
      script.async = true;
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
    const map = new H.Map(mapRef.current, defaultLayers.vector.normal.map, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      pixelRatio: window.devicePixelRatio || 1,
    });

    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    H.ui.UI.createDefault(map, defaultLayers);

    mapObjectsGroup.current = new H.map.Group();
    map.addObject(mapObjectsGroup.current);

    mapInstance.current = map;

    const resizeHandler = () => map.getViewPort().resize();
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
  }, [mapsReady]);

  const fetchSuggestions = useCallback(async (q, kind) => {
    if (q.trim().length < 3) {
      kind === "origin" ? setOriginSuggestions([]) : setDestSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/here/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const items = (data.items || []).filter((i) => i.lat !== null && i.lng !== null);
      kind === "origin" ? setOriginSuggestions(items) : setDestSuggestions(items);
    } catch {
      // silent fail on suggestions
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(originQuery, "origin"), 300);
    return () => clearTimeout(t);
  }, [originQuery, fetchSuggestions]);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(destQuery, "dest"), 300);
    return () => clearTimeout(t);
  }, [destQuery, fetchSuggestions]);

  function selectSuggestion(kind, s) {
    if (s.lat === null || s.lng === null) return;
    const point = { lat: s.lat, lng: s.lng, address: s.address };
    if (kind === "origin") {
      setOrigin(point);
      setOriginQuery(s.address);
      setShowOriginList(false);
    } else {
      setDestination(point);
      setDestQuery(s.address);
      setShowDestList(false);
    }
  }

  async function handleGetRoute() {
    if (!origin || !destination) {
      setError("Choose both an origin and a destination from the suggestions.");
      return;
    }
    setError("");
    setRouting(true);
    setRouteResult(null);

    try {
      const res = await fetch("/api/here/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, truckSpecs }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not calculate a route.");
        setRouting(false);
        return;
      }

      setRouteResult(data);
      drawRoute(data.polyline, origin, destination);
    } catch {
      setError("Network error reaching the routing service.");
    } finally {
      setRouting(false);
    }
  }

  function drawRoute(polyline, o, d) {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map || !o || !d || !mapObjectsGroup.current) return;

    mapObjectsGroup.current.removeAll();

    const decoded = decodeFlexPolyline(polyline);
    const lineString = new H.geo.LineString();
    decoded.polyline.forEach(([lat, lng]) => {
      lineString.pushPoint({ lat, lng });
    });

    const routeLine = new H.map.Polyline(lineString, {
      style: { lineWidth: 5, strokeColor: "#f59e0b" },
    });

    const originMarker = new H.map.Marker({ lat: o.lat, lng: o.lng });
    const destMarker = new H.map.Marker({ lat: d.lat, lng: d.lng });

    mapObjectsGroup.current.addObjects([routeLine, originMarker, destMarker]);
    map.getViewModel().setLookAtData({ bounds: mapObjectsGroup.current.getBoundingBox() });
  }

  function formatDistance(meters) {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours === 0) return `${minutes} min`;
    return `${hours} hr ${minutes} min`;
  }

  const hasTruckSpecs =
    truckSpecs &&
    (truckSpecs.truck_height_inches ||
      truckSpecs.truck_weight_lbs ||
      truckSpecs.truck_length_feet ||
      truckSpecs.truck_axle_count);
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Checking your access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Truck size={22} className="text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Route Map</h1>
        </div>

        {hasTruckSpecs ? (
          <p className="text-xs text-amber-400 mb-6">
            Routing with your truck specs — restricted roads and low bridges will be avoided.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mb-6">
            No truck dimensions on file yet — routes will use standard truck defaults. Add your
            height, weight, length, and axle count in your profile for restricted routing.
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1">Origin</label>
            <input
              value={originQuery}
              onChange={(e) => {
                setOriginQuery(e.target.value);
                setOrigin(null);
                setShowOriginList(true);
              }}
              onFocus={() => setShowOriginList(true)}
              placeholder="Enter a city, address, or zip"
              className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-blue-500"
            />
            {showOriginList && originSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                {originSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSuggestion("origin", s)}
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
                setDestination(null);
                setShowDestList(true);
              }}
              onFocus={() => setShowDestList(true)}
              placeholder="Enter a city, address, or zip"
              className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2.5 px-3 focus:outline-none focus:border-blue-500"
            />
            {showDestList && destSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                {destSuggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSuggestion("dest", s)}
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
          onClick={handleGetRoute}
          disabled={routing || !origin || !destination}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-gray-500 text-white text-sm font-semibold py-2.5 px-5 rounded-md transition flex items-center gap-2 mb-4"
        >
          {routing && <Loader2 size={16} className="animate-spin" />}
          {routing ? "Calculating route..." : "Get Route"}
        </button>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-md py-2 px-3 mb-4">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {routeResult && (
          <div className="flex gap-6 bg-slate-900 border border-slate-800 rounded-md py-3 px-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Distance</p>
              <p className="text-lg font-semibold text-white">
                {formatDistance(routeResult.distanceMeters)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Drive Time</p>
              <p className="text-lg font-semibold text-white">
                {formatDuration(routeResult.durationSeconds)}
              </p>
            </div>
          </div>
        )}

        <div
          ref={mapRef}
          className="w-full h-[500px] rounded-md border border-slate-800 bg-slate-900"
        />
        {!mapsReady && <p className="text-gray-500 text-xs mt-2">Loading map...</p>}
      </div>
    </div>
  );
}
