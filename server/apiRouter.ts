import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import {
  generateCounselingReport,
  generateAutoStudyPlan,
  generateHabitDiagnosis,
} from "./gemini.js";

// Server-side persistent app state store
let cachedAppState: any = null;
const STATE_FILE_PATH = path.resolve(process.cwd(), "server", "appState.json");

try {
  if (fs.existsSync(STATE_FILE_PATH)) {
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf-8");
    cachedAppState = JSON.parse(raw);
  }
} catch (err) {
  console.warn("Failed to read server appState.json on boot:", err);
}

interface StudyLogRecord {
  id: string;
  studentId: string;
  studentName?: string;
  subjectName: string;
  durationMinutes: number;
  studyDate: string;
  memo?: string;
  timestamp: number;
}

interface StudentSafeMeta {
  studentId: string;
  name: string;
  gradeLevel?: string;
  subjects: string[]; // Subject names ONLY, absolutely no test scores or ranks!
}

// In-memory study logs and student metadata store
const studyLogsStore: Record<string, StudyLogRecord[]> = {};
const studentMetaStore: Record<string, StudentSafeMeta> = {};

function getRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err) => reject(err));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function calculateWeeklyHours(logs: StudyLogRecord[]): Record<string, number> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter((l) => l.timestamp >= sevenDaysAgo);
  const weeklyHoursBySubject: Record<string, number> = {};
  recentLogs.forEach((l) => {
    const prev = weeklyHoursBySubject[l.subjectName] || 0;
    weeklyHoursBySubject[l.subjectName] = parseFloat((prev + l.durationMinutes / 60).toFixed(1));
  });
  return weeklyHoursBySubject;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const parsedUrl = new URL(req.url || "", "http://localhost");
  const pathName = parsedUrl.pathname;

  if (!pathName.startsWith("/api/")) {
    return next();
  }

  // Handle GET requests for study logs and safe student metadata
  if (req.method === "GET") {
    if (pathName === "/api/study-logs") {
      const studentId = parsedUrl.searchParams.get("studentId");
      if (!studentId) {
        sendJson(res, 400, { error: "Missing studentId query parameter" });
        return;
      }
      const logs = studyLogsStore[studentId] || [];
      const weeklyHoursBySubject = calculateWeeklyHours(logs);
      sendJson(res, 200, { success: true, logs, weeklyHoursBySubject });
      return;
    }

    if (pathName === "/api/student-study-meta") {
      const studentId = parsedUrl.searchParams.get("studentId");
      if (!studentId) {
        sendJson(res, 400, { error: "Missing studentId parameter" });
        return;
      }
      const meta = studentMetaStore[studentId] || null;
      sendJson(res, 200, { success: true, meta });
      return;
    }

    if (pathName === "/api/app-state") {
      sendJson(res, 200, { success: true, state: cachedAppState });
      return;
    }

    sendJson(res, 404, { error: "API endpoint not found" });
    return;
  }

  // Handle DELETE request for study log or app-state
  if (req.method === "DELETE") {
    if (pathName === "/api/app-state") {
      cachedAppState = null;
      try {
        if (fs.existsSync(STATE_FILE_PATH)) {
          fs.unlinkSync(STATE_FILE_PATH);
        }
      } catch (err) {
        console.warn("Failed to delete server appState.json:", err);
      }
      sendJson(res, 200, { success: true });
      return;
    }

    if (pathName === "/api/study-logs") {
      const studentId = parsedUrl.searchParams.get("studentId");
      const logId = parsedUrl.searchParams.get("logId");
      if (!studentId || !logId) {
        sendJson(res, 400, { error: "Missing studentId or logId" });
        return;
      }
      if (studyLogsStore[studentId]) {
        studyLogsStore[studentId] = studyLogsStore[studentId].filter((l) => l.id !== logId);
      }
      const logs = studyLogsStore[studentId] || [];
      const weeklyHoursBySubject = calculateWeeklyHours(logs);
      sendJson(res, 200, { success: true, logs, weeklyHoursBySubject });
      return;
    }
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const payload = await getRequestBody(req);

    // Save full application state (students, scores, ranks, study plans, etc.)
    if (pathName === "/api/app-state") {
      const state = payload.state;
      if (state && Array.isArray(state.students)) {
        cachedAppState = state;
        try {
          fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
        } catch (err) {
          console.warn("Failed to write appState.json on server:", err);
        }
        sendJson(res, 200, {
          success: true,
          lastSavedAt: state.lastSavedAt || new Date().toISOString(),
        });
        return;
      }
      sendJson(res, 400, { error: "Invalid state payload" });
      return;
    }

    // Register safe student metadata (subject names only, strictly no scores/ranks!)
    if (pathName === "/api/register-student-meta") {
      const { studentId, name, gradeLevel, subjects } = payload;
      if (!studentId || !name) {
        sendJson(res, 400, { error: "Missing studentId or name" });
        return;
      }
      studentMetaStore[studentId] = {
        studentId,
        name,
        gradeLevel: gradeLevel || "중학교",
        subjects: Array.isArray(subjects) ? subjects : ["국어", "수학", "영어", "과학", "사회/역사"],
      };
      sendJson(res, 200, { success: true, meta: studentMetaStore[studentId] });
      return;
    }

    // Submit a student study session
    if (pathName === "/api/study-logs") {
      const { studentId, studentName, subjectName, durationMinutes, memo, studyDate } = payload;
      if (!studentId || !subjectName || !durationMinutes) {
        sendJson(res, 400, { error: "Missing studentId, subjectName, or durationMinutes" });
        return;
      }

      const newEntry: StudyLogRecord = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        studentId,
        studentName: studentName || "학생",
        subjectName,
        durationMinutes: Math.max(1, Math.round(Number(durationMinutes))),
        studyDate: studyDate || new Date().toISOString().split("T")[0],
        memo: memo || "",
        timestamp: Date.now(),
      };

      if (!studyLogsStore[studentId]) {
        studyLogsStore[studentId] = [];
      }
      studyLogsStore[studentId].unshift(newEntry);

      const logs = studyLogsStore[studentId];
      const weeklyHoursBySubject = calculateWeeklyHours(logs);
      sendJson(res, 200, { success: true, log: newEntry, logs, weeklyHoursBySubject });
      return;
    }

    if (pathName === "/api/sample-pdf-students") {
      const { parseAttachedSamplePdf } = await import("./pdfParserServer.js");
      const result = await parseAttachedSamplePdf();
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathName === "/api/parse-pdf") {
      const { parsePdfBuffer } = await import("./pdfParserServer.js");
      if (!payload.pdfBase64) {
        sendJson(res, 400, { error: "Missing pdfBase64 payload" });
        return;
      }
      const buffer = Buffer.from(payload.pdfBase64, "base64");
      const result = await parsePdfBuffer(new Uint8Array(buffer));
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathName === "/api/gemini/counseling") {
      const report = await generateCounselingReport(payload);
      sendJson(res, 200, { success: true, report });
      return;
    }

    if (pathName === "/api/gemini/planner") {
      const plan = await generateAutoStudyPlan(payload);
      sendJson(res, 200, { success: true, plan });
      return;
    }

    if (pathName === "/api/gemini/diagnosis") {
      const diagnosis = await generateHabitDiagnosis(payload);
      sendJson(res, 200, { success: true, diagnosis });
      return;
    }

    sendJson(res, 404, { error: "API endpoint not found" });
  } catch (error: any) {
    console.error("API handler error:", error);
    sendJson(res, 500, {
      error: error.message || "Internal server error occurred",
    });
  }
}
