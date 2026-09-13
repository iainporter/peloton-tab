// Supported currencies and the number of decimal places in their minor unit (ISO 4217)
export const CURRENCIES = {
  GBP: { name: "British Pound", decimals: 2 },
  EUR: { name: "Euro", decimals: 2 },
  USD: { name: "US Dollar", decimals: 2 },
  CHF: { name: "Swiss Franc", decimals: 2 },
  CAD: { name: "Canadian Dollar", decimals: 2 },
  AUD: { name: "Australian Dollar", decimals: 2 },
  NZD: { name: "New Zealand Dollar", decimals: 2 },
  SEK: { name: "Swedish Krona", decimals: 2 },
  NOK: { name: "Norwegian Krone", decimals: 2 },
  DKK: { name: "Danish Krone", decimals: 2 },
  ZAR: { name: "South African Rand", decimals: 2 },
  JPY: { name: "Japanese Yen", decimals: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

// Largest value that fits in a Postgres integer column
export const MAX_MINOR_UNITS = 2_147_483_647;

// Exchange rates are stored as numeric(18, 8): 1 unit of a currency = rate × base currency
const RATE_DECIMALS = 8;
const RATE_SCALE = BigInt(10 ** RATE_DECIMALS);
const MAX_RATE_SCALED = BigInt(10 ** 10) * RATE_SCALE; // 10 integer digits

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function currencyDecimals(currency: string): number {
  return isCurrencyCode(currency) ? CURRENCIES[currency].decimals : 2;
}

/**
 * Parse a user-entered decimal string ("12.5") into integer minor units (1250).
 * Parses digits directly to avoid floating point rounding.
 * Returns null for anything that isn't a plain non-negative amount with no more
 * decimal places than the currency allows.
 */
export function toMinor(input: string, currency: string): number | null {
  const match = input.trim().match(/^(\d*)(?:\.(\d*))?$/);
  if (!match) return null;

  const [, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;

  const decimals = currencyDecimals(currency);
  if (fraction.length > decimals) return null;

  const minor =
    Number(whole || "0") * 10 ** decimals +
    Number(fraction.padEnd(decimals, "0") || "0");

  return minor <= MAX_MINOR_UNITS ? minor : null;
}

/**
 * Convert minor units back to a plain decimal string for form inputs (1250 → "12.50").
 */
export function fromMinor(minor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (minor / 10 ** decimals).toFixed(decimals);
}

function formatter(currency: string) {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format minor units for display (1250, "EUR" → "€12.50").
 */
export function formatMoney(minor: number, currency: string): string {
  return formatter(currency).format(minor / 10 ** currencyDecimals(currency));
}

/**
 * Parse a decimal rate string into an integer scaled by 10^8, or null if it
 * isn't a positive number with at most 8 decimal places.
 */
function scaleRate(input: string): bigint | null {
  const match = input.trim().match(/^(\d*)(?:\.(\d*))?$/);
  if (!match) return null;

  const [, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  if (fraction.length > RATE_DECIMALS) return null;

  const scaled =
    BigInt(whole || "0") * RATE_SCALE +
    BigInt(fraction.padEnd(RATE_DECIMALS, "0"));

  return scaled > BigInt(0) && scaled < MAX_RATE_SCALED ? scaled : null;
}

function formatScaledRate(scaled: bigint): string {
  const whole = scaled / RATE_SCALE;
  const fraction = (scaled % RATE_SCALE)
    .toString()
    .padStart(RATE_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

// Integer division rounding half up (inputs are non-negative)
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
}

/**
 * Parse a user-entered exchange rate into a normalised string ("0.8600" → "0.86").
 * Returns null unless it's a positive number with at most 8 decimal places.
 */
export function parseRate(input: string): string | null {
  const scaled = scaleRate(input);
  return scaled === null ? null : formatScaledRate(scaled);
}

/**
 * Convert minor units of `currency` into minor units of `baseCurrency` using
 * exact integer maths, rounding half up.
 */
export function convertToBase(
  amount: number,
  currency: string,
  rate: string,
  baseCurrency: string,
): number {
  const scaled = scaleRate(rate);
  if (scaled === null) throw new Error(`Invalid exchange rate: ${rate}`);

  return Number(
    divideRounded(
      BigInt(amount) * scaled * BigInt(10 ** currencyDecimals(baseCurrency)),
      RATE_SCALE * BigInt(10 ** currencyDecimals(currency)),
    ),
  );
}

/**
 * Work out the rate implied by an amount and what it cost in the base currency
 * (e.g. €42.00 charged as £36.90). Returns null if no storable rate results.
 */
export function deriveRate(
  amount: number,
  currency: string,
  baseAmount: number,
  baseCurrency: string,
): string | null {
  if (amount <= 0 || baseAmount <= 0) return null;

  const scaled = divideRounded(
    BigInt(baseAmount) * RATE_SCALE * BigInt(10 ** currencyDecimals(currency)),
    BigInt(amount) * BigInt(10 ** currencyDecimals(baseCurrency)),
  );

  return scaled > BigInt(0) && scaled < MAX_RATE_SCALED
    ? formatScaledRate(scaled)
    : null;
}

/**
 * Format a balance with an explicit sign (+£12.50, -£12.50, even).
 */
export function formatBalance(minor: number, currency: string): string {
  if (minor === 0) return "even";
  return `${minor > 0 ? "+" : "-"}${formatMoney(Math.abs(minor), currency)}`;
}

/**
 * The display symbol for a currency ("GBP" → "£"), for input prefixes.
 */
export function currencySymbol(currency: string): string {
  return (
    formatter(currency)
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}
