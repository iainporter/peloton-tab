CREATE TABLE "trip_rates" (
	"trip_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_rates_trip_id_currency_pk" PRIMARY KEY("trip_id","currency")
);
--> statement-breakpoint
ALTER TABLE "trip_rates" ADD CONSTRAINT "trip_rates_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;