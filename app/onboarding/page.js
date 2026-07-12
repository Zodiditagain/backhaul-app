"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Box, Zap, Package, Plus } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const EQUIPMENT = [
  { id: "dry_van", label: "Dry Van", icon: Truck },
  { id: "reefer", label: "Reefer", icon: Truck },
  { id: "flatbed", label: "Flatbed", icon: Package },
  { id: "step_deck", label: "Step Deck", icon: Package },
  { id: "hotshot", label: "Hotshot", icon: Zap },
  { id: "power_only", label: "Power Only", icon: Truck },
  { id: "box_truck", label: "Box Truck", icon: Box },
  { id: "other", label: "Other", icon: Plus },
];

export default function Onboarding() {
  const router = useRouter();
  const [equipment, setEquipment] = useState([]);
  const [fleetSize, setFleetSize] = useState("1-5");
  const [operatorType, setOperatorType] = useState("owner-operator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleEquipment(id) {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        equipment_types: equipment,
        fleet_size: fleetSize,
        operator_type: operatorType,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
          <span>Step 1 of 1</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8">
          <div className="h-1.5 bg-blue-600 rounded-full w-full" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Equipment</h1>
        <p className="text-gray-400 text-sm mb-6">Select all equipment types you operate.</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {EQUIPMENT.map(({ id, label, icon: Icon }) => {
              const selected = equipment.includes(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleEquipment(id)}
                  className={`relative flex flex-col items-center justify-center gap-2 py-4 rounded-lg border transition ${
                    selected
                      ? "border-blue-500 bg-blue-600/10"
                      : "border-slate-700 bg-slate-900"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">
                      ✓
                    </div>
                  )}
                  <Icon size={22} className={selected ? "text-blue-400" : "text-gray-400"} />
                  <span className={`text-xs font-medium ${selected ? "text-white" : "text-gray-300"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block text-sm font-semibold text-white mb-1">Fleet Size</label>
          <select
            value={fleetSize}
            onChange={(e) => setFleetSize(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 mb-4 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="1">Just me</option>
            <option value="1-5">1 - 5 trucks</option>
            <option value="6-20">6 - 20 trucks</option>
            <option value="21-50">21 - 50 trucks</option>
            <option value="50+">50+ trucks</option>
          </select>

          <label className="block text-sm font-semibold text-white mb-1">Owner-Operator or Fleet</label>
          <select
            value={operatorType}
            onChange={(e) => setOperatorType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 mb-8 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="owner-operator">Owner-Operator</option>
            <option value="fleet">Fleet</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save and Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
