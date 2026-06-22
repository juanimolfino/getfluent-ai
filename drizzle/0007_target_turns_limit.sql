ALTER TABLE "conversation_sessions" ALTER COLUMN "target_turns" SET DEFAULT 8;--> statement-breakpoint
UPDATE "conversation_sessions" SET "target_turns" = 8 WHERE "target_turns" > 8;--> statement-breakpoint
UPDATE "conversation_sessions" SET "target_turns" = 4 WHERE "target_turns" < 4;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_target_turns_range_check" CHECK ("target_turns" >= 4 AND "target_turns" <= 8);
