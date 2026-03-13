# Epic 1: Strava Authentication

## Goal
Users can sign in with their Strava account. The app stores their profile and tokens for subsequent API access.

## Stories

### 1.1 — Strava OAuth flow
- Register app on Strava developer portal
- Implement OAuth redirect flow using NextAuth.js or Arctic
  - Scopes: `read,activity:read`
- Exchange auth code for access + refresh tokens
- Store tokens (encrypted) in `users` table
- Fetch and store athlete profile (name, avatar)

### 1.2 — Session management
- Create session cookie/JWT on successful auth
- Protect all routes except `/` and `/auth/*` behind authentication middleware
- Add sign-out functionality

### 1.3 — Token refresh
- Before any Strava API call, check `strava_token_expires_at`
- If expired, use refresh token to obtain new access token
- Update stored tokens in database
- Handle refresh failure gracefully (re-auth prompt)

### 1.4 — Auth UI
- Landing page with "Sign in with Strava" button (use Strava brand guidelines)
- Loading state during OAuth redirect
- Error handling for denied permissions or failed auth
- User avatar and name in app header when signed in

## Acceptance Criteria
- User can sign in via Strava and sees their name/avatar
- Tokens are stored encrypted in the database
- Token refresh works transparently
- Unauthenticated users are redirected to sign-in
- Sign-out clears session

## Dependencies
- Epic 0 (project setup, database schema)
