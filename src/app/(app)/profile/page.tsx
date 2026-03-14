import { auth, signOut } from "@/lib/auth";
import { Card } from "@/components/ui";
import Image from "next/image";
import Link from "next/link";
import { DisconnectStravaButton } from "./disconnect-strava-button";
import { DeleteAccountButton } from "./delete-account-button";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) return null;

  const stravaProfileUrl = `https://www.strava.com/athletes/${session.user.stravaId}`;

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
            <a
              href={stravaProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#FC5200] hover:opacity-80"
            >
              View on Strava
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
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

      <div className="pt-4 border-t border-gray-200 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Account
        </h3>
        <DisconnectStravaButton />
        <DeleteAccountButton />
      </div>

      <div className="pt-4 border-t border-gray-200 space-y-2 text-center text-xs text-gray-400">
        <Link href="/privacy" className="hover:text-gray-600 underline">
          Privacy Policy
        </Link>
        <p>
          Contact:{" "}
          <a href="mailto:support@pelotontab.com" className="hover:text-gray-600 underline">
            support@pelotontab.com
          </a>
        </p>
      </div>
    </div>
  );
}
