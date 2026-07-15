import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import mongoose from "mongoose";
import InterviewSession from "../../../database/models/InterviewSession.js";
import QuestionBank from "../../../database/models/QuestionBank.js";
import AppError from "../../../utils/AppError.js";
import { generateSessionPdf, processAnswerSubmission } from "../service.js";

afterEach(() => {
  mock.restoreAll();
});

const userId = new mongoose.Types.ObjectId("64f1f77bcf86cd7994390a01");
const sessionId = new mongoose.Types.ObjectId("64f1f77bcf86cd7994390aaa");
const questionId = new mongoose.Types.ObjectId("64f1f77bcf86cd7994390c03");

const createSessionDoc = (overrides = {}) => ({
  _id: sessionId,
  userId,
  topic: "Node.js",
  difficulty: "medium",
  status: "completed",
  overallScore: 85,
  totalQuestions: 1,
  currentQuestionIndex: 0,
  answers: [
    {
      questionId,
      questionText: "What is event loop?",
      transcript: "Event loop is single threaded...",
      scores: { technical: 85, communication: 80, relevance: 90 },
      concepts: { detected: ["event loop"], missed: [] },
      feedback: "Great answer!",
      audioPath: null,
      bookmarked: false,
    },
  ],
  save: mock.fn(async () => {}),
  ...overrides,
});

test("generateSessionPdf - generates valid pdf buffer for owned session", async () => {
  const session = createSessionDoc();
  const findOneMock = mock.method(InterviewSession, "findOne", () => {
    return {
      lean: async () => session,
    };
  });

  const buffer = await generateSessionPdf(sessionId, userId);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  assert.equal(findOneMock.mock.callCount(), 1);
});

test("generateSessionPdf - throws 404 if session does not exist or not owned", async () => {
  mock.method(InterviewSession, "findOne", () => {
    return {
      lean: async () => null,
    };
  });

  await assert.rejects(
    generateSessionPdf(sessionId, userId),
    (err) => err instanceof AppError && err.statusCode === 404 && /not found/i.test(err.message)
  );
});

test("processAnswerSubmission - sets audioPath when audioFile is supplied", async () => {
  const session = createSessionDoc({ status: "in_progress", completedAt: null });
  
  mock.method(InterviewSession, "findOne", async () => session);
  mock.method(QuestionBank, "findById", async () => ({
    _id: questionId,
    expectedAnswer: "Sample",
    expectedConcepts: ["concept"],
  }));

  const audioFile = {
    path: "/uploads/audio-test.webm",
    buffer: Buffer.from("audio_bytes"),
  };

  const result = await processAnswerSubmission({
    sessionId: sessionId.toString(),
    userId,
    transcript: "This is a transcript",
    audioFile,
  });

  assert.equal(session.answers[0].audioPath, "/uploads/audio-test.webm");
  assert.equal(session.save.mock.callCount(), 1);
});

test("processAnswerSubmission - keeps audioPath null when audioFile is not supplied", async () => {
  const session = createSessionDoc({ status: "in_progress", completedAt: null });
  
  mock.method(InterviewSession, "findOne", async () => session);
  mock.method(QuestionBank, "findById", async () => ({
    _id: questionId,
    expectedAnswer: "Sample",
    expectedConcepts: ["concept"],
  }));

  const result = await processAnswerSubmission({
    sessionId: sessionId.toString(),
    userId,
    transcript: "This is a transcript",
    audioFile: null,
  });

  assert.equal(session.answers[0].audioPath, null);
  assert.equal(session.save.mock.callCount(), 1);
});
