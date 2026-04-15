CREATE TABLE "debtors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_ref" text NOT NULL,
	"org_id" uuid NOT NULL,
	"assigned_to" text,
	"debtor_name" text NOT NULL,
	"country" text NOT NULL,
	"debt_amount" numeric(12, 2) NOT NULL,
	"call_outcome" text DEFAULT 'unknown' NOT NULL,
	"legal_outcome" text DEFAULT 'unknown' NOT NULL,
	"case_status" text DEFAULT 'new' NOT NULL,
	"enrichment_status" text DEFAULT 'pending' NOT NULL,
	"enrichment_confidence" real,
	"leverage_score" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debtors_case_ref_unique" UNIQUE("case_ref"),
	CONSTRAINT "debtors_case_status_check" CHECK ("debtors"."case_status" IN ('new', 'reviewing', 'called', 'negotiating', 'payment_plan', 'settled', 'unresponsive', 'legal')),
	CONSTRAINT "debtors_enrichment_status_check" CHECK ("debtors"."enrichment_status" IN ('pending', 'running', 'complete', 'failed')),
	CONSTRAINT "debtors_leverage_check" CHECK ("debtors"."leverage_score" IN ('none', 'low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE TABLE "enriched_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debtor_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enriched_fields_debtor_field_uniq" UNIQUE("debtor_id","field_name"),
	CONSTRAINT "enriched_fields_name_check" CHECK ("enriched_fields"."field_name" IN ('phone', 'address', 'employer', 'assets', 'social_media_hints', 'income_bracket'))
);
--> statement-breakpoint
CREATE TABLE "field_trace_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_trace_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enriched_field_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"agent_name" text NOT NULL,
	"action" text NOT NULL,
	"reasoning" text NOT NULL,
	"finding" text,
	"confidence" text DEFAULT 'none' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "field_trace_steps_confidence_check" CHECK ("field_trace_steps"."confidence" IN ('high', 'medium', 'low', 'none'))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'collector' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_org_user_uniq" UNIQUE("org_id","user_id"),
	CONSTRAINT "members_role_check" CHECK ("members"."role" IN ('admin', 'collector', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debtor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"author" text NOT NULL,
	CONSTRAINT "status_events_status_check" CHECK ("status_events"."status" IN ('new', 'reviewing', 'called', 'negotiating', 'payment_plan', 'settled', 'unresponsive', 'legal'))
);
--> statement-breakpoint
ALTER TABLE "debtors" ADD CONSTRAINT "debtors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtors" ADD CONSTRAINT "debtors_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enriched_fields" ADD CONSTRAINT "enriched_fields_debtor_id_debtors_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_trace_sources" ADD CONSTRAINT "field_trace_sources_step_id_field_trace_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."field_trace_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_trace_steps" ADD CONSTRAINT "field_trace_steps_enriched_field_id_enriched_fields_id_fk" FOREIGN KEY ("enriched_field_id") REFERENCES "public"."enriched_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_debtor_id_debtors_id_fk" FOREIGN KEY ("debtor_id") REFERENCES "public"."debtors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debtors_org_status_idx" ON "debtors" USING btree ("org_id","case_status");--> statement-breakpoint
CREATE INDEX "debtors_org_country_idx" ON "debtors" USING btree ("org_id","country");--> statement-breakpoint
CREATE INDEX "debtors_org_enrichment_idx" ON "debtors" USING btree ("org_id","enrichment_status");--> statement-breakpoint
CREATE INDEX "field_trace_steps_field_step_idx" ON "field_trace_steps" USING btree ("enriched_field_id","step_number");--> statement-breakpoint
CREATE INDEX "status_events_debtor_time_idx" ON "status_events" USING btree ("debtor_id","occurred_at");