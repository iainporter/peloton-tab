import { parseRate } from "@/lib/money";

// Frankfurter serves European Central Bank reference rates — free, no API key
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1";

async function fetchFrankfurterRate(day: string, from: string, to: string) {
  const response = await fetch(`${FRANKFURTER_URL}/${day}?from=${from}&to=${to}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    throw new Error(`Frankfurter responded ${response.status}`);
  }

  const data = (await response.json()) as {
    date: string;
    rates: Record<string, number>;
  };
  const rate = data.rates?.[to];
  if (typeof rate !== "number" || rate <= 0) {
    throw new Error(`No ${from} → ${to} rate in Frankfurter response`);
  }

  return { rate, date: data.date };
}

/**
 * Fetch the ECB reference rate (1 `from` = rate × `to`) for a date, or the
 * latest rate when `date` is null. Weekends and holidays return the previous
 * working day's rate — the returned `date` is the one the rate applies to.
 *
 * Frankfurter rounds to 5 decimal places, so rates below 1 (e.g. JPY → GBP
 * comes back as 0.00481) are calculated from the inverse rate to keep precision.
 */
export async function getExchangeRate(
  from: string,
  to: string,
  date: string | null,
): Promise<{ rate: string; date: string }> {
  const day = date ?? "latest";
  const direct = await fetchFrankfurterRate(day, from, to);
  const value =
    direct.rate >= 1
      ? direct.rate
      : 1 / (await fetchFrankfurterRate(day, to, from)).rate;

  const rate = parseRate(value.toFixed(8));
  if (!rate) throw new Error(`Unusable rate ${value} for ${from} → ${to}`);

  return { rate, date: direct.date };
}
