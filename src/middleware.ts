export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/groups/:path*",
    "/rides/:path*",
    "/profile/:path*",
  ],
};
