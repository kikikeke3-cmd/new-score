import * as XLSX from "xlsx";
import { SubjectGrade } from "../types";
import {
  getAchievementGrade,
  SEMESTERS_META,
} from "./gradeCalculator";

export interface ParsedSheetResult {
  studentName?: string;
  gradeLevel?: string;
  semester?: string;
  totalStudents?: number;
  classTotalStudents?: number;
  totalScore?: number; // 총점
  overallAverage?: number; // 평균
  classRank?: number; // 학급 내 등수
  schoolRank?: number; // 학년 내 등수
  subjects: Omit<SubjectGrade, "percentile" | "estimatedRank">[];
  rawRowsCount: number;
}

export interface BatchSemesterMeta {
  semesterId: string;
  semesterName: string;
  subjectsCount: number;
  totalScore?: number;
  averageScore: number;
  classRank?: number;
  classTotalStudents?: number;
  schoolRank?: number;
  totalStudents?: number;
}

export interface BatchThreeYearResult {
  studentName?: string;
  gradeLevel?: string;
  totalStudents?: number;
  classTotalStudents?: number;
  totalScore?: number;
  overallAverage?: number;
  classRank?: number;
  schoolRank?: number;
  // Key is "1-1" | "1-2" | "2-1" | "2-2" | "3-1" | "3-2"
  semesters: Record<string, Omit<SubjectGrade, "percentile" | "estimatedRank">[]>;
  semesterMeta?: Record<
    string,
    {
      totalScore?: number;
      overallAverage?: number;
      classRank?: number;
      classTotalStudents?: number;
      schoolRank?: number;
    }
  >;
  detectedSemesters: BatchSemesterMeta[];
}

// Clean and normalize header string
function cleanHeader(val: any): string {
  if (!val) return "";
  return String(val).trim().toLowerCase().replace(/\s+/g, "");
}

// Helper: parse rank string like "3/30", "3등/30명", "3등", 3
export function parseRankAndTotal(val: any): { rank?: number; total?: number } {
  if (val === undefined || val === null || val === "") return {};
  const str = String(val).trim();
  const slashMatch = str.match(/([0-9.]+)\s*(?:등|위)?\s*\/\s*([0-9.]+)/);
  if (slashMatch) {
    const r = parseInt(slashMatch[1], 10);
    const t = parseInt(slashMatch[2], 10);
    return {
      rank: isNaN(r) ? undefined : r,
      total: isNaN(t) ? undefined : t,
    };
  }
  const cleanNum = parseInt(str.replace(/[^0-9]/g, ""), 10);
  return { rank: isNaN(cleanNum) ? undefined : cleanNum };
}

// Extract Spreadsheet ID from standard Google Sheets URL
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// Helper: match text to semester ID ("1-1", "1-2", "2-1", "2-2", "3-1", "3-2")
export function matchSemesterId(text: string): string | null {
  const clean = text.trim().toLowerCase().replace(/\s+/g, "");

  if (clean.includes("1-1") || clean.includes("1학년1학기") || clean.includes("1학기1학년") || clean === "11") return "1-1";
  if (clean.includes("1-2") || clean.includes("1학년2학기") || clean.includes("1학기2학년") || clean === "12") return "1-2";
  if (clean.includes("2-1") || clean.includes("2학년1학기") || clean === "21") return "2-1";
  if (clean.includes("2-2") || clean.includes("2학년2학기") || clean === "22") return "2-2";
  if (clean.includes("3-1") || clean.includes("3학년1학기") || clean === "31") return "3-1";
  if (clean.includes("3-2") || clean.includes("3학년2학기") || clean === "32") return "3-2";

  return null;
}

// Parse 2D string matrix into student subjects for a single semester
export function parseGradeRows(rows: (string | number)[][]): ParsedSheetResult {
  if (!rows || rows.length === 0) {
    throw new Error("스프레드시트에 내용이 없습니다.");
  }

  let studentName: string | undefined;
  let gradeLevel: string | undefined;
  let semester: string | undefined;
  let totalStudents: number | undefined;
  let classTotalStudents: number | undefined;
  let totalScore: number | undefined;
  let overallAverage: number | undefined;
  let classRank: number | undefined;
  let schoolRank: number | undefined;

  // 1. Scan top metadata rows (e.g. "학생 이름", "학년", "학기", "총점", "평균", "학급석차", "전교석차")
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").trim();
      if (!cell) continue;

      if (cell.includes("학생 이름") || cell.includes("학생이름") || cell.includes("이름")) {
        const nextCell = String(row[c + 1] || "").trim();
        if (nextCell && !nextCell.includes("학년")) {
          studentName = nextCell;
        }
      }
      if (cell.includes("학년") && !cell.includes("석차") && !cell.includes("등수")) {
        const nextCell = String(row[c + 1] || "").trim();
        if (nextCell) gradeLevel = nextCell;
      }
      if (cell.includes("학기")) {
        const nextCell = String(row[c + 1] || "").trim();
        if (nextCell) semester = nextCell;
      }
      if (cell.includes("수강자") || cell.includes("전체인원") || cell.includes("전교생")) {
        const nextCell = parseFloat(String(row[c + 1] || "").replace(/[^0-9.]/g, ""));
        if (!isNaN(nextCell) && nextCell > 0) totalStudents = nextCell;
      }
      if (cell.includes("학급인원") || cell.includes("반인원")) {
        const nextCell = parseFloat(String(row[c + 1] || "").replace(/[^0-9.]/g, ""));
        if (!isNaN(nextCell) && nextCell > 0) classTotalStudents = nextCell;
      }

      // Metadata: 총점
      if (cell === "총점" || cell.includes("총점:") || cell.includes("총점 ") || cell === "총합" || cell === "합계") {
        const valStr = cell.includes(":") ? cell.split(":")[1] : String(row[c + 1] || "");
        const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) totalScore = num;
      }

      // Metadata: 평균
      if ((cell === "평균" || cell.includes("평균:") || cell.includes("전체평균")) && !cell.includes("과목")) {
        const valStr = cell.includes(":") ? cell.split(":")[1] : String(row[c + 1] || "");
        const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) overallAverage = num;
      }

      // Metadata: 학급 내 등수 / 반등수
      if (
        cell.includes("학급등수") ||
        cell.includes("반등수") ||
        cell.includes("학급석차") ||
        cell.includes("반석차") ||
        cell.includes("학급내")
      ) {
        const valStr = cell.includes(":") ? cell.split(":")[1] : row[c + 1] || cell;
        const parsed = parseRankAndTotal(valStr);
        if (parsed.rank) classRank = parsed.rank;
        if (parsed.total) classTotalStudents = parsed.total;
      }

      // Metadata: 학년 내 등수 / 전교등수
      if (
        cell.includes("학년등수") ||
        cell.includes("전교등수") ||
        cell.includes("학년석차") ||
        cell.includes("전교석차") ||
        cell.includes("학년내") ||
        cell.includes("전체석차")
      ) {
        const valStr = cell.includes(":") ? cell.split(":")[1] : row[c + 1] || cell;
        const parsed = parseRankAndTotal(valStr);
        if (parsed.rank) schoolRank = parsed.rank;
        if (parsed.total) totalStudents = parsed.total;
      }
    }
  }

  // 2. Identify the header row index
  let headerRowIndex = -1;
  let colSubject = -1;
  let colScore = -1;
  let colMean = -1;
  let colStdDev = -1;
  let colAchievement = -1;
  let colHours = -1;
  let colTarget = -1;
  let colClassRank = -1;
  let colSchoolRank = -1;
  let colTotal = -1;
  let colAvg = -1;

  // Known Korean middle school subjects
  const KOREAN_SUBJECTS = [
    "국어", "수학", "영어", "과학", "사회", "역사", "도덕", "기술과정", "기술가정",
    "기가", "기술", "가정", "한문", "음악", "미술", "체육", "정보", "일본어", "중국어", "보건", "진로"
  ];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const h = cleanHeader(row[c]);
      if (
        h === "과목" ||
        h === "과목명" ||
        h === "교과" ||
        h === "교과목" ||
        h === "subject" ||
        h === "과목명(subject)"
      ) {
        colSubject = c;
        headerRowIndex = r;
      }
    }
    if (headerRowIndex !== -1) break;
  }

  // If no explicit '과목' header found, search for row with score keywords or known subject names
  if (headerRowIndex === -1) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const h = cleanHeader(row[c]);
        if (h.includes("점수") || h.includes("원점수") || h.includes("score")) {
          headerRowIndex = r;
          colScore = c;
          colSubject = Math.max(0, c - 1);
          break;
        }
        // Check if cell is a known subject name (e.g. table without headers)
        if (KOREAN_SUBJECTS.some((sub) => h === sub || h.startsWith(sub))) {
          headerRowIndex = Math.max(0, r - 1);
          colSubject = c;
          // Look for adjacent number column
          for (let c2 = 0; c2 < row.length; c2++) {
            if (c2 !== c) {
              const num = parseFloat(String(row[c2]).replace(/[^0-9.]/g, ""));
              if (!isNaN(num) && num >= 0 && num <= 100) {
                colScore = c2;
                break;
              }
            }
          }
          break;
        }
      }
      if (headerRowIndex !== -1) break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colSubject = 0;
    colScore = 1;
  }

  // Map remaining columns based on header row
  const headerRow = rows[headerRowIndex] || [];
  for (let c = 0; c < headerRow.length; c++) {
    const h = cleanHeader(headerRow[c]);
    if (
      colSubject === -1 &&
      (h.includes("과목") || h.includes("교과") || h.includes("subject"))
    ) {
      colSubject = c;
    } else if (
      (colScore === -1 || colScore === colSubject) &&
      (h.includes("원점수") || h.includes("점수") || h.includes("지필") || h === "score" || h.includes("성적"))
    ) {
      colScore = c;
    } else if (
      colClassRank === -1 &&
      (h.includes("학급등수") ||
        h.includes("반등수") ||
        h.includes("학급내등수") ||
        h.includes("학급석차") ||
        h.includes("반석차") ||
        h === "classrank")
    ) {
      colClassRank = c;
    } else if (
      colSchoolRank === -1 &&
      (h.includes("학년등수") ||
        h.includes("전교등수") ||
        h.includes("학년내등수") ||
        h.includes("전교석차") ||
        h.includes("학년석차") ||
        h.includes("전체석차") ||
        h === "석차" ||
        h === "schoolrank" ||
        h === "graderank")
    ) {
      colSchoolRank = c;
    } else if (
      colMean === -1 &&
      (h.includes("학교평균") || h.includes("과목평균") || h === "mean")
    ) {
      colMean = c;
    } else if (
      colStdDev === -1 &&
      (h.includes("표준편차") || h.includes("편차") || h === "stddev" || h === "sd")
    ) {
      colStdDev = c;
    } else if (
      colAchievement === -1 &&
      (h.includes("성취도") || h.includes("등급") || h === "grade" || h === "achievement")
    ) {
      colAchievement = c;
    } else if (
      colHours === -1 &&
      (h.includes("시간") || h.includes("학습시간") || h.includes("공부시간") || h.includes("hours"))
    ) {
      colHours = c;
    } else if (
      colTarget === -1 &&
      (h.includes("목표") || h.includes("target"))
    ) {
      colTarget = c;
    } else if (
      colTotal === -1 &&
      (h.includes("총점") || h === "total" || h.includes("총합"))
    ) {
      colTotal = c;
    } else if (
      colAvg === -1 &&
      (h.includes("평균") || h === "average" || h === "avg")
    ) {
      colAvg = c;
    }
  }

  if (colSubject === -1) colSubject = 0;
  if (colScore === -1 || colScore === colSubject) colScore = 1;

  // 3. Parse data rows after header
  const parsedSubjects: Omit<SubjectGrade, "percentile" | "estimatedRank">[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawSubName = String(row[colSubject] || "").trim();
    if (!rawSubName || rawSubName.startsWith("[")) {
      // Check if bracketed row is summary: "[총점]", "[합계]", "[평균]"
      if (rawSubName.includes("총점") || rawSubName.includes("합계") || rawSubName.includes("총합")) {
        const valStr = String(row[colScore] !== undefined ? row[colScore] : row[colSubject + 1] || "");
        const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) totalScore = num;
      }
      if (rawSubName.includes("평균")) {
        const valStr = String(row[colScore] !== undefined ? row[colScore] : row[colSubject + 1] || "");
        const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) overallAverage = num;
        if (colClassRank !== -1) {
          const pr = parseRankAndTotal(row[colClassRank]);
          if (pr.rank) classRank = pr.rank;
          if (pr.total) classTotalStudents = pr.total;
        }
        if (colSchoolRank !== -1) {
          const pr = parseRankAndTotal(row[colSchoolRank]);
          if (pr.rank) schoolRank = pr.rank;
          if (pr.total) totalStudents = pr.total;
        }
      }
      continue;
    }

    // Direct text summary rows
    if (rawSubName.includes("총점") || rawSubName.includes("합계") || rawSubName.includes("총합")) {
      const valStr = String(row[colScore] !== undefined ? row[colScore] : "");
      const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) totalScore = num;
      continue;
    }

    if (rawSubName === "평균" || rawSubName === "전체평균" || rawSubName === "과목평균") {
      const valStr = String(row[colScore] !== undefined ? row[colScore] : "");
      const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) overallAverage = num;
      if (colClassRank !== -1) {
        const pr = parseRankAndTotal(row[colClassRank]);
        if (pr.rank) classRank = pr.rank;
        if (pr.total) classTotalStudents = pr.total;
      }
      if (colSchoolRank !== -1) {
        const pr = parseRankAndTotal(row[colSchoolRank]);
        if (pr.rank) schoolRank = pr.rank;
        if (pr.total) totalStudents = pr.total;
      }
      continue;
    }

    // Extract score string safely avoiding concatenation of '/' or '('
    let rawScoreCell = String(row[colScore] !== undefined ? row[colScore] : "").trim();
    let extractedMeanFromScoreCell: number | undefined;

    if (rawScoreCell.includes("/")) {
      const parts = rawScoreCell.split("/");
      rawScoreCell = parts[0].trim();
      if (parts[1]) {
        const meanCandidate = parseFloat(parts[1].split("(")[0].replace(/[^0-9.]/g, ""));
        if (!isNaN(meanCandidate) && meanCandidate > 0 && meanCandidate <= 100) {
          extractedMeanFromScoreCell = meanCandidate;
        }
      }
    } else if (rawScoreCell.includes("(")) {
      rawScoreCell = rawScoreCell.split("(")[0].trim();
    }

    let cleanScoreNum = parseFloat(rawScoreCell.replace(/[^0-9.]/g, ""));

    // Fallback: if score in designated colScore is invalid, look for first numeric cell in row
    if (isNaN(cleanScoreNum)) {
      for (let ci = 0; ci < row.length; ci++) {
        if (ci === colSubject) continue;
        const testStr = String(row[ci] || "").trim().split("/")[0].split("(")[0];
        const n = parseFloat(testStr.replace(/[^0-9.]/g, ""));
        if (!isNaN(n) && n >= 0 && n <= 100) {
          cleanScoreNum = n;
          break;
        }
      }
    }

    if (isNaN(cleanScoreNum)) continue;

    const score = Math.max(0, Math.min(100, cleanScoreNum));

    let mean = extractedMeanFromScoreCell || 68.0;
    if (colMean !== -1 && row[colMean] !== undefined) {
      const mNum = parseFloat(String(row[colMean]).replace(/[^0-9.]/g, ""));
      if (!isNaN(mNum) && mNum > 0) mean = mNum;
    }

    let stdDev = 18.0;
    if (colStdDev !== -1 && row[colStdDev] !== undefined) {
      const sNum = parseFloat(String(row[colStdDev]).replace(/[^0-9.]/g, ""));
      if (!isNaN(sNum) && sNum > 0) stdDev = sNum;
    }

    let achievement = getAchievementGrade(score);
    if (colAchievement !== -1 && row[colAchievement] !== undefined) {
      const achStr = String(row[colAchievement]).trim().toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(achStr)) {
        achievement = achStr as any;
      }
    }

    let hours = 4.0;
    if (colHours !== -1 && row[colHours] !== undefined) {
      const hNum = parseFloat(String(row[colHours]).replace(/[^0-9.]/g, ""));
      if (!isNaN(hNum) && hNum >= 0) hours = hNum;
    }

    let target = Math.min(100, Math.max(score, score + 8));
    if (colTarget !== -1 && row[colTarget] !== undefined) {
      const tNum = parseFloat(String(row[colTarget]).replace(/[^0-9.]/g, ""));
      if (!isNaN(tNum) && tNum > 0) target = Math.min(100, tNum);
    }

    let subClassRank: number | undefined;
    if (colClassRank !== -1 && row[colClassRank] !== undefined) {
      const pr = parseRankAndTotal(row[colClassRank]);
      if (pr.rank) subClassRank = pr.rank;
    }

    let subGradeRank: number | undefined;
    if (colSchoolRank !== -1 && row[colSchoolRank] !== undefined) {
      const pr = parseRankAndTotal(row[colSchoolRank]);
      if (pr.rank) subGradeRank = pr.rank;
    }

    parsedSubjects.push({
      id: `sub-import-${Date.now()}-${r}`,
      name: rawSubName,
      score,
      mean,
      stdDev,
      achievement,
      weeklyStudyHours: hours,
      targetScore: target,
      classRank: subClassRank,
      gradeRank: subGradeRank,
    });
  }

  if (parsedSubjects.length === 0) {
    throw new Error("유효한 과목 및 성적 데이터를 찾을 수 없습니다. 서식을 확인해주세요.");
  }

  const calculatedTotal = parsedSubjects.reduce((sum, s) => sum + s.score, 0);
  const finalTotalScore =
    totalScore !== undefined && totalScore > 0 ? totalScore : calculatedTotal;
  const finalAverage =
    overallAverage !== undefined && overallAverage > 0
      ? overallAverage
      : parseFloat((finalTotalScore / parsedSubjects.length).toFixed(1));

  return {
    studentName,
    gradeLevel,
    semester,
    totalStudents: totalStudents || 240,
    classTotalStudents: classTotalStudents || 30,
    totalScore: finalTotalScore,
    overallAverage: finalAverage,
    classRank,
    schoolRank,
    subjects: parsedSubjects,
    rawRowsCount: rows.length,
  };
}

// Check if a single sheet has a semester column (e.g. rows labeled with "1-1", "1-2", "2-1"...)
function tryParseSingleSheetWithSemesterColumn(
  rows: (string | number)[][]
): Record<string, Omit<SubjectGrade, "percentile" | "estimatedRank">[]> | null {
  if (!rows || rows.length < 2) return null;

  // Search for semester header in first 5 rows
  let semColIdx = -1;
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const h = cleanHeader(row[c]);
      if (h.includes("학기") || h === "semester" || h === "학년학기" || h.includes("구분")) {
        semColIdx = c;
        headerRowIdx = r;
        break;
      }
    }
    if (semColIdx !== -1) break;
  }

  if (semColIdx === -1) return null;

  // Group rows by semester
  const rowsBySemester: Record<string, (string | number)[][]> = {};
  const headerRow = rows[headerRowIdx];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const semVal = String(row[semColIdx] || "");
    const semId = matchSemesterId(semVal);
    if (semId) {
      if (!rowsBySemester[semId]) {
        rowsBySemester[semId] = [headerRow];
      }
      rowsBySemester[semId].push(row);
    }
  }

  const keys = Object.keys(rowsBySemester);
  if (keys.length < 2) return null; // Not a multi-semester table

  const result: Record<string, Omit<SubjectGrade, "percentile" | "estimatedRank">[]> = {};
  for (const semId of keys) {
    try {
      const parsed = parseGradeRows(rowsBySemester[semId]);
      if (parsed.subjects.length > 0) {
        result[semId] = parsed.subjects;
      }
    } catch {
      // ignore partial parse errors
    }
  }

  return Object.keys(result).length >= 2 ? result : null;
}

// Check if sheet is a 3-year matrix table (Wide format: columns are 1-1, 1-2, 2-1, 2-2, 3-1, 3-2)
function tryParseThreeYearMatrix(
  rows: (string | number)[][]
): Record<string, Omit<SubjectGrade, "percentile" | "estimatedRank">[]> | null {
  if (!rows || rows.length < 2) return null;

  let headerRowIdx = -1;
  const colToSemester: Record<number, string> = {};

  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const semId = matchSemesterId(String(row[c] || ""));
      if (semId) {
        colToSemester[c] = semId;
        headerRowIdx = r;
      }
    }
    if (Object.keys(colToSemester).length >= 2) break;
  }

  if (Object.keys(colToSemester).length < 2) return null;

  // Find subject name column
  let subCol = 0;
  const headerRow = rows[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    const h = cleanHeader(headerRow[c]);
    if (h.includes("과목") || h.includes("교과") || h.includes("subject")) {
      subCol = c;
      break;
    }
  }

  const result: Record<string, Omit<SubjectGrade, "percentile" | "estimatedRank">[]> = {};
  Object.values(colToSemester).forEach((semId) => {
    result[semId] = [];
  });

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const subName = String(row[subCol] || "").trim();
    if (!subName || subName.startsWith("[") || subName.includes("평균")) continue;

    for (const [colStr, semId] of Object.entries(colToSemester)) {
      const c = Number(colStr);
      const scoreStr = String(row[c] || "");
      const score = parseFloat(scoreStr.replace(/[^0-9.]/g, ""));
      if (!isNaN(score) && score >= 0 && score <= 100) {
        result[semId].push({
          id: `sub-mat-${semId}-${r}`,
          name: subName,
          score,
          mean: 68.0,
          stdDev: 18.0,
          achievement: getAchievementGrade(score),
          weeklyStudyHours: 4.0,
          targetScore: Math.min(100, score + 8),
        });
      }
    }
  }

  const validEntries = Object.entries(result).filter(([_, subs]) => subs.length > 0);
  return validEntries.length >= 2 ? Object.fromEntries(validEntries) : null;
}

// Master Parser: Automatically handles single file with multi-tabs, single sheet multi-semester, matrix, or single semester
export async function parseThreeYearSpreadsheetFile(
  file: File
): Promise<BatchThreeYearResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let studentName: string | undefined;
  let gradeLevel: string | undefined;
  let totalStudents: number | undefined;
  let classTotalStudents: number | undefined;

  const semesters: Record<
    string,
    Omit<SubjectGrade, "percentile" | "estimatedRank">[]
  > = {};
  const semesterMeta: Record<
    string,
    {
      totalScore?: number;
      overallAverage?: number;
      classRank?: number;
      classTotalStudents?: number;
      schoolRank?: number;
    }
  > = {};

  // Case 1: Multiple Tabs corresponding to Semesters (e.g. "1-1", "1-2", "2-1", "2-2", "3-1", "3-2")
  const tabToSemester: { sheetName: string; semId: string }[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const semId = matchSemesterId(sheetName);
    if (semId) {
      tabToSemester.push({ sheetName, semId });
    }
  });

  if (tabToSemester.length >= 2) {
    for (const { sheetName, semId } of tabToSemester) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        defval: "",
      });
      try {
        const parsed = parseGradeRows(rows);
        if (parsed.subjects.length > 0) {
          semesters[semId] = parsed.subjects;
          semesterMeta[semId] = {
            totalScore: parsed.totalScore,
            overallAverage: parsed.overallAverage,
            classRank: parsed.classRank,
            classTotalStudents: parsed.classTotalStudents,
            schoolRank: parsed.schoolRank,
          };
          if (parsed.studentName) studentName = parsed.studentName;
          if (parsed.gradeLevel) gradeLevel = parsed.gradeLevel;
          if (parsed.totalStudents) totalStudents = parsed.totalStudents;
          if (parsed.classTotalStudents) classTotalStudents = parsed.classTotalStudents;
        }
      } catch (err) {
        console.warn(`Tab ${sheetName} parse warning:`, err);
      }
    }
  }

  // Case 2: If multi-tab didn't yield >= 2 semesters, check the first sheet for matrix or semester column
  if (Object.keys(semesters).length < 2 && workbook.SheetNames.length > 0) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, {
      header: 1,
      defval: "",
    });

    // Check 2a: Semester Column format
    const colGroupResult = tryParseSingleSheetWithSemesterColumn(rows);
    if (colGroupResult) {
      Object.assign(semesters, colGroupResult);
    } else {
      // Check 2b: Wide Matrix format (columns are 1-1, 1-2, 2-1...)
      const matrixResult = tryParseThreeYearMatrix(rows);
      if (matrixResult) {
        Object.assign(semesters, matrixResult);
      } else {
        // Fallback: regular single sheet
        const singleParsed = parseGradeRows(rows);
        const semId =
          matchSemesterId(singleParsed.semester || "") ||
          matchSemesterId(workbook.SheetNames[0]) ||
          matchSemesterId(file.name) ||
          "2-2";
        semesters[semId] = singleParsed.subjects;
        semesterMeta[semId] = {
          totalScore: singleParsed.totalScore,
          overallAverage: singleParsed.overallAverage,
          classRank: singleParsed.classRank,
          classTotalStudents: singleParsed.classTotalStudents,
          schoolRank: singleParsed.schoolRank,
        };
        studentName = singleParsed.studentName;
        gradeLevel = singleParsed.gradeLevel;
        totalStudents = singleParsed.totalStudents;
        classTotalStudents = singleParsed.classTotalStudents;
      }
    }
  }

  // Build detected semesters summary list (1-1 is excluded as free semester)
  const detectedSemesters: BatchSemesterMeta[] = Object.entries(semesters)
    .filter(([semId]) => semId !== "1-1")
    .map(([semId, subjects]) => {
      const meta = SEMESTERS_META.find((m) => m.id === semId);
      const semInfo = semesterMeta[semId];
      const calcTotal = subjects.reduce((sum, s) => sum + s.score, 0);
      const avg =
        semInfo?.overallAverage !== undefined && semInfo.overallAverage > 0
          ? semInfo.overallAverage
          : subjects.length > 0
          ? parseFloat((calcTotal / subjects.length).toFixed(1))
          : 0;

      return {
        semesterId: semId,
        semesterName: meta?.name || `${semId}학기`,
        subjectsCount: subjects.length,
        totalScore: semInfo?.totalScore || calcTotal,
        averageScore: avg,
        classRank: semInfo?.classRank,
        classTotalStudents: semInfo?.classTotalStudents || classTotalStudents || 30,
        schoolRank: semInfo?.schoolRank,
        totalStudents: totalStudents || 240,
      };
    });

  return {
    studentName,
    gradeLevel,
    totalStudents,
    classTotalStudents,
    semesters,
    semesterMeta,
    detectedSemesters,
  };
}

// Master Batch Parser for Multiple Files dropped at once
export async function parseMultipleSpreadsheetFiles(
  files: File[]
): Promise<BatchThreeYearResult> {
  if (files.length === 1) {
    return parseThreeYearSpreadsheetFile(files[0]);
  }

  const combinedSemesters: Record<
    string,
    Omit<SubjectGrade, "percentile" | "estimatedRank">[]
  > = {};
  const combinedSemesterMeta: Record<
    string,
    {
      totalScore?: number;
      overallAverage?: number;
      classRank?: number;
      classTotalStudents?: number;
      schoolRank?: number;
    }
  > = {};
  let studentName: string | undefined;
  let gradeLevel: string | undefined;
  let totalStudents: number | undefined;
  let classTotalStudents: number | undefined;

  for (const file of files) {
    try {
      const parsedOne = await parseThreeYearSpreadsheetFile(file);
      if (parsedOne.studentName) studentName = parsedOne.studentName;
      if (parsedOne.gradeLevel) gradeLevel = parsedOne.gradeLevel;
      if (parsedOne.totalStudents) totalStudents = parsedOne.totalStudents;
      if (parsedOne.classTotalStudents) classTotalStudents = parsedOne.classTotalStudents;

      // Merge semesters
      for (const [semId, subs] of Object.entries(parsedOne.semesters)) {
        combinedSemesters[semId] = subs;
        if (parsedOne.semesterMeta?.[semId]) {
          combinedSemesterMeta[semId] = parsedOne.semesterMeta[semId];
        }
      }
    } catch (err) {
      console.warn(`File ${file.name} parse skipped:`, err);
    }
  }

  const detectedSemesters: BatchSemesterMeta[] = Object.entries(
    combinedSemesters
  )
    .filter(([semId]) => semId !== "1-1")
    .map(([semId, subjects]) => {
      const meta = SEMESTERS_META.find((m) => m.id === semId);
      const semInfo = combinedSemesterMeta[semId];
      const calcTotal = subjects.reduce((sum, s) => sum + s.score, 0);
      const avg =
        semInfo?.overallAverage !== undefined && semInfo.overallAverage > 0
          ? semInfo.overallAverage
          : subjects.length > 0
          ? parseFloat((calcTotal / subjects.length).toFixed(1))
          : 0;

      return {
        semesterId: semId,
        semesterName: meta?.name || `${semId}학기`,
        subjectsCount: subjects.length,
        totalScore: semInfo?.totalScore || calcTotal,
        averageScore: avg,
        classRank: semInfo?.classRank,
        classTotalStudents: semInfo?.classTotalStudents || classTotalStudents || 30,
        schoolRank: semInfo?.schoolRank,
        totalStudents: totalStudents || 240,
      };
    });

  return {
    studentName,
    gradeLevel,
    totalStudents,
    classTotalStudents,
    semesters: combinedSemesters,
    semesterMeta: combinedSemesterMeta,
    detectedSemesters,
  };
}

// Master Parser for Google Spreadsheet multi-tabs or wide tables
export function parseGoogleSpreadsheetTabs(
  tabs: { title: string; rows: (string | number)[][] }[]
): BatchThreeYearResult {
  let studentName: string | undefined;
  let gradeLevel: string | undefined;
  let totalStudents: number | undefined;
  let classTotalStudents: number | undefined;
  const semesters: Record<
    string,
    Omit<SubjectGrade, "percentile" | "estimatedRank">[]
  > = {};
  const semesterMeta: Record<
    string,
    {
      totalScore?: number;
      overallAverage?: number;
      classRank?: number;
      classTotalStudents?: number;
      schoolRank?: number;
    }
  > = {};

  // 1. Check if multiple tab titles map to semesters (e.g. "1-1", "1-2", "2-1", "2-2", "3-1", "3-2")
  const tabToSemester: {
    title: string;
    semId: string;
    rows: (string | number)[][];
  }[] = [];
  tabs.forEach((tab) => {
    const semId = matchSemesterId(tab.title);
    if (semId) {
      tabToSemester.push({ title: tab.title, semId, rows: tab.rows });
    }
  });

  if (tabToSemester.length >= 2) {
    for (const item of tabToSemester) {
      try {
        const parsed = parseGradeRows(item.rows);
        if (parsed.subjects.length > 0) {
          semesters[item.semId] = parsed.subjects;
          semesterMeta[item.semId] = {
            totalScore: parsed.totalScore,
            overallAverage: parsed.overallAverage,
            classRank: parsed.classRank,
            classTotalStudents: parsed.classTotalStudents,
            schoolRank: parsed.schoolRank,
          };
          if (parsed.studentName) studentName = parsed.studentName;
          if (parsed.gradeLevel) gradeLevel = parsed.gradeLevel;
          if (parsed.totalStudents) totalStudents = parsed.totalStudents;
          if (parsed.classTotalStudents) classTotalStudents = parsed.classTotalStudents;
        }
      } catch (e) {
        console.warn(`Tab ${item.title} parse warning:`, e);
      }
    }
  }

  // 2. If tab titles didn't yield >= 2 semesters, inspect each sheet's rows for semester column or wide matrix
  if (Object.keys(semesters).length < 2 && tabs.length > 0) {
    for (const tab of tabs) {
      const colGroup = tryParseSingleSheetWithSemesterColumn(tab.rows);
      if (colGroup) {
        Object.assign(semesters, colGroup);
        break;
      }
      const mat = tryParseThreeYearMatrix(tab.rows);
      if (mat) {
        Object.assign(semesters, mat);
        break;
      }
    }

    // Fallback: If still not >= 2 semesters, parse first tab as single semester
    if (
      Object.keys(semesters).length === 0 &&
      tabs.length > 0 &&
      tabs[0].rows.length > 0
    ) {
      const single = parseGradeRows(tabs[0].rows);
      const semId =
        matchSemesterId(single.semester || "") ||
        matchSemesterId(tabs[0].title) ||
        "2-2";
      semesters[semId] = single.subjects;
      semesterMeta[semId] = {
        totalScore: single.totalScore,
        overallAverage: single.overallAverage,
        classRank: single.classRank,
        classTotalStudents: single.classTotalStudents,
        schoolRank: single.schoolRank,
      };
      studentName = single.studentName;
      gradeLevel = single.gradeLevel;
      totalStudents = single.totalStudents;
      classTotalStudents = single.classTotalStudents;
    }
  }

  const detectedSemesters: BatchSemesterMeta[] = Object.entries(semesters)
    .filter(([semId]) => semId !== "1-1")
    .map(([semId, subjects]) => {
      const meta = SEMESTERS_META.find((m) => m.id === semId);
      const semInfo = semesterMeta[semId];
      const calcTotal = subjects.reduce((sum, s) => sum + s.score, 0);
      const avg =
        semInfo?.overallAverage !== undefined && semInfo.overallAverage > 0
          ? semInfo.overallAverage
          : subjects.length > 0
          ? parseFloat((calcTotal / subjects.length).toFixed(1))
          : 0;

      return {
        semesterId: semId,
        semesterName: meta?.name || `${semId}학기`,
        subjectsCount: subjects.length,
        totalScore: semInfo?.totalScore || calcTotal,
        averageScore: avg,
        classRank: semInfo?.classRank,
        classTotalStudents: semInfo?.classTotalStudents || classTotalStudents || 30,
        schoolRank: semInfo?.schoolRank,
        totalStudents: totalStudents || 240,
      };
    });

  return {
    studentName,
    gradeLevel,
    totalStudents,
    classTotalStudents,
    semesters,
    semesterMeta,
    detectedSemesters,
  };
}

// Generate sample 3-year multi-tab Excel Workbook (.xlsx)
// Specially configured with 과목별 점수, 총점, 평균, 학급 내 등수, 학년 내 등수
export function downloadThreeYearSampleWorkbook(): void {
  const wb = XLSX.utils.book_new();

  const subjectsSample = [
    { name: "국어", mean: 70, stdDev: 18 },
    { name: "수학", mean: 65, stdDev: 21 },
    { name: "영어", mean: 68, stdDev: 19 },
    { name: "과학", mean: 66, stdDev: 17 },
    { name: "역사/사회", mean: 72, stdDev: 16 },
    { name: "도덕", mean: 75, stdDev: 15 },
  ];

  // Base score progression for 6 semesters
  const scoreOffsets: Record<string, number> = {
    "1-1": -6,
    "1-2": -4,
    "2-1": -2,
    "2-2": 0,
    "3-1": +3,
    "3-2": +6,
  };

  const rankBySem: Record<string, { classRank: number; schoolRank: number }> = {
    "1-1": { classRank: 6, schoolRank: 42 },
    "1-2": { classRank: 5, schoolRank: 35 },
    "2-1": { classRank: 4, schoolRank: 26 },
    "2-2": { classRank: 3, schoolRank: 18 },
    "3-1": { classRank: 2, schoolRank: 12 },
    "3-2": { classRank: 1, schoolRank: 6 },
  };

  SEMESTERS_META.forEach((meta) => {
    const offset = scoreOffsets[meta.id] || 0;
    const ranks = rankBySem[meta.id] || { classRank: 3, schoolRank: 20 };

    // Calculate sample scores
    const subsWithScores = subjectsSample.map((sub, sIdx) => {
      const baseScore = [80, 85, 82, 84, 76, 88][sIdx] || 80;
      const score = Math.max(50, Math.min(100, baseScore + offset));
      const hours = [4, 10, 6, 4, 3, 2][sIdx] || 4;
      const subClassRank = Math.max(1, ranks.classRank + (sIdx % 3) - 1);
      const subGradeRank = Math.max(1, ranks.schoolRank + (sIdx % 5) * 3 - 4);
      return {
        ...sub,
        score,
        hours,
        classRank: subClassRank,
        gradeRank: subGradeRank,
      };
    });

    const sumScore = subsWithScores.reduce((acc, cur) => acc + cur.score, 0);
    const avgScore = parseFloat((sumScore / subsWithScores.length).toFixed(1));

    const rows: (string | number)[][] = [
      ["[중학 성취e음] 학생 성적 통지표", meta.name],
      [
        "학생 이름",
        "홍길동",
        "학년",
        `중학교 ${meta.gradeYear}학년`,
        "학기",
        meta.name,
        "전교생수",
        240,
        "학급인원",
        30,
      ],
      [
        "총점",
        sumScore,
        "평균",
        avgScore,
        "학급 내 등수",
        `${ranks.classRank}등 / 30명`,
        "학년 내 등수",
        `${ranks.schoolRank}등 / 240명`,
      ],
      [],
      [
        "과목명",
        "점수(원점수)",
        "학급 내 등수",
        "학년 내 등수",
        "학교평균",
        "표준편차",
        "성취도",
        "주간 공부시간(h)",
        "목표점수",
      ],
    ];

    subsWithScores.forEach((sub) => {
      rows.push([
        sub.name,
        sub.score,
        `${sub.classRank}등`,
        `${sub.gradeRank}등`,
        sub.mean,
        sub.stdDev,
        getAchievementGrade(sub.score),
        sub.hours,
        Math.min(100, sub.score + 8),
      ]);
    });

    // Summary row at the bottom as well
    rows.push([]);
    rows.push([
      "[총점 / 합계]",
      sumScore,
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
    ]);
    rows.push([
      "[전체 평균]",
      avgScore,
      `학급 ${ranks.classRank}등`,
      `전교 ${ranks.schoolRank}등`,
      "-",
      "-",
      "-",
      "-",
      "-",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, meta.id); // Tab name e.g. "1-1", "1-2", "2-1"...
  });

  // Also add a "3개년통합성적일람표" tab (1학년 1학기는 자유학기제 제외)
  const matrixRows = [
    ["[중학 성취e음] 중학교 성적·등수 누적 일람표 (1학년 1학기 자유학기제 제외)"],
    ["학생 이름", "홍길동", "전교생수", 240, "학급인원", 30],
    ["안내", "※ 1학년 1학기는 자유학기제(지필평가 미실시)로 성적 산출에서 제외되었습니다."],
    [],
    ["구분", "1-2", "2-1", "2-2", "3-1", "3-2"],
    ["총점", 478, 490, 502, 520, 538],
    ["평균", 79.7, 81.7, 83.7, 86.7, 89.7],
    ["학급 내 등수", "5등", "4등", "3등", "2등", "1등"],
    ["학년 내 등수", "35등", "26등", "18등", "12등", "6등"],
    [],
    ["[과목별 점수]"],
    ["국어", 76, 78, 80, 83, 86],
    ["수학", 81, 83, 85, 88, 91],
    ["영어", 78, 80, 82, 85, 88],
    ["과학", 80, 82, 84, 87, 90],
    ["역사/사회", 72, 74, 76, 79, 82],
    ["도덕", 84, 86, 88, 91, 94],
  ];
  const matrixWs = XLSX.utils.aoa_to_sheet(matrixRows);
  XLSX.utils.book_append_sheet(wb, matrixWs, "3개년성적일람표");

  XLSX.writeFile(wb, "중학성취e음_성적_총점_평균_등수_통합양식.xlsx");
}

// Parse text copied and pasted directly (e.g. "국어 95\n수학 88\n영어 92...")
export function parseTextPastedGrades(text: string): {
  subjects: Omit<SubjectGrade, "percentile" | "estimatedRank">[];
  overallAverage?: number;
  totalScore?: number;
  classRank?: number;
  schoolRank?: number;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const subjects: Omit<SubjectGrade, "percentile" | "estimatedRank">[] = [];
  let overallAverage: number | undefined;
  let totalScore: number | undefined;
  let classRank: number | undefined;
  let schoolRank: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check metadata lines
    if (line.includes("총점") || line.includes("합계")) {
      const num = parseFloat(line.replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) totalScore = num;
      continue;
    }
    if (line.includes("평균")) {
      const num = parseFloat(line.replace(/[^0-9.]/g, ""));
      if (!isNaN(num) && num > 0) overallAverage = num;
      continue;
    }
    if (line.includes("학급") || line.includes("반등수") || line.includes("반석차")) {
      const parsed = parseRankAndTotal(line);
      if (parsed.rank) classRank = parsed.rank;
      continue;
    }
    if (line.includes("학년") || line.includes("전교") || line.includes("전체등수") || line.includes("석차")) {
      const parsed = parseRankAndTotal(line);
      if (parsed.rank) schoolRank = parsed.rank;
      continue;
    }

    // Split line by tab, comma, or spaces
    const tokens = line.split(/[\t,:]|\s{2,}/).map((t) => t.trim()).filter(Boolean);
    let subName = "";
    let scoreVal: number | undefined;
    let meanVal = 68.0;

    if (tokens.length >= 2) {
      subName = tokens[0];
      const sNum = parseFloat(tokens[1].split("/")[0].split("(")[0].replace(/[^0-9.]/g, ""));
      if (!isNaN(sNum) && sNum >= 0 && sNum <= 100) {
        scoreVal = sNum;
      }
      if (tokens.length >= 3) {
        const mNum = parseFloat(tokens[2].replace(/[^0-9.]/g, ""));
        if (!isNaN(mNum) && mNum > 0 && mNum <= 100) meanVal = mNum;
      }
    } else {
      // Single space split fallback e.g. "국어 95"
      const spaceParts = line.split(/\s+/);
      if (spaceParts.length >= 2) {
        subName = spaceParts[0];
        const sNum = parseFloat(spaceParts[1].split("/")[0].split("(")[0].replace(/[^0-9.]/g, ""));
        if (!isNaN(sNum) && sNum >= 0 && sNum <= 100) {
          scoreVal = sNum;
        }
      }
    }

    if (subName && scoreVal !== undefined) {
      subjects.push({
        id: `sub-paste-${Date.now()}-${i}`,
        name: subName,
        score: scoreVal,
        mean: meanVal,
        stdDev: 18.0,
        achievement: getAchievementGrade(scoreVal),
        weeklyStudyHours: 4,
        targetScore: Math.min(100, scoreVal + 8),
      });
    }
  }

  return {
    subjects,
    overallAverage,
    totalScore,
    classRank,
    schoolRank,
  };
}

// Generate single semester CSV template with 점수, 총점, 평균, 학급등수, 학년등수
export function generateSampleTemplateCsv(): string {
  return [
    `"[중학 성취e음] 학생 성적표", "2학년 2학기"`,
    `"학생 이름", "홍길동", "학년", "중학교 2학년", "학기", "2학년 2학기", "전교생수", 240, "학급인원", 30`,
    `"총점", 490, "평균", 81.7, "학급 내 등수", "3등", "학년 내 등수", "18등"`,
    ``,
    `"과목명", "점수(원점수)", "학급 내 등수", "학년 내 등수", "학교평균", "표준편차", "성취도", "주간 공부시간(h)", "목표점수"`,
    `"국어", 80, 3, 20, 70, 18, "B", 4, 90`,
    `"수학", 85, 1, 10, 65, 20, "B", 8, 95`,
    `"영어", 82, 4, 18, 68, 19, "B", 5, 90`,
    `"과학", 84, 2, 14, 67, 17, "B", 4, 92`,
    `"역사/사회", 76, 5, 32, 71, 16, "C", 3, 85`,
    `"도덕", 88, 2, 12, 75, 15, "A", 2, 95`,
    ``,
    `"[총점]", 495, "", "", "", "", "", "", ""`,
    `"[평균]", 82.5, "3등", "18등", "", "", "", "", ""`,
  ].join("\n");
}
