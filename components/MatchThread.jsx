"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck, LogOut, Settings } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import TruckerDashboard from "../../components/TruckerDashboard";
import MatchmakingDashboard from "../../components/MatchmakingDashboard";
import NotificationBell from "../../components/NotificationBell";
export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
      setLoading(false);
    }
    load();
  }, [router]);
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }
  if (loading) return <div className="p-8 text-steelgray">Loading...</div>;
  if (!profile) return <div className="p-8 text-alertred">Couldn't load your profile. Try logging in again.</div>;
  const isPartner = profile.role === "broker" || profile.role === "vendor";
  return (
    <div className="min-h-screen">
      <header className="bg-asphalt border-b-4 border-amberx">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rotate-45 bg-amberx flex items-center justify-center">
              <Truck className="-rotate-45" size={18} color="#1B1E21" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">BACKHAUL</h1>
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mt-0.5">{profile.company_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <NotificationBell user={user} />
            {isPartner && (
              <Link
                href="/onboarding-partner"
                className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
              >
                <Settings size={14} /> Edit Profile
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-300 hover:text-amberx text-xs font-mono uppercase tracking-wide"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6">
        {profile.role === "trucker" ? (
          <TruckerDashboard user={user} />
        ) : (
          <MatchmakingDashboard user={user} role={profile.role} />
        )}
      </main>
    </div>
  );
}
function BolViewer({ bol, user, role, match, onClose, onUpdated }) {
  const [items, setItems] = useState([]);
  const [driverName, setDriverName] = useState(bol.driver_name || "");
  const [driverPhone, setDriverPhone] = useState(bol.driver_phone || "");
  const [truckNumber, setTruckNumber] = useState(bol.truck_number || "");
  const [trailerNumber, setTrailerNumber] = useState(bol.trailer_number || "");
  const [sealNumber, setSealNumber] = useState(bol.seal_number || "");
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [shipperSigName, setShipperSigName] = useState("");
  const [driverSigName, setDriverSigName] = useState("");
  const [pickupCondition, setPickupCondition] = useState("");
  const [pickupPieces, setPickupPieces] = useState("");

  const [receiverSigName, setReceiverSigName] = useState("");
  const [deliveryCondition, setDeliveryCondition] = useState("");
  const [deliveryPieces, setDeliveryPieces] = useState("");

  const [podUrl, setPodUrl] = useState(bol.pod_url || "");
  const [podUploadedAt, setPodUploadedAt] = useState(bol.pod_uploaded_at || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [auditLog, setAuditLog] = useState([]);
  const [auditNames, setAuditNames] = useState({});

  const isTrucker = role === "trucker";
  const isBroker = role === "broker";
  const otherPartyId = isTrucker ? bol.broker_id : bol.trucker_id;
  const canAct = isTrucker && bol.status === "sent";
  const canUpdateStatus = isTrucker && ["accepted", "ready_for_pickup", "signed_at_pickup", "in_transit", "delivered"].includes(bol.status);
  const canComplete = isBroker && bol.status === "receiver_signed";
  const canUploadPod = isTrucker && ["delivered", "receiver_signed", "completed"].includes(bol.status);

  useEffect(() => {
    async function loadItems() {
      const { data } = await supabase
        .from("bol_items")
        .select("*")
        .eq("bol_id", bol.id)
        .order("created_at", { ascending: true });
      setItems(data || []);
    }
    async function loadAudit() {
      const { data } = await supabase
        .from("bol_audit_log")
        .select("*")
        .eq("bol_id", bol.id)
        .order("created_at", { ascending: false });
      setAuditLog(data || []);

      const userIds = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, company_name")
          .in("id", userIds);
        const nameMap = {};
        (profilesData || []).forEach((p) => { nameMap[p.id] = p.company_name; });
        setAuditNames(nameMap);
      }
    }
    loadItems();
    loadAudit();
  }, [bol.id]);

  async function updateBol(fields, messageText, auditAction, auditDetails, notifTitle, notifMessage) {
    setError("");
    setSaving(true);
    const { error: updateError } = await supabase
      .from("bols")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", bol.id);
    if (!updateError) {
      if (messageText) {
        await supabase.from("messages").insert({
          match_id: match.id,
          sender_id: user.id,
          text: messageText,
        });
      }
      if (auditAction) {
        await logAudit(bol.id, user.id, auditAction, auditDetails);
      }
      if (notifTitle) {
        await notify(otherPartyId, match.id, bol.id, notifTitle, notifMessage);
      }
      onUpdated();
      onClose();
    } else {
      setError(updateError.message);
    }
    setSaving(false);
  }

  async function acceptBol() {
    if (!driverName) {
      setError("Enter the assigned driver's name before accepting.");
      return;
    }
    await updateBol(
      {
        driver_name: driverName,
        driver_phone: driverPhone || null,
        truck_number: truckNumber || null,
        trailer_number: trailerNumber || null,
        seal_number: sealNumber || null,
        status: "accepted",
      },
      `✅ BOL ${bol.bol_number} accepted. Driver: ${driverName}.`,
      "accepted",
      `Driver: ${driverName}`,
      `BOL accepted`,
      `${bol.bol_number} accepted. Driver: ${driverName}.`
    );
  }

  async function requestCorrection() {
    if (!correctionNote) {
      setError("Describe what needs to be corrected.");
      return;
    }
    await updateBol(
      { status: "correction_requested", correction_note: correctionNote },
      `⚠️ Correction requested for BOL ${bol.bol_number}: ${correctionNote}`,
      "correction_requested",
      correctionNote,
      `Correction requested`,
      `${bol.bol_number}: ${correctionNote}`
    );
  }

  async function markReadyForPickup() {
    await updateBol(
      { status: "ready_for_pickup" },
      `🚚 BOL ${bol.bol_number} marked ready for pickup.`,
      "ready_for_pickup",
      null,
      `Ready for pickup`,
      `${bol.bol_number} is ready for pickup.`
    );
  }

  async function signAtPickup() {
    if (!driverSigName) {
      setError("Driver signature name is required.");
      return;
    }
    const now = new Date().toISOString();
    await updateBol(
      {
        status: "signed_at_pickup",
        driver_signature_name: driverSigName,
        driver_signature_at: now,
        shipper_signature_name: shipperSigName || null,
        shipper_signature_at: shipperSigName ? now : null,
        pickup_condition: pickupCondition || null,
        pickup_pieces_count: pickupPieces || null,
        picked_up_at: now,
      },
      `✍️ BOL ${bol.bol_number} signed at pickup by ${driverSigName}.`,
      "signed_at_pickup",
      `Driver signature: ${driverSigName}${shipperSigName ? `, Shipper signature: ${shipperSigName}` : ""}`,
      `Signed at pickup`,
      `${bol.bol_number} signed at pickup by ${driverSigName}.`
    );
  }

  async function markInTransit() {
    await updateBol(
      { status: "in_transit" },
      `🛣️ BOL ${bol.bol_number} is now in transit.`,
      "in_transit",
      null,
      `Load in transit`,
      `${bol.bol_number} is now in transit.`
    );
  }

  async function markDelivered() {
    await updateBol(
      { status: "delivered", delivered_at: new Date().toISOString() },
      `📦 BOL ${bol.bol_number} marked delivered.`,
      "delivered",
      null,
      `Load delivered`,
      `${bol.bol_number} marked delivered.`
    );
  }

  async function captureReceiverSignature() {
    if (!receiverSigName) {
      setError("Receiver signature name is required.");
      return;
    }
    await updateBol(
      {
        status: "receiver_signed",
        receiver_signature_name: receiverSigName,
        receiver_signature_at: new Date().toISOString(),
        delivery_condition: deliveryCondition || null,
        delivery_pieces_count: deliveryPieces || null,
      },
      `✍️ Receiver signature captured for BOL ${bol.bol_number} (${receiverSigName}).`,
      "receiver_signed",
      `Receiver signature: ${receiverSigName}`,
      `Receiver signed`,
      `${bol.bol_number} — receiver signature captured (${receiverSigName}).`
    );
  }

  async function markCompleted() {
    await updateBol(
      { status: "completed" },
      `🎉 BOL ${bol.bol_number} marked completed.`,
      "completed",
      null,
      `Load completed`,
      `${bol.bol_number} has been marked completed.`
    );
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `bols/${bol.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("bols")
      .update({
        pod_url: urlData.publicUrl,
        pod_uploaded_at: nowIso,
        pod_uploaded_by: user.id,
        updated_at: nowIso,
      })
      .eq("id", bol.id);

    if (updateError) {
      setError(updateError.message);
      setUploading(false);
      return;
    }

    await supabase.from("messages").insert({
      match_id: match.id,
      sender_id: user.id,
      text: `📎 Signed BOL / POD uploaded for ${bol.bol_number}.`,
    });

    await logAudit(bol.id, user.id, "pod_uploaded", file.name);
    await notify(otherPartyId, match.id, bol.id, "Proof of delivery uploaded", `${bol.bol_number} — POD is now available.`);

    setPodUrl(urlData.publicUrl);
    setPodUploadedAt(nowIso);
    setUploading(false);
    onUpdated();
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 bg-asphalt/80 z-40 flex items-center justify-center px-4 py-6">
      <div className="bg-white rounded-sm w-full max-w-2xl border border-gray-300 flex flex-col max-h-[90vh]">
        <div className="bg-asphalt text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <span className="text-lg font-bold">BOL {bol.bol_number}</span>
            {bol.version > 1 && (
              <span className="text-[10px] bg-white/20 rounded-sm px-1.5 py-0.5 font-mono">v{bol.version}</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 rounded-sm">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {error && <p className="text-alertred text-sm bg-alertred/10 border border-alertred/30 rounded-sm px-3 py-2">{error}</p>}

          <div className={`font-mono uppercase tracking-wide font-semibold text-sm ${STATUS_COLORS[bol.status] || "text-gray-400"}`}>
            Status: {STATUS_LABELS[bol.status] || bol.status}
          </div>

          <ViewSection title="Shipment">
            <ViewRow label="BOL Number" value={bol.bol_number} />
            <ViewRow label="Load Number" value={bol.load_number} />
            <ViewRow label="Pickup Date" value={bol.pickup_date} />
            <ViewRow label="Delivery Date" value={bol.delivery_date} />
            <ViewRow label="PO Number" value={bol.po_number} />
            <ViewRow label="Reference" value={bol.reference_number} />
          </ViewSection>

          <ViewSection title="Shipper">
            <ViewRow label="Company" value={bol.shipper_name} />
            <ViewRow label="Address" value={[bol.shipper_address, bol.shipper_city, bol.shipper_state, bol.shipper_zip].filter(Boolean).join(", ")} />
            <ViewRow label="Contact" value={bol.shipper_contact} />
            <ViewRow label="Phone" value={bol.shipper_phone} />
            <ViewRow label="Instructions" value={bol.pickup_instructions} full />
          </ViewSection>

          <ViewSection title="Consignee">
            <ViewRow label="Company" value={bol.consignee_name} />
            <ViewRow label="Address" value={[bol.consignee_address, bol.consignee_city, bol.consignee_state, bol.consignee_zip].filter(Boolean).join(", ")} />
            <ViewRow label="Contact" value={bol.consignee_contact} />
            <ViewRow label="Phone" value={bol.consignee_phone} />
            <ViewRow label="Instructions" value={bol.delivery_instructions} full />
          </ViewSection>

          <ViewSection title="Carrier">
            <ViewRow label="Company" value={bol.carrier_name} />
            <ViewRow label="USDOT" value={bol.carrier_dot} />
            <ViewRow label="MC" value={bol.carrier_mc} />
            <ViewRow label="Equipment" value={bol.equipment_type} />
            <ViewRow label="Driver" value={bol.driver_name} />
            <ViewRow label="Driver Phone" value={bol.driver_phone} />
            <ViewRow label="Truck #" value={bol.truck_number} />
            <ViewRow label="Trailer #" value={bol.trailer_number} />
          </ViewSection>

          {(bol.driver_signature_name || bol.shipper_signature_name) && (
            <ViewSection title="Pickup Record">
              <ViewRow label="Driver Signature" value={bol.driver_signature_name} />
              <ViewRow label="Signed At" value={bol.driver_signature_at ? new Date(bol.driver_signature_at).toLocaleString() : null} />
              <ViewRow label="Shipper Signature" value={bol.shipper_signature_name} />
              <ViewRow label="Pickup Condition" value={bol.pickup_condition} />
              <ViewRow label="Pieces Picked Up" value={bol.pickup_pieces_count} />
            </ViewSection>
          )}

          {bol.receiver_signature_name && (
            <ViewSection title="Delivery Record">
              <ViewRow label="Receiver Signature" value={bol.receiver_signature_name} />
              <ViewRow label="Signed At" value={bol.receiver_signature_at ? new Date(bol.receiver_signature_at).toLocaleString() : null} />
              <ViewRow label="Delivery Condition" value={bol.delivery_condition} />
              <ViewRow label="Pieces Delivered" value={bol.delivery_pieces_count} />
            </ViewSection>
          )}

          {items.length > 0 && (
            <ViewSection title="Freight">
              {items.map((item, i) => (
                <div key={item.id || i} className="col-span-2 border border-gray-200 rounded-sm p-2.5 text-xs text-steelgray">
                  <div className="font-semibold text-asphalt mb-1">{item.description || `Item ${i + 1}`}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {item.quantity && <div><span className="text-gray-400">Qty:</span> {item.quantity}</div>}
                    {item.packaging_type && <div><span className="text-gray-400">Packaging:</span> {item.packaging_type}</div>}
                    {item.weight && <div><span className="text-gray-400">Weight:</span> {item.weight} lbs</div>}
                    {item.pallet_count && <div><span className="text-gray-400">Pallets:</span> {item.pallet_count}</div>}
                    {item.freight_class && <div><span className="text-gray-400">Class:</span> {item.freight_class}</div>}
                    {item.nmfc_number && <div><span className="text-gray-400">NMFC:</span> {item.nmfc_number}</div>}
                    {item.hazmat && <div className="text-alertred font-semibold">HAZMAT</div>}
                  </div>
                  {item.handling_instructions && (
                    <div className="mt-1"><span className="text-gray-400">Handling:</span> {item.handling_instructions}</div>
                  )}
                </div>
              ))}
            </ViewSection>
          )}

          <ViewSection title="Charges & Terms">
            <ViewRow label="Freight Charges" value={bol.freight_charges} />
            <ViewRow label="Declared Value" value={bol.declared_value} />
            <ViewRow label="COD Amount" value={bol.cod_amount} />
            <ViewRow label="Temperature" value={bol.temperature_requirement} />
            <ViewRow label="Seal Number" value={bol.seal_number} />
            <ViewRow label="Special Instructions" value={bol.special_instructions} full />
          </ViewSection>

          {canAct && (
            <div className="border-t-2 border-amberx pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-1">Your Information</h3>
              <p className="text-xs text-gray-400 mb-1">Enter your driver and equipment details, then accept — or request a correction if something's wrong.</p>
              <p className="text-xs text-amberx font-semibold mb-3">Your information is saved only when you click Accept BOL.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <ActField label="Driver Name *" value={driverName} onChange={setDriverName} />
                <ActField label="Driver Phone" value={driverPhone} onChange={setDriverPhone} />
                <ActField label="Truck Number" value={truckNumber} onChange={setTruckNumber} />
                <ActField label="Trailer Number" value={trailerNumber} onChange={setTrailerNumber} />
                <ActField label="Seal Number" value={sealNumber} onChange={setSealNumber} />
              </div>

              {showCorrection ? (
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wide text-steelgray">What needs to be corrected?</label>
                  <textarea
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Freight weight does not match the load confirmation."
                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={requestCorrection}
                      disabled={saving}
                      className="flex-1 bg-alertred text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-red-800 disabled:opacity-50"
                    >
                      {saving ? "Sending..." : "Send Correction Request"}
                    </button>
                    <button
                      onClick={() => setShowCorrection(false)}
                      className="flex-1 border border-gray-300 py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={acceptBol}
                    disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-green-800 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Accept BOL"}
                  </button>
                  <button
                    onClick={() => setShowCorrection(true)}
                    className="flex-1 border border-alertred text-alertred py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-alertred/10"
                  >
                    Request Correction
                  </button>
                </div>
              )}
            </div>
          )}

          {canUpdateStatus && bol.status === "accepted" && (
            <div className="border-t-2 border-blue-600 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3">Next Step</h3>
              <button
                onClick={markReadyForPickup}
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark Ready for Pickup"}
              </button>
            </div>
          )}

          {canUpdateStatus && bol.status === "ready_for_pickup" && (
            <div className="border-t-2 border-blue-600 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-1">Confirm Pickup</h3>
              <p className="text-xs text-gray-400 mb-3">Sign to confirm freight has been picked up from the shipper.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <ActField label="Driver Signature (Print Name) *" value={driverSigName} onChange={setDriverSigName} />
                <ActField label="Shipper Signature (Print Name)" value={shipperSigName} onChange={setShipperSigName} />
                <ActField label="Pickup Condition" value={pickupCondition} onChange={setPickupCondition} />
                <ActField label="Pieces Picked Up" value={pickupPieces} onChange={setPickupPieces} />
              </div>
              <button
                onClick={signAtPickup}
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Sign & Confirm Pickup"}
              </button>
            </div>
          )}

          {canUpdateStatus && bol.status === "signed_at_pickup" && (
            <div className="border-t-2 border-blue-600 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3">Next Step</h3>
              <button
                onClick={markInTransit}
                disabled={saving}
                className="w-full bg-amberx text-asphalt py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-yellow-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark In Transit"}
              </button>
            </div>
          )}

          {canUpdateStatus && bol.status === "in_transit" && (
            <div className="border-t-2 border-blue-600 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3">Next Step</h3>
              <button
                onClick={markDelivered}
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark Delivered"}
              </button>
            </div>
          )}

          {canUpdateStatus && bol.status === "delivered" && (
            <div className="border-t-2 border-highway pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-1">Capture Proof of Delivery</h3>
              <p className="text-xs text-gray-400 mb-3">Have the receiver sign to confirm delivery.</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <ActField label="Receiver Signature (Print Name) *" value={receiverSigName} onChange={setReceiverSigName} />
                <ActField label="Delivery Condition" value={deliveryCondition} onChange={setDeliveryCondition} />
                <ActField label="Pieces Delivered" value={deliveryPieces} onChange={setDeliveryPieces} />
              </div>
              <button
                onClick={captureReceiverSignature}
                disabled={saving}
                className="w-full bg-green-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Capture Receiver Signature"}
              </button>
            </div>
          )}

          {canComplete && (
            <div className="border-t-2 border-highway pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3">Close Out Load</h3>
              <button
                onClick={markCompleted}
                disabled={saving}
                className="w-full bg-green-600 text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark Completed"}
              </button>
            </div>
          )}

          {(podUrl || canUploadPod) && (
            <div className="border-t-2 border-gray-300 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3">Proof of Delivery</h3>

              {podUrl && (
                <a
                  href={podUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 underline mb-3"
                >
                  <Paperclip size={14} /> View uploaded POD
                  {podUploadedAt && (
                    <span className="text-xs text-gray-400 no-underline">
                      — {new Date(podUploadedAt).toLocaleString()}
                    </span>
                  )}
                </a>
              )}

              {canUploadPod && (
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
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
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 hover:border-asphalt text-asphalt py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide disabled:opacity-50"
                  >
                    <Upload size={14} /> {uploading ? "Uploading..." : "Upload Signed BOL / POD"}
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-asphalt text-white py-2.5 rounded-sm font-mono text-xs uppercase tracking-wide hover:bg-black disabled:opacity-50"
                  >
                    <Camera size={14} /> {uploading ? "Uploading..." : "Take Photo"}
                  </button>
                </div>
              )}
            </div>
          )}

          {auditLog.length > 0 && (
            <div className="border-t-2 border-gray-300 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-asphalt mb-3 flex items-center gap-1.5">
                <Clock size={14} /> History
              </h3>
              <div className="space-y-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="text-xs text-steelgray border-l-2 border-gray-200 pl-2.5">
                    <div className="font-semibold text-asphalt">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </div>
                    <div className="text-gray-400">
                      {auditNames[entry.user_id] || "Unknown"} — {new Date(entry.created_at).toLocaleString()}
                    </div>
                    {entry.details && <div className="text-gray-500 mt-0.5">{entry.details}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewSection({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-steelgray border-b border-gray-200 pb-1.5 mb-2">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </section>
  );
}

function ViewRow({ label, value, full }) {
  if (!value) return null;
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <span className="text-xs text-gray-400">{label}:</span>{" "}
      <span className="text-sm text-asphalt">{value}</span>
    </div>
  );
}

function ActField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-steelgray mb-1">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
      />
    </div>
  );
}
