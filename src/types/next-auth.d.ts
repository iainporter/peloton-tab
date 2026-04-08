import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      stravaId: number;
      name: string;
      image: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    stravaId?: number;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
