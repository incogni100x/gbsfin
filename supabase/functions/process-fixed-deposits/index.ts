import { createClient } from "@supabase/supabase-js";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const suppliedKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("apikey");
  if (!url || !serviceKey) return Response.json({ error: "Server configuration is incomplete" }, { status: 500 });
  if (suppliedKey !== serviceKey) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const asOfDate = body.as_of_date ?? new Date().toISOString().slice(0, 10);
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("process_daily_fixed_deposits", { p_as_of_date: asOfDate });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
});
