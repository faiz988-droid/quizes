import { db } from "./db";
import {
  participants,
  questions,
  submissions,
  admins,
  settings,
  type Participant,
  type InsertParticipant,
  type Question,
  type InsertQuestion,
  type Submission,
  type Admin,
  type LeaderboardEntry,
  type Setting,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { format } from "date-fns";

export interface IStorage {
  getCurrentResetId(): Promise<number>;
  performReset(): Promise<number>;
  getParticipantByDeviceId(deviceId: string): Promise<Participant | undefined>;
  getParticipantByName(name: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantActivity(id: number): Promise<void>;
  getDailyQuestion(date: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  updateQuestion(
    id: number,
    question: Partial<InsertQuestion>,
  ): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  deleteSubmissionsByQuestion(questionId: number): Promise<void>;
  createSubmission(submission: Partial<Submission>): Promise<Submission>;
  getSubmission(
    participantId: number,
    questionId: number,
  ): Promise<Submission | undefined>;
  getGlobalAnswerOrder(questionId: number): Promise<number>;
  getParticipantWrongAttemptCount(
    participantId: number,
    questionId: number,
  ): Promise<number>;
  getPreviousQuestionScore(
    participantId: number,
    currentQuestionId: number,
  ): Promise<number>;
  getAdmin(username: string): Promise<Admin | undefined>;
  getLeaderboard(
    type: "daily" | "monthly",
    date?: string,
  ): Promise<LeaderboardEntry[]>;
  getAllSubmissions(date?: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // ─── Settings ───────────────────────────────────────────────────────────────

  async getCurrentResetId(): Promise<number> {
    const [s] = await db.select().from(settings).limit(1);
    if (!s) {
      const [newS] = await db
        .insert(settings)
        .values({ currentResetId: 0 })
        .returning();
      return newS.currentResetId;
    }
    return s.currentResetId;
  }

  async performReset(): Promise<number> {
    const currentId = await this.getCurrentResetId();
    const newId = currentId + 1;
    const [s] = await db.select().from(settings).limit(1);
    if (s) {
      await db
        .update(settings)
        .set({ currentResetId: newId, lastResetAt: new Date() })
        .where(eq(settings.id, s.id));
    } else {
      await db
        .insert(settings)
        .values({ currentResetId: newId, lastResetAt: new Date() });
    }
    return newId;
  }

  // ─── Participants ────────────────────────────────────────────────────────────

  async getParticipantByDeviceId(
    deviceId: string,
  ): Promise<Participant | undefined> {
    const [p] = await db
      .select()
      .from(participants)
      .where(eq(participants.deviceId, deviceId));
    return p;
  }

  async getParticipantByName(name: string): Promise<Participant | undefined> {
    const [p] = await db
      .select()
      .from(participants)
      .where(eq(participants.name, name));
    return p;
  }

  async createParticipant(
    participant: InsertParticipant,
  ): Promise<Participant> {
    const [p] = await db.insert(participants).values(participant).returning();
    return p;
  }

  async updateParticipantActivity(id: number): Promise<void> {
    await db
      .update(participants)
      .set({ lastActiveAt: new Date() })
      .where(eq(participants.id, id));
  }

  // ─── Questions ───────────────────────────────────────────────────────────────

  async getDailyQuestion(date: string): Promise<Question | undefined> {
    const resetId = await this.getCurrentResetId();

    // Get ALL active questions for today in this reset so we can debug
    const allToday = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.quizDate, date),
          eq(questions.isActive, true),
          eq(questions.resetId, resetId),
        ),
      )
      .orderBy(desc(questions.order));

    // Log every time to help diagnose visibility issues
    const currentTime = format(new Date(), "HH:mm");
    console.log(
      `[getDailyQuestion] date=${date} resetId=${resetId} currentTime=${currentTime}`,
    );
    console.log(
      `[getDailyQuestion] found ${allToday.length} active question(s) for today:`,
    );
    allToday.forEach((q) => {
      console.log(
        `  id=${q.id} scheduledTime=${q.scheduledTime ?? "NULL(immediate)"} content="${q.content.slice(0, 40)}"`,
      );
    });

    if (allToday.length === 0) {
      console.log(
        "[getDailyQuestion] → no questions found. Check: correct date? correct resetId?",
      );
      return undefined;
    }

    // Filter by scheduled time in JS — avoids any SQL text-comparison edge cases
    // "HH:mm" strings compare correctly as plain strings (zero-padded 24h)
    const eligible = allToday.filter((q) => {
      if (!q.scheduledTime) return true; // NULL = always available
      return q.scheduledTime <= currentTime; // e.g. "09:00" <= "14:35"
    });

    console.log(
      `[getDailyQuestion] ${eligible.length} eligible after time filter (currentTime=${currentTime})`,
    );
    if (eligible.length === 0) {
      const nextSlot = allToday
        .filter((q) => q.scheduledTime)
        .sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1))[0];
      if (nextSlot) {
        console.log(
          `[getDailyQuestion] Next question opens at ${nextSlot.scheduledTime}`,
        );
      }
    }

    if (eligible.length === 0) return undefined;

    // Among eligible, serve the one with the latest scheduled time (most recent slot)
    eligible.sort((a, b) => {
      const ta = a.scheduledTime ?? "00:00";
      const tb = b.scheduledTime ?? "00:00";
      if (tb !== ta) return tb > ta ? 1 : -1;
      return b.order - a.order;
    });

    const chosen = eligible[0];
    console.log(
      `[getDailyQuestion] → serving id=${chosen.id} scheduledTime=${chosen.scheduledTime}`,
    );
    return chosen;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const resetId = await this.getCurrentResetId();
    const [q] = await db
      .insert(questions)
      .values({ ...question, resetId })
      .returning();
    console.log(
      `[createQuestion] created id=${q.id} quizDate=${q.quizDate} scheduledTime=${q.scheduledTime} resetId=${q.resetId}`,
    );
    return q;
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const [q] = await db.select().from(questions).where(eq(questions.id, id));
    return q;
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db
      .select()
      .from(questions)
      .orderBy(desc(questions.quizDate), desc(questions.scheduledTime));
  }

  async updateQuestion(
    id: number,
    updates: Partial<InsertQuestion>,
  ): Promise<Question> {
    const [q] = await db
      .update(questions)
      .set(updates)
      .where(eq(questions.id, id))
      .returning();
    return q;
  }

  async deleteQuestion(id: number): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async deleteSubmissionsByQuestion(questionId: number): Promise<void> {
    await db.delete(submissions).where(eq(submissions.questionId, questionId));
  }

  // ─── Submissions & Scoring ───────────────────────────────────────────────────

  async createSubmission(submission: Partial<Submission>): Promise<Submission> {
    const resetId = await this.getCurrentResetId();
    // @ts-ignore
    const [s] = await db
      .insert(submissions)
      .values({ ...submission, resetId })
      .returning();
    return s;
  }

  async getSubmission(
    participantId: number,
    questionId: number,
  ): Promise<Submission | undefined> {
    const [s] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.participantId, participantId),
          eq(submissions.questionId, questionId),
        ),
      );
    return s;
  }

  async getGlobalAnswerOrder(questionId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(eq(submissions.questionId, questionId));
    return Number(result?.count ?? 0) + 1;
  }

  async getParticipantWrongAttemptCount(
    _participantId: number,
    _questionId: number,
  ): Promise<number> {
    return 1;
  }

  async getPreviousQuestionScore(
    participantId: number,
    _currentQuestionId: number,
  ): Promise<number> {
    const [prev] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.participantId, participantId))
      .orderBy(desc(submissions.submissionTimestamp))
      .limit(1);
    if (!prev) return 100;
    return Number(prev.finalScore);
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async getAdmin(username: string): Promise<Admin | undefined> {
    const [a] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username));
    return a;
  }

  async getLeaderboard(
    type: "daily" | "monthly",
    date?: string,
  ): Promise<LeaderboardEntry[]> {
    const resetId = await this.getCurrentResetId();
    const conditions: any[] = [eq(submissions.resetId, resetId)];
    if (type === "daily" && date) {
      conditions.push(eq(questions.quizDate, date));
    }

    const rows = await db
      .select({
        participantId: submissions.participantId,
        participantName: participants.name,
        totalScore: sql<number>`sum(${submissions.finalScore})`,
        correctCount: sql<number>`sum(case when ${submissions.status} = 'CORRECT' then 1 else 0 end)`,
        avgAnswerOrder: sql<number>`avg(${submissions.answerOrder})`,
      })
      .from(submissions)
      .innerJoin(participants, eq(submissions.participantId, participants.id))
      .innerJoin(questions, eq(submissions.questionId, questions.id))
      .where(and(...conditions))
      .groupBy(submissions.participantId, participants.name);

    rows.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount)
        return b.correctCount - a.correctCount;
      return a.avgAnswerOrder - b.avgAnswerOrder;
    });

    return rows.map((r, index) => ({
      rank: index + 1,
      participantName: r.participantName,
      totalScore: Number(r.totalScore),
      correctCount: Number(r.correctCount),
      avgAnswerOrder: Number(r.avgAnswerOrder),
    }));
  }

  async getAllSubmissions(date?: string): Promise<any[]> {
    const resetId = await this.getCurrentResetId();
    let query = db
      .select({
        submissionId: submissions.id,
        questionId: submissions.questionId,
        questionContent: questions.content,
        participantName: participants.name,
        status: submissions.status,
        answerOrder: submissions.answerOrder,
        wrongAttemptOrder: submissions.wrongAttemptOrder,
        baseMarks: submissions.baseMarks,
        bonusPercentage: submissions.bonusPercentage,
        extraApplied: submissions.extraApplied,
        finalScore: submissions.finalScore,
        timestamp: submissions.submissionTimestamp,
      })
      .from(submissions)
      .innerJoin(participants, eq(submissions.participantId, participants.id))
      .innerJoin(questions, eq(submissions.questionId, questions.id))
      .where(eq(submissions.resetId, resetId))
      .$dynamic();

    if (date) {
      query = query.where(eq(questions.quizDate, date));
    }
    return await query;
  }
}

export const storage = new DatabaseStorage();
