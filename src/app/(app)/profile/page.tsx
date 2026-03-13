import { Card } from "@/components/ui";

export default function ProfilePage() {
  return (
    <Card>
      <h2 className="text-lg font-medium text-gray-900">Profile</h2>
      <p className="mt-1 text-sm text-gray-500">
        Sign in with Strava to see your profile.
      </p>
    </Card>
  );
}
