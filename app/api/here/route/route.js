import { NextResponse } from "next/server";

export async function POST(req) {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { origin, destination } = body;

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
  url.searchParams.set("return", "summary,polyline");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.title || "HERE routing failed" },
        { status: res.status }
      );
    }

    const section = data.routes?.[0]?.sections?.[0];
    if (!section) {
      return NextResponse.json({ error: "No route found between those points" }, { status: 404 });
    }

    return NextResponse.json({
      distanceMeters: section.summary.length,
      durationSeconds: section.summary.duration,
      polyline: section.polyline,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach HERE API" }, { status: 502 });
  }
}
