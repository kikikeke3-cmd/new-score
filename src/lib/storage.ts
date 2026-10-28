import { StudentProfile, StudyPlanResult, HabitDiagnosisResult } from "../types";
import { DEMO_PROFILES, recomputeStudentProfile } from "./gradeCalculator";

export const STORAGE_KEY_APP_STATE = "achieve_middle_school_state_v2";

export interface AppPersistedState {
  version: number;
  lastSavedAt: string; // ISO 8601 string
  activeStudentId: string;
  students: StudentProfile[];
  studyPlanMap?: Record<string, StudyPlanResult>;
  habitResultMap?: Record<string, HabitDiagnosisResult>;
}

// 1. Load state synchronously on initial load from localStorage
export function loadLocalPersistedState(): AppPersistedState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_APP_STATE);
    if (!raw) return null;

    const parsed: AppPersistedState = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.students) || parsed.students.length === 0) {
      return null;
    }

    // Validate and recompute students to ensure calculated fields remain intact
    const validatedStudents = parsed.students.map((st) => {
      try {
        return recomputeStudentProfile(st, st.activeSemesterId || "2-2");
      } catch {
        return st;
      }
    });

    const activeId =
      validatedStudents.some((s) => s.id === parsed.activeStudentId)
        ? parsed.activeStudentId
        : validatedStudents[0].id;

    return {
      version: parsed.version || 2,
      lastSavedAt: parsed.lastSavedAt || new Date().toISOString(),
      activeStudentId: activeId,
      students: validatedStudents,
      studyPlanMap: parsed.studyPlanMap || {},
      habitResultMap: parsed.habitResultMap || {},
    };
  } catch (err) {
    console.warn("Failed to load state from localStorage:", err);
    return null;
  }
}

// 2. Save state immediately to localStorage & asynchronously to server
export function saveStateToStorage(
  students: StudentProfile[],
  activeStudentId: string,
  studyPlanMap: Record<string, StudyPlanResult> = {},
  habitResultMap: Record<string, HabitDiagnosisResult> = {}
): AppPersistedState {
  const nowIso = new Date().toISOString();

  const stateToSave: AppPersistedState = {
    version: 2,
    lastSavedAt: nowIso,
    activeStudentId,
    students,
    studyPlanMap,
    habitResultMap,
  };

  // 1. Save to LocalStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_APP_STATE, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn("Failed to save state to localStorage:", err);
    }
  }

  // 2. Debounced/fire-and-forget save to backend server endpoint for cross-session / disk safety
  try {
    fetch("/api/app-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: stateToSave }),
    }).catch(() => {});
  } catch {
    // Ignore fetch errors
  }

  return stateToSave;
}

// 3. Fetch server persisted state (for initial sync or fallback if localStorage was cleared)
export async function fetchServerPersistedState(): Promise<AppPersistedState | null> {
  try {
    const res = await fetch("/api/app-state");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.state && Array.isArray(json.state.students) && json.state.students.length > 0) {
      return json.state;
    }
  } catch (err) {
    console.warn("Failed to fetch state from server:", err);
  }
  return null;
}

// 4. Export backup file (.json) for user to download
export function exportBackupFile(
  students: StudentProfile[],
  activeStudentId: string,
  studyPlanMap: Record<string, StudyPlanResult> = {},
  habitResultMap: Record<string, HabitDiagnosisResult> = {}
) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `중학성취e음_전체데이터백업_${dateStr}.json`;

  const backupData: AppPersistedState = {
    version: 2,
    lastSavedAt: new Date().toISOString(),
    activeStudentId,
    students,
    studyPlanMap,
    habitResultMap,
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 5. Parse imported backup file (.json)
export async function parseBackupFile(file: File): Promise<AppPersistedState> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 백업 파일 형식이 아닙니다.");
  }

  if (!parsed || (!Array.isArray(parsed.students) && !Array.isArray(parsed))) {
    throw new Error("백업 파일 내에 유효한 학생 데이터가 없습니다.");
  }

  const rawStudents = Array.isArray(parsed.students) ? parsed.students : parsed;
  if (rawStudents.length === 0) {
    throw new Error("백업 파일 내에 등록된 학생이 없습니다.");
  }

  const students = rawStudents.map((st: any) =>
    recomputeStudentProfile(st, st.activeSemesterId || "2-2")
  );

  const activeStudentId =
    parsed.activeStudentId && students.some((s: StudentProfile) => s.id === parsed.activeStudentId)
      ? parsed.activeStudentId
      : students[0].id;

  return {
    version: parsed.version || 2,
    lastSavedAt: parsed.lastSavedAt || new Date().toISOString(),
    activeStudentId,
    students,
    studyPlanMap: parsed.studyPlanMap || {},
    habitResultMap: parsed.habitResultMap || {},
  };
}

// 6. Reset all to fresh sample demo data
export function resetStorageToDemo(): AppPersistedState {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY_APP_STATE);
    } catch {
      // Ignore
    }
  }

  try {
    fetch("/api/app-state", { method: "DELETE" }).catch(() => {});
  } catch {
    // Ignore
  }

  return {
    version: 2,
    lastSavedAt: new Date().toISOString(),
    activeStudentId: DEMO_PROFILES[0].id,
    students: DEMO_PROFILES,
    studyPlanMap: {},
    habitResultMap: {},
  };
}
