import { AppShell } from "@/components/app-shell";
import { PaymentSync } from "@/components/payment-sync";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // If the refresh token is invalid, sign out and redirect to re-authenticate
  if (session?.error === "RefreshTokenError") {
    await signOut({ redirect: false });
    redirect("/");
  }

  return (
    <AppShell user={session?.user}>
      <PaymentSync />
      {children}
    </AppShell>
  );
}
