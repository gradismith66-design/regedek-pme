import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Session authentifiée requise." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Configuration serveur Supabase incomplète." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  if (userError || !userResult.user) return json({ error: "Session invalide ou expirée." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("staff_profiles")
    .select("role")
    .eq("user_id", userResult.user.id)
    .maybeSingle();
  if (profileError) return json({ error: `Vérification du rôle impossible : ${profileError.message}` }, 500);
  if (
    profile?.role !== "admin" ||
    userResult.user.email?.toLowerCase() !== "gradismith66@gmail.com"
  ) {
    return json({ error: "Action réservée au Super Admin principal." }, 403);
  }

  let payload: { action?: string; email?: string; role?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Corps de requête JSON invalide." }, 400);
  }
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role;
  if (payload.action !== "invite" || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Action ou adresse e-mail invalide." }, 400);
  }
  if (!role || !["agent", "reader", "custom"].includes(role)) {
    return json({ error: "Rôle d’invitation invalide." }, 400);
  }
  if (email === "gradismith66@gmail.com") {
    return json({ error: "Le compte Super Admin principal ne peut pas être invité avec un autre rôle." }, 400);
  }

  const redirectTo = Deno.env.get("SUPABASE_AUTH_REDIRECT_URL");
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteError) return json({ error: `Invitation non envoyée : ${inviteError.message}` }, 400);
  if (!invited.user) return json({ error: "Supabase n’a pas retourné l’utilisateur invité." }, 502);

  const { error: roleError } = await adminClient
    .from("staff_profiles")
    .upsert({ user_id: invited.user.id, role }, { onConflict: "user_id" });
  if (roleError) {
    return json({
      error: `Invitation envoyée, mais attribution du rôle impossible : ${roleError.message}. Réessaie depuis la gestion des rôles.`,
    }, 500);
  }

  const { error: activityError } = await userClient.rpc("admin_log_staff_invitation", {
    p_email: email,
    p_role: role,
  });
  if (activityError) {
    return json({
      error: `Invitation envoyée et rôle attribué, mais journalisation impossible : ${activityError.message}.`,
    }, 500);
  }

  return json({ message: `Invitation envoyée à ${email}; rôle attribué : ${role}.` });
});
