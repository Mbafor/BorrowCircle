ALTER TYPE "public"."notification_target_type" ADD VALUE 'USER';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'ACCOUNT_SUSPENDED';--> statement-breakpoint
ALTER TABLE "borrow_requests" ADD COLUMN "returned_at" timestamp with time zone;