"use client";

import { useState, useTransition } from "react";
import { syncStravaRides } from "./actions";

export function SyncStravaButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncStravaRides(groupId);
      setMessage({ text: result.message, success: result.success });
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="text-sm text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50"
      >
        {isPending ? "Syncing..." : "Sync Strava"}
      </button>
      {message && (
        <div
          className={`absolute right-0 top-full mt-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${
            message.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
