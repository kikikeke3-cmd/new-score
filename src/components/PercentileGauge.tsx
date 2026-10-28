import React from "react";
import { Award, TrendingUp, Users, HelpCircle, Layers } from "lucide-react";

interface PercentileGaugeProps {
  percentile: number; // e.g. 13.8 (상위 13.8%) - 전체 학기 종합 백분위
  estimatedRank: number; // e.g. 15 - 전체 학기 종합 석차
  totalStudents: number; // e.g. 109 - 종합 기준 전교생 수
  averageScore: number; // e.g. 84.8 - 전체 학기 누적 종합 평균 점수
  enteredSemestersCount?: number; // e.g. 4개 학기
  activeSemesterName?: string; // e.g. "3학년 1학기"
  activeSemesterPercentile?: number; // e.g. 12.0%
  activeSemesterRank?: number; // e.g. 13등
}

export const PercentileGauge: React.FC<PercentileGaugeProps> = ({
  percentile,
  estimatedRank,
  totalStudents,
  averageScore,
  enteredSemestersCount = 1,
  activeSemesterName,
  activeSemesterPercentile,
  activeSemesterRank,
}) => {
  const isUnentered = averageScore <= 0 || (estimatedRank <= 0 && percentile <= 0);

  // Percentile tiers based on overall cumulative percentile
  let tierName = "중위권";
  let tierColor = "bg-blue-50 text-blue-700 border-blue-200";
  let tierDesc = "기본 개념 복습과 취약 과목 보완 시 상위권 도약 가능";

  if (isUnentered) {
    tierName = "성적 미입력";
    tierColor = "bg-slate-100 text-slate-600 border-slate-200";
    tierDesc = "과목별 원점수를 입력하거나 파일을 업로드하면 정규분포 백분위와 예상 석차가 산출됩니다.";
  } else if (percentile <= 4) {
    tierName = "최상위권 (상위 4% 이내)";
    tierColor = "bg-purple-50 text-purple-700 border-purple-200";
    tierDesc = "전과목 균형 잡힌 심화 탐구 및 고입 최상위권 대비 실수 제로 전략 추천";
  } else if (percentile <= 11) {
    tierName = "상위권 (상위 11% 이내)";
    tierColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
    tierDesc = "킬러 문항 정복과 취약 과목 보강으로 최상위권 진입 노림";
  } else if (percentile <= 25) {
    tierName = "중상위권 (상위 25% 이내)";
    tierColor = "bg-blue-50 text-blue-700 border-blue-200";
    tierDesc = "취약 1~2과목 점수를 올리면 전체 등수가 대폭 상승하는 골든존";
  } else if (percentile <= 50) {
    tierName = "중위권 (상위 50% 이내)";
    tierColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
    tierDesc = "교과서 개념 완벽 암기와 필수 유형 오답노트 정복 필요";
  } else {
    tierName = "도약 준비권";
    tierColor = "bg-amber-50 text-amber-700 border-amber-200";
    tierDesc = "기초 어휘 및 핵심 공식 이해부터 매일 30분씩 꾸준히 시작";
  }

  // Semi-circle gauge calculation
  const normalized = Math.max(0, Math.min(100, 100 - percentile)); // 0% rank -> 100% position on gauge
  const angle = (normalized / 100) * 180 - 180; // -180 to 0 deg

  const radius = 70;
  const strokeWidth = 14;
  const cx = 100;
  const cy = 90;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-800 text-sm">전체 성적 종합 백분위</h3>
            </div>
            <p className="text-[11px] text-slate-500">
              {enteredSemestersCount > 1
                ? `입력된 전체 ${enteredSemestersCount}개 학기 누적 종합 통계`
                : "Z-Score 정규분포 통계 추정치"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {enteredSemestersCount > 1 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-md">
              총 {enteredSemestersCount}개 학기 누적
            </span>
          )}
          <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${tierColor}`}>
            {tierName}
          </span>
        </div>
      </div>

      {/* SVG Arc Gauge */}
      <div className="flex flex-col items-center justify-center my-1 relative">
        <svg width="200" height="115" viewBox="0 0 200 115" className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="35%" stopColor="#10b981" />
              <stop offset="70%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Needle Indicator */}
          <g transform={`rotate(${angle + 90}, ${cx}, ${cy})`}>
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - radius + 5}
              stroke="#1e293b"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
            <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
          </g>
        </svg>

        {/* Big Percentile Display */}
        <div className="text-center -mt-3">
          {isUnentered ? (
            <div className="py-1">
              <span className="text-xl font-black text-slate-400">성적 미입력</span>
              <p className="text-xs text-slate-400 mt-0.5">과목 점수 입력 대기 중</p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xs font-semibold text-slate-500">종합 상위</span>
                <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {percentile.toFixed(1)}
                </span>
                <span className="text-lg font-bold text-blue-600">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                전교 {totalStudents}명 중 종합 예상 <strong>{estimatedRank}등</strong>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Compare: Selected Semester vs Cumulative All-Semesters */}
      {activeSemesterName &&
        activeSemesterPercentile !== undefined &&
        activeSemesterRank !== undefined &&
        enteredSemestersCount > 1 && (
          <div className="mt-2 px-3 py-1.5 bg-slate-50/90 border border-slate-200 rounded-xl text-[11px] flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-500" />
              <span>현재 선택 [{activeSemesterName}]:</span>
            </span>
            <span className="font-bold text-slate-800">
              상위 <strong className="text-blue-700">{activeSemesterPercentile.toFixed(1)}%</strong> ({activeSemesterRank}등)
            </span>
          </div>
        )}

      {/* Stats summary chips */}
      <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-xs">
        <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-slate-500 text-[11px]">
              {enteredSemestersCount > 1 ? "전체 학기 누적 평균" : "전과목 평균 점수"}
            </div>
            <div className="font-bold text-slate-800 text-sm">{averageScore.toFixed(1)}점</div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <div className="text-slate-500 text-[11px]">전교 수강 인원</div>
            <div className="font-bold text-slate-800 text-sm">{totalStudents}명</div>
          </div>
        </div>
      </div>

      <div className="mt-2.5 p-2 bg-blue-50/70 rounded-xl text-xs text-blue-900 leading-snug flex items-start gap-1.5">
        <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
        <span>{tierDesc}</span>
      </div>
    </div>
  );
};
