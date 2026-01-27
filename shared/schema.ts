
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Participants: Identified by name and device fingerprint
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Unique constraint enforced via logic/index if needed, or composite with deviceId
  deviceId: text("device_id").notNull(), // Bound to the browser/device
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

// Admin Users
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(), // Hashed
});

// Questions: Daily questions
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  options: jsonb("options").notNull(), // Array of strings or objects {id, text}
  correctAnswerIndex: integer("correct_answer_index").notNull(),
  quizDate: text("quiz_date").notNull(), // YYYY-MM-DD format to easily query "today's" question
  order: integer("order").default(1).notNull(), // Question order for the day
  isActive: boolean("is_active").default(true).notNull(),
});

// Submissions: The core data for scoring
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").references(() => participants.id).notNull(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  
  // Submission Details
  answerIndex: integer("answer_index"), // Null if unattempted or auto-submitted without answer
  status: text("status").notNull(), // 'CORRECT', 'WRONG', 'UNATTEMPTED', 'REJECTED'
  
  // Timing & Ordering
  answerOrder: integer("answer_order").notNull(), // Global order for this question (1st to answer, 2nd, etc.)
  wrongAttemptOrder: integer("wrong_attempt_order").default(0).notNull(), // Per participant counter
  submissionTimestamp: timestamp("submission_timestamp").defaultNow().notNull(),
  
  // Scoring Components (Stored for audit)
  baseMarks: decimal("base_marks").notNull(),
  deductionMarks: decimal("deduction_marks").notNull(),
  bonusPercentage: decimal("bonus_percentage").notNull(),
  extraApplied: boolean("extra_applied").default(false).notNull(),
  finalScore: decimal("final_score").notNull(),
  
  // Security
  deviceId: text("device_id").notNull(),
  isAutoSubmitted: boolean("is_auto_submitted").default(false),
  autoSubmitReason: text("auto_submit_reason"),
});

// === RELATIONS ===
export const submissionsRelations = relations(submissions, ({ one }) => ({
  participant: one(participants, {
    fields: [submissions.participantId],
    references: [participants.id],
  }),
  question: one(questions, {
    fields: [submissions.questionId],
    references: [questions.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true, createdAt: true, lastActiveAt: true, isBanned: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===

// Participants
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

// Questions
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

// Submissions
export type Submission = typeof submissions.$inferSelect;

// Admin
export type Admin = typeof admins.$inferSelect;

// Request/Response Types

// Auth / Identity
export const identifySchema = z.object({
  name: z.string().min(3).regex(/^[a-zA-Z0-9 ]+$/),
  deviceId: z.string().min(10),
});
export type IdentifyRequest = z.infer<typeof identifySchema>;

// Submit Answer
export const submitAnswerSchema = z.object({
  questionId: z.number(),
  answerIndex: z.number().nullable(), // Null if unattempted/timeout
  deviceId: z.string(),
  reason: z.string().optional(), // For auto-submit
});
export type SubmitAnswerRequest = z.infer<typeof submitAnswerSchema>;

// Heartbeat
export const heartbeatSchema = z.object({
  deviceId: z.string(),
});

// Admin Dashboard Stats
export interface DashboardStats {
  totalParticipants: number;
  totalSubmissionsToday: number;
  activeQuestions: number;
}

// Leaderboard Entry
export interface LeaderboardEntry {
  rank: number;
  participantName: string;
  totalScore: number;
  correctCount: number;
  avgAnswerOrder: number;
}
