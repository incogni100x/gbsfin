import { requireSupabase } from "@/lib/supabase/client.js";

export async function sendContactMessage(message) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke("send-contact-message", {
    body: message,
  });

  if (error) {
    throw new Error("Your message could not be sent. Please try again.");
  }

  if (!data?.delivered) {
    throw new Error(data?.error || "Your message could not be sent. Please try again.");
  }

  return data;
}
