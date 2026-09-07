import {
  completeRegistration,
  loadRegistrationOptions,
  resendSignupCode,
  signUpWithPassword,
  validateReferralCode,
  verifySignupCode,
} from "@/auth/authService.js";
import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import AuthProgress from "@/components/ui/AuthProgress.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import SuccessState from "@/components/ui/SuccessState.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AccountTypesStep from "./steps/AccountTypesStep.jsx";
import DocumentsStep from "./steps/DocumentsStep.jsx";
import PersonalDetailsStep from "./steps/PersonalDetailsStep.jsx";
import ReferralStep from "./steps/ReferralStep.jsx";
import SecurityQuestionsStep from "./steps/SecurityQuestionsStep.jsx";
import VerifyEmailStep from "./steps/VerifyEmailStep.jsx";

const steps = [
  "Personal details",
  "Verify email",
  "Referral",
  "Account types",
  "Security questions",
  "Documents",
];

const emptyDetails = {
  confirmPassword: "",
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  phoneNumber: "",
  referralCode: "",
};

const emptyAnswers = Array.from({ length: 3 }, () => ({
  answer: "",
  questionId: "",
}));

const emptyDocuments = {
  id: null,
  residence: null,
  selfie: null,
};

function RegisterPage() {
  const navigate = useNavigate();
  const { refreshVerification } = useAuth();
  const [accountTypeIds, setAccountTypeIds] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [complete, setComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [details, setDetails] = useState(emptyDetails);
  const [documents, setDocuments] = useState(emptyDocuments);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [securityAnswers, setSecurityAnswers] = useState(emptyAnswers);
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [status, setStatus] = useState("");

  const updateDetails = (field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  };

  const updateDocument = (field, file) => {
    setDocuments((current) => ({ ...current, [field]: file }));
  };

  const updateSecurityAnswer = (index, field, value) => {
    setSecurityAnswers((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateAccountSelection = (accountTypeId, isSelected) => {
    setError("");

    if (isSelected && accountTypeIds.length >= 3) {
      setError("You can choose exactly three account types.");
      return;
    }

    setAccountTypeIds((current) =>
      isSelected
        ? [...current, accountTypeId]
        : current.filter((id) => id !== accountTypeId),
    );
  };

  const hasThreeSecurityAnswers =
    securityAnswers.every(
      (item) => item.questionId && item.answer.trim().length >= 2,
    ) && new Set(securityAnswers.map((item) => item.questionId)).size === 3;

  const validateStep = () => {
    if (currentStep === 0) {
      const nextFieldErrors = {};
      if (!details.firstName.trim())
        nextFieldErrors.firstName = "Enter your first name.";
      if (!details.lastName.trim())
        nextFieldErrors.lastName = "Enter your last name.";
      if (!details.email.trim())
        nextFieldErrors.email = "Enter your email address.";
      else if (!/^\S+@\S+\.\S+$/.test(details.email.trim()))
        nextFieldErrors.email = "Enter a valid email address.";
      if (!details.phoneNumber.trim())
        nextFieldErrors.phoneNumber = "Enter your phone number.";

      setFieldErrors(nextFieldErrors);
      if (Object.keys(nextFieldErrors).length) {
        const validationError = new Error("Missing required details");
        validationError.name = "FieldValidationError";
        throw validationError;
      }
      if (details.password !== details.confirmPassword) {
        throw new Error("The passwords do not match.");
      }
      if (details.password.length < 8) {
        throw new Error("Your password must be at least 8 characters.");
      }
    }

    if (currentStep === 3 && accountTypeIds.length !== 3) {
      throw new Error("Choose exactly three account types.");
    }

    if (currentStep === 4 && !hasThreeSecurityAnswers) {
      throw new Error(
        "Choose three different questions and provide every answer.",
      );
    }

    if (
      currentStep === 5 &&
      (!documents.id || !documents.residence || !documents.selfie)
    ) {
      throw new Error("Upload your ID, proof of address, and a selfie.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    try {
      validateStep();

      if (currentStep === 0) {
        await signUpWithPassword(details);
        setCurrentStep(1);
        setStatus("A confirmation code has been sent to your email.");
      } else if (currentStep === 1) {
        await verifySignupCode(details.email, otp);
        const options = await loadRegistrationOptions();
        setAccountTypes(options.accountTypes);
        setSecurityQuestions(options.securityQuestions);
        setCurrentStep(2);
      } else if (currentStep === 2) {
        await validateReferralCode(details.referralCode);
        updateDetails(
          "referralCode",
          details.referralCode.trim().toUpperCase(),
        );
        setCurrentStep(3);
      } else if (currentStep < steps.length - 1) {
        setCurrentStep((step) => step + 1);
      } else {
        await completeRegistration({
          accountTypeIds,
          details,
          documents,
          securityAnswers,
        });
        await refreshVerification();
        setComplete(true);
      }
    } catch (nextError) {
      if (nextError.name !== "FieldValidationError") {
        setError(nextError.message || "Unable to complete registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setStatus("");
    setLoading(true);

    try {
      await resendSignupCode(details.email);
      setStatus("A new confirmation code has been sent.");
    } catch (nextError) {
      setError(nextError.message || "Unable to resend the code.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError("");
    setCurrentStep((step) => step - 1);
  };

  if (complete) {
    return (
      <main className="grid min-h-svh place-items-center bg-[var(--color-background-full)] px-4 py-10">
        <SuccessState
          action={
            <Button onClick={() => navigate("/dashboard", { replace: true })}>
              Go to dashboard
            </Button>
          }
          description="Your accounts and security settings are ready. Welcome to Global Stripe Fin."
          title="Account created"
        />
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[var(--color-background-full)] px-4 py-8 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          className="text-title-2-semibold flex items-center justify-center gap-2 text-[var(--color-text-primary)] no-underline"
          to="/"
        >
          <img alt="" className="size-9" src="/logo.svg" />
          Global Stripe Fin
        </Link>

        <div className="mt-8">
          <AuthProgress currentStep={currentStep} labels={steps} />
        </div>

        <section className="mt-8">
          <h1 className="text-title-1-medium text-[var(--color-text-primary)]">
            {steps[currentStep]}
          </h1>
          <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
            Create your Global Stripe Fin account.
          </p>

          <form className="mt-7" noValidate onSubmit={handleSubmit}>
            {currentStep === 0 && (
              <PersonalDetailsStep
                details={details}
                fieldErrors={fieldErrors}
                onChange={updateDetails}
              />
            )}
            {currentStep === 1 && (
              <VerifyEmailStep
                email={details.email}
                loading={loading}
                onOtpChange={setOtp}
                onResend={resendCode}
                otp={otp}
              />
            )}
            {currentStep === 2 && (
              <ReferralStep
                onChange={updateDetails}
                referralCode={details.referralCode}
              />
            )}
            {currentStep === 3 && (
              <AccountTypesStep
                accountTypeIds={accountTypeIds}
                accountTypes={accountTypes}
                onSelectionChange={updateAccountSelection}
              />
            )}
            {currentStep === 4 && (
              <SecurityQuestionsStep
                answers={securityAnswers}
                onChange={updateSecurityAnswer}
                questions={securityQuestions}
              />
            )}
            {currentStep === 5 && (
              <DocumentsStep documents={documents} onChange={updateDocument} />
            )}

            <div className="mt-5 grid gap-2">
              <FeedbackMessage>{status}</FeedbackMessage>
              <FeedbackMessage tone="error">{error}</FeedbackMessage>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {currentStep > 0 ? (
                <Button
                  disabled={loading}
                  onClick={goBack}
                  type="button"
                  variant="secondary"
                >
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button
                disabled={
                  loading ||
                  (currentStep === 1 && otp.length !== 6) ||
                  (currentStep === 3 && accountTypeIds.length !== 3) ||
                  (currentStep === 4 && !hasThreeSecurityAnswers)
                }
                type="submit"
              >
                {loading
                  ? "Please wait…"
                  : currentStep === steps.length - 1
                    ? "Create account"
                    : "Continue"}
              </Button>
            </div>
          </form>
        </section>

        <p className="text-body-medium mt-8 text-center text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link
            className="text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current hover:text-[var(--color-accent-700)]"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;
