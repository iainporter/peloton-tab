import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, groupMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Button, Input, Card } from "@/components/ui";
import { createRide } from "../../actions";
import Link from "next/link";

export default async function NewRidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) notFound();

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
    .where(eq(groupMembers.groupId, groupId));

  const today = new Date().toISOString().split("T")[0];

  const createRideWithGroupId = createRide.bind(null, groupId);

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
        <h1 className="text-xl font-bold text-gray-900">Log a Ride</h1>
      </div>

      <form action={createRideWithGroupId} className="space-y-4">
        <Input label="Date" type="date" name="date" defaultValue={today} required />
        <Input label="Title (optional)" name="title" placeholder="e.g. Sunday coffee ride" />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Who rode?
          </label>
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
                  defaultChecked
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
        </div>

        <Button type="submit" className="w-full">
          Log Ride
        </Button>
      </form>
    </div>
  );
}
