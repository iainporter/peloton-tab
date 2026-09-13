"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { deleteTrip } from "../../actions";

export function DeleteTripButton({
  groupId,
  tripId,
}: {
  groupId: string;
  tripId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setConfirming(true)}
      >
        Delete Trip
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        Delete this trip and all its expenses?
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => deleteTrip(groupId, tripId)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
