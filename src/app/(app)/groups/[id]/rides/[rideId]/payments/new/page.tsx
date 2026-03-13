import { auth } from "@/lib/auth";
import { db } from "@/db";
import { rides, groupMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { addPayment } from "../../../../actions";
import { PaymentForm } from "@/components/payment-form";
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

      <PaymentForm
        groupId={groupId}
        rideId={rideId}
        addPaymentAction={addPaymentBound}
      />
    </div>
  );
}
