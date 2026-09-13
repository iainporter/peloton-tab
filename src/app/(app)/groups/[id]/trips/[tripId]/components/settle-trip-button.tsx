"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { settleTrip } from "../../actions";

export function SettleTripButton({
  groupId,
  tripId,
  paymentCount,
}: {
  groupId: string;
  tripId: string;
  paymentCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button className="w-full" onClick={() => setConfirming(true)}>
        Settle Trip
      </Button>
    );
  }

  function handleSettle() {
    startTransition(async () => {
      await settleTrip(groupId, tripId);
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        {paymentCount === 0
          ? "Mark this trip as settled?"
          : "Lock expenses and ask everyone to make these payments?"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSettle} disabled={isPending}>
          {isPending ? "Settling..." : "Settle"}
        </Button>
      </div>
    </div>
  );
}
