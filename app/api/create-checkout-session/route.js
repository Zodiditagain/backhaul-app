import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { userId, plan } = await req.json();

    if (!userId || !plan || !["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "Missing or invalid parameters." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("company_name, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: profile.company_name || undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const priceId =
      plan === "monthly"
        ? process.env.STRIPE_ROUTE_MAP_MONTHLY_PRICE_ID
        : process.env.STRIPE_ROUTE_MAP_YEARLY_PRICE_ID;

    const origin = req.headers.get("origin") || "https://backhaul-app-iota.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: userId, product: "route_map" },
      },
      success_url: `${origin}/route-map?checkout=success`,
      cancel_url: `${origin}/route-map?checkout=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
