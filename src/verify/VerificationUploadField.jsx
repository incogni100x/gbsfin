import { useRef, useState } from "react";
import {
  Camera01Icon,
  CheckmarkCircle02Icon,
  ImageUploadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/base/buttons/button.tsx";

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function UploadButtonIcon({ className }) {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className={className}
      icon={ImageUploadIcon}
      strokeWidth={1.8}
    />
  );
}

function CameraButtonIcon({ className }) {
  return (
    <HugeiconsIcon
      aria-hidden="true"
      className={className}
      icon={Camera01Icon}
      strokeWidth={1.8}
    />
  );
}

function validateFile(file) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Choose an image that is 4 MB or smaller.";
  }
  return "";
}

export default function VerificationUploadField({
  capture = "environment",
  description,
  file,
  label,
  onChange,
}) {
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const [error, setError] = useState("");

  function selectFile(event) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    const nextError = validateFile(selectedFile);
    setError(nextError);
    if (!nextError) onChange(selectedFile);
  }

  return (
    <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_70%,transparent)] bg-[var(--color-background-primary-default)] p-4 shadow-sm sm:p-5">
      <div className="flex min-h-12 items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full border bg-[var(--color-background-secondary-default)] ${
            file
              ? "border-[color-mix(in_srgb,var(--color-state-success-text)_35%,transparent)] text-[var(--color-state-success-text)]"
              : "border-[color-mix(in_srgb,var(--color-accent-500)_30%,transparent)] text-[var(--color-accent-400)]"
          }`}
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={file ? CheckmarkCircle02Icon : ImageUploadIcon}
            size={21}
            strokeWidth={1.8}
          />
        </span>
        <div className="min-w-0">
          <h2 className="text-headline-medium">{label}</h2>
          <p className="mt-1 text-body-2-medium text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
      </div>

      <button
        className="mt-4 grid h-36 w-full place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] px-4 text-center transition-[border-color,background-color,transform] duration-150 ease-out hover:border-[var(--color-accent-500)] hover:bg-[var(--color-background-secondary-hover)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)] motion-reduce:transition-none"
        onClick={() => uploadRef.current?.click()}
        type="button"
      >
        <div>
          <div>
            <HugeiconsIcon
              aria-hidden="true"
              className={
                file
                  ? "mx-auto text-[var(--color-state-success-text)]"
                  : "mx-auto text-[var(--color-text-tertiary)]"
              }
              icon={file ? CheckmarkCircle02Icon : ImageUploadIcon}
              size={28}
              strokeWidth={1.6}
            />
            <p className="mt-2 text-body-2-medium text-[var(--color-text-secondary)]">
              {file ? file.name : "Click to upload or take a photo"}
            </p>
          </div>
        </div>
      </button>

      {file ? (
        <p className="mt-2 truncate text-body-2-medium text-[var(--color-state-success-text)]">
          Selected: {file.name}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-2 text-body-2-medium text-[var(--color-text-error-primary)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <input
        ref={uploadRef}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={selectFile}
        tabIndex={-1}
        type="file"
      />
      <input
        ref={cameraRef}
        accept="image/*"
        capture={capture}
        className="sr-only"
        onChange={selectFile}
        tabIndex={-1}
        type="file"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          className="w-full"
          leadingIcon={UploadButtonIcon}
          onClick={() => uploadRef.current?.click()}
          size="small"
          variant="secondary"
        >
          Upload
        </Button>
        <Button
          className="w-full"
          leadingIcon={CameraButtonIcon}
          onClick={() => cameraRef.current?.click()}
          size="small"
          variant="secondary"
        >
          Take photo
        </Button>
      </div>
    </section>
  );
}
