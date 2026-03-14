import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/groups");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="text-center px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">PelotonTab</h1>
        <p className="text-lg text-gray-600 mb-8">
          Track shared expenses on group cycling rides
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("strava", { redirectTo: "/groups" });
          }}
        >
          <button type="submit" className="transition-opacity hover:opacity-90">
            <Image
              src="/strava/btn_strava_connect_with_orange.svg"
              alt="Connect with Strava"
              width={237}
              height={48}
              priority
            />
          </button>
        </form>
        <div className="mt-12 flex flex-col items-center gap-3">
          <a
            href="https://www.strava.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/strava/api_logo_pwrdBy_strava_horiz_orange.svg"
              alt="Powered by Strava"
              width={162}
              height={16}
            />
          </a>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 underline">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
