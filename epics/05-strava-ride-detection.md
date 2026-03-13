# Epic 5: Strava Ride Detection

## Goal
Automatically detect when group members ride together by matching Strava activities, creating rides without manual effort.

## Stories

### 5.1 — Strava webhook subscription
- Register webhook subscription with Strava (one-time setup, needs verification endpoint)
- Implement GET callback for Strava's webhook verification challenge
- Implement POST callback to receive activity events
- Store/validate subscription ID

### 5.2 — Activity fetch on webhook event
- When webhook fires for a `activity:create` event:
  - Identify the user from `owner_id` (Strava athlete ID)
  - Refresh their token if needed
  - Fetch the full activity from Strava API
  - Store key fields: start time, elapsed time, start lat/lng, strava activity ID

### 5.3 — Activity matching algorithm
- For the incoming activity, check all groups the user belongs to
- For each group, find other members' recent activities (last 24h)
- Match criteria:
  - Start times within 30 minutes of each other
  - Start locations within 1km (haversine distance)
- If matches found, create/update a ride with matched participants

### 5.4 — Auto-detected ride UX
- Auto-detected rides appear in the group feed with a "Strava" badge
- `auto_detected` = true on the ride record
- Store `strava_activity_id` on each `ride_riders` entry
- Users can still edit participants and add payments as normal

### 5.5 — Backfill on group join
- When a user joins a group, optionally check their recent Strava activities (last 7 days)
- Match against existing group members' activities
- Create any rides that would have been detected

## Acceptance Criteria
- Webhook receives and processes Strava activity events
- Matching algorithm correctly groups overlapping activities
- Auto-detected rides appear in group feed
- Users can add payments to auto-detected rides
- Participants can be manually adjusted on auto-detected rides

## Dependencies
- Epic 1 (Strava tokens for API access)
- Epic 3 (ride and payment infrastructure)
