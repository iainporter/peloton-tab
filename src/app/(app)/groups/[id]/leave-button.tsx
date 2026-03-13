"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { leaveGroup } from "../actions";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setConfirming(true)}
      >
        Leave Group
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        Are you sure you want to leave this group?
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
          onClick={() => leaveGroup(groupId)}
        >
          Leave
        </Button>
      </div>
    </div>
  );
}
