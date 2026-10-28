export interface SubjectGrade {
  id: string;
  name: string; // e.g. 국어, 영어, 수학, 사회(역사), 과학, 도덕, 기술가정, 한문
  score: number; // 0 ~ 100
  mean: number; // 과목 평균 (예: 68.4, 미제공 시 68.0 자동 적용)
  stdDev: number; // 표준편차 (예: 17.5, 미제공 시 18.0 자동 적용)
  achievement: 'A' | 'B' | 'C' | 'D' | 'E'; // 성취도
  weeklyStudyHours: number; // 주간 공부 시간 (기본 4)
  targetScore: number; // 목표 점수 (기본 점수+8)
  creditHours?: number; // 주당 시수 (기본 3~4)
  percentile: number; // 상위 누적 % (예: 12.5)
  estimatedRank: number; // 예상 석차 (예: 30)
  classRank?: number; // 학급 내 등수 (반 등수)
  gradeRank?: number; // 학년 내 등수 (전교 등수)
}

export interface SemesterGradeRecord {
  semesterId: string; // "1-1" | "1-2" | "2-1" | "2-2" | "3-1" | "3-2"
  semesterName: string; // "1학년 1학기", "1학년 2학기", "2학년 1학기", "2학년 2학기", "3학년 1학기", "3학년 2학기"
  gradeYear: 1 | 2 | 3;
  term: 1 | 2;
  subjects: SubjectGrade[];
  totalScore?: number; // 총점 (과목 원점수 합계)
  overallAverage: number; // 평균 점수
  totalStudents?: number; // 해당 학기 전교 수강자 수 (전입/전출로 인한 학기별 인원 변동 지원)
  classRank?: number; // 학급 내 등수 (예: 3등)
  classTotalStudents?: number; // 학급 인원수 (기본 28~30명)
  schoolRank?: number; // 학년 내 등수 (예: 15등)
  overallPercentile: number;
  estimatedRank: number;
  isEntered: boolean; // 사용자가 성적을 입력했는지 여부
}

export interface SemesterData {
  id: string;
  name: string; // e.g. "1학년 2학기", "2학년 1학기", "2학년 2학기"
  overallAverage: number;
  totalScore?: number;
  totalStudents?: number;
  classRank?: number;
  classTotalStudents?: number;
  schoolRank?: number;
  overallPercentile: number;
  subjects: {
    name: string;
    score: number;
    achievement: string;
  }[];
}

export interface StudentProfile {
  id: string;
  name: string;
  gradeLevel: string; // "중학교 1학년", "중학교 2학년", "중학교 3학년"
  currentSemester: string; // "2학년 2학기"
  activeSemesterId: string; // "1-1", "1-2", "2-1", "2-2", "3-1", "3-2"
  totalStudents: number; // 전교 수강자 수 (기본 240명)
  classTotalStudents?: number; // 학급 인원수 (기본 30명)
  semesters: Record<string, SemesterGradeRecord>; // 6개 학기 (1-1 ~ 3-2) 전체 데이터
  subjects: SubjectGrade[]; // 현재 활성화된 학기의 과목 목록
  totalScore?: number; // 현재 활성화된 학기의 총점
  overallAverage: number; // 현재 활성화된 학기의 평균
  classRank?: number; // 현재 활성화된 학기의 학급 내 등수
  schoolRank?: number; // 현재 활성화된 학기의 학년 내 등수
  overallPercentile: number; // 현재 활성화된 학기의 백분위
  estimatedRank: number; // 현재 활성화된 학기의 예상 석차

  // All-semesters cumulative metrics (입력된 전체 학기 종합 누적 통계)
  cumulativeAverage?: number; // 전체 학기 누적 종합 평균 점수
  cumulativePercentile?: number; // 전체 학기 누적 종합 백분위
  cumulativeRank?: number; // 전체 학기 누적 종합 예상 석차
  cumulativeTotalStudents?: number; // 전체 학기 종합 기준 수강생 수
  enteredSemestersCount?: number; // 성적이 입력된 총 학기 수
  studyLogs?: StudyLogEntry[]; // 학생이 스터디 타이머/플래너로 직접 기록한 학습 내역

  previousSemester?: SemesterData;
  studyGoal?: string;
  notes?: string;
}

export interface StudyLogEntry {
  id: string;
  studentId: string;
  studentName?: string;
  subjectName: string;
  durationMinutes: number; // 학습 시간 (분)
  studyDate: string; // YYYY-MM-DD
  memo?: string; // 학생이 남긴 공부 내용 또는 메모
  timestamp: number;
}

export interface HabitQuestion {
  id: number;
  category: '계획 수립력' | '집중 및 자기통제' | '개념 및 메타인지' | '시험 전략 및 오답';
  question: string;
  subText?: string;
}

export interface HabitDiagnosisResult {
  personaName: string;
  summary: string;
  totalScore: number;
  scoresByCategory: {
    category: string;
    score: number;
    maxScore: number;
    evaluation: string;
  }[];
  strengths: string[];
  vulnerabilities: string[];
  actionPrescriptions: {
    title: string;
    howTo: string;
    expectedEffect: string;
  }[];
}

export interface StudyPlanTimetableBlock {
  timeSlot: string;
  subject: string;
  content: string;
  type: string;
}

export interface StudyPlanDay {
  day: string;
  allocatedHours: number;
  blocks: StudyPlanTimetableBlock[];
}

export interface StudyPlanFourWeek {
  week: number;
  theme: string;
  focus: string;
  tasks: string[];
}

export interface StudyPlanResult {
  strategySummary: string;
  weeklyFourWeekPlan: StudyPlanFourWeek[];
  timetable: StudyPlanDay[];
  counselorTips: string[];
}
