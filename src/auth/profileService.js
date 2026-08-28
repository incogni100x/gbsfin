import { requireSupabase } from "@/lib/supabase/client.js";

const profileColumns = [
  "id",
  "first_name",
  "last_name",
  "phone_number",
  "referral_code",
  "referred_by_code",
  "onboarding_status",
  "created_at",
  "updated_at",
].join(",");

function throwIfError(error) {
  if (error) throw error;
}

export async function getCurrentProfile() {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your session has expired. Please sign in again.");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select(profileColumns)
    .eq("id", user.id)
    .single();
  throwIfError(profileError);

  return { profile, user };
}

export async function updateCurrentProfile({
  firstName,
  lastName,
  phoneNumber,
}) {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your session has expired. Please sign in again.");

  const { data, error } = await client
    .from("profiles")
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: phoneNumber.trim() || null,
    })
    .eq("id", user.id)
    .select(profileColumns)
    .single();
  throwIfError(error);

  return data;
}
