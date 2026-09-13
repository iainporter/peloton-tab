import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  date,
  boolean,
  integer,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  stravaId: bigint("strava_id", { mode: "number" }).unique(), // null once the account is deleted
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  stravaAccessToken: text("strava_access_token").notNull(),
  stravaRefreshToken: text("strava_refresh_token").notNull(),
  stravaTokenExpiresAt: timestamp("strava_token_expires_at", {
    withTimezone: true,
  }).notNull(),
  // Set when a user with trip history deletes their account: the row is
  // anonymised and kept so trip expenses and settlements stay intact
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
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

export const stravaActivities = pgTable("strava_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stravaActivityId: bigint("strava_activity_id", { mode: "number" })
    .notNull()
    .unique(),
  title: text("title"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  elapsedTime: integer("elapsed_time"), // seconds
  startLat: text("start_lat"), // stored as text to avoid float precision issues
  startLng: text("start_lng"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

export type TripStatus = "open" | "settling" | "settled";

export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  baseCurrency: text("base_currency").default("GBP").notNull(), // ISO 4217
  status: text("status").$type<TripStatus>().default("open").notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    // Trip tables restrict user deletion — deleted accounts are anonymised instead
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.tripId, table.userId] })],
);

export const tripRates = pgTable(
  "trip_rates",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(), // ISO 4217
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(), // 1 unit of currency = rate × trip base currency
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.tripId, table.currency] })],
);

export type RateSource = "base" | "trip" | "manual" | "live";

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  date: date("date").notNull(),
  paidBy: uuid("paid_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(), // minor units of `currency`
  currency: text("currency").notNull(), // ISO 4217
  rate: numeric("rate", { precision: 18, scale: 8 }).default("1").notNull(), // 1 unit of currency = rate × trip base currency
  rateSource: text("rate_source")
    .$type<RateSource>()
    .default("base")
    .notNull(),
  baseAmount: integer("base_amount").notNull(), // minor units of trip base currency
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const expenseParticipants = pgTable(
  "expense_participants",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.expenseId, table.userId] })],
);

export type SettlementStatus = "suggested" | "paid";

export const tripSettlements = pgTable("trip_settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(), // minor units of trip base currency
  status: text("status").$type<SettlementStatus>().default("suggested").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
