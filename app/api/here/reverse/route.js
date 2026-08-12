import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat or lng" }, { status: 400 });
  }

  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }

  const url = new URL("https://revgeocode.search.hereapi.com/v1/revgeocode");
  url.searchParams.set("at", `${lat},${lng}`);
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "HERE reverse geocode failed", details: data },
        { status: res.status }
      );
    }

    const item = data.items?.[0];
    const address = item?.address?.label || `${lat}, ${lng}`;

    return NextResponse.json({ address });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach HERE API", details: String(err) }, { status: 502 });
  }
}
