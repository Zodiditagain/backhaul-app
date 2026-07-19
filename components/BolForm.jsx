"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const EQUIPMENT_TYPES = [
  "Dry Van", "Reefer", "Flatbed", "Step Deck", "Hotshot", "Power Only", "Box Truck", "Other",
];

const PACKAGING_TYPES = [
  "Pallets", "Boxes", "Crates", "Drums", "Bundles", "Rolls", "Loose", "Other",
];

const emptyItem = {
  quantity: "",
  packaging_type: "Pallets",
  description: "",
  weight: "",
  pallet_count: "",
  freight_class: "",
  nmfc_number: "",
  hazmat: false,
  handling_instructions: "",
};

export default function BolForm({ match, user, existingBol, onClose, onSaved }) {
  const [form, setForm] = useState({
    bol_number: "",
    load_number: "",
    pickup_date: "",
    delivery_date: "",
    po_number: "",
    reference_number: "",
    shipper_name: "",
    shipper_address: "",
    shipper_city: "",
    shipper_state: "",
    shipper_zip: "",
    shipper_contact: "",
    shipper_phone: "",
    pickup_instructions: "",
    consignee_name: "",
    consignee_address: "",
    consignee_city: "",
    consignee_state: "",
    consignee_zip: "",
    consignee_contact: "",
    consignee_phone: "",
    delivery_instructions: "",
    carrier_name: "",
    carrier_dot: "",
    carrier_mc: "",
    equipment_type: "Dry Van",
    freight_charges: "Prepaid",
    declared_value: "",
    cod_amount: "",
    temperature_requirement: "",
    seal_number: "",
    special_instructions: "",
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      if (existingBol) {
        const { id, created_at, updated_at, status, correction_note, match_id, broker_id, trucker_id, driver_name, driver_phone, truck_number, trailer_number, ...rest } = existingBol;
        setForm((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? ""])) }));
        const { data: itemData } = await supabase
          .from("bol_items")
          .select("*")
          .eq("bol_id", existingBol.id)
          .order("created_at", { ascending: true });
        if (itemData && itemData.length > 0) {
          setItems(itemData.map((i) => ({ ...i, hazmat: Boolean(i.hazmat) })));
        }
      } else {
        const { data: trucker } = await supabase
          .from("profiles")
          .select("company_name, dot_number, mc_number")
          .eq("id", match.trucker_id)
          .single();
        const rand = String(Math.floor(Math.random() * 90000) + 10000);
        setForm((prev) => ({
          ...prev,
          bol_number: `BH-${new Date().getFullYear()}-${rand}`,
          carrier_name: trucker?.company_name || "",
          carrier_dot: trucker?.dot_number || "",
          carrier_mc: trucker?.mc_number || "",
        }));
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingBol?.id]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(index, key, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function save(status) {
    setError("");
    if (status === "sent") {
      if (!form.bol_number || !form.pickup_date || !form.shipper_name || !form.consignee_name) {
        setError("BOL number, pickup date, shipper name, and consignee name are required to send.");
        return;
      }
    }
    setSaving(true);

    const payload = {
      ...form,
      pickup_date: form.pickup_date || null,
      delivery_date: form.delivery_date || null,
      match_id: match.id,
      broker_id: user.id,
      trucker_id: match.trucker_id,
      status,
      updated_at: new Date().toISOString(),
    };

    let bolId = existingBol?.id;
    if (bolId) {
      const { error: updateError } = await supabase.from("bols").update(payload).eq("id", bolId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      await supabase.from("bol_items").delete().eq("bol_id", bolId);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("bols")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      bolId = inserted.id;
    }

    const itemRows = items
      .filter((i) => i.quantity || i.description || i.weight)
      .map(({ id, created_at, bol_id, ...rest }) => ({ ...rest, bol_id: bolId }));
    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase.from("bol_items").insert(itemRows);
      if (itemsError) {
        setError(itemsError.message);
        setSaving(false);
        return;
      }
    }

    if (status === "sent") {
      await supabase.from("messages").insert({
        match_id: match.id,
        sender_id: user.id,
        text: `📄 Bill of Lading ${form.bol_number} — carrier action required.`,
      });
    }

    setSaving(false);
    if (onSaved) onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-asphalt/80 z-40 flex items-center justify-center px-4 py-6">
      <div className="bg-white rounded-sm w-full max-w-2xl border border-gray-300 flex flex-col max-h-[90vh]">
        <div className="bg-asphalt text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <span className="text-lg font-bold">Bill of Lading</span>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 rounded-sm">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && <p className="text-alertred text-sm bg-alertred/10 border border-alertred/30 rounded-sm px-3 py-2">{error}</p>}

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Shipment Information</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="BOL Number *" value={form.bol_number} onChange={(v) => set("bol_number", v)} />
              <Field label="Load Number" value={form.load_number} onChange={(v) => set("load_number", v)} />
              <Field label="Pickup Date *" type="date" value={form.pickup_date} onChange={(v) => set("pickup_date", v)} />
              <Field label="Delivery Date" type="date" value={form.delivery_date} onChange={(v) => set("delivery_date", v)} />
              <Field label="PO Number" value={form.po_number} onChange={(v) => set("po_number", v)} />
              <Field label="Reference Number" value={form.reference_number} onChange={(v) => set("reference_number", v)} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Shipper</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Company Name *" value={form.shipper_name} onChange={(v) => set("shipper_name", v)} />
              <Field label="Pickup Address" value={form.shipper_address} onChange={(v) => set("shipper_address", v)} />
              <Field label="City" value={form.shipper_city} onChange={(v) => set("shipper_city", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={form.shipper_state} onChange={(v) => set("shipper_state", v)} />
                <Field label="ZIP" value={form.shipper_zip} onChange={(v) => set("shipper_zip", v)} />
              </div>
              <Field label="Contact Name" value={form.shipper_contact} onChange={(v) => set("shipper_contact", v)} />
              <Field label="Phone" value={form.shipper_phone} onChange={(v) => set("shipper_phone", v)} />
            </div>
            <TextArea label="Pickup Instructions" value={form.pickup_instructions} onChange={(v) => set("pickup_instructions", v)} />
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Consignee</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Receiving Company *" value={form.consignee_name} onChange={(v) => set("consignee_name", v)} />
              <Field label="Delivery Address" value={form.consignee_address} onChange={(v) => set("consignee_address", v)} />
              <Field label="City" value={form.consignee_city} onChange={(v) => set("consignee_city", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={form.consignee_state} onChange={(v) => set("consignee_state", v)} />
                <Field label="ZIP" value={form.consignee_zip} onChange={(v) => set("consignee_zip", v)} />
              </div>
              <Field label="Contact Name" value={form.consignee_contact} onChange={(v) => set("consignee_contact", v)} />
              <Field label="Phone" value={form.consignee_phone} onChange={(v) => set("consignee_phone", v)} />
            </div>
            <TextArea label="Delivery Instructions" value={form.delivery_instructions} onChange={(v) => set("delivery_instructions", v)} />
          </section>
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Carrier</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Carrier Company" value={form.carrier_name} onChange={(v) => set("carrier_name", v)} />
              <div>
                <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Equipment Type</label>
                <select
                  value={form.equipment_type}
                  onChange={(e) => set("equipment_type", e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-white"
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Field label="USDOT Number" value={form.carrier_dot} onChange={(v) => set("carrier_dot", v)} />
              <Field label="MC Number" value={form.carrier_mc} onChange={(v) => set("carrier_mc", v)} />
            </div>
            <p className="text-xs text-gray-400 italic mt-2">
              Driver name, phone, truck and trailer numbers are filled in by the carrier after you send.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Freight Details</h3>
            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-sm p-3 relative">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-alertred"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Quantity" value={item.quantity} onChange={(v) => setItem(i, "quantity", v)} />
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">Packaging</label>
                      <select
                        value={item.packaging_type}
                        onChange={(e) => setItem(i, "packaging_type", e.target.value)}
                        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm bg-white"
                      >
                        {PACKAGING_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <Field label="Weight (lbs)" value={item.weight} onChange={(v) => setItem(i, "weight", v)} />
                    <div className="sm:col-span-3">
                      <Field label="Commodity Description" value={item.description} onChange={(v) => setItem(i, "description", v)} />
                    </div>
                    <Field label="Pallet Count" value={item.pallet_count} onChange={(v) => setItem(i, "pallet_count", v)} />
                    <Field label="Freight Class" value={item.freight_class} onChange={(v) => setItem(i, "freight_class", v)} />
                    <Field label="NMFC Number" value={item.nmfc_number} onChange={(v) => setItem(i, "nmfc_number", v)} />
                    <label className="flex items-center gap-2 text-xs text-steelgray sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={item.hazmat}
                        onChange={(e) => setItem(i, "hazmat", e.target.checked)}
                      />
                      Hazardous Material
                    </label>
                    <div className="sm:col-span-3">
                      <Field label="Special Handling Instructions" value={item.handling_instructions} onChange={(v) => setItem(i, "handling_instructions", v)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-3 flex items-center gap-1.5 text-xs text-steelgray hover:text-amberx border border-gray-300 hover:border-amberx rounded-sm px-3 py-2"
            >
              <Plus size={14} /> Add Another Item
            </button>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-2 mb-3">Charges & Freight Terms</h3>
            <label className="block text-xs uppercase tracking-wide text-steelgray mb-2">Freight Charges</label>
            <div className="flex gap-2 mb-3">
              {["Prepaid", "Collect", "Third Party"].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => set("freight_charges", c)}
                  className={`text-xs px-3 py-2 rounded-sm border transition ${
                    form.freight_charges === c
                      ? "bg-asphalt text-white border-asphalt font-semibold"
                      : "border-gray-300 text-steelgray"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Declared Value" value={form.declared_value} onChange={(v) => set("declared_value", v)} />
              <Field label="COD Amount" value={form.cod_amount} onChange={(v) => set("cod_amount", v)} />
              <Field label="Temperature Requirement" value={form.temperature_requirement} onChange={(v) => set("temperature_requirement", v)} />
              <Field label="Seal Number" value={form.seal_number} onChange={(v) => set("seal_number", v)} />
            </div>
            <TextArea label="Special Instructions" value={form.special_instructions} onChange={(v) => set("special_instructions", v)} />
          </section>
        </div>

        <div className="border-t border-gray-300 px-5 py-4 flex gap-3 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => save("draft")}
            disabled={saving}
            className="flex-1 border border-gray-300 hover:border-asphalt text-asphalt py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={() => save("sent")}
            disabled={saving}
            className="flex-1 bg-asphalt hover:bg-black text-white py-2.5 rounded-sm font-mono text-sm uppercase tracking-wide transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Send to Carrier"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="mt-3">
      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
      />
    </div>
  );
}
