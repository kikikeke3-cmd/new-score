import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Plus,
  Flame,
  Calendar,
  BookOpen,
  Send,
  Sparkles,
  Award,
  Trash2,
  ShieldCheck,
  ChevronRight,
  Coffee,
} from "lucide-react";
import { StudyLogEntry } from "../types";
import { saveStudyLog, fetchStudyLogs, deleteStudyLog } from "../lib/studySync";

interface StudentStudyPlannerViewProps {
  studentId: string;
  studentName: string;
  initialSubjects?: string[];
}

export const StudentStudyPlannerView: React.FC<StudentStudyPlannerViewProps> = ({
  studentId,
  studentName,
  initialSubjects,
}) => {
  // Available subjects (STRICTLY NAMES ONLY, absolutely no grade or rank data!)
  const [subjects, setSubjects] = useState<string[]>(() => {
    if (initialSubjects && initialSubjects.length > 0) return initialSubjects;
    return ["국어", "수학", "영어", "과학", "역사/사회", "도덕", "기술과정", "한문", "정보", "기타"];
  });

  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || "수학");

  // Timer states
  // timerType: "stopwatch" (counts up) | "pomodoro25" (25 mins count down) | "focus50" (50 mins count down)
  const [timerType, setTimerType] = useState<"stopwatch" | "pomodoro25" | "focus50">("stopwatch");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // for stopwatch (counts up)
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60); // for countdown modes
  const [sessionMemo, setSessionMemo] = useState("");

  // Manual entry toggle
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSubject, setManualSubject] = useState(subjects[0] || "수학");
  const [manualMinutes, setManualMinutes] = useState(60);
  const [manualMemo, setManualMemo] = useState("");

  // Logs list & weekly totals
  const [logs, setLogs] = useState<StudyLogEntry[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<Record<string, number>>({});
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Load study logs
  const loadLogs = async () => {
    try {
      const data = await fetchStudyLogs(studentId);
      setLogs(data.logs);
      setWeeklyHours(data.weeklyHoursBySubject);
    } catch (err) {
      console.warn("Failed to load logs:", err);
    }
  };

  useEffect(() => {
    loadLogs();

    // Check if server has registered subject list
    fetch(`/api/student-study-meta?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.meta?.subjects?.length > 0) {
          setSubjects(json.meta.subjects);
          if (!json.meta.subjects.includes(selectedSubject)) {
            setSelectedSubject(json.meta.subjects[0]);
          }
        }
      })
      .catch(() => {});
  }, [studentId]);

  // Timer interval ticker
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        if (timerType === "stopwatch") {
          setElapsedSeconds((prev) => prev + 1);
        } else {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              setIsRunning(false);
              handleTimerComplete();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timerType]);

  const handleStartPause = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    if (timerType === "stopwatch") {
      setElapsedSeconds(0);
    } else if (timerType === "pomodoro25") {
      setRemainingSeconds(25 * 60);
    } else {
      setRemainingSeconds(50 * 60);
    }
  };

  const handleModeChange = (mode: "stopwatch" | "pomodoro25" | "focus50") => {
    setIsRunning(false);
    setTimerType(mode);
    if (mode === "stopwatch") {
      setElapsedSeconds(0);
    } else if (mode === "pomodoro25") {
      setRemainingSeconds(25 * 60);
    } else {
      setRemainingSeconds(50 * 60);
    }
  };

  // Called when countdown reaches 0
  const handleTimerComplete = async () => {
    const minutes = timerType === "pomodoro25" ? 25 : 50;
    await recordStudySession(minutes, sessionMemo || `${timerType === "pomodoro25" ? "25분 뽀모도로" : "50분 집중"} 완료`);
  };

  // Manual save for current stopwatch/timer session
  const handleSaveCurrentSession = async () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);

    let minutes = 0;
    if (timerType === "stopwatch") {
      minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    } else if (timerType === "pomodoro25") {
      const studiedSec = 25 * 60 - remainingSeconds;
      minutes = Math.max(1, Math.round(studiedSec / 60));
    } else {
      const studiedSec = 50 * 60 - remainingSeconds;
      minutes = Math.max(1, Math.round(studiedSec / 60));
    }

    if (minutes <= 0) return;

    await recordStudySession(minutes, sessionMemo);
    handleReset();
    setSessionMemo("");
  };

  // Core recording helper
  const recordStudySession = async (minutes: number, memoText: string) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const res = await saveStudyLog({
      studentId,
      studentName,
      subjectName: selectedSubject,
      durationMinutes: minutes,
      studyDate: todayStr,
      memo: memoText || "자율 학습 집중",
    });

    if (res.success) {
      setSaveSuccessNotice(
        `🎉 [${selectedSubject}] ${minutes}분 공부 기록이 저장되어 담당 선생님께 전송되었습니다!`
      );
      setTimeout(() => setSaveSuccessNotice(null), 4000);
      await loadLogs();
    }
  };

  // Manual entry submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualMinutes <= 0) return;

    const todayStr = new Date().toISOString().split("T")[0];
    await saveStudyLog({
      studentId,
      studentName,
      subjectName: manualSubject,
      durationMinutes: manualMinutes,
      studyDate: todayStr,
      memo: manualMemo || "직접 입력한 공부 시간",
    });

    setSaveSuccessNotice(
      `🎉 [${manualSubject}] ${manualMinutes}분 공부가 기록되어 선생님께 전달되었습니다!`
    );
    setTimeout(() => setSaveSuccessNotice(null), 4000);
    setIsManualModalOpen(false);
    setManualMemo("");
    await loadLogs();
  };

  const handleDeleteLog = async (logId: string) => {
    await deleteStudyLog(studentId, logId);
    await loadLogs();
  };

  // Time format helpers
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Today's total minutes calculation
  const todayStr = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter((l) => l.studyDate === todayStr);
  const todayTotalMinutes = todayLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const todayHours = Math.floor(todayTotalMinutes / 60);
  const todayRemainingMinutes = todayTotalMinutes % 60;

  // Weekly total minutes calculation
  const weeklyTotalHours = Object.values(weeklyHours).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100">
      {/* Top Banner / Student Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 tracking-tight">
                  {studentName} 학생의 스터디 플래너
                </h1>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>실시간 연동</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                공부 시간을 기록하면 담당 선생님 대시보드에 즉시 반영됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>직접 시간 입력</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Student Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Safe Privacy Assurance Banner */}
        <div className="p-3 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold">
              학생 전용 스터디 타이머 모드 (공부 시간만 기록되며, 시험 성적 및 석차는 노출되지 않습니다)
            </span>
          </div>
          <span className="text-[11px] font-mono text-blue-700 shrink-0 font-bold">
            {todayStr}
          </span>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessNotice && (
          <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-md text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessNotice}</span>
            </div>
            <button
              onClick={() => setSaveSuccessNotice(null)}
              className="text-white/80 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Interactive Study Timer Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* Subject Selector Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>지금 공부할 과목을 선택하세요:</span>
              </label>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                선택: {selectedSubject}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {subjects.map((subName) => {
                const isSelected = selectedSubject === subName;
                return (
                  <button
                    key={subName}
                    type="button"
                    onClick={() => {
                      if (!isRunning) setSelectedSubject(subName);
                    }}
                    disabled={isRunning}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {subName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timer Mode Selector */}
          <div className="flex items-center justify-center p-1 bg-slate-100 rounded-2xl max-w-sm mx-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => handleModeChange("stopwatch")}
              disabled={isRunning}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer ${
                timerType === "stopwatch"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ⏱️ 스톱워치
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("pomodoro25")}
              disabled={isRunning}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer ${
                timerType === "pomodoro25"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🍅 25분 뽀모도로
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("focus50")}
              disabled={isRunning}
              className={`flex-1 py-1.5 rounded-xl transition cursor-pointer ${
                timerType === "focus50"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🎯 50분 집중
            </button>
          </div>

          {/* Big Digital Display */}
          <div className="py-4 text-center space-y-2">
            <div className="inline-block relative">
              <div
                className={`text-6xl sm:text-7xl font-black font-mono tracking-tight transition-colors ${
                  isRunning ? "text-blue-600" : "text-slate-800"
                }`}
              >
                {timerType === "stopwatch"
                  ? formatTime(elapsedSeconds)
                  : formatTime(remainingSeconds)}
              </div>
              {isRunning && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 animate-pulse">
                  <Flame className="w-4 h-4 fill-emerald-500" />
                  <span>{selectedSubject} 열공 중! 집중 시간을 측정하고 있습니다</span>
                </div>
              )}
            </div>

            {/* Memo input for the current session */}
            <div className="max-w-md mx-auto pt-2">
              <input
                type="text"
                placeholder="공부 내용 또는 문제집 페이지 메모 (예: 쎈수학 삼각비 C단계 1~10번 풀이)"
                value={sessionMemo}
                onChange={(e) => setSessionMemo(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-blue-500 outline-hidden transition text-center"
              />
            </div>
          </div>

          {/* Timer Buttons */}
          {(() => {
            const hasActiveSession =
              isRunning ||
              (timerType === "stopwatch" && elapsedSeconds > 0) ||
              (timerType !== "stopwatch" &&
                remainingSeconds < (timerType === "pomodoro25" ? 25 * 60 : 50 * 60));

            return (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartPause}
                  className={`px-7 py-3.5 rounded-2xl font-black text-sm transition cursor-pointer shadow-sm flex items-center gap-2 ${
                    isRunning
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>잠시 일시정지</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>
                        {hasActiveSession ? "공부 재개하기" : "공부 시작하기"}
                      </span>
                    </>
                  )}
                </button>

                {/* Save Button: appears simultaneously with [잠시 일시정지] as soon as study starts */}
                {hasActiveSession && (
                  <button
                    type="button"
                    onClick={handleSaveCurrentSession}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm transition cursor-pointer shadow-sm flex items-center gap-2 animate-in fade-in"
                    title="지금까지 공부한 시간을 저장하고 담당 선생님께 전송"
                  >
                    <Send className="w-4 h-4" />
                    <span>공부 완료 & 저장</span>
                  </button>
                )}

                {/* Reset Button (visible when timer has active progress) */}
                {hasActiveSession && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition cursor-pointer"
                    title="타이머 초기화"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* 2. Today's Summary & Streak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>오늘 하루 순공 시간</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                {todayHours > 0 ? `${todayHours}시간 ` : ""}
                {todayRemainingMinutes}분
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                총 {todayLogs.length}회 집중 완료
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              🔥
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>이번 주 누적 학습 시간</span>
              </div>
              <div className="text-2xl font-black text-blue-700 font-mono mt-0.5">
                {weeklyTotalHours.toFixed(1)} <span className="text-sm font-semibold">시간</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                선생님 대시보드와 자동 동기화 중
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              📚
            </div>
          </div>
        </div>

        {/* 3. Today's Study Log Timeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <span>오늘 기록된 학습 내역 ({todayLogs.length}건)</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              최근 기록 순
            </span>
          </div>

          {todayLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-1">
              <p>아직 오늘 기록된 공부 시간이 없습니다.</p>
              <p className="text-[11px] text-slate-400">
                위 스톱워치로 공부를 시작하거나 [직접 시간 입력]으로 오늘 공부를 남겨보세요!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-black text-[11px] shrink-0">
                      {log.subjectName}
                    </span>
                    <span className="font-bold text-slate-900 font-mono shrink-0">
                      {log.durationMinutes}분
                    </span>
                    <span className="text-slate-500 truncate text-[11px]">
                      {log.memo || "자율 학습"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded transition cursor-pointer"
                      title="기록 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                공부 시간 직접 입력하기
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  과목 선택
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setManualSubject(sub)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                        manualSubject === sub
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  공부 시간 (분)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(parseInt(e.target.value, 10) || 0)}
                    className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-sm text-center focus:border-blue-500 outline-hidden"
                  />
                  <span className="text-slate-500 font-bold">분</span>
                  <div className="flex gap-1 ml-auto">
                    {[30, 45, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setManualMinutes(m)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        {m}분
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  공부한 내용 (메모)
                </label>
                <input
                  type="text"
                  placeholder="예: 개념원리 2단원 복습 및 오답 정리"
                  value={manualMemo}
                  onChange={(e) => setManualMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:border-blue-500 outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>기록 저장 및 선생님께 전송</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
