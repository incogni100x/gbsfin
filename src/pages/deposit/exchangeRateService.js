import { requireSupabase } from "@/lib/supabase/client.js";

export const exchangeRatesQueryKey = ["exchange-rates"];

function throwIfError(error) {
  if (error) throw error;
}

export async function getExchangeRates() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("exchange_rates")
    .select(
      "base_currency_code, quote_currency_code, rate, source, effective_at",
    )
    .eq("base_currency_code", "USD");

  throwIfError(error);

  return {
    baseCurrency: "USD",
    effectiveAt: data[0]?.effective_at ?? null,
    rates: Object.fromEntries(
      data.map((rate) => [rate.quote_currency_code, Number(rate.rate)]),
    ),
    sources: [...new Set(data.map((rate) => rate.source))],
  };
}

export function getCurrencyRate(exchangeRates, fromCode, toCode) {
  const fromRate = exchangeRates?.rates?.[fromCode];
  const toRate = exchangeRates?.rates?.[toCode];

  if (!fromRate || !toRate) return null;
  return toRate / fromRate;
}

export function convertCurrency(amount, exchangeRates, fromCode, toCode) {
  const rate = getCurrencyRate(exchangeRates, fromCode, toCode);
  return rate === null ? null : (Number.parseFloat(amount) || 0) * rate;
}

export function formatExchangeRate(exchangeRates, fromCode, toCode) {
  const rate = getCurrencyRate(exchangeRates, fromCode, toCode);

  if (rate === null) return "Rate unavailable";

  return `1 ${fromCode} = ${rate.toFixed(rate < 1 ? 4 : 2)} ${toCode}`;
}
