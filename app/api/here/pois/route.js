import { NextResponse } from "next/server";

const CATEGORIES = {
  truckStop: "700-7900-0132",
  weighStation: "400-4200-0048",
  fuel: "700-7600-0000",
  restArea: "400-4300-0000",
};

export async function POST(req) {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "HERE API key not configured" }, { status: 500 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { points, types } = body || {};
  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ items: [] });
  }
  const categoryIds = (Array.isArray(types) ? types : [])
    .map((t) => CATEGORIES[t])
    .filter(Boolean);
  if (categoryIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Corridor coverage built from repeated circle searches along the route,
  // rather than one unverified "search along route" call. Radius > half the
  // sample spacing so consecutive circles overlap and don't leave gaps.
  const samplePoints = points.slice(0, 25);
  const RADIUS_METERS = 12000;
  const PER_POINT_LIMIT = 15;

  try {
    const results = await Promise.all(
      samplePoints.map(async (p) => {
        const url = new URL("https://browse.search.hereapi.com/v1/browse");
        url.searchParams.set("at", `${p.lat},${p.lng}`);
        url.searchParams.set("in", `circle:${p.lat},${p.lng};r=${RADIUS_METERS}`);
        url.searchParams.set("categories", categoryIds.join(","));
        url.searchParams.set("limit", String(PER_POINT_LIMIT));
        url.searchParams.set("apiKey", apiKey);
        const res = await fetch(url.toString());
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
      })
    );

    const seen = new Set();
    const items = [];
    for (const item of results.flat()) {
      if (!item.id || seen.has(item.id)) continue;
      if (item.position?.lat == null || item.position?.lng == null) continue;
      seen.add(item.id);
      const itemCategoryIds = (item.categories || []).map((c) => c.id);
      let type = "other";
      if (itemCategoryIds.includes(CATEGORIES.truckStop)) type = "truckStop";
      else if (itemCategoryIds.includes(CATEGORIES.weighStation)) type = "weighStation";
      else if (itemCategoryIds.includes(CATEGORIES.fuel)) type = "fuel";
      else if (itemCategoryIds.includes(CATEGORIES.restArea)) type = "restArea";
      items.push({
        id: item.id,
        title: item.title,
        address: item.address?.label || item.title,
        lat: item.position.lat,
        lng: item.position.lng,
        type,
      });
    }

    return NextResponse.json({ items: items.slice(0, 60) });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reach HERE API", details: String(err) }, { status: 502 });
  }
}
