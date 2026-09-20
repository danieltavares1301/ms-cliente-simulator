CREATE TYPE "public"."dispatch_mode" AS ENUM('FAKE', 'SALESFORCE');--> statement-breakpoint
ALTER TABLE "scenario_run" ADD COLUMN "dispatch_mode" "dispatch_mode" DEFAULT 'FAKE' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_run" ADD COLUMN "test_data_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_run_step" ADD COLUMN "lifecycle_claim_id" uuid;