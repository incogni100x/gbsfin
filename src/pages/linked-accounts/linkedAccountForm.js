export function createEmptyLinkedAccount(transferScope = "domestic") {
  return {
    account_type: "personal",
    account_name: "",
    account_number: "",
    address: "",
    bank_name: "",
    confirm_account_number: "",
    routing_number: "",
    swift_code: "",
    transfer_scope: transferScope,
  };
}

const formText = (value) => String(value ?? "");
function normalizedSwift(value) {
  return formText(value).replace(/\s/g, "").toUpperCase();
}

export function createLinkedAccountFormValue(account) {
  const form = createEmptyLinkedAccount(account?.transfer_scope || "domestic");

  if (!account) return form;

  return {
    ...form,
    ...account,
    account_name: formText(account.account_name),
    account_number: formText(account.account_number),
    address: formText(account.address),
    bank_name: formText(account.bank_name),
    confirm_account_number: formText(account.account_number),
    routing_number: formText(account.routing_number),
    swift_code: formText(account.swift_code),
  };
}

export function linkedAccountNumbersMatch(account) {
  const accountNumber = formText(account.account_number).trim();
  const confirmedAccountNumber = formText(
    account.confirm_account_number,
  ).trim();

  return (
    Boolean(accountNumber) && accountNumber === confirmedAccountNumber
  );
}

export function isLinkedAccountComplete(account) {
  return !getLinkedAccountValidationMessage(account);
}

export function getLinkedAccountValidationMessage(account) {
  const accountName = formText(account.account_name).trim();
  const bankName = formText(account.bank_name).trim();
  const accountNumber = formText(account.account_number).trim();
  const confirmedAccountNumber = formText(
    account.confirm_account_number,
  ).trim();
  const address = formText(account.address).trim();

  if (accountName.length < 2) return "Enter the account name.";
  if (bankName.length < 2) return "Enter the bank name.";
  if (accountNumber.length < 4) return "Enter a valid account number.";
  if (!confirmedAccountNumber) return "Confirm the account number.";
  if (!linkedAccountNumbersMatch(account)) {
    return "The account numbers do not match.";
  }
  if (account.transfer_scope === "international") {
    if (!normalizedSwift(account.swift_code)) {
      return "Enter the international account's SWIFT/BIC code.";
    }
  } else if (!formText(account.routing_number).trim()) {
    return "Enter the domestic account's routing number.";
  }
  if (address.length < 5) return "Enter the account holder's address.";

  return "";
}

export function normalizeLinkedAccount(account) {
  return {
    account_name: formText(account.account_name).trim(),
    account_number: formText(account.account_number).trim(),
    account_type: account.account_type,
    address: formText(account.address).trim(),
    bank_name: formText(account.bank_name).trim(),
    routing_number:
      account.transfer_scope === "domestic"
        ? String(account.routing_number || "").trim()
        : null,
    swift_code:
      account.transfer_scope === "international"
        ? normalizedSwift(account.swift_code)
        : null,
    transfer_scope: account.transfer_scope,
  };
}
