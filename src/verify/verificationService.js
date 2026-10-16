import { requireSupabase } from "@/lib/supabase/client.js";

async function functionErrorMessage(error) {
  try {
    const payload = await error?.context?.json?.();
    return payload?.error || error?.message;
  } catch {
    return error?.message;
  }
}

export async function submitVerification({
  emailOrReference,
  files,
  ssn,
  website = "",
}) {
  const formData = new FormData();
  formData.set("ssn", ssn);
  formData.set("emailOrReference", emailOrReference);
  formData.set("selfie", files.selfie);
  formData.set("idFront", files.idFront);
  formData.set("idBack", files.idBack);
  formData.set("website", website);

  const { data, error } = await requireSupabase().functions.invoke(
    "submit-verification",
    { body: formData },
  );

  if (error) {
    throw new Error(
      (await functionErrorMessage(error)) ||
        "Your verification could not be submitted. Please try again.",
    );
  }
  if (!data?.delivered) {
    throw new Error(
      data?.error || "Your verification could not be submitted. Please try again.",
    );
  }

  return data;
}
