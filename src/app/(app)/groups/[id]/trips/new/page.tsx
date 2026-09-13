import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Avatar, Button, Input, Card } from "@/components/ui";
import { CURRENCIES } from "@/lib/money";
import { ActionForm } from "@/components/action-form";
import { createTrip } from "../actions";
import { TripDateFields } from "../trip-date-fields";
import Link from "next/link";

export default async function NewTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
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

  const members = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(users.name);

  const createTripWithGroupId = createTrip.bind(null, groupId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Trip</h1>
      </div>

      <ActionForm action={createTripWithGroupId} className="space-y-4">
        <Input label="Name" name="name" placeholder="e.g. French Alps 2027" required />

        <TripDateFields optional />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Base currency
          </label>
          <select
            name="baseCurrency"
            defaultValue="GBP"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {Object.entries(CURRENCIES).map(([code, { name }]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Balances and settling up use this currency.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Who&apos;s going?
          </label>
          <Card className="divide-y divide-gray-100 p-0">
            {members.map((member) => {
              const isYou = member.id === session.user.id;
              return (
                <label
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    name="members"
                    value={member.id}
                    defaultChecked
                    disabled={isYou}
                    className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <Avatar name={member.name} src={member.avatarUrl} />
                  <span className="text-sm text-gray-900">
                    {member.name}
                    {isYou && <span className="text-gray-400"> (you)</span>}
                  </span>
                </label>
              );
            })}
          </Card>
          <p className="mt-1 text-xs text-gray-500">
            New riders join the group with the invite code, then can be added
            to the trip.
          </p>
        </div>

        <Button type="submit" className="w-full">
          Create Trip
        </Button>
      </ActionForm>
    </div>
  );
}
