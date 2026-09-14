CREATE INDEX IF NOT EXISTS "items_status_idx" ON "items" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_category_idx" ON "items" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_location_idx" ON "items" USING btree ("location");