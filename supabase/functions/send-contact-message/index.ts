const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SUPPORT_EMAIL = "support@globalstripefin.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) {
    return json({ error: "Message is too large" }, 413);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Enter your contact details and message" }, 400);
  }

  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const email = clean(body.email).toLowerCase();
  const subject = clean(body.subject);
  const message = clean(body.message);
  const website = clean(body.website);

  // Honeypot submissions receive a normal response without sending email.
  if (website) return json({ delivered: true });

  if (firstName.length < 2 || firstName.length > 80) {
    return json({ error: "Enter a valid first name" }, 400);
  }
  if (lastName.length < 2 || lastName.length > 80) {
    return json({ error: "Enter a valid last name" }, 400);
  }
  if (!isEmail(email)) {
    return json({ error: "Enter a valid email address" }, 400);
  }
  if (subject.length < 3 || subject.length > 160) {
    return json({ error: "Subject must be between 3 and 160 characters" }, 400);
  }
  if (message.length < 10 || message.length > 5_000) {
    return json({ error: "Message must be between 10 and 5,000 characters" }, 400);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ??
    `Global Stripe Fin <${SUPPORT_EMAIL}>`;

  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return json({ error: "Contact service is temporarily unavailable" }, 503);
  }

  const safeName = escapeHtml(`${firstName} ${lastName}`);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [SUPPORT_EMAIL],
      reply_to: email,
      subject: `[Website contact] ${subject}`,
      text: [
        `From: ${firstName} ${lastName}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        "",
        message,
      ].join("\n"),
      html: `
        <h2>New website contact message</h2>
        <p><strong>From:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p>${safeMessage}</p>
      `,
    }),
  });

  if (!response.ok) {
    const providerError = await response.text();
    console.error("Resend rejected contact email", response.status, providerError);
    return json({ error: "Your message could not be sent. Please try again." }, 502);
  }

  return json({ delivered: true });
});
