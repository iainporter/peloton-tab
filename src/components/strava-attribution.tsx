import Image from "next/image";
import Link from "next/link";

export function StravaAttribution() {
  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
        <a
          href="https://www.strava.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/strava/api_logo_pwrdBy_strava_horiz_orange.svg"
            alt="Powered by Strava"
            width={130}
            height={13}
          />
        </a>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">
            Privacy
          </Link>
          <a href="mailto:support@pelotontab.com" className="hover:text-gray-600">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
