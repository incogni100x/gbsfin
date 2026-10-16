import { useEffect, useState } from "react";
import {
  CheckmarkCircle02Icon,
  SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/base/buttons/button.tsx";
import { Input } from "@/components/base/input/input.tsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import VerificationUploadField from "./VerificationUploadField.jsx";
import { submitVerification } from "./verificationService.js";

const emptyFiles = { selfie: null, idFront: null, idBack: null };

export default function VerificationApp() {
  const [ssn, setSsn] = useState("");
  const [emailOrReference, setEmailOrReference] = useState("");
  const [files, setFiles] = useState(emptyFiles);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    document.title = "Identity verification | Global Stripe Fin";
  }, []);

  function updateFile(key, file) {
    setFiles((current) => ({ ...current, [key]: file }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!files.selfie || !files.idFront || !files.idBack) {
      setError("Add your selfie and both sides of your ID card.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await submitVerification({
        emailOrReference,
        files,
        ssn,
        website: event.currentTarget.elements.website?.value || "",
      });
      setReference(data.reference);
      setSsn("");
      setEmailOrReference("");
      setFiles(emptyFiles);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your verification could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--color-background-full)] text-[var(--color-text-primary)]">
      <header className="border-b border-[color-mix(in_srgb,var(--color-separator-border)_55%,transparent)] bg-[var(--color-background-full)]">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center px-4 sm:px-6">
          <a
            aria-label="Global Stripe Fin home"
            className="inline-flex items-center gap-2.5 no-underline"
            href="https://globalstripefin.com"
          >
            <img alt="" className="size-8 object-contain" src="/logo.svg" />
            <span className="text-headline-medium text-[var(--color-text-primary)]">
              Global Stripe Fin
            </span>
          </a>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-14">
        {reference ? (
          <section className="mx-auto max-w-xl rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_70%,transparent)] bg-[var(--color-background-primary-default)] p-6 text-center shadow-lg sm:p-8">
            <span className="mx-auto grid size-12 place-items-center rounded-full border border-[color-mix(in_srgb,var(--color-state-success-text)_35%,transparent)] bg-[var(--color-background-secondary-default)] text-[var(--color-state-success-text)]">
              <HugeiconsIcon
                aria-hidden="true"
                icon={CheckmarkCircle02Icon}
                size={26}
                strokeWidth={1.8}
              />
            </span>
            <h1 className="mt-5 text-title-2-medium sm:text-title-1-medium">
              Verification submitted
            </h1>
            <p className="mt-3 text-body-medium text-[var(--color-text-secondary)]">
              Your documents were received and sent to our support team.
            </p>
            <div className="mt-6 border-y border-[var(--color-separator-border)] py-4">
              <p className="text-body-2-medium text-[var(--color-text-secondary)]">
                Submission reference
              </p>
              <p className="account-number mt-1 break-all text-headline-medium text-[var(--color-accent-400)]">
                {reference}
              </p>
            </div>
            <Button className="mt-6" onClick={() => setReference("")}>
              Submit another verification
            </Button>
          </section>
        ) : (
          <>
            <section className="mx-auto max-w-2xl text-center max-sm:text-left">
              <span className="grid size-11 place-items-center rounded-full border border-[color-mix(in_srgb,var(--color-accent-500)_35%,transparent)] bg-[var(--color-background-secondary-default)] text-[var(--color-accent-400)] sm:mx-auto">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={SecurityCheckIcon}
                  size={23}
                  strokeWidth={1.8}
                />
              </span>
              <p className="mt-4 text-body-medium text-[var(--color-accent-400)]">
                Secure document submission
              </p>
              <h1 className="mt-2 text-display-4-medium sm:text-display-3-medium">
                Verify your identity
              </h1>
              <p className="mt-3 max-w-xl text-body-regular text-[var(--color-text-secondary)] sm:mx-auto sm:mt-4 sm:text-headline-regular">
                Enter your details and provide clear images of yourself and both
                sides of your ID card.
              </p>
            </section>

            <form
              className="mt-8 grid gap-5 sm:mt-10 sm:gap-6"
              onSubmit={handleSubmit}
            >
              <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_70%,transparent)] bg-[var(--color-background-primary-default)] p-5 shadow-sm sm:p-6">
                <div>
                  <h2 className="text-title-3-medium">Verification details</h2>
                  <p className="mt-1 text-body-2-medium text-[var(--color-text-secondary)]">
                    All fields are required. Use test information only in this
                    environment.
                  </p>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Input
                    autoComplete="off"
                    inputMode="numeric"
                    isRequired
                    label="SSN"
                    name="ssn"
                    onChange={setSsn}
                    placeholder="000-00-0000"
                    value={ssn}
                  />
                  <Input
                    autoComplete="email"
                    isRequired
                    label="Email address / reference number"
                    name="emailOrReference"
                    onChange={setEmailOrReference}
                    placeholder="you@example.com or reference"
                    value={emailOrReference}
                  />
                </div>
                <div aria-hidden="true" className="absolute -left-[9999px]">
                  <label htmlFor="verification-website">Website</label>
                  <input
                    autoComplete="off"
                    id="verification-website"
                    name="website"
                    tabIndex={-1}
                    type="text"
                  />
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-3">
                <VerificationUploadField
                  capture="user"
                  description="Take a clear selfie or upload a photo of yourself."
                  file={files.selfie}
                  label="Selfie photo"
                  onChange={(file) => updateFile("selfie", file)}
                />
                <VerificationUploadField
                  description="Upload or take a photo of the front of your ID card."
                  file={files.idFront}
                  label="ID card front"
                  onChange={(file) => updateFile("idFront", file)}
                />
                <VerificationUploadField
                  description="Upload or take a photo of the back of your ID card."
                  file={files.idBack}
                  label="ID card back"
                  onChange={(file) => updateFile("idBack", file)}
                />
              </div>

              <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_70%,transparent)] bg-[var(--color-background-primary-default)] p-5 shadow-sm sm:p-6">
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-body-2-medium text-[var(--color-text-secondary)]">
                    By submitting, you confirm that the information and images
                    provided belong to you and may be reviewed by Global Stripe
                    Fin.
                  </p>
                  <Button
                    className="w-full shrink-0 sm:w-auto"
                    disabled={submitting}
                    type="submit"
                  >
                    {submitting ? "Submitting…" : "Submit verification"}
                  </Button>
                </div>
              </section>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
