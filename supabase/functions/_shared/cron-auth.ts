export function authorizeCronRequest(request: Request): Response | null {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { headers: { Allow: "POST" }, status: 405 },
    );
  }

  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret) {
    return Response.json(
      { error: "Cron authentication is not configured" },
      { status: 500 },
    );
  }

  if (request.headers.get("x-cron-secret") !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function readAsOfDate(value: unknown): string {
  const fallback = new Date().toISOString().slice(0, 10);
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("as_of_date must use YYYY-MM-DD format");
  }
  return value;
}
