import type { TripStatus } from "@/db/schema";

export function TripStatusBadge({ status }: { status: TripStatus }) {
  if (status === "open") return null;

  return status === "settling" ? (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      Settling
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
      Settled
    </span>
  );
}
