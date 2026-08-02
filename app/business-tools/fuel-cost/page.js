"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Fuel } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

export default function FuelCostCalculator() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  const [inputMode, setInputMode] = useState("mpg"); // "mpg" or "cost_per_mile"
  const [loadedMiles, setLoadedMiles] = useState("");
  const [deadheadMiles, setDeadheadMiles] = useState("");
  const [mpg, setMpg] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
  const [costPerMileInput, setCostPerMileInput] = useState("");
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
      .eq("calculator_type", "fuel_cost")
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
    const loadedNum = parseFloat(loadedMiles);
    const deadheadNum = parseFloat(deadheadMiles) || 0;

    if (!loadedNum || loadedNum <= 0) {
      setResult({ error: "Enter valid loaded miles." });
      return;
    }

    const totalMiles = loadedNum + deadheadNum;
    let totalFuelCost, gallonsNeeded, mpgNum, priceNum, costPerMile;

    if (inputMode === "mpg") {
      mpgNum = parseFloat(mpg);
      priceNum = parseFloat(fuelPrice);
      if (!mpgNum || mpgNum <= 0 || !priceNum || priceNum <= 0) {
        setResult({ error: "Enter valid MPG and fuel price." });
        return;
      }
      gallonsNeeded = totalMiles / mpgNum;
      totalFuelCost = gallonsNeeded * priceNum;
      costPerMile = totalFuelCost / totalMiles;
    } else {
      costPerMile = parseFloat(costPerMileInput);
      if (!costPerMile || costPerMile <= 0) {
        setResult({ error: "Enter a valid fuel cost per mile." });
        return;
      }
      totalFuelCost = costPerMile * totalMiles;
      gallonsNeeded = null;
      mpgNum = null;
      priceNum = null;
    }

    const costPerLoadedMile = totalFuelCost / loadedNum;

    const calcResult = {
      totalMiles,
      gallonsNeeded,
      totalFuelCost,
      costPerLoadedMile,
      costPerTotalMile: costPerMile,
      loadedNum,
      deadheadNum,
      mpgNum,
      priceNum,
      inputMode,
    };
    setResult(calcResult);
    saveCalculation(calcResult);
  }

  async function saveCalculation(calcResult) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("business_tool_calculations").insert({
      user_id: user.id,
      calculator_type: "fuel_cost",
      inputs: {
        loaded_miles: calcResult.loadedNum,
        deadhead_miles: calcResult.deadheadNum,
        mpg: calcResult.mpgNum,
        fuel_price: calcResult.priceNum,
        input_mode: calcResult.inputMode,
      },
      result: {
        total_fuel_cost: calcResult.totalFuelCost,
        gallons_needed: calcResult.gallonsNeeded,
        cost_per_loaded_mile: calcResult.costPerLoadedMile,
        cost_per_total_mile: calcResult.costPerTotalMile,
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
          <h1 className="text-white text-lg font-bold uppercase tracking-widest">Fuel Cost Calculator</h1>
          <div className="w-32" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-8">
        <form onSubmit={handleCalculate} className="bg-asphalt border-2 border-gray-700 rounded-lg p-6 mb-8">
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => setInputMode("mpg")}
              className={`flex-1 text-xs font-mono uppercase tracking-wide py-2 rounded border ${
                inputMode === "mpg"
                  ? "bg-amberx text-asphalt border-amberx font-bold"
                  : "bg-black text-gray-400 border-gray-600"
              }`}
            >
              I know MPG + fuel price
            </button>
            <button
              type="button"
              onClick={() => setInputMode("cost_per_mile")}
              className={`flex-1 text-xs font-mono uppercase tracking-wide py-2 rounded border ${
                inputMode === "cost_per_mile"
                  ? "bg-amberx text-asphalt border-amberx font-bold"
                  : "bg-black text-gray-400 border-gray-600"
              }`}
            >
              I know my cost per mile
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Loaded miles</label>
              <input
                type="number"
                step="0.1"
                value={loadedMiles}
                onChange={(e) => setLoadedMiles(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. 450"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Deadhead miles (optional)</label>
              <input
                type="number"
                step="0.1"
                value={deadheadMiles}
                onChange={(e) => setDeadheadMiles(e.target.value)}
                className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="e.g. 50"
              />
            </div>
            {inputMode === "mpg" ? (
              <>
                <div>
                  <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Truck MPG</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mpg}
                    onChange={(e) => setMpg(e.target.value)}
                    className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="e.g. 6.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Fuel price ($/gal)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(e.target.value)}
                    className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="e.g. 3.85"
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-gray-400 text-xs uppercase font-mono tracking-wide block mb-1">Fuel cost per mile ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costPerMileInput}
                  onChange={(e) => setCostPerMileInput(e.target.value)}
                  className="w-full bg-black border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="e.g. 0.59"
                  required
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-amberx hover:bg-amber-500 text-asphalt font-bold uppercase tracking-wide text-sm px-5 py-2.5 rounded"
          >
            <Fuel size={16} /> Calculate
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
                <p className="text-gray-400 text-xs uppercase font-mono">Total fuel cost</p>
                <p className="text-amberx text-2xl font-bold">${result.totalFuelCost.toFixed(2)}</p>
              </div>
              {result.gallonsNeeded !== null && (
                <div>
                  <p className="text-gray-400 text-xs uppercase font-mono">Gallons needed</p>
                  <p className="text-white text-2xl font-bold">{result.gallonsNeeded.toFixed(1)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs uppercase font-mono">Cost / loaded mile</p>
                <p className="text-white text-2xl font-bold">${result.costPerLoadedMile.toFixed(2)}</p>
              </div>
            </div>
            {result.deadheadNum > 0 && (
              <p className="text-gray-400 text-sm mt-4">
                Cost per total mile (incl. deadhead): <span className="text-white">${result.costPerTotalMile.toFixed(2)}/mi</span> over {result.totalMiles.toFixed(0)} mi
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
                    {h.inputs.loaded_miles} mi{h.inputs.mpg ? ` · ${h.inputs.mpg} mpg · $${h.inputs.fuel_price}/gal` : ""}
                  </span>
                  <span className="text-amberx font-bold">${h.result.total_fuel_cost.toFixed(2)}</span>
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
