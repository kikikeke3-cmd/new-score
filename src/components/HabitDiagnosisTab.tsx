import React, { useState } from "react";
import { StudentProfile, HabitDiagnosisResult } from "../types";
import { HABIT_QUESTIONS } from "../lib/gradeCalculator";
import {
  ClipboardCheck,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  RefreshCw,
  BookOpen,
  Award,
} from "lucide-react";

interface HabitDiagnosisTabProps {
  student: StudentProfile;
  diagnosisResult: HabitDiagnosisResult | null;
  onUpdateDiagnosis: (result: HabitDiagnosisResult) => void;
  onOpenGoogleSheetsExport: () => void;
}

export const HabitDiagnosisTab: React.FC<HabitDiagnosisTabProps> = ({
  student,
  diagnosisResult,
  onUpdateDiagnosis,
  onOpenGoogleSheetsExport,
}) => {
  // Answers state: questionId -> score (1 to 5)
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    // default initial responses (sample realistic responses)
    return {
      1: 3,
      2: 4,
      3: 2,
      4: 3,
      5: 3,
      6: 4,
      7: 3,
      8: 4,
      9: 2,
      10: 3,
      11: 3,
      12: 3,
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScoreChange = (qId: number, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: score,
    }));
  };

  const handleRunDiagnosis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payloadAnswers = HABIT_QUESTIONS.map((q) => ({
        questionId: q.id,
        question: q.question,
        score: answers[q.id] || 3,
        category: q.category,
      }));

      const res = await fetch("/api/gemini/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student.name,
          answers: payloadAnswers,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "학습 습관 진단 분석 실패");
      }

      const data = await res.json();
      if (data.diagnosis) {
        const total = Object.values(answers).reduce((a, b) => a + b, 0);
        onUpdateDiagnosis({
          ...data.diagnosis,
          totalScore: total,
        });
      }
    } catch (err: any) {
      console.error("Habit diagnosis error:", err);
      setError(err.message || "학습 습관 진단 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              중학생 자기주도 학습 습관 진단 검사 (12문항)
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            계획력, 집중 및 자기통제, 개념 및 메타인지, 시험 전략 4개 핵심 영역 진단
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {diagnosisResult && (
            <button
              onClick={onOpenGoogleSheetsExport}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <BookOpen className="w-4 h-4" />
              <span>Google Sheets 저장</span>
            </button>
          )}

          <button
            onClick={handleRunDiagnosis}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>습관 유형 진단 중...</span>
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 text-purple-200" />
                <span>{diagnosisResult ? "다시 진단하기" : "학습 습관 AI 진단하기"}</span>
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

      {/* Diagnosis Results Card if exists */}
      {diagnosisResult && (
        <div className="bg-white rounded-2xl border border-purple-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                AI 심층 진단 결과
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                {student.name} 학생은 <span className="text-purple-600">[{diagnosisResult.personaName}]</span> 유형입니다
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {diagnosisResult.summary}
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 text-center min-w-[120px]">
              <div className="text-[11px] text-purple-700 font-semibold">습관 종합 점수</div>
              <div className="text-3xl font-black text-purple-900">
                {totalScore} <span className="text-sm font-normal text-purple-600">/ 60점</span>
              </div>
            </div>
          </div>

          {/* Category Scores Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              4대 핵심 영역별 진단 점수
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {diagnosisResult.scoresByCategory.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800">{cat.category}</span>
                    <span className="font-bold text-purple-700">
                      {cat.score} / {cat.maxScore}점
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (cat.score / cat.maxScore) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">{cat.evaluation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Vulnerabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>현재 잘하고 있는 핵심 우수 습관</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
                {diagnosisResult.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>개선이 시급한 취약 습관 (주의)</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-rose-950 font-medium">
                {diagnosisResult.vulnerabilities.map((vul, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-rose-600 font-bold">•</span>
                    <span>{vul}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Prescriptions */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>오늘부터 실천하는 3대 맞춤형 행동 솔루션</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {diagnosisResult.actionPrescriptions.map((ap, idx) => (
                <div
                  key={idx}
                  className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2"
                >
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    <span>{ap.title}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {ap.howTo}
                  </p>
                  <div className="text-[11px] text-amber-800 font-semibold pt-1 border-t border-amber-200/50">
                    💡 기대 효과: {ap.expectedEffect}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 12 Likert Questions Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              학습 습관 진단 문항 (총 12문항)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              학생의 실제 평소 공부 모습을 솔직하게 체크해주세요 (1점: 전혀 아니다 ~ 5점: 매우 그렇다)
            </p>
          </div>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl">
            합계 {totalScore} / 60점
          </span>
        </div>

        <div className="space-y-4">
          {HABIT_QUESTIONS.map((q, idx) => {
            const currentScore = answers[q.id] || 3;

            return (
              <div
                key={q.id}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                      Q{idx + 1}. {q.category}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {q.question}
                  </h4>
                  {q.subText && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{q.subText}</p>
                  )}
                </div>

                {/* 1 to 5 score selector */}
                <div className="flex items-center gap-1.5 sm:gap-2 self-start lg:self-auto">
                  {[1, 2, 3, 4, 5].map((scoreVal) => {
                    const isSelected = currentScore === scoreVal;
                    const labels = ["전혀아님", "아님", "보통", "그렇다", "매우그럼"];

                    return (
                      <button
                        key={scoreVal}
                        type="button"
                        onClick={() => handleScoreChange(q.id, scoreVal)}
                        className={`w-12 sm:w-14 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? "bg-purple-600 text-white shadow-xs scale-105"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-sm">{scoreVal}</span>
                        <span className="text-[9px] opacity-80">{labels[scoreVal - 1]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleRunDiagnosis}
            disabled={isLoading}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>진단 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>학습 습관 진단 결과 확인하기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
