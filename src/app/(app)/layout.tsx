import { AppShell } from "@/components/app-shell";
import { PaymentSync } from "@/components/payment-sync";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // No session (cookie existed but JWT is invalid) — redirect to sign in
  if (!session?.user) {
    redirect("/");
  }

  return (
    <AppShell user={session?.user}>
      <PaymentSync />
      {children}
    </AppShell>
  );
}
