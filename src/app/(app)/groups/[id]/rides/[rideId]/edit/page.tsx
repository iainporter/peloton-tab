import { auth } from "@/lib/auth";
import { db } from "@/db";
import { rides, rideRiders, groupMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button, Card } from "@/components/ui";
import { updateRideParticipants } from "../../../actions";
import Link from "next/link";

export default async function EditRidePage({
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

  const members = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));

  const currentRiders = await db
    .select({ userId: rideRiders.userId })
    .from(rideRiders)
    .where(eq(rideRiders.rideId, rideId));

  const currentRiderIds = new Set(currentRiders.map((r) => r.userId));

  const updateBound = updateRideParticipants.bind(null, groupId, rideId);

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
        <h1 className="text-xl font-bold text-gray-900">Edit Riders</h1>
      </div>

      <form action={updateBound} className="space-y-4">
        <Card className="divide-y divide-gray-100 p-0">
          {members.map((member) => (
            <label
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                name="participants"
                value={member.id}
                defaultChecked={currentRiderIds.has(member.id)}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
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
              <span className="text-sm text-gray-900">{member.name}</span>
            </label>
          ))}
        </Card>

        <Button type="submit" className="w-full">
          Save
        </Button>
      </form>
    </div>
  );
}
