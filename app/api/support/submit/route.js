import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthedUser } from "../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same reply-to pattern as the recruiting sender: the "from" address is just
// a branded mailbox on the verified domain, nobody reads it directly. Any
// reply the customer sends lands in an inbox that's actually checked.
const SUPPORT_REPLY_TO = "lorenzomorgan6969@gmail.com";

const SUPPORT_SYSTEM_PROMPT = `You are the automated first-line support responder for Backhaul (joinbackhaul.com), a trucking platform connecting truckers, freight brokers, and vendors (factoring, insurance, fuel, repair, and other trucking-service companies).

What the platform offers, by account type:
- Truckers (free): Route Map (routing/navigation), Market Pulse (freight market rates), Business Tools (fuel cost and load rate calculators), Vendor Directory (browse vendors, free for truckers), Available Trucks postings, Blog, Support.
- Brokers and Vendors (Partner Pro, $199/month flat rate, 30-day free trial, not per-seat): Search Carriers (search live trucker availability by lane), Saved Carriers (save a go-to list), Capacity Alerts (notified when a matching truck opens up), Analytics Dashboard, Referrals (referral link + credit for signups), Vendor Directory access, Available Trucks, Business Tools. Vendors additionally get a Vendor Profile listing.
- Everyone signs up at /signup and manages their account from /dashboard.

Your job: decide whether you can confidently and helpfully answer this support request yourself, with a generic answer that doesn't require looking at the customer's specific account, billing, or data.

Answer it yourself (can_answer: true) ONLY for general "how do I..." / "where do I find..." / "what does X do" / "how does the platform work" questions about the features above, navigating the site, or how billing/trials work in general terms (e.g. "how does the free trial work").

Do NOT answer (can_answer: false) — leave it for a human — if the request:
- Reports a bug, error, or something broken or not working as expected
- Involves their specific account, subscription, payment, refund, or billing dispute
- Expresses frustration, anger, or dissatisfaction
- Asks for something you're not confident is accurate, or that depends on information you don't have
- Is unclear, incomplete, or you're simply not sure

When in doubt, do not answer — a human will handle it. It is much better to leave a request for a human than to send a wrong or unhelpful answer.

If you do answer, write a short, warm, specific reply (2-5 sentences) addressing exactly what they asked, and sign off as "The Backhaul Team".`;

async function classifyAndMaybeAnswer(subject, message) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { can_answer: false };
  }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: SUPPORT_SYSTEM_PROMPT,
      tools: [
        {
          name: "answer_support_request",
          description:
            "Decide whether this support request can be answered directly with a confident, generic answer, and if so, provide that answer.",
          input_schema: {
            type: "object",
            properties: {
              can_answer: {
                type: "boolean",
                description:
                  "true only if this is a general how-to/navigation/product question answerable with no account-specific, billing, refund, bug, or complaint content",
              },
              reply: {
                type: "string",
                description:
                  "The full reply to send the customer. Required if can_answer is true, omit entirely if can_answer is false.",
              },
            },
            required: ["can_answer"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "answer_support_request" },
      messages: [
        {
          role: "user",
          content: `Subject: ${subject}\n\nMessage: ${message}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) return { can_answer: false };
    const input = toolUse.input || {};
    if (input.can_answer && typeof input.reply === "string" && input.reply.trim()) {
      return { can_answer: true, reply: input.reply.trim() };
    }
    return { can_answer: false };
  } catch (err) {
    console.error("Support auto-responder failed:", err);
    return { can_answer: false };
  }
}

export async function POST(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();
  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, company_name")
    .eq("id", user.id)
    .single();

  // Broker/vendor accounts get their support requests flagged as priority
  // for now — once real billing enforcement exists everywhere, this should
  // check active subscription status instead of just role.
  const priority = profile?.role === "broker" || profile?.role === "vendor";

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("support_requests")
    .insert({ user_id: user.id, subject, message, priority })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Best-effort auto-response. Any failure here (missing keys, API error,
  // email send failure) just leaves the ticket as a normal open request for
  // a human to handle — it never blocks or fails the submission itself.
  const decision = await classifyAndMaybeAnswer(subject, message);

  if (!decision.can_answer) {
    return NextResponse.json({ request: inserted });
  }

  let emailSent = false;
  if (process.env.RESEND_API_KEY && process.env.SUPPORT_FROM_EMAIL) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const toEmail = authUser?.user?.email;
      if (toEmail) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const footer = "\n\n---\nBackhaul (joinbackhaul.com)\nReply to this email if this didn't answer your question — a person will follow up.";
        const { error: sendError } = await resend.emails.send({
          from: process.env.SUPPORT_FROM_EMAIL,
          to: toEmail,
          subject: `Re: ${subject}`,
          text: decision.reply + footer,
          replyTo: SUPPORT_REPLY_TO,
        });
        emailSent = !sendError;
      }
    } catch (err) {
      console.error("Support auto-reply email failed:", err);
    }
  }

  if (!emailSent) {
    return NextResponse.json({ request: inserted });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("support_requests")
    .update({
      ai_responded: true,
      ai_reply: decision.reply,
      ai_responded_at: new Date().toISOString(),
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", inserted.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ request: inserted });
  }

  return NextResponse.json({ request: updated });
}
