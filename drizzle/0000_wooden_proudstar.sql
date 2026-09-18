CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `room_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`leave_reason` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "membership_role" CHECK("room_memberships"."role" IN ('HOST','MEMBER')),
	CONSTRAINT "membership_reason" CHECK("room_memberships"."leave_reason" IS NULL OR "room_memberships"."leave_reason" IN ('LEFT','KICKED','ROOM_ENDED','DISCONNECTED_TIMEOUT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_active` ON `room_memberships` (`room_id`,`user_id`) WHERE "room_memberships"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX `membership_room` ON `room_memberships` (`room_id`,`joined_at`);--> statement-breakpoint
CREATE INDEX `membership_user` ON `room_memberships` (`user_id`,`joined_at`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`creator_user_id` text NOT NULL,
	`host_user_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`invite_version` integer DEFAULT 1 NOT NULL,
	`everyone_can_control` integer DEFAULT true NOT NULL,
	`max_participants` integer DEFAULT 25 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`creator_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`host_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "room_status" CHECK("rooms"."status" IN ('ACTIVE','ENDED')),
	CONSTRAINT "room_capacity" CHECK("rooms"."max_participants"=25),
	CONSTRAINT "room_invite_version" CHECK("rooms"."invite_version">=1),
	CONSTRAINT "room_end" CHECK(("rooms"."status"='ENDED')=("rooms"."ended_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `room_host` ON `rooms` (`host_user_id`);--> statement-breakpoint
CREATE INDEX `room_creator` ON `rooms` (`creator_user_id`);--> statement-breakpoint
CREATE INDEX `room_status_created` ON `rooms` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier` ON `verification` (`identifier`);