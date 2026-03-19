"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { addRiderToRide } from "../../../actions";
import Image from "next/image";

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export function AddRiderButton({
  groupId,
  rideId,
  availableMembers,
}: {
  groupId: string;
  rideId: string;
  availableMembers: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (availableMembers.length === 0) return null;

  function handleAdd(userId: string) {
    startTransition(async () => {
      await addRiderToRide(groupId, rideId, userId);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 font-medium"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-9 1.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm8.25 6.75a6.375 6.375 0 00-12.75 0" />
        </svg>
        Add rider
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Add Rider</h3>
            <p className="text-sm text-gray-500">
              Select a group member to add to this ride.
            </p>
            <div className="divide-y divide-gray-100">
              {availableMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleAdd(member.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-3 py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      alt={member.name}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-orange-600">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900">{member.name}</span>
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
