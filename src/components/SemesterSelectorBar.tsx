import React, { useState } from "react";
import { StudentProfile } from "../types";
import { SEMESTERS_META } from "../lib/gradeCalculator";
import {
  Calendar,
  Layers,
  Upload,
  Users,
  Settings2,
  X,
  Check,
  ArrowRightLeft,
  Info,
} from "lucide-react";

interface SemesterSelectorBarProps {
  student: StudentProfile;
  activeSemesterId: string;
  onSelectSemester: (semesterId: string) => void;
  onOpenImportModal?: () => void;
  allStudentsCount?: number;
  onUpdateSemesterStudents?: (
    semesterId: string,
    totalStudents: number,
    classTotalStudents?: number
  ) => void;
  onBatchUpdateSemesterStudents?: (
    updates: Record<string, { totalStudents: number; classTotalStudents: number }>
  ) => void;
  onApplySemesterStudentsToAllStudents?: (
    updates: Record<string, { totalStudents: number; classTotalStudents: number }>
  ) => void;
}

export const SemesterSelectorBar: React.FC<SemesterSelectorBarProps> = ({
  student,
  activeSemesterId,
  onSelectSemester,
  onOpenImportModal,
  allStudentsCount,
  onUpdateSemesterStudents,
  onBatchUpdateSemesterStudents,
  onApplySemesterStudentsToAllStudents,
}) => {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Group semesters by Grade (1, 2, 3) - 1학년 1학기는 자유학기제
  const grades = [
    {
      year: 1,
      title: "1학년",
      hasFreeSemester: true,
      freeTerm: "1학기 자유학기제 (지필평가 미실시)",
      semesters: ["1-2"],
    },
    { year: 2, title: "2학년", hasFreeSemester: false, semesters: ["2-1", "2-2"] },
    { year: 3, title: "3학년", hasFreeSemester: false, semesters: ["3-1", "3-2"] },
  ];

  const activeRecord = student.semesters?.[activeSemesterId];
  const activeTotalStudents =
    activeRecord?.totalStudents && activeRecord.totalStudents > 0
      ? activeRecord.totalStudents
      : student.totalStudents || 109;
  const activeClassTotalStudents =
    activeRecord?.classTotalStudents && activeRecord.classTotalStudents > 0
      ? activeRecord.classTotalStudents
      : student.classTotalStudents || 30;

  // Local state for batch student count modal
  const [modalCounts, setModalCounts] = useState<
    Record<string, { totalStudents: number; classTotalStudents: number }>
  >({});

  const handleOpenManageModal = () => {
    const initial: Record<string, { totalStudents: number; classTotalStudents: number }> = {};
    SEMESTERS_META.forEach((m) => {
      const rec = student.semesters?.[m.id];
      initial[m.id] = {
        totalStudents:
          rec?.totalStudents && rec.totalStudents > 0
            ? rec.totalStudents
            : student.totalStudents || 109,
        classTotalStudents:
          rec?.classTotalStudents && rec.classTotalStudents > 0
            ? rec.classTotalStudents
            : student.classTotalStudents || 30,
      };
    });
    setModalCounts(initial);
    setIsManageModalOpen(true);
  };

  const handleSaveModalCounts = () => {
    if (onBatchUpdateSemesterStudents) {
      onBatchUpdateSemesterStudents(modalCounts);
    } else if (onUpdateSemesterStudents) {
      Object.entries(modalCounts).forEach(([semId, counts]) => {
        onUpdateSemesterStudents(semId, counts.totalStudents, counts.classTotalStudents);
      });
    }
    setIsManageModalOpen(false);
  };

  const handleCopyActiveToAll = () => {
    const updated = { ...modalCounts };
    SEMESTERS_META.forEach((m) => {
      updated[m.id] = {
        totalStudents: activeTotalStudents,
        classTotalStudents: activeClassTotalStudents,
      };
    });
    setModalCounts(updated);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Layers className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span>중학교 학기 선택 및 전교생·학급 인원 관리</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-full font-semibold flex items-center gap-1">
                <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600" />
                <span>전입·전출 학기별 반영</span>
              </span>
            </h3>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              1학년 1학기는 자유학기제(지필 없음)이며, 학년·학기마다 다른 전교생 수와 학급 인원을 개별 입력할 수 있습니다.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Active Semester Headcount Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-500">
              {SEMESTERS_META.find((m) => m.id === activeSemesterId)?.name || activeSemesterId} 인원:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">전교생</span>
              <input
                type="number"
                min="1"
                max="2000"
                value={activeTotalStudents}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (onUpdateSemesterStudents && !isNaN(val) && val > 0) {
                    onUpdateSemesterStudents(activeSemesterId, val, activeClassTotalStudents);
                  }
                }}
                className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-blue-900 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                title="해당 학기 전교생(수강자) 수 - 전입/전출 반영"
              />
              <span className="text-[10px] text-slate-500 font-bold">명</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">학급</span>
              <input
                type="number"
                min="1"
                max="100"
                value={activeClassTotalStudents}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (onUpdateSemesterStudents && !isNaN(val) && val > 0) {
                    onUpdateSemesterStudents(activeSemesterId, activeTotalStudents, val);
                  }
                }}
                className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold text-emerald-800 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                title="해당 학기 학급 인원 - 반 정원"
              />
              <span className="text-[10px] text-slate-500 font-bold">명</span>
            </div>
          </div>

          {/* Manage All Semesters Button */}
          <button
            type="button"
            onClick={handleOpenManageModal}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
            title="모든 학기의 전교생 및 학급 인원을 한눈에 확인하고 일괄 편집합니다."
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>학기별 인원 일괄 관리</span>
          </button>

          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="3개년 통합 엑셀 또는 PDF 성적표 한번에 올리기"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>성적표 파일 올리기</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Grades Columns / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {grades.map((g) => (
          <div
            key={g.year}
            className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>중학교 {g.year}학년</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {g.hasFreeSemester ? "1학기 자유학기 / 2학기" : "1학기 / 2학기"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* If Grade 1, show Free Semester Card for Term 1 */}
              {g.hasFreeSemester && (
                <div className="p-2.5 rounded-xl border border-dashed border-slate-300/80 bg-slate-100/60 text-left flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500">1학기</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-bold rounded-sm">
                      자유학기
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                      지필평가 미실시
                    </span>
                    <span className="text-[9px] text-slate-400">성적 산출 제외</span>
                  </div>
                </div>
              )}

              {g.semesters.map((semId) => {
                const meta = SEMESTERS_META.find((m) => m.id === semId);
                if (!meta) return null;
                const record = student.semesters?.[semId];
                const isActive = activeSemesterId === semId;
                const isEntered = record?.isEntered ?? false;
                const avg = record?.overallAverage ?? 0;
                const semTotal =
                  record?.totalStudents && record.totalStudents > 0
                    ? record.totalStudents
                    : student.totalStudents || 109;
                const semClass =
                  record?.classTotalStudents && record.classTotalStudents > 0
                    ? record.classTotalStudents
                    : student.classTotalStudents || 30;

                return (
                  <button
                    key={semId}
                    type="button"
                    onClick={() => onSelectSemester(semId)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer relative flex flex-col justify-between ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20"
                        : isEntered
                        ? "bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                        : "bg-white/60 text-slate-500 border-dashed border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold truncate">
                        {meta.term}학기
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                            isActive
                              ? "bg-blue-700/80 text-blue-100"
                              : "bg-slate-100 text-slate-600"
                          }`}
                          title={`해당 학기 전교생 수: ${semTotal}명 (학급: ${semClass}명)`}
                        >
                          {semTotal}명
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isActive
                              ? "bg-white"
                              : isEntered
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                          title={isEntered ? "성적 입력 완료" : "성적 미입력"}
                        />
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mt-0.5">
                      {isEntered ? (
                        <>
                          <span
                            className={`text-sm font-black font-mono ${
                              isActive ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {avg.toFixed(1)}점
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${
                              isActive ? "text-blue-100" : "text-blue-600"
                            }`}
                          >
                            상위 {record.overallPercentile.toFixed(0)}%
                          </span>
                        </>
                      ) : (
                        <span
                          className={`text-[11px] ${
                            isActive ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          성적 입력하기
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Batch Semester Headcount Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ArrowRightLeft className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    학기별 전교생 및 학급 인원 관리
                  </h3>
                  <p className="text-xs text-slate-500">
                    전학생(전입/전출)으로 인해 학기마다 달라지는 인원을 정확하게 설정합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                설정한 학기별 전교생 수는 각 학기의 <strong>상위 백분율(%)</strong>과 <strong>예상 석차</strong> 산출의 공식 분모로 즉시 반영됩니다.
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                5개 학기별 수강 인원 목록
              </span>
              <button
                type="button"
                onClick={handleCopyActiveToAll}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
              >
                현재 학기({activeSemesterId}) 인원을 모든 학기에 복사
              </button>
            </div>

            {/* Semester rows */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {SEMESTERS_META.map((meta) => {
                const item = modalCounts[meta.id] || {
                  totalStudents: 109,
                  classTotalStudents: 30,
                };
                const semRec = student.semesters?.[meta.id];
                const isEntered = semRec?.isEntered ?? false;

                return (
                  <div
                    key={meta.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-32">
                      <span className="font-bold text-slate-800">{meta.name}</span>
                      {isEntered ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
                          입력됨
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                          미입력
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">전교생:</span>
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={item.totalStudents}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setModalCounts((prev) => ({
                              ...prev,
                              [meta.id]: {
                                ...prev[meta.id],
                                totalStudents: isNaN(val) ? 0 : val,
                              },
                            }));
                          }}
                          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-blue-900 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                        />
                        <span className="text-slate-500 font-semibold">명</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-medium">학급:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={item.classTotalStudents}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setModalCounts((prev) => ({
                              ...prev,
                              [meta.id]: {
                                ...prev[meta.id],
                                classTotalStudents: isNaN(val) ? 0 : val,
                              },
                            }));
                          }}
                          className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-emerald-800 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                        />
                        <span className="text-slate-500 font-semibold">명</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="text-[11px] text-slate-500 font-medium self-start sm:self-auto">
                현재 등록 학생: <strong>{allStudentsCount || 1}명</strong>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalCounts}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                  title="현재 선택된 학생의 학기별 인원만 갱신"
                >
                  현재 학생만 적용
                </button>
                {onApplySemesterStudentsToAllStudents && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplySemesterStudentsToAllStudents(modalCounts);
                      setIsManageModalOpen(false);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    title="등록된 모든 학생(27명 등)의 학기별 인원 및 석차 백분위를 한 번에 일괄 재산출"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>전체 {allStudentsCount || 1}명 일괄 적용</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
