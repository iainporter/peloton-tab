import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, groupMembers, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Card, Button, EmptyState } from "@/components/ui";
import { getUserGroupBalance } from "@/lib/balances";

function formatAmount(pence: number) {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`;
}

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const myGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      inviteCode: groups.inviteCode,
      memberCount: sql<number>`count(${groupMembers.userId})::int`,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(
      sql`${groups.id} in (
        select ${groupMembers.groupId} from ${groupMembers}
        where ${groupMembers.userId} = ${session.user.id}
      )`,
    )
    .groupBy(groups.id);

  if (myGroups.length === 0) {
    return (
      <EmptyState
        title="No groups yet"
        description="Create a group or join one with an invite code."
        action={
          <div className="flex gap-3">
            <Link href="/groups/new">
              <Button>Create Group</Button>
            </Link>
            <Link href="/groups/join">
              <Button variant="secondary">Join Group</Button>
            </Link>
          </div>
        }
      />
    );
  }

  // Fetch user's balance for each group
  const groupsWithBalances = await Promise.all(
    myGroups.map(async (group) => {
      const balance = await getUserGroupBalance(group.id, session.user!.id!);
      return { ...group, balance };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Your Groups</h1>
        <div className="flex gap-2">
          <Link href="/groups/join">
            <Button variant="secondary" className="text-xs px-3 py-1.5">
              Join
            </Button>
          </Link>
          <Link href="/groups/new">
            <Button className="text-xs px-3 py-1.5">Create</Button>
          </Link>
        </div>
      </div>

      {groupsWithBalances.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <Card className="hover:border-orange-200 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">{group.name}</h2>
                <p className="text-sm text-gray-500">
                  {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {group.balance !== 0 && (
                  <span
                    className={`text-sm font-semibold ${
                      group.balance > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {group.balance > 0 ? "+" : "-"}{formatAmount(group.balance)}
                  </span>
                )}
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}
