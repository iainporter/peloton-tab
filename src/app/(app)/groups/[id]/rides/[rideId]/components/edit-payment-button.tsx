"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { editPayment } from "../../../actions";

export function EditPaymentButton({
  groupId,
  rideId,
  paymentId,
  currentAmount,
  currentNote,
}: {
  groupId: string;
  rideId: string;
  paymentId: string;
  currentAmount: string;
  currentNote: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
        title="Edit payment"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
        </svg>
      </button>
    );
  }

  async function handleSubmit(formData: FormData) {
    await editPayment(groupId, rideId, paymentId, formData);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Edit Payment</h3>
        <form action={handleSubmit} className="space-y-3">
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
                defaultValue={currentAmount}
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <input
              name="note"
              defaultValue={currentNote}
              placeholder="e.g. Coffee and cake"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
