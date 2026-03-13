"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { deleteRide } from "../../../actions";

export function DeleteRideButton({
  groupId,
  rideId,
}: {
  groupId: string;
  rideId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setConfirming(true)}
      >
        Delete Ride
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        Delete this ride and all its payments?
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
          onClick={() => deleteRide(groupId, rideId)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
