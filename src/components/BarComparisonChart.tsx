import React, { useState } from "react";
import { SubjectGrade, SemesterData } from "../types";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface BarComparisonChartProps {
  subjects: SubjectGrade[];
  previousSemester?: SemesterData;
}

export const BarComparisonChart: React.FC<BarComparisonChartProps> = ({
  subjects,
  previousSemester,
}) => {
  const [viewMode, setViewMode] = useState<"mean" | "semester">("mean");

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">
            {viewMode === "mean"
              ? "과목별 점수 vs 학교 평균 비교"
              : `이전 학기(${previousSemester?.name || "이전"}) 대비 점수 추이`}
          </h3>
          <p className="text-xs text-slate-500">
            {viewMode === "mean"
              ? "내 점수, 학교 평균, 목표 점수를 한눈에 비교"
              : "과목별 점수 상승 및 하락 변동폭 분석"}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setViewMode("mean")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "mean"
                ? "bg-white text-blue-600 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            학교 평균 대비
          </button>
          <button
            onClick={() => setViewMode("semester")}
            disabled={!previousSemester}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "semester"
                ? "bg-white text-blue-600 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            } ${!previousSemester ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            이전 학기 대비
          </button>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          현재 학기에 등록된 과목이 없습니다. 과목을 추가하거나 성적 파일을 올려주세요.
        </div>
      ) : viewMode === "mean" ? (
        <div className="space-y-4">
          {subjects.map((sub) => {
            const diffWithMean = sub.score - sub.mean;
            const isAboveMean = diffWithMean >= 0;

            return (
              <div key={sub.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 min-w-[70px]">
                      {sub.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        sub.achievement === "A"
                          ? "bg-purple-100 text-purple-700"
                          : sub.achievement === "B"
                          ? "bg-blue-100 text-blue-700"
                          : sub.achievement === "C"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {sub.achievement}등급
                    </span>
                    <span className="text-slate-500">
                      상위 <strong>{sub.percentile.toFixed(1)}%</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 text-sm">{sub.score}점</span>
                    <span
                      className={`text-[11px] font-semibold flex items-center ${
                        isAboveMean ? "text-blue-600" : "text-amber-600"
                      }`}
                    >
                      ({isAboveMean ? "+" : ""}
                      {diffWithMean.toFixed(1)}점)
                    </span>
                  </div>
                </div>

                {/* Progress Comparison Bar */}
                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                  {/* Target Marker */}
                  {sub.targetScore && (
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-emerald-500 z-20"
                      style={{ left: `${sub.targetScore}%` }}
                      title={`목표: ${sub.targetScore}점`}
                    />
                  )}

                  {/* School Mean Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-15"
                    style={{ left: `${sub.mean}%` }}
                    title={`학교 평균: ${sub.mean}점`}
                  />

                  {/* Student Score Bar */}
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sub.score >= 90
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                        : sub.score >= 80
                        ? "bg-gradient-to-r from-blue-400 to-blue-500"
                        : sub.score >= 70
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                        : "bg-gradient-to-r from-amber-400 to-amber-500"
                    }`}
                    style={{ width: `${sub.score}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>학교 평균: {sub.mean}점</span>
                  <span>목표: {sub.targetScore}점</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Semester Comparison View */
        <div className="space-y-3">
          {subjects.map((sub) => {
            const prevSub = previousSemester?.subjects.find(
              (p) => p.name === sub.name
            );
            const prevScore = prevSub ? prevSub.score : null;
            const diff = prevScore !== null ? sub.score - prevScore : 0;

            return (
              <div
                key={sub.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-800 shadow-2xs">
                    {sub.name}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {previousSemester?.name}: {prevScore !== null ? `${prevScore}점` : "자료 없음"}
                      </span>
                      <span className="text-slate-300">→</span>
                      <span className="text-xs font-semibold text-slate-800">
                        현재: <strong>{sub.score}점</strong>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      성취도: {prevSub ? prevSub.achievement : "-"} →{" "}
                      <strong className="text-blue-600">{sub.achievement}</strong>
                    </div>
                  </div>
                </div>

                {prevScore !== null && (
                  <div
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 ${
                      diff > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : diff < 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {diff > 0 ? (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+{diff}점 상승</span>
                      </>
                    ) : diff < 0 ? (
                      <>
                        <ArrowDownRight className="w-4 h-4" />
                        <span>{diff}점 하락</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-3.5 h-3.5" />
                        <span>점수 유지</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
