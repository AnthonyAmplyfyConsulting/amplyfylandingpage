CREATE TABLE `game_rounds` (
 `id` text PRIMARY KEY NOT NULL,
 `state` text NOT NULL,
 `version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
 `key` text PRIMARY KEY NOT NULL,
 `window` integer NOT NULL,
 `count` integer NOT NULL
);
