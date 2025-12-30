-- Human Action Bot Database Schema

-- Students table: stores user profiles and learning state
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    telegram_chat_id TEXT,
    display_name TEXT,
    current_chapter INTEGER DEFAULT 1,
    current_chunk INTEGER DEFAULT 0,
    pace_multiplier REAL DEFAULT 1.0,
    total_lessons_completed INTEGER DEFAULT 0,
    total_questions_answered INTEGER DEFAULT 0,
    average_comprehension_score REAL DEFAULT 0.0,
    preferred_lesson_time TEXT DEFAULT '08:00',
    timezone TEXT DEFAULT 'UTC',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Lesson history: tracks completed lessons and scores
CREATE TABLE IF NOT EXISTS lesson_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    chunk_id TEXT NOT NULL,
    lesson_type TEXT NOT NULL CHECK (lesson_type IN ('intro', 'review', 'deep_dive', 'application')),
    comprehension_score REAL,
    time_spent_seconds INTEGER,
    questions_asked INTEGER DEFAULT 0,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Conversations: stores chat history for context
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    chapter_context INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Struggle log: tracks concepts students struggle with
CREATE TABLE IF NOT EXISTS struggle_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    concept TEXT NOT NULL,
    struggle_count INTEGER DEFAULT 1,
    last_struggled_at TEXT DEFAULT (datetime('now')),
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Feedback: tracks student feedback for lessons and tutor quality
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('lesson', 'chat', 'overall')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    lesson_id TEXT,
    chapter_number INTEGER,
    tutor_version TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT,
    client_type TEXT DEFAULT 'cli',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_telegram_chat_id ON students(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_lesson_history_student_id ON lesson_history(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_history_chapter ON lesson_history(chapter_number);
CREATE INDEX IF NOT EXISTS idx_conversations_student_id ON conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_struggle_log_student_id ON struggle_log(student_id);
CREATE INDEX IF NOT EXISTS idx_struggle_log_concept ON struggle_log(concept);
CREATE INDEX IF NOT EXISTS idx_feedback_student_id ON feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tutor_version ON feedback(tutor_version);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
