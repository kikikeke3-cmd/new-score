import { StudentProfile, SubjectGrade, SemesterGradeRecord } from "../types";
import {
  computeSubjectMetrics,
  computeSemesterRecord,
  recomputeStudentProfile,
  createEmptySemester,
  getAchievementGrade,
  SEMESTERS_META,
} from "./gradeCalculator";

export interface ParsedPdfStudent {
  pageNumber: number;
  name: string;
  gradeLevel: string;
  classInfo: string;
  schoolRank?: number;
  totalStudents?: number;
  percentile?: number;
  classRank?: number;
  classTotalStudents?: number;
  semesters: Record<
    string,
    {
      name: string;
      score: number;
      achievement: string;
    }[]
  >;
}

export interface PdfParseResult {
  schoolName: string;
  gradeAndClass: string;
  teacherName?: string;
  issueDate?: string;
  studentsCount: number;
  students: StudentProfile[];
  rawParsedStudents: ParsedPdfStudent[];
}

const SEMESTER_X_RANGES = [
  { id: "1-2", minX: 175, maxX: 245 },
  { id: "2-1", minX: 250, maxX: 325 },
  { id: "2-2", minX: 330, maxX: 400 },
  { id: "3-1", minX: 405, maxX: 485 },
  { id: "3-2", minX: 495, maxX: 560 },
];

/**
 * Core text-based parser that takes page text items and extracts student data
 */
export function parsePageItemsToStudent(
  items: { x: number; y: number; str: string }[],
  pageNumber: number
): ParsedPdfStudent & { schoolName?: string; teacherName?: string; issueDate?: string } {
  // Group by Y coordinates
  const rows: Record<number, { x: number; str: string }[]> = {};
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.y);
    if (!rows[y]) rows[y] = [];
    rows[y].push({ x: Math.round(item.x), str: item.str.trim() });
  }

  const sortedY = Object.keys(rows)
    .map(Number)
    .sort((a, b) => b - a);

  let studentName = "";
  let classInfo = "";
  let gradeLevel = "중학교 3학년";
  let schoolName = "중학교";
  let teacherName = "";
  let issueDate = "";
  let schoolRank: number | undefined;
  let totalStudents = 109;
  let percentile: number | undefined;
  let classRank: number | undefined;
  let classTotalStudents = 30;

  const semestersData: Record<string, { name: string; score: number; achievement: string }[]> = {
    "1-2": [],
    "2-1": [],
    "2-2": [],
    "3-1": [],
    "3-2": [],
  };

  for (const y of sortedY) {
    const rowItems = rows[y].sort((a, b) => a.x - b.x);
    const line = rowItems.map((i) => i.str).join(" ");

    if (line.includes("중학교 :")) {
      const sm = line.match(/중학교\s*:\s*([가-힣A-Za-z0-9]+)/);
      if (sm) schoolName = sm[1];
    }

    if (line.includes("출력일자:")) {
      const dm = line.match(/출력일자:\s*([0-9년월일\s]+)/);
      if (dm) issueDate = dm[1].trim();
    }

    if (line.includes("이름 :") || line.includes("이름:")) {
      const nm = line.match(/이름\s*:\s*([가-힣A-Za-z]+)/);
      if (nm) studentName = nm[1];

      const cm = line.match(/제\s*([0-9]+)학년\s*([0-9]+)반\s*([0-9]+)번/);
      if (cm) {
        classInfo = `${cm[1]}학년 ${cm[2]}반 ${cm[3]}번`;
        gradeLevel = `중학교 ${cm[1]}학년`;
        classRank = parseInt(cm[3], 10);
      }

      const tm = line.match(/담임성명\s*:\s*([가-힣A-Za-z]+)/);
      if (tm) teacherName = tm[1];
    }

    // 내신점수 header and values (typically Y between 300 and 320)
    if (y >= 295 && y <= 315) {
      const nums = rowItems.map((i) => parseFloat(i.str)).filter((n) => !isNaN(n));
      // Expected: [교과점수, 출석, 활동, 총점, 석차백분율, 학년석차]
      if (nums.length >= 6) {
        percentile = nums[4];
        schoolRank = Math.round(nums[5]);
      }
    }

    // Maximum capacity row (usually Y around 327)
    if (y >= 320 && y <= 335) {
      const nums = rowItems.map((i) => parseFloat(i.str)).filter((n) => !isNaN(n));
      if (nums.length >= 5) {
        const lastNum = nums[nums.length - 1];
        if (lastNum > 10) {
          totalStudents = Math.round(lastNum);
        }
      }
    }

    // Subject rows (Y between 415 and 615)
    if (y >= 415 && y <= 615) {
      const firstItem = rowItems[0];
      const subName = firstItem.str.replace(/\s+/g, "");
      if (["과목명", "교과", "구분", "학기별점수", "교과성적"].includes(subName)) continue;

      // Group items into each semester's X column range
      for (const sem of SEMESTER_X_RANGES) {
        const semItems = rowItems.filter((it) => it.x >= sem.minX && it.x <= sem.maxX);
        if (semItems.length === 0) continue;

        const isZero = semItems.every((it) => it.str === "0");
        if (isZero) continue;

        let rawScore = 0;
        let ach = "B";

        for (const it of semItems) {
          if (/^[A-E]$/.test(it.str)) {
            ach = it.str;
          } else if (/^[0-9]+(?:\.[0-9]+)?$/.test(it.str)) {
            const val = parseFloat(it.str);
            if (val > 5) {
              rawScore = val;
            }
          }
        }

        if (rawScore > 0 || semItems.some((it) => /^[A-E]$/.test(it.str))) {
          semestersData[sem.id].push({
            name: subName,
            score: rawScore,
            achievement: ach,
          });
        }
      }
    }
  }

  return {
    pageNumber,
    name: studentName || `학생 ${pageNumber}`,
    gradeLevel,
    classInfo,
    schoolRank,
    totalStudents,
    percentile,
    classRank,
    classTotalStudents,
    semesters: semestersData,
    schoolName,
    teacherName,
    issueDate,
  };
}

/**
 * Converts a ParsedPdfStudent into a full StudentProfile object with all semester metrics
 */
export function convertParsedToStudentProfile(
  raw: ParsedPdfStudent,
  idSuffix: string | number,
  semesterCountsOverride?: Record<string, { totalStudents: number; classTotalStudents: number }>
): StudentProfile {
  const fallbackTotalStudents = raw.totalStudents && raw.totalStudents > 0 ? raw.totalStudents : 109;
  const fallbackClassTotal = raw.classTotalStudents && raw.classTotalStudents > 0 ? raw.classTotalStudents : 30;

  // Build 5 semesters
  const semesters: Record<string, SemesterGradeRecord> = {};

  SEMESTERS_META.forEach((meta) => {
    const semSubjects = raw.semesters[meta.id] || [];
    const isEntered = semSubjects.length > 0;
    const override = semesterCountsOverride?.[meta.id];
    const semTotal =
      override?.totalStudents && override.totalStudents > 0
        ? override.totalStudents
        : fallbackTotalStudents;
    const semClassTotal =
      override?.classTotalStudents && override.classTotalStudents > 0
        ? override.classTotalStudents
        : fallbackClassTotal;

    if (!isEntered) {
      semesters[meta.id] = createEmptySemester(meta.id, semTotal, semClassTotal);
      return;
    }

    const fullSubjects: SubjectGrade[] = semSubjects.map((sub, idx) => {
      const ach = (
        ["A", "B", "C", "D", "E"].includes(sub.achievement)
          ? sub.achievement
          : getAchievementGrade(sub.score)
      ) as "A" | "B" | "C" | "D" | "E";

      return computeSubjectMetrics(
        {
          id: `sub-${meta.id}-${idx + 1}-${idSuffix}`,
          name: sub.name,
          score: sub.score,
          mean: 68.0,
          stdDev: 18.0,
          achievement: ach,
          weeklyStudyHours: 4,
          targetScore: Math.min(100, sub.score + 6),
        },
        semTotal
      );
    });

    semesters[meta.id] = computeSemesterRecord(
      {
        semesterId: meta.id,
        semesterName: meta.name,
        gradeYear: meta.gradeYear,
        term: meta.term,
        subjects: fullSubjects,
        totalStudents: semTotal,
        classTotalStudents: semClassTotal,
        schoolRank: meta.id === "3-1" ? raw.schoolRank : undefined,
        classRank: meta.id === "3-1" ? raw.classRank : undefined,
        isEntered: true,
      },
      semTotal
    );
  });

  // Determine active semester (latest entered, default 3-1 if available)
  const enteredKeys = Object.keys(raw.semesters).filter(
    (k) => raw.semesters[k]?.length > 0
  );
  const activeSemesterId =
    enteredKeys.length > 0 ? enteredKeys[enteredKeys.length - 1] : "3-1";

  const activeSemRec = semesters[activeSemesterId];

  const student: StudentProfile = {
    id: `student-pdf-${idSuffix}`,
    name: raw.name,
    gradeLevel: raw.gradeLevel || "중학교 3학년",
    currentSemester: "3학년 1학기",
    activeSemesterId,
    totalStudents: activeSemRec?.totalStudents || fallbackTotalStudents,
    classTotalStudents: activeSemRec?.classTotalStudents || fallbackClassTotal,
    schoolRank: raw.schoolRank,
    classRank: raw.classRank,
    overallPercentile: raw.percentile || 0,
    overallAverage: 0,
    estimatedRank: raw.schoolRank || 0,
    totalScore: 0,
    cumulativeRank: raw.schoolRank,
    cumulativePercentile: raw.percentile,
    cumulativeTotalStudents: fallbackTotalStudents,
    studyGoal: "내신 성적 향상 및 고입 고득점 달성",
    notes: `${raw.classInfo || ""} 내신성적 통지표 자동 변환 등록`,
    subjects: [],
    semesters,
  };

  return recomputeStudentProfile(student, activeSemesterId);
}

/**
 * Client-side browser parser using pdfjs-dist
 */
export async function parsePdfReportCards(file: File | ArrayBuffer | Uint8Array): Promise<PdfParseResult> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Configure worker for browser or worker environment
  if (typeof window !== "undefined") {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        // Fallback to CDN matching installed pdfjs-dist version
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }
    } catch {
      // Ignore worker assignment failure
    }
  }

  let dataArray: Uint8Array;
  if (file instanceof File) {
    const buffer = await file.arrayBuffer();
    dataArray = new Uint8Array(buffer);
  } else if (file instanceof ArrayBuffer) {
    dataArray = new Uint8Array(file);
  } else {
    dataArray = file;
  }

  const doc = await pdfjsLib.getDocument({ data: dataArray }).promise;
  const numPages = doc.numPages;

  const rawParsedStudents: ParsedPdfStudent[] = [];
  let detectedSchoolName = "중학교";
  let detectedGradeAndClass = "3학년 2반";
  let detectedTeacher = "";
  let detectedDate = "";

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it: any) => ({
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
        str: it.str,
      }));

    const parsed = parsePageItemsToStudent(items, pageNum);
    rawParsedStudents.push(parsed);

    if (pageNum === 1) {
      if (parsed.schoolName) detectedSchoolName = parsed.schoolName;
      if (parsed.classInfo) detectedGradeAndClass = parsed.classInfo.split(" ").slice(0, 2).join(" ");
      if (parsed.teacherName) detectedTeacher = parsed.teacherName;
      if (parsed.issueDate) detectedDate = parsed.issueDate;
    }
  }

  // Convert raw parsed students to full StudentProfiles
  const students: StudentProfile[] = rawParsedStudents.map((raw, idx) =>
    convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`)
  );

  return {
    schoolName: detectedSchoolName,
    gradeAndClass: detectedGradeAndClass,
    teacherName: detectedTeacher,
    issueDate: detectedDate,
    studentsCount: students.length,
    students,
    rawParsedStudents,
  };
}
