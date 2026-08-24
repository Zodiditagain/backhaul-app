"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Star, Bell, BarChart3, Store, Gift, Check } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

const PARTNER_BENEFITS = [
  { icon: Search, text: "Carrier Search & Vetting — live availability by lane, with new-carrier and unverified-DOT flags" },
  { icon: Star, text: "Saved Carrier Lists — build your go-to network once" },
  { icon: Bell, text: "Capacity Alerts — get notified the moment a matching truck opens up" },
  { icon: BarChart3, text: "Analytics Dashboard — your activity at a glance" },
  { icon: Store, text: "Vendor Network — browse, or get listed among, trucking-service providers" },
  { icon: Gift, text: "Referral Program — get credit for every signup through your link" },
];

function PartnerProSubscribeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
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
      if (profileData?.role === "trucker") {
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
        body: JSON.stringify({ userId: user.id, plan: "monthly", product: "partner_pro" }),
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
          <div className="w-14 h-14 rounded-full bg-blue-500/15 border border-blue-500/40 flex items-center justify-center mx-auto mb-4">
            <Store size={26} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Backhaul Partner Pro</h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Everything you need to run your brokerage or vendor business on Backhaul — one price, unlimited
            use, not per seat.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-md px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="border-2 border-blue-500 rounded-md p-6 bg-slate-900 mb-8 text-center">
          <span className="text-xs uppercase font-medium tracking-wide text-gray-500">Monthly</span>
          <div className="text-4xl font-bold text-white mt-1">
            $199<span className="text-base font-normal text-gray-500">/mo</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Flat rate — no per-seat fees</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-md p-5 mb-6">
          <p className="text-xs uppercase font-medium tracking-wide text-gray-500 mb-3">What's included</p>
          <ul className="space-y-2.5 text-sm text-gray-300">
            {PARTNER_BENEFITS.map((b) => (
              <li key={b.text} className="flex items-start gap-2">
                <b.icon size={15} className="text-blue-400 mt-0.5 shrink-0" />
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-4 mb-8 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-2">See what you're actually saving:</p>
          <table className="w-full text-xs text-gray-300 min-w-[360px]">
            <thead>
              <tr className="text-gray-500 uppercase text-[10px]">
                <th className="text-left font-medium pb-1"></th>
                <th className="text-left font-medium pb-1">Backhaul</th>
                <th className="text-left font-medium pb-1">Truckstop Pro</th>
                <th className="text-left font-medium pb-1">DAT One</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-2 py-1 text-gray-400">Price</td>
                <td className="py-1 font-semibold text-white">$199/mo flat</td>
                <td className="py-1">$239/user/mo</td>
                <td className="py-1">$195–345/mo</td>
              </tr>
              <tr>
                <td className="pr-2 py-1 text-gray-400">Per-seat fees</td>
                <td className="py-1 text-green-400">No</td>
                <td className="py-1 text-red-400">Yes</td>
                <td className="py-1 text-red-400">Yes</td>
              </tr>
              <tr>
                <td className="pr-2 py-1 text-gray-400">Vendor network</td>
                <td className="py-1 text-green-400">Yes</td>
                <td className="py-1 text-red-400">No</td>
                <td className="py-1 text-red-400">No</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          onClick={startCheckout}
          disabled={redirecting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-md font-semibold text-sm transition disabled:opacity-50"
        >
          {redirecting ? "Redirecting to checkout..." : "Start 30-Day Free Trial"}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          Cancel anytime during your first 30 days. You won't be charged until your trial ends.
        </p>
      </div>
    </div>
  );
}

export default function PartnerProSubscribe() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      }
    >
      <PartnerProSubscribeInner />
    </Suspense>
  );
}
