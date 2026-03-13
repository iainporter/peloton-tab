import type { OAuthConfig } from "next-auth/providers";

interface StravaProfile {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  profile_medium: string;
}

export default function Strava(): OAuthConfig<StravaProfile> {
  return {
    id: "strava",
    name: "Strava",
    type: "oauth",
    authorization: {
      url: "https://www.strava.com/oauth/authorize",
      params: {
        scope: "read,activity:read",
        response_type: "code",
        approval_prompt: "auto",
      },
    },
    token: {
      url: "https://www.strava.com/oauth/token",
      async conform(response: Response) {
        // Strava returns a non-standard token response with `athlete` embedded.
        // We need to ensure it has the right shape for NextAuth.
        return response;
      },
    },
    userinfo: {
      url: "https://www.strava.com/api/v3/athlete",
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const response = await fetch("https://www.strava.com/api/v3/athlete", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Strava userinfo failed: ${response.status}`);
        }
        return await response.json();
      },
    },
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    profile(profile) {
      return {
        id: String(profile.id),
        name: `${profile.firstname} ${profile.lastname}`,
        image: profile.profile_medium || profile.profile,
      };
    },
  };
}
