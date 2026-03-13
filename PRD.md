# PelotonTab — Product Requirements Document

## Overview

PelotonTab is a PWA that tracks shared expenses during group cycling rides. Riders authenticate via Strava, form groups, and the app automatically detects who rode together. When someone pays for the coffee stop, they log the amount and it's split across all riders present. Everyone sees a running balance of what they've paid vs what they owe.

## Problem

Groups of cycling friends take turns paying for coffee and cakes at cafe stops. There's no easy way to track who has paid what over time, leading to informal mental accounting that's often wrong and occasionally awkward.

## Solution

A lightweight app that integrates with Strava to automatically detect group rides, allows simple expense logging, and maintains a fair running balance for each group member.

## Target Users

Amateur/social cyclists who ride regularly in groups and share cafe stop expenses.

## Tech Stack

- **Frontend + Backend**: Next.js (TypeScript), deployed as a PWA
- **Database**: PostgreSQL on Neon (serverless)
- **ORM**: Drizzle
- **Auth**: Strava OAuth (via NextAuth.js or Arctic)
- **PWA**: Serwist (service worker / offline support)
- **Hosting**: Vercel (free tier)
- **CI/CD**: GitHub → Vercel auto-deploy

## Core Concepts

### Groups
A group is a set of riders who regularly ride together (e.g., "Tuesday Coffee Riders"). Users can belong to multiple groups.

### Rides
A ride represents a single group outing. Rides are auto-detected by matching Strava activities across group members using overlapping time windows and route proximity. Rides can also be created manually.

### Payments
A payment records that one rider paid a specific amount during a ride. The cost is split evenly across all participants on that ride.

### Balances
Each user has a running balance per group. Balance = (total amount they've paid) - (their share of all group payments). Positive = others owe them. Negative = they owe the group.

## V1 Features

### 1. Authentication
- Sign up / sign in via Strava OAuth
- Store Strava access token and refresh token for API access
- Basic profile pulled from Strava (name, avatar)

### 2. Group Management
- Create a group with a name
- Generate an invite code/link to share with friends
- Join a group via invite code/link
- View group members
- Leave a group

### 3. Ride Detection
- Register a Strava webhook to receive activity events
- When a new activity is uploaded by a group member, check for overlapping activities from other members of their groups
- Matching criteria: overlapping time window (start/end within reasonable tolerance) and route proximity (start location within a configurable radius)
- Auto-create a ride record with detected participants
- Rides appear in the group feed

### 4. Ride Management
- View ride details: date, participants, payments
- **Any group member can edit any ride:**
  - Add or remove riders
  - Edit payment amount
  - Delete a payment
  - Add a payment
  - Delete the ride entirely

### 5. Payment Entry
- Any rider on a ride can tap "I paid" and enter the amount
- Optional: add a note (e.g., "Costa Coffee, 4 coffees + 2 cakes")
- Payment is split evenly across all participants on that ride
- Multiple payments per ride are supported (e.g., if two people paid for different things)

### 6. Balance View
- Per-group balance summary: each member's net position
- Simple list: who's up, who's down, by how much
- Tap a member to see their payment history in the group

### 7. Activity Feed (per group)
- Chronological list of rides and payments
- Shows: date, who rode, who paid what, each person's share

## Data Model

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| strava_id | bigint | Unique, from Strava |
| name | text | From Strava profile |
| avatar_url | text | From Strava profile |
| strava_access_token | text | Encrypted |
| strava_refresh_token | text | Encrypted |
| strava_token_expires_at | timestamp | For token refresh |
| created_at | timestamp | |

### groups
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| invite_code | text | Unique, short alphanumeric |
| created_by | uuid | FK → users |
| created_at | timestamp | |

### group_members
| Column | Type | Notes |
|--------|------|-------|
| group_id | uuid | FK → groups |
| user_id | uuid | FK → users |
| joined_at | timestamp | |
| PK | | (group_id, user_id) |

### rides
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| group_id | uuid | FK → groups |
| date | date | Ride date |
| title | text | Optional, e.g., "Saturday morning ride" |
| auto_detected | boolean | Whether created by Strava webhook |
| created_at | timestamp | |

### ride_riders
| Column | Type | Notes |
|--------|------|-------|
| ride_id | uuid | FK → rides |
| user_id | uuid | FK → users |
| strava_activity_id | bigint | Nullable, for auto-detected rides |
| PK | | (ride_id, user_id) |

### payments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| ride_id | uuid | FK → rides |
| paid_by | uuid | FK → users |
| amount | integer | In pence/cents (avoid floating point) |
| note | text | Optional |
| created_at | timestamp | |
| updated_at | timestamp | |

### Balance Calculation (query, not stored)
```
Per user per group:
  credit = SUM(payments.amount) WHERE paid_by = user
  debit  = SUM(payments.amount / rider_count) for all rides user participated in
  balance = credit - debit
```

## Strava Integration Details

### OAuth Flow
1. User clicks "Sign in with Strava"
2. Redirect to Strava authorization page with scope: `read,activity:read`
3. Strava redirects back with auth code
4. Exchange code for access token + refresh token
5. Fetch athlete profile for name/avatar

### Webhook Subscription
1. Register a webhook subscription with Strava (one-time setup)
2. Strava sends POST to our callback URL when any subscribed athlete creates/updates an activity
3. On receiving a webhook event:
   - Fetch the activity details from Strava API
   - Check if the athlete is in any groups
   - For each group, check if other members have activities with overlapping time
   - If matches found, create or update a ride record

### Activity Matching Algorithm
- Two activities "match" if:
  - Start times are within 30 minutes of each other
  - Start locations are within 1km of each other (haversine distance)
- These thresholds should be configurable per group in future versions

### Token Refresh
- Strava tokens expire after 6 hours
- Before making API calls, check if token is expired
- If expired, use refresh token to get a new access token
- Update stored tokens

## Non-Functional Requirements

- **Performance**: Pages should load in under 2 seconds on 4G
- **Offline**: PWA should show cached data when offline (balances, recent rides)
- **Security**: Strava tokens encrypted at rest. No financial data beyond expense amounts.
- **Privacy**: Only show ride data to group members. No public profiles.
- **Cost**: Must run within Vercel free tier + Neon free tier for up to ~100 users

## Out of Scope for V1

- Actual money transfers / settlement
- Receipt scanning / OCR
- Cafe/location detection from GPS
- Push notifications
- Unequal splits (e.g., "I only had a coffee, they had cake")
- Currency support (assume single currency per group)
- Native mobile apps
- Strava segment or performance data
- Social features beyond the group feed

## Future Considerations (V2+)

- Push notifications when a payment is logged
- Settlement suggestions ("Alice pays Bob $12 to settle up")
- Smart cafe detection from GPS pause points
- Photo receipts
- Unequal split options
- Integration with payment apps (Venmo, Revolut, etc.)
- Multiple currencies for touring groups

## Open Questions

1. Should we support manual ride creation for people without Strava? (V1: no, Strava required)
2. How to handle latecomers who join a ride after the cafe stop? (V1: manual edit to add/remove)
3. Should deleted payments be soft-deleted for audit trail? (V1: hard delete is fine)
4. Currency: assume GBP for now, or let groups set their currency? (V1: GBP, display as pounds)
