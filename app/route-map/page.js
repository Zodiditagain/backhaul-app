"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Loader2,
  Truck,
  AlertCircle,
  Navigation,
  Volume2,
  VolumeX,
  Locate,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Crosshair,
  RotateCcw,
  RotateCw,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { decode as decodeFlexPolyline } from "@here/flexpolyline";
import { supabase, authHeaders } from "../../lib/supabaseClient";
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function bearingDegrees(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}
// Street-suffix / directional abbreviations expanded for speech only — the
// on-screen turn-by-turn text stays exactly as HERE returns it.
const SPEECH_ABBREVIATIONS = [
  [/\bAve\.?\b/gi, "Avenue"],
  [/\bBlvd\.?\b/gi, "Boulevard"],
  [/\bCir\.?\b/gi, "Circle"],
  [/\bCt\.?\b/gi, "Court"],
  [/\bDr\.?\b/gi, "Drive"],
  [/\bExpy\.?\b/gi, "Expressway"],
  [/\bFwy\.?\b/gi, "Freeway"],
  [/\bHwy\.?\b/gi, "Highway"],
  [/\bLn\.?\b/gi, "Lane"],
  [/\bPkwy\.?\b/gi, "Parkway"],
  [/\bPl\.?\b/gi, "Place"],
  [/\bRd\.?\b/gi, "Road"],
  [/\bSq\.?\b/gi, "Square"],
  [/\bSt\.?\b/gi, "Street"],
  [/\bTer\.?\b/gi, "Terrace"],
  [/\bTrl\.?\b/gi, "Trail"],
  [/\bNE\b/g, "Northeast"],
  [/\bNW\b/g, "Northwest"],
  [/\bSE\b/g, "Southeast"],
  [/\bSW\b/g, "Southwest"],
  [/\bN\.?\b/g, "North"],
  [/\bS\.?\b/g, "South"],
  [/\bE\.?\b/g, "East"],
  [/\bW\.?\b/g, "West"],
];
function expandForSpeech(text) {
  let result = text;
  for (const [pattern, replacement] of SPEECH_ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
function poiIconSvg(type) {
  const config = {
    truckStop: { color: "#dc2626", emoji: "🚚" },
    fuel: { color: "#2563eb", emoji: "⛽" },
    weighStation: { color: "#eab308", emoji: "⚖️" },
    restArea: { color: "#a855f7", emoji: "🅿️" },
    other: { color: "#94a3b8", emoji: "📍" },
  };
  const { color, emoji } = config[type] || config.other;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="34" viewBox="0 0 30 34">
    <ellipse cx="15" cy="30" rx="8" ry="3" fill="black" opacity="0.25"/>
    <circle cx="15" cy="15" r="13" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="15" y="20" font-size="14" text-anchor="middle">${emoji}</text>
  </svg>`;
}
function stopIconSvg(number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="34" viewBox="0 0 30 34">
    <ellipse cx="15" cy="30" rx="8" ry="3" fill="black" opacity="0.25"/>
    <circle cx="15" cy="15" r="13" fill="#7c3aed" stroke="white" stroke-width="2.5"/>
    <text x="15" y="20" font-size="13" font-weight="bold" text-anchor="middle" fill="white">${number}</text>
  </svg>`;
}
const OFF_ROUTE_METERS = 150;
const REROUTE_COOLDOWN_MS = 20000;
const OFF_ROUTE_CONFIRM_COUNT = 1;
const MAX_ACCURACY_FOR_REROUTE_METERS = 100;
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
  // Up to MAX_STOPS waypoints between origin and destination. Each item:
  // { key, query, suggestions, point, showList }. point stays null until an
  // actual suggestion is picked, mirroring how origin/destination work.
  const [stops, setStops] = useState([]);
  const MAX_STOPS = 6;
  const [routeResult, setRouteResult] = useState(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState("");
  const [showDirections, setShowDirections] = useState(false);
  const [actionPoints, setActionPoints] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [navError, setNavError] = useState("");
  const [isRerouting, setIsRerouting] = useState(false);
  const [poiTypes, setPoiTypes] = useState({ truckStop: false, weighStation: false, fuel: false });
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const platformRef = useRef(null);
  const uiRef = useRef(null);
  const mapObjectsGroup = useRef(null);
  const poiMarkersGroup = useRef(null);
  const truckMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const decodedPointsRef = useRef([]);
  const cumulativeDistancesRef = useRef([]);
  const watchIdRef = useRef(null);
  const followModeRef = useRef(true);
  const currentStepIndexRef = useRef(0);
  const actionPointsRef = useRef([]);
  const voiceEnabledRef = useRef(true);
  const destinationRef = useRef(null);
  const truckSpecsRef = useRef(null);
  // Stops not yet reached during active navigation — shrinks as each one is
  // passed, so a mid-trip reroute knows which stops still need visiting
  // instead of routing straight past them to the final destination.
  const remainingWaypointsRef = useRef([]);
  const stopDebounceRef = useRef({});
  const rerouteLockRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const offRouteStreakRef = useRef(0);
  const announceStagesRef = useRef({});
  const isNavigatingRef = useRef(false);
  const lastPositionRef = useRef(null);
  const justRecenteredRef = useRef(true);
  const searchBiasRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);
  const defaultLayersRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const exploreLayerRef = useRef(null);
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [mapHeading, setMapHeadingDisplay] = useState(0);
  useEffect(() => {
    followModeRef.current = followMode;
  }, [followMode]);
  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);
  useEffect(() => {
    actionPointsRef.current = actionPoints;
  }, [actionPoints]);
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);
  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);
  useEffect(() => {
    truckSpecsRef.current = truckSpecs;
  }, [truckSpecs]);
  useEffect(() => {
    checkAccess();
  }, []);
  useEffect(() => {
    if (!hasAccess || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        searchBiasRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {
        // silent — search just falls back to the nationwide default bias
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [hasAccess]);
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
    defaultLayersRef.current = defaultLayers;
    const satelliteTileService = platform.getRasterTileService({
      queryParams: {
        style: "satellite.day",
        size: "512",
        ppi: 400,
      },
    });
    const satelliteTileProvider = new H.service.rasterTile.Provider(satelliteTileService, {
      tileSize: 512,
    });
    satelliteLayerRef.current = new H.map.layer.TileLayer(satelliteTileProvider);
    const exploreTileService = platform.getRasterTileService({
      queryParams: {
        style: "explore.day",
        size: "512",
        ppi: 400,
      },
    });
    const exploreTileProvider = new H.service.rasterTile.Provider(exploreTileService, {
      tileSize: 512,
    });
    exploreLayerRef.current = new H.map.layer.TileLayer(exploreTileProvider);
    const map = new H.Map(mapRef.current, exploreLayerRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      pixelRatio: window.devicePixelRatio || 1,
    });
    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    uiRef.current = H.ui.UI.createDefault(map, defaultLayers);
    try {
      uiRef.current.removeControl("mapsettings");
    } catch {
      // control id not found on this SDK version — leave native control in place
    }
    try {
      uiRef.current.removeControl("zoom");
    } catch {
      // control id not found on this SDK version — leave native control in place
    }
    map.addEventListener("dragstart", () => {
      setFollowMode(false);
    });
    mapObjectsGroup.current = new H.map.Group();
    map.addObject(mapObjectsGroup.current);
    poiMarkersGroup.current = new H.map.Group();
    map.addObject(poiMarkersGroup.current);
    mapInstance.current = map;
    const resizeHandler = () => map.getViewPort().resize();
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
  }, [mapsReady]);
  useEffect(() => {
    if (!routeResult) {
      setActionPoints([]);
      return;
    }
    const points = decodedPointsRef.current;
    const cum = cumulativeDistancesRef.current;
    const pts = (routeResult.actions || []).map((a) => {
      const idx = Math.min(a.offset ?? 0, points.length - 1);
      const p = points[idx];
      return {
        ...a,
        lat: p ? p[0] : null,
        lng: p ? p[1] : null,
        distAlongRoute: cum[idx] ?? 0,
      };
    });
    setActionPoints(pts);
    setCurrentStepIndex(0);
    announceStagesRef.current = {};
  }, [routeResult]);
  const fetchSuggestions = useCallback(async (q, kind) => {
    if (q.trim().length < 3) {
      kind === "origin" ? setOriginSuggestions([]) : setDestSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q });
      const bias = searchBiasRef.current;
      if (bias) {
        params.set("lat", bias.lat);
        params.set("lng", bias.lng);
      }
      const res = await fetch(`/api/here/autocomplete?${params.toString()}`, { headers: await authHeaders() });
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
  function addStop() {
    setStops((prev) => {
      if (prev.length >= MAX_STOPS) return prev;
      return [...prev, { key: `${Date.now()}-${prev.length}-${Math.random()}`, query: "", suggestions: [], point: null, showList: false }];
    });
  }
  function removeStop(key) {
    clearTimeout(stopDebounceRef.current[key]);
    delete stopDebounceRef.current[key];
    setStops((prev) => prev.filter((s) => s.key !== key));
  }
  function moveStop(key, dir) {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }
  async function fetchStopSuggestions(key, q) {
    if (q.trim().length < 3) {
      setStops((prev) => prev.map((s) => (s.key === key ? { ...s, suggestions: [] } : s)));
      return;
    }
    try {
      const params = new URLSearchParams({ q });
      const bias = searchBiasRef.current;
      if (bias) {
        params.set("lat", bias.lat);
        params.set("lng", bias.lng);
      }
      const res = await fetch(`/api/here/autocomplete?${params.toString()}`, { headers: await authHeaders() });
      const data = await res.json();
      const items = (data.items || []).filter((i) => i.lat !== null && i.lng !== null);
      setStops((prev) => prev.map((s) => (s.key === key ? { ...s, suggestions: items } : s)));
    } catch {
      // silent fail on suggestions
    }
  }
  function updateStopQuery(key, value) {
    setStops((prev) => prev.map((s) => (s.key === key ? { ...s, query: value, point: null, showList: true } : s)));
    clearTimeout(stopDebounceRef.current[key]);
    stopDebounceRef.current[key] = setTimeout(() => fetchStopSuggestions(key, value), 300);
  }
  function selectStopSuggestion(key, s) {
    if (s.lat === null || s.lng === null) return;
    setStops((prev) =>
      prev.map((st) =>
        st.key === key ? { ...st, point: { lat: s.lat, lng: s.lng, address: s.address }, query: s.address, showList: false } : st
      )
    );
  }
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  function useCurrentLocationAsOrigin() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available on this device or browser.");
      return;
    }
    setLocatingOrigin(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(`/api/here/reverse?lat=${lat}&lng=${lng}`, { headers: await authHeaders() });
          const data = await res.json();
          const address = data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setOrigin({ lat, lng, address });
          setOriginQuery(address);
          setShowOriginList(false);
        } catch {
          setOrigin({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
          setOriginQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } finally {
          setLocatingOrigin(false);
        }
      },
      (err) => {
        setError("Couldn't get your location: " + err.message);
        setLocatingOrigin(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  async function handleGetRoute() {
    if (!origin || !destination) {
      setError("Choose both an origin and a destination from the suggestions.");
      return;
    }
    if (stops.some((s) => !s.point)) {
      setError("Choose an address from the suggestions for every stop, or remove the ones you haven't picked yet.");
      return;
    }
    setError("");
    setRouting(true);
    setRouteResult(null);
    setShowDirections(false);
    if (isNavigating) endNavigation();
    const waypointPoints = stops.map((s) => s.point);
    remainingWaypointsRef.current = waypointPoints;
    try {
      const res = await fetch("/api/here/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, waypoints: waypointPoints, truckSpecs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not calculate a route.");
        setRouting(false);
        return;
      }
      setRouteResult(data);
      drawRoute(data.polyline, origin, destination, waypointPoints);
    } catch {
      setError("Network error reaching the routing service.");
    } finally {
      setRouting(false);
    }
  }
  function drawRoute(polyline, o, d, waypointPoints = []) {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map || !o || !d || !mapObjectsGroup.current) return;
    mapObjectsGroup.current.removeAll();
    originMarkerRef.current = null;
    const decoded = decodeFlexPolyline(polyline);
    decodedPointsRef.current = decoded.polyline;
    const cum = [0];
    for (let i = 1; i < decoded.polyline.length; i++) {
      const d = haversineMeters(
        decoded.polyline[i - 1][0],
        decoded.polyline[i - 1][1],
        decoded.polyline[i][0],
        decoded.polyline[i][1]
      );
      cum.push(cum[i - 1] + d);
    }
    cumulativeDistancesRef.current = cum;
    const lineString = new H.geo.LineString();
    decoded.polyline.forEach(([lat, lng]) => {
      lineString.pushPoint({ lat, lng });
    });
    const routeOutline = new H.map.Polyline(lineString, {
      style: { lineWidth: 9, strokeColor: "rgba(255,255,255,0.85)", lineCap: "round", lineJoin: "round" },
    });
    const routeLine = new H.map.Polyline(lineString, {
      style: { lineWidth: 5, strokeColor: "#f59e0b", lineCap: "round", lineJoin: "round" },
    });
    const objectsToAdd = [routeOutline, routeLine];
    if (!isNavigatingRef.current) {
      const originMarker = new H.map.Marker({ lat: o.lat, lng: o.lng });
      originMarkerRef.current = originMarker;
      objectsToAdd.push(originMarker);
    }
    waypointPoints.forEach((wp, i) => {
      const icon = new H.map.Icon(stopIconSvg(i + 1), { size: { w: 30, h: 34 }, anchor: { x: 15, y: 15 } });
      objectsToAdd.push(new H.map.Marker({ lat: wp.lat, lng: wp.lng }, { icon }));
    });
    const destMarker = new H.map.Marker({ lat: d.lat, lng: d.lng });
    objectsToAdd.push(destMarker);
    mapObjectsGroup.current.addObjects(objectsToAdd);
    if (!isNavigatingRef.current) {
      map.getViewModel().setLookAtData({ bounds: mapObjectsGroup.current.getBoundingBox() });
    }
  }
  function sampleRoutePoints(intervalMeters = 15000) {
    const pts = decodedPointsRef.current;
    const cum = cumulativeDistancesRef.current;
    if (pts.length < 2) return [];
    const samples = [];
    let nextTarget = 0;
    for (let i = 0; i < pts.length; i++) {
      if (cum[i] >= nextTarget) {
        samples.push({ lat: pts[i][0], lng: pts[i][1] });
        nextTarget += intervalMeters;
      }
    }
    const last = pts[pts.length - 1];
    const lastSample = samples[samples.length - 1];
    if (!lastSample || lastSample.lat !== last[0] || lastSample.lng !== last[1]) {
      samples.push({ lat: last[0], lng: last[1] });
    }
    return samples.slice(0, 25);
  }
  async function fetchAndShowPois(types) {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map || !poiMarkersGroup.current) return;
    poiMarkersGroup.current.removeAll();
    const enabled = Object.keys(types).filter((k) => types[k]);
    if (enabled.length === 0 || decodedPointsRef.current.length < 2) return;
    const points = sampleRoutePoints();
    if (points.length === 0) return;
    try {
      const res = await fetch("/api/here/pois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, types: enabled }),
      });
      const data = await res.json();
      const items = data.items || [];
      items.forEach((poi) => {
    const icon = new H.map.Icon(poiIconSvg(poi.type), {
      size: { w: 30, h: 34 },
      anchor: { x: 15, y: 15 },
    });
        const marker = new H.map.Marker({ lat: poi.lat, lng: poi.lng }, { icon });
        marker.setData(poi);
        marker.addEventListener("tap", (evt) => {
          const p = evt.target.getData();
          if (!uiRef.current) return;
          const bubble = new H.ui.InfoBubble(
            { lat: p.lat, lng: p.lng },
            { content: `<strong>${p.title}</strong><br/>${p.address}` }
          );
          uiRef.current.addBubble(bubble);
        });
        poiMarkersGroup.current.addObject(marker);
      });
    } catch {
      // silent fail — POI overlay is a nice-to-have, not core navigation
    }
  }
  useEffect(() => {
    if (!routeResult) {
      if (poiMarkersGroup.current) poiMarkersGroup.current.removeAll();
      return;
    }
    fetchAndShowPois(poiTypes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiTypes, routeResult]);
  function updateTruckMarker(lat, lng) {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map) return;
    if (!truckMarkerRef.current) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <ellipse cx="17" cy="19" rx="12" ry="10" fill="black" opacity="0.18"/>
        <circle cx="17" cy="17" r="14" fill="#3b82f6" opacity="0.25"/>
        <path d="M17 5 L26 27 L17 21 L8 27 Z" fill="#3b82f6" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>`;
      const icon = new H.map.Icon(svg, { size: { w: 34, h: 34 }, anchor: { x: 17, y: 17 } });
      truckMarkerRef.current = new H.map.Marker({ lat, lng }, { icon });
      map.addObject(truckMarkerRef.current);
    } else {
      truckMarkerRef.current.setGeometry({ lat, lng });
    }
  }
  function speak(text) {
    if (voiceEnabledRef.current && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utter);
    }
  }
  function buildTurnPhrase(step) {
    const text = step.instruction || "continue on the route";
    return expandForSpeech(text);
  }
  const FAR_ANNOUNCE_METERS = 804; // ~0.5 mi
  const NEAR_ANNOUNCE_METERS = 91; // ~300 ft
  const ADVANCE_METERS = 40;
  function checkForAnnouncement(lat, lng) {
    const idx = currentStepIndexRef.current;
    const pts = actionPointsRef.current;
    if (idx >= pts.length) return;
    const step = pts[idx];
    if (step.lat == null || step.lng == null) {
      currentStepIndexRef.current = idx + 1;
      setCurrentStepIndex(idx + 1);
      return;
    }
    const myAlong = projectPositionAlongRoute(lat, lng);
    const dist = step.distAlongRoute - myAlong;
    const stageState = announceStagesRef.current[idx] || {};
    if (dist <= FAR_ANNOUNCE_METERS && dist > NEAR_ANNOUNCE_METERS && !stageState.far) {
      speak(`In a half mile, ${buildTurnPhrase(step)}.`);
      stageState.far = true;
    }
    if (dist <= NEAR_ANNOUNCE_METERS && dist > 0 && !stageState.near) {
      speak(`In 300 feet, ${buildTurnPhrase(step)}.`);
      stageState.near = true;
    }
    announceStagesRef.current[idx] = stageState;
    if (dist <= ADVANCE_METERS) {
      const next = idx + 1;
      currentStepIndexRef.current = next;
      setCurrentStepIndex(next);
      if (step.actionType === "arrive") {
        // This stop has been reached — drop it from the list a reroute
        // would need to route through, so a later reroute goes to the
        // remaining stops (and then the destination), not straight past
        // this one.
        remainingWaypointsRef.current = remainingWaypointsRef.current.slice(1);
      }
    }
  }
  function pointToSegmentMeters(lat, lng, lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const latRef = toRad(lat1);
    const x = (lo) => R * toRad(lo) * Math.cos(latRef);
    const y = (la) => R * toRad(la);
    const px = x(lng), py = y(lat);
    const ax = x(lng1), ay = y(lat1);
    const bx = x(lng2), by = y(lat2);
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const ddx = px - cx, ddy = py - cy;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  function nearestDistanceToRoute(lat, lng) {
    const pts = decodedPointsRef.current;
    if (pts.length < 2) return Infinity;
    let min = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pointToSegmentMeters(lat, lng, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < min) min = d;
      if (min < 5) break;
    }
    return min;
  }
  function projectPositionAlongRoute(lat, lng) {
    const pts = decodedPointsRef.current;
    const cum = cumulativeDistancesRef.current;
    if (pts.length < 2) return 0;
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    let bestDist = Infinity;
    let bestAlong = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const latRef = toRad(pts[i][0]);
      const x = (lo) => R * toRad(lo) * Math.cos(latRef);
      const y = (la) => R * toRad(la);
      const px = x(lng), py = y(lat);
      const ax = x(pts[i][1]), ay = y(pts[i][0]);
      const bx = x(pts[i + 1][1]), by = y(pts[i + 1][0]);
      const dx = bx - ax, dy = by - ay;
      const lengthSq = dx * dx + dy * dy;
      let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
      const cx = ax + t * dx, cy = ay + t * dy;
      const ddx = px - cx, ddy = py - cy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < bestDist) {
        bestDist = dist;
        const segLen = (cum[i + 1] ?? 0) - (cum[i] ?? 0);
        bestAlong = (cum[i] ?? 0) + t * segLen;
      }
    }
    return bestAlong;
  }
  async function performReroute(lat, lng) {
    if (rerouteLockRef.current) return;
    const dest = destinationRef.current;
    if (!dest) return;
    rerouteLockRef.current = true;
    setIsRerouting(true);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (voiceEnabledRef.current && window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance("Rerouting.");
      window.speechSynthesis.speak(utter);
    }
    try {
      const res = await fetch("/api/here/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat, lng },
          destination: dest,
          waypoints: remainingWaypointsRef.current,
          truckSpecs: truckSpecsRef.current,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRouteResult(data);
        drawRoute(data.polyline, { lat, lng }, dest, remainingWaypointsRef.current);
      }
    } catch {
      // silent fail — will retry on next off-route check after cooldown
    } finally {
      rerouteLockRef.current = false;
      lastRerouteRef.current = Date.now();
      setIsRerouting(false);
    }
  }
  function checkOffRoute(lat, lng, accuracy, movedMeters) {
    if (rerouteLockRef.current) return;
    if (Date.now() - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return;
    if (movedMeters === null || movedMeters === undefined || movedMeters < 3) {
      offRouteStreakRef.current = 0;
      return;
    }
    if (typeof accuracy === "number" && accuracy > MAX_ACCURACY_FOR_REROUTE_METERS) {
      return;
    }
    const dist = nearestDistanceToRoute(lat, lng);
    if (dist > OFF_ROUTE_METERS) {
      offRouteStreakRef.current += 1;
    } else {
      offRouteStreakRef.current = 0;
    }
    if (offRouteStreakRef.current >= OFF_ROUTE_CONFIRM_COUNT) {
      offRouteStreakRef.current = 0;
      performReroute(lat, lng);
    }
  }
  function handlePositionUpdate(pos) {
    setNavError("");
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let heading = pos.coords.heading;
    const prev = lastPositionRef.current;
    const movedMeters = prev ? haversineMeters(prev.lat, prev.lng, lat, lng) : null;
    if ((typeof heading !== "number" || isNaN(heading)) && movedMeters !== null && movedMeters > 8) {
      heading = bearingDegrees(prev.lat, prev.lng, lat, lng);
    }
    lastPositionRef.current = { lat, lng };
    setCurrentPosition({ lat, lng });
    updateTruckMarker(lat, lng);
    if (followModeRef.current && mapInstance.current) {
      const viewModel = mapInstance.current.getViewModel();
      const lookAt = { position: { lat, lng } };
      if (justRecenteredRef.current) {
        lookAt.zoom = 17;
        justRecenteredRef.current = false;
      }
      if (typeof heading === "number" && !isNaN(heading)) {
        lookAt.heading = heading;
        lookAt.tilt = 55;
        setMapHeadingDisplay(heading);
      }
      viewModel.setLookAtData(lookAt);
    }
    checkForAnnouncement(lat, lng);
    checkOffRoute(lat, lng, pos.coords.accuracy, movedMeters);
  }
  function handleGeoError(err) {
    setNavError("Couldn't get your location: " + err.message);
  }
  function startNavigation() {
    if (!navigator.geolocation) {
      setNavError("Geolocation isn't available on this device or browser.");
      return;
    }
    setNavError("");
    if (voiceEnabled && window.speechSynthesis) {
      const greet = new SpeechSynthesisUtterance("Starting navigation.");
      window.speechSynthesis.speak(greet);
    }
    if (originMarkerRef.current && mapObjectsGroup.current) {
      mapObjectsGroup.current.removeObject(originMarkerRef.current);
      originMarkerRef.current = null;
    }
    setIsNavigating(true);
    setFollowMode(true);
    setCurrentStepIndex(0);
    lastRerouteRef.current = 0;
    offRouteStreakRef.current = 0;
    lastPositionRef.current = null;
    justRecenteredRef.current = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }
  function endNavigation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsNavigating(false);
    setIsRerouting(false);
    setCurrentPosition(null);
    if (truckMarkerRef.current && mapInstance.current) {
      mapInstance.current.removeObject(truckMarkerRef.current);
      truckMarkerRef.current = null;
    }
  }
  function recenter() {
    setFollowMode(true);
    justRecenteredRef.current = true;
    if (currentPosition && mapInstance.current) {
      mapInstance.current.setCenter(currentPosition);
      mapInstance.current.setZoom(17);
    }
  }
  function toggleSatelliteView() {
    const map = mapInstance.current;
    const exploreLayer = exploreLayerRef.current;
    const satelliteLayer = satelliteLayerRef.current;
    if (!map || !exploreLayer || !satelliteLayer) return;
    if (isSatelliteView) {
      map.setBaseLayer(exploreLayer);
    } else {
      map.setBaseLayer(satelliteLayer);
    }
    setIsSatelliteView((v) => !v);
  }
  function zoomIn() {
    const map = mapInstance.current;
    if (map) map.setZoom(map.getZoom() + 1);
  }
  function zoomOut() {
    const map = mapInstance.current;
    if (map) map.setZoom(map.getZoom() - 1);
  }
  function rotateMap(deltaDegrees) {
    const map = mapInstance.current;
    if (!map) return;
    const viewModel = map.getViewModel();
    const current = viewModel.getLookAtData().heading || 0;
    const next = (current + deltaDegrees + 360) % 360;
    viewModel.setLookAtData({ heading: next });
    setMapHeadingDisplay(next);
    setFollowMode(false);
  }
  function resetMapHeading() {
    const map = mapInstance.current;
    if (!map) return;
    map.getViewModel().setLookAtData({ heading: 0 });
    setMapHeadingDisplay(0);
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
  const currentStep = actionPoints[currentStepIndex];
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
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-4"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
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
        {!isNavigating && (
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-400">Origin</label>
                <button
                  type="button"
                  onClick={useCurrentLocationAsOrigin}
                  disabled={locatingOrigin}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                >
                  {locatingOrigin ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Crosshair size={12} />
                  )}
                  Use Current Location
                </button>
              </div>
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
        )}
        {!isNavigating && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-400">Stops along the way (optional)</label>
              {stops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStop}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Plus size={12} /> Add Stop
                </button>
              )}
            </div>
            {stops.length === 0 ? (
              <p className="text-xs text-gray-600">
                Add up to {MAX_STOPS} stops between your origin and destination.
              </p>
            ) : (
              <div className="space-y-2">
                {stops.map((stop, idx) => (
                  <div key={stop.key} className="relative flex items-center gap-2">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-violet-600 text-white text-xs font-mono font-semibold">
                      {idx + 1}
                    </span>
                    <div className="relative flex-1">
                      <input
                        value={stop.query}
                        onChange={(e) => updateStopQuery(stop.key, e.target.value)}
                        onFocus={() =>
                          setStops((prev) => prev.map((s) => (s.key === stop.key ? { ...s, showList: true } : s)))
                        }
                        placeholder="Enter a city, address, or zip"
                        className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-md py-2 px-3 focus:outline-none focus:border-blue-500"
                      />
                      {stop.showList && stop.suggestions.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md overflow-hidden shadow-lg">
                          {stop.suggestions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => selectStopSuggestion(stop.key, s)}
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
                      type="button"
                      onClick={() => moveStop(stop.key, -1)}
                      disabled={idx === 0}
                      title="Move up"
                      className="text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStop(stop.key, 1)}
                      disabled={idx === stops.length - 1}
                      title="Move down"
                      className="text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStop(stop.key)}
                      title="Remove stop"
                      className="text-gray-500 hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!isNavigating && (
          <button
            onClick={handleGetRoute}
            disabled={routing || !origin || !destination || stops.some((s) => !s.point)}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-gray-500 text-white text-sm font-semibold py-2.5 px-5 rounded-md transition flex items-center gap-2 mb-4"
          >
            {routing && <Loader2 size={16} className="animate-spin" />}
            {routing ? "Calculating route..." : "Get Route"}
          </button>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-md py-2 px-3 mb-4">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        {navError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-md py-2 px-3 mb-4">
            <AlertCircle size={14} />
            <span>{navError}</span>
          </div>
        )}
        {isRerouting && (
          <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-md py-2 px-3 mb-4">
            <RefreshCw size={14} className="animate-spin" />
            <span>Rerouting...</span>
          </div>
        )}
        {isNavigating && currentStep && (
          <div className={`rounded-md px-4 py-4 mb-4 ${currentStep.actionType === "arrive" ? "bg-violet-600" : "bg-blue-600"}`}>
            <p className={`text-xs uppercase tracking-wide mb-1 ${currentStep.actionType === "arrive" ? "text-violet-200" : "text-blue-200"}`}>
              {currentStep.actionType === "arrive" ? "Stop Ahead" : "Next"}
            </p>
            <p className="text-lg font-semibold text-white leading-snug">
              {currentStep.instruction}
            </p>
          </div>
        )}
{routeResult && !isNavigating && (
          <div className="bg-slate-900 border border-slate-800 rounded-md mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
              <div className="flex gap-6">
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
              <div className="flex items-center gap-4">
                {routeResult.actions && routeResult.actions.length > 0 && (
                  <button
                    onClick={() => setShowDirections((v) => !v)}
                    className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-medium uppercase tracking-wide"
                  >
                    <Navigation size={14} />
                    {showDirections ? "Hide Directions" : "Show Directions"}
                  </button>
                )}
                <button
                  onClick={startNavigation}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md"
                >
                  <Navigation size={14} />
                  Start Navigation
                </button>
              </div>
            </div>
            {showDirections && routeResult.actions && (
              <div className="border-t border-slate-800 max-h-80 overflow-y-auto">
                {routeResult.actions.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800 last:border-b-0 ${
                      step.actionType === "arrive" ? "bg-violet-500/10" : ""
                    }`}
                  >
                    <span className="text-xs font-mono text-gray-600 mt-0.5 w-5 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm ${step.actionType === "arrive" ? "text-violet-300 font-semibold" : "text-gray-200"}`}>
                        {step.instruction}
                      </p>
                      {step.distanceMeters > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDistance(step.distanceMeters)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {isNavigating && (
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setVoiceEnabled((v) => !v)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium uppercase tracking-wide px-3 py-2 rounded-md"
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceEnabled ? "Voice On" : "Voice Off"}
            </button>
            <button
              onClick={endNavigation}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md"
            >
              <XCircle size={14} />
              End Navigation
            </button>
          </div>
        )}
        {routeResult && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide mr-1">Show on map:</span>
            <button
              onClick={() => setPoiTypes((p) => ({ ...p, truckStop: !p.truckStop }))}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                poiTypes.truckStop
                  ? "bg-orange-600 border-orange-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              Truck Stops
            </button>
            <button
              onClick={() => setPoiTypes((p) => ({ ...p, weighStation: !p.weighStation }))}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                poiTypes.weighStation
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              Weigh Stations
            </button>
            <button
              onClick={() => setPoiTypes((p) => ({ ...p, fuel: !p.fuel }))}
              className={`text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md border ${
                poiTypes.fuel
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-slate-900 border-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              Fuel
            </button>
          </div>
        )}
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-[500px] rounded-md border border-slate-800 bg-slate-900"
          />
          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
            <button
              onClick={toggleSatelliteView}
              className="bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-md shadow-lg border border-slate-700"
            >
              {isSatelliteView ? "Map View" : "Satellite"}
            </button>
            <div className="flex items-center gap-0.5 bg-slate-900/90 border border-slate-700 rounded-md shadow-lg p-1">
              <button
                onClick={() => rotateMap(-30)}
                title="Rotate left"
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-slate-800 rounded"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={resetMapHeading}
                title="Reset to north"
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-slate-800 rounded"
              >
                <Navigation size={15} style={{ transform: `rotate(${-mapHeading}deg)` }} />
              </button>
              <button
                onClick={() => rotateMap(30)}
                title="Rotate right"
                className="w-8 h-8 flex items-center justify-center text-white hover:bg-slate-800 rounded"
              >
                <RotateCw size={15} />
              </button>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
            <button
              onClick={zoomIn}
              className="w-9 h-9 flex items-center justify-center bg-slate-900/90 hover:bg-slate-800 text-white text-lg font-semibold rounded-md shadow-lg border border-slate-700"
            >
              +
            </button>
            <button
              onClick={zoomOut}
              className="w-9 h-9 flex items-center justify-center bg-slate-900/90 hover:bg-slate-800 text-white text-lg font-semibold rounded-md shadow-lg border border-slate-700"
            >
              −
            </button>
          </div>
          {isNavigating && !followMode && (
            <button
              onClick={recenter}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-full shadow-lg"
            >
              <Locate size={14} />
              Re-center
            </button>
          )}
        </div>
        {!mapsReady && <p className="text-gray-500 text-xs mt-2">Loading map...</p>}
      </div>
    </div>
  );
}
