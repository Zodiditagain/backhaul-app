import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 3) {
    return NextResponse.json({ items: [] });
  }

  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }

  const url = new URL("https://discover.search.hereapi.com/v1/discover");
  url.searchParams.set("q", q);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("limit", "5");
  url.searchParams.set("in", "countryCode:USA,CAN");

  try {
    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "HERE discover failed", status: res.status, details: data },
        { status: res.status }
      );
    }

    const items = (data.items || []).map((item) => ({
      id: item.id,
      title: item.title,
      address: item.address?.label || item.title,
      lat: item.position?.lat ?? null,
      lng: item.position?.lng ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach HERE API", details: String(err) }, { status: 502 });
  }
}
