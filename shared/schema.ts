import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Participants: Identified by name and device fingerprint
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

// Admin Users
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

// Questions: Daily questions
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  options: jsonb("options").notNull(),
  correctAnswerIndex: integer("correct_answer_index").notNull(),
  quizDate: text("quiz_date").notNull(),
  order: integer("order").default(1).notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  resetId: integer("reset_id").default(0).notNull(),
});

// Submissions
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id")
    .references(() => participants.id)
    .notNull(),
  questionId: integer("question_id")
    .references(() => questions.id)
    .notNull(),
  answerIndex: integer("answer_index"),
  status: text("status").notNull(),
  answerOrder: integer("answer_order").notNull(),
  wrongAttemptOrder: integer("wrong_attempt_order").default(0).notNull(),
  submissionTimestamp: timestamp("submission_timestamp").defaultNow().notNull(),
  baseMarks: decimal("base_marks").notNull(),
  deductionMarks: decimal("deduction_marks").notNull(),
  bonusPercentage: decimal("bonus_percentage").notNull(),
  extraApplied: boolean("extra_applied").default(false).notNull(),
  finalScore: decimal("final_score").notNull(),
  deviceId: text("device_id").notNull(),
  isAutoSubmitted: boolean("is_auto_submitted").default(false),
  autoSubmitReason: text("auto_submit_reason"),
  resetId: integer("reset_id").default(0).notNull(),
});

// App Settings (for tracking global reset state)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  currentResetId: integer("current_reset_id").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
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
export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
  isBanned: true,
});
export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  resetId: true,
});
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Submission = typeof submissions.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export const identifySchema = z.object({
  name: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9 ]+$/),
  deviceId: z.string().min(10),
});
export type IdentifyRequest = z.infer<typeof identifySchema>;

export const submitAnswerSchema = z.object({
  questionId: z.number(),
  answerIndex: z.number().nullable(),
  deviceId: z.string(),
  reason: z.string().optional(),
});
export type SubmitAnswerRequest = z.infer<typeof submitAnswerSchema>;

export const heartbeatSchema = z.object({
  deviceId: z.string(),
});

export interface LeaderboardEntry {
  rank: number;
  participantName: string;
  totalScore: number;
  correctCount: number;
  avgAnswerOrder: number;
}
