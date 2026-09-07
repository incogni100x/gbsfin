import { FileUpload } from "@/components/base/file-upload/file-upload";

function DocumentUpload({
  allowedExtensions,
  capture,
  description,
  file,
  onChange,
  title,
}) {
  return (
    <div>
      <h3 className="text-headline-medium">{title}</h3>
      <p className="text-body-2-medium mb-3 text-[var(--color-text-secondary)]">
        {description}
      </p>
      <FileUpload
        allowedExtensions={allowedExtensions}
        capture={capture}
        maxBytes={10 * 1024 * 1024}
        onUploadComplete={onChange}
      />
      {file && (
        <p className="text-body-2-medium mt-2 text-[var(--color-state-success-text)]">
          Selected: {file.name}
        </p>
      )}
    </div>
  );
}

function DocumentsStep({ documents, onChange }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <DocumentUpload
        allowedExtensions={["pdf", "jpg", "jpeg", "png"]}
        description="Upload a passport, driver’s licence, or national ID."
        file={documents.id}
        onChange={(file) => onChange("id", file)}
        title="Government-issued ID"
      />
      <DocumentUpload
        allowedExtensions={["pdf", "jpg", "jpeg", "png"]}
        description="Upload a recent utility bill or bank statement."
        file={documents.residence}
        onChange={(file) => onChange("residence", file)}
        title="Proof of address"
      />
      <DocumentUpload
        allowedExtensions={["jpg", "jpeg", "png"]}
        capture="user"
        description="Upload a clear selfie or take one with your device camera."
        file={documents.selfie}
        onChange={(file) => onChange("selfie", file)}
        title="Selfie verification"
      />
    </div>
  );
}

export default DocumentsStep;
