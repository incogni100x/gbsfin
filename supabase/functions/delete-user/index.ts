import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const USER_STORAGE_BUCKETS = ["identity-documents", "cheque-deposits"] as const;
const MAX_BATCH_SIZE = 50;
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

async function deleteUserFiles(
  client: SupabaseClient,
  userId: string,
) {
  let deletedFileCount = 0;

  for (const bucket of USER_STORAGE_BUCKETS) {
    const files = await listFilesRecursively(client, bucket, userId);

    for (let index = 0; index < files.length; index += REMOVE_BATCH_SIZE) {
      const batch = files.slice(index, index + REMOVE_BATCH_SIZE);
      const { error } = await client.storage.from(bucket).remove(batch);
      if (error) throw error;
    }

    const remainingFiles = await listFilesRecursively(client, bucket, userId);
    if (remainingFiles.length > 0) {
      throw new Error(`Some files could not be removed from ${bucket}`);
    }
    deletedFileCount += files.length;
  }

  return deletedFileCount;
}

function parseTargetUserIds(requestBody: Record<string, unknown>) {
  const batchIds = requestBody.user_ids;
  const batchConfirmationIds = requestBody.confirm_user_ids;

  if (batchIds !== undefined || batchConfirmationIds !== undefined) {
    if (!Array.isArray(batchIds) || !Array.isArray(batchConfirmationIds)) {
      throw new Error("user_ids and confirm_user_ids must both be arrays");
    }
    if (batchIds.length === 0 || batchIds.length > MAX_BATCH_SIZE) {
      throw new Error(`Provide between 1 and ${MAX_BATCH_SIZE} user IDs`);
    }
    if (
      batchIds.length !== batchConfirmationIds.length ||
      batchIds.some((id, index) => !isUuid(id) || id !== batchConfirmationIds[index])
    ) {
      throw new Error("user_ids and confirm_user_ids must contain the same valid UUIDs in the same order");
    }
    if (new Set(batchIds).size !== batchIds.length) {
      throw new Error("user_ids must not contain duplicates");
    }
    return batchIds as string[];
  }

  const userId = requestBody.user_id;
  if (!isUuid(userId) || requestBody.confirm_user_id !== userId) {
    throw new Error("user_id and confirm_user_id must be the same valid UUID");
  }
  return [userId];
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

  let userIds: string[];
  try {
    userIds = parseTargetUserIds(requestBody);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid user IDs" },
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

    if (userIds.length !== 1 || data.user.id !== userIds[0]) {
      return jsonResponse(
        { error: "User sessions can only delete their own account" },
        403,
      );
    }
  }

  const missingUserIds: string[] = [];
  for (const userId of userIds) {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error || !data.user) missingUserIds.push(userId);
  }

  if (missingUserIds.length > 0) {
    return jsonResponse(
      {
        error: "One or more users were not found. No users were deleted.",
        missing_user_ids: missingUserIds,
      },
      404,
    );
  }

  const deletedUsers: Array<{
    deleted_file_count: number;
    user_id: string;
  }> = [];
  const failedUsers: Array<{ error: string; user_id: string }> = [];

  for (const userId of userIds) {
    try {
      const deletedFileCount = await deleteUserFiles(adminClient, userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId, false);
      if (error) throw error;
      deletedUsers.push({
        deleted_file_count: deletedFileCount,
        user_id: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("User deletion failed", { message, userId });
      failedUsers.push({
        error: "Deletion failed. This user is safe to retry.",
        user_id: userId,
      });
    }
  }

  const allDeleted = failedUsers.length === 0;
  const response: Record<string, unknown> = {
    deleted: allDeleted,
    deleted_count: deletedUsers.length,
    deleted_users: deletedUsers,
    failed_count: failedUsers.length,
    failed_users: failedUsers,
    requested_count: userIds.length,
  };

  if (userIds.length === 1 && deletedUsers[0]) {
    response.user_id = deletedUsers[0].user_id;
    response.deleted_document_count = deletedUsers[0].deleted_file_count;
  }

  return jsonResponse(response, allDeleted ? 200 : deletedUsers.length ? 207 : 500);
});
