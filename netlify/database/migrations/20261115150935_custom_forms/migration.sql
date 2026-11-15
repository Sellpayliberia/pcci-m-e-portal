CREATE TABLE "custom_records" (
	"id" text PRIMARY KEY,
	"table_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"county" text NOT NULL,
	"city" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tables" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"fields" jsonb NOT NULL,
	"permissions" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_records" ADD CONSTRAINT "custom_records_table_id_custom_tables_id_fkey" FOREIGN KEY ("table_id") REFERENCES "custom_tables"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_records" ADD CONSTRAINT "custom_records_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id");