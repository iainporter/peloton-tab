"use client";

import { useEffect, useState } from "react";
import { getPendingPaymentsForRide, type PendingPayment } from "@/lib/offline-queue";
import { Card } from "@/components/ui";

export function PendingPayments({ rideId }: { rideId: string }) {
  const [pending, setPending] = useState<PendingPayment[]>([]);

  useEffect(() => {
    getPendingPaymentsForRide(rideId).then(setPending);

    const handleOnline = () => {
      // Re-check after sync may have cleared them
      setTimeout(() => {
        getPendingPaymentsForRide(rideId).then(setPending);
      }, 2000);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [rideId]);

  if (pending.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-amber-600 uppercase tracking-wide">
        Pending (offline)
      </h2>
      <Card className="divide-y divide-gray-100 p-0">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                You paid £{p.amount.toFixed(2)}
              </p>
              {p.note && (
                <p className="text-xs text-gray-500 truncate">{p.note}</p>
              )}
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Pending
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
