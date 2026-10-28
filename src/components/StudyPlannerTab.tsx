import React, { useState } from "react";
import { StudentProfile, StudyPlanResult } from "../types";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Plus,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface StudyPlannerTabProps {
  student: StudentProfile;
  studyPlan: StudyPlanResult | null;
  onUpdateStudyPlan: (plan: StudyPlanResult) => void;
  onOpenGoogleSheetsExport: () => void;
}

export const StudyPlannerTab: React.FC<StudyPlannerTabProps> = ({
  student,
  studyPlan,
  onUpdateStudyPlan,
  onOpenGoogleSheetsExport,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [activeWeek, setActiveWeek] = useState<number>(1);

  // Generate automated study plan via server
  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const weakSubjects = student.subjects
        .filter((s) => s.achievement === "C" || s.achievement === "D" || s.achievement === "E" || s.score < 80)
        .map((s) => `${s.name}(현재 ${s.score}점, 목표 ${s.targetScore}점)`);

      const strongSubjects = student.subjects
        .filter((s) => s.achievement === "A" || s.score >= 90)
        .map((s) => `${s.name}(${s.score}점)`);

      const totalHours = student.subjects.reduce(
        (sum, s) => sum + s.weeklyStudyHours,
        0
      );

      const payload = {
        studentName: student.name,
        gradeLevel: student.gradeLevel,
        targetGoal: student.studyGoal || "전과목 평균 90점 이상 및 성취도 올 A 달성",
        weakSubjects,
        strongSubjects,
        weeklyAvailableHours: totalHours || 25,
      };

      const res = await fetch("/api/gemini/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "학습 계획표 생성 실패");
      }

      const data = await res.json();
      if (data.plan) {
        onUpdateStudyPlan(data.plan);
      }
    } catch (err: any) {
      console.error("Study planner error:", err);
      setError(err.message || "학습 계획표 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (taskKey: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskKey]: !prev[taskKey],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              성적 향상을 위한 4주 완성 맞춤형 학습 계획표
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {student.name} 학생의 취약 과목 보완과 주간 가용 순공 시간에 최적화된 시험 대비 일정표
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {studyPlan && (
            <button
              onClick={onOpenGoogleSheetsExport}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <BookOpen className="w-4 h-4" />
              <span>Google Sheets로 내보내기</span>
            </button>
          )}

          <button
            onClick={handleGeneratePlan}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>계획표 설계 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>{studyPlan ? "계획표 다시 생성하기" : "AI 계획표 자동 생성하기"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs">
          <strong>오류:</strong> {error}
        </div>
      )}

      {/* Plan Content */}
      {studyPlan ? (
        <div className="space-y-6">
          {/* Strategy Summary Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-800 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>핵심 전략 요약</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              "{studyPlan.strategySummary}"
            </p>
          </div>

          {/* 4-Week Roadmap Steps */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>D-4주 ~ D-1주 단계별 시험 대비 로드맵 & 체크리스트</span>
            </h3>

            {/* Week Tab Switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {studyPlan.weeklyFourWeekPlan.map((wp) => {
                const isActive = activeWeek === wp.week;
                return (
                  <button
                    key={wp.week}
                    onClick={() => setActiveWeek(wp.week)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-[11px] font-bold opacity-80">
                      STEP {wp.week} (D-{5 - wp.week}주)
                    </div>
                    <div className="text-xs font-bold truncate mt-0.5">
                      {wp.theme}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Week Details */}
            {studyPlan.weeklyFourWeekPlan
              .filter((wp) => wp.week === activeWeek)
              .map((wp) => (
                <div
                  key={wp.week}
                  className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                        D-{5 - wp.week}주차 테마
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-2">
                        {wp.theme}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        🎯 핵심 목표: {wp.focus}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      이번 주 필수 실천 체크리스트:
                    </div>
                    <div className="space-y-2">
                      {wp.tasks.map((task, idx) => {
                        const taskKey = `w${wp.week}-t${idx}`;
                        const isDone = completedTasks[taskKey];

                        return (
                          <div
                            key={taskKey}
                            onClick={() => toggleTask(taskKey)}
                            className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                              isDone
                                ? "bg-emerald-50/80 border-emerald-200 text-slate-400 line-through"
                                : "bg-white border-slate-200 hover:border-blue-300 text-slate-800 shadow-2xs"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition ${
                                isDone
                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isDone && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs font-medium leading-relaxed">
                              {task}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Weekly Timetable Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  월~일 주간 타임블록 공부 시간표
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  학교 수업 이후 및 주말 순공 시간 배분 가이드
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {studyPlan.timetable.map((dayItem) => (
                <div
                  key={dayItem.day}
                  className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-800 text-sm">
                      {dayItem.day}
                    </span>
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      {dayItem.allocatedHours}시간
                    </span>
                  </div>

                  <div className="space-y-2 flex-1">
                    {dayItem.blocks.map((block, bIdx) => (
                      <div
                        key={bIdx}
                        className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-blue-600">{block.subject}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {block.timeSlot}
                          </span>
                        </div>
                        <div className="text-slate-700 text-[11px]">
                          {block.content}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          유형: {block.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Counselor Practical Tips */}
          {studyPlan.counselorTips && studyPlan.counselorTips.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>중학생 자기주도학습 실천 꿀팁</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-amber-950 font-medium">
                {studyPlan.counselorTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            맞춤형 시험 대비 플래너를 생성해보세요
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            학생의 취약 과목과 목표 점수를 바탕으로 D-4주 완성 테마별 체크리스트와
            월~일 주간 타임블록 시간표를 AI가 자동으로 만들어 드립니다.
          </p>

          <button
            onClick={handleGeneratePlan}
            disabled={isLoading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer inline-flex items-center gap-2 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI 4주 학습 플래너 자동 생성</span>
          </button>
        </div>
      )}
    </div>
  );
};
