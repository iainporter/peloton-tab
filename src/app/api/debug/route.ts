import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL not set" });
  }

  const masked = url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  try {
    const sql = neon(url);
    const result = await sql`SELECT 1 as ok`;
    return NextResponse.json({ masked, result, status: "connected" });
  } catch (e: any) {
    return NextResponse.json({
      masked,
      error: e.message,
      stack: e.stack?.split("\n").slice(0, 5),
    });
  }
}
