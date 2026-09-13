"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { CURRENCIES } from "@/lib/money";
import { fetchExchangeRate, setTripRate } from "../../actions";

const fieldClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export function TripRateForm({
  groupId,
  tripId,
  baseCurrency,
  rates,
}: {
  groupId: string;
  tripId: string;
  baseCurrency: string;
  rates: { currency: string; rate: string }[];
}) {
  const existing = new Map(rates.map((r) => [r.currency, r.rate]));
  const currencies = Object.keys(CURRENCIES).filter((c) => c !== baseCurrency);
  const initial = currencies.find((c) => !existing.has(c)) ?? currencies[0];

  const [currency, setCurrency] = useState(initial);
  const [rate, setRate] = useState(existing.get(initial) ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();

  const setTripRateBound = setTripRate.bind(null, groupId, tripId);

  function handleCurrencyChange(next: string) {
    setCurrency(next);
    setRate(existing.get(next) ?? "");
    setMessage(null);
  }

  function handleFetch() {
    setMessage(null);
    startFetch(async () => {
      const result = await fetchExchangeRate(groupId, currency, baseCurrency);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setRate(result.rate);
      setMessage(`ECB reference rate for ${result.date}`);
    });
  }

  return (
    <form action={setTripRateBound} className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>1</span>
        <select
          name="currency"
          value={currency}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          className={`${fieldClass} w-24 shrink-0`}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <span>=</span>
        <input
          type="text"
          inputMode="decimal"
          name="rate"
          required
          placeholder="0.00"
          value={rate}
          onChange={(e) => {
            setRate(e.target.value);
            setMessage(null);
          }}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <span>{baseCurrency}</span>
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={handleFetch}
          disabled={isFetching}
        >
          {isFetching ? "Fetching..." : "Fetch today's rate"}
        </Button>
        <Button type="submit" className="flex-1">
          {existing.has(currency) ? "Update rate" : "Add rate"}
        </Button>
      </div>
    </form>
  );
}
