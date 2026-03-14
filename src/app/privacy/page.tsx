import Link from "next/link";

export default function PrivacyPolicy() {
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

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">What We Collect</h2>
            <p>
              When you sign in with Strava, we collect your name, profile photo,
              and Strava athlete ID. We also access your recent ride activities
              to automatically detect group rides.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name and photo are shown to other members of groups you join</li>
              <li>Ride activity data (start time, location) is used to match riders who rode together</li>
              <li>Payment records track shared expenses within your groups</li>
              <li>We do not sell, license, or share your data with third parties</li>
              <li>We do not use your data for advertising, analytics, or AI/ML training</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Strava Data</h2>
            <p>
              This application uses the Strava API but is not endorsed or
              certified by Strava. Your Strava activity data is used solely for
              ride detection within your groups. We cache Strava profile images
              for up to 7 days. You can disconnect your Strava account at any
              time from your profile page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Data Storage & Security</h2>
            <p>
              Your data is stored in a secure PostgreSQL database hosted on Neon.
              OAuth tokens are encrypted at rest and transmitted only over HTTPS.
              Access tokens are automatically refreshed and never exposed to
              other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Your Rights</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Access:</strong> View all your data on your profile and
                group pages
              </li>
              <li>
                <strong>Disconnect:</strong> Revoke Strava access from your
                profile page — this deauthorises PelotonTab on Strava{"'"}s side
              </li>
              <li>
                <strong>Delete:</strong> Delete your account and all associated
                data from your profile page. Deletions are processed immediately
              </li>
              <li>
                <strong>Withdraw consent:</strong> You can revoke access at any
                time by disconnecting Strava or deleting your account
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you
              delete your account, all your personal data, group memberships,
              ride records, and payment history are permanently deleted. Strava
              activity data cached for ride detection is also removed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Contact</h2>
            <p>
              For questions about your data or this privacy policy, contact us at{" "}
              <a
                href="mailto:support@pelotontab.com"
                className="text-orange-600 hover:text-orange-700 underline"
              >
                support@pelotontab.com
              </a>
              .
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-200">
            Last updated: March 2026
          </p>
        </div>
      </div>
    </div>
  );
}
