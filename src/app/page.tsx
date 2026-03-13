import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

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
          <button
            type="submit"
            className="inline-flex items-center gap-3 rounded-lg bg-[#FC4C02] px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#e04402] transition-colors"
          >
            <StravaLogo />
            Sign in with Strava
          </button>
        </form>
      </main>
    </div>
  );
}

function StravaLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
