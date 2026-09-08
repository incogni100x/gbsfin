import { Checkbox } from "@/components/base/checkbox/checkbox";

function AccountTypesStep({
  accountTypeIds,
  accountTypes,
  onSelectionChange,
  requiredAccountTypeId,
}) {
  return (
    <div>
      <p className="text-body-medium mb-4 text-[var(--color-text-secondary)]">
        Checking is included. Choose two other accounts ({accountTypeIds.length}
        /3 selected).
      </p>
      <div
        aria-label="Choose exactly three account types"
        className="grid gap-3 sm:grid-cols-2"
        role="group"
      >
        {accountTypes.map((accountType) => {
          const accountTypeId = String(accountType.id);
          const isRequired = accountTypeId === requiredAccountTypeId;

          return (
            <Checkbox
              className="w-full items-start rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-4 data-[selected]:border-[var(--color-accent-500)] data-[selected]:bg-[var(--color-background-secondary-default)]"
              isSelected={accountTypeIds.includes(accountTypeId)}
              isReadOnly={isRequired}
              key={accountType.id}
              onChange={(isSelected) =>
                onSelectionChange(accountTypeId, isSelected)
              }
            >
              <span className="grid gap-1">
                <strong className="text-headline-medium">
                  {accountType.name}
                  {isRequired ? (
                    <span className="text-body-2-medium ml-2 text-[var(--color-accent-700)]">
                      Required
                    </span>
                  ) : null}
                </strong>
                <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                  {accountType.description}
                </span>
              </span>
            </Checkbox>
          );
        })}
      </div>
    </div>
  );
}

export default AccountTypesStep;
