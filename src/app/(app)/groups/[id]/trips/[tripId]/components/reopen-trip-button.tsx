"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { reopenTrip } from "../../actions";

export function ReopenTripButton({
  groupId,
  tripId,
}: {
  groupId: string;
  tripId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenTrip(groupId, tripId);
      if (result?.error) setError(result.error);
      setConfirming(false);
    });
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setConfirming(true)}
        >
          Reopen Trip
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        Reopen the trip for changes? Payments not yet made will be cleared;
        payments already made are kept.
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleReopen} disabled={isPending}>
          {isPending ? "Reopening..." : "Reopen"}
        </Button>
      </div>
    </div>
  );
}
