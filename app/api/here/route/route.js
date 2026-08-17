import { NextResponse } from "next/server";
import { decode as decodeFlexPolyline, encode as encodeFlexPolyline } from "@here/flexpolyline";

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

// Cap on how many stops can be inserted between origin and destination.
const MAX_WAYPOINTS = 6;

const INCHES_TO_CM = 2.54;
const LBS_TO_KG = 0.453592;

// Builds the HERE v8 vehicle[...] / avoid[...] query params from a saved
// truck profile. Parameter names and units (centimeters, kilograms) are
// taken directly from HERE's live v8 API reference — HERE silently drops
// any query param it doesn't recognize instead of erroring, so getting
// these exact names right is the whole ballgame; a typo here just quietly
// routes the truck like a car with no dimensions on file.
function applyTruckProfile(url, profile) {
  if (!profile) return { appliedFields: [] };
  const appliedFields = [];

  const setCm = (paramKey, inches) => {
    if (!inches || Number(inches) <= 0) return;
    url.searchParams.set(`vehicle[${paramKey}]`, String(Math.round(Number(inches) * INCHES_TO_CM)));
    appliedFields.push(paramKey);
  };
  const setKg = (paramKey, lbs) => {
    if (!lbs || Number(lbs) <= 0) return;
    url.searchParams.set(`vehicle[${paramKey}]`, String(Math.round(Number(lbs) * LBS_TO_KG)));
    appliedFields.push(paramKey);
  };

  setCm("height", profile.height_inches);
  setCm("width", profile.width_inches);
  setCm("length", profile.length_inches);
  setKg("currentWeight", profile.current_weight_lbs);
  setKg("grossWeight", profile.gross_weight_lbs);
  setKg("weightPerAxle", profile.weight_per_axle_lbs);

  if (profile.axle_count && Number(profile.axle_count) > 0) {
    url.searchParams.set("vehicle[axleCount]", String(Math.round(Number(profile.axle_count))));
    appliedFields.push("axleCount");
  }

  // HERE distinguishes solo trucks from tractor-trailer combinations via
  // trailerCount — infer 1 for a tractor-trailer profile, 0 otherwise,
  // since we don't collect a separate "number of trailers" field.
  const trailerCount = profile.vehicle_type === "tractor_trailer" ? 1 : 0;
  url.searchParams.set("vehicle[trailerCount]", String(trailerCount));
  appliedFields.push("trailerCount");

  if (profile.hazmat && Array.isArray(profile.hazmat_categories) && profile.hazmat_categories.length > 0) {
    url.searchParams.set("vehicle[shippedHazardousGoods]", profile.hazmat_categories.join(","));
    appliedFields.push("shippedHazardousGoods");
  }

  if (profile.tunnel_category) {
    url.searchParams.set("vehicle[tunnelCategory]", profile.tunnel_category);
    appliedFields.push("tunnelCategory");
  }

  const avoidFeatures = [];
  if (profile.avoid_tolls) avoidFeatures.push("tollRoad");
  if (profile.avoid_ferries) avoidFeatures.push("ferry");
  if (avoidFeatures.length > 0) {
    url.searchParams.set("avoid[features]", avoidFeatures.join(","));
    appliedFields.push("avoidFeatures");
  }

  // Note: HERE v8 has no direct "prefer major highways" avoid/routing
  // parameter today. prefer_highways is stored on the profile for display
  // and for future use if HERE adds support, but it isn't sent on the
  // request yet.

  return { appliedFields };
}

export async function POST(req) {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { origin, destination, truckProfile } = body;
  const waypoints = Array.isArray(body.waypoints)
    ? body.waypoints
        .filter((wp) => typeof wp?.lat === "number" && typeof wp?.lng === "number")
        .slice(0, MAX_WAYPOINTS)
    : [];

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    return NextResponse.json(
      { error: "Missing origin or destination coordinates" },
      { status: 400 }
    );
  }

  const url = new URL("https://router.hereapi.com/v8/routes");
  url.searchParams.set("transportMode", "truck");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  // No passThrough flag = a real stopover (HERE's default) rather than a
  // shape-only waypoint, so the truck is actually routed to each stop. That
  // also means the response comes back as one "section" per leg instead of
  // a single unbroken one — stitched back together below.
  waypoints.forEach((wp) => {
    url.searchParams.append("via", `${wp.lat},${wp.lng}`);
  });
  url.searchParams.set("return", "summary,polyline,actions,instructions");
  url.searchParams.set("lang", "en-US");
  url.searchParams.set("units", "imperial");
  url.searchParams.set("apiKey", apiKey);

  const { appliedFields } = applyTruckProfile(url, truckProfile);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "HERE routing failed", status: res.status, details: data },
        { status: res.status }
      );
    }

    const sections = data.routes?.[0]?.sections;
    if (!sections || sections.length === 0) {
      return NextResponse.json({ error: "No route found between those points" }, { status: 404 });
    }

    // With via waypoints, HERE splits the trip into one section per leg:
    // origin -> stop 1, stop 1 -> stop 2, ..., last stop -> destination.
    // Stitch those legs back into a single continuous polyline + action
    // list so everything downstream (map drawing, turn-by-turn, voice
    // guidance, off-route detection) keeps treating this as one route,
    // exactly like it did before stops existed. An "arrive at stop" action
    // is injected at each leg boundary so it flows through the same
    // announcement logic as every other maneuver.
    let allPoints = [];
    let allActions = [];
    const stopOffsets = [];
    let distanceMeters = 0;
    let durationSeconds = 0;
    const notices = [];

    sections.forEach((section, sectionIndex) => {
      distanceMeters += section.summary?.length || 0;
      durationSeconds += section.summary?.duration || 0;
      if (section.notices) notices.push(...section.notices);

      const decoded = section.polyline
        ? decodeFlexPolyline(section.polyline).polyline.map((p) => [p[0], p[1]])
        : [];

      let startAt = 0;
      if (sectionIndex > 0 && allPoints.length > 0 && decoded.length > 0) {
        const prevLast = allPoints[allPoints.length - 1];
        const dupDist = haversineMeters(prevLast[0], prevLast[1], decoded[0][0], decoded[0][1]);
        // This leg's first point is the same stop the previous leg ended at
        // — drop the duplicate so the stitched line doesn't double back.
        if (dupDist < 5) startAt = 1;
      }
      const sectionPointOffset = allPoints.length - startAt;
      for (let i = startAt; i < decoded.length; i++) allPoints.push(decoded[i]);

      const sectionActions = (section.actions || []).map((a) => {
        let fallback = a.action || "Continue";
        const roadName = a.nextRoad?.name?.[0]?.value || a.currentRoad?.name?.[0]?.value || null;
        if (a.direction) fallback = `Turn ${a.direction}`;
        if (roadName) fallback += ` onto ${roadName}`;

        return {
          instruction: a.instruction || fallback,
          distanceMeters: a.length ?? 0,
          durationSeconds: a.duration ?? 0,
          offset: sectionPointOffset + (a.offset ?? 0),
          direction: a.direction || null,
          roadName,
          actionType: a.action || null,
        };
      });
      allActions.push(...sectionActions);

      if (sectionIndex < sections.length - 1 && allPoints.length > 0) {
        const stopPointIndex = allPoints.length - 1;
        stopOffsets.push(stopPointIndex);
        const stopNumber = sectionIndex + 1;
        const wp = waypoints[sectionIndex];
        const label = wp?.address ? `Stop ${stopNumber}: ${wp.address}` : `Stop ${stopNumber}`;
        allActions.push({
          instruction: `Arrive at ${label}`,
          distanceMeters: 0,
          durationSeconds: 0,
          offset: stopPointIndex,
          direction: null,
          roadName: null,
          actionType: "arrive",
        });
      }
    });

    allActions.sort((a, b) => a.offset - b.offset);

    const polyline = encodeFlexPolyline({ polyline: allPoints });

    return NextResponse.json({
      distanceMeters,
      durationSeconds,
      polyline,
      actions: allActions,
      stopOffsets,
      waypoints,
      usedTruckProfileFields: appliedFields,
      notices,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach HERE API", details: String(err) }, { status: 502 });
  }
}
