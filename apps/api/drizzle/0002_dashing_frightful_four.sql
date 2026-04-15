-- Safe when case_ref unique was never created (e.g. drizzle-kit push) or already dropped.
ALTER TABLE "debtors" DROP CONSTRAINT IF EXISTS "debtors_case_ref_unique";--> statement-breakpoint
ALTER TABLE "enriched_fields" DROP CONSTRAINT IF EXISTS "enriched_fields_name_check";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'debtors_org_case_ref_unique'
  ) THEN
    ALTER TABLE "debtors" ADD CONSTRAINT "debtors_org_case_ref_unique" UNIQUE ("org_id", "case_ref");
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enriched_fields_name_check'
  ) THEN
    ALTER TABLE "enriched_fields" ADD CONSTRAINT "enriched_fields_name_check" CHECK ("enriched_fields"."field_name" IN ('phone', 'address', 'employer', 'assets', 'social_media_hints', 'income_bracket', 'email', 'tax_id'));
  END IF;
END $$;
