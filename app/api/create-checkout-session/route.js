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

const PRODUCTS = {
  route_map: {
    monthly: process.env.STRIPE_ROUTE_MAP_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_ROUTE_MAP_YEARLY_PRICE_ID,
    successPath: "/route-map",
    cancelPath: "/route-map/subscribe",
  },
  market_pulse: {
    monthly: process.env.STRIPE_MARKET_PULSE_MONTHLY_PRICE_ID,
    yearly: process.env.STRIPE_MARKET_PULSE_YEARLY_PRICE_ID,
    successPath: "/market-pulse",
    cancelPath: "/market-pulse/subscribe",
  },
};

export async function POST(req) {
  try {
    const { userId, plan, product = "route_map" } = await req.json();

    if (!userId || !plan || !["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "Missing or invalid parameters." }, { status: 400 });
    }
    const productConfig = PRODUCTS[product];
    if (!productConfig) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
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

    const priceId = plan === "monthly" ? productConfig.monthly : productConfig.yearly;
    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe price configured for ${product} (${plan}).` },
        { status: 500 }
      );
    }

    const origin = req.headers.get("origin") || "https://backhaul-app-iota.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // No card required to start the trial. If the customer never adds a
      // payment method, the subscription is auto-canceled when the trial
      // ends instead of trying (and failing) to charge nothing on file.
      payment_method_collection: "if_required",
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { supabase_user_id: userId, product },
      },
      success_url: `${origin}${productConfig.successPath}?checkout=success`,
      cancel_url: `${origin}${productConfig.cancelPath}?checkout=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
