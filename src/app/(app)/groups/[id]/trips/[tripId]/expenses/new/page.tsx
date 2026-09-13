import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getTripForGroupMember, getTripLedger } from "@/lib/trip-data";
import { addExpense } from "../../../actions";
import { ExpenseFields } from "../../components/expense-fields";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string; tripId: string }>;
}) {
  const { id: groupId, tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const trip = await getTripForGroupMember(groupId, tripId, session.user.id);
  if (!trip) notFound();

  const { members, rates } = await getTripLedger(tripId);
  if (
    trip.status !== "open" ||
    !members.some((m) => m.id === session.user.id)
  ) {
    redirect(`/groups/${groupId}/trips/${tripId}`);
  }

  const addExpenseBound = addExpense.bind(null, groupId, tripId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}/trips/${tripId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add Expense</h1>
          <p className="text-sm text-gray-500">{trip.name}</p>
        </div>
      </div>

      <form action={addExpenseBound} className="space-y-4">
        <ExpenseFields
          groupId={groupId}
          baseCurrency={trip.baseCurrency}
          tripRates={rates}
          members={members}
          currentUserId={session.user.id}
        />
        <Button type="submit" className="w-full">
          Add Expense
        </Button>
      </form>
    </div>
  );
}
