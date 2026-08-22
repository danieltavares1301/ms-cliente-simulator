CREATE TYPE "public"."step_status" AS ENUM('PENDING', 'SCHEDULED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED');--> statement-breakpoint
ALTER TABLE "scenario_run_step" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scenario_run_step" ALTER COLUMN "status" SET DATA TYPE "public"."step_status" USING (
	CASE "status"::text
		WHEN 'CREATED' THEN 'PENDING'
		WHEN 'PROVISIONING' THEN 'PENDING'
		WHEN 'SCHEDULED' THEN 'SCHEDULED'
		WHEN 'RUNNING' THEN 'RUNNING'
		WHEN 'WAITING_ASYNC' THEN 'RUNNING'
		WHEN 'VERIFYING' THEN 'RUNNING'
		WHEN 'SUCCEEDED' THEN 'SUCCEEDED'
		WHEN 'FAILED' THEN 'FAILED'
		WHEN 'PARTIAL' THEN 'FAILED'
		WHEN 'CANCELLING' THEN 'RUNNING'
		WHEN 'CANCELLED' THEN 'CANCELLED'
	END
)::"public"."step_status";--> statement-breakpoint
ALTER TABLE "scenario_run_step" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "scenario_run" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
UPDATE "scenario_run" SET "request_fingerprint" = 'legacy:' || "id"::text WHERE "request_fingerprint" IS NULL;--> statement-breakpoint
ALTER TABLE "scenario_run" ALTER COLUMN "request_fingerprint" SET NOT NULL;