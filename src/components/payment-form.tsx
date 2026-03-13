"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { queuePayment } from "@/lib/offline-queue";

export function PaymentForm({
  groupId,
  rideId,
  addPaymentAction,
}: {
  groupId: string;
  rideId: string;
  addPaymentAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);

    if (navigator.onLine) {
      // Online: use server action
      startTransition(async () => {
        await addPaymentAction(formData);
      });
    } else {
      // Offline: validate and queue in IndexedDB
      const amountStr = formData.get("amount") as string;
      const note = (formData.get("note") as string)?.trim() || null;
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        setError("Please enter a valid amount");
        return;
      }

      try {
        await queuePayment({ groupId, rideId, amount, note });
        router.push(`/groups/${groupId}/rides/${rideId}`);
      } catch {
        setError("Failed to save payment offline");
      }
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            £
          </span>
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <Input label="Note (optional)" name="note" placeholder="e.g. Coffee and cake" />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving..." : "Add Payment"}
      </Button>
    </form>
  );
}
