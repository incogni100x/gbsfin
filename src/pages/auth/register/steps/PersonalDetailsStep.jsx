import { Input } from "@/components/base/input/input";

function PersonalDetailsStep({ details, fieldErrors, onChange }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Input
        autoComplete="given-name"
        hint={fieldErrors.firstName}
        isInvalid={Boolean(fieldErrors.firstName)}
        label="First Name"
        onChange={(value) => onChange("firstName", value)}
        placeholder="Enter your first name"
        required
        value={details.firstName}
      />
      <Input
        autoComplete="family-name"
        hint={fieldErrors.lastName}
        isInvalid={Boolean(fieldErrors.lastName)}
        label="Last Name"
        onChange={(value) => onChange("lastName", value)}
        placeholder="Enter your last name"
        required
        value={details.lastName}
      />
      <Input
        autoComplete="email"
        hint={fieldErrors.email}
        isInvalid={Boolean(fieldErrors.email)}
        label="Email Address"
        onChange={(value) => onChange("email", value)}
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
        onChange={(value) => onChange("phoneNumber", value)}
        placeholder="Enter your phone number"
        required
        type="tel"
        value={details.phoneNumber}
      />
      <Input
        autoComplete="new-password"
        hint="At least 8 characters."
        label="Password"
        onChange={(value) => onChange("password", value)}
        placeholder="Create a password"
        required
        type="password"
        value={details.password}
      />
      <Input
        autoComplete="new-password"
        label="Confirm Password"
        onChange={(value) => onChange("confirmPassword", value)}
        placeholder="Confirm your password"
        required
        type="password"
        value={details.confirmPassword}
      />
    </div>
  );
}

export default PersonalDetailsStep;
