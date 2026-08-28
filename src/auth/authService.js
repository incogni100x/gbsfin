import { requireSupabase } from "@/lib/supabase/client.js";

function throwIfError(error) {
  if (error) throw error;
}

export async function signUpWithPassword(details) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: details.email,
    password: details.password,
    options: {
      data: {
        first_name: details.firstName,
        last_name: details.lastName,
        phone_number: details.phoneNumber,
      },
    },
  });

  throwIfError(error);
  return data;
}

export async function verifySignupCode(email, token) {
  const client = requireSupabase();
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  throwIfError(error);
  return data;
}

export async function resendSignupCode(email) {
  const client = requireSupabase();
  const { error } = await client.auth.resend({ email, type: "signup" });
  throwIfError(error);
}

export async function loadRegistrationOptions() {
  const client = requireSupabase();
  const [accountTypesResult, questionsResult] = await Promise.all([
    client
      .from("account_types")
      .select("id, name, description")
      .eq("is_active", true)
      .order("id"),
    client
      .from("security_questions")
      .select("id, question")
      .eq("is_active", true)
      .order("question"),
  ]);

  throwIfError(accountTypesResult.error);
  throwIfError(questionsResult.error);

  return {
    accountTypes: accountTypesResult.data,
    securityQuestions: questionsResult.data,
  };
}

export async function validateReferralCode(code) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return true;

  const client = requireSupabase();
  const { data, error } = await client.rpc("validate_referral_code", {
    p_code: normalizedCode,
  });
  throwIfError(error);

  if (!data) {
    throw new Error("The referral code is invalid or no longer available.");
  }

  return true;
}

function fileExtension(file) {
  return file.name.split(".").pop()?.toLowerCase() || "bin";
}

async function uploadIdentityDocument(client, userId, kind, file) {
  const path = `${userId}/${kind}.${fileExtension(file)}`;
  const { error } = await client.storage
    .from("identity-documents")
    .upload(path, file, { contentType: file.type, upsert: true });

  throwIfError(error);
  return path;
}

export async function completeRegistration({
  accountTypeIds,
  details,
  documents,
  securityAnswers,
}) {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your registration session has expired.");

  const [idDocumentPath, proofOfResidencePath] = await Promise.all([
    uploadIdentityDocument(client, user.id, "government-id", documents.id),
    uploadIdentityDocument(
      client,
      user.id,
      "proof-of-residence",
      documents.residence,
    ),
  ]);

  const { error: profileError } = await client
    .from("profiles")
    .update({
      first_name: details.firstName,
      id_document_path: idDocumentPath,
      last_name: details.lastName,
      phone_number: details.phoneNumber,
      proof_of_residence_path: proofOfResidencePath,
    })
    .eq("id", user.id);
  throwIfError(profileError);

  const { error: answersError } = await client.rpc("set_security_answers", {
    p_answers: securityAnswers.map((item) => ({
      answer: item.answer,
      question_id: item.questionId,
    })),
  });
  throwIfError(answersError);

  const { error: referralError } = await client.rpc("apply_referral_code", {
    p_code: details.referralCode.trim().toUpperCase(),
  });
  throwIfError(referralError);

  const { data: accounts, error: accountsError } = await client.rpc(
    "open_accounts",
    {
      p_account_type_ids: accountTypeIds.map(Number),
      p_currency_code: "USD",
    },
  );
  throwIfError(accountsError);

  const { error: completionError } = await client.rpc("submit_onboarding");
  throwIfError(completionError);

  return accounts;
}

export async function signInAndSendCode(email, password) {
  const client = requireSupabase();
  const { error: passwordError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  throwIfError(passwordError);

  const { error: otpError } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  throwIfError(otpError);
}

export async function resendSignInCode(email) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  throwIfError(error);
}

export async function verifySignInCode(email, token) {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  throwIfError(error);
  return getSecurityQuestion();
}

export async function getSecurityQuestion() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_security_question");
  throwIfError(error);

  const question = data?.[0];
  if (!question) {
    throw new Error("No security questions are configured for this account.");
  }

  return question;
}

export async function verifySecurityAnswer(questionId, answer) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("verify_security_answer", {
    p_answer: answer,
    p_question_id: questionId,
  });
  throwIfError(error);

  if (!data) throw new Error("The security answer is incorrect.");
  return true;
}

export async function startPasswordRecovery(email) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email);
  throwIfError(error);
}

export async function verifyRecoveryCode(email, token) {
  const client = requireSupabase();
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  throwIfError(error);
  return getSecurityQuestion();
}

export async function updateRecoveredPassword(password) {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });
  throwIfError(error);
  await client.auth.signOut({ scope: "global" });
}

export async function updateSignedInPassword(password) {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });
  throwIfError(error);
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  throwIfError(error);
}
