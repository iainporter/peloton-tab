# Epic 6: PWA & Offline Support

## Goal
The app works well as an installed PWA and shows useful cached data when offline.

## Stories

### 6.1 — Offline data caching
- Cache the user's groups, balances, and recent rides for offline viewing
- Use Serwist's runtime caching strategies
- Show a clear "offline" indicator when not connected

### 6.2 — Offline payment queuing
- Allow users to log a payment while offline
- Queue the payment and sync when connection is restored
- Show pending/syncing state on queued payments

### 6.3 — App install experience
- Ensure web app manifest is complete (icons, splash screens, theme)
- Test "Add to Home Screen" on iOS Safari and Android Chrome
- App opens in standalone mode without browser chrome

### 6.4 — Performance optimisation
- Target < 2 second load on 4G
- Optimise bundle size
- Pre-cache critical assets via service worker

## Acceptance Criteria
- App is installable as PWA on iOS and Android
- Cached data visible offline (groups, balances, recent rides)
- Payments can be queued offline and sync later
- Page load under 2 seconds on 4G
- Clear offline/online state indicators

## Dependencies
- Epics 0–4 (need a functional app to cache)
