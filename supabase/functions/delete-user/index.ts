import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const IDENTITY_DOCUMENTS_BUCKET = "identity-documents";
const LIST_PAGE_SIZE = 100;
const REMOVE_BATCH_SIZE = 1000;

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, { headers: corsHeaders, status });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function listFilesRecursively(
  client: SupabaseClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;

  while (true) {
    const { data: entries, error } = await client.storage
      .from(bucket)
      .list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw error;
    if (!entries?.length) break;

    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;

      if (entry.id === null) {
        files.push(...(await listFilesRecursively(client, bucket, path)));
      } else {
        files.push(path);
      }
    }

    if (entries.length < LIST_PAGE_SIZE) break;
    offset += entries.length;
  }

  return files;
}

async function deleteIdentityDocuments(
  client: SupabaseClient,
  userId: string,
) {
  const files = await listFilesRecursively(
    client,
    IDENTITY_DOCUMENTS_BUCKET,
    userId,
  );

  for (let index = 0; index < files.length; index += REMOVE_BATCH_SIZE) {
    const batch = files.slice(index, index + REMOVE_BATCH_SIZE);
    const { error } = await client.storage
      .from(IDENTITY_DOCUMENTS_BUCKET)
      .remove(batch);

    if (error) throw error;
  }

  const remainingFiles = await listFilesRecursively(
    client,
    IDENTITY_DOCUMENTS_BUCKET,
    userId,
  );

  if (remainingFiles.length > 0) {
    throw new Error("Some identity documents could not be removed");
  }

  return files.length;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Required Supabase environment variables are unavailable");
    return jsonResponse({ error: "Deletion service is unavailable" }, 503);
  }

  const token = getBearerToken(request);
  const apiKey = request.headers.get("apikey");

  if (!token && !apiKey) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  let requestBody: Record<string, unknown>;

  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: "A valid JSON body is required" }, 400);
  }

  const userId = requestBody.user_id;
  const confirmationUserId = requestBody.confirm_user_id;

  if (!isUuid(userId) || confirmationUserId !== userId) {
    return jsonResponse(
      { error: "user_id and confirm_user_id must be the same valid user ID" },
      400,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const isServiceRequest =
    (token !== null && constantTimeEqual(token, serviceRoleKey)) ||
    (apiKey !== null && constantTimeEqual(apiKey, serviceRoleKey));

  if (!isServiceRequest) {
    if (!token) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const { data, error } = await adminClient.auth.getUser(token);

    if (error || !data.user) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    if (data.user.id !== userId) {
      return jsonResponse(
        { error: "You can only delete your own account" },
        403,
      );
    }
  }

  const { data: targetUser, error: targetUserError } =
    await adminClient.auth.admin.getUserById(userId);

  if (targetUserError || !targetUser.user) {
    return jsonResponse({ error: "User was not found" }, 404);
  }

  try {
    const deletedDocumentCount = await deleteIdentityDocuments(
      adminClient,
      userId,
    );
    const { error: deleteUserError } =
      await adminClient.auth.admin.deleteUser(userId, false);

    if (deleteUserError) throw deleteUserError;

    return jsonResponse(
      {
        deleted: true,
        deleted_document_count: deletedDocumentCount,
        user_id: userId,
      },
      200,
    );
  } catch (error) {
    console.error("User deletion failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      userId,
    });

    return jsonResponse(
      {
        error:
          "The user could not be fully deleted. The operation is safe to retry.",
      },
      500,
    );
  }
});
