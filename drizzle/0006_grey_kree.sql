CREATE TABLE "conversation_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"encouragement" text NOT NULL,
	"weak_points" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"weak_point_id" text NOT NULL,
	"theory" jsonb NOT NULL,
	"exercises" jsonb NOT NULL,
	"score" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_analyses" ADD CONSTRAINT "conversation_analyses_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_analyses" ADD CONSTRAINT "conversation_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_analysis_id_conversation_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."conversation_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_analyses_session_user_idx" ON "conversation_analyses" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "exercise_sets_analysis_weak_point_idx" ON "exercise_sets" USING btree ("analysis_id","weak_point_id");--> statement-breakpoint
CREATE INDEX "exercise_sets_user_idx" ON "exercise_sets" USING btree ("user_id");