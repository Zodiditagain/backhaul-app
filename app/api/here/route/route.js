import { NextResponse } from "next/server";

export async function POST(req) {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { origin, destination, truckSpecs } = body;

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
  url.searchParams.set("return", "summary,polyline,actions");
  url.searchParams.set("apiKey", apiKey);

  if (truckSpecs) {
    const heightCm = truckSpecs.truck_height_inches
      ? Math.round(truckSpecs.truck_height_inches * 2.54)
      : null;
    const weightKg = truckSpecs.truck_weight_lbs
      ? Math.round(truckSpecs.truck_weight_lbs * 0.453592)
      : null;
    const lengthCm = truckSpecs.truck_length_feet
      ? Math.round(truckSpecs.truck_length_feet * 30.48)
      : null;
    const axleCount = truckSpecs.truck_axle_count || null;

    if (heightCm) url.searchParams.set("truck[height]", String(heightCm));
    if (weightKg) url.searchParams.set("truck[grossWeight]", String(weightKg));
    if (lengthCm) url.searchParams.set("truck[length]", String(lengthCm));
    if (axleCount) url.searchParams.set("truck[axleCount]", String(axleCount));
  }

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "HERE routing failed", status: res.status, details: data },
        { status: res.status }
      );
    }

    const section = data.routes?.[0]?.sections?.[0];
    if (!section) {
      return NextResponse.json({ error: "No route found between those points" }, { status: 404 });
    }

    const actions = (section.actions || []).map((a) => ({
      instruction: a.instruction,
      distanceMeters: a.length ?? 0,
      durationSeconds: a.duration ?? 0,
    }));

    return NextResponse.json({
      distanceMeters: section.summary.length,
      durationSeconds: section.summary.duration,
      polyline: section.polyline,
      actions,
      usedTruckRestrictions: !!truckSpecs,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach HERE API", details: String(err) }, { status: 502 });
  }
}
