import {
  SubjectGrade,
  StudentProfile,
  HabitQuestion,
  SemesterGradeRecord,
} from '../types';

export const SEMESTERS_META = [
  { id: '1-2', name: '1학년 2학기', gradeYear: 1 as const, term: 2 as const },
  { id: '2-1', name: '2학년 1학기', gradeYear: 2 as const, term: 1 as const },
  { id: '2-2', name: '2학년 2학기', gradeYear: 2 as const, term: 2 as const },
  { id: '3-1', name: '3학년 1학기', gradeYear: 3 as const, term: 1 as const },
  { id: '3-2', name: '3학년 2학기', gradeYear: 3 as const, term: 2 as const },
];

// Standard normal distribution CDF using Abramowitz and Stegun error function approximation
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Calculate Z-score
export function calculateZScore(score: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0;
  return (score - mean) / stdDev;
}

// Calculate top percentile (상위 누적 백분율 %, e.g. 15.4 means top 15.4%)
export function calculateTopPercentile(score: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) {
    return score >= mean ? 50.0 : 75.0;
  }
  const z = calculateZScore(score, mean, stdDev);
  const cdf = normalCdf(z);
  const topRatio = Math.max(0.001, Math.min(0.999, 1 - cdf));
  return parseFloat((topRatio * 100).toFixed(1));
}

// Calculate estimated rank (예상 석차)
export function calculateRank(percentile: number, totalStudents: number): number {
  const rank = Math.round((percentile / 100) * totalStudents);
  return Math.max(1, Math.min(totalStudents, rank));
}

// Suggest achievement grade based on Korean middle school score standard
export function getAchievementGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'E';
}

// Recalculate all statistics for a subject
// Supports computation even if mean or stdDev are missing/0, or if ranks are directly provided
export function computeSubjectMetrics(
  subject: {
    id: string;
    name: string;
    score: number;
    mean?: number;
    stdDev?: number;
    achievement?: 'A' | 'B' | 'C' | 'D' | 'E';
    weeklyStudyHours?: number;
    targetScore?: number;
    creditHours?: number;
    percentile?: number;
    estimatedRank?: number;
    classRank?: number;
    gradeRank?: number;
  },
  totalStudents: number,
  fallbackOverallAverage?: number
): SubjectGrade {
  const validTotal = totalStudents > 0 ? totalStudents : 240;
  const score = typeof subject.score === 'number' && !isNaN(subject.score) ? Math.max(0, Math.min(100, subject.score)) : 0;
  const mean = subject.mean && subject.mean > 0 ? subject.mean : (fallbackOverallAverage && fallbackOverallAverage > 0 ? fallbackOverallAverage : 68.0);
  const stdDev = subject.stdDev && subject.stdDev > 0 ? subject.stdDev : 18.0;
  const achievement = subject.achievement || getAchievementGrade(score);

  let percentile = 50.0;
  let estimatedRank = 120;

  if (subject.gradeRank && subject.gradeRank > 0) {
    estimatedRank = subject.gradeRank;
    percentile = parseFloat(((subject.gradeRank / validTotal) * 100).toFixed(1));
  } else if (subject.classRank && subject.classRank > 0) {
    percentile = parseFloat(((subject.classRank / 30) * 100).toFixed(1));
    estimatedRank = Math.max(1, Math.round((percentile / 100) * validTotal));
  } else {
    percentile = calculateTopPercentile(score, mean, stdDev);
    estimatedRank = calculateRank(percentile, validTotal);
  }

  return {
    ...subject,
    score,
    mean,
    stdDev,
    achievement,
    weeklyStudyHours: subject.weeklyStudyHours ?? 4,
    targetScore: subject.targetScore ?? Math.min(100, Math.max(score, score + 8)),
    percentile: Math.max(0.1, Math.min(99.9, percentile)),
    estimatedRank: Math.max(1, Math.min(validTotal, estimatedRank)),
  };
}

// Compute statistics for a single semester record
// Fully supports calculating when ONLY raw subject scores, overall average, class rank, and grade rank are given
export function computeSemesterRecord(
  sem: Partial<SemesterGradeRecord> & {
    semesterId: string;
    semesterName: string;
    gradeYear: 1 | 2 | 3;
    term: 1 | 2;
  },
  totalStudents: number
): SemesterGradeRecord {
  const validTotalStudents =
    sem.totalStudents && sem.totalStudents > 0
      ? sem.totalStudents
      : totalStudents > 0
      ? totalStudents
      : 240;
  const classTotal =
    sem.classTotalStudents && sem.classTotalStudents > 0
      ? sem.classTotalStudents
      : 30;

  const subjectsList = sem.subjects || [];

  // Update subjects
  const updatedSubjects = subjectsList.map((sub) =>
    computeSubjectMetrics(sub, validTotalStudents, sem.overallAverage)
  );

  const calcTotal = updatedSubjects.reduce((sum, s) => sum + s.score, 0);

  // If user or sheet provided totalScore, use it; otherwise sum of raw scores
  const totalScore =
    sem.totalScore !== undefined && sem.totalScore > 0
      ? sem.totalScore
      : updatedSubjects.length > 0
      ? calcTotal
      : (sem.overallAverage && sem.overallAverage > 0 ? sem.overallAverage : 0);

  // If user or sheet provided overallAverage, use it; otherwise mean of raw scores
  const avgScore =
    sem.overallAverage !== undefined && sem.overallAverage > 0
      ? sem.overallAverage
      : updatedSubjects.length > 0
      ? parseFloat((calcTotal / updatedSubjects.length).toFixed(1))
      : 0;

  // If this semester is marked not entered, or has no subjects and no average score
  const isEntered =
    sem.isEntered !== false && (updatedSubjects.length > 0 || avgScore > 0);

  if (!isEntered) {
    return {
      semesterId: sem.semesterId,
      semesterName: sem.semesterName,
      gradeYear: sem.gradeYear,
      term: sem.term,
      subjects: updatedSubjects,
      totalScore: 0,
      overallAverage: 0,
      overallPercentile: 0,
      estimatedRank: 0,
      totalStudents: validTotalStudents,
      classTotalStudents: classTotal,
      schoolRank: undefined,
      classRank: undefined,
      isEntered: false,
    };
  }

  // Rank and percentile determination:
  // 1) Grade rank (전교/학년등수) is the most authoritative if provided
  // 2) Class rank (반/학급등수) is second
  // 3) Standard Z-score from subject stats
  let schoolRank = sem.schoolRank && sem.schoolRank > 0 ? sem.schoolRank : undefined;
  let classRank = sem.classRank && sem.classRank > 0 ? sem.classRank : undefined;
  let overallPercentile = sem.overallPercentile || 0;
  let estimatedRank = sem.estimatedRank || 0;

  if (schoolRank && schoolRank > 0) {
    estimatedRank = schoolRank;
    overallPercentile = parseFloat(((schoolRank / validTotalStudents) * 100).toFixed(1));
    if (!classRank || classRank <= 0) {
      classRank = Math.max(1, Math.round((overallPercentile / 100) * classTotal));
    }
  } else if (classRank && classRank > 0) {
    overallPercentile = parseFloat(((classRank / classTotal) * 100).toFixed(1));
    estimatedRank = Math.max(1, Math.round((overallPercentile / 100) * validTotalStudents));
    schoolRank = estimatedRank;
  } else if (updatedSubjects.length > 0) {
    const totalZ = updatedSubjects.reduce((sum, s) => {
      return sum + calculateZScore(s.score, s.mean, s.stdDev);
    }, 0);
    const avgZ = totalZ / updatedSubjects.length;
    overallPercentile = parseFloat(
      (Math.max(0.001, Math.min(0.999, 1 - normalCdf(avgZ))) * 100).toFixed(1)
    );
    estimatedRank = calculateRank(overallPercentile, validTotalStudents);
    schoolRank = estimatedRank;
    classRank = Math.max(1, Math.round((overallPercentile / 100) * classTotal));
  } else if (avgScore > 0) {
    // When no subjects are left but overallAverage exists
    const approxZ = calculateZScore(avgScore, 70, 18);
    overallPercentile = parseFloat(
      (Math.max(0.001, Math.min(0.999, 1 - normalCdf(approxZ))) * 100).toFixed(1)
    );
    estimatedRank = calculateRank(overallPercentile, validTotalStudents);
    schoolRank = estimatedRank;
    classRank = Math.max(1, Math.round((overallPercentile / 100) * classTotal));
  }

  return {
    ...sem,
    subjects: updatedSubjects,
    totalScore: parseFloat(Number(totalScore).toFixed(1)),
    overallAverage: parseFloat(Number(avgScore).toFixed(1)),
    totalStudents: validTotalStudents,
    classTotalStudents: classTotal,
    overallPercentile: Math.max(0.1, Math.min(99.9, overallPercentile)),
    estimatedRank: Math.max(1, Math.min(validTotalStudents, estimatedRank)),
    schoolRank: schoolRank && schoolRank > 0 ? schoolRank : estimatedRank,
    classRank: classRank && classRank > 0 ? classRank : Math.max(1, Math.round((overallPercentile / 100) * classTotal)),
    isEntered: true,
  };
}

// Create an empty semester record
export function createEmptySemester(
  semesterId: string,
  totalStudents: number,
  classTotalStudents: number = 30
): SemesterGradeRecord {
  const meta = SEMESTERS_META.find((m) => m.id === semesterId) || {
    id: semesterId,
    name: `${semesterId}학기`,
    gradeYear: 1 as const,
    term: 1 as const,
  };

  return {
    semesterId,
    semesterName: meta.name,
    gradeYear: meta.gradeYear,
    term: meta.term,
    subjects: [],
    totalScore: 0,
    overallAverage: 0,
    overallPercentile: 0,
    estimatedRank: 0,
    totalStudents: totalStudents > 0 ? totalStudents : 240,
    classTotalStudents,
    schoolRank: undefined,
    classRank: undefined,
    isEntered: false,
  };
}

// Recalculate entire student profile statistics and sync active semester
export function recomputeStudentProfile(
  student: StudentProfile,
  newActiveSemesterId?: string
): StudentProfile {
  let activeSemId = newActiveSemesterId || student.activeSemesterId || '2-2';
  // 1-1 is excluded because of free semester (자유학기제)
  if (activeSemId === '1-1' || !SEMESTERS_META.some((m) => m.id === activeSemId)) {
    activeSemId = '1-2';
  }

  // Ensure all 5 semesters exist in semesters map
  const updatedSemesters: Record<string, SemesterGradeRecord> = {};
  SEMESTERS_META.forEach((meta) => {
    const existing = student.semesters?.[meta.id];
    const semTotal =
      existing?.totalStudents && existing.totalStudents > 0
        ? existing.totalStudents
        : student.totalStudents;
    const semClassTotal =
      existing?.classTotalStudents && existing.classTotalStudents > 0
        ? existing.classTotalStudents
        : student.classTotalStudents || 30;

    if (existing) {
      updatedSemesters[meta.id] = computeSemesterRecord(
        {
          ...existing,
          totalStudents: semTotal,
          classTotalStudents: semClassTotal,
        },
        semTotal
      );
    } else {
      updatedSemesters[meta.id] = createEmptySemester(meta.id, semTotal, semClassTotal);
    }
  });

  // Current active semester
  const activeRecord =
    updatedSemesters[activeSemId] ||
    updatedSemesters['1-2'] ||
    Object.values(updatedSemesters)[0];

  // Find immediate previous semester for comparison
  const semIndex = SEMESTERS_META.findIndex((m) => m.id === activeSemId);
  let previousSemester: StudentProfile['previousSemester'] = undefined;
  if (semIndex > 0) {
    const prevMeta = SEMESTERS_META[semIndex - 1];
    const prevRecord = updatedSemesters[prevMeta.id];
    if (prevRecord && prevRecord.isEntered) {
      previousSemester = {
        id: prevRecord.semesterId,
        name: prevRecord.semesterName,
        totalScore: prevRecord.totalScore,
        overallAverage: prevRecord.overallAverage,
        totalStudents: prevRecord.totalStudents,
        classRank: prevRecord.classRank,
        classTotalStudents: prevRecord.classTotalStudents,
        schoolRank: prevRecord.schoolRank,
        overallPercentile: prevRecord.overallPercentile,
        subjects: prevRecord.subjects.map((s) => ({
          name: s.name,
          score: s.score,
          achievement: s.achievement,
        })),
      };
    }
  }

  // Derive gradeLevel from active semester
  const activeMeta = SEMESTERS_META.find((m) => m.id === activeSemId);
  const currentSemesterName = activeMeta ? activeMeta.name : student.currentSemester;
  const gradeLevel = activeMeta
    ? `중학교 ${activeMeta.gradeYear}학년`
    : student.gradeLevel;

  // Multi-semester cumulative statistics across all entered semesters (3개년/전체 학기 누적 종합 통계)
  const enteredSemesters = Object.values(updatedSemesters).filter(
    (s) => s.isEntered && (s.subjects.length > 0 || s.overallAverage > 0)
  );

  const enteredCount = enteredSemesters.length;
  let cumulativeAverage = 0;
  let cumulativePercentile = 0;
  let cumulativeRank = 0;
  const latestEntered =
    enteredCount > 0 ? enteredSemesters[enteredCount - 1] : activeRecord;
  const cumulativeTotalStudents =
    latestEntered?.totalStudents && latestEntered.totalStudents > 0
      ? latestEntered.totalStudents
      : (activeRecord.totalStudents || student.totalStudents || 109);

  if (enteredCount > 0) {
    const allEnteredSubjects = enteredSemesters.flatMap((s) => s.subjects);
    if (allEnteredSubjects.length > 0) {
      const sumScores = allEnteredSubjects.reduce((sum, s) => sum + s.score, 0);
      cumulativeAverage = parseFloat((sumScores / allEnteredSubjects.length).toFixed(1));

      // Calculate combined Z-score across all entered subjects from all semesters
      const totalZ = allEnteredSubjects.reduce(
        (sum, s) => sum + calculateZScore(s.score, s.mean, s.stdDev),
        0
      );
      const avgZ = totalZ / allEnteredSubjects.length;
      cumulativePercentile = parseFloat(
        (Math.max(0.001, Math.min(0.999, 1 - normalCdf(avgZ))) * 100).toFixed(1)
      );
    } else {
      const sumAverages = enteredSemesters.reduce((sum, s) => sum + s.overallAverage, 0);
      cumulativeAverage = parseFloat((sumAverages / enteredCount).toFixed(1));
      const approxZ = calculateZScore(cumulativeAverage, 70, 18);
      cumulativePercentile = parseFloat(
        (Math.max(0.001, Math.min(0.999, 1 - normalCdf(approxZ))) * 100).toFixed(1)
      );
    }

    // If student has an official authoritative 3-year cumulativeRank & cumulativePercentile (e.g. from report card PDF)
    if (
      student.cumulativeRank &&
      student.cumulativeRank > 0 &&
      student.cumulativePercentile &&
      student.cumulativePercentile > 0
    ) {
      cumulativeRank = student.cumulativeRank;
      cumulativePercentile = student.cumulativePercentile;
    } else {
      cumulativeRank = calculateRank(cumulativePercentile, cumulativeTotalStudents);
    }
  }

  return {
    ...student,
    gradeLevel,
    currentSemester: currentSemesterName,
    activeSemesterId: activeSemId,
    totalStudents: activeRecord.totalStudents || student.totalStudents || 240,
    classTotalStudents: activeRecord.classTotalStudents || student.classTotalStudents || 30,
    semesters: updatedSemesters,
    subjects: activeRecord.subjects,
    totalScore: activeRecord.totalScore,
    overallAverage: activeRecord.overallAverage,
    classRank: activeRecord.classRank,
    schoolRank: activeRecord.schoolRank,
    overallPercentile: activeRecord.overallPercentile,
    estimatedRank: activeRecord.estimatedRank,
    // Cumulative all-semesters metrics
    cumulativeAverage,
    cumulativePercentile,
    cumulativeRank,
    cumulativeTotalStudents,
    enteredSemestersCount: enteredCount,
    previousSemester,
  };
}

// Build initial 5 semesters (1-2 ~ 3-2) for demo student (1-1 is free semester)
function buildDemoSemesters(
  scoresBySem: Record<
    string,
    {
      국어: number;
      수학: number;
      영어: number;
      과학: number;
      역사: number;
      기술과정?: number;
      한문?: number;
    }
  >,
  totalStudents: number
): Record<string, SemesterGradeRecord> {
  const semesters: Record<string, SemesterGradeRecord> = {};

  SEMESTERS_META.forEach((meta) => {
    const semScores = scoresBySem[meta.id];
    if (!semScores) {
      semesters[meta.id] = createEmptySemester(meta.id, totalStudents);
      return;
    }

    const techScore = semScores.기술과정 ?? 85;
    const hanScore = semScores.한문 ?? 88;

    const subjects: Omit<SubjectGrade, 'percentile' | 'estimatedRank'>[] = [
      {
        id: `sub-${meta.id}-1`,
        name: '국어',
        score: semScores.국어,
        mean: 69.2,
        stdDev: 18.0,
        achievement: getAchievementGrade(semScores.국어),
        weeklyStudyHours: 4,
        targetScore: 92,
      },
      {
        id: `sub-${meta.id}-2`,
        name: '수학',
        score: semScores.수학,
        mean: 64.0,
        stdDev: 21.0,
        achievement: getAchievementGrade(semScores.수학),
        weeklyStudyHours: 10,
        targetScore: 95,
      },
      {
        id: `sub-${meta.id}-3`,
        name: '영어',
        score: semScores.영어,
        mean: 70.0,
        stdDev: 19.0,
        achievement: getAchievementGrade(semScores.영어),
        weeklyStudyHours: 6,
        targetScore: 90,
      },
      {
        id: `sub-${meta.id}-4`,
        name: '과학',
        score: semScores.과학,
        mean: 67.0,
        stdDev: 17.5,
        achievement: getAchievementGrade(semScores.과학),
        weeklyStudyHours: 4.5,
        targetScore: 95,
      },
      {
        id: `sub-${meta.id}-5`,
        name: '역사/사회',
        score: semScores.역사,
        mean: 72.0,
        stdDev: 16.0,
        achievement: getAchievementGrade(semScores.역사),
        weeklyStudyHours: 3,
        targetScore: 88,
      },
      {
        id: `sub-${meta.id}-6`,
        name: '기술과정',
        score: techScore,
        mean: 71.5,
        stdDev: 16.5,
        achievement: getAchievementGrade(techScore),
        weeklyStudyHours: 2.5,
        targetScore: 92,
      },
      {
        id: `sub-${meta.id}-7`,
        name: '한문',
        score: hanScore,
        mean: 74.0,
        stdDev: 17.0,
        achievement: getAchievementGrade(hanScore),
        weeklyStudyHours: 2,
        targetScore: 95,
      },
    ];

    semesters[meta.id] = computeSemesterRecord(
      {
        semesterId: meta.id,
        semesterName: meta.name,
        gradeYear: meta.gradeYear,
        term: meta.term,
        subjects: subjects as any,
        isEntered: true,
      },
      totalStudents
    );
  });

  return semesters;
}

// Initial realistic demo profiles with 5 semesters (1학년 2학기 ~ 3학년 2학기, 1-1 자유학기제 제외)
export const DEMO_PROFILES: StudentProfile[] = [
  recomputeStudentProfile(
    {
      id: 'student-1',
      name: '김민준',
      gradeLevel: '중학교 2학년',
      currentSemester: '2학년 2학기',
      activeSemesterId: '2-2',
      totalStudents: 240,
      studyGoal: '전과목 올 A 달성 및 전교 20등 이내 진입',
      notes: '수학, 과학 성적은 꾸준히 우수하나 국어 비문학 및 영어 서술형 보완 필요.',
      subjects: [],
      overallAverage: 0,
      overallPercentile: 0,
      estimatedRank: 0,
      semesters: buildDemoSemesters(
        {
          '1-2': { 국어: 74, 수학: 86, 영어: 76, 과학: 83, 역사: 75, 기술과정: 82, 한문: 80 },
          '2-1': { 국어: 76, 수학: 90, 영어: 79, 과학: 88, 역사: 76, 기술과정: 85, 한문: 84 },
          '2-2': { 국어: 80, 수학: 94, 영어: 82, 과학: 92, 역사: 78, 기술과정: 88, 한문: 86 },
          '3-1': { 국어: 84, 수학: 96, 영어: 86, 과학: 94, 역사: 82, 기술과정: 90, 한문: 90 },
          '3-2': { 국어: 88, 수학: 98, 영어: 90, 과학: 96, 역사: 88, 기술과정: 94, 한문: 92 },
        },
        240
      ),
    },
    '2-2'
  ),
  recomputeStudentProfile(
    {
      id: 'student-2',
      name: '이서연',
      gradeLevel: '중학교 3학년',
      currentSemester: '3학년 1학기',
      activeSemesterId: '3-1',
      totalStudents: 220,
      studyGoal: '자사고/특목고 진학을 위한 전과목 최상위 백분위(상위 4% 이내) 달성',
      notes: '전반적으로 전과목 성실하나 수학 킬러문항에서 시간 부족 발생.',
      subjects: [],
      overallAverage: 0,
      overallPercentile: 0,
      estimatedRank: 0,
      semesters: buildDemoSemesters(
        {
          '1-2': { 국어: 91, 수학: 80, 영어: 89, 과학: 86, 역사: 88, 기술과정: 92, 한문: 94 },
          '2-1': { 국어: 93, 수학: 82, 영어: 92, 과학: 88, 역사: 90, 기술과정: 94, 한문: 95 },
          '2-2': { 국어: 94, 수학: 84, 영어: 94, 과학: 90, 역사: 91, 기술과정: 95, 한문: 96 },
          '3-1': { 국어: 96, 수학: 86, 영어: 95, 과학: 91, 역사: 90, 기술과정: 96, 한문: 98 },
          '3-2': { 국어: 98, 수학: 92, 영어: 97, 과학: 95, 역사: 95, 기술과정: 98, 한문: 100 },
        },
        220
      ),
    },
    '3-1'
  ),
  recomputeStudentProfile(
    {
      id: 'student-3',
      name: '박지후',
      gradeLevel: '중학교 1학년',
      currentSemester: '1학년 2학기',
      activeSemesterId: '1-2',
      totalStudents: 250,
      studyGoal: '첫 지필평가 충격 극복, 전과목 B 이상(80점대 진입) 목표',
      notes: '자유학기제(1-1) 이후 첫 지필고사(1-2)에 적응 중, 자기주도 공부 습관 형성 시급.',
      subjects: [],
      overallAverage: 0,
      overallPercentile: 0,
      estimatedRank: 0,
      semesters: buildDemoSemesters(
        {
          '1-2': { 국어: 75, 수학: 68, 영어: 72, 과학: 81, 역사: 72, 기술과정: 78, 한문: 74 },
          '2-1': { 국어: 78, 수학: 74, 영어: 76, 과학: 83, 역사: 75, 기술과정: 80, 한문: 76 },
          '2-2': { 국어: 80, 수학: 78, 영어: 80, 과학: 85, 역사: 78, 기술과정: 82, 한문: 80 },
          '3-1': { 국어: 82, 수학: 82, 영어: 82, 과학: 88, 역사: 82, 기술과정: 85, 한문: 84 },
          '3-2': { 국어: 85, 수학: 86, 영어: 85, 과학: 90, 역사: 85, 기술과정: 88, 한문: 86 },
        },
        250
      ),
    },
    '1-2'
  ),
];

// 12 Korean Middle School Learning Habit Assessment Questions
export const HABIT_QUESTIONS: HabitQuestion[] = [
  {
    id: 1,
    category: '계획 수립력',
    question: '매일 혹은 매주 구체적인 학습 계획(플래너)을 세우고 실천 여부를 점검한다.',
    subText: '단순히 "오늘 공부해야지"가 아니라 과목별 분량과 시간을 정하는지 체크',
  },
  {
    id: 2,
    category: '개념 및 메타인지',
    question: '수업 시간에 배운 핵심 개념을 당일 혹은 24시간 이내에 훑어보며 복습한다.',
    subText: '에빙하우스 망각곡선 극복을 위한 당일 복습 습관',
  },
  {
    id: 3,
    category: '집중 및 자기통제',
    question: '공부할 때 스마트폰을 다른 방에 두거나 알림을 끄고 집중력을 유지한다.',
    subText: '공부 중 SNS나 숏폼 영상으로 흐름이 끊기지 않는지 여부',
  },
  {
    id: 4,
    category: '시험 전략 및 오답',
    question: '틀린 문제는 해설지만 보고 넘어가지 않고, 왜 틀렸는지 이유를 오답노트에 적는다.',
    subText: '개념 부족, 계산 실수, 지문 오독 등 원인 분석',
  },
  {
    id: 5,
    category: '계획 수립력',
    question: '시험 3~4주 전부터 과목별 시험 범위에 맞춘 단계별 시험 대비 계획을 세운다.',
    subText: 'D-30 개념정리 -> D-14 기출문제 -> D-7 오답총정리',
  },
  {
    id: 6,
    category: '개념 및 메타인지',
    question: '모르는 개념이 나오면 대충 넘어가지 않고 선생님, 친구, 인강을 통해 끝까지 해결한다.',
    subText: '스스로 "안다/모른다"를 정확히 구분하고 질문하는 태도',
  },
  {
    id: 7,
    category: '집중 및 자기통제',
    question: '어려운 킬러문제를 만났을 때 바로 답지를 보지 않고 최소 10분 이상 고민해본다.',
    subText: '수학적 끈기와 문제 해결 사고력 훈련',
  },
  {
    id: 8,
    category: '시험 전략 및 오답',
    question: '교과서와 개념서를 먼저 완벽히 이해하고 암기한 후에 문제집을 푼다.',
    subText: '문제 양치기보다 기본 교과서 탐구 활동 및 본문 숙지 우선',
  },
  {
    id: 9,
    category: '계획 수립력',
    question: '자신이 좋아하는 과목만 편식하지 않고, 싫거나 취약한 과목에 먼저 시간을 배분한다.',
    subText: '학습 밸런스 유지 및 취약 과목 우선 공부법',
  },
  {
    id: 10,
    category: '시험 전략 및 오답',
    question: '실제 시험 시간에 맞춰 실전 기출문제를 풀고 마킹 및 검토하는 연습을 한다.',
    subText: '실전 시험 시간 안배 및 긴장감 극복 훈련',
  },
  {
    id: 11,
    category: '집중 및 자기통제',
    question: '주말이나 방학에도 기상 시간과 취침 시간을 일정하게 유지하며 루틴을 지킨다.',
    subText: '바이오리듬 관리 및 주말 공부 연속성 유지',
  },
  {
    id: 12,
    category: '개념 및 메타인지',
    question: '공부한 내용을 친구나 부모님, 혹은 나 자신에게 소리 내어 말로 설명할 수 있다.',
    subText: '파인만 학습법 (설명할 수 있어야 진짜 아는 것)',
  },
];
