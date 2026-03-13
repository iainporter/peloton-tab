"use client";

import { deletePayment } from "../../../actions";

export function DeletePaymentButton({
  groupId,
  rideId,
  paymentId,
}: {
  groupId: string;
  rideId: string;
  paymentId: string;
}) {
  return (
    <button
      onClick={() => deletePayment(groupId, rideId, paymentId)}
      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
      title="Delete payment"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
