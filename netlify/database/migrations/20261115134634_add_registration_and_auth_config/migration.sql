CREATE TABLE "auth_config" (
	"id" text PRIMARY KEY,
	"signing_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_status" text DEFAULT 'Approved' NOT NULL;