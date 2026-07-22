"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Star, CheckCircle2, FileText, X, Upload, Camera, Paperclip } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import BolForm from "./BolForm";

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Carrier Action Required",
  correction_requested: "Correction Requested",
  accepted: "Carrier Accepted",
  ready_for_pickup: "Ready for Pickup",
  signed_at_pickup: "Signed at Pickup",
  in_transit: "In Transit",
  delivered: "Delivered",
  receiver_signed: "Receiver Signed",
  completed: "Completed",
};

const STATUS_COLORS = {
  draft: "text-gray-400",
  sent: "text-amberx",
  correction_requested: "text-alertred",
  accepted: "text-highway",
  ready_for_pickup: "text-blue-600",
  signed_at_pickup: "text-blue-600",
  in_transit: "text-amberx",
  delivered: "text-blue-600",
  receiver_signed: "text-highway",
  completed: "text-highway",
};

export default function MatchThread({ match, user, role, onReviewSubmitted, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [rate, setRate] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [onTime, setOnTime] = useState(null);
  const [condition, setCondition] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [truckerDetails, setTruckerDetails] = useState(null);
  const [bols, setBols] = useState([]);
  const [showBolForm, setShowBolForm] = useState(false);
  const [editingBol, setEditingBol] = useState(null);
  const [viewingBol, setViewingBol] = useState(null);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", match.id)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function loadTruckerDetails() {
    if (!match.trucker_id) return;
    const { data } = await supabase
      .from("trucker_details")
      .select("lanes, equipment, fleet_size")
      .eq("id", match.trucker_id)
      .maybeSingle();
    setTruckerDetails(data || null);
  }

  async function loadBols() {
    const { data } = await supabase
      .from("bols")
      .select("*")
      .eq("match_id", match.id)
      .order("created_at", { ascending: false });
    setBols(data || []);
  }

  useEffect(() => {
    loadMessages();
    loadTruckerDetails();
    loadBols();
    setSubmitted(false);
    setShowReview(false);
    setShowBolForm(false);
    setEditingBol(null);
    setViewingBol(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  async function send() {
    if (!text && !rate) return;
    const { error } = await supabase.from("messages").insert({
      match_id: match.id,
      sender_id: user.id,
      text,
      rate: rate ? Number(rate) : null,
    });
    if (!error) {
      setText("");
      setRate("");
      loadMessages();
      if (onMessageSent) onMessageSent();
    }
  }

  async function submitReview() {
    if (onTime === null || condition === 0) return;
    const { error } = await supabase.from("reviews").insert({
      trucker_id: match.trucker_id,
      reviewer_id: user.id,
      on_time: onTime,
      condition,
    });
    if (!error) {
      setSubmitted(true);
      setShowReview(false);
      if (onReviewSubmitted) onReviewSubmitted();
    }
  }

  function handleBolSaved() {
    loadBols();
    loadMessages();
    if (onMessageSent) onMessageSent();
  }

  const canReview = role !== "trucker";
  const isBroker = role === "broker";
  const isTrucker = role === "trucker";
  const partnerName = match.trucker?.company_name || match.partner?.company_name || "Conversation";
  const isAccepted = match.status === "accepted";
  const visibleBols = isTrucker ? bols.filter((b) => b.status !== "draft") : bols;

  const truckerActionStatuses = ["accepted", "ready_for_pickup", "signed_at_pickup", "in_transit", "delivered"];

  return (
    <div className="bg-white border border-gray-300 rounded-sm flex flex-col h-[480px]">
      <div className="bg-asphalt text-white px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">{partnerName}</span>
        <div className="flex items-center gap-2">
          {isBroker && isAccepted && (
            <button
              onClick={() => { setEditingBol(null); setShowBolForm(true); }}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide border border-white/40 rounded-sm px-2 py-1 hover:border-amberx hover:text-amberx"
            >
              <FileText size={12} /> Create BOL
            </button>
          )}
          {canReview && !submitted && (
            <button
              onClick={() => setShowReview((v) => !v)}
              className="text-[10px] uppercase tracking-wide border border-white/40 rounded-sm px-2 py-1 hover:border-amberx hover:text-amberx"
            >
              Mark delivered
            </button>
          )}
          {submitted && <span className="text-[10px] uppercase tracking-wide text-amberx">Review submitted</span>}
        </div>
      </div>

      {showReview && (
        <div className="bg-amberx/10 border-b border-amberx/40 px-4 py-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-yellow-800">Rate this carrier's job — tracked separately</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-steelgray w-32">Delivered on time?</span>
            <button onClick={() => setOnTime(true)} className={`px-2 py-1 rounded-sm border ${onTime === true ? "bg-highway text-white border-highway" : "border-gray-300"}`}>Yes</button>
            <button onClick={() => setOnTime(false)} className={`px-2 py-1 rounded-sm border ${onTime === false ? "bg-alertred text-white border-alertred" : "border-gray-300"}`}>No</button>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-steelgray w-32">Freight condition:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCondition(n)}>
                <Star size={16} className={n <= condition ? "fill-amberx text-amberx" : "text-gray-300"} />
              </button>
            ))}
          </div>
          <button onClick={submitReview} className="mt-1 bg-asphalt text-white text-xs uppercase tracking-wide px-3 py-1.5 rounded-sm hover:bg-steelgray">
            Submit review
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isAccepted && (
          <div className="bg-highway/10 border border-highway/30 rounded-sm px-3 py-2.5 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-highway shrink-0 mt-0.5" />
            <p className="text-xs text-steelgray">
              <span className="font-semibold text-highway">Connection accepted.</span> You can now message each other.
            </p>
          </div>
        )}

        {truckerDetails && (truckerDetails.lanes || truckerDetails.equipment || truckerDetails.fleet_size) && (
          <div className="bg-gray-50 border border-gray-200 rounded-sm px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-mono mb-1.5">
              {role === "trucker" ? "Your details for this connection" : "Carrier details"}
            </p>
            <div className="grid grid-cols-1 gap-1 text-xs text-steelgray">
              {truckerDetails.lanes && (
                <div><span className="text-gray-400">Lanes:</span> {truckerDetails.lanes}</div>
              )}
              {truckerDetails.equipment && (
                <div><span className="text-gray-400">Equipment:</span> {truckerDetails.equipment}</div>
              )}
              {truckerDetails.fleet_size && (
                <div><span className="text-gray-400">Fleet:</span> {truckerDetails.fleet_size} trucks</div>
              )}
            </div>
          </div>
        )}

        {visibleBols.map((bol) => (
          <div key={bol.id} className="border border-gray-300 rounded-sm overflow-hidden">
            <div className="bg-asphalt/5 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
              <FileText size={14} className="text-steelgray" />
              <span className="text-xs font-bold uppercase tracking-wide text-asphalt">Bill of Lading</span>
            </div>
            <div className="px-3 py-2.5 text-xs text-steelgray space-y-1">
              <div><span className="text-gray-400">BOL:</span> {bol.bol_number}</div>
              {bol.load_number && <div><span className="text-gray-400">Load:</span> {bol.load_number}</div>}
              <div>
                <span className="text-gray-400">Route:</span>{" "}
                {[bol.shipper_city, bol.shipper_state].filter(Boolean).join(", ") || "—"}
                {" → "}
                {[bol.consignee_city, bol.consignee_state].filter(Boolean).join(", ") || "—"}
              </div>
              {bol.pickup_date && (
                <div>
                  <span className="text-gray-400">Pickup:</span>{" "}
                  {new Date(bol.pickup_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
              <div className={`font-mono uppercase tracking-wide font-semibold ${STATUS_COLORS[bol.status] || "text-gray-400"}`}>
                Status: {STATUS_LABELS[bol.status] || bol.status}
              </div>
              {bol.pod_url && (
                <div className="flex items-center gap-1 text-highway">
                  <Paperclip size={11} /> POD attached
                </div>
              )}
              {bol.status === "correction_requested" && bol.correction_note && (
                <div className="bg-alertred/10 border border-alertred/30 rounded-sm px-2 py-1.5 mt-1">
                  <span className="text-alertred font-semibold">Correction requested:</span> {bol.correction_note}
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 px-3 py-2 flex gap-2">
              <button
                onClick={() => setViewingBol(bol)}
                className="text-[11px] uppercase tracking-wide border border-gray-300 hover:border-asphalt rounded-sm px-2.5 py-1.5"
              >
                View BOL
              </button>
              {isBroker && (bol.status === "draft" || bol.status === "correction_requested") && (
                <button
                  onClick={() => { setEditingBol(bol); setShowBolForm(true); }}
                  className="text-[11px] uppercase tracking-wide bg-asphalt text-white rounded-sm px-2.5 py-1.5 hover:bg-black"
                >
                  {bol.status === "draft" ? "Edit & Send" : "Fix & Resend"}
                </button>
              )}
              {isTrucker && bol.status === "sent" && (
                <button
                  onClick={() => setViewingBol(bol)}
                  className="text-[11px] uppercase tracking-wide bg-asphalt text-white rounded-sm px-2.5 py-1.5 hover:bg-black"
                >
                  Complete Information
                </button>
              )}
              {isTrucker && truckerActionStatuses.includes(bol.status) && (
                <button
                  onClick={() => setViewingBol(bol)}
                  className="text-[11px] uppercase tracking-wide bg-blue-600 text-white rounded-sm px-2.5 py-1.5 hover:bg-blue-800"
                >
                  Update Status
                </button>
              )}
              {isBroker && bol.status === "receiver_signed" && (
                <button
                  onClick={() => setViewingBol(bol)}
                  className="text-[11px] uppercase tracking-wide bg-green-600 text-white rounded-sm px-2.5 py-1.5 hover:bg-green-800"
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        ))}

        {messages.length === 0 && visibleBols.length === 0 && (
          <p className="text-sm text-gray-400 italic">No messages yet — open with a lane and a number.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] px-3 py-2 rounded-sm text-sm ${m.sender_id === user.id ? "ml-auto bg-amberx/20" : "bg-concrete"}`}
          >
            {m.rate && <div className="font-semibold text-xs mb-0.5">Offer: ${m.rate}/mi</div>}
            {m.text && <div>{m.text}</div>}
          </div>
        ))}
      </div>
      <div className="border-t border-gray-300 p-3 flex items-center gap-2">
        <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="$/mi" className="w-20 border border-gray-300 rounded-sm px-2 py-2 text-sm" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="w-9 h-9 flex items-center justify-center bg-asphalt text-white rounded-sm hover:bg-steelgray">
          <Send size={15} />
        </button>
      </div>

      {showBolForm && (
        <BolForm
          match={match}
          user={user}
          existingBol={editingBol}
          onClose={() => { setShowBolForm(false); setEditingBol(null); }}
          onSaved={handleBolSaved}
        />
      )}

      {viewingBol && (
        <BolViewer
          bol={viewingBol}
          user={user}
          role={role}
          match={match}
          onClose={() => setViewingBol(null)}
          onUpdated={handleBolSaved}
        />
      )}
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

  const isTrucker = role === "trucker";
  const isBroker = role === "broker";
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
    loadItems();
  }, [bol.id]);

  async function updateBol(fields, messageText) {
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
      `✅ BOL ${bol.bol_number} accepted. Driver: ${driverName}.`
    );
  }

  async function requestCorrection() {
    if (!correctionNote) {
      setError("Describe what needs to be corrected.");
      return;
    }
    await updateBol(
      { status: "correction_requested", correction_note: correctionNote },
      `⚠️ Correction requested for BOL ${bol.bol_number}: ${correctionNote}`
    );
  }

  async function markReadyForPickup() {
    await updateBol(
      { status: "ready_for_pickup" },
      `🚚 BOL ${bol.bol_number} marked ready for pickup.`
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
      `✍️ BOL ${bol.bol_number} signed at pickup by ${driverSigName}.`
    );
  }

  async function markInTransit() {
    await updateBol(
      { status: "in_transit" },
      `🛣️ BOL ${bol.bol_number} is now in transit.`
    );
  }

  async function markDelivered() {
    await updateBol(
      { status: "delivered", delivered_at: new Date().toISOString() },
      `📦 BOL ${bol.bol_number} marked delivered.`
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
      `✍️ Receiver signature captured for BOL ${bol.bol_number} (${receiverSigName}).`
    );
  }

  async function markCompleted() {
    await updateBol(
      { status: "completed" },
      `🎉 BOL ${bol.bol_number} marked completed.`
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
