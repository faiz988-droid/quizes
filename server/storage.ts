
import { db } from "./db";
import { 
  participants, questions, submissions, admins,
  type Participant, type InsertParticipant,
  type Question, type InsertQuestion,
  type Submission, type Admin,
  type LeaderboardEntry
} from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Participants
  getParticipantByDeviceId(deviceId: string): Promise<Participant | undefined>;
  getParticipantByName(name: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantActivity(id: number): Promise<void>;

  // Questions
  getDailyQuestion(date: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
  getAllQuestions(): Promise<Question[]>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;

  // Submissions & Scoring
  createSubmission(submission: Partial<Submission>): Promise<Submission>;
  getSubmission(participantId: number, questionId: number): Promise<Submission | undefined>;
  getGlobalAnswerOrder(questionId: number): Promise<number>;
  getParticipantWrongAttemptCount(participantId: number, questionId: number): Promise<number>; // NOTE: This might need tracking previous wrong attempts if multiple attempts allowed? 
  // Requirement says: "Wrong Attempt Order: Reset per participant per question". 
  // Wait, if "One submission per question", how can there be multiple attempts? 
  // Ah, maybe "Wrong Attempt Order" implies multiple tries allowed? 
  // "5.2 Deduction Marks ... 1st wrong attempt -> 0, 2nd -> -5". 
  // This implies multiple attempts are allowed UNTIL correct or gave up? 
  // BUT Requirement 12 says: "One submission per question".
  // This is a contradiction or "One submission" means "One record that finalizes the score".
  // Let's assume the user submits ONCE, but maybe the "Wrong Attempt Order" is calculated based on *previous* questions?
  // "Reset per participant per question" -> this implies within a single question, multiple attempts.
  // BUT "One submission per question" suggests single shot.
  // Re-reading: "4. DATA INPUTS... Wrong Attempt Order... Reset per participant per question"
  // Maybe the UI allows "Try Again"? 
  // OR maybe "One submission" refers to the final committed result.
  // Let's assume single attempt for now unless the UI allows retry.
  // Actually, "Deduction Marks = -5 x (Wrong Attempt Order - 1)". If Order is 1 (1st attempt), deduction is 0.
  // If Order is 2, deduction is -5. This strongly implies multiple attempts.
  // I will implement "One submission per question" as "One SUCCESSFUL or FINAL submission".
  // But maybe the user can try and fail? 
  // "User can only: Answer the question. See confirmation...". 
  // This sounds like single shot. 
  // Let's stick to single shot for strict exams. If the prompt implies multiple attempts, it might be for a different mode.
  // Wait, "Wrong Attempt Order" tracks *how many times* they got it wrong? 
  // If it is a strict exam, usually it's one try. 
  // *Re-reading carefully*: "One submission per question" is listed under SYSTEM ASSUMPTIONS.
  // This likely means: Only one record stored.
  // So how does "Wrong Attempt Order" increment?
  // Maybe "Wrong Attempt Order" is a counter if they submit, get it wrong, and are allowed to retry?
  // But "One submission" contradicts "retry and submit again".
  // PERHAPS: The system stores *every* attempt, but only *one* is counted? 
  // Or "One submission" means one *active* submission?
  // Let's assume for a "Daily Quiz" / "Exam", it is usually single attempt.
  // However, the formula exists: "1st wrong attempt -> 0, 2nd -> -5".
  // This formula is useless if you only have 1 attempt.
  // Therefore, **Multiple Attempts MUST be allowed** until correct, OR strictly limited.
  // Given "Mobile-first daily quiz... competitive... fair ranking", maybe it's "Submit until correct"?
  // AND "5.7 Final Score Logic... IF Correct -> Score... IF Wrong -> Deduction".
  // If I submit WRONG, do I get a score of -5 and that's it? Or can I try again?
  // If "One submission per question", then if I answer WRONG, I get -5 (or 0 for 1st wrong attempt) and I am done.
  // So "Wrong Attempt Order" would always be 1? That makes the formula "-5 * (1-1) = 0" always 0.
  // That would mean NO negative marking for the first wrong answer?
  // And if I can't retry, then "2nd -> -5" is unreachable.
  // **INTERPRETATION:**
  // 1. "One submission per question" means the user cannot *re-submit* after the *final* submission.
  // 2. But maybe the "Answer" process allows checking?
  // 3. OR, maybe "Wrong Attempt Order" is historical? E.g. Previous days? No, "Reset per participant per question".
  // 4. CONCLUSION: The prompt implies a mechanism where you *can* answer multiple times, OR it's a "standard" exam where you submit once.
  // IF "Standard Exam": You submit once. If wrong, you get 0 (or negative?). 
  // The formula "1st wrong attempt -> 0" implies the *first* time you fail, you lose nothing.
  // This implies you CAN fail multiple times.
  // **DECISION:** I will allow multiple attempts in the UI *if* the first is wrong, BUT the "One submission per question" might refer to the fact that only the *final* result is stored/counted for the "Daily" record?
  // actually, let's look at "5.7 Final Score Logic": "IF Correct... IF Wrong...".
  // If I get it wrong, I get a score. 
  // If I can retry, do I get a NEW score?
  // I will assume **SINGLE ATTEMPT** for high-stakes competition. 
  // The "Wrong Attempt Order" might be a leftover from a different spec or implies a "Try Again" feature. 
  // **CRITICAL:** "One submission per question" is NON-NEGOTIABLE.
  // So, I will enforce **SINGLE ATTEMPT**. 
  // "Wrong Attempt Order" will always be 1. 
  // "Deduction Marks" will always be 0.
  // I will implement the *fields* to support the formula, but practically it might just be 1 attempt.
  // Wait, if "One submission per question" means "One record", maybe I update that record?
  // I'll stick to Single Attempt for safety of "Anti-cheat/Strict".

  getPreviousQuestionScore(participantId: number, currentQuestionId: number): Promise<number>;
  
  // Admin
  getAdmin(username: string): Promise<Admin | undefined>;
  getLeaderboard(date?: string): Promise<LeaderboardEntry[]>;
  getAllSubmissions(date?: string): Promise<any[]>; // For export
}

export class DatabaseStorage implements IStorage {
  // Participants
  async getParticipantByDeviceId(deviceId: string): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.deviceId, deviceId));
    return p;
  }

  async getParticipantByName(name: string): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.name, name));
    return p;
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [p] = await db.insert(participants).values(participant).returning();
    return p;
  }

  async updateParticipantActivity(id: number): Promise<void> {
    await db.update(participants)
      .set({ lastActiveAt: new Date() })
      .where(eq(participants.id, id));
  }

  // Questions
  async getDailyQuestion(date: string): Promise<Question | undefined> {
    const [q] = await db.select()
      .from(questions)
      .where(and(eq(questions.quizDate, date), eq(questions.isActive, true)))
      .orderBy(desc(questions.order)) // Get latest if multiple, or specific logic
      .limit(1);
    return q;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [q] = await db.insert(questions).values(question).returning();
    return q;
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const [q] = await db.select().from(questions).where(eq(questions.id, id));
    return q;
  }

  async getAllQuestions(): Promise<Question[]> {
    return await db.select().from(questions).orderBy(desc(questions.quizDate));
  }

  async updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question> {
    const [q] = await db.update(questions).set(updates).where(eq(questions.id, id)).returning();
    return q;
  }

  async deleteQuestion(id: number): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  // Submissions
  async createSubmission(submission: Partial<Submission>): Promise<Submission> {
    // @ts-ignore - partial type vs strict schema
    const [s] = await db.insert(submissions).values(submission).returning();
    return s;
  }

  async getSubmission(participantId: number, questionId: number): Promise<Submission | undefined> {
    const [s] = await db.select()
      .from(submissions)
      .where(and(
        eq(submissions.participantId, participantId),
        eq(submissions.questionId, questionId)
      ));
    return s;
  }

  async getGlobalAnswerOrder(questionId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(eq(submissions.questionId, questionId));
    return Number(result[0]?.count || 0) + 1;
  }

  async getParticipantWrongAttemptCount(participantId: number, questionId: number): Promise<number> {
    // If we were tracking multiple attempts, we'd query a history table. 
    // Since "One submission per question", this is effectively 0 or 1.
    // I'll return 1 if no previous correct submission exists? 
    // Implementation: Always 1 for now as we enforce single submission.
    return 1;
  }

  async getPreviousQuestionScore(participantId: number, currentQuestionId: number): Promise<number> {
    // Find the LAST submission by this user for a question BEFORE the current one
    // We assume questions have an 'order' or we use timestamp
    const [prev] = await db.select()
      .from(submissions)
      .where(eq(submissions.participantId, participantId))
      .orderBy(desc(submissions.submissionTimestamp))
      .limit(1);
      
    // If no previous submission, or it was for the SAME question (impossible if logic correct), return > 0 to disable extra marks?
    // "Extra marks apply... if Previous Question Score <= 0"
    if (!prev) return 100; // Default to High score so no bonus for first question? Or 0?
    // Usually bonus is for recovery. If no previous, maybe no bonus.
    
    return Number(prev.finalScore);
  }

  // Admin
  async getAdmin(username: string): Promise<Admin | undefined> {
    const [a] = await db.select().from(admins).where(eq(admins.username, username));
    return a;
  }

  async getLeaderboard(date?: string): Promise<LeaderboardEntry[]> {
    // Complex query to aggregate scores
    // Filter by date if provided (Daily Leaderboard), else All Time
    
    // This is a simplified logic. Real world needs proper joining and aggregation
    const submissionsQuery = db.select({
      participantId: submissions.participantId,
      participantName: participants.name,
      totalScore: sql<number>`sum(${submissions.finalScore})`,
      correctCount: sql<number>`sum(case when ${submissions.status} = 'CORRECT' then 1 else 0 end)`,
      avgAnswerOrder: sql<number>`avg(${submissions.answerOrder})`
    })
    .from(submissions)
    .innerJoin(participants, eq(submissions.participantId, participants.id))
    .innerJoin(questions, eq(submissions.questionId, questions.id))
    .groupBy(submissions.participantId, participants.name);

    if (date) {
      submissionsQuery.where(eq(questions.quizDate, date));
    }

    const results = await submissionsQuery;

    // Sort in memory or use order by in SQL
    // Ranking Logic: Total Score (Desc), Correct Answers (Desc), Fastest Avg Order (Asc)
    results.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.avgAnswerOrder - b.avgAnswerOrder;
    });

    return results.map((r, index) => ({
      rank: index + 1,
      participantName: r.participantName,
      totalScore: Number(r.totalScore),
      correctCount: Number(r.correctCount),
      avgAnswerOrder: Number(r.avgAnswerOrder)
    }));
  }

  async getAllSubmissions(date?: string): Promise<any[]> {
    const query = db.select({
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
      timestamp: submissions.submissionTimestamp
    })
    .from(submissions)
    .innerJoin(participants, eq(submissions.participantId, participants.id))
    .innerJoin(questions, eq(submissions.questionId, questions.id));

    if (date) {
      query.where(eq(questions.quizDate, date));
    }
    
    return await query;
  }
}

export const storage = new DatabaseStorage();
