CREATE TABLE "training_workspaces" (
	"user_id" text PRIMARY KEY,
	"reports" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training_workspaces" ADD CONSTRAINT "training_workspaces_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");