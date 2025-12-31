CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`chapter_context` integer,
	`created_at` text DEFAULT 'datetime(''now'')',
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_student_id` ON `conversations` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_created_at` ON `conversations` (`created_at`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`feedback_type` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`lesson_id` text,
	`chapter_number` integer,
	`tutor_version` text NOT NULL,
	`model_name` text NOT NULL,
	`model_version` text,
	`client_type` text DEFAULT 'cli',
	`created_at` text DEFAULT 'datetime(''now'')',
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_student_id` ON `feedback` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_feedback_tutor_version` ON `feedback` (`tutor_version`);--> statement-breakpoint
CREATE INDEX `idx_feedback_rating` ON `feedback` (`rating`);--> statement-breakpoint
CREATE TABLE `lesson_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`chapter_number` integer NOT NULL,
	`chunk_id` text NOT NULL,
	`lesson_type` text NOT NULL,
	`comprehension_score` real,
	`time_spent_seconds` integer,
	`questions_asked` integer DEFAULT 0,
	`completed_at` text DEFAULT 'datetime(''now'')',
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_lesson_history_student_id` ON `lesson_history` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_lesson_history_chapter` ON `lesson_history` (`chapter_number`);--> statement-breakpoint
CREATE TABLE `struggle_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`chapter_number` integer NOT NULL,
	`concept` text NOT NULL,
	`struggle_count` integer DEFAULT 1,
	`last_struggled_at` text DEFAULT 'datetime(''now'')',
	`resolved` integer DEFAULT false,
	`resolution_notes` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_struggle_log_student_id` ON `struggle_log` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_struggle_log_concept` ON `struggle_log` (`concept`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`telegram_chat_id` text,
	`display_name` text,
	`current_chapter` integer DEFAULT 1,
	`current_chunk` integer DEFAULT 0,
	`pace_multiplier` real DEFAULT 1,
	`total_lessons_completed` integer DEFAULT 0,
	`total_questions_answered` integer DEFAULT 0,
	`average_comprehension_score` real DEFAULT 0,
	`preferred_lesson_time` text DEFAULT '08:00',
	`timezone` text DEFAULT 'UTC',
	`created_at` text DEFAULT 'datetime(''now'')',
	`updated_at` text DEFAULT 'datetime(''now'')'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_user_id_unique` ON `students` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_students_user_id` ON `students` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_students_telegram_chat_id` ON `students` (`telegram_chat_id`);