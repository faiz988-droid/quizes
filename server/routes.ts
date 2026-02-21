import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { admins, participants, submissions, questions } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { eq, sql, and } from "drizzle-orm";

// Helper for today's date
const getTodayDate = () => format(new Date(), "yyyy-MM-dd");

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ─── Public Routes ────────────────────────────────────────────────────────

  // Identify
  app.post(api.identify.path, async (req, res) => {
    try {
      const input = api.identify.input.parse(req.body);

      let participant = await storage.getParticipantByName(input.name);

      if (participant) {
        if (participant.deviceId !== input.deviceId) {
          return res
            .status(403)
            .json({
              message: "This name is already registered to another device.",
            });
        }
      } else {
        const existingDevice = await storage.getParticipantByDeviceId(
          input.deviceId,
        );
        if (existingDevice) {
          return res
            .status(403)
            .json({
              message: `This device is already registered as ${existingDevice.name}.`,
            });
        }
        participant = await storage.createParticipant({
          name: input.name,
          deviceId: input.deviceId,
        });
      }

      if (participant.isBanned) {
        return res
          .status(403)
          .json({ message: "You are banned from this competition." });
      }

      const token = Buffer.from(
        `${participant.id}:${participant.deviceId}`,
      ).toString("base64");
      res.json({
        token,
        participant: { id: participant.id, name: participant.name },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // Get Daily Question
  app.get(api.getDailyQuestion.path, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ message: "Unauthorized" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(403).json({ message: "Unauthorized" });

    let participantId: number;
    try {
      const decoded = Buffer.from(token, "base64").toString().split(":");
      participantId = parseInt(decoded[0]);
      if (isNaN(participantId)) throw new Error("Invalid token");
    } catch {
      return res.status(403).json({ message: "Invalid token" });
    }

    const question = await storage.getDailyQuestion(getTodayDate());

    if (!question) {
      return res.json(null);
    }

    // Check if already submitted
    const existingSubmission = await storage.getSubmission(
      participantId,
      question.id,
    );
    if (existingSubmission) {
      return res.json(null);
    }

    res.json({
      id: question.id,
      content: question.content,
      options: question.options as string[],
      quizDate: question.quizDate,
      order: question.order,
    });
  });

  // Submit Answer
  app.post(api.submitAnswer.path, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(403).json({ message: "Unauthorized" });

    const token = authHeader.split(" ")[1];
    let participantId: number;
    try {
      const decoded = Buffer.from(token, "base64").toString().split(":");
      participantId = parseInt(decoded[0]);
      if (isNaN(participantId)) throw new Error("Invalid token");
    } catch {
      return res.status(403).json({ message: "Invalid token" });
    }

    const input = api.submitAnswer.input.parse(req.body);

    const existing = await storage.getSubmission(
      participantId,
      input.questionId,
    );
    if (existing) {
      return res.status(400).json({ message: "Already submitted" });
    }

    const question = await storage.getQuestion(input.questionId);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    // ── Scoring Logic ──────────────────────────────────────────────────────

    // 1. Answer Order (how many have already answered before this person)
    const answerOrder = await storage.getGlobalAnswerOrder(input.questionId);

    // 2. Wrong Attempt Order (always 1 per submission in single-attempt model)
    const wrongAttemptOrder = 1;

    // 3. Base Marks: 510 − (answerOrder × 10), floored at 0
    let baseMarks = Math.max(0, 510 - answerOrder * 10);

    // 4. Determine status and deduction
    let status = "UNATTEMPTED";
    let deductionMarks = 0;

    if (input.answerIndex === null || input.answerIndex === undefined) {
      status = "UNATTEMPTED";
    } else if (input.answerIndex === question.correctAnswerIndex) {
      status = "CORRECT";
    } else {
      status = "WRONG";
      deductionMarks = -5 * (wrongAttemptOrder - 1); // 0 on first attempt
    }

    // 5. Extra marks eligibility: previous question score ≤ 0
    const prevScore = await storage.getPreviousQuestionScore(
      participantId,
      input.questionId,
    );
    const isEligibleForExtra = prevScore <= 0;

    // 6. Bonus percentage: MAX(0, 0.7 − answerOrder × 0.1)
    const bonusPercentage = Math.max(0, 0.7 - answerOrder * 0.1);

    // 7. Final score calculation
    let finalScore = 0;
    let extraApplied = false;

    if (status === "CORRECT") {
      if (isEligibleForExtra) {
        finalScore = baseMarks * (1 + bonusPercentage);
        extraApplied = true;
      } else {
        finalScore = baseMarks;
      }
    } else if (status === "WRONG") {
      finalScore = deductionMarks;
    } else {
      finalScore = 0;
    }

    // 8. Floor at -50
    finalScore = Math.max(-50, finalScore);

    await storage.createSubmission({
      participantId,
      questionId: input.questionId,
      answerIndex: input.answerIndex,
      status,
      answerOrder,
      wrongAttemptOrder,
      baseMarks: baseMarks.toString(),
      deductionMarks: deductionMarks.toString(),
      bonusPercentage: bonusPercentage.toString(),
      extraApplied,
      finalScore: finalScore.toString(),
      deviceId: input.deviceId,
      isAutoSubmitted: !!input.reason,
      autoSubmitReason: input.reason,
    });

    res.json({
      message: "Submitted",
      status: "Your answer has been recorded successfully.",
    });
  });

  // Heartbeat
  app.post(api.heartbeat.path, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const decoded = Buffer.from(token, "base64").toString().split(":");
      const participantId = parseInt(decoded[0]);
      if (!isNaN(participantId)) {
        await storage.updateParticipantActivity(participantId);
      }
    }
    res.json({ status: "OK" });
  });

  // ─── Admin Routes ─────────────────────────────────────────────────────────

  app.post(api.adminLogin.path, async (req, res) => {
    const { username, password } = req.body;
    const admin = await storage.getAdmin(username);
    if (!admin || admin.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    res.json({ message: "Logged in" });
  });

  // Real stats from DB
  app.get(api.adminStats.path, async (req, res) => {
    try {
      const today = getTodayDate();
      const resetId = await storage.getCurrentResetId();

      // Total distinct participants
      const [participantCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(participants);

      // Submissions today
      const [submissionsToday] = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .innerJoin(questions, eq(submissions.questionId, questions.id))
        .where(
          and(eq(questions.quizDate, today), eq(submissions.resetId, resetId)),
        );

      // Active questions today
      const [activeQuestions] = await db
        .select({ count: sql<number>`count(*)` })
        .from(questions)
        .where(
          and(
            eq(questions.quizDate, today),
            eq(questions.isActive, true),
            eq(questions.resetId, resetId),
          ),
        );

      res.json({
        totalParticipants: Number(participantCount?.count ?? 0),
        totalSubmissionsToday: Number(submissionsToday?.count ?? 0),
        activeQuestions: Number(activeQuestions?.count ?? 0),
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get(api.adminQuestions.list.path, async (req, res) => {
    const questions = await storage.getAllQuestions();
    res.json(questions);
  });

  app.post(api.adminQuestions.create.path, async (req, res) => {
    try {
      const input = api.adminQuestions.create.input.parse(req.body);
      if (!Array.isArray(input.options) || input.options.length !== 4) {
        return res
          .status(400)
          .json({ message: "Exactly 4 options are required." });
      }
      const q = await storage.createQuestion(input);
      res.status(201).json(q);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.adminQuestions.update.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const input = api.adminQuestions.update.input.parse(req.body);
      const q = await storage.updateQuestion(id, input);
      res.json(q);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.adminQuestions.delete.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid question ID" });

      // Must delete child submissions first — FK constraint blocks question delete otherwise
      await storage.deleteSubmissionsByQuestion(id);
      await storage.deleteQuestion(id);

      res.status(204).send();
    } catch (err: any) {
      console.error("Delete question error:", err);
      res
        .status(500)
        .json({ message: err.message || "Failed to delete question" });
    }
  });

  app.get(api.adminResults.path, async (req, res) => {
    const type = (req.query.type as "daily" | "monthly") || "daily";
    const date = (req.query.date as string) || getTodayDate();
    const leaderboard = await storage.getLeaderboard(type, date);
    res.json(leaderboard);
  });

  app.post(api.adminReset.path, async (req, res) => {
    const newResetId = await storage.performReset();
    res.json({ message: "Dashboard reset successfully", newResetId });
  });

  app.get(api.adminExport.path, async (req, res) => {
    const date = (req.query.date as string) || getTodayDate();
    const data = await storage.getAllSubmissions(date);

    const rows = data.map((d: any) => ({
      "Question ID": d.questionId,
      Question: d.questionContent,
      Participant: d.participantName,
      Status: d.status,
      "Answer Order": d.answerOrder,
      "Wrong Attempt Order": d.wrongAttemptOrder,
      "Base Marks": Number(d.baseMarks),
      "Bonus %": Number(d.bonusPercentage),
      "Extra Applied": d.extraApplied ? "Yes" : "No",
      "Final Score": Number(d.finalScore),
      Timestamp: d.timestamp
        ? format(new Date(d.timestamp), "yyyy-MM-dd HH:mm:ss")
        : "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=export-${date}.xlsx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  });

  // ─── Seed default admin ───────────────────────────────────────────────────
  const existingAdmin = await storage.getAdmin("admin");
  if (!existingAdmin) {
    await db
      .insert(admins)
      .values({ username: "admin", password: "password123" });
  }

  return httpServer;
}
