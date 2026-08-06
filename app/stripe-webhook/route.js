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

function planFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_ROUTE_MAP_MONTHLY_PRICE_ID) return "monthly";
  if (priceId === process.env.STRIPE_ROUTE_MAP_YEARLY_PRICE_ID) return "yearly";
  return null;
}

async function upsertSubscriptionFromStripeSub(sub) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.error("No supabase_user_id in subscription metadata:", sub.id);
    return;
  }

  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = planFromPriceId(priceId);

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  const payload = {
    user_id: userId,
    product: sub.metadata?.product || "route_map",
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabaseAdmin.from("subscriptions").update(payload).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert(payload);
  }
}

export async function POST(req) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await upsertSubscriptionFromStripeSub(sub);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          await upsertSubscriptionFromStripeSub(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
