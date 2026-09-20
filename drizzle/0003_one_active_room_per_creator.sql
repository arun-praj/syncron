CREATE UNIQUE INDEX `active_room_creator` ON `rooms` (`creator_user_id`) WHERE `status` = 'ACTIVE';
--> statement-breakpoint
CREATE UNIQUE INDEX `active_room_host` ON `rooms` (`host_user_id`) WHERE `status` = 'ACTIVE';
