"use client";

import { useEffect, useState } from "react";
import { Send, Star, CheckCircle2, FileText, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import BolForm from "./BolForm";

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Carrier Action Required",
  correction_requested: "Correction Requested",
  accepted: "Carrier Accepted",
};

const STATUS_COLORS = {
  draft: "text-gray-400",
  sent: "text-amberx",
  correction_requested: "text-alertred",
  accepted: "text-highway",
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
                <Star size={16} className={n <= condition ? "fill-amberx text-amberx" :
