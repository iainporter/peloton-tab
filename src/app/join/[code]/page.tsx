import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { joinGroupByCode } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui";

export default async function JoinByLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  // If not signed in, redirect to home with the join code as a param
  // so they can sign in first, then join
  if (!session?.user?.id) {
    redirect(`/?join=${code}`);
  }

  // Auto-join and redirect
  const result = await joinGroupByCode(code);

  // If we get here, there was an error (joinGroupByCode redirects on success)
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Invalid Invite Link
        </h1>
        <p className="text-sm text-gray-500">
          {result?.error || "This invite code is not valid."}
        </p>
        <a href="/groups">
          <Button>Go to Groups</Button>
        </a>
      </div>
    </div>
  );
}
