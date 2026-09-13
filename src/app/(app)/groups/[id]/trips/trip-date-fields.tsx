"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

/**
 * Start and end date inputs where the end date can't be set before the start.
 * The server still validates, as not every browser enforces `min`.
 */
export function TripDateFields({
  defaultStartDate,
  defaultEndDate,
  optional = false,
}: {
  defaultStartDate?: string | null;
  defaultEndDate?: string | null;
  optional?: boolean;
}) {
  const [startDate, setStartDate] = useState(defaultStartDate ?? "");
  const suffix = optional ? " (optional)" : "";

  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        label={`Start date${suffix}`}
        type="date"
        name="startDate"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <Input
        label={`End date${suffix}`}
        type="date"
        name="endDate"
        defaultValue={defaultEndDate ?? undefined}
        min={startDate || undefined}
      />
    </div>
  );
}
