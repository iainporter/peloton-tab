"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { deleteExpense } from "../../actions";

export function DeleteExpenseButton({
  groupId,
  tripId,
  expenseId,
}: {
  groupId: string;
  tripId: string;
  expenseId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setConfirming(true)}
      >
        Delete Expense
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-center text-gray-600">
        Delete this expense?
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
          onClick={() => deleteExpense(groupId, tripId, expenseId)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
