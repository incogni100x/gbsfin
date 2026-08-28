import {
  startPasswordRecovery,
  updateRecoveredPassword,
  verifyRecoveryCode,
  verifySecurityAnswer,
} from "@/auth/authService.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import AuthProgress from "@/components/ui/AuthProgress.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import SuccessState from "@/components/ui/SuccessState.jsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

const steps = [
  {
    description: "Enter the email address connected to your account.",
    title: "Forgot your password?",
  },
  {
    description: "Enter the six-digit code sent to your email address.",
    title: "Verify your email",
  },
  {
    description: "Answer your security question to verify your identity.",
    title: "Security check",
  },
  {
    description: "Choose a strong new password for your account.",
    title: "Create a new password",
  },
];
const stepLabels = steps.map((step) => step.title);

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState(null);
  const [status, setStatus] = useState("");
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    try {
      if (currentStep === 0) {
        await startPasswordRecovery(email);
        setCurrentStep(1);
        setStatus(
          "If an account exists for that email, a recovery code has been sent.",
        );
      } else if (currentStep === 1) {
        const nextQuestion = await verifyRecoveryCode(email, otp);
        setQuestion(nextQuestion);
        setCurrentStep(2);
      } else if (currentStep === 2) {
        await verifySecurityAnswer(question.question_id, answer);
        setCurrentStep(3);
      } else {
        if (password !== confirmPassword) {
          throw new Error("The passwords do not match.");
        }
        await updateRecoveredPassword(password);
        setComplete(true);
      }
    } catch (nextError) {
      setError(nextError.message || "Unable to complete password recovery.");
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return (
      <main className="grid min-h-svh place-items-center bg-[var(--color-background-full)] px-4 py-10">
        <SuccessState
          action={
            <Button onClick={() => navigate("/login", { replace: true })}>
              Sign in
            </Button>
          }
          description="Your password has been updated. You can now sign in with your new password."
          title="Password updated"
        />
      </main>
    );
  }

  const resendCode = async () => {
    setError("");
    setStatus("");
    setLoading(true);
    try {
      await startPasswordRecovery(email);
      setStatus("If the account exists, a new recovery code has been sent.");
    } catch (nextError) {
      setError(nextError.message || "Unable to resend the recovery code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-background-full)] px-4 py-10">
      <section className="w-full max-w-md px-2 py-6 sm:px-4 sm:py-8">
        <Link
          className="text-title-2-semibold flex items-center justify-center gap-2 text-[var(--color-text-primary)] no-underline"
          to="/"
        >
          <img alt="" className="size-9" src="/logo.svg" />
          Global Stripe Fin
        </Link>

        <div className="mt-8 text-center">
          <h1 className="text-title-1-medium text-[var(--color-text-primary)]">
            {steps[currentStep].title}
          </h1>
          <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="mt-6">
          <AuthProgress currentStep={currentStep} labels={stepLabels} />
        </div>

        <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
          {currentStep === 0 && (
            <Input
              autoComplete="email"
              label="Email address"
              onChange={setEmail}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          )}

          {currentStep === 1 && (
            <>
              <InputOtp
                aria-label="Password reset verification code"
                className="justify-center"
                groupEvery={3}
                onChange={setOtp}
                value={otp}
              />
              <Button
                className="justify-self-center !bg-transparent !text-[var(--color-accent-600)] hover:!bg-transparent hover:!text-[var(--color-accent-500)] active:!bg-transparent"
                disabled={loading}
                onClick={resendCode}
                size="small"
                type="button"
                variant="ghost"
              >
                Send a new code
              </Button>
            </>
          )}

          {currentStep === 2 && question && (
            <div className="grid gap-2">
              <span className="text-body-medium text-[var(--color-text-primary)]">
                {question.question}
              </span>
              <Input
                aria-label="Security question answer"
                onChange={setAnswer}
                placeholder="Enter your answer"
                required
                value={answer}
              />
            </div>
          )}

          {currentStep === 3 && (
            <>
              <Input
                autoComplete="new-password"
                hint="Use at least 8 characters."
                label="New password"
                onChange={setPassword}
                placeholder="Enter a new password"
                required
                type="password"
                value={password}
              />
              <Input
                autoComplete="new-password"
                label="Confirm new password"
                onChange={setConfirmPassword}
                placeholder="Confirm your new password"
                required
                type="password"
                value={confirmPassword}
              />
            </>
          )}

          <FeedbackMessage>{status}</FeedbackMessage>
          <FeedbackMessage tone="error">{error}</FeedbackMessage>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {currentStep > 0 && (
              <Button
                className="flex-1"
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
            )}
            <Button
              className="flex-1"
              disabled={
                loading ||
                (currentStep === 1 && otp.length !== 6) ||
                (currentStep === 2 && !answer.trim()) ||
                (currentStep === 3 &&
                  (password.length < 8 || !confirmPassword))
              }
              type="submit"
            >
              {loading
                ? "Please wait…"
                : currentStep === 0
                  ? "Send code"
                  : currentStep === 1
                    ? "Verify code"
                    : currentStep === 2
                      ? "Verify identity"
                      : "Update password"}
            </Button>
          </div>
        </form>

        <p className="text-body-medium mt-6 text-center text-[var(--color-text-secondary)]">
          Remember your password?{" "}
          <Link
            className="text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current hover:text-[var(--color-accent-700)]"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
