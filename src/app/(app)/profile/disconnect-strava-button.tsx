"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function DisconnectStravaButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch("/api/account/disconnect-strava", { method: "POST" });
      await signOut({ callbackUrl: "/" });
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
        <p className="text-sm text-orange-800">
          This will revoke PelotonTab&apos;s access to your Strava account and
          sign you out. Your data will remain in the app.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Disconnecting..." : "Confirm"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
    >
      Disconnect Strava
    </button>
  );
}
