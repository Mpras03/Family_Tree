CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`nickname` text,
	`phonenumber` text,
	`birth_date` text,
	`death_date` text,
	`gender` text NOT NULL,
	`photo_key` text,
	`bio` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`related_member_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
