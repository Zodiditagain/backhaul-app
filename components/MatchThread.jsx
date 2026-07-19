"use client";

import { useEffect, useState } from "react";
import { Send, Star, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function MatchThread({ match, user, role, onReviewSubmitted, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [rate, setRate] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [onTime, setOnTime] = useState(null);
  const [condition, setCondition] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [truckerDetails, setTruckerDetails] = useState(null);

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

  useEffect(() => {
    loadMessages();
    loadTruckerDetails();
    setSubmitted(false);
    setShowReview(false);
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

  const canReview = role !== "trucker";
  const partnerName = match.trucker?.company_name || match.partner?.company_name || "Conversation";
  const isAccepted = match.status === "accepted";

  return (
    <div className="bg-white border border-gray-300 rounded-sm flex flex-col h-[420px]">
      <div className="bg-asphalt text-white px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">{partnerName}</span>
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

        {messages.length === 0 && <p className="text-sm text-gray-400 italic">No messages yet — open with a lane and a number.</p>}
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
    </div>
  );
}
