import { updateSignedInPassword } from "@/auth/authService.js";
import { updateCurrentProfile } from "@/auth/profileService.js";
import { useAuth } from "@/auth/useAuth.js";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LockPasswordIcon,
  UserEdit01Icon,
  UserIdVerificationIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatStatus(value) {
  if (!value) return "Pending";
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const [changes, setChanges] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const form = {
    firstName: changes.firstName ?? profile?.first_name ?? "",
    lastName: changes.lastName ?? profile?.last_name ?? "",
    phoneNumber: changes.phoneNumber ?? profile?.phone_number ?? "",
  };

  const displayName =
    `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
    user?.email ||
    "Profile";
  const initials = useMemo(() => {
    const names = displayName.split(/\s+/).filter(Boolean);
    return `${names[0]?.[0] || "U"}${names[1]?.[0] || ""}`.toUpperCase();
  }, [displayName]);
  const isDirty =
    form.firstName.trim() !== (profile?.first_name || "").trim() ||
    form.lastName.trim() !== (profile?.last_name || "").trim() ||
    form.phoneNumber.trim() !== (profile?.phone_number || "").trim();

  const updateForm = (field, value) => {
    setChanges((current) => ({ ...current, [field]: value }));
  };

  const copyReferralCode = async () => {
    if (!profile.referral_code) return;
    await navigator.clipboard.writeText(profile.referral_code);
    setStatus("Referral code copied.");
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordStatus("");
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await updateSignedInPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Your password has been updated.");
    } catch (nextError) {
      setPasswordError(nextError.message || "Unable to update your password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setSaving(true);
    try {
      await updateCurrentProfile(form);
      await refreshProfile();
      setChanges({});
      setStatus("Your profile has been updated.");
    } catch (nextError) {
      setError(nextError.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-background-primary-default)_65%,transparent)] p-6">
        <p className="text-body-medium text-[var(--color-text-secondary)]">
          Unable to load your profile. Refresh the page or sign in again.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-title-1-medium text-[var(--color-text-primary)]">
          Profile
        </h1>
        <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
          Manage your personal information and account security.
        </p>
      </div>

      <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-background-primary-default)_65%,transparent)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            alt={displayName}
            color="blue"
            initials={initials}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title-2-medium text-[var(--color-text-primary)]">
                {displayName}
              </h2>
              <Badge color={user?.email_confirmed_at ? "primary" : "neutral"}>
                {user?.email_confirmed_at ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <p className="text-body-medium break-all text-[var(--color-text-secondary)]">
              {user?.email}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-background-primary-default)_65%,transparent)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="mt-1 text-[var(--color-accent-600)]"
            icon={UserEdit01Icon}
            size={22}
          />
          <div>
            <h2 className="text-title-2-medium text-[var(--color-text-primary)]">
              Personal information
            </h2>
            <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
              Keep your contact details current.
            </p>
          </div>
        </div>
        <form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={saveProfile}>
          <Input
            autoComplete="given-name"
            label="First name"
            onChange={(value) => updateForm("firstName", value)}
            required
            value={form.firstName}
          />
          <Input
            autoComplete="family-name"
            label="Last name"
            onChange={(value) => updateForm("lastName", value)}
            required
            value={form.lastName}
          />
          <Input
            hint="Your sign-in email is managed through Supabase Auth."
            isReadOnly
            label="Email address"
            type="email"
            value={user?.email || ""}
          />
          <Input
            autoComplete="tel"
            label="Phone number"
            onChange={(value) => updateForm("phoneNumber", value)}
            type="tel"
            value={form.phoneNumber}
          />
          <div className="sm:col-span-2">
            {status && (
              <p className="text-body-2-medium mb-3 text-[var(--color-state-success-text)]">
                {status}
              </p>
            )}
            {error && (
              <p className="text-body-2-medium mb-3 text-[var(--color-text-error-primary)]">
                {error}
              </p>
            )}
            <Button disabled={saving || !isDirty} type="submit">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-background-primary-default)_65%,transparent)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="mt-1 text-[var(--color-accent-600)]"
            icon={UserIdVerificationIcon}
            size={22}
          />
          <div>
            <h2 className="text-title-2-medium text-[var(--color-text-primary)]">
              Account details
            </h2>
            <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
              Review your membership and referral information.
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-body-2-medium text-[var(--color-text-secondary)]">
              Onboarding status
            </dt>
            <dd className="text-body-medium mt-1 text-[var(--color-text-primary)]">
              {formatStatus(profile.onboarding_status)}
            </dd>
          </div>
          <div>
            <dt className="text-body-2-medium text-[var(--color-text-secondary)]">
              Member since
            </dt>
            <dd className="text-body-medium mt-1 text-[var(--color-text-primary)]">
              {formatDate(profile.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-body-2-medium text-[var(--color-text-secondary)]">
              Your referral code
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-[var(--color-text-primary)]">
              <span className="account-number text-body-medium">
                {profile.referral_code || "Not assigned"}
              </span>
              {profile.referral_code ? (
                <Button onClick={copyReferralCode} size="small" variant="ghost">
                  Copy
                </Button>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-body-2-medium text-[var(--color-text-secondary)]">
              Referred by
            </dt>
            <dd className="text-body-medium mt-1 text-[var(--color-text-primary)]">
              {profile.referred_by_code || "Not applicable"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-background-primary-default)_65%,transparent)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="mt-1 text-[var(--color-accent-600)]"
            icon={LockPasswordIcon}
            size={22}
          />
          <div>
            <h2 className="text-title-2-medium text-[var(--color-text-primary)]">
              Security
            </h2>
            <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
              Update the password used to access your account.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-separator-border)] py-4">
          <div>
            <h3 className="text-body-medium text-[var(--color-text-primary)]">
              Password
            </h3>
            <p className="text-body-2-medium text-[var(--color-text-secondary)]">
              Last signed in {formatDate(user?.last_sign_in_at)}
            </p>
          </div>
          <Button
            onClick={() => setPasswordDialogOpen(true)}
            type="button"
            variant="secondary"
          >
            Change password
          </Button>
        </div>
      </section>
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="gap-6 sm:max-w-md sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Change password
            </DialogTitle>
            <DialogDescription>
              Choose a strong password you do not use elsewhere.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            id="change-password-form"
            onSubmit={changePassword}
          >
            <Input
              autoComplete="new-password"
              label="New password"
              onChange={setNewPassword}
              placeholder="Enter a new password"
              type="password"
              value={newPassword}
            />
            <Input
              autoComplete="new-password"
              label="Confirm new password"
              onChange={setConfirmPassword}
              placeholder="Confirm your new password"
              type="password"
              value={confirmPassword}
            />
            <FeedbackMessage>{passwordStatus}</FeedbackMessage>
            <FeedbackMessage tone="error">{passwordError}</FeedbackMessage>
          </form>
          <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <Button
              disabled={passwordSaving || !newPassword || !confirmPassword}
              form="change-password-form"
              type="submit"
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ProfilePage;
