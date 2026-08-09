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
        body: JSON.stringify({ origin, destination }),
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
