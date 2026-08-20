import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "../../../../../lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = ["trucker", "broker", "vendor"];
// A lead already drafted for this same contact recently is skipped, so the
// weekly research run doesn't re-draft (and eventually re-email) the same
// company over and over.
const DEDUPE_WINDOW_DAYS = 25;
const MAX_LEADS_PER_CALL = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLead(lead) {
  if (!lead || typeof lead !== "object") return "not an object";
  if (!VALID_ROLES.includes(lead.role_target)) return "role_target must be trucker, broker, or vendor";
  if (!lead.company_name || !String(lead.company_name).trim()) return "missing company_name";
  if (!lead.contact_email || !EMAIL_RE.test(String(lead.contact_email).trim())) return "missing or invalid contact_email";
  if (!lead.source_url || !String(lead.source_url).trim()) return "missing source_url";
  if (!lead.email_subject || !String(lead.email_subject).trim()) return "missing email_subject";
  if (!lead.email_body || !String(lead.email_body).trim()) return "missing email_body";
  return null;
}

// Admin-authenticated equivalent of what the Recruiting AI's scheduled run
// would otherwise POST directly — see recruit_leads schema notes. The
// automation's own execution environment cannot reach this site over the
// network, so instead it prints a "leads" JSON array in its weekly report
// and an admin pastes it here, submitting from their own unrestricted
// browser rather than the automation trying to call out to us.
export async function POST(req) {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const leads = Array.isArray(body?.leads) ? body.leads : null;
  if (!leads) {
    return NextResponse.json({ error: '"leads" must be an array' }, { status: 400 });
  }

  const toValidate = leads.slice(0, MAX_LEADS_PER_CALL);
  const overflow = leads.length - toValidate.length;

  const details = [];
  let submitted = 0;
  let skippedDuplicate = 0;
  let rejectedInvalid = 0;

  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const lead of toValidate) {
    const reason = validateLead(lead);
    if (reason) {
      rejectedInvalid += 1;
      details.push({ contact_email: lead?.contact_email || null, outcome: "rejected", reason });
      continue;
    }

    const contactEmail = String(lead.contact_email).trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("recruit_leads")
      .select("id")
      .eq("contact_email", contactEmail)
      .gte("created_at", cutoff)
      .limit(1);

    if (existing && existing.length > 0) {
      skippedDuplicate += 1;
      details.push({ contact_email: contactEmail, outcome: "skipped_duplicate" });
      continue;
    }

    const { error: insertError } = await supabaseAdmin.from("recruit_leads").insert({
      lead_type: "external_prospect",
      role_target: lead.role_target,
      profile_id: null,
      company_name: String(lead.company_name).trim(),
      contact_name: lead.contact_name ? String(lead.contact_name).trim() : null,
      contact_email: contactEmail,
      source: lead.source ? String(lead.source).trim() : null,
      source_url: String(lead.source_url).trim(),
      email_subject: String(lead.email_subject).trim(),
      email_body: String(lead.email_body).trim(),
      status: "new",
    });

    if (insertError) {
      rejectedInvalid += 1;
      details.push({ contact_email: contactEmail, outcome: "rejected", reason: insertError.message });
      continue;
    }

    submitted += 1;
    details.push({ contact_email: contactEmail, outcome: "submitted" });
  }

  return NextResponse.json({
    success: true,
    submitted,
    skipped_duplicate: skippedDuplicate,
    rejected_invalid: rejectedInvalid,
    overflow_ignored: overflow > 0 ? overflow : 0,
    details,
  });
}
