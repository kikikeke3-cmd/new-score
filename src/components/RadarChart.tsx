import React, { useState } from "react";
import { SubjectGrade } from "../types";

interface RadarChartProps {
  subjects: SubjectGrade[];
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ subjects, size = 320 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (subjects.length < 3) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-slate-400">
        레이더 차트를 표시하려면 최소 3개 과목 이상이 필요합니다.
      </div>
    );
  }

  const center = size / 2;
  const radius = (size / 2) - 48; // Leave margin for labels
  const angleStep = (Math.PI * 2) / subjects.length;

  // Grid levels (20, 40, 60, 80, 100)
  const levels = [20, 40, 60, 80, 100];

  // Helper to get coordinates
  const getCoordinates = (value: number, index: number, maxVal = 100) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / maxVal) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Student score polygon points
  const scorePoints = subjects
    .map((s, i) => {
      const { x, y } = getCoordinates(s.score, i);
      return `${x},${y}`;
    })
    .join(" ");

  // School mean polygon points
  const meanPoints = subjects
    .map((s, i) => {
      const { x, y } = getCoordinates(s.mean, i);
      return `${x},${y}`;
    })
    .join(" ");

  // Target score points
  const targetPoints = subjects
    .map((s, i) => {
      const { x, y } = getCoordinates(s.targetScore || 90, i);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="overflow-visible select-none">
        {/* Background concentric polygons */}
        {levels.map((lvl) => {
          const points = subjects
            .map((_, i) => {
              const { x, y } = getCoordinates(lvl, i);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <g key={`level-${lvl}`}>
              <polygon
                points={points}
                fill={lvl === 100 ? "#f8fafc" : "none"}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={lvl < 100 ? "3,3" : "none"}
              />
              <text
                x={center + 4}
                y={center - (lvl / 100) * radius + 4}
                fill="#94a3b8"
                fontSize="9"
                fontWeight="500"
              >
                {lvl}
              </text>
            </g>
          );
        })}

        {/* Axis lines from center to outer vertices */}
        {subjects.map((_, i) => {
          const { x, y } = getCoordinates(100, i);
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {/* School Mean Polygon (Gray dash) */}
        <polygon
          points={meanPoints}
          fill="rgba(148, 163, 184, 0.12)"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />

        {/* Target Score Polygon (Emerald subtle) */}
        <polygon
          points={targetPoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="2,2"
          opacity={0.6}
        />

        {/* Student Score Polygon (Blue solid filled) */}
        <polygon
          points={scorePoints}
          fill="rgba(59, 130, 246, 0.25)"
          stroke="#2563eb"
          strokeWidth="2.5"
          className="transition-all duration-300"
        />

        {/* Vertices & Hover interactions */}
        {subjects.map((s, i) => {
          const { x, y } = getCoordinates(s.score, i);
          const isHovered = hoveredIndex === i;
          return (
            <g
              key={`point-${s.id}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 7 : 4.5}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150 drop-shadow-xs"
              />
            </g>
          );
        })}

        {/* Outer Subject Labels */}
        {subjects.map((s, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 24;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle);
          const isHovered = hoveredIndex === i;

          return (
            <text
              key={`label-${s.id}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={isHovered ? "12" : "11"}
              fontWeight={isHovered ? "700" : "600"}
              fill={isHovered ? "#1d4ed8" : "#334155"}
              className="transition-all cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {s.name} ({s.score}점)
            </text>
          );
        })}
      </svg>

      {/* Legend & Hover Info */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
          <span>내 점수</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-400 inline-block border-b border-dashed border-slate-600"></span>
          <span>학교 평균</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block border-b border-dotted border-emerald-600"></span>
          <span>목표 점수</span>
        </div>
      </div>

      {hoveredIndex !== null && subjects[hoveredIndex] && (
        <div className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl shadow-lg text-xs flex items-center gap-3 animate-in fade-in zoom-in-95">
          <span className="font-bold text-blue-300">{subjects[hoveredIndex].name}</span>
          <span>원점수: <strong className="text-white">{subjects[hoveredIndex].score}점</strong></span>
          <span>학교평균: {subjects[hoveredIndex].mean}점</span>
          <span>상위: <strong className="text-amber-300">{subjects[hoveredIndex].percentile.toFixed(1)}%</strong></span>
          <span>성취도: {subjects[hoveredIndex].achievement}</span>
        </div>
      )}
    </div>
  );
};
