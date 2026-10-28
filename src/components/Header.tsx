import React, { useState } from "react";
import { StudentProfile } from "../types";
import { User } from "firebase/auth";
import {
  GraduationCap,
  Users,
  Settings2,
  FileSpreadsheet,
  Plus,
  Upload,
  Trash2,
  UserCheck,
  X,
  AlertTriangle,
  Database,
  Save,
  Check,
} from "lucide-react";

interface HeaderProps {
  students: StudentProfile[];
  currentStudent: StudentProfile;
  onSelectStudent: (student: StudentProfile) => void;
  onAddNewStudent: () => void;
  onOpenEditStudent: () => void;
  onDeleteStudent: (studentId: string) => void;
  onOpenGoogleSheets: () => void;
  onOpenImportModal: () => void;
  onOpenDataManagement: () => void;
  onQuickSave: () => void;
  lastSavedAt: string | null;
  user: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  students,
  currentStudent,
  onSelectStudent,
  onAddNewStudent,
  onOpenEditStudent,
  onDeleteStudent,
  onOpenGoogleSheets,
  onOpenImportModal,
  onOpenDataManagement,
  onQuickSave,
  lastSavedAt,
  user,
}) => {
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const handleSaveClick = () => {
    onQuickSave();
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3.5">
            {/* Logo & Subtitle */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-slate-900">
                    중학 성취e음
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    중학교 성적상담·학습코칭
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Z-Score 정규분포 백분위 산출 & AI 맞춤형 공부법·학습계획표 솔루션
                </p>
              </div>
            </div>

            {/* Student Selector & Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Student Switcher Pill */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsRosterModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-white rounded-lg transition cursor-pointer"
                  title="학생 명단 관리 열기"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden md:inline">명단 ({students.length}명)</span>
                </button>

                <select
                  value={currentStudent.id}
                  onChange={(e) => {
                    const found = students.find((s) => s.id === e.target.value);
                    if (found) onSelectStudent(found);
                  }}
                  className="bg-white border border-slate-200 text-xs font-bold text-slate-900 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gradeLevel} · {s.currentSemester})
                    </option>
                  ))}
                </select>

                <button
                  onClick={onOpenEditStudent}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition ml-1 cursor-pointer"
                  title="학생 정보 수정"
                >
                  <Settings2 className="w-4 h-4" />
                </button>

                <button
                  onClick={onAddNewStudent}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition cursor-pointer"
                  title="새 학생 등록"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onDeleteStudent(currentStudent.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title={`[${currentStudent.name}] 학생 삭제`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 3-Year Grade File Upload Quick Action (Supports Excel & PDF Report Cards) */}
              <button
                onClick={onOpenImportModal}
                className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                title="1·2·3학년 3개년 성적 파일(엑셀, PDF 통지표) 한번에 올리기 & 전학년 자동 산출"
              >
                <Upload className="w-3.5 h-3.5 text-white" />
                <span>3년치 성적·PDF 통지표 올리기</span>
              </button>

              {/* Google Sheets Connect Action */}
              <button
                onClick={onOpenGoogleSheets}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  user
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                }`}
              >
                <FileSpreadsheet
                  className="w-3.5 h-3.5 text-emerald-600"
                />
                <span className="hidden sm:inline">Google Sheets</span>
                {user ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">관리</span>
                )}
              </button>

              {/* Data Save & Backup Action */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs ${
                    isSavedFeedback
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
                  }`}
                  title="지금 즉시 데이터 저장하기"
                >
                  {isSavedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>저장 완료!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">저장하기</span>
                      <span className="sm:hidden">저장</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="실시간 자동 저장 중" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenDataManagement}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer border border-slate-200"
                  title="데이터 백업 파일(.json) 다운로드 및 복원 관리 열기"
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Student Roster Management Modal (학생 명단 관리 및 삭제) */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    학생 명단 관리 ({students.length}명)
                  </h3>
                  <p className="text-xs text-slate-500">
                    학생을 선택하여 전환하거나, 불필요한 학생을 삭제할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRosterModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
              {students.map((s) => {
                const isCurrent = s.id === currentStudent.id;
                return (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isCurrent
                        ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/30"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div
                      onClick={() => {
                        onSelectStudent(s);
                        setIsRosterModalOpen(false);
                      }}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {s.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center gap-0.5">
                            <UserCheck className="w-3 h-3" />
                            <span>현재 선택됨</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{s.gradeLevel} · {s.currentSemester}</span>
                        <span>·</span>
                        <span>평균 {s.overallAverage.toFixed(1)}점</span>
                        <span>·</span>
                        <span>과목 {s.subjects.length}개</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            onSelectStudent(s);
                            setIsRosterModalOpen(false);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          선택
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onDeleteStudent(s.id);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={`[${s.name}] 학생 삭제`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddNewStudent();
                    setIsRosterModalOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 학생 등록</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRosterModalOpen(false);
                    onOpenImportModal();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>통지표 PDF·엑셀로 일괄 등록</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsRosterModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
