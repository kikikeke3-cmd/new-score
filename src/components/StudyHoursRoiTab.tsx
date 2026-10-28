import React, { useState, useEffect, useCallback, useRef } from "react";
import { StudentProfile, StudyLogEntry } from "../types";
import {
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Brain,
  Lightbulb,
  Share2,
  Copy,
  ExternalLink,
  Eye,
  RefreshCw,
  Sparkles,
  BookOpen,
  Calendar,
  X,
  Trash2,
  ShieldCheck,
  Check,
  Smartphone,
  Flame,
} from "lucide-react";
import { generateStudentShareUrl, fetchStudyLogs, deleteStudyLog } from "../lib/studySync";
import { StudentStudyPlannerView } from "./StudentStudyPlannerView";

interface StudyHoursRoiTabProps {
  student: StudentProfile;
  onUpdateSubjectHours?: (subjectId: string, hours: number) => void;
  onBatchUpdateSubjectHours?: (updates: Record<string, number>) => void;
}

export const StudyHoursRoiTab: React.FC<StudyHoursRoiTabProps> = ({
  student,
  onUpdateSubjectHours,
  onBatchUpdateSubjectHours,
}) => {
  // Study Logs state from student
  const [studyLogs, setStudyLogs] = useState<StudyLogEntry[]>([]);
  const [weeklyLoggedHours, setWeeklyLoggedHours] = useState<Record<string, number>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Auto-sync student logged hours to teacher's weeklyStudyHours
  const [autoApplyLogs, setAutoApplyLogs] = useState(true);
  const [syncAlertNotice, setSyncAlertNotice] = useState<string | null>(null);

  // Link copy toast
  const [isCopied, setIsCopied] = useState(false);

  // Preview modal for teacher
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Simulated hours state for time reallocation simulator
  const [simulatedHours, setSimulatedHours] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    student.subjects.forEach((s) => {
      initial[s.id] = s.weeklyStudyHours;
    });
    return initial;
  });

  // Sync simulator state when student subjects change
  useEffect(() => {
    const next: Record<string, number> = {};
    student.subjects.forEach((s) => {
      next[s.id] = s.weeklyStudyHours;
    });
    setSimulatedHours(next);
  }, [student.subjects]);

  // Keep a ref of current weekly study hours to prevent infinite sync loops
  const currentWeeklyHoursRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const map: Record<string, number> = {};
    student.subjects.forEach((s) => {
      map[s.name] = s.weeklyStudyHours;
    });
    currentWeeklyHoursRef.current = map;
  }, [student.subjects]);

  // Load study logs from server & localStorage
  const loadLogs = useCallback(async (isAuto = false) => {
    if (!student.id) return;
    try {
      if (!isAuto) setIsLoadingLogs(true);
      const data = await fetchStudyLogs(student.id);
      setStudyLogs(data.logs);
      setWeeklyLoggedHours(data.weeklyHoursBySubject);
      setLastSyncTime(new Date());

      // If auto-apply is enabled and we have logged hours that differ, update
      if (autoApplyLogs && onBatchUpdateSubjectHours && data.weeklyHoursBySubject) {
        let hasDiff = false;
        const updates: Record<string, number> = {};

        student.subjects.forEach((s) => {
          const logged = data.weeklyHoursBySubject[s.name];
          if (logged !== undefined && logged > 0) {
            const current = currentWeeklyHoursRef.current[s.name] || 0;
            if (Math.abs(current - logged) > 0.05) {
              hasDiff = true;
              updates[s.name] = logged;
            }
          }
        });

        if (hasDiff && Object.keys(updates).length > 0) {
          onBatchUpdateSubjectHours(updates);
          setSyncAlertNotice("학생이 기록한 최신 공부 시간이 주간 학습 시간에 자동 반영되었습니다.");
          setTimeout(() => setSyncAlertNotice(null), 4000);
        }
      }
    } catch (err) {
      console.warn("Failed to load study logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [student.id, student.subjects, autoApplyLogs, onBatchUpdateSubjectHours]);

  // Initial load and periodic polling
  useEffect(() => {
    loadLogs();

    // 1. Listen for BroadcastChannel updates from student timer tabs
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("STUDY_SYNC_CHANNEL");
        channel.onmessage = (event) => {
          if (
            event.data?.type === "NEW_STUDY_LOG" &&
            event.data?.log?.studentId === student.id
          ) {
            loadLogs(true);
            setSyncAlertNotice(
              `⚡ [${event.data.log.subjectName}] 학생이 방금 ${event.data.log.durationMinutes}분 공부를 기록했습니다!`
            );
            setTimeout(() => setSyncAlertNotice(null), 5000);
          } else if (event.data?.type === "DELETE_STUDY_LOG") {
            loadLogs(true);
          }
        };
      } catch {
        // BroadcastChannel not supported or blocked
      }
    }

    // 2. Poll server every 5 seconds to catch mobile/external updates
    const pollInterval = setInterval(() => {
      loadLogs(true);
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        channel.close();
      }
    };
  }, [loadLogs, student.id]);

  // Handle manual log deletion
  const handleDeleteLogItem = async (logId: string) => {
    await deleteStudyLog(student.id, logId);
    loadLogs(false);
  };

  // Copy student shareable URL
  const studentShareUrl = generateStudentShareUrl(
    student.id,
    student.name,
    student.subjects.map((s) => s.name)
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentShareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = studentShareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  // Apply all logged hours to weekly hours manually
  const handleApplyAllLoggedHours = () => {
    if (!onBatchUpdateSubjectHours) return;
    const updates: Record<string, number> = {};
    student.subjects.forEach((s) => {
      const logged = weeklyLoggedHours[s.name];
      if (logged !== undefined) {
        updates[s.name] = logged;
      }
    });
    onBatchUpdateSubjectHours(updates);
    setSyncAlertNotice("학생이 기록한 7일간의 순공 시간이 주간 학습 시간에 일괄 적용되었습니다!");
    setTimeout(() => setSyncAlertNotice(null), 4000);
  };

  const handleSliderChange = (subId: string, newHour: number) => {
    setSimulatedHours((prev) => ({
      ...prev,
      [subId]: newHour,
    }));
    if (onUpdateSubjectHours) {
      onUpdateSubjectHours(subId, newHour);
    }
  };

  const totalWeeklyHours = student.subjects.reduce(
    (sum, s) => sum + s.weeklyStudyHours,
    0
  );

  const simTotalHours = Object.values(simulatedHours).reduce((a, b) => a + b, 0);

  // Calculate efficiency metrics
  // Efficiency = score / weeklyHours (points per weekly hour)
  const subjectEfficiency = student.subjects.map((sub) => {
    const hours = sub.weeklyStudyHours || 0.5;
    const efficiency = sub.score / hours;
    const timeShare = totalWeeklyHours > 0 ? (hours / totalWeeklyHours) * 100 : 0;
    const studentLogged = weeklyLoggedHours[sub.name] || 0;

    // Classification
    let category: "high_yield" | "bottleneck" | "neglected" | "balanced" = "balanced";
    let categoryLabel = "균형 상태";
    let colorClass = "bg-blue-50 text-blue-700 border-blue-200";

    if (sub.score >= 88 && hours <= 6) {
      category = "high_yield";
      categoryLabel = "고효율 효자 과목";
      colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (hours >= 9 && sub.score < 85) {
      category = "bottleneck";
      categoryLabel = "시간 과투자 정체 과목";
      colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (hours <= 3.5 && sub.score < 80) {
      category = "neglected";
      categoryLabel = "투자 시간 부족 과목";
      colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    }

    return {
      ...sub,
      hours,
      efficiency,
      timeShare,
      category,
      categoryLabel,
      colorClass,
      studentLogged,
    };
  });

  // Calculate stats for study logs
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLogs = studyLogs.filter((l) => l.studyDate === todayStr);
  const todayTotalMinutes = todayLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const todayHours = Math.floor(todayTotalMinutes / 60);
  const todayMins = todayTotalMinutes % 60;

  const totalLoggedWeeklyHours = Object.values(weeklyLoggedHours).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Student Live Study Link Sharing Card (Core User Request) */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-indigo-700/50">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 font-bold text-xs flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>학생 모바일 & PC 실시간 스터디플래너</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>성적·석차 100% 완전 비공개 보호</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>실시간 동기화 On</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>{student.name} 학생 전용 학습 기록 링크</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              학생에게 이 링크를 보내주면 스톱워치·뽀모도로 타이머로 공부 시간을 기록할 수 있습니다.{" "}
              <strong className="text-amber-300 font-semibold">
                학생 화면에서는 시험 점수, 석차, 백분위가 완전히 가려져
              </strong>{" "}
              오직 순공 시간만 기록되며, 입력 즉시 여기 대시보드에 반영됩니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg active:scale-98 ${
                isCopied
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:shadow-blue-500/40"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>링크 복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>학생 전용 링크 복사하기</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              title="선생님이 학생 화면을 직접 확인해볼 수 있습니다"
            >
              <Eye className="w-4 h-4 text-blue-300" />
              <span>학생 화면 미리보기</span>
            </button>
          </div>
        </div>

        {/* Sync Controls & Info Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoApplyLogs}
                onChange={(e) => setAutoApplyLogs(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-600 bg-slate-800 cursor-pointer"
              />
              <span className="text-slate-300 font-semibold group-hover:text-white transition">
                학생 기록 순공 시간 자동 반영 (Auto-Sync)
              </span>
            </label>

            <button
              type="button"
              onClick={() => loadLogs(false)}
              disabled={isLoadingLogs}
              className="text-slate-400 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
              <span>
                {lastSyncTime
                  ? `마지막 동기화: ${lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                  : "지금 새로고침"}
              </span>
            </button>
          </div>

          {totalLoggedWeeklyHours > 0 && (
            <button
              type="button"
              onClick={handleApplyAllLoggedHours}
              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-200 rounded-xl font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>학생 기록 순공 합계 ({totalLoggedWeeklyHours.toFixed(1)}시간) 일괄 적용</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Alert Toast */}
      {syncAlertNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold text-xs sm:text-sm">{syncAlertNotice}</span>
          </div>
          <button
            onClick={() => setSyncAlertNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Real-time Student Study Activity Feed & Statistics */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Flame className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">
                실시간 학생 공부 기록 현황 (Study Activity Feed)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              학생이 스톱워치를 누르거나 입력한 공부 시간 기록이 실시간으로 집계됩니다.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200/70 text-right">
              <span className="text-[10px] text-slate-400 font-bold block">오늘 공부 시간</span>
              <span className="text-sm font-black text-indigo-600">
                {todayHours > 0 ? `${todayHours}시간 ` : ""}
                {todayMins}분
              </span>
            </div>
            <div className="px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200/70 text-right">
              <span className="text-[10px] text-slate-400 font-bold block">최근 7일 누적</span>
              <span className="text-sm font-black text-emerald-600">
                {totalLoggedWeeklyHours.toFixed(1)}시간
              </span>
            </div>
          </div>
        </div>

        {/* Study Logs List / Empty State */}
        {studyLogs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">아직 학생의 공부 기록이 없습니다</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              상단의 [학생 전용 링크 복사하기]를 눌러 학생에게 링크를 전달하거나, [학생 화면 미리보기]에서 테스트 입력을 해보세요!
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>링크 복사</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>학생 화면 열어보기</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>최근 기록된 공부 세션 ({studyLogs.length}개)</span>
              <span className="text-[11px] text-slate-400">
                *잘못 기록된 항목은 우측 휴지통 아이콘으로 삭제 가능
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {studyLogs.slice(0, 6).map((log) => {
                const isToday = log.studyDate === todayStr;
                const logTime = new Date(log.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-blue-200 hover:shadow-2xs transition flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">
                          {log.subjectName}
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {log.durationMinutes}분
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteLogItem(log.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition cursor-pointer"
                        title="기록 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {log.memo && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2">
                        {log.memo}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>
                        {isToday ? "오늘" : log.studyDate} {logTime}
                      </span>
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        동기화됨
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Subject Study Hours Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Clock className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                과목별 학습 시간 분석 및 ROI (투자 대비 효율성)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              무작정 오래 앉아있는 공부가 아닌, 점수 상승 기여도가 높은 스마트한 시간 배분 전략
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/70">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">주간 총 순공 시간</div>
              <div className="text-2xl font-black text-slate-900">
                {totalWeeklyHours.toFixed(1)}{" "}
                <span className="text-sm font-semibold text-slate-500">시간/주</span>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500 font-medium">하루 평균 순공</div>
              <div className="text-lg font-bold text-indigo-600">
                {(totalWeeklyHours / 7).toFixed(1)} 시간/일
              </div>
            </div>
          </div>
        </div>

        {/* Multi-segment Horizontal Time Share Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">주간 학습 시간 과목별 점유율</span>
            <span className="text-slate-400">합계 {totalWeeklyHours.toFixed(1)}시간 (100%)</span>
          </div>

          <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-100 p-0.5 gap-0.5">
            {subjectEfficiency.map((sub, idx) => {
              const colors = [
                "bg-blue-500",
                "bg-indigo-500",
                "bg-purple-500",
                "bg-emerald-500",
                "bg-amber-500",
                "bg-rose-500",
                "bg-cyan-500",
              ];
              const color = colors[idx % colors.length];

              return (
                <div
                  key={sub.id}
                  style={{ width: `${Math.max(4, sub.timeShare)}%` }}
                  className={`${color} h-full rounded-lg transition-all relative group flex items-center justify-center text-[11px] font-bold text-white overflow-hidden cursor-pointer`}
                  title={`${sub.name}: ${sub.hours}시간 (${sub.timeShare.toFixed(1)}%)`}
                >
                  {sub.timeShare > 8 && sub.name}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-600">
            {subjectEfficiency.map((sub, idx) => {
              const dotColors = [
                "bg-blue-500",
                "bg-indigo-500",
                "bg-purple-500",
                "bg-emerald-500",
                "bg-amber-500",
                "bg-rose-500",
                "bg-cyan-500",
              ];
              return (
                <div key={sub.id} className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${dotColors[idx % dotColors.length]}`}
                  />
                  <span>
                    {sub.name} <strong>{sub.hours}h</strong> ({sub.timeShare.toFixed(0)}%)
                    {sub.studentLogged > 0 && (
                      <span className="text-[10px] text-blue-600 font-medium ml-1">
                        (학생기록: {sub.studentLogged}h)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Three Efficiency Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: High Yield */}
        <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <Zap className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">고효율 효자 과목 (High ROI)</h4>
                <p className="text-[11px] text-emerald-800">적은 공부 시간 대비 88점 이상 고득점</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {subjectEfficiency.filter((s) => s.category === "high_yield").length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">해당 과목 없음</p>
              ) : (
                subjectEfficiency
                  .filter((s) => s.category === "high_yield")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-xl p-3 border border-emerald-100 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          주 {s.hours}시간 투자 → <strong>{s.score}점</strong>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {s.achievement}등급
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs text-emerald-900 leading-relaxed flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>이해도가 이미 높으므로 시간 증량보다는 주간 핵심 문제 감각 유지 추천.</span>
          </div>
        </div>

        {/* Pillar 2: Bottleneck */}
        <div className="bg-rose-50/60 rounded-2xl border border-rose-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                <AlertCircle className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">정체/공부법 점검 과목 (Bottleneck)</h4>
                <p className="text-[11px] text-rose-800">주 9시간 이상 투자했으나 85점 미만</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {subjectEfficiency.filter((s) => s.category === "bottleneck").length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">정체 과목 없음 (양호)</p>
              ) : (
                subjectEfficiency
                  .filter((s) => s.category === "bottleneck")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-xl p-3 border border-rose-100 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          주 <strong className="text-rose-600">{s.hours}시간</strong> 투자 → {s.score}점
                        </div>
                      </div>
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                        {s.achievement}등급
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-200/60 text-xs text-rose-900 leading-relaxed flex items-start gap-1.5">
            <Brain className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span>단순 문제풀이 양만 늘리지 말고, 오답 원인 분석 및 개념 결손 메우기 집중 처방.</span>
          </div>
        </div>

        {/* Pillar 3: Neglected */}
        <div className="bg-amber-50/60 rounded-2xl border border-amber-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">시간 보충 시 급상승 과목 (Neglected)</h4>
                <p className="text-[11px] text-amber-800">주 3.5시간 이하로 투자 부족한 과목</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {subjectEfficiency.filter((s) => s.category === "neglected").length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">방치 과목 없음 (균형적)</p>
              ) : (
                subjectEfficiency
                  .filter((s) => s.category === "neglected")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="bg-white rounded-xl p-3 border border-amber-100 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{s.name}</div>
                        <div className="text-[11px] text-slate-500">
                          주 {s.hours}시간 투자 → {s.score}점
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                        {s.achievement}등급
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/60 text-xs text-amber-900 leading-relaxed flex items-start gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>암기형 사회·역사나 개념 정리는 주 2시간만 추가해도 즉각 10점 상승 가능!</span>
          </div>
        </div>
      </div>

      {/* 5. Interactive Time Reallocation Simulator */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              <span>주간 학습 시간 최적 재분배 시뮬레이터</span>
            </h3>
            <p className="text-xs text-slate-500">
              슬라이더를 움직여 취약 과목에 시간을 보충하고 주간 목표 공부 시간을 설계해보세요.
            </p>
          </div>

          <div className="px-3.5 py-1.5 bg-blue-50 text-blue-800 rounded-xl font-bold text-xs">
            시뮬레이션 총 시간: {simTotalHours.toFixed(1)}시간/주
          </div>
        </div>

        <div className="space-y-4">
          {student.subjects.map((sub) => {
            const curHour = simulatedHours[sub.id] || sub.weeklyStudyHours;
            const diffWithOriginal = curHour - sub.weeklyStudyHours;
            const studentLogged = weeklyLoggedHours[sub.name] || 0;

            return (
              <div
                key={sub.id}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="min-w-[170px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{sub.name}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                        sub.achievement === "A"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {sub.score}점 ({sub.achievement})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>현재: {sub.weeklyStudyHours}시간/주</span>
                    {studentLogged > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSliderChange(sub.id, studentLogged)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        title="학생이 기록한 시간으로 슬라이더 맞추기"
                      >
                        기록값({studentLogged}h) 적용
                      </button>
                    )}
                  </div>
                </div>

                {/* Slider */}
                <div className="flex-1 flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={curHour}
                    onChange={(e) => handleSliderChange(sub.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="min-w-[70px] text-right font-mono">
                    <span className="text-base font-bold text-slate-900">{curHour.toFixed(1)}</span>
                    <span className="text-xs text-slate-500"> 시간</span>
                  </div>
                </div>

                {/* Change delta indicator */}
                <div className="min-w-[100px] text-right">
                  {diffWithOriginal === 0 ? (
                    <span className="text-xs text-slate-400">변동 없음</span>
                  ) : diffWithOriginal > 0 ? (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                      +{diffWithOriginal.toFixed(1)}시간 보충
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      {diffWithOriginal.toFixed(1)}시간 절약
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Teacher's Student Screen Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    학생 화면 미리보기 ({student.name} 학생 전용 뷰)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    선생님이 직접 스톱워치를 누르거나 시간을 입력해 즉시 연동되는지 테스트해보실 수 있습니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: The actual student planner view */}
            <div className="flex-1 overflow-y-auto">
              <StudentStudyPlannerView
                studentId={student.id}
                studentName={student.name}
                initialSubjects={student.subjects.map((s) => s.name)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
