"use client";

import { useTransition } from "react";
import { syncStravaRides } from "./actions";

export function SyncStravaButton({ groupId }: { groupId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => syncStravaRides(groupId))}
      disabled={isPending}
      className="text-sm text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50"
    >
      {isPending ? "Syncing..." : "Sync Strava"}
    </button>
  );
}
