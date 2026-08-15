import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Builds an Authorization header carrying the current session's access
// token, for calling our own API routes that require a logged-in user
// (see lib/apiAuth.js on the server side). Returns {} if there's no active
// session, which those routes will correctly treat as unauthenticated.
export async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
