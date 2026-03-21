import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  rides,
  rideRiders,
  payments,
  groups,
  groupMembers,
  users,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { Card, EmptyState } from "@/components/ui";
import Link from "next/link";

function formatAmount(pence: number) {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`;
}

export default async function RidesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Get all groups the user belongs to
  const userGroups = await db
    .select({
      groupId: groupMembers.groupId,
      groupName: groups.name,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, session.user.id));

  if (userGroups.length === 0) {
    return (
      <EmptyState
        title="No rides yet"
        description="Rides will appear here once you join a group."
      />
    );
  }

  const groupIds = userGroups.map((g) => g.groupId);
  const groupNameMap = new Map(userGroups.map((g) => [g.groupId, g.groupName]));

  // Get all rides from user's groups, ordered by date
  const allRides = await db
    .select({
      id: rides.id,
      groupId: rides.groupId,
      date: rides.date,
      title: rides.title,
      autoDetected: rides.autoDetected,
    })
    .from(rides)
    .where(inArray(rides.groupId, groupIds))
    .orderBy(desc(rides.date));

  if (allRides.length === 0) {
    return (
      <EmptyState
        title="No rides yet"
        description="Log your first ride from a group page."
      />
    );
  }

  // Get rider and payment details for each ride
  const rideDetails = await Promise.all(
    allRides.map(async (ride) => {
      const [riderRows, paymentRows] = await Promise.all([
        db
          .select({ userId: rideRiders.userId, name: users.name })
          .from(rideRiders)
          .innerJoin(users, eq(users.id, rideRiders.userId))
          .where(eq(rideRiders.rideId, ride.id)),
        db
          .select({
            amount: payments.amount,
            payerName: users.name,
          })
          .from(payments)
          .innerJoin(users, eq(users.id, payments.paidBy))
          .where(eq(payments.rideId, ride.id)),
      ]);

      const totalPence = paymentRows.reduce((s, p) => s + p.amount, 0);

      return {
        ...ride,
        groupName: groupNameMap.get(ride.groupId) ?? "Unknown",
        riders: riderRows,
        riderCount: riderRows.length,
        payments: paymentRows,
        totalPence,
        perPerson: riderRows.length > 0 ? totalPence / riderRows.length : 0,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">All Rides</h1>

      <div className="space-y-3">
        {rideDetails.map((ride) => {
          const rideDate = new Date(ride.date + "T00:00:00");
          const dateStr = rideDate.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          return (
            <Link
              key={ride.id}
              href={`/groups/${ride.groupId}/rides/${ride.id}`}
              className="block"
            >
              <Card className="hover:border-orange-200 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900">
                        {ride.title || dateStr}
                      </p>
                      {ride.autoDetected && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          Strava
                        </span>
                      )}
                    </div>
                    {ride.title && (
                      <p className="text-xs text-gray-500">{dateStr}</p>
                    )}
                    <p className="text-xs text-orange-500 mt-0.5">
                      {ride.groupName}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {ride.riders.map((r) => r.name.split(" ")[0]).join(", ")}
                    </p>
                  </div>
                  {ride.totalPence > 0 && (
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatAmount(ride.totalPence)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatAmount(ride.perPerson)}/ea
                      </p>
                    </div>
                  )}
                </div>
                {ride.payments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {ride.payments.map((p, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        {p.payerName} paid {formatAmount(p.amount)}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
