import React, { useState, useRef } from "react";
import { StudentProfile, StudyPlanResult, HabitDiagnosisResult } from "../types";
import {
  exportBackupFile,
  parseBackupFile,
  resetStorageToDemo,
  saveStateToStorage,
  AppPersistedState,
} from "../lib/storage";
import {
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Database,
  FileCheck,
  ShieldCheck,
  HardDrive,
} from "lucide-react";

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentProfile[];
  activeStudentId: string;
  studyPlanMap: Record<string, StudyPlanResult>;
  habitResultMap: Record<string, HabitDiagnosisResult>;
  lastSavedAt: string | null;
  onRestoreState: (state: AppPersistedState) => void;
  onForceSave: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  students,
  activeStudentId,
  studyPlanMap,
  habitResultMap,
  lastSavedAt,
  onRestoreState,
  onForceSave,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleManualSave = () => {
    onForceSave();
    setSuccessMessage("현재 모든 학생의 성적, 인원, 등수 데이터가 안전하게 저장되었습니다.");
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleExport = () => {
    exportBackupFile(students, activeStudentId, studyPlanMap, habitResultMap);
    setSuccessMessage("전체 데이터 백업 파일(.json)이 다운로드되었습니다. 다른 PC에서도 복원하여 사용하실 수 있습니다.");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const restored = await parseBackupFile(file);
      onRestoreState(restored);
      setSuccessMessage(
        `성공! 백업 파일에서 ${restored.students.length}명의 학생 데이터가 성공적으로 복원되었습니다.`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || "백업 파일을 불러오는 중 오류가 발생했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmReset = () => {
    const demoState = resetStorageToDemo();
    onRestoreState(demoState);
    setIsResetConfirmOpen(false);
    setSuccessMessage("초기 샘플 학생(3명) 데이터로 재설정되었습니다.");
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 2000);
  };

  const formattedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "실시간 저장 대기 중";

  // Calculate stats
  const totalEnteredSemesters = students.reduce((sum, s) => {
    const entered = Object.values(s.semesters || {}).filter((sem) => sem.isEntered).length;
    return sum + entered;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                데이터 저장 및 백업/복원 관리
              </h3>
              <p className="text-xs text-slate-500">
                페이지를 닫거나 다시 열어도 작업한 내용이 안전하게 보존됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Notification Banners */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold leading-tight">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-bold leading-tight">{errorMessage}</span>
            </div>
          )}

          {/* 1. Auto-Save Status Card */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 p-4 rounded-2xl border border-blue-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  실시간 자동 저장(Auto-Save) 활성화됨
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {formattedTime}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              파일 업로드, 학생 추가, 전교생 수, 반 인원, 성적 수정 등 모든 변경사항이 컴퓨터 브라우저와 서버 저장소에 <strong>즉시 자동 저장</strong>됩니다. 내일 다시 열어도 작업하던 상태 그대로 유지됩니다.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">등록된 총 학생 수</span>
                <span className="font-black text-slate-900">{students.length}명</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">입력 완료 학기 수</span>
                <span className="font-black text-blue-600">{totalEnteredSemesters}개 학기</span>
              </div>
            </div>
          </div>

          {/* 2. Manual Action Buttons */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-800 block text-xs">
              데이터 백업 및 수동 관리
            </label>

            {/* Save Now Button */}
            <button
              type="button"
              onClick={handleManualSave}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-blue-500/20 active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>지금 즉시 전체 데이터 저장하기</span>
            </button>

            {/* Export Backup JSON Button */}
            <button
              type="button"
              onClick={handleExport}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-semibold flex items-center justify-between transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                <span>📁 전체 데이터 백업 파일 다운로드 (.json)</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                PC 보관용
              </span>
            </button>

            {/* Import Backup JSON Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                id="restore-backup-file-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl font-semibold flex items-center justify-between transition cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>📥 저장해둔 백업 파일 불러오기 (.json)</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  다른 PC 연동
                </span>
              </button>
            </div>
          </div>

          {/* 3. Reset Option */}
          <div className="pt-3 border-t border-slate-100">
            {!isResetConfirmOpen ? (
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-slate-400 hover:text-rose-600 flex items-center gap-1.5 transition text-[11px] font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>데이터를 처음 상태(샘플 3명)로 초기화하기</span>
              </button>
            ) : (
              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2 text-rose-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>정말로 초기 샘플 데이터로 복원하시겠습니까?</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  현재 등록된 학생 및 수정된 성적 데이터가 초기 샘플로 대체됩니다.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                  >
                    초기화 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsResetConfirmOpen(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-semibold text-xs cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>브라우저 로컬 저장소 및 서버 캐시에 이중 백업 보존</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
