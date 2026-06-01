CREATE TYPE "public"."english_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."native_language" AS ENUM('spanish', 'portuguese', 'french', 'italian', 'german', 'other');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('setup', 'active', 'completed', 'analyzed');--> statement-breakpoint
CREATE TABLE "conversation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'setup' NOT NULL,
	"english_level" "english_level" NOT NULL,
	"topic" text NOT NULL,
	"target_turns" integer DEFAULT 10 NOT NULL,
	"completed_turns" integer DEFAULT 0 NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_language_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"native_language" "native_language" DEFAULT 'spanish' NOT NULL,
	"english_level" "english_level" DEFAULT 'A1' NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_language_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_language_profiles" ADD CONSTRAINT "user_language_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;