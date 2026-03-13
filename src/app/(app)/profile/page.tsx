import { auth, signOut } from "@/lib/auth";
import { Card } from "@/components/ui";
import Image from "next/image";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) return null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || "Avatar"}
              width={64}
              height={64}
              className="rounded-full"
            />
          )}
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {session.user.name}
            </h2>
            <p className="text-sm text-gray-500">Connected via Strava</p>
          </div>
        </div>
      </Card>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
