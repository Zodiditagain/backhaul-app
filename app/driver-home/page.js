"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Truck, LogOut, Loader2, Upload, Camera, Paperclip } from "lucide-react";
import { supabase, authHeaders } from "../../lib/supabaseClient";

const VEHICLE_TYPE_LABELS = {
  tractor_trailer: "Tractor-Trailer",
  straight_truck: "Straight Truck / Box Truck",
  dry_van: "Dry Van",
  reefer: "Reefer",
  flatbed: "Flatbed",
  other: "Other",
};

const STATUS_LABELS = {
  accepted: "Accepted — awaiting pickup",
  ready_for_pickup: "Ready for Pickup",
  signed_at_pickup: "Signed at Pickup",
  in_transit: "In Transit",
  delivered: "Delivered",
  receiver_signed: "Receiver Signed",
  completed: "Completed",
};

const STATUS_COLORS = {
  accepted: "text-gray-400",
  ready_for_pickup: "text-blue-400",
  signed_at_pickup: "text-blue-400",
  in_transit: "text-amber-400",
  delivered: "text-blue-400",
  receiver_signed: "text-emerald-400",
  completed: "text-emerald-400",
};

// Posts a status-transition action to the driver-scoped load endpoint. The
// server (app/api/driver/loads/[id]/route.js) re-checks assignment/ownership
// and the current status independently -- this is just the client call.
async function postLoadStatus(loadId, action, extraFields) {
  const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
  const res = await fetch(`/api/driver/loads/${loadId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...extraFields }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Couldn't update that load. Try again.");
  }
  return json;
}

// Uploads the signed BOL / proof-of-delivery photo through the driver-scoped
// pod endpoint (app/api/driver/loads/[id]/pod/route.js), which uses the
// service-role storage client server-side.
async function uploadLoadPod(loadId, file) {
  const headers = await authHeaders();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/driver/loads/${loadId}/pod`, {
    method: "POST",
    headers,
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Couldn't upload that file. Try again.");
  }
  return json;
}

// Deliberately the only page a driver account ever lands on. Drivers have
// no access to matches, messages, brokers, or vendors — the one thing
// this page lets a driver do is say which of the company's trucks/
// trailers they're currently running, so the company can see who's in
// what, and progress any load their company owner has assigned directly
// to them through pickup/in-transit/delivered/receiver-signed and upload
// the signed BOL/POD. Everything else about the truck (dimensions,
// weight, etc.) is still only editable by the company account on Truck
// Profiles, and everything about the load's rate or broker identity is
// deliberately never sent to this page at all.
export default function DriverHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [truckProfiles, setTruckProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  const [loads, setLoads] = useState([]);
  const [loadsError, setLoadsError] = useState("");

  async function loadAssignment() {
    const headers = await authHeaders();
    const res = await fetch("/api/driver/truck-profiles", { headers });
    if (!res.ok) return;
    const json = await res.json();
    setTruckProfiles(json.truckProfiles || []);
    setSelectedId(json.currentTruckProfileId || "");
  }

  async function loadLoads() {
    const headers = await authHeaders();
    const res = await fetch("/api/driver/loads", { headers });
    if (!res.ok) return;
    const json = await res.json();
    setLoads(json.loads || []);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, company_name, driver_full_name")
        .eq("id", user.id)
        .single();

      if (profileData?.role !== "driver") {
        // Not a driver account — this page isn't for them.
        router.replace("/dashboard");
        return;
      }
      setProfile(profileData);
      await loadAssignment();
      await loadLoads();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleAssignmentChange(e) {
    const value = e.target.value;
    setSelectedId(value);
    setSavingAssignment(true);
    setAssignmentError("");

    const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
    const res = await fetch("/api/driver/assignment", {
      method: "POST",
      headers,
      body: JSON.stringify({ truckProfileId: value || null }),
    });
    const json = await res.json().catch(() => ({}));
    setSavingAssignment(false);
    if (!res.ok) {
      setAssignmentError(json.error || "Couldn't save that. Try again.");
      await loadAssignment();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  const selected = truckProfiles.find((t) => t.id === selectedId) || null;

  return (
    <div className="min-h-screen bg-[#0b1220] flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rotate-45 bg-blue-600 flex items-center justify-center rounded-lg mx-auto mb-6">
          <Truck className="-rotate-45" size={26} color="#ffffff" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          {profile.driver_full_name || "Welcome"}
        </h1>
        <p className="text-blue-400 text-sm mb-6">Driving for {profile.company_name}</p>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left mb-4">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Which truck are you running today?
          </label>
          {truckProfiles.length === 0 ? (
            <p className="text-sm text-gray-500">
              No trucks have been added to your company&apos;s fleet yet — ask your dispatcher to add
              one under Truck & Equipment.
            </p>
          ) : (
            <>
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={handleAssignmentChange}
                  disabled={savingAssignment}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  <option value="">Not currently assigned</option>
                  {truckProfiles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profile_name}
                      {t.truck_number ? ` — Truck #${t.truck_number}` : ""}
                      {t.trailer_number ? ` / Trailer #${t.trailer_number}` : ""}
                    </option>
                  ))}
                </select>
                {savingAssignment && (
                  <Loader2 size={14} className="animate-spin text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              {assignmentError && <p className="text-red-400 text-xs mt-2">{assignmentError}</p>}
              {selected && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-gray-400 space-y-1">
                  <p>{VEHICLE_TYPE_LABELS[selected.vehicle_type] || selected.vehicle_type}</p>
                  {selected.truck_number && <p>Truck #{selected.truck_number}</p>}
                  {selected.trailer_number && <p>Trailer #{selected.trailer_number}</p>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-left mb-4">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Your Current Load{loads.length === 1 ? "" : "s"}
          </h2>
          {loadsError && <p className="text-red-400 text-xs mb-2">{loadsError}</p>}
          {loads.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-gray-500">
              No loads assigned to you right now — your dispatcher will assign one from a BOL when it's
              ready.
            </div>
          ) : (
            <div className="space-y-3">
              {loads.map((load) => (
                <LoadCard
                  key={load.id}
                  load={load}
                  onRefresh={loadLoads}
                  onError={(msg) => setLoadsError(msg)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-gray-400 mb-6">
          This account doesn&apos;t have access to messages or broker/vendor information — that stays
          with your company&apos;s main account.
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 justify-center w-full bg-slate-800 hover:bg-slate-700 text-gray-300 text-sm font-medium py-2.5 rounded-md border border-slate-700"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </div>
  );
}

function LoadCard({ load, onRefresh, onError }) {
  const [busy, setBusy] = useState(false);
  const [driverSigName, setDriverSigName] = useState("");
  const [shipperSigName, setShipperSigName] = useState("");
  const [pickupCondition, setPickupCondition] = useState("");
  const [pickupPieces, setPickupPieces] = useState("");
  const [receiverSigName, setReceiverSigName] = useState("");
  const [deliveryCondition, setDeliveryCondition] = useState("");
  const [deliveryPieces, setDeliveryPieces] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function run(action, extraFields) {
    setBusy(true);
    onError("");
    try {
      await postLoadStatus(load.id, action, extraFields);
      await onRefresh();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onError("");
    try {
      await uploadLoadPod(load.id, file);
      await onRefresh();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
    e.target.value = "";
  }

  const canUploadPod = ["delivered", "receiver_signed", "completed"].includes(load.status);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{load.bol_number}</span>
        <span className={`text-[11px] uppercase tracking-wide font-medium ${STATUS_COLORS[load.status] || "text-gray-400"}`}>
          {STATUS_LABELS[load.status] || load.status}
        </span>
      </div>

      <div className="text-xs text-gray-400 space-y-0.5 mb-3">
        <p>
          {[load.shipper_city, load.shipper_state].filter(Boolean).join(", ") || "—"}
          {" → "}
          {[load.consignee_city, load.consignee_state].filter(Boolean).join(", ") || "—"}
        </p>
        {load.pickup_date && (
          <p>
            Pickup:{" "}
            {new Date(load.pickup_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        {load.pickup_instructions && <p>Pickup notes: {load.pickup_instructions}</p>}
        {load.delivery_instructions && <p>Delivery notes: {load.delivery_instructions}</p>}
      </div>

      {load.status === "accepted" && (
        <button
          onClick={() => run("ready_for_pickup")}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md"
        >
          {busy ? "Saving..." : "Mark Ready for Pickup"}
        </button>
      )}

      {load.status === "ready_for_pickup" && (
        <div className="space-y-2">
          <input
            value={driverSigName}
            onChange={(e) => setDriverSigName(e.target.value)}
            placeholder="Driver signature (print name) *"
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
          />
          <input
            value={shipperSigName}
            onChange={(e) => setShipperSigName(e.target.value)}
            placeholder="Shipper signature (print name)"
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={pickupCondition}
              onChange={(e) => setPickupCondition(e.target.value)}
              placeholder="Condition"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
            />
            <input
              value={pickupPieces}
              onChange={(e) => setPickupPieces(e.target.value)}
              placeholder="Pieces"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
            />
          </div>
          <button
            onClick={() =>
              run("signed_at_pickup", {
                driverSignatureName: driverSigName,
                shipperSignatureName: shipperSigName || undefined,
                pickupCondition: pickupCondition || undefined,
                pickupPieces: pickupPieces || undefined,
              })
            }
            disabled={busy || !driverSigName}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md"
          >
            {busy ? "Saving..." : "Sign & Confirm Pickup"}
          </button>
        </div>
      )}

      {load.status === "signed_at_pickup" && (
        <button
          onClick={() => run("in_transit")}
          disabled={busy}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 text-xs font-semibold py-2 rounded-md"
        >
          {busy ? "Saving..." : "Mark In Transit"}
        </button>
      )}

      {load.status === "in_transit" && (
        <button
          onClick={() => run("delivered")}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md"
        >
          {busy ? "Saving..." : "Mark Delivered"}
        </button>
      )}

      {load.status === "delivered" && (
        <div className="space-y-2">
          <input
            value={receiverSigName}
            onChange={(e) => setReceiverSigName(e.target.value)}
            placeholder="Receiver signature (print name) *"
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={deliveryCondition}
              onChange={(e) => setDeliveryCondition(e.target.value)}
              placeholder="Condition"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
            />
            <input
              value={deliveryPieces}
              onChange={(e) => setDeliveryPieces(e.target.value)}
              placeholder="Pieces"
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
            />
          </div>
          <button
            onClick={() =>
              run("receiver_signed", {
                receiverSignatureName: receiverSigName,
                deliveryCondition: deliveryCondition || undefined,
                deliveryPieces: deliveryPieces || undefined,
              })
            }
            disabled={busy || !receiverSigName}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-md"
          >
            {busy ? "Saving..." : "Capture Receiver Signature"}
          </button>
        </div>
      )}

      {canUploadPod && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          {load.pod_url ? (
            <a
              href={load.pod_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 underline"
            >
              <Paperclip size={12} /> View uploaded POD
            </a>
          ) : (
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-500 text-gray-300 text-xs font-medium py-2 rounded-md disabled:opacity-50"
              >
                <Upload size={13} /> Upload
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 rounded-md disabled:opacity-50"
              >
                <Camera size={13} /> Photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
