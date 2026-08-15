import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MARKETS } from "../../../../lib/marketPulseData";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Maps the Bill of Lading form's equipment-type strings (components/BolForm.jsx)
// to Market Pulse's equipment keys (lib/marketPulseData.js). Equipment types
// with no clean Market Pulse equivalent (Step Deck, Power Only, Other) are
// intentionally left unmapped and excluded from aggregation rather than
// force-mapped to something misleading.
const EQUIPMENT_TYPE_MAP = {
  "Dry Van": "van",
  Reefer: "reefer",
  Flatbed: "flatbed",
  "Box Truck": "boxTruck",
  Hotshot: "hotshot",
};

// Minimum number of real completed loads required for a market/lane +
// equipment combo before we surface a real average instead of the synthetic
// estimate. Guards against both noisy single-load outliers and, more
// importantly, privacy — an "average" of one load is really just that one
// load's rate.
const MIN_SAMPLE_SIZE = 3;

function normalizeCity(city) {
  return (city || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function matchMarket(city, state) {
  const normCity = normalizeCity(city);
  const normState = (state || "").toString().trim().toUpperCase();
  if (!normCity || !normState) return null;
  return (
    MARKETS.find((m) => normalizeCity(m.name) === normCity && m.state === normState) || null
  );
}

function summarize(buckets) {
  const out = {};
  Object.entries(buckets).forEach(([key, equipmentBuckets]) => {
    Object.entries(equipmentBuckets).forEach(([equipmentKey, bucket]) => {
      if (bucket.rates.length < MIN_SAMPLE_SIZE) return;
      const avg = bucket.rates.reduce((sum, r) => sum + r, 0) / bucket.rates.length;
      out[key] = out[key] || {};
      out[key][equipmentKey] = {
        avgRate: Math.round(avg * 100) / 100,
        count: bucket.rates.length,
        lastUpdated: bucket.lastUpdated,
      };
    });
  });
  return out;
}

// Privacy-safe aggregation endpoint for BackHaul Market Pulse's "BackHaul
// Verified Avg" figures. Reads completed Bills of Lading with a captured
// rate, and returns ONLY anonymized aggregates (average rate, sample count,
// and a timestamp) grouped by market/lane + equipment type — never a raw
// BOL row, a company name, or anything else that could identify a specific
// shipment or party. Markets/lanes with fewer than MIN_SAMPLE_SIZE completed
// loads are omitted entirely rather than exposing a near-single-load "average".
export async function GET() {
  try {
    const { data: bols, error } = await supabaseAdmin
      .from("bols")
      .select(
        "shipper_city, shipper_state, consignee_city, consignee_state, equipment_type, rate_per_mile, updated_at"
      )
      .eq("status", "completed")
      .not("rate_per_mile", "is", null);

    if (error) {
      console.error("market-pulse real-stats query error:", error);
      return NextResponse.json({ error: "Failed to load real rate data." }, { status: 500 });
    }

    const marketBuckets = {};
    const laneBuckets = {};

    (bols || []).forEach((bol) => {
      const equipmentKey = EQUIPMENT_TYPE_MAP[bol.equipment_type];
      const rate = Number(bol.rate_per_mile);
      if (!equipmentKey || !rate || rate <= 0) return;

      const originMarket = matchMarket(bol.shipper_city, bol.shipper_state);
      const destMarket = matchMarket(bol.consignee_city, bol.consignee_state);

      if (originMarket) {
        marketBuckets[originMarket.slug] = marketBuckets[originMarket.slug] || {};
        const bucket = (marketBuckets[originMarket.slug][equipmentKey] =
          marketBuckets[originMarket.slug][equipmentKey] || { rates: [], lastUpdated: null });
        bucket.rates.push(rate);
        if (!bucket.lastUpdated || bol.updated_at > bucket.lastUpdated) {
          bucket.lastUpdated = bol.updated_at;
        }
      }

      if (originMarket && destMarket && originMarket.slug !== destMarket.slug) {
        const laneKey = `${originMarket.slug}->${destMarket.slug}`;
        laneBuckets[laneKey] = laneBuckets[laneKey] || {};
        const bucket = (laneBuckets[laneKey][equipmentKey] =
          laneBuckets[laneKey][equipmentKey] || { rates: [], lastUpdated: null });
        bucket.rates.push(rate);
        if (!bucket.lastUpdated || bol.updated_at > bucket.lastUpdated) {
          bucket.lastUpdated = bol.updated_at;
        }
      }
    });

    return NextResponse.json({
      marketStats: summarize(marketBuckets),
      laneStats: summarize(laneBuckets),
    });
  } catch (err) {
    console.error("market-pulse real-stats unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error loading real rate data." }, { status: 500 });
  }
}
