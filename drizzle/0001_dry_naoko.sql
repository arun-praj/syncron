ALTER TABLE `room_memberships` ADD `microphone_allowed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `avatar_id` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `onboarding_completed_at` integer;--> statement-breakpoint
ALTER TABLE `rooms` ADD `media_provider` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `media_id` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `media_url` text;