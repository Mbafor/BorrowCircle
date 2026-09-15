CREATE TYPE "public"."notification_target_type" AS ENUM('ITEM', 'BORROW_REQUEST');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('REQUEST_SENT', 'REQUEST_ACCEPTED', 'REQUEST_DECLINED', 'REQUEST_CANCELLED', 'REQUEST_EXPIRED', 'ITEM_CANCELLED', 'HANDOVER_CONFIRMED', 'RETURN_CONFIRMED', 'OVERDUE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"target_type" "notification_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications" USING btree ("user_id","is_read");