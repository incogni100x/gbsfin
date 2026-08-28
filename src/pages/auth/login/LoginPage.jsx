import {
  resendSignInCode,
  signInAndSendCode,
  verifySecurityAnswer,
  verifySignInCode,
} from "@/auth/authService.js";
import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import AuthProgress from "@/components/ui/AuthProgress.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

const steps = [
  {
    description: "Sign in to access your accounts.",
    title: "Welcome back",
  },
  {
    description: "Enter the six-digit code sent to your email address.",
    title: "Verify your identity",
  },
  {
    description: "Answer your security question to finish signing in.",
    title: "Security check",
  },
];
const stepLabels = steps.map((step) => step.title);

function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshVerification } = useAuth();
  const [answer, setAnswer] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState(null);
  const [status, setStatus] = useState("");
  const routeMessage = location.state?.message;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    try {
      if (currentStep === 0) {
        await signInAndSendCode(email, password);
        setCurrentStep(1);
        setStatus("A sign-in code has been sent to your email.");
      } else if (currentStep === 1) {
        const nextQuestion = await verifySignInCode(email, otp);
        setQuestion(nextQuestion);
        setCurrentStep(2);
      } else {
        await verifySecurityAnswer(question.question_id, answer);
        await refreshVerification();
        const destination = location.state?.from?.pathname ?? "/dashboard";
        navigate(destination, { replace: true });
      }
    } catch (nextError) {
      setError(nextError.message || "Unable to complete sign in.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setStatus("");
    setLoading(true);
    try {
      await resendSignInCode(email);
      setStatus("A new sign-in code has been sent.");
    } catch (nextError) {
      setError(nextError.message || "Unable to resend the code.");
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
            <>
              <Input
                autoComplete="email"
                label="Email address"
                onChange={setEmail}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <Input
                autoComplete="current-password"
                label="Password"
                onChange={setPassword}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
              <div className="flex justify-end">
                <Link
                  className="text-body-medium text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current hover:text-[var(--color-accent-700)]"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <InputOtp
                aria-label="Login verification code"
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

          <FeedbackMessage>{status || routeMessage}</FeedbackMessage>
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
                (currentStep === 2 && !answer.trim())
              }
              type="submit"
            >
              {loading
                ? "Please wait…"
                : currentStep === 0
                  ? "Continue"
                  : currentStep === 1
                    ? "Verify code"
                    : "Verify and sign in"}
            </Button>
          </div>
        </form>

        <p className="text-body-medium mt-6 text-center text-[var(--color-text-secondary)]">
          Don&apos;t have an account?{" "}
          <Link
            className="text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current hover:text-[var(--color-accent-700)]"
            to="/register"
          >
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
