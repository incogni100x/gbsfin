import { createClient } from "@supabase/supabase-js";
import { authorizeCronRequest, readAsOfDate } from "../_shared/cron-auth.ts";

Deno.serve(async (request) => {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return Response.json({ error: "Server configuration is incomplete" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  let asOfDate: string;
  try {
    asOfDate = readAsOfDate(body.as_of_date);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("process_due_loan_payments", { p_as_of_date: asOfDate });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ...data, job: "process-loan-payments" });
});
