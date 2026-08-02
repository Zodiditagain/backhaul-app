"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { logAuditEvent } from "../lib/auditLog";

const EQUIPMENT_TYPES = [
  "Dry Van", "Reefer", "Flatbed", "Step Deck", "Hotshot", "Power Only", "Box Truck", "Other",
];

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
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

async function logAudit(bolId, userId, action, details) {
  await supabase.from("bol_audit_log").insert({
    bol_id: bolId,
    user_id: userId,
    action,
    details: details || null,
  });
}

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
  const [brokerCompanyName, setBrokerCompanyName] = useState("");

  useEffect(() => {
    async function init() {
      const { data: brokerProfile } = await supabase
        .from("profiles")
        .select("company_name")
        .eq("id", user.id)
        .single();
      setBrokerCompanyName(brokerProfile?.company_name || "");

      if (existingBol) {
        const { id, created_at, updated_at, status, correction_note, match_id, broker_id, trucker_id, driver_name, driver_phone, truck_number, trailer_number, version, ...rest } = existingBol;
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

    const isNewBol = !existingBol;
    const isCorrectionResend = existingBol && existingBol.status === "correction_requested";
    let nextVersion = existingBol?.version || 1;

    if (isCorrectionResend) {
      const { data: existingItems } = await supabase
        .from("bol_items")
        .select("*")
        .eq("bol_id", existingBol.id);

      await supabase.from("bol_versions").insert({
        bol_id: existingBol.id,
        version: nextVersion,
        snapshot: { ...existingBol, items: existingItems || [] },
      });
      nextVersion = nextVersion + 1;
    }

    const payload = {
      ...form,
      pickup_date: form.pickup_date || null,
      delivery_date: form.delivery_date || null,
      match_id: match.id,
      broker_id: user.id,
      trucker_id: match.trucker_id,
      status,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    };

    let bolId = existingBol?.id;
    if (bolId) {
      const { error: updateError } = await supabase.from("bols").update(payload).eq("id", bolId);
      if (updateError) {
        setError(updateError.message);
