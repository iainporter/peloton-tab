import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments, groupMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface SyncPayment {
  groupId: string;
  rideId: string;
  amount: number; // pounds (decimal)
  note: string | null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const paymentItems: SyncPayment[] = body.payments;

  if (!Array.isArray(paymentItems) || paymentItems.length === 0) {
    return NextResponse.json({ error: "No payments provided" }, { status: 400 });
  }

  const errors: string[] = [];
  let synced = 0;
  const affectedPaths = new Set<string>();

  for (const item of paymentItems) {
    try {
      // Validate group membership
      const [membership] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, item.groupId),
            eq(groupMembers.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!membership) {
        errors.push(`Not a member of group ${item.groupId}`);
        continue;
      }

      const pounds = parseFloat(String(item.amount));
      if (isNaN(pounds) || pounds <= 0) {
        errors.push(`Invalid amount for ride ${item.rideId}`);
        continue;
      }

      const amountPence = Math.round(pounds * 100);

      await db.insert(payments).values({
        rideId: item.rideId,
        paidBy: session.user.id,
        amount: amountPence,
        note: item.note || null,
      });

      synced++;
      affectedPaths.add(`/groups/${item.groupId}/rides/${item.rideId}`);
      affectedPaths.add(`/groups/${item.groupId}`);
    } catch (err) {
      errors.push(`Failed to sync payment for ride ${item.rideId}`);
    }
  }

  // Revalidate affected pages
  for (const path of affectedPaths) {
    revalidatePath(path);
  }

  return NextResponse.json({ synced, errors });
}
