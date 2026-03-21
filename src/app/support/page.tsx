import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Support</h1>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Contact Us</h2>
            <p>
              For help, questions, or to report an issue, email us at{" "}
              <a
                href="mailto:support@pelotontab.com"
                className="text-[#FC5200] font-bold hover:opacity-80"
              >
                support@pelotontab.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">FAQs</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">How do I join a group?</h3>
                <p className="mt-1">
                  Ask a group member for the invite code, then tap &quot;Join
                  Group&quot; on the Groups page and enter it.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">How are rides detected automatically?</h3>
                <p className="mt-1">
                  When you upload a ride to Strava, PelotonTab checks if any of
                  your group members rode at the same time and place (within 30
                  minutes and 1km). If so, a shared ride is created
                  automatically. These rides appear with a &quot;Strava&quot;
                  badge in your group&apos;s activity feed.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">My ride isn&apos;t showing up — what can I do?</h3>
                <p className="mt-1">
                  Strava webhook notifications can be delayed by several minutes
                  or longer. Tap &quot;Sync Strava&quot; on the group page to
                  manually pull your recent rides. This fetches your last 7 days
                  of activities and re-runs the matching algorithm.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">A rider is missing from a ride — can I add them?</h3>
                <p className="mt-1">
                  Yes. Open the ride from the group&apos;s activity feed and tap
                  &quot;Add rider&quot; next to the riders list. You&apos;ll see
                  all group members who aren&apos;t already on the ride — tap a
                  name to add them. This is useful when Strava sync missed
                  someone or they didn&apos;t upload their ride.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">Why did my ride sync but no group ride was created?</h3>
                <p className="mt-1">
                  Auto-detected rides require at least two group members to have
                  matching activities. If your riding partner hasn&apos;t synced
                  yet, ask them to tap &quot;Sync Strava&quot; on the group page
                  too. Once both activities are synced, the match will be found.
                  You can also always log a ride manually.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">What does the Rides page show?</h3>
                <p className="mt-1">
                  The Rides tab shows all rides across every group you belong to,
                  sorted by most recent first. Each card shows the ride title or
                  date, which group it belongs to, who rode, and any payments
                  logged. Tap a ride to see its full details.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">How are expenses split?</h3>
                <p className="mt-1">
                  When someone logs a payment against a ride, the cost is split
                  equally across all riders on that ride. The app keeps a running
                  balance per group.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">How do I disconnect my Strava account?</h3>
                <p className="mt-1">
                  Go to your Profile page and tap &quot;Disconnect Strava&quot;.
                  This revokes PelotonTab&apos;s access on Strava&apos;s side.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">How do I delete my account?</h3>
                <p className="mt-1">
                  Go to your Profile page and tap &quot;Delete Account&quot;.
                  This permanently removes all your data including group
                  memberships, rides, and payment history.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900">What Strava data does PelotonTab access?</h3>
                <p className="mt-1">
                  Your name, profile photo, and activity metadata (start time,
                  start location, elapsed time). Activity data is used only to
                  match riders on the same ride. See our{" "}
                  <Link href="/privacy" className="text-[#FC5200] font-bold hover:opacity-80">
                    Privacy Policy
                  </Link>{" "}
                  for full details.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
