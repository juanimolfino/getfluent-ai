ALTER TABLE "credits" ADD COLUMN "credits_subscription" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credits" ADD COLUMN "credits_pack" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "credits" SET "credits_pack" = "balance", "credits_subscription" = 0;--> statement-breakpoint
ALTER TABLE "credits" DROP COLUMN "balance";
