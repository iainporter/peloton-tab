import type { OAuthConfig } from "next-auth/providers";

interface StravaProfile {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  profile_medium: string;
}

export default function Strava(): OAuthConfig<StravaProfile> {
  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;

  return {
    id: "strava",
    name: "Strava",
    type: "oauth",
    clientId,
    clientSecret,
    authorization: {
      url: "https://www.strava.com/oauth/authorize",
      params: {
        scope: "read,activity:read",
        response_type: "code",
        approval_prompt: "auto",
      },
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    token: {
      url: "https://www.strava.com/oauth/token",
      async conform(response: Response) {
        // Strava returns `athlete` in the token response which confuses
        // NextAuth's parser. Strip it and keep only OAuth fields.
        const json = await response.json();
        const { athlete, ...oauthFields } = json;
        return new Response(JSON.stringify(oauthFields), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    userinfo: {
      url: "https://www.strava.com/api/v3/athlete",
      async request({ tokens }: { tokens: { access_token?: string } }) {
        const res = await fetch("https://www.strava.com/api/v3/athlete", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        return await res.json();
      },
    },
    profile(profile) {
      return {
        id: String(profile.id),
        name: `${profile.firstname} ${profile.lastname}`,
        image: profile.profile_medium || profile.profile,
      };
    },
  };
}
