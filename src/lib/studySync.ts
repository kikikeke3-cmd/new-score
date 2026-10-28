import { StudyLogEntry } from "../types";

const BROADCAST_CHANNEL_NAME = "STUDY_SYNC_CHANNEL";

// Safe BroadcastChannel getter with fallback
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      return new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return null;
}

// Generate share link for student (Includes query params for standalone student timer mode)
export function generateStudentShareUrl(
  studentId: string,
  studentName: string,
  subjectNames: string[]
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  params.set("mode", "student");
  params.set("studentId", studentId);
  params.set("name", studentName);
  if (subjectNames.length > 0) {
    params.set("subs", subjectNames.join(","));
  }
  return `${origin}/?${params.toString()}`;
}

// Register safe student metadata with backend (subject names only, no grade data!)
export async function registerStudentSafeMeta(
  studentId: string,
  name: string,
  subjects: string[]
): Promise<void> {
  try {
    await fetch("/api/register-student-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, name, subjects }),
    });
  } catch (err) {
    console.warn("Failed to register safe student meta with server:", err);
  }
}

// Save a study session log
export async function saveStudyLog(
  entry: Omit<StudyLogEntry, "id" | "timestamp">
): Promise<{ success: boolean; log: StudyLogEntry; weeklyHoursBySubject: Record<string, number> }> {
  const localId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullLog: StudyLogEntry = {
    ...entry,
    id: localId,
    timestamp: Date.now(),
  };

  // 1. Save to localStorage
  try {
    const key = `study_logs_${entry.studentId}`;
    const existing: StudyLogEntry[] = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(fullLog);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.warn("localStorage save error:", err);
  }

  // 2. Broadcast via BroadcastChannel
  try {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage({ type: "NEW_STUDY_LOG", log: fullLog });
      channel.close();
    }
  } catch (err) {
    console.warn("BroadcastChannel error:", err);
  }

  // 3. Post to backend server
  let serverWeeklyHours: Record<string, number> = {};
  try {
    const resp = await fetch("/api/study-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const json = await resp.json();
    if (json.success && json.weeklyHoursBySubject) {
      serverWeeklyHours = json.weeklyHoursBySubject;
    }
  } catch (err) {
    console.warn("Server study log save error (offline fallback used):", err);
  }

  return {
    success: true,
    log: fullLog,
    weeklyHoursBySubject: serverWeeklyHours,
  };
}

// Fetch study logs and weekly aggregated hours
export async function fetchStudyLogs(
  studentId: string
): Promise<{ logs: StudyLogEntry[]; weeklyHoursBySubject: Record<string, number> }> {
  // 1. Get from localStorage as baseline
  let localLogs: StudyLogEntry[] = [];
  try {
    const key = `study_logs_${studentId}`;
    localLogs = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    localLogs = [];
  }

  // 2. Try fetching from server
  try {
    const resp = await fetch(`/api/study-logs?studentId=${encodeURIComponent(studentId)}`);
    const json = await resp.json();
    if (json.success && Array.isArray(json.logs)) {
      // Merge unique by ID
      const map = new Map<string, StudyLogEntry>();
      json.logs.forEach((l: StudyLogEntry) => map.set(l.id, l));
      localLogs.forEach((l) => map.set(l.id, l));
      const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);

      return {
        logs: merged,
        weeklyHoursBySubject: json.weeklyHoursBySubject || calculateLocalWeeklyHours(merged),
      };
    }
  } catch (err) {
    console.warn("Server study log fetch failed, using local storage:", err);
  }

  return {
    logs: localLogs,
    weeklyHoursBySubject: calculateLocalWeeklyHours(localLogs),
  };
}

// Delete a study log
export async function deleteStudyLog(
  studentId: string,
  logId: string
): Promise<{ success: boolean }> {
  // Remove from localStorage
  try {
    const key = `study_logs_${studentId}`;
    const existing: StudyLogEntry[] = JSON.parse(localStorage.getItem(key) || "[]");
    const filtered = existing.filter((l) => l.id !== logId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {
    // Ignore
  }

  // Broadcast deletion
  try {
    const channel = getBroadcastChannel();
    if (channel) {
      channel.postMessage({ type: "DELETE_STUDY_LOG", logId, studentId });
      channel.close();
    }
  } catch {
    // Ignore
  }

  // Delete on server
  try {
    await fetch(`/api/study-logs?studentId=${encodeURIComponent(studentId)}&logId=${encodeURIComponent(logId)}`, {
      method: "DELETE",
    });
  } catch {
    // Ignore
  }

  return { success: true };
}

// Helper to calculate weekly hours from local logs
function calculateLocalWeeklyHours(logs: StudyLogEntry[]): Record<string, number> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => l.timestamp >= sevenDaysAgo);
  const result: Record<string, number> = {};
  recent.forEach((l) => {
    result[l.subjectName] = parseFloat(((result[l.subjectName] || 0) + l.durationMinutes / 60).toFixed(1));
  });
  return result;
}
