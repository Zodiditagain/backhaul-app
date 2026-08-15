"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity, Check } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

function MarketPulseSubscribeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");

  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();
      if (profileData?.role !== "trucker") {
        router.replace("/dashboard");
        return;
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function startCheckout() {
    setError("");
    setRedirecting(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: selectedPlan, product: "market_pulse" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setRedirecting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide mb-8"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        {checkoutStatus === "canceled" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-3 mb-6 text-sm text-amber-300">
            Checkout was canceled. No charge was made — you can try again below whenever you're ready.
          </div>
        )}

        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto mb-4">
            <Activity size={26} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">BackHaul Market Pulse</h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Southeast freight-market rate estimates by lane and equipment type — a heat map,
            directional lane search, and BackHaul-verified rate confidence, so you know what a
            lane is actually worth before you negotiate.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-md px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`text-left border-2 rounded-md p-5 transition bg-slate-900 ${
              selectedPlan === "monthly" ? "border-amber-500" : "border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-medium tracking-wide text-gray-500">Monthly</span>
              {selectedPlan === "monthly" && <Check size={16} className="text-amber-400" />}
            </div>
            <div className="text-3xl font-bold text-white">
              $14.99<span className="text-sm font-normal text-gray-500">/mo</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedPlan("yearly")}
            className={`text-left border-2 rounded-md p-5 transition relative bg-slate-900 ${
              selectedPlan === "yearly" ? "border-amber-500" : "border-slate-800"
            }`}
          >
            <span className="absolute -top-2.5 right-4 bg-green-600 text-white text-[10px] uppercase font-medium tracking-wide px-2 py-0.5 rounded-full">
              Save ~17%
            </span>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-medium tracking-wide text-gray-500">Yearly</span>
              {selectedPlan === "yearly" && <Check size={16} className="text-amber-400" />}
            </div>
            <div className="text-3xl font-bold text-white">
              $150<span className="text-sm font-normal text-gray-500">/yr</span>
            </div>
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-5 mb-8">
          <p className="text-xs uppercase font-medium tracking-wide text-gray-500 mb-3">What's included</p>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <Check size={14} className="text-amber-400 shrink-0" /> Southeast freight-market heat map by rate tier
            </li>
            <li className="flex items-center gap-2">
              <Check size={14} className="text-amber-400 shrink-0" /> Dry van, reefer, and flatbed rate breakdowns
            </li>
            <li className="flex items-center gap-2">
              <Check size={14} className="text-amber-400 shrink-0" /> Directional origin/destination lane search
            </li>
            <li className="flex items-center gap-2">
              <Check size={14} className="text-amber-400 shrink-0" /> Market estimate + BackHaul-verified average with a confidence score
            </li>
            <li className="flex items-center gap-2">
              <Check size={14} className="text-amber-400 shrink-0" /> 7-day free trial, cancel anytime
            </li>
          </ul>
        </div>

        <button
          onClick={startCheckout}
          disabled={redirecting}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-md font-semibold text-sm transition disabled:opacity-50"
        >
          {redirecting ? "Redirecting to checkout..." : "Start 7-Day Free Trial"}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          You won't be charged until your trial ends. Cancel anytime before then at no cost.
        </p>
      </div>
    </div>
  );
}

export default function MarketPulseSubscribe() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      }
    >
      <MarketPulseSubscribeInner />
    </Suspense>
  );
}
