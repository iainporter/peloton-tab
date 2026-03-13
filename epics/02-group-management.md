# Epic 2: Group Management

## Goal
Users can create groups, invite friends via a shareable code/link, and manage group membership.

## Stories

### 2.1 — Create a group
- Form to create a group with a name
- Generate a unique short alphanumeric invite code
- Creator is automatically added as a member
- Redirect to group page after creation

### 2.2 — Join a group
- "Join Group" page accepting an invite code
- Also support joining via a shareable link (`/join/[code]`)
- Validate code exists, prevent duplicate membership
- Add user to `group_members`

### 2.3 — Group list view
- Show all groups the user belongs to
- Display group name, member count, and user's current balance (placeholder for now)
- This is the main "home" screen after sign-in

### 2.4 — Group detail view
- Show group name, invite code (with copy/share button)
- List of members with avatars and names
- Placeholder sections for rides feed and balances

### 2.5 — Leave a group
- "Leave Group" option in group settings
- Confirm before leaving
- Remove from `group_members`

## Acceptance Criteria
- Users can create groups and see them listed
- Invite code can be shared and used to join
- Group detail shows all members
- Users can leave groups
- Cannot join same group twice

## Dependencies
- Epic 1 (authentication — need signed-in users)
