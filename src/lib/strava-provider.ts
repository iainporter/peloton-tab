import type { OAuthConfig } from "next-auth/providers";

interface StravaProfile {
  id: number;
  firstname: string;
  lastname: string;
  profile: string; // avatar URL
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
    token: "https://www.strava.com/oauth/token",
    userinfo: "https://www.strava.com/api/v3/athlete",
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
