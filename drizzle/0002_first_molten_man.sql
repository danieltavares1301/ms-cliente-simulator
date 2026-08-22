CREATE TYPE "public"."scheduling_kind" AS ENUM('INITIAL', 'RETRY');--> statement-breakpoint
ALTER TABLE "scenario_run" ADD COLUMN "scheduling_kind" "scheduling_kind";--> statement-breakpoint
ALTER TABLE "scenario_run" ADD COLUMN "scheduling_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scenario_run_step" ADD COLUMN "scheduling_kind" "scheduling_kind";--> statement-breakpoint
ALTER TABLE "scenario_run_step" ADD COLUMN "scheduling_lease_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "scenario_run"
SET "scheduling_kind" = 'INITIAL',
    "scheduling_lease_expires_at" = CURRENT_TIMESTAMP
WHERE "status" = 'PROVISIONING';--> statement-breakpoint
CREATE INDEX "scenario_run_scheduling_lease_idx" ON "scenario_run" USING btree ("scheduling_kind","scheduling_lease_expires_at");--> statement-breakpoint
CREATE INDEX "scenario_run_step_scheduling_lease_idx" ON "scenario_run_step" USING btree ("run_id","scheduling_kind","scheduling_lease_expires_at");--> statement-breakpoint
ALTER TABLE "scenario_run" ADD CONSTRAINT "scenario_run_scheduling_lease_valid" CHECK (("scenario_run"."scheduling_kind" is null and "scenario_run"."scheduling_lease_expires_at" is null)
        or ("scenario_run"."scheduling_kind" = 'INITIAL' and "scenario_run"."scheduling_lease_expires_at" is not null));--> statement-breakpoint
ALTER TABLE "scenario_run_step" ADD CONSTRAINT "scenario_run_step_scheduling_lease_valid" CHECK (("scenario_run_step"."scheduling_kind" is null and "scenario_run_step"."scheduling_lease_expires_at" is null)
        or ("scenario_run_step"."scheduling_kind" = 'RETRY' and "scenario_run_step"."scheduling_lease_expires_at" is not null));