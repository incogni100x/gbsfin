import { Button } from "@/components/base/buttons/button";
import { InputOtp } from "@/components/base/input-otp/input-otp";

function VerifyEmailStep({ email, loading, onOtpChange, onResend, otp }) {
  return (
    <div>
      <p className="text-body-medium text-[var(--color-text-secondary)]">
        Enter the six-digit code sent to {email}.
      </p>
      <InputOtp
        aria-label="Email verification code"
        className="mt-5 flex-wrap"
        groupEvery={3}
        onChange={onOtpChange}
        value={otp}
      />
      <Button
        className="mt-5 !bg-transparent !text-[var(--color-accent-600)] hover:!bg-transparent hover:!text-[var(--color-accent-500)] active:!bg-transparent"
        disabled={loading}
        onClick={onResend}
        size="small"
        type="button"
        variant="ghost"
      >
        Send a new code
      </Button>
    </div>
  );
}

export default VerifyEmailStep;
