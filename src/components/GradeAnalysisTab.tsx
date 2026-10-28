import React, { useState } from "react";
import { StudentProfile, SubjectGrade } from "../types";
import { RadarChart } from "./RadarChart";
import { BarComparisonChart } from "./BarComparisonChart";
import { PercentileGauge } from "./PercentileGauge";
import {
  computeSubjectMetrics,
  recomputeStudentProfile,
  getAchievementGrade,
} from "../lib/gradeCalculator";
import { parseTextPastedGrades } from "../lib/sheetParser";
import {
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  CheckCircle2,
  Calculator,
  AlertCircle,
  ClipboardPaste,
  FileText,
  RotateCcw,
} from "lucide-react";

interface GradeAnalysisTabProps {
  student: StudentProfile;
  onUpdateStudent: (updated: StudentProfile) => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenImportModal: () => void;
}

export const GradeAnalysisTab: React.FC<GradeAnalysisTabProps> = ({
  student,
  onUpdateStudent,
  onNavigateToTab,
  onOpenImportModal,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newScore, setNewScore] = useState(80);
  const [newMean, setNewMean] = useState(68);

  // Bulk paste & re-enter modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState("");

  // Notice after manual refresh
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const activeSemId = student.activeSemesterId || "2-2";
  const curSemesterRecord = student.semesters?.[activeSemId];

  // Refresh & Recompute all grades
  const handleRefreshGrades = () => {
    const updated = recomputeStudentProfile(student, activeSemId);
    onUpdateStudent(updated);
    setRefreshNotice("성적이 새로고침되었습니다. (과목별 원점수, 전체 평균, 학년/학급 석차 및 백분위 최신 재산출 완료)");
    setTimeout(() => setRefreshNotice(null), 3500);
  };

  // Handle direct semester summary metadata edits (overallAverage, schoolRank, classRank, totalScore)
  const handleSemesterMetaChange = (
    field: "overallAverage" | "schoolRank" | "classRank" | "totalScore" | "classTotalStudents" | "totalStudents",
    valStr: string
  ) => {
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ""));
    const safeNum = isNaN(num) ? undefined : num;

    const curSem = student.semesters?.[activeSemId] || {
      semesterId: activeSemId,
      semesterName: student.currentSemester,
      gradeYear: 2 as const,
      term: 2 as const,
      subjects: student.subjects,
      overallAverage: student.overallAverage,
      overallPercentile: student.overallPercentile,
      estimatedRank: student.estimatedRank,
      isEntered: true,
    };

    const updatedSem = {
      ...curSem,
      [field]: safeNum,
    };

    const updatedProfile = recomputeStudentProfile(
      {
        ...student,
        totalStudents: field === "totalStudents" && safeNum ? safeNum : student.totalStudents,
        classTotalStudents: field === "classTotalStudents" && safeNum ? safeNum : student.classTotalStudents,
        semesters: {
          ...student.semesters,
          [activeSemId]: updatedSem,
        },
      },
      activeSemId
    );
    onUpdateStudent(updatedProfile);
  };

  // Handle subject field change
  const handleSubjectChange = (
    subId: string,
    field: keyof SubjectGrade,
    value: any
  ) => {
    const updatedSubjects = student.subjects.map((sub) => {
      if (sub.id !== subId) return sub;

      const numVal = typeof value === "number" ? value : parseFloat(value) || 0;
      const updated = {
        ...sub,
        [field]: field === "achievement" || field === "name" ? value : numVal,
      };

      if (field === "score") {
        updated.achievement = getAchievementGrade(numVal);
      }

      return computeSubjectMetrics(updated, student.totalStudents, curSemesterRecord?.overallAverage);
    });

    const curSem = student.semesters?.[activeSemId];
    const updatedProfile = recomputeStudentProfile(
      {
        ...student,
        semesters: {
          ...student.semesters,
          [activeSemId]: {
            ...(curSem || {
              semesterId: activeSemId,
              semesterName: student.currentSemester,
              gradeYear: 2 as const,
              term: 2 as const,
              overallAverage: 0,
              overallPercentile: 0,
              estimatedRank: 0,
              isEntered: true,
            }),
            subjects: updatedSubjects,
            isEntered: updatedSubjects.length > 0,
          },
        },
        subjects: updatedSubjects,
      },
      activeSemId
    );
    onUpdateStudent(updatedProfile);
  };

  // Delete subject - Allows deleting all subjects including the last one
  const handleDeleteSubject = (subId: string) => {
    const filtered = student.subjects.filter((s) => s.id !== subId);
    const curSem = student.semesters?.[activeSemId];
    const updatedProfile = recomputeStudentProfile(
      {
        ...student,
        semesters: {
          ...student.semesters,
          [activeSemId]: {
            ...(curSem || {
              semesterId: activeSemId,
              semesterName: student.currentSemester,
              gradeYear: 2 as const,
              term: 2 as const,
              overallAverage: 0,
              overallPercentile: 0,
              estimatedRank: 0,
              isEntered: false,
            }),
            subjects: filtered,
            isEntered: filtered.length > 0 || (curSem?.overallAverage ? curSem.overallAverage > 0 : false),
          },
        },
        subjects: filtered,
      },
      activeSemId
    );
    onUpdateStudent(updatedProfile);
  };

  // Add subject
  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    const newSub: SubjectGrade = computeSubjectMetrics(
      {
        id: `sub-${Date.now()}`,
        name: newSubjectName.trim(),
        score: newScore,
        mean: newMean,
        stdDev: 18.0,
        achievement: getAchievementGrade(newScore),
        weeklyStudyHours: 4,
        targetScore: Math.min(100, newScore + 8),
      },
      student.totalStudents,
      curSemesterRecord?.overallAverage
    );

    const newSubjects = [...student.subjects, newSub];
    const curSem = student.semesters?.[activeSemId];

    onUpdateStudent(
      recomputeStudentProfile(
        {
          ...student,
          semesters: {
            ...student.semesters,
            [activeSemId]: {
              ...(curSem || {
                semesterId: activeSemId,
                semesterName: student.currentSemester,
                gradeYear: 2 as const,
                term: 2 as const,
                overallAverage: 0,
                overallPercentile: 0,
                estimatedRank: 0,
                isEntered: true,
              }),
              subjects: newSubjects,
              isEntered: true,
            },
          },
          subjects: newSubjects,
        },
        activeSemId
      )
    );

    setNewSubjectName("");
    setIsAddModalOpen(false);
  };

  // Open bulk grade input modal
  const handleOpenBulkModal = () => {
    const currentLines = student.subjects
      .map((s) => `${s.name} ${s.score}`)
      .join("\n");
    setBulkInputText(currentLines);
    setIsBulkModalOpen(true);
  };

  // Apply bulk pasted/typed grades
  const handleApplyBulkGrades = () => {
    const parsed = parseTextPastedGrades(bulkInputText);
    if (parsed.subjects.length === 0) {
      alert("입력된 내용에서 과목명과 점수를 찾지 못했습니다.\n예시:\n국어 95\n수학 88\n영어 92\n과학 85");
      return;
    }

    const fullSubjects: SubjectGrade[] = parsed.subjects.map((sub) =>
      computeSubjectMetrics(sub, student.totalStudents, parsed.overallAverage)
    );

    const curSem = student.semesters?.[activeSemId];
    const calcTotal = fullSubjects.reduce((sum, s) => sum + s.score, 0);
    const avg =
      parsed.overallAverage && parsed.overallAverage > 0
        ? parsed.overallAverage
        : parseFloat((calcTotal / fullSubjects.length).toFixed(1));

    const updatedProfile = recomputeStudentProfile(
      {
        ...student,
        semesters: {
          ...student.semesters,
          [activeSemId]: {
            ...(curSem || {
              semesterId: activeSemId,
              semesterName: student.currentSemester,
              gradeYear: 2 as const,
              term: 2 as const,
              overallAverage: 0,
              overallPercentile: 0,
              estimatedRank: 0,
              isEntered: true,
            }),
            subjects: fullSubjects,
            totalScore: parsed.totalScore || calcTotal,
            overallAverage: avg,
            classRank: parsed.classRank ?? curSem?.classRank,
            schoolRank: parsed.schoolRank ?? curSem?.schoolRank,
            isEntered: fullSubjects.length > 0,
          },
        },
        subjects: fullSubjects,
      },
      activeSemId
    );

    onUpdateStudent(updatedProfile);
    setIsBulkModalOpen(false);
    setRefreshNotice("과목명과 원점수가 성공적으로 재입력되었습니다!");
    setTimeout(() => setRefreshNotice(null), 3500);
  };

  // Grade count breakdown
  const gradeCounts = {
    A: student.subjects.filter((s) => s.achievement === "A").length,
    B: student.subjects.filter((s) => s.achievement === "B").length,
    C: student.subjects.filter((s) => s.achievement === "C").length,
    D: student.subjects.filter((s) => s.achievement === "D").length,
    E: student.subjects.filter((s) => s.achievement === "E").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Key Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <PercentileGauge
          percentile={student.cumulativePercentile ?? student.overallPercentile}
          estimatedRank={student.cumulativeRank ?? student.estimatedRank}
          totalStudents={student.cumulativeTotalStudents ?? student.totalStudents}
          averageScore={student.cumulativeAverage ?? student.overallAverage}
          enteredSemestersCount={student.enteredSemestersCount ?? 1}
          activeSemesterName={student.currentSemester}
          activeSemesterPercentile={student.overallPercentile}
          activeSemesterRank={student.estimatedRank}
        />

        {/* Radar Chart: Balance of Subjects */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">과목별 성취 밸런스 레이더</h3>
              <p className="text-xs text-slate-500">방사형 다각형을 통한 과목별 균형 분석</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-full text-slate-700">
              {student.subjects.length}개 과목
            </span>
          </div>

          <div className="py-2 flex items-center justify-center">
            <RadarChart subjects={student.subjects} size={280} />
          </div>
        </div>

        {/* Quick Insights & Action Callout */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1.5 rounded-lg bg-white/10 text-blue-300">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                중학 성취 인사이트
              </span>
            </div>

            <h4 className="text-lg font-bold mb-2 leading-snug">
              {student.name} 학생의 <br />
              <span className="text-amber-300">최대 성적 도약 포인트</span>
            </h4>

            <p className="text-xs text-blue-100/90 leading-relaxed mb-4">
              입력 완료된 전체 {student.enteredSemestersCount || 1}개 학기 누적 평균{" "}
              <strong>{(student.cumulativeAverage ?? student.overallAverage).toFixed(1)}점</strong>으로 종합 상위{" "}
              <strong>{(student.cumulativePercentile ?? student.overallPercentile).toFixed(1)}%</strong> 수준입니다.
              <span className="block mt-1 text-[11px] text-blue-200">
                (현재 선택된 {student.currentSemester}: {student.overallAverage.toFixed(1)}점, 상위 {student.overallPercentile.toFixed(1)}%)
              </span>
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-between">
                <span className="text-blue-200">성취도 A등급 비율</span>
                <span className="font-bold text-white">
                  {student.subjects.length > 0 ? Math.round((gradeCounts.A / student.subjects.length) * 100) : 0}% ({gradeCounts.A}/{student.subjects.length})
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-between">
                <span className="text-blue-200">주간 총 공부 시간</span>
                <span className="font-bold text-amber-300">
                  {student.subjects.reduce((sum, s) => sum + s.weeklyStudyHours, 0)}시간/주
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex gap-2">
            <button
              onClick={() => onNavigateToTab("counseling")}
              className="flex-1 py-2 px-3 bg-white text-blue-950 font-bold text-xs rounded-xl hover:bg-blue-50 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>1:1 AI 상담 받기</span>
            </button>
            <button
              onClick={() => onNavigateToTab("planner")}
              className="py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>4주 플래너</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Refresh Feedback Banner */}
      {refreshNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{refreshNotice}</span>
          </div>
          <button
            onClick={() => setRefreshNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* Quick Summary Inputs for Semester (원점수, 전체 평균, 학급등수, 학년등수 간편 입력) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calculator className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>[{student.currentSemester}] 학기 종합 성적 간편 입력 & 실시간 산출</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold">
                  원점수·평균·등수만 넣어도 계산
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                과목별 원점수와 함께 전체 평균, 학급등수, 학년등수만 입력해도 전체 성취도·백분위·추이가 즉시 산출됩니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshGrades}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer self-start sm:self-auto"
            title="성적 수정 후 다시 계산하여 최신 통계로 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>🔄 성적 다시 계산 / 새로고침</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Overall Average */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                학기 전체 평균 점수
              </label>
              <span className="text-[10px] text-slate-400">0~100점</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={curSemesterRecord?.overallAverage ?? student.overallAverage}
                onChange={(e) => handleSemesterMetaChange("overallAverage", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-blue-900 text-sm focus:border-blue-500 outline-hidden"
              />
              <span className="text-slate-500 font-bold">점</span>
            </div>
          </div>

          {/* Total Score */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                학기 총점 (원점수 합)
              </label>
              <span className="text-[10px] text-slate-400">자동 또는 직접</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                value={curSemesterRecord?.totalScore ?? student.totalScore ?? 0}
                onChange={(e) => handleSemesterMetaChange("totalScore", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-slate-800 text-sm focus:border-blue-500 outline-hidden"
              />
              <span className="text-slate-500 font-bold">점</span>
            </div>
          </div>

          {/* Per-Semester Total Students (전교생 / 수강자 수) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
                <span>전교생(수강자)</span>
              </label>
              <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-blue-800 rounded font-semibold">전입/전출</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="2000"
                value={curSemesterRecord?.totalStudents ?? student.totalStudents ?? 109}
                onChange={(e) => handleSemesterMetaChange("totalStudents", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg font-black text-blue-900 text-sm focus:border-blue-500 outline-hidden"
                title="해당 학기 전교생 수 (전입·전출 등 학기마다 다른 인원을 반영하여 석차 백분위를 정확히 산출합니다)"
              />
              <span className="text-slate-500 font-bold">명</span>
            </div>
          </div>

          {/* Per-Semester Class Total Students (학급 인원) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                학급 인원
              </label>
              <span className="text-[10px] text-slate-400">반 정원</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="100"
                value={curSemesterRecord?.classTotalStudents ?? student.classTotalStudents ?? 30}
                onChange={(e) => handleSemesterMetaChange("classTotalStudents", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-slate-800 text-sm focus:border-blue-500 outline-hidden"
                title="해당 학기 학급 인원수"
              />
              <span className="text-slate-500 font-bold">명</span>
            </div>
          </div>

          {/* Class Rank */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                학급 내 등수 (반 등수)
              </label>
              <span className="text-[10px] text-slate-400">기준: {curSemesterRecord?.classTotalStudents || student.classTotalStudents || 30}명</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max={curSemesterRecord?.classTotalStudents || 30}
                value={curSemesterRecord?.classRank ?? student.classRank ?? 1}
                onChange={(e) => handleSemesterMetaChange("classRank", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-emerald-800 text-sm focus:border-blue-500 outline-hidden"
              />
              <span className="text-slate-500 font-bold">등</span>
            </div>
          </div>

          {/* School / Grade Rank */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                학년 내 등수 (전교 등수)
              </label>
              <span className="text-[10px] text-slate-400">기준: {curSemesterRecord?.totalStudents || student.totalStudents || 109}명</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max={curSemesterRecord?.totalStudents || student.totalStudents || 109}
                value={curSemesterRecord?.schoolRank ?? student.schoolRank ?? curSemesterRecord?.estimatedRank ?? 1}
                onChange={(e) => handleSemesterMetaChange("schoolRank", e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-purple-900 text-sm focus:border-blue-500 outline-hidden"
              />
              <span className="text-slate-500 font-bold">등</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>[{student.currentSemester}] 과목별 성적 및 통계 상세표</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              과목별 원점수를 수정하거나 삭제·추가할 수 있으며, 상단의 [성적 다시 계산 / 새로고침] 버튼을 눌러 언제든 다시 산출할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleRefreshGrades}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="현재 학기 성적 다시 계산"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>새로고침</span>
            </button>

            <button
              onClick={handleOpenBulkModal}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="과목명과 원점수를 한 번에 붙여넣거나 다시 입력"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>과목·점수 일괄 재입력</span>
            </button>

            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="3개년 성적 파일 한번에 올리기 & 전학년 자동 산출"
            >
              <Upload className="w-4 h-4" />
              <span>3년치 파일 올리기</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>과목 추가</span>
            </button>
          </div>
        </div>

        {/* Quick Google Sheets / 3-Year Upload Callout Banner */}
        <div
          onClick={onOpenImportModal}
          className="mx-5 my-3 p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 hover:from-emerald-100/70 hover:to-blue-100/70 border border-emerald-300 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 text-xs shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-emerald-950 text-xs">
                  3개년(1·2·3학년) 성적 파일 한번에 올리기 & 자동 산출
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                  전학년 일괄
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                5개 학기(1-2, 2-1, 2-2, 3-1, 3-2) 시트 탭이 있는 엑셀(.xlsx)이나 파일을 올리면 성적, 백분위, 석차, 3개년 성장 곡선이 일괄 산출됩니다. (1-1은 자유학기제로 제외)
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs shrink-0 flex items-center gap-1">
            <span>3년치 파일 올리기</span>
            <span>→</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">과목명</th>
                <th className="py-3 px-3">원점수 (0~100)</th>
                <th className="py-3 px-3">학교 평균 (선택)</th>
                <th className="py-3 px-3 text-center">성취도</th>
                <th className="py-3 px-3">추정 백분위</th>
                <th className="py-3 px-3">예상 석차</th>
                <th className="py-3 px-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {student.subjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 bg-slate-50/40">
                    <div className="max-w-md mx-auto space-y-2">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-800 text-sm">
                        현재 학기({student.currentSemester})에 등록된 과목이 없습니다.
                      </p>
                      <p className="text-xs text-slate-500">
                        모든 과목이 삭제되었습니다. 아래 버튼을 눌러 과목을 추가하거나, 일괄 재입력 또는 성적 파일을 업로드하세요.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleOpenBulkModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <ClipboardPaste className="w-4 h-4" />
                          <span>과목·점수 일괄 재입력</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>새 과목 추가</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                student.subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                    {/* Subject Name */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={sub.name}
                        onChange={(e) => handleSubjectChange(sub.id, "name", e.target.value)}
                        className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded outline-hidden w-28"
                      />
                    </td>

                    {/* Raw Score */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={sub.score}
                          onChange={(e) => handleSubjectChange(sub.id, "score", e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:border-blue-500 outline-hidden"
                        />
                        <span className="text-slate-400 font-normal">점</span>
                      </div>
                    </td>

                    {/* School Mean */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={sub.mean || ""}
                          placeholder="68"
                          onChange={(e) => handleSubjectChange(sub.id, "mean", e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:border-blue-500 outline-hidden"
                        />
                        <span className="text-slate-400">점</span>
                      </div>
                    </td>

                    {/* Achievement Grade */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${
                          sub.achievement === "A"
                            ? "bg-purple-100 text-purple-700"
                            : sub.achievement === "B"
                            ? "bg-blue-100 text-blue-700"
                            : sub.achievement === "C"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {sub.achievement}
                      </span>
                    </td>

                    {/* Percentile */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        상위 {sub.percentile.toFixed(1)}%
                      </span>
                    </td>

                    {/* Estimated Rank */}
                    <td className="py-3 px-3 text-slate-700">
                      약 <strong>{sub.estimatedRank}등</strong> / {student.totalStudents}명
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="과목 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar Comparison Chart */}
      <BarComparisonChart
        subjects={student.subjects}
        previousSemester={student.previousSemester}
      />

      {/* Add Subject Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              <span>새 과목 추가하기</span>
            </h3>

            <form onSubmit={handleAddSubjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  과목명
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 기술과정, 한문, 도덕, 정보"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-bold text-slate-900"
                />

                {/* Quick Subject Selection Chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">빠른 선택:</span>
                  {[
                    "기술과정",
                    "한문",
                    "도덕",
                    "정보",
                    "국어",
                    "수학",
                    "영어",
                    "과학",
                    "역사/사회",
                    "음악",
                    "미술",
                    "체육",
                  ].map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setNewSubjectName(sub)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        newSubjectName === sub
                          ? "bg-blue-600 text-white"
                          : sub === "기술과정" || sub === "한문"
                          ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    원점수 (0~100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newScore}
                    onChange={(e) => setNewScore(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    학교 평균 (선택)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="미입력 시 68점"
                    value={newMean}
                    onChange={(e) => setNewMean(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                ※ 표준편차는 입력하지 않으셔도 중학교 정규분포 기준(18.0)으로 정확하게 자동 산출됩니다.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  과목 등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Paste & Re-enter Grades Modal (과목명 & 원점수 일괄 재입력/붙여넣기) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    [{student.currentSemester}] 과목명 & 원점수 일괄 재입력
                  </h3>
                  <p className="text-xs text-slate-500">
                    텍스트를 직접 입력하거나 엑셀/한글 표를 복사해 붙여넣으세요.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    과목명 및 원점수 목록 (줄바꿈 구분)
                  </label>
                  <span className="text-[11px] text-slate-400">형식: 과목 점수</span>
                </div>
                <textarea
                  rows={8}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`예시:\n국어 95\n수학 88\n영어 92\n과학 85\n역사/사회 90\n도덕 94\n기술과정 91\n한문 88\n(선택 추가 줄: '전체평균: 90.0', '학급등수: 2', '학년등수: 12')`}
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-hidden leading-relaxed"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBulkInputText(
                      "국어 85\n수학 85\n영어 85\n과학 85\n역사/사회 85\n도덕 85\n기술과정 85\n한문 85"
                    )
                  }
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  기본 8개 교과(기술과정, 한문 포함) 채우기
                </button>
                <button
                  type="button"
                  onClick={() => setBulkInputText("")}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                >
                  입력창 비우기
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">💡 팁:</p>
                <p>• 엑셀이나 한글에서 과목과 점수 열을 복사(Ctrl+C)하여 여기에 바로 붙여넣기(Ctrl+V)할 수 있습니다.</p>
                <p>• 표준편차 없이도 원점수와 등수(전체평균, 반등수, 전교등수)만으로 성적과 백분위가 완벽히 재산출됩니다.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer font-medium"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkGrades}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  과목 및 점수 저장·적용하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
