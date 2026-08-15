"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function MarketPulseSuccess() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription(attempt = 1) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("subscriptions")
      .select("plan, status, trial_end, current_period_end")
      .eq("user_id", user.id)
      .eq("product", "market_pulse")
      .in("status", ["trialing", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data && attempt < 4) {
      setTimeout(() => checkSubscription(attempt + 1), 1500);
      return;
    }

    setSubscription(data);
    setLoading(false);
  }

  function formatDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Confirming your subscription...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full text-center">
        {subscription ? (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-600/10 border border-amber-500 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={32} className="text-amber-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              You're subscribed to Market Pulse
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              Your {subscription.plan} plan is active and ready to use.
            </p>

            {subscription.status === "trialing" && subscription.trial_end && (
              <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-medium uppercase tracking-wide bg-amber-500/10 border border-amber-500/30 rounded-md py-2 px-4 mb-8">
                <Clock size={14} />
                <span>Free trial ends {formatDate(subscription.trial_end)}</span>
              </div>
            )}

            <button
              onClick={() => router.push("/market-pulse")}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-md font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              Open Market Pulse
              <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">
              Still confirming your subscription
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              {error
                ? `Something went wrong: ${error}`
                : "This is taking longer than expected. If you completed checkout, your access should appear shortly — try refreshing."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-md font-semibold text-sm transition"
            >
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  );
}
