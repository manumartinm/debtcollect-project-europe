ALTER TABLE "debtors" DROP CONSTRAINT "debtors_enrichment_status_check";--> statement-breakpoint
UPDATE "debtors" SET "enrichment_status" = 'not_started' WHERE "enrichment_status" = 'pending';--> statement-breakpoint
ALTER TABLE "debtors" ALTER COLUMN "enrichment_status" SET DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "debtors" ADD CONSTRAINT "debtors_enrichment_status_check" CHECK ("debtors"."enrichment_status" IN ('not_started', 'pending', 'running', 'complete', 'failed'));