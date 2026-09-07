export function formatBalance(balance, currency) {
  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
    minimumFractionDigits: currency === "NGN" ? 0 : 2,
    style: "currency",
  }).format(balance);
}

export function formatAccountLabel(name) {
  const normalizedName = name === "Offshire" ? "Offshore" : name;

  if (!normalizedName) return "Account";
  return /\baccount$/i.test(normalizedName)
    ? normalizedName
    : `${normalizedName} Account`;
}
