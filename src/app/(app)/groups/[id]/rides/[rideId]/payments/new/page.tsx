import { auth } from "@/lib/auth";
import { db } from "@/db";
import { rides, groupMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { addPayment } from "../../../../actions";
import Link from "next/link";

export default async function NewPaymentPage({
  params,
}: {
  params: Promise<{ id: string; rideId: string }>;
}) {
  const { id: groupId, rideId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!membership) notFound();

  const [ride] = await db
    .select()
    .from(rides)
    .where(and(eq(rides.id, rideId), eq(rides.groupId, groupId)))
    .limit(1);

  if (!ride) notFound();

  const addPaymentBound = addPayment.bind(null, groupId, rideId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}/rides/${rideId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add Payment</h1>
      </div>

      <form action={addPaymentBound} className="space-y-4">
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
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <Input label="Note (optional)" name="note" placeholder="e.g. Coffee and cake" />

        <Button type="submit" className="w-full">
          Add Payment
        </Button>
      </form>
    </div>
  );
}
