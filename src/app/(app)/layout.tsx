import { AppShell } from "@/components/app-shell";
import { PaymentSync } from "@/components/payment-sync";
import { auth } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <AppShell user={session?.user}>
      <PaymentSync />
      {children}
    </AppShell>
  );
}
