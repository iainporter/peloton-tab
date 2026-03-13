import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  date,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  stravaId: bigint("strava_id", { mode: "number" }).notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  stravaAccessToken: text("strava_access_token").notNull(),
  stravaRefreshToken: text("strava_refresh_token").notNull(),
  stravaTokenExpiresAt: timestamp("strava_token_expires_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

export const rides = pgTable("rides", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  title: text("title"),
  autoDetected: boolean("auto_detected").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const rideRiders = pgTable(
  "ride_riders",
  {
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stravaActivityId: bigint("strava_activity_id", { mode: "number" }),
  },
  (table) => [primaryKey({ columns: [table.rideId, table.userId] })],
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  rideId: uuid("ride_id")
    .notNull()
    .references(() => rides.id, { onDelete: "cascade" }),
  paidBy: uuid("paid_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // in pence
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
