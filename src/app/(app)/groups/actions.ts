"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, groupMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/1/O/0 confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Group name is required");

  const [group] = await db
    .insert(groups)
    .values({
      name: name.trim(),
      inviteCode: generateInviteCode(),
      createdBy: session.user.id,
    })
    .returning();

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (!code) throw new Error("Invite code is required");

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);

  if (!group) {
    return { error: "Invalid invite code" };
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (existing) {
    redirect(`/groups/${group.id}`);
  }

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroupByCode(code: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code.toUpperCase()))
    .limit(1);

  if (!group) return { error: "Invalid invite code" };

  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: session.user.id,
    });
  }

  redirect(`/groups/${group.id}`);
}

export async function leaveGroup(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    );

  revalidatePath("/groups");
  redirect("/groups");
}
