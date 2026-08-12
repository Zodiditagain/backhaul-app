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
  Layers,
} from "lucide-react";
import Link from "next/link";
import { decode as decodeFlexPolyline } from "@here/flexpolyline";
import { supabase } from "../../lib/supabaseClient";

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
  const [satelliteView, setSatelliteView] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const platformRef = useRef(null);
  const defaultLayersRef = useRef(null);
  const mapObjectsGroup = useRef(null);
  const truckMarkerRef = useRef(null);
  const decodedPointsRef = useRef([]);
  const cumulativeDistancesRef = useRef([]);
  const watchIdRef = useRef(null);
  const followModeRef = useRef(true);
  const currentStepIndexRef = useRef(0);
  const actionPointsRef = useRef([]);
  const voiceEnabledRef = useRef(true);
  const destinationRef = useRef(null);
  const truckSpecsRef = useRef(null);
  const rerouteLockRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const offRouteStreakRef = useRef(0);
  const announceStagesRef = useRef({});
  const isNavigatingRef = useRef(false);
  const lastPositionRef = useRef(null);
  const justRecenteredRef = useRef(true);
  const [mapsReady, setMapsReady] = useState(false);

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
    const map = new H.Map(mapRef.current, defaultLayers.vector.normal.map, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      pixelRatio: window.devicePixelRatio || 1,
    });
    new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    H.ui.UI.createDefault(map, defaultLayers);
    map.addEventListener("dragstart", () => {
      setFollowMode(false);
    });
    mapObjectsGroup.current = new H.map.Group();
    map.addObject(mapObjectsGroup.current);
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
          const res = await fetch(`/api/here/reverse?lat=${lat}&lng=${lng}`);
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
    setError("");
    setRouting(true);
    setRouteResult(null);
    setShowDirections(false);
    if (isNavigating) endNavigation();
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
    const routeLine = new H.map.Polyline(lineString, {
      style: { lineWidth: 5, strokeColor: "#f59e0b" },
    });
    const originMarker = new H.map.Marker({ lat: o.lat, lng: o.lng });
    const destMarker = new H.map.Marker({ lat: d.lat, lng: d.lng });
    mapObjectsGroup.current.addObjects([routeLine, originMarker, destMarker]);
    if (!isNavigatingRef.current) {
      map.getViewModel().setLookAtData({ bounds: mapObjectsGroup.current.getBoundingBox() });
    }
  }

  function toggleSatellite() {
    const layers = defaultLayersRef.current;
    const map = mapInstance.current;
    if (!layers || !map) return;
    const next = !satelliteView;
    map.setBaseLayer(next ? layers.raster.satellite.map : layers.vector.normal.map);
    setSatelliteView(next);
  }

  function updateTruckMarker(lat, lng) {
    const H = window.H;
    const map = mapInstance.current;
    if (!H || !map) return;
    if (!truckMarkerRef.current) {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="9" fill="#3b82f6" stroke="white" stroke-width="3"/></svg>';
      const icon = new H.map.Icon(svg, { size: { w: 26, h: 26 }, anchor: { x: 13, y: 13 } });
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
    return step.instruction || "continue on the route";
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
          truckSpecs: truckSpecsRef.current,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRouteResult(data);
        drawRoute(data.polyline, { lat, lng }, dest);
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
    // If we haven't meaningfully moved since the last fix, don't evaluate
    // off-route at all. This covers being parked anywhere — a lot, a depot,
    // a rest area — without depending on the browser reporting speed, which
    // a lot of devices don't do reliably.
    if (movedMeters === null || movedMeters === undefined || movedMeters < 3) {
      offRouteStreakRef.current = 0;
      return;
    }
    // A single fuzzy fix shouldn't be trusted either.
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
    // Many browsers (iOS Safari especially) never populate coords.heading.
    // Fall back to computing our own bearing from the last GPS fix, but only
    // once we've moved far enough that GPS noise won't dominate the result.
    if ((typeof heading !== "number" || isNaN(heading)) && movedMeters !== null && movedMeters > 8) {
      heading = bearingDegrees(prev.lat, prev.lng, lat, lng);
    }
    lastPositionRef.current = { lat, lng };
    setCurrentPosition({ lat, lng });
    updateTruckMarker(lat, lng);
    if (followModeRef.current && mapInstance.current) {
      const viewModel = mapInstance.current.getViewModel();
      const lookAt = { position: { lat, lng } };
      // Only force zoom right after starting nav or tapping re-center —
      // otherwise this runs every GPS tick and overrides any pinch/button
      // zoom you just did.
      if (justRecenteredRef.current) {
        lookAt.zoom = 17;
        justRecenteredRef.current = false;
      }
      if (typeof heading === "number" && !isNaN(heading)) {
        lookAt.heading = heading;
        lookAt.tilt = 55;
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
          <button
            onClick={handleGetRoute}
            disabled={routing || !origin || !destination}
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
          <div className="bg-blue-600 rounded-md px-4 py-4 mb-4">
            <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Next</p>
            <p className="text-lg font-semibold text-white leading-snug">
              {currentStep.instruction}
            </p>
            {currentPosition && (
              <p className="text-xs text-blue-200 mt-2 font-mono">
                DEBUG — step {currentStepIndex + 1}/{actionPoints.length} · along-route dist: {Math.round(currentStep.distAlongRoute - projectPositionAlongRoute(currentPosition.lat, currentPosition.lng))}m
              </p>
            )}
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
                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-800 last:border-b-0"
                  >
                    <span className="text-xs font-mono text-gray-600 mt-0.5 w-5 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200">{step.instruction}</p>
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
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-[500px] rounded-md border border-slate-800 bg-slate-900"
          />
          <button
            onClick={toggleSatellite}
            className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-full shadow-lg border border-slate-700"
          >
            <Layers size={14} />
            {satelliteView ? "Map View" : "Satellite"}
          </button>
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
