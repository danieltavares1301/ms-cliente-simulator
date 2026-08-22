CREATE TYPE "public"."cleanup_policy" AS ENUM('ALWAYS', 'ON_SUCCESS', 'NEVER');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('CREATED', 'PROVISIONING', 'SCHEDULED', 'RUNNING', 'WAITING_ASYNC', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLING', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."step_kind" AS ENUM('SETUP', 'DISPATCH', 'VERIFY', 'CLEANUP');--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"request_id" text NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"response_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_attempt_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "delivery_attempt_step_attempt_number_unique" UNIQUE("step_id","attempt_number"),
	CONSTRAINT "delivery_attempt_number_positive" CHECK ("delivery_attempt"."attempt_number" > 0),
	CONSTRAINT "delivery_attempt_http_status_valid" CHECK ("delivery_attempt"."http_status" is null or "delivery_attempt"."http_status" between 100 and 599),
	CONSTRAINT "delivery_attempt_duration_nonnegative" CHECK ("delivery_attempt"."duration_ms" is null or "delivery_attempt"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "graphql_callback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"request_id" text NOT NULL,
	"operation_name" text NOT NULL,
	"id_cliente_hash" text NOT NULL,
	"id_prospect_hash" text NOT NULL,
	"normalized_correlation_key_hash" text NOT NULL,
	"policy" text NOT NULL,
	"http_status" integer NOT NULL,
	"request_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphql_callback_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "graphql_callback_http_status_valid" CHECK ("graphql_callback"."http_status" between 100 and 599),
	CONSTRAINT "graphql_callback_duration_nonnegative" CHECK ("graphql_callback"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scenario_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_key" text NOT NULL,
	"scenario_version" integer NOT NULL,
	"status" "run_status" DEFAULT 'CREATED' NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"requested_by" text NOT NULL,
	"seed" integer NOT NULL,
	"variables_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"stop_on_failure" boolean DEFAULT true NOT NULL,
	"expected_callback_min" integer DEFAULT 0 NOT NULL,
	"expected_callback_max" integer DEFAULT 0 NOT NULL,
	"async_wait_deadline" timestamp with time zone,
	"cleanup_policy" "cleanup_policy" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"retention_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "scenario_run_requester_idempotency_key_unique" UNIQUE("requested_by","idempotency_key_hash"),
	CONSTRAINT "scenario_run_version_positive" CHECK ("scenario_run"."scenario_version" > 0),
	CONSTRAINT "scenario_run_callback_min_nonnegative" CHECK ("scenario_run"."expected_callback_min" >= 0),
	CONSTRAINT "scenario_run_callback_max_valid" CHECK ("scenario_run"."expected_callback_max" >= "scenario_run"."expected_callback_min")
);
--> statement-breakpoint
CREATE TABLE "scenario_run_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"ordinal" integer NOT NULL,
	"target" text NOT NULL,
	"event_type" text,
	"status" "run_status" DEFAULT 'CREATED' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"request_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"qstash_message_id" text,
	"error_code" text,
	"step_kind" "step_kind" NOT NULL,
	CONSTRAINT "scenario_run_step_run_step_key_unique" UNIQUE("run_id","step_key"),
	CONSTRAINT "scenario_run_step_run_ordinal_unique" UNIQUE("run_id","ordinal"),
	CONSTRAINT "scenario_run_step_ordinal_nonnegative" CHECK ("scenario_run_step"."ordinal" >= 0),
	CONSTRAINT "scenario_run_step_http_status_valid" CHECK ("scenario_run_step"."http_status" is null or "scenario_run_step"."http_status" between 100 and 599),
	CONSTRAINT "scenario_run_step_duration_nonnegative" CHECK ("scenario_run_step"."duration_ms" is null or "scenario_run_step"."duration_ms" >= 0),
	CONSTRAINT "scenario_run_step_attempt_count_nonnegative" CHECK ("scenario_run_step"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_attempt" ADD CONSTRAINT "delivery_attempt_step_id_scenario_run_step_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."scenario_run_step"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphql_callback" ADD CONSTRAINT "graphql_callback_run_id_scenario_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_run_step" ADD CONSTRAINT "scenario_run_step_run_id_scenario_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scenario_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_event_resource_created_at_idx" ON "audit_event" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_action_created_at_idx" ON "audit_event" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempt_step_created_at_idx" ON "delivery_attempt" USING btree ("step_id","created_at");--> statement-breakpoint
CREATE INDEX "graphql_callback_run_created_at_idx" ON "graphql_callback" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "graphql_callback_correlation_key_idx" ON "graphql_callback" USING btree ("normalized_correlation_key_hash");--> statement-breakpoint
CREATE INDEX "scenario_run_status_idx" ON "scenario_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scenario_run_retention_expires_at_idx" ON "scenario_run" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "scenario_run_step_run_status_idx" ON "scenario_run_step" USING btree ("run_id","status");