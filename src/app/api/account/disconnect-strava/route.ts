import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ accessToken: users.stravaAccessToken })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (user?.accessToken) {
      const res = await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: user.accessToken }),
      });

      if (!res.ok) {
        console.error("Strava deauthorize failed:", await res.text());
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Strava disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 },
    );
  }
}
