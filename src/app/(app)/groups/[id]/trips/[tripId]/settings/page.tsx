import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, Button, Card, Input } from "@/components/ui";
import { getTripForGroupMember, getTripLedger } from "@/lib/trip-data";
import { CURRENCIES, isCurrencyCode } from "@/lib/money";
import {
  addTripMember,
  deleteTripRate,
  removeTripMember,
  updateTrip,
} from "../../actions";
import { DeleteTripButton } from "../components/delete-trip-button";
import { TripRateForm } from "../components/trip-rate-form";

export default async function TripSettingsPage({
  params,
}: {
  params: Promise<{ id: string; tripId: string }>;
}) {
  const { id: groupId, tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const trip = await getTripForGroupMember(groupId, tripId, userId);
  if (!trip) notFound();

  const [{ members, expenses, rates }, groupMemberRows] = await Promise.all([
    getTripLedger(tripId),
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(users.name),
  ]);

  if (!members.some((m) => m.id === userId)) {
    redirect(`/groups/${groupId}/trips/${tripId}`);
  }

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = groupMemberRows.filter((m) => !memberIds.has(m.id));
  const involvedIds = new Set(
    expenses.flatMap((e) => [e.paidBy, ...e.participantIds]),
  );
  const rateUsage = new Map<string, number>();
  for (const e of expenses) {
    if (e.rateSource === "trip") {
      rateUsage.set(e.currency, (rateUsage.get(e.currency) ?? 0) + 1);
    }
  }
  const isOpen = trip.status === "open";

  const updateTripBound = updateTrip.bind(null, groupId, tripId);
  const currencyName = isCurrencyCode(trip.baseCurrency)
    ? CURRENCIES[trip.baseCurrency].name
    : trip.baseCurrency;

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
          <h1 className="text-xl font-bold text-gray-900">Trip Settings</h1>
          <p className="text-sm text-gray-500">{trip.name}</p>
        </div>
      </div>

      {/* Details */}
      <form action={updateTripBound} className="space-y-4">
        <Input label="Name" name="name" defaultValue={trip.name} required />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start date"
            type="date"
            name="startDate"
            defaultValue={trip.startDate ?? undefined}
          />
          <Input
            label="End date"
            type="date"
            name="endDate"
            defaultValue={trip.endDate ?? undefined}
          />
        </div>
        <p className="text-xs text-gray-500">
          Base currency: {trip.baseCurrency} — {currencyName}
        </p>
        <Button type="submit" variant="secondary" className="w-full">
          Save Details
        </Button>
      </form>

      {/* Exchange Rates */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Exchange Rates
        </h2>
        {rates.length > 0 && (
          <Card className="mb-3 divide-y divide-gray-100 p-0">
            {rates.map((r) => {
              const usage = rateUsage.get(r.currency) ?? 0;
              return (
                <div key={r.currency} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      1 {r.currency} = {r.rate} {trip.baseCurrency}
                    </p>
                    <p className="text-xs text-gray-400">
                      {usage === 0
                        ? "Not used yet"
                        : `Used by ${usage} ${usage === 1 ? "expense" : "expenses"}`}
                    </p>
                  </div>
                  {isOpen && usage === 0 && (
                    <form action={deleteTripRate.bind(null, groupId, tripId, r.currency)}>
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        {isOpen && (
          <Card>
            <TripRateForm
              groupId={groupId}
              tripId={tripId}
              baseCurrency={trip.baseCurrency}
              rates={rates}
            />
          </Card>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Set the rate your group agrees to use. Changing it updates every
          expense that uses the trip rate.
        </p>
      </div>

      {/* Members */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Members ({members.length})
        </h2>
        <Card className="divide-y divide-gray-100 p-0">
          {members.map((member) => {
            const removable = members.length > 1 && !involvedIds.has(member.id);
            return (
              <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={member.name} src={member.avatarUrl} size={28} />
                <span className="text-sm text-gray-700">
                  {member.name}
                  {member.id === userId && (
                    <span className="text-gray-400"> (you)</span>
                  )}
                </span>
                {isOpen && removable && (
                  <form
                    action={removeTripMember.bind(null, groupId, tripId, member.id)}
                    className="ml-auto"
                  >
                    <button
                      type="submit"
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </Card>
        <p className="mt-1 text-xs text-gray-500">
          Members on an expense can&apos;t be removed.
        </p>
      </div>

      {isOpen && nonMembers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Add from Group
          </h2>
          <Card className="divide-y divide-gray-100 p-0">
            {nonMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={member.name} src={member.avatarUrl} size={28} />
                <span className="text-sm text-gray-700">{member.name}</span>
                <form
                  action={addTripMember.bind(null, groupId, tripId, member.id)}
                  className="ml-auto"
                >
                  <button
                    type="submit"
                    className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                  >
                    Add
                  </button>
                </form>
              </div>
            ))}
          </Card>
        </div>
      )}

      <DeleteTripButton groupId={groupId} tripId={tripId} />
    </div>
  );
}
