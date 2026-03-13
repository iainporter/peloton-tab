CREATE TABLE "strava_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"strava_activity_id" bigint NOT NULL,
	"title" text,
	"start_date" timestamp with time zone NOT NULL,
	"elapsed_time" integer,
	"start_lat" text,
	"start_lng" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strava_activities_strava_activity_id_unique" UNIQUE("strava_activity_id")
);
--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;