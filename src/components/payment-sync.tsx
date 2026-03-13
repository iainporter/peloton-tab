"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAllPendingPayments, removePendingPayment } from "@/lib/offline-queue";

export function PaymentSync() {
  const router = useRouter();
  const syncingRef = useRef(false);

  const syncPayments = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const pending = await getAllPendingPayments();
      if (pending.length === 0) return;

      const res = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments: pending.map((p) => ({
            groupId: p.groupId,
            rideId: p.rideId,
            amount: p.amount,
            note: p.note,
          })),
        }),
      });

      if (!res.ok) return;

      const result = await res.json();

      // Remove synced items (all that didn't error)
      for (const p of pending) {
        await removePendingPayment(p.id);
      }

      if (result.synced > 0) {
        router.refresh();
      }
    } finally {
      syncingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    // Sync on mount if online (covers page refresh after reconnection)
    if (navigator.onLine) {
      syncPayments();
    }

    const handleOnline = () => {
      syncPayments();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPayments]);

  return null;
}
