import { Input } from "@/components/base/input/input";

function ReferralStep({ referralCode, onChange }) {
  return (
    <Input
      hint="Leave this blank if you do not have a referral code."
      label="Referral Code"
      onChange={(value) => onChange("referralCode", value)}
      placeholder="Enter referral code"
      value={referralCode}
    />
  );
}

export default ReferralStep;
