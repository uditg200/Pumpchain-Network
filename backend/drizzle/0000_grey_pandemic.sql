CREATE TABLE IF NOT EXISTS "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(44) NOT NULL,
	"account_type" varchar(32) DEFAULT 'user' NOT NULL,
	"balance" numeric(78, 0) DEFAULT '0' NOT NULL,
	"nonce" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"block_number" integer NOT NULL,
	"block_hash" varchar(64) NOT NULL,
	"parent_hash" varchar(64) NOT NULL,
	"state_root" varchar(64) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"sequencer" varchar(44) NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"gas_used" integer DEFAULT 0 NOT NULL,
	"gas_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bridge_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bridge_tx_id" varchar(36) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"source_chain" varchar(32) NOT NULL,
	"destination_chain" varchar(32) NOT NULL,
	"source_tx_hash" varchar(88),
	"destination_tx_hash" varchar(64),
	"wallet_address" varchar(44) NOT NULL,
	"asset" varchar(16) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faucet_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" varchar(44) NOT NULL,
	"asset" varchar(16) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"claim_timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"cooldown_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "network_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_name" varchar(128) NOT NULL,
	"chain_id" varchar(64) NOT NULL,
	"environment" varchar(32) NOT NULL,
	"native_token_symbol" varchar(16) NOT NULL,
	"genesis_hash" varchar(64) NOT NULL,
	"current_block_height" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_metadata_chain_id_unique" UNIQUE("chain_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "network_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"block_height" integer NOT NULL,
	"tps" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"active_accounts" integer DEFAULT 0 NOT NULL,
	"gas_used" numeric(78, 0) DEFAULT '0' NOT NULL,
	"total_gas_fees" numeric(78, 0) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sequencer_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"block_number" integer,
	"event_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "token_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(44) NOT NULL,
	"token_symbol" varchar(16) NOT NULL,
	"token_mint" varchar(44) NOT NULL,
	"balance" numeric(78, 0) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" varchar(64) NOT NULL,
	"block_number" integer,
	"sender" varchar(44) NOT NULL,
	"recipient" varchar(44) NOT NULL,
	"amount" numeric(78, 0) DEFAULT '0' NOT NULL,
	"gas_limit" integer NOT NULL,
	"gas_used" integer DEFAULT 0 NOT NULL,
	"gas_price" integer NOT NULL,
	"fee" numeric(78, 0) DEFAULT '0' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"nonce" integer NOT NULL,
	"input_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_address_idx" ON "accounts" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blocks_block_number_idx" ON "blocks" USING btree ("block_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "blocks_block_hash_idx" ON "blocks" USING btree ("block_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocks_timestamp_idx" ON "blocks" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bridge_transactions_bridge_tx_id_idx" ON "bridge_transactions" USING btree ("bridge_tx_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bridge_transactions_wallet_address_idx" ON "bridge_transactions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bridge_transactions_status_idx" ON "bridge_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faucet_claims_wallet_address_idx" ON "faucet_claims" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faucet_claims_ip_hash_idx" ON "faucet_claims" USING btree ("ip_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faucet_claims_cooldown_idx" ON "faucet_claims" USING btree ("cooldown_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "network_metrics_timestamp_idx" ON "network_metrics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "network_metrics_block_height_idx" ON "network_metrics" USING btree ("block_height");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sequencer_events_event_type_idx" ON "sequencer_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sequencer_events_block_number_idx" ON "sequencer_events" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sequencer_events_created_at_idx" ON "sequencer_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "token_balances_address_token_idx" ON "token_balances" USING btree ("address","token_mint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balances_address_idx" ON "token_balances" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_tx_hash_idx" ON "transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_sender_idx" ON "transactions" USING btree ("sender");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_recipient_idx" ON "transactions" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_block_number_idx" ON "transactions" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" USING btree ("created_at");