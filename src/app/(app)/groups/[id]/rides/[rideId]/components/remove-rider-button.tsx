"use client";

import { useTransition } from "react";
import { removeRiderFromRide } from "../../../actions";

export function RemoveRiderButton({
  groupId,
  rideId,
  userId,
  riderName,
  hasPayments,
}: {
  groupId: string;
  rideId: string;
  userId: string;
  riderName: string;
  hasPayments: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (hasPayments) return null;

  function handleRemove() {
    if (!confirm(`Remove ${riderName} from this ride?`)) return;
    startTransition(async () => {
      await removeRiderFromRide(groupId, rideId, userId);
    });
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="ml-auto text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
      title={`Remove ${riderName}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
