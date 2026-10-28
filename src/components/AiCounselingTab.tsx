import React, { useState } from "react";
import { StudentProfile, HabitDiagnosisResult } from "../types";
import {
  Sparkles,
  Copy,
  Check,
  Printer,
  RefreshCw,
  BookOpen,
  ChevronRight,
  Send,
  GraduationCap,
} from "lucide-react";

interface AiCounselingTabProps {
  student: StudentProfile;
  habitResult?: HabitDiagnosisResult | null;
  onOpenGoogleSheetsExport: () => void;
}

export const AiCounselingTab: React.FC<AiCounselingTabProps> = ({
  student,
  habitResult,
  onOpenGoogleSheetsExport,
}) => {
  const [counselingReport, setCounselingReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCounselingReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        studentName: student.name,
        gradeLevel: student.gradeLevel,
        semester: student.currentSemester,
        overallAverage: student.overallAverage,
        overallPercentile: student.overallPercentile,
        totalStudents: student.totalStudents,
        estimatedRank: student.estimatedRank,
        subjects: student.subjects.map((s) => ({
          name: s.name,
          score: s.score,
          mean: s.mean,
          stdDev: s.stdDev,
          achievement: s.achievement,
          weeklyStudyHours: s.weeklyStudyHours,
          targetScore: s.targetScore,
          percentile: s.percentile,
        })),
        previousSemester: student.previousSemester
          ? {
              name: student.previousSemester.name,
              overallAverage: student.previousSemester.overallAverage,
              subjectDiffs: student.previousSemester.subjects.map((ps) => {
                const cur = student.subjects.find((s) => s.name === ps.name);
                return {
                  name: ps.name,
                  diff: cur ? cur.score - ps.score : 0,
                };
              }),
            }
          : undefined,
        multiSemesterTrajectory: student.semesters
          ? Object.values(student.semesters)
              .filter((s) => s.isEntered)
              .map((s) => ({
                semesterName: s.semesterName,
                average: s.overallAverage,
              }))
          : undefined,
        habitDiagnosis: habitResult
          ? {
              type: habitResult.personaName,
              totalScore: habitResult.totalScore,
            }
          : undefined,
      };

      const res = await fetch("/api/gemini/counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "상담 리포트 생성에 실패했습니다.");
      }

      const data = await res.json();
      setCounselingReport(data.report);
    } catch (err: any) {
      console.error("Counseling error:", err);
      setError(err.message || "오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!counselingReport) return;
    navigator.clipboard.writeText(counselingReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Action Card */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-xl bg-white/20 text-blue-200">
              <GraduationCap className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
              중학 1:1 수석 상담교사 코칭 솔루션
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-black mb-2">
            {student.name} 학생 맞춤형 성적 성장 처방전
          </h2>
          <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
            전체 백분위(상위 {student.overallPercentile.toFixed(1)}%), 과목별 성취도, 주간 학습 시간,
            이전 학기 추세를 종합하여 어떻게 하면 성적을 비약적으로 성장시킬 수 있을지 실천 가능한 5단계 상담을 제시합니다.
          </p>
        </div>

        <button
          onClick={fetchCounselingReport}
          disabled={isLoading}
          className="px-6 py-3.5 bg-white hover:bg-blue-50 text-blue-950 font-bold rounded-2xl text-sm transition cursor-pointer shadow-md flex items-center justify-center gap-2 self-start md:self-auto shrink-0 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>상담 리포트 분석 중...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{counselingReport ? "상담 리포트 다시 받기" : "1:1 AI 맞춤 상담 시작하기"}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs">
          <strong>상담 생성 실패:</strong> {error}
        </div>
      )}

      {/* Counseling Report Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
          <div className="flex items-center gap-3 text-sm text-slate-700 font-semibold mb-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span>중학교 전문 진로·학습 코칭 모델이 성적 데이터를 심층 분석 중입니다...</span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded-full w-2/3 animate-pulse" />
        </div>
      ) : counselingReport ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Top Bar with actions */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-800">
                {student.name} 학생 1:1 상담 리포트 발급 완료
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>상담문 복사</span>
                  </>
                )}
              </button>

              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>인쇄</span>
              </button>

              <button
                onClick={onOpenGoogleSheetsExport}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Google Sheets에 기록</span>
              </button>
            </div>
          </div>

          {/* Formatted Text Box */}
          <div className="p-6 md:p-8 space-y-4 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-sans">
            {counselingReport}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            아직 생성된 1:1 상담 리포트가 없습니다
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            위의 [1:1 AI 맞춤 상담 시작하기] 버튼을 누르면, Gemini 3.8 Flash가 학생의 과목별 백분위와
            공부 시간, 취약점을 분석하여 맞춤 공부법과 성적 도약 전략을 작성해드립니다.
          </p>

          <button
            onClick={fetchCounselingReport}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>상담 리포트 생성하기</span>
          </button>
        </div>
      )}
    </div>
  );
};
