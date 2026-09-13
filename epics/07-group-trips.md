# Epic 7: Group Trips

## Goal
Groups can create trips (e.g. a getaway to the French Alps) and track shared expenses that aren't tied to a ride — taxis, accommodation, dinners — in any currency, then settle up at the end with suggested payments.

## Decisions
- **Separate ledger** — trips have their own tables (`trips`, `trip_members`, `expenses`, `expense_participants`) and their own balances. Trip expenses do not affect group ride balances, and rides/payments are unchanged.
- **Per-expense participants** — unlike ride payments (split across all riders), each expense is split across its own participants, defaulting to all trip members.
- **Strava rides stay out of trips** — rides auto-detected during a trip remain normal group rides. Trip costs (including coffee stops) are logged as trip expenses.
- **Choose the payer** — whoever logs an expense picks who paid, defaulting to themselves.
- **Equal splits only** — unequal shares are out of scope for this epic.
- **Base currency per trip** — each trip has a base currency (default GBP). Groups and rides remain GBP.
- **Integer money** — all amounts are integer minor units (pence, cents). Splits distribute leftover units deterministically so every expense's shares sum exactly to its amount, and trip balances always net to zero.
- **Membership** — trip members must be group members, invited via the group invite code as usual. Any group member can view a trip; trip members can add expenses and settle.
- **No leaving mid-trip** — a member can't leave a group while they're on any trip in it that isn't `settled`, or delete their account while they're on any unsettled trip. They must settle up, or be removed from the trip (only possible if they aren't on any expenses).
- **Trip history outlives accounts** — deleting an account with trip history anonymises the user ("Deleted user") rather than deleting them, so settled trips keep their expenses and settlement payments. Trip tables restrict user deletion at the database level.

## Stories

### Phase 1 — Foundations

#### 7.1 — Schema
- `trips`: group, name, optional start/end dates, base currency, status (`open` | `settling` | `settled`), creator
- `trip_members`: composite PK (trip_id, user_id)
- `expenses`: trip, description, date, paid_by, original `amount` + `currency`, `rate`, `rate_source` (`base` | `trip` | `manual` | `live`), converted `base_amount`, created_by
- `expense_participants`: composite PK (expense_id, user_id)

#### 7.2 — Money utilities
- `src/lib/money.ts`: supported currencies with minor-unit decimals, `toMinor` (strict string parsing, no float maths), `formatMoney`
- `src/lib/trips.ts`: pure `splitEvenly` and `computeTripBalances`
- Vitest unit tests for both

#### 7.3 — Create and view trips
- "Trips" section on the group page with a card per trip (name, dates, total, your balance, status) and a "New trip" link
- New trip form: name, optional dates, base currency, members (all group members ticked by default; creator always included)
- Trip detail page: balances per member, date-grouped expense feed, "Add expense"

#### 7.4 — Expenses (base currency)
- Add/edit/delete expense: description, amount, date, paid by, participants
- Payer and participants must be trip members
- Expenses can only be changed while the trip is `open`

#### 7.5 — Trip settings
- Rename and change dates
- Add group members to the trip; remove members who aren't a payer or participant on any expense
- Delete trip (with confirmation)
- Leaving a group is blocked while the member is on an unsettled trip in it

### Phase 2 — Multi-currency

#### 7.6 — Trip rates
- `trip_rates` table: (trip_id, currency) → rate, where 1 unit of currency = rate × base
- Set/edit rates in trip settings; editing a rate recalculates `base_amount` for all expenses with `rate_source = 'trip'`

#### 7.7 — Foreign currency expenses
- Currency picker on the expense form with a live converted preview ("€42.00 ≈ £36.12 @ 0.86")
- Uses the trip rate by default; manual override by entering the actual base amount charged (`rate_source = 'manual'`)
- If no trip rate exists, the form requires one

#### 7.8 — Live rate pre-fill
- "Fetch today's rate" button using Frankfurter (ECB rates, no API key) to pre-fill trip or expense rates
- Purely a convenience — the user can always edit, and the app works if the service is down

### Phase 3 — Settle

#### 7.9 — Settlement suggestions
- Pure `suggestSettlements(balances)`: greedily match the largest debtor with the largest creditor (at most n−1 transfers), with unit tests
- `trip_settlements` table: from, to, amount, status (`suggested` | `paid`), paid_at
- Paid settlements count in balances: `paid − share + sent − received`

#### 7.10 — Settle flow
- "Settle" (with confirmation) moves the trip to `settling`, locks expenses, and generates suggested transfers
- Settle page lists transfers; either party can "Mark as paid"
- When all transfers are paid the trip becomes `settled` (read-only)
- "Reopen" deletes unpaid suggestions, keeps paid ones, and returns the trip to `open`
- Either party can undo a payment marked paid by mistake: while settling it becomes a suggestion again; on a reopened trip the payment record is deleted. Settled trips must be reopened first
- A trip can't be reopened if any trip member has left the group since it was settled
- Trip members can't be added or removed unless the trip is `open`

### Phase 4 — Polish

#### 7.11 — Offline expenses
- Extend the IndexedDB offline queue with expense items and add `/api/expenses/sync`
- Use cached trip rates for the converted preview when offline; queue without a rate if none is cached and resolve on sync

#### 7.12 — Integration
- Replace hard-coded `£` formatting across existing pages with `formatMoney`
- Support page FAQ for trips, currencies and settling
- `BUILDING.md` entry

## Acceptance Criteria
- A group member can create a trip, choose members, and log expenses with specific participants
- Trip balances are exact to the minor unit and always net to zero
- Expenses can be logged in a foreign currency and converted using a trip rate, manual override, or pre-filled live rate
- "Settle" produces at most n−1 suggested transfers which, once marked paid, bring every balance to zero
- Settled trips are read-only; reopening allows late expenses
- Ride balances and Strava ride detection are unaffected

## Dependencies
- Epic 2 (groups and membership)
- Epic 4 (balance display patterns)
- Epic 6 (offline queue, for 7.11)
