"use client";

import { useState, useTransition } from "react";
import { Avatar, Button, Card, Input } from "@/components/ui";
import {
  CURRENCIES,
  convertToBase,
  currencyDecimals,
  currencySymbol,
  deriveRate,
  formatMoney,
  parseRate,
  toMinor,
} from "@/lib/money";
import { fetchExchangeRate } from "../../actions";

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type Conversion = "trip" | "rate" | "charged";

export type ExpenseDefaults = {
  description: string;
  amount: string;
  currency: string;
  conversion: Conversion;
  rate: string;
  rateFetched: boolean;
  chargedAmount: string;
  date: string;
  paidBy: string;
  participantIds: string[];
};

const fieldClass =
  "rounded-lg border border-gray-300 bg-white py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

function stepFor(currency: string) {
  const decimals = currencyDecimals(currency);
  return decimals === 0 ? "1" : (1 / 10 ** decimals).toFixed(decimals);
}

export function ExpenseFields({
  groupId,
  baseCurrency,
  tripRates,
  members,
  currentUserId,
  defaults,
}: {
  groupId: string;
  baseCurrency: string;
  tripRates: { currency: string; rate: string }[];
  members: Member[];
  currentUserId: string;
  defaults?: ExpenseDefaults;
}) {
  const today = new Date().toISOString().split("T")[0];
  const tripRateMap = new Map(tripRates.map((r) => [r.currency, r.rate]));
  const participantIds = defaults ? new Set(defaults.participantIds) : null;

  const [currency, setCurrency] = useState(defaults?.currency ?? baseCurrency);
  const [amount, setAmount] = useState(defaults?.amount ?? "");
  const [date, setDate] = useState(defaults?.date ?? today);
  const [conversion, setConversion] = useState<Conversion>(
    defaults?.conversion ?? "trip",
  );
  const [rate, setRate] = useState(defaults?.rate ?? "");
  const [rateFetched, setRateFetched] = useState(defaults?.rateFetched ?? false);
  const [chargedAmount, setChargedAmount] = useState(
    defaults?.chargedAmount ?? "",
  );
  const [rateMessage, setRateMessage] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();

  const isForeign = currency !== baseCurrency;
  const tripRate = tripRateMap.get(currency);

  function handleCurrencyChange(next: string) {
    setCurrency(next);
    setRate("");
    setRateFetched(false);
    setRateMessage(null);
    if (tripRateMap.has(next)) setConversion("trip");
    else if (conversion === "trip") setConversion("rate");
  }

  function handleFetchRate() {
    setRateMessage(null);
    startFetch(async () => {
      const result = await fetchExchangeRate(groupId, currency, baseCurrency, date);
      if ("error" in result) {
        setRateMessage(result.error);
        return;
      }
      setRate(result.rate);
      setRateFetched(true);
      setRateMessage(`ECB reference rate for ${result.date}`);
    });
  }

  function getPreview() {
    const amountMinor = toMinor(amount, currency);
    if (!isForeign || !amountMinor) return null;
    const original = formatMoney(amountMinor, currency);

    if (conversion === "charged") {
      const charged = toMinor(chargedAmount, baseCurrency);
      const derived = charged
        ? deriveRate(amountMinor, currency, charged, baseCurrency)
        : null;
      return charged && derived
        ? `${original} = ${formatMoney(charged, baseCurrency)} (rate ${derived})`
        : null;
    }

    const activeRate = conversion === "trip" ? tripRate : parseRate(rate);
    if (!activeRate) return null;
    const converted = convertToBase(amountMinor, currency, activeRate, baseCurrency);
    return `${original} ≈ ${formatMoney(converted, baseCurrency)} @ ${activeRate}`;
  }

  const preview = getPreview();

  return (
    <>
      <Input
        label="Description"
        name="description"
        placeholder="e.g. Taxi to the airport"
        defaultValue={defaults?.description}
        required
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Amount
        </label>
        <div className="flex gap-2">
          <select
            name="currency"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className={`${fieldClass} w-24 shrink-0 px-3`}
          >
            {Object.keys(CURRENCIES).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {currencySymbol(currency)}
            </span>
            <input
              type="number"
              name="amount"
              step={stepFor(currency)}
              min={stepFor(currency)}
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${fieldClass} w-full pl-9 pr-3`}
            />
          </div>
        </div>
      </div>

      {isForeign && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Convert to {baseCurrency}
          </label>
          <Card className="divide-y divide-gray-100 p-0">
            <label
              className={`flex items-start gap-3 px-4 py-3 ${
                tripRate ? "cursor-pointer" : "opacity-50"
              }`}
            >
              <input
                type="radio"
                name="conversion"
                value="trip"
                checked={conversion === "trip"}
                disabled={!tripRate}
                onChange={() => setConversion("trip")}
                className="mt-0.5 h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <p className="text-sm text-gray-900">Trip rate</p>
                <p className="text-xs text-gray-500">
                  {tripRate
                    ? `1 ${currency} = ${tripRate} ${baseCurrency}`
                    : `No trip rate for ${currency} — add one in trip settings`}
                </p>
              </div>
            </label>

            <div className="px-4 py-3 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="conversion"
                  value="rate"
                  checked={conversion === "rate"}
                  onChange={() => setConversion("rate")}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <p className="text-sm text-gray-900">Exchange rate</p>
                  <p className="text-xs text-gray-500">
                    Enter a rate, or fetch the rate for the expense date
                  </p>
                </div>
              </label>
              {conversion === "rate" && (
                <div className="ml-7 space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      name="rate"
                      required
                      placeholder={`${baseCurrency} per 1 ${currency}`}
                      value={rate}
                      onChange={(e) => {
                        setRate(e.target.value);
                        setRateFetched(false);
                        setRateMessage(null);
                      }}
                      className={`${fieldClass} min-w-0 flex-1 px-3`}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleFetchRate}
                      disabled={isFetching}
                      className="shrink-0"
                    >
                      {isFetching ? "Fetching..." : "Fetch rate"}
                    </Button>
                  </div>
                  <input type="hidden" name="rateFetched" value={String(rateFetched)} />
                  {rateMessage && (
                    <p className="text-xs text-gray-500">{rateMessage}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="conversion"
                  value="charged"
                  checked={conversion === "charged"}
                  onChange={() => setConversion("charged")}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <p className="text-sm text-gray-900">
                    Amount charged in {baseCurrency}
                  </p>
                  <p className="text-xs text-gray-500">
                    Use what your card or bank actually charged
                  </p>
                </div>
              </label>
              {conversion === "charged" && (
                <div className="ml-7 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {currencySymbol(baseCurrency)}
                  </span>
                  <input
                    type="number"
                    name="chargedAmount"
                    step={stepFor(baseCurrency)}
                    min={stepFor(baseCurrency)}
                    required
                    placeholder="0.00"
                    value={chargedAmount}
                    onChange={(e) => setChargedAmount(e.target.value)}
                    className={`${fieldClass} w-full pl-9 pr-3`}
                  />
                </div>
              )}
            </div>
          </Card>
          {preview && (
            <p className="mt-2 text-sm font-medium text-orange-600">{preview}</p>
          )}
        </div>
      )}

      <Input
        label="Date"
        type="date"
        name="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Paid by
        </label>
        <select
          name="paidBy"
          defaultValue={defaults?.paidBy ?? currentUserId}
          className={`${fieldClass} w-full px-3`}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {member.id === currentUserId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Split between
        </label>
        <Card className="divide-y divide-gray-100 p-0">
          {members.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="participants"
                value={member.id}
                defaultChecked={participantIds?.has(member.id) ?? true}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <Avatar name={member.name} src={member.avatarUrl} />
              <span className="text-sm text-gray-900">{member.name}</span>
            </label>
          ))}
        </Card>
      </div>
    </>
  );
}
