# Epic 4: Balances & Activity Feed

## Goal
Each group shows a clear balance summary and a chronological activity feed, giving users visibility into who owes what.

## Stories

### 4.1 — Balance calculation
- Implement the balance query per user per group:
  - `credit` = sum of payments made by user
  - `debit` = sum of (payment amount / rider count) for all rides user participated in
  - `balance` = credit - debit
- Create a server-side utility/API for this calculation

### 4.2 — Balance summary view
- Per-group screen showing all members and their net balance
- Positive balance (green): others owe them
- Negative balance (red): they owe the group
- Display in GBP (£) format

### 4.3 — Member payment history
- Tap a member in the balance view to see their payment history in the group
- List of payments they've made and rides they've participated in

### 4.4 — Activity feed (per group)
- Chronological list of rides and payments within a group
- Each entry shows: date, who rode, who paid what, per-person share
- Newest first

### 4.5 — Group list balance preview
- On the home screen group list (Epic 2.3), show the user's balance for each group
- Quick visual indicator (up/down/even)

## Acceptance Criteria
- Balance calculation is accurate across multiple rides and payments
- Balance view clearly shows who's up and who's down
- Activity feed shows complete history
- Group list shows balance preview
- All amounts displayed in GBP (£)

## Dependencies
- Epic 3 (rides and payments data must exist)
