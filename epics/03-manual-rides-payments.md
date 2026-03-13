# Epic 3: Manual Rides & Payments

## Goal
Group members can manually create rides, record payments, and see how expenses are split — the core expense-tracking loop without Strava integration.

## Stories

### 3.1 — Create a ride manually
- Form within a group to create a ride: date, optional title
- Select participants from group members (default: all members)
- Save to `rides` and `ride_riders` tables
- `auto_detected` = false

### 3.2 — Ride detail view
- Show ride date, title, participants
- List of payments on this ride
- Per-person share calculation displayed

### 3.3 — Add a payment to a ride
- "I paid" button on ride detail
- Enter amount (in pounds, stored as pence) and optional note
- `paid_by` = current user
- Payment appears immediately in ride detail

### 3.4 — Edit and delete payments
- Any group member can edit a payment amount/note
- Any group member can delete a payment
- Confirmation dialog for delete

### 3.5 — Edit ride participants
- Add or remove riders from an existing ride
- Recalculates per-person shares automatically

### 3.6 — Delete a ride
- Any group member can delete a ride
- Cascades to remove associated ride_riders and payments
- Confirmation dialog

## Acceptance Criteria
- Users can create rides with selected participants
- Payments can be added, edited, and deleted
- Per-person share = payment amount / number of riders on that ride
- Ride participants can be modified after creation
- Rides can be deleted

## Dependencies
- Epic 2 (group management — rides belong to groups)
