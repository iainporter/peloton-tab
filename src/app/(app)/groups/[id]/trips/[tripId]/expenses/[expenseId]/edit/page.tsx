import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { getTripForGroupMember, getTripLedger } from "@/lib/trip-data";
import { fromMinor } from "@/lib/money";
import { editExpense } from "../../../../actions";
import { ExpenseFields } from "../../../components/expense-fields";
import { DeleteExpenseButton } from "../../../components/delete-expense-button";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; tripId: string; expenseId: string }>;
}) {
  const { id: groupId, tripId, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const trip = await getTripForGroupMember(groupId, tripId, session.user.id);
  if (!trip) notFound();

  const { members, expenses, rates } = await getTripLedger(tripId);
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) notFound();

  if (
    trip.status !== "open" ||
    !members.some((m) => m.id === session.user.id)
  ) {
    redirect(`/groups/${groupId}/trips/${tripId}`);
  }

  const editExpenseBound = editExpense.bind(null, groupId, tripId, expenseId);

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
          <h1 className="text-xl font-bold text-gray-900">Edit Expense</h1>
          <p className="text-sm text-gray-500">{trip.name}</p>
        </div>
      </div>

      <form action={editExpenseBound} className="space-y-4">
        <ExpenseFields
          groupId={groupId}
          baseCurrency={trip.baseCurrency}
          tripRates={rates}
          members={members}
          currentUserId={session.user.id}
          defaults={{
            description: expense.description,
            amount: fromMinor(expense.amount, expense.currency),
            currency: expense.currency,
            // Manual expenses reopen as the amount charged, which preserves the base amount exactly
            conversion:
              expense.rateSource === "live"
                ? "rate"
                : expense.rateSource === "manual"
                  ? "charged"
                  : "trip",
            rate: expense.rateSource === "live" ? expense.rate : "",
            rateFetched: expense.rateSource === "live",
            chargedAmount:
              expense.rateSource === "manual"
                ? fromMinor(expense.baseAmount, trip.baseCurrency)
                : "",
            date: expense.date,
            paidBy: expense.paidBy,
            participantIds: expense.participantIds,
          }}
        />
        <Button type="submit" className="w-full">
          Save Changes
        </Button>
      </form>

      <DeleteExpenseButton
        groupId={groupId}
        tripId={tripId}
        expenseId={expenseId}
      />
    </div>
  );
}
