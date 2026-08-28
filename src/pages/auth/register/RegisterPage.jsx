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
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { Select, SelectItem } from "@/components/base/select/select";
import AuthProgress from "@/components/ui/AuthProgress.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import SuccessState from "@/components/ui/SuccessState.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

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

function RegisterPage() {
  const navigate = useNavigate();
  const { refreshVerification } = useAuth();
  const [accountTypeIds, setAccountTypeIds] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [details, setDetails] = useState(emptyDetails);
  const [documents, setDocuments] = useState({ id: null, residence: null });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [securityAnswers, setSecurityAnswers] = useState(emptyAnswers);
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [status, setStatus] = useState("");
  const [complete, setComplete] = useState(false);

  const updateDetails = (field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
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
    setAccountTypeIds((current) => {
      if (!isSelected) {
        return current.filter((id) => id !== accountTypeId);
      }

      if (current.length >= 3) {
        setError("You can choose exactly three account types.");
        return current;
      }

      return [...current, accountTypeId];
    });
  };

  const hasThreeSecurityAnswers =
    securityAnswers.every(
      (item) => item.questionId && item.answer.trim().length >= 2,
    ) &&
    new Set(securityAnswers.map((item) => item.questionId)).size === 3;

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

    if (currentStep === 4) {
      const questionIds = securityAnswers.map((item) => item.questionId);
      if (
        questionIds.some((questionId) => !questionId) ||
        new Set(questionIds).size !== 3 ||
        securityAnswers.some((item) => item.answer.trim().length < 2)
      ) {
        throw new Error(
          "Choose three different questions and provide every answer.",
        );
      }
    }

    if (currentStep === 5 && (!documents.id || !documents.residence)) {
      throw new Error("Upload both required identity documents.");
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
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  autoComplete="given-name"
                  hint={fieldErrors.firstName}
                  isInvalid={Boolean(fieldErrors.firstName)}
                  label="First Name"
                  onChange={(value) => updateDetails("firstName", value)}
                  placeholder="Enter your first name"
                  required
                  value={details.firstName}
                />
                <Input
                  autoComplete="family-name"
                  hint={fieldErrors.lastName}
                  isInvalid={Boolean(fieldErrors.lastName)}
                  label="Last Name"
                  onChange={(value) => updateDetails("lastName", value)}
                  placeholder="Enter your last name"
                  required
                  value={details.lastName}
                />
                <Input
                  autoComplete="email"
                  hint={fieldErrors.email}
                  isInvalid={Boolean(fieldErrors.email)}
                  label="Email Address"
                  onChange={(value) => updateDetails("email", value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={details.email}
                />
                <Input
                  autoComplete="tel"
                  hint={fieldErrors.phoneNumber}
                  isInvalid={Boolean(fieldErrors.phoneNumber)}
                  label="Phone Number"
                  onChange={(value) => updateDetails("phoneNumber", value)}
                  placeholder="Enter your phone number"
                  required
                  type="tel"
                  value={details.phoneNumber}
                />
                <Input
                  autoComplete="new-password"
                  hint="At least 10 characters with uppercase, lowercase, and numbers."
                  label="Password"
                  onChange={(value) => updateDetails("password", value)}
                  placeholder="Create a password"
                  required
                  type="password"
                  value={details.password}
                />
                <Input
                  autoComplete="new-password"
                  label="Confirm Password"
                  onChange={(value) => updateDetails("confirmPassword", value)}
                  placeholder="Confirm your password"
                  required
                  type="password"
                  value={details.confirmPassword}
                />
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <p className="text-body-medium text-[var(--color-text-secondary)]">
                  Enter the six-digit code sent to {details.email}.
                </p>
                <InputOtp
                  aria-label="Email verification code"
                  className="mt-5 flex-wrap"
                  groupEvery={3}
                  onChange={setOtp}
                  value={otp}
                />
                <Button
                  className="mt-5"
                  disabled={loading}
                  onClick={resendCode}
                  size="small"
                  type="button"
                  variant="ghost"
                >
                  Send a new code
                </Button>
              </div>
            )}

            {currentStep === 2 && (
              <Input
                hint="Leave this blank if you do not have a referral code."
                label="Referral Code"
                onChange={(value) => updateDetails("referralCode", value)}
                placeholder="Enter referral code"
                value={details.referralCode}
              />
            )}

            {currentStep === 3 && (
              <div>
                <p className="text-body-medium mb-4 text-[var(--color-text-secondary)]">
                  Choose exactly three accounts ({accountTypeIds.length}/3
                  selected).
                </p>
                <div
                  aria-label="Choose exactly three account types"
                  className="grid gap-3 sm:grid-cols-2"
                  role="group"
                >
                  {accountTypes.map((accountType) => (
                    <Checkbox
                      className="w-full items-start rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-4 data-[selected]:border-[var(--color-accent-500)] data-[selected]:bg-[var(--color-background-secondary-default)]"
                      isSelected={accountTypeIds.includes(
                        String(accountType.id),
                      )}
                      key={accountType.id}
                      onChange={(isSelected) =>
                        updateAccountSelection(
                          String(accountType.id),
                          isSelected,
                        )
                      }
                    >
                      <span className="grid gap-1">
                        <strong className="text-headline-medium">
                          {accountType.name}
                        </strong>
                        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                          {accountType.description}
                        </span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="grid gap-5">
                {securityAnswers.map((selectedAnswer, index) => (
                  <div className="grid gap-2" key={index}>
                    <span className="text-body-medium text-[var(--color-text-primary)]">
                      Security question {index + 1}
                    </span>
                    <Select
                      aria-label={`Security question ${index + 1}`}
                      onSelectionChange={(key) =>
                        updateSecurityAnswer(
                          index,
                          "questionId",
                          String(key),
                        )
                      }
                      selectedKey={selectedAnswer.questionId || undefined}
                    >
                      {securityQuestions.map((question) => (
                        <SelectItem
                          id={question.id}
                          isDisabled={
                            question.id !== selectedAnswer.questionId &&
                            securityAnswers.some(
                              (item) => item.questionId === question.id,
                            )
                          }
                          key={question.id}
                        >
                          {question.question}
                        </SelectItem>
                      ))}
                    </Select>
                    <Input
                      aria-label={`Answer to security question ${index + 1}`}
                      onChange={(value) =>
                        updateSecurityAnswer(index, "answer", value)
                      }
                      placeholder="Enter your answer"
                      required
                      value={selectedAnswer.answer}
                    />
                  </div>
                ))}
              </div>
            )}

            {currentStep === 5 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-headline-medium">
                    Government-issued ID
                  </h3>
                  <p className="text-body-2-medium mb-3 text-[var(--color-text-secondary)]">
                    Upload a passport, driver&apos;s licence, or national ID.
                  </p>
                  <FileUpload
                    allowedExtensions={["pdf", "jpg", "jpeg", "png"]}
                    maxBytes={10 * 1024 * 1024}
                    onUploadComplete={(file) =>
                      setDocuments((current) => ({ ...current, id: file }))
                    }
                  />
                  {documents.id && (
                    <p className="text-body-2-medium mt-2 text-[var(--color-state-success-text)]">
                      Selected: {documents.id.name}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-headline-medium">Proof of address</h3>
                  <p className="text-body-2-medium mb-3 text-[var(--color-text-secondary)]">
                    Upload a recent utility bill or bank statement.
                  </p>
                  <FileUpload
                    allowedExtensions={["pdf", "jpg", "jpeg", "png"]}
                    maxBytes={10 * 1024 * 1024}
                    onUploadComplete={(file) =>
                      setDocuments((current) => ({
                        ...current,
                        residence: file,
                      }))
                    }
                  />
                  {documents.residence && (
                    <p className="text-body-2-medium mt-2 text-[var(--color-state-success-text)]">
                      Selected: {documents.residence.name}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-2">
              <FeedbackMessage>{status}</FeedbackMessage>
              <FeedbackMessage tone="error">{error}</FeedbackMessage>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {currentStep > 0 ? (
                <Button
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setCurrentStep((step) => step - 1);
                  }}
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
