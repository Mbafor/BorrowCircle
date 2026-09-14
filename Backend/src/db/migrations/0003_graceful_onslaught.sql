CREATE TYPE "public"."borrow_request_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'BORROWED', 'RETURNED', 'OVERDUE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "borrow_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"borrower_id" uuid NOT NULL,
	"pickup_date" date NOT NULL,
	"return_date" date NOT NULL,
	"message" text,
	"pickup_code" varchar(32),
	"return_code" varchar(32),
	"status" "borrow_request_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "borrow_requests_item_id_idx" ON "borrow_requests" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "borrow_requests_borrower_id_idx" ON "borrow_requests" USING btree ("borrower_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "borrow_requests_one_pending_per_item_borrower" ON "borrow_requests" USING btree ("item_id","borrower_id") WHERE "borrow_requests"."status" = 'PENDING';