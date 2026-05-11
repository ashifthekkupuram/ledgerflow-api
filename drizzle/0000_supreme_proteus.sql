CREATE TYPE "public"."account_transaction_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('bank', 'wallet', 'upi');--> statement-breakpoint
CREATE TABLE "account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" "account_transaction_type" NOT NULL,
	"description" text,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "check_transaction_amount_non_negative" CHECK ("account_transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"type" "account_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_account_name" UNIQUE("user_id","name"),
	CONSTRAINT "check_account_balance_non_negative" CHECK ("accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(15) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_tag_name_and_user_id" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_transaction_tag_id_and_account_transaction_id" UNIQUE("account_transaction_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"username" varchar(50) NOT NULL,
	"name" varchar(50),
	"password" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_account_transaction_id_account_transactions_id_fk" FOREIGN KEY ("account_transaction_id") REFERENCES "public"."account_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_date_idx" ON "account_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "account_id_and_transaction_date_idx" ON "account_transactions" USING btree ("account_id","transaction_date");--> statement-breakpoint
CREATE INDEX "account_id_and_type_idx" ON "account_transactions" USING btree ("account_id","type");--> statement-breakpoint
CREATE INDEX "account_user_id_type_idx" ON "accounts" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "tag_user_id_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_transaction_id_idx" ON "transaction_tags" USING btree ("account_transaction_id");--> statement-breakpoint
CREATE INDEX "tag_id_idx" ON "transaction_tags" USING btree ("tag_id");