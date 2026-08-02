"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function LoadRateCalculator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  const [miles, setMiles] = useState("");
  const [totalRate, setTotalRate] = useState("");
  const [expenses, setExpenses] = useState("");
  const [targetMargin, setTargetMargin] = useState("");
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
      if (error) {
        console.error(error);
      } else {
        setProfile(profileData);
      }
      await loadHistory(currentUser.id);
      setLoading(false);
    }
    load();
  }, [router]);

  async function loadHistory(userId) {
    const { data, error } = await supabase
      .from("business_tool_calculations")
      .select("*")
      .eq("user_id", userId)
      .eq("calculator_type", "load_rate")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error(error);
    } else {
      setHistory(data || []);
    }
  }

  function handleCalculate(e) {
    e.preventDefault();
    const milesNum = parseFloat(miles);
    const rateNum = parseFloat(totalRate);
    const expensesNum = parseFloat(expenses) || 0;
    const marginNum = parseFloat(targetMargin) || 0;

    if (!milesNum || milesNum <= 0 || !rateNum || rateNum <= 0) {
      setResult({ error: "Enter valid miles and total rate." });
      return;
    }

    const ratePerMile = rateNum / milesNum;
    const netProfit = rateNum - expensesNum;
    const netMargin = (netProfit / rateNum) * 100;
    const meetsTarget = marginNum > 0 ? netMargin >= marginNum : null;
    const breakEvenRate = expensesNum > 0 ? expensesNum / milesNum : null;

    const calcResult = {
      ratePerMile,
      netProfit,
      netMargin,
      meetsTarget,
      breakEvenRate,
      milesNum,
      rateNum,
      expensesNum,
      marginNum,
    };
    setResult(calcResult);
    saveCalculation(calcResult);
  }

  async function saveCalculation(calcResult) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("business_tool_calculations").insert({
      user_id: user.id,
      calculator_type: "load_rate",
      inputs: {
        miles: calcResult.milesNum,
        total_rate: calcResult.rateNum,
        expenses: calcResult.expensesNum,
        target_margin: calcResult.marginNum,
      },
      result: {
        rate_per_mile: calcResult.ratePerMile,
        net_profit: calcResult.netProfit,
        net_margin: calcResult.netMargin,
        break_even_rate: calcResult.breakEvenRate,
      },
    });
    if (error) {
      console.error(error);
    } else {
      await loadHistory(user.id);
    }
    setSaving(false);
  }
  if (loading) return <div className="p-8 text-steelgray">Loading...</div>;
  if (!profile) return <div className="p-8 text-alertred">Couldn't load your profile. Try logging in again.</div>;

  return (
    <div className="min-h-screen">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/business-tools" className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide">
            <ArrowLeft size={14} /> Business Tools
          </Link>
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">Load Rate Calculator</h1>
          <div className="w-32" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-8">
        <form onSubmit={handleCalculate} className="bg-asphalt border-2 border-gray-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Total miles</label>
              <input
                type="number"
                step="0.1"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. 450"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Total rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={totalRate}
                onChange={(e) => setTotalRate(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. 1350"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Expenses ($, optional)</label>
              <input
                type="number"
                step="0.01"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="fuel, tolls, etc."
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Target margin % (optional)</label>
              <input
                type="number"
                step="0.1"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. 20"
              />
            </div>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-amberx hover:bg-amber-500 text-asphalt font-bold uppercase tracking-wide text-sm px-5 py-2.5 rounded"
          >
            <DollarSign size={16} /> Calculate
          </button>
        </form>

        {result && result.error && (
          <div className="bg-red-950 border border-alertred text-alertred rounded-lg p-4 mb-8">{result.error}</div>
        )}

        {result && !result.error && (
          <div className="bg-asphalt border-2 border-amberx rounded-lg p-6 mb-8">
            <h2 className="text-white text-sm font-mono uppercase tracking-widest mb-4">Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-400 text-xs uppercase font-mono">Rate per mile</p>
                <p className="text-amberx text-2xl font-bold">${result.ratePerMile.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase font-mono">Net profit</p>
                <p className="text-white text-2xl font-bold">${result.netProfit.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase font-mono">Net margin</p>
                <p className="text-white text-2xl font-bold">{result.netMargin.toFixed(1)}%</p>
              </div>
            </div>
            {result.breakEvenRate !== null && (
              <p className="text-gray-400 text-sm mt-4">
                Break-even rate: <span className="text-white">${result.breakEvenRate.toFixed(2)}/mi</span>
              </p>
            )}
            {result.meetsTarget !== null && (
              <p className={`text-sm mt-2 font-mono uppercase tracking-wide ${result.meetsTarget ? "text-green-400" : "text-alertred"}`}>
                {result.meetsTarget ? "✓ Meets your target margin" : "✗ Below your target margin"}
              </p>
            )}
            {saving && <p className="text-gray-500 text-xs mt-3">Saving...</p>}
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h2 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-3">Recent calculations</h2>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="bg-asphalt border border-gray-700 rounded p-3 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {h.inputs.miles} mi · ${h.inputs.total_rate}
                  </span>
                  <span className="text-amberx font-bold">${h.result.rate_per_mile.toFixed(2)}/mi</span>
                  <span className="text-gray-500 text-xs">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
