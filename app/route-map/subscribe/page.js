"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Check, X } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function RouteMapSubscribe() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
        .select("role, company_name")
        .eq("id", currentUser.id)
        .single();

      if (profileData?.role !== "trucker") {
        router.replace("/dashboard");
        return;
      }
      setProfile(profileData);
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
        body: JSON.stringify({ userId: user.id, plan: selectedPlan }),
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

  if (loading) return <div className="p-8 text-steelgray">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">Route Map</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        {checkoutStatus === "canceled" && (
          <div className="bg-amberx/10 border border-amberx/40 rounded-sm px-4 py-3 mb-6 text-sm text-asphalt">
            Checkout was canceled. No charge was made — you can try again below whenever you're ready.
          </div>
        )}

        <div className="text-center mb-10">
          <div className="w-14 h-14 rotate-45 bg-amberx flex items-center justify-center mx-auto mb-4">
            <Truck className="-rotate-45" size={26} color="#1B1E21" />
          </div>
          <h2 className="text-2xl font-bold text-asphalt mb-2">Truck-Legal Route Planning</h2>
          <p className="text-steelgray max-w-md mx-auto">
            Plan routes that respect your truck's height, weight, and hazmat restrictions — avoiding low bridges, weight-limited roads, and truck-prohibited routes that regular map apps miss.
          </p>
        </div>

        {error && (
          <div className="bg-alertred/10 border border-alertred/30 text-alertred rounded-sm px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`text-left border-2 rounded-sm p-5 transition ${
              selectedPlan === "monthly" ? "border-amberx bg-white shadow-sm" : "border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wide text-gray-400">Monthly</span>
              {selectedPlan === "monthly" && <Check size={16} className="text-amberx" />}
            </div>
            <div className="text-3xl font-bold text-asphalt">$9.99<span className="text-sm font-normal text-gray-400">/mo</span></div>
          </button>

          <button
            onClick={() => setSelectedPlan("yearly")}
            className={`text-left border-2 rounded-sm p-5 transition relative ${
              selectedPlan === "yearly" ? "border-amberx bg-white shadow-sm" : "border-gray-300 bg-white"
            }`}
          >
            <span className="absolute -top-2.5 right-4 bg-highway text-white text-[10px] uppercase font-mono tracking-wide px-2 py-0.5 rounded-sm">
              Save ~17%
            </span>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono tracking-wide text-gray-400">Yearly</span>
              {selectedPlan === "yearly" && <Check size={16} className="text-amberx" />}
            </div>
            <div className="text-3xl font-bold text-asphalt">$100<span className="text-sm font-normal text-gray-400">/yr</span></div>
          </button>
        </div>

        <div className="bg-white border border-gray-300 rounded-sm p-5 mb-8">
          <p className="text-xs uppercase font-mono tracking-wide text-gray-400 mb-3">What's included</p>
          <ul className="space-y-2 text-sm text-steelgray">
            <li className="flex items-center gap-2"><Check size={14} className="text-highway shrink-0" /> Truck-legal routing based on your saved height, weight, and length</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-highway shrink-0" /> Hazmat-restricted road avoidance</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-highway shrink-0" /> Low bridge and weight-limit warnings</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-highway shrink-0" /> 7-day free trial, cancel anytime</li>
          </ul>
        </div>

        <button
          onClick={startCheckout}
          disabled={redirecting}
          className="w-full bg-asphalt hover:bg-black text-white py-3.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
        >
          {redirecting ? "Redirecting to checkout..." : "Start 7-Day Free Trial"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          You won't be charged until your trial ends. Cancel anytime before then at no cost.
        </p>
      </main>
    </div>
  );
}
