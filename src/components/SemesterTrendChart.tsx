import React, { useState } from "react";
import { StudentProfile } from "../types";
import { SEMESTERS_META } from "../lib/gradeCalculator";
import {
  TrendingUp,
  Award,
  Users,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";

interface SemesterTrendChartProps {
  student: StudentProfile;
  activeSemesterId?: string;
  onSelectSemester?: (semesterId: string) => void;
}

type MetricView = "average" | "rank" | "total" | "subjects";

const SUBJECT_COLORS: Record<string, string> = {
  국어: "#3b82f6", // blue
  수학: "#ef4444", // red
  영어: "#10b981", // emerald
  과학: "#8b5cf6", // violet
  "역사/사회": "#f59e0b", // amber
  사회: "#f59e0b",
  역사: "#f59e0b",
  도덕: "#06b6d4", // cyan
  기술가정: "#ec4899", // pink
};

export const SemesterTrendChart: React.FC<SemesterTrendChartProps> = ({
  student,
  activeSemesterId,
  onSelectSemester,
}) => {
  const [activeMetric, setActiveMetric] = useState<MetricView>("average");
  const [hoveredSemId, setHoveredSemId] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    "국어",
    "수학",
    "영어",
    "과학",
    "역사/사회",
  ]);

  // Build sequential semester data
  const dataPoints = SEMESTERS_META.map((meta, index) => {
    const record = student.semesters?.[meta.id];
    const isEntered = record?.isEntered ?? false;
    const subjects = record?.subjects || [];

    const calculatedTotal = subjects.reduce((sum, s) => sum + s.score, 0);
    const totalScore =
      record?.totalScore !== undefined && record.totalScore > 0
        ? record.totalScore
        : isEntered
        ? calculatedTotal
        : 0;

    const average = record?.overallAverage ?? 0;
    const schoolRank = record?.schoolRank || record?.estimatedRank || 0;
    const classRank =
      record?.classRank ||
      (isEntered
        ? Math.max(1, Math.round((record.overallPercentile / 100) * 30))
        : 0);

    return {
      index,
      semesterId: meta.id,
      semesterName: meta.name,
      shortName: `${meta.gradeYear}-${meta.term}`,
      gradeYear: meta.gradeYear,
      term: meta.term,
      isEntered,
      average,
      totalScore,
      schoolRank,
      classRank,
      percentile: record?.overallPercentile ?? 50,
      subjects,
    };
  });

  const enteredPoints = dataPoints.filter((d) => d.isEntered);

  // All unique subject names
  const allSubjectNames = Array.from(
    new Set(
      Object.values(student.semesters || {}).flatMap((s) =>
        s.subjects.map((sub) => sub.name)
      )
    )
  );

  // SVG dimensions
  const width = 760;
  const height = 300;
  const paddingLeft = 55;
  const paddingRight = 40;
  const paddingTop = 35;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => {
    return paddingLeft + (idx / (dataPoints.length - 1)) * chartWidth;
  };

  // 1. Average scale (0 to 100)
  const minAvg = 40;
  const maxAvg = 100;
  const getYAvg = (score: number) => {
    const clamped = Math.max(minAvg, Math.min(maxAvg, score));
    return paddingTop + chartHeight - ((clamped - minAvg) / (maxAvg - minAvg)) * chartHeight;
  };

  // 2. Total score scale (e.g. 250 to 500)
  const totalScores = dataPoints.map((d) => d.totalScore || 0);
  const maxTotalScore = Math.max(500, ...totalScores) + 20;
  const minTotalScore =
    enteredPoints.length > 0
      ? Math.max(0, Math.min(...enteredPoints.map((d) => d.totalScore || 0)) - 50)
      : 0;
  const getYTotal = (score: number) => {
    const range = Math.max(100, maxTotalScore - minTotalScore);
    return (
      paddingTop +
      chartHeight -
      ((Math.max(minTotalScore, score) - minTotalScore) / range) * chartHeight
    );
  };

  // 3. Rank scale (Inverted! Rank 1 is near top, highest rank number at bottom)
  const maxRankNumber = Math.max(
    student.totalStudents || 240,
    ...enteredPoints.map((d) => d.schoolRank || 0)
  );
  const getYRank = (rank: number, maxRank: number) => {
    if (rank <= 0) return paddingTop + chartHeight;
    const clamped = Math.max(1, Math.min(maxRank, rank));
    // Invert: rank 1 => top (paddingTop), rank max => bottom (paddingTop + chartHeight)
    return paddingTop + ((clamped - 1) / (maxRank - 1)) * chartHeight;
  };

  // Calculate highest & best improvements
  let bestAvgSem = enteredPoints[0];
  let bestRankSem = enteredPoints[0];
  let biggestJump = { from: "", to: "", delta: 0 };

  if (enteredPoints.length > 0) {
    enteredPoints.forEach((d) => {
      if (!bestAvgSem || d.average > bestAvgSem.average) bestAvgSem = d;
      if (!bestRankSem || (d.schoolRank > 0 && d.schoolRank < (bestRankSem.schoolRank || 999))) {
        bestRankSem = d;
      }
    });

    for (let i = 1; i < enteredPoints.length; i++) {
      const prev = enteredPoints[i - 1];
      const cur = enteredPoints[i];
      const delta = cur.average - prev.average;
      if (delta > biggestJump.delta) {
        biggestJump = { from: prev.shortName, to: cur.shortName, delta };
      }
    }
  }

  // Active hover info
  const activeHoverPoint =
    hoveredSemId !== null
      ? dataPoints.find((d) => d.semesterId === hoveredSemId)
      : null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header & Metric Mode Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              학기별 성적 및 석차 변화 추이 그래프
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              1~3학년 6개 학기 성장선
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            입력된 과목 점수, 총점, 평균, 학급·학년 등수의 학기별 변화 곡선을 비교 분석합니다.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl text-xs font-bold self-start lg:self-auto shadow-2xs">
          <button
            onClick={() => setActiveMetric("average")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeMetric === "average"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>평균 점수 추이</span>
          </button>

          <button
            onClick={() => setActiveMetric("rank")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeMetric === "rank"
                ? "bg-white text-emerald-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>학년·학급 등수 추이</span>
          </button>

          <button
            onClick={() => setActiveMetric("total")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeMetric === "total"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>총점 추이</span>
          </button>

          <button
            onClick={() => setActiveMetric("subjects")}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeMetric === "subjects"
                ? "bg-white text-purple-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>과목별 비교</span>
          </button>
        </div>
      </div>

      {/* Metric Highlights Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-blue-700">최고 평균 학기</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">
              {bestAvgSem ? `${bestAvgSem.average.toFixed(1)}점` : "-"}
            </span>
            <span className="text-xs font-semibold text-blue-800">
              {bestAvgSem?.shortName}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-700">최고 학년 등수</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">
              {bestRankSem && bestRankSem.schoolRank > 0
                ? `${bestRankSem.schoolRank}등`
                : "-"}
            </span>
            <span className="text-xs font-semibold text-emerald-800">
              전교 상위 {bestRankSem?.percentile.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-purple-700">최고 학급 등수</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">
              {bestRankSem && bestRankSem.classRank > 0
                ? `${bestRankSem.classRank}등`
                : "-"}
            </span>
            <span className="text-xs font-semibold text-purple-800">
              반 30명 기준
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700">최대 점수 도약</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black text-slate-900 font-mono">
              {biggestJump.delta > 0
                ? `+${biggestJump.delta.toFixed(1)}점`
                : "-"}
            </span>
            <span className="text-xs font-semibold text-amber-800">
              {biggestJump.from && biggestJump.to
                ? `${biggestJump.from} → ${biggestJump.to}`
                : "추이 분석"}
            </span>
          </div>
        </div>
      </div>

      {/* Subject Filter Pills (When in Subjects View) */}
      {activeMetric === "subjects" && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
          <span className="text-xs font-bold text-slate-600 mr-1">
            비교할 과목 선택:
          </span>
          {allSubjectNames.map((name) => {
            const isSelected = selectedSubjects.includes(name);
            const color = SUBJECT_COLORS[name] || "#64748b";
            return (
              <button
                key={name}
                onClick={() => {
                  if (isSelected) {
                    if (selectedSubjects.length > 1) {
                      setSelectedSubjects((prev) => prev.filter((s) => s !== name));
                    }
                  } else {
                    setSelectedSubjects((prev) => [...prev, name]);
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* SVG Canvas Area */}
      <div className="relative bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="schoolRankGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {activeMetric === "average" && (
            <>
              {[40, 60, 80, 100].map((score) => {
                const y = getYAvg(score);
                return (
                  <g key={score}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono font-bold"
                    >
                      {score}점
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {activeMetric === "total" && (
            <>
              {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                const val = Math.round(
                  minTotalScore + ratio * (maxTotalScore - minTotalScore)
                );
                const y = getYTotal(val);
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono font-bold"
                    >
                      {val}점
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {activeMetric === "rank" && (
            <>
              {/* Top 1, Top 10, Top 30, Top 80, Max rank */}
              {[1, 10, 30, 80, maxRankNumber].map((rVal) => {
                const y = getYRank(rVal, maxRankNumber);
                return (
                  <g key={rVal}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-emerald-600 font-mono font-bold"
                    >
                      {rVal}등
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {activeMetric === "subjects" && (
            <>
              {[40, 60, 80, 100].map((score) => {
                const y = getYAvg(score);
                return (
                  <g key={score}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={width - paddingRight}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono font-bold"
                    >
                      {score}점
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* X-axis semester columns & vertical guideline */}
          {dataPoints.map((d, i) => {
            const x = getX(i);
            const isHovered = hoveredSemId === d.semesterId;
            const isActive = activeSemesterId === d.semesterId;

            return (
              <g key={d.semesterId}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke={isHovered ? "#93c5fd" : "#f1f5f9"}
                  strokeWidth={isHovered ? 2 : 1}
                />

                {/* X Axis Label */}
                <text
                  x={x}
                  y={height - paddingBottom + 20}
                  textAnchor="middle"
                  className={`text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? "fill-blue-700 font-black"
                      : isHovered
                      ? "fill-slate-900 font-black"
                      : d.isEntered
                      ? "fill-slate-700"
                      : "fill-slate-400"
                  }`}
                  onClick={() => onSelectSemester && onSelectSemester(d.semesterId)}
                >
                  {d.shortName}
                </text>

                <text
                  x={x}
                  y={height - paddingBottom + 35}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400"
                >
                  {d.gradeYear}학년 {d.term}학기
                </text>
              </g>
            );
          })}

          {/* VIEW 1: AVERAGE SCORE TREND */}
          {activeMetric === "average" && enteredPoints.length > 0 && (
            <>
              {/* Area polygon */}
              {(() => {
                const pts = enteredPoints.map(
                  (d) => `${getX(d.index)},${getYAvg(d.average)}`
                );
                const firstX = getX(enteredPoints[0].index);
                const lastX = getX(enteredPoints[enteredPoints.length - 1].index);
                const bottomY = height - paddingBottom;
                const pathD = `M ${pts.join(" L ")} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
                return <path d={pathD} fill="url(#avgGradient)" />;
              })()}

              {/* Line path */}
              {(() => {
                const pts = enteredPoints.map(
                  (d) => `${getX(d.index)},${getYAvg(d.average)}`
                );
                return (
                  <path
                    d={`M ${pts.join(" L ")}`}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}

              {/* Data points */}
              {dataPoints.map((d) => {
                if (!d.isEntered) {
                  return (
                    <circle
                      key={d.semesterId}
                      cx={getX(d.index)}
                      cy={getYAvg(60)}
                      r={4}
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="2 2"
                    />
                  );
                }

                const cx = getX(d.index);
                const cy = getYAvg(d.average);
                const isHovered = hoveredSemId === d.semesterId;
                const isActive = activeSemesterId === d.semesterId;

                return (
                  <g
                    key={d.semesterId}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSemId(d.semesterId)}
                    onMouseLeave={() => setHoveredSemId(null)}
                    onClick={() => onSelectSemester && onSelectSemester(d.semesterId)}
                  >
                    {/* Outer glow ring on hover/active */}
                    {(isHovered || isActive) && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="#3b82f6"
                        fillOpacity="0.2"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered || isActive ? 7 : 5.5}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />

                    {/* Score value pill above circle */}
                    <rect
                      x={cx - 24}
                      y={cy - 26}
                      width={48}
                      height={18}
                      rx={6}
                      fill={isActive ? "#1d4ed8" : "#ffffff"}
                      stroke={isActive ? "#1d4ed8" : "#93c5fd"}
                      strokeWidth="1.5"
                      className="shadow-2xs"
                    />
                    <text
                      x={cx}
                      y={cy - 14}
                      textAnchor="middle"
                      className={`text-[11px] font-black font-mono ${
                        isActive ? "fill-white" : "fill-blue-900"
                      }`}
                    >
                      {d.average.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* VIEW 2: TOTAL SCORE TREND */}
          {activeMetric === "total" && enteredPoints.length > 0 && (
            <>
              {/* Bars for total score */}
              {dataPoints.map((d) => {
                if (!d.isEntered) return null;
                const x = getX(d.index);
                const y = getYTotal(d.totalScore);
                const barHeight = height - paddingBottom - y;
                const isHovered = hoveredSemId === d.semesterId;
                const isActive = activeSemesterId === d.semesterId;

                return (
                  <g
                    key={`bar-${d.semesterId}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSemId(d.semesterId)}
                    onMouseLeave={() => setHoveredSemId(null)}
                    onClick={() => onSelectSemester && onSelectSemester(d.semesterId)}
                  >
                    <rect
                      x={x - 16}
                      y={y}
                      width={32}
                      height={barHeight}
                      rx={6}
                      fill={isActive ? "#4338ca" : isHovered ? "#6366f1" : "#818cf8"}
                      fillOpacity={isHovered || isActive ? "0.95" : "0.75"}
                    />
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      className="text-[11px] font-black font-mono fill-indigo-950"
                    >
                      {d.totalScore}점
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* VIEW 3: RANK TREND (GRADE RANK & CLASS RANK) */}
          {activeMetric === "rank" && enteredPoints.length > 0 && (
            <>
              {/* Line 1: Grade/School Rank (전교/학년 석차) */}
              {(() => {
                const pts = enteredPoints
                  .filter((d) => d.schoolRank > 0)
                  .map((d) => `${getX(d.index)},${getYRank(d.schoolRank, maxRankNumber)}`);
                if (pts.length < 2) return null;
                return (
                  <path
                    d={`M ${pts.join(" L ")}`}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}

              {/* Line 2: Class Rank (학급/반 석차) */}
              {(() => {
                const pts = enteredPoints
                  .filter((d) => d.classRank > 0)
                  .map((d) => `${getX(d.index)},${getYRank(d.classRank, 35)}`);
                if (pts.length < 2) return null;
                return (
                  <path
                    d={`M ${pts.join(" L ")}`}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}

              {/* Points for School & Class Ranks */}
              {dataPoints.map((d) => {
                if (!d.isEntered) return null;
                const cx = getX(d.index);
                const cySchool = getYRank(d.schoolRank, maxRankNumber);
                const cyClass = getYRank(d.classRank, 35);
                const isHovered = hoveredSemId === d.semesterId;

                return (
                  <g
                    key={`rank-pts-${d.semesterId}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredSemId(d.semesterId)}
                    onMouseLeave={() => setHoveredSemId(null)}
                    onClick={() => onSelectSemester && onSelectSemester(d.semesterId)}
                  >
                    {/* School Rank Node */}
                    <circle
                      cx={cx}
                      cy={cySchool}
                      r={isHovered ? 7 : 5.5}
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <rect
                      x={cx - 26}
                      y={cySchool - 24}
                      width={52}
                      height={18}
                      rx={6}
                      fill="#ecfdf5"
                      stroke="#059669"
                      strokeWidth="1.2"
                    />
                    <text
                      x={cx}
                      y={cySchool - 12}
                      textAnchor="middle"
                      className="text-[10px] font-black font-mono fill-emerald-950"
                    >
                      학년 {d.schoolRank}등
                    </text>

                    {/* Class Rank Node */}
                    <circle
                      cx={cx}
                      cy={cyClass}
                      r={isHovered ? 6 : 4.5}
                      fill="#8b5cf6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cyClass + 16}
                      textAnchor="middle"
                      className="text-[10px] font-bold font-mono fill-purple-900"
                    >
                      반 {d.classRank}등
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* VIEW 4: SUBJECTS MULTI-LINE COMPARISON */}
          {activeMetric === "subjects" && (
            <>
              {selectedSubjects.map((subName) => {
                const color = SUBJECT_COLORS[subName] || "#64748b";

                const pts = dataPoints
                  .filter((d) => d.isEntered)
                  .map((d) => {
                    const sub = d.subjects.find((s) => s.name === subName);
                    return sub ? { x: getX(d.index), y: getYAvg(sub.score) } : null;
                  })
                  .filter((p): p is { x: number; y: number } => p !== null);

                if (pts.length < 2) return null;

                const pathStr = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                return (
                  <g key={`sub-line-${subName}`}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {pts.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={4.5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                );
              })}
            </>
          )}
        </svg>

        {/* Empty state when no semesters entered */}
        {enteredPoints.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs p-6 text-center">
            <TrendingUp className="w-9 h-9 text-slate-300 mb-2" />
            <p className="font-bold text-slate-800 text-sm">아직 입력된 학기 성적이 없습니다.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              [과목별 성적 분석] 탭에서 원점수를 입력하거나 상단의 [3년치 파일 올리기]로 성적을 입력하면 학기별 변화 그래프가 자동으로 그려집니다.
            </p>
          </div>
        )}

        {/* Legend Box at top-right inside canvas */}
        {enteredPoints.length > 0 && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200/90 shadow-2xs text-xs space-y-1 hidden sm:block">
          {activeMetric === "average" && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-blue-600 rounded-full" />
              <span className="font-bold text-slate-700">전체 과목 평균 점수</span>
            </div>
          )}
          {activeMetric === "rank" && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-emerald-600 rounded-full" />
                <span className="font-bold text-emerald-800">학년 내 등수 (전교)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1 bg-purple-600 rounded-full border border-dashed border-purple-400" />
                <span className="font-bold text-purple-800">학급 내 등수 (반)</span>
              </div>
            </>
          )}
          {activeMetric === "total" && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-indigo-500 rounded-xs" />
              <span className="font-bold text-slate-700">과목 총점 (원점수 합산)</span>
            </div>
          )}
          {activeMetric === "subjects" && (
            <div className="text-[11px] text-slate-500">
              선택된 과목 점수 궤적 비교
            </div>
          )}
        </div>
      )}
      </div>

      {/* Hovered / Active Semester Detailed Info Card */}
      {activeHoverPoint && activeHoverPoint.isEntered && (
        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/90 rounded-2xl border border-blue-200 p-4 animate-in fade-in zoom-in-95 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-200/70">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-blue-700 text-white rounded-lg font-black text-xs">
                {activeHoverPoint.semesterName}
              </span>
              <span className="text-xs font-bold text-slate-700">
                상세 성적 분석 요약
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-slate-600">
                <span>평균:</span>
                <strong className="text-blue-700 font-mono text-sm">
                  {activeHoverPoint.average.toFixed(1)}점
                </strong>
              </div>
              <div className="flex items-center gap-1 font-semibold text-slate-600">
                <span>총점:</span>
                <strong className="text-indigo-700 font-mono text-sm">
                  {activeHoverPoint.totalScore}점
                </strong>
              </div>
              <div className="flex items-center gap-1 font-semibold text-slate-600">
                <span>학년 석차:</span>
                <strong className="text-emerald-700 font-mono text-sm">
                  {activeHoverPoint.schoolRank}등
                </strong>
                <span className="text-[10px] text-slate-400">
                  /{student.totalStudents}명
                </span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-slate-600">
                <span>학급 석차:</span>
                <strong className="text-purple-700 font-mono text-sm">
                  {activeHoverPoint.classRank}등
                </strong>
                <span className="text-[10px] text-slate-400">/30명</span>
              </div>
            </div>
          </div>

          {/* Subject Pills for Hovered Semester */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
            {activeHoverPoint.subjects.map((sub) => (
              <div
                key={sub.id}
                className="bg-white rounded-xl p-2.5 border border-blue-100 flex items-center justify-between shadow-2xs"
              >
                <div>
                  <div className="font-bold text-slate-800 text-xs">{sub.name}</div>
                  <div className="text-[10px] text-slate-400">
                    성취도 {sub.achievement}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900 font-mono">
                    {sub.score}점
                  </div>
                  {sub.classRank && (
                    <div className="text-[10px] font-semibold text-purple-600">
                      반 {sub.classRank}등
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
