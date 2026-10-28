import React, { useState } from "react";
import { StudentProfile } from "../types";
import { SEMESTERS_META, recomputeStudentProfile } from "../lib/gradeCalculator";
import { SemesterTrendChart } from "./SemesterTrendChart";
import {
  TrendingUp,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Printer,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Layers,
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  Edit3,
} from "lucide-react";

interface SemesterTrendTabProps {
  student: StudentProfile;
  onUpdateStudent?: (updated: StudentProfile) => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const SemesterTrendTab: React.FC<SemesterTrendTabProps> = ({
  student,
  onUpdateStudent,
  onNavigateToTab,
}) => {
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  // Available semesters with entered grades
  const enteredSemesters = SEMESTERS_META.filter(
    (m) => student.semesters?.[m.id]?.isEntered
  );

  // Manual refresh report handler
  const handleRefreshReport = () => {
    if (onUpdateStudent) {
      const updated = recomputeStudentProfile(student, student.activeSemesterId);
      onUpdateStudent(updated);
    }
    setRefreshNotice("최신 성적으로 리포트와 그래프가 성공적으로 새로고침되었습니다.");
    setTimeout(() => setRefreshNotice(null), 3500);
  };

  // Compare Semester A vs Semester B
  const [baseSemId, setBaseSemId] = useState<string>(() => {
    return enteredSemesters.length >= 2
      ? enteredSemesters[enteredSemesters.length - 2].id
      : "2-1";
  });

  const [targetSemId, setTargetSemId] = useState<string>(() => {
    return enteredSemesters.length >= 1
      ? enteredSemesters[enteredSemesters.length - 1].id
      : "2-2";
  });

  // High school admission GPA weights
  const [gradeWeights, setGradeWeights] = useState({ 1: 20, 2: 30, 5: 50, 3: 50 });

  const baseRecord = student.semesters?.[baseSemId];
  const targetRecord = student.semesters?.[targetSemId];

  // Multi-semester timeline data (1-2 to 3-2)
  const timelineData = SEMESTERS_META.map((meta) => {
    const rec = student.semesters?.[meta.id];
    const isEntered = rec?.isEntered ?? false;
    const semTotal =
      rec?.totalStudents && rec.totalStudents > 0
        ? rec.totalStudents
        : student.totalStudents || 109;
    const semClassTotal =
      rec?.classTotalStudents && rec.classTotalStudents > 0
        ? rec.classTotalStudents
        : student.classTotalStudents || 30;

    return {
      id: meta.id,
      name: meta.name,
      shortName: `${meta.gradeYear}-${meta.term}`,
      isEntered,
      average: isEntered ? (rec?.overallAverage ?? 0) : 0,
      totalScore: isEntered ? (rec?.totalScore ?? 0) : 0,
      percentile: isEntered ? (rec?.overallPercentile ?? 0) : 0,
      schoolRank: isEntered ? (rec?.schoolRank || rec?.estimatedRank || 0) : 0,
      classRank: isEntered ? (rec?.classRank || 0) : 0,
      totalStudents: semTotal,
      classTotalStudents: semClassTotal,
      rank: isEntered ? (rec?.schoolRank || rec?.estimatedRank || 0) : 0,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  // Subject list across all entered semesters
  const allSubjectNames = Array.from(
    new Set(
      Object.values(student.semesters || {}).flatMap((s) =>
        s.subjects.map((sub) => sub.name)
      )
    )
  );

  // Compare base vs target
  const subjectDiffs = (targetRecord?.subjects || []).map((curSub) => {
    const prevSub = baseRecord?.subjects.find((p) => p.name === curSub.name);
    const prevScore = prevSub ? prevSub.score : null;
    const prevAch = prevSub ? prevSub.achievement : "-";
    const diff = prevScore !== null ? curSub.score - prevScore : 0;

    return {
      name: curSub.name,
      currentScore: curSub.score,
      currentAch: curSub.achievement,
      prevScore,
      prevAch,
      diff,
    };
  });

  const sortedByDiff = [...subjectDiffs].sort((a, b) => b.diff - a.diff);
  const bestImprover = sortedByDiff[0];
  const needsCare = sortedByDiff[sortedByDiff.length - 1];

  const avgDiff =
    targetRecord && baseRecord
      ? targetRecord.overallAverage - baseRecord.overallAverage
      : 0;

  // Calculate Weighted High School Admission Score (고입 내신 환산점수)
  // Grade 1 avg (1-2 only, 1-1 is free semester), Grade 2 avg, Grade 3 avg
  const getGradeYearAverage = (year: 1 | 2 | 3) => {
    if (year === 1) {
      // 1학년 1학기는 자유학기제이므로 2학기 성적으로만 1학년 내신 100% 반영
      const sem2 = student.semesters?.["1-2"];
      return sem2?.isEntered ? sem2.overallAverage : 0;
    }
    const sem1 = student.semesters?.[`${year}-1`];
    const sem2 = student.semesters?.[`${year}-2`];
    const scores: number[] = [];
    if (sem1?.isEntered) scores.push(sem1.overallAverage);
    if (sem2?.isEntered) scores.push(sem2.overallAverage);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const g1Avg = getGradeYearAverage(1);
  const g2Avg = getGradeYearAverage(2);
  const g3Avg = getGradeYearAverage(3);

  const weightedAdmissionScore =
    (g1Avg * gradeWeights[1] +
      g2Avg * gradeWeights[2] +
      g3Avg * gradeWeights[3]) /
    (gradeWeights[1] + gradeWeights[2] + gradeWeights[3]);

  return (
    <div className="space-y-6">
      {/* Refresh Notice Banner */}
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

      {/* Top Banner & Print Action */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              중학교 성적 변화 추이 & 고입 내신 리포트
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            학기별 성적 궤적 분석, 교차 비교, 고입 내신 환산 시뮬레이션 (※ 1학년 1학기는 자유학기제로 제외됨)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Refresh Report Button */}
          <button
            type="button"
            onClick={handleRefreshReport}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="수정된 성적으로 리포트와 그래프를 즉시 다시 계산하여 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>리포트 새로고침</span>
          </button>

          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab("analysis")}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="과목별 원점수 및 등수 수정하기"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>성적 수정하기</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>리포트 인쇄 / PDF 저장</span>
          </button>
        </div>
      </div>

      {/* Interactive Visual Graph for Semester Grade & Rank Trends */}
      <SemesterTrendChart
        student={student}
        activeSemesterId={targetSemId}
        onSelectSemester={(semId) => setTargetSemId(semId)}
      />

      {/* 3-Year 6-Semester Trajectory Grid Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>1학년~3학년 6개 학기 전체 성적 일람 요약 카드</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 학기 카드를 클릭하면 비교 기준 학기로 선택할 수 있습니다.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600">
            입력 완료 학기:{" "}
            <strong className="text-blue-600">
              {enteredSemesters.length} / 6개 학기
            </strong>
          </div>
        </div>

        {/* Visual Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {timelineData.map((t, idx) => {
            const isBase = t.id === baseSemId;
            const isTarget = t.id === targetSemId;

            return (
              <div
                key={t.id}
                onClick={() => setTargetSemId(t.id)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  isTarget
                    ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                    : isBase
                    ? "bg-slate-100/90 border-slate-300"
                    : t.isEntered
                    ? "bg-white border-slate-200 hover:border-slate-300 shadow-2xs hover:bg-slate-50/50"
                    : "bg-slate-50/50 border-dashed border-slate-200 opacity-60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800">{t.name}</span>
                    {t.isEntered ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {idx === 0 ? "중학교 입학" : `이전 대비 ${idx}단계`}
                  </div>
                </div>

                <div className="my-2.5 text-center">
                  {t.isEntered ? (
                    <>
                      <div className="text-2xl font-black text-slate-900 font-mono">
                        {t.average.toFixed(1)}
                        <span className="text-xs font-normal text-slate-500">점</span>
                      </div>
                      {t.totalScore > 0 && (
                        <div className="text-[10px] text-indigo-700 font-mono font-bold mt-0.5">
                          총점 {t.totalScore}점
                        </div>
                      )}
                      <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                        전교 {t.schoolRank}/{t.totalStudents}등 <span className="text-[10px] text-purple-700 font-bold">/ 반 {t.classRank}/{t.classTotalStudents}등</span>
                      </div>
                      <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-mono">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold border border-blue-100">
                          수강 {t.totalStudents}명
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>상위 {t.percentile.toFixed(1)}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 py-3">성적 미입력</div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">
                    {isTarget ? "선택 학기" : isBase ? "기준 학기" : "학기 성적"}
                  </span>
                  {t.isEntered && (
                    <span className="font-bold text-slate-700">
                      {t.average >= 90 ? "A등급대" : t.average >= 80 ? "B등급대" : "C등급대"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Semester Subject Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              1·2·3학년 전과목 성적 누적 일람표 (3개년 매트릭스)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              과목별로 학년이 올라가며 점수가 어떻게 변화했는지 추이를 확인하세요.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">과목명</th>
                <th className="py-3 px-3 text-center">1학년 1학기</th>
                <th className="py-3 px-3 text-center">1학년 2학기</th>
                <th className="py-3 px-3 text-center">2학년 1학기</th>
                <th className="py-3 px-3 text-center">2학년 2학기</th>
                <th className="py-3 px-3 text-center">3학년 1학기</th>
                <th className="py-3 px-3 text-center">3학년 2학기</th>
                <th className="py-3 px-4 text-center">3개년 평균</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {allSubjectNames.map((subName) => {
                const semScores = SEMESTERS_META.map((meta) => {
                  const s = student.semesters?.[meta.id]?.subjects.find(
                    (item) => item.name === subName
                  );
                  return s ? s.score : null;
                });

                const validScores = semScores.filter(
                  (val): val is number => val !== null
                );
                const avg =
                  validScores.length > 0
                    ? validScores.reduce((a, b) => a + b, 0) / validScores.length
                    : 0;

                return (
                  <tr key={subName} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{subName}</td>
                    {semScores.map((score, sIdx) => (
                      <td key={sIdx} className="py-3 px-3 text-center font-mono">
                        {score !== null ? (
                          <span
                            className={`font-bold ${
                              score >= 90
                                ? "text-purple-700 font-black"
                                : score >= 80
                                ? "text-blue-700"
                                : score >= 70
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {score}점
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-center font-bold text-slate-900 bg-slate-50/60 font-mono">
                      {avg.toFixed(1)}점
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary Rows: 총점, 평균, 학급 내 등수, 학년 내 등수 */}
            <tfoot className="border-t-2 border-slate-300 font-bold bg-slate-50/90 text-xs">
              {/* Row 1: 총점 */}
              <tr className="border-b border-slate-200">
                <td className="py-2.5 px-4 font-black text-indigo-900">
                  [학기 총점]
                </td>
                {SEMESTERS_META.map((meta) => {
                  const rec = student.semesters?.[meta.id];
                  return (
                    <td
                      key={`tot-${meta.id}`}
                      className="py-2.5 px-3 text-center font-mono font-black text-indigo-950"
                    >
                      {rec?.isEntered && rec.totalScore
                        ? `${rec.totalScore}점`
                        : rec?.isEntered
                        ? `${rec.subjects.reduce((sum, s) => sum + s.score, 0)}점`
                        : "-"}
                    </td>
                  );
                })}
                <td className="py-2.5 px-4 text-center font-mono font-black text-indigo-900 bg-slate-100/70">
                  -
                </td>
              </tr>

              {/* Row 2: 전체 평균 */}
              <tr className="border-b border-slate-200 bg-blue-50/50">
                <td className="py-2.5 px-4 font-black text-blue-900">
                  [전체 평균]
                </td>
                {SEMESTERS_META.map((meta) => {
                  const rec = student.semesters?.[meta.id];
                  return (
                    <td
                      key={`avg-${meta.id}`}
                      className="py-2.5 px-3 text-center font-mono font-black text-blue-900"
                    >
                      {rec?.isEntered ? `${rec.overallAverage.toFixed(1)}점` : "-"}
                    </td>
                  );
                })}
                <td className="py-2.5 px-4 text-center font-mono font-black text-blue-950 bg-blue-100/60">
                  {enteredSemesters.length > 0
                    ? `${(
                        enteredSemesters.reduce((sum, s) => {
                          const r = student.semesters?.[s.id];
                          return sum + (r ? r.overallAverage : 0);
                        }, 0) / enteredSemesters.length
                      ).toFixed(1)}점`
                    : "-"}
                </td>
              </tr>

              {/* Row 3: 학급 내 등수 */}
              <tr className="border-b border-slate-200">
                <td className="py-2 px-4 font-bold text-purple-900">
                  [학급 내 등수]
                </td>
                {SEMESTERS_META.map((meta) => {
                  const rec = student.semesters?.[meta.id];
                  return (
                    <td
                      key={`cls-${meta.id}`}
                      className="py-2 px-3 text-center font-mono font-bold text-purple-800"
                    >
                      {rec?.isEntered ? `${rec.classRank || "-"}등` : "-"}
                    </td>
                  );
                })}
                <td className="py-2 px-4 text-center font-mono font-bold text-purple-900 bg-slate-100/70">
                  반 30명 기준
                </td>
              </tr>

              {/* Row 4: 학년 내 등수 */}
              <tr>
                <td className="py-2 px-4 font-bold text-emerald-900">
                  [학년 내 등수]
                </td>
                {SEMESTERS_META.map((meta) => {
                  const rec = student.semesters?.[meta.id];
                  return (
                    <td
                      key={`sch-${meta.id}`}
                      className="py-2 px-3 text-center font-mono font-bold text-emerald-800"
                    >
                      {rec?.isEntered
                        ? `${rec.schoolRank || rec.estimatedRank}등`
                        : "-"}
                    </td>
                  );
                })}
                <td className="py-2 px-4 text-center font-mono font-bold text-emerald-900 bg-slate-100/70">
                  전교 {student.totalStudents}명
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Two-Semester Comparison Selector & Delta Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              학기 간 맞춤 비교 분석 (Comparison Selector)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              원하는 두 학기를 선택하여 과목별 점수 증감과 성취도 변동을 비교하세요.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Base Semester */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">기준:</span>
              <select
                value={baseSemId}
                onChange={(e) => setBaseSemId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
              >
                {SEMESTERS_META.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-400 font-bold">vs</span>

            {/* Target Semester */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">비교:</span>
              <select
                value={targetSemId}
                onChange={(e) => setTargetSemId(e.target.value)}
                className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-900 cursor-pointer"
              >
                {SEMESTERS_META.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Delta Summary Cards */}
        {baseRecord && targetRecord && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
              <div className="text-xs text-slate-500">
                [{baseRecord.semesterName}] → [{targetRecord.semesterName}]
              </div>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-lg text-slate-400 font-bold font-mono">
                  {baseRecord.overallAverage.toFixed(1)}점
                </span>
                <span className="text-slate-300">→</span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {targetRecord.overallAverage.toFixed(1)}점
                </span>
              </div>
              <div
                className={`text-xs font-bold flex items-center gap-1 ${
                  avgDiff >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {avgDiff >= 0 ? (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>+{avgDiff.toFixed(1)}점 상승</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4" />
                    <span>{avgDiff.toFixed(1)}점 변동</span>
                  </>
                )}
              </div>
            </div>

            {bestImprover && (
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 flex flex-col justify-between">
                <div className="text-xs font-bold text-emerald-800">
                  🌟 최고 도약 과목
                </div>
                <div className="my-1">
                  <div className="text-lg font-black text-slate-900">
                    {bestImprover.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {bestImprover.prevScore}점 → <strong>{bestImprover.currentScore}점</strong>
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-700">
                  +{bestImprover.diff}점 상승 달성
                </div>
              </div>
            )}

            {needsCare && (
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 flex flex-col justify-between">
                <div className="text-xs font-bold text-amber-800">
                  ⚠️ 집중 보완 과목
                </div>
                <div className="my-1">
                  <div className="text-lg font-black text-slate-900">
                    {needsCare.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {needsCare.prevScore}점 → <strong>{needsCare.currentScore}점</strong>
                  </div>
                </div>
                <div className="text-xs font-bold text-amber-800">
                  {needsCare.diff < 0
                    ? `${needsCare.diff}점 하락 (오답 복습 필요)`
                    : "점수 정체 상태"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* High School Admission Score Estimator Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/15">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-lg bg-white/10 text-indigo-300">
                <GraduationCap className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-white">
                고등학교 입시 내신 성적 환산 시뮬레이터 (3개년 종합)
              </h3>
            </div>
            <p className="text-xs text-blue-200">
              1, 2, 3학년 성적을 교육청별 가중치(1학년 20%, 2학년 30%, 3학년 50%)로 환산하여 예상 고입 점수를 산출합니다.
            </p>
          </div>

          <div className="bg-white/10 px-5 py-3 rounded-2xl border border-white/20 text-center shrink-0">
            <div className="text-[11px] text-blue-200 font-semibold">
              3개년 종합 환산 내신
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">
              {weightedAdmissionScore.toFixed(2)}
              <span className="text-xs font-normal text-white"> / 100점</span>
            </div>
          </div>
        </div>

        {/* Grade Breakdown & Weight Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          {[1, 2, 3].map((yr) => {
            const y = yr as 1 | 2 | 3;
            const avg = y === 1 ? g1Avg : y === 2 ? g2Avg : g3Avg;

            return (
              <div
                key={y}
                className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-200">중학교 {y}학년</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {avg > 0 ? `${avg.toFixed(1)}점` : "미입력"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-blue-300 pt-1">
                  <span>반영 비율:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gradeWeights[y]}
                      onChange={(e) =>
                        setGradeWeights((prev) => ({
                          ...prev,
                          [y]: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-12 px-1.5 py-0.5 bg-white/20 rounded border border-white/20 text-white font-bold text-center outline-hidden"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
