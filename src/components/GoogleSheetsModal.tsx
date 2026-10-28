import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { googleSignIn, logout } from "../lib/firebase";
import {
  createCounselingSpreadsheet,
  listUserSpreadsheets,
  GoogleSpreadsheetItem,
} from "../lib/googleSheets";
import { ConfirmationModal } from "./ConfirmationModal";
import { StudentProfile, StudyPlanResult, HabitDiagnosisResult } from "../types";
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  LogOut,
  FolderOpen,
} from "lucide-react";

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  studyPlan: StudyPlanResult | null;
  habitResult: HabitDiagnosisResult | null;
  user: User | null;
  onUserChange: (user: User | null) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  student,
  studyPlan,
  habitResult,
  user,
  onUserChange,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessUrl, setExportSuccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state for Google Sheets operations
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

  // Load user spreadsheets if signed in
  useEffect(() => {
    if (user && isOpen) {
      loadSheetsList();
    }
  }, [user, isOpen]);

  const loadSheetsList = async () => {
    setIsLoadingSheets(true);
    try {
      const list = await listUserSpreadsheets();
      setSpreadsheets(list);
    } catch (err: any) {
      console.error("Failed to list sheets:", err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onUserChange(result.user);
      }
    } catch (err: any) {
      setError(err.message || "Google 로그인에 실패했습니다.");
    }
  };

  const handleSignOut = async () => {
    await logout();
    onUserChange(null);
    setSpreadsheets([]);
    setExportSuccessUrl(null);
  };

  // Trigger export with mandatory user confirmation modal
  const requestExportToSheets = () => {
    if (!user) {
      setError("먼저 Google 계정으로 로그인해주세요.");
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Google Sheets로 성적 및 상담 데이터 내보내기",
      message: `[${student.name}] 학생의 성적 분석(Z-Score, 백분위), 4주 시험 대비 학습 계획표, 학습 습관 진단 데이터를 담은 새로운 Google 스프레드시트를 생성하고 데이터를 기록합니다.\n\n진행하시겠습니까?`,
      action: async () => {
        setIsExporting(true);
        setError(null);
        setExportSuccessUrl(null);
        try {
          const { spreadsheetUrl } = await createCounselingSpreadsheet(
            student,
            studyPlan,
            habitResult
          );
          setExportSuccessUrl(spreadsheetUrl);
          loadSheetsList();
        } catch (err: any) {
          setError(err.message || "스프레드시트 내보내기에 실패했습니다.");
        } finally {
          setIsExporting(false);
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Google Sheets 스프레드시트 연동
                </h3>
                <p className="text-xs text-slate-500">
                  학생 성적 분석표, 4주 학습 계획표, 습관 진단 결과 저장 및 관리
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Auth section */}
            {!user ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200/80">
                <p className="text-slate-700 font-semibold mb-1 text-sm">
                  Google 계정 연동이 필요합니다
                </p>
                <p className="text-slate-500 text-xs mb-5 max-w-sm mx-auto">
                  Google Sheets에 성적표와 학습 계획표를 바로 생성하고 동기화하려면 Google 계정으로 로그인해주세요.
                </p>

                {/* Official Google Sign-in button format */}
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-semibold text-xs shadow-xs hover:bg-slate-50 hover:shadow-sm transition cursor-pointer"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-5 h-5 block"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-10 h-10 rounded-full border border-emerald-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {(user.displayName || user.email || "U")[0]}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {user.displayName || "Google 사용자"}
                    </div>
                    <div className="text-slate-500 text-[11px]">{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Export Action Card */}
            {user && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>새 스프레드시트로 일괄 내보내기</span>
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  현재 학생[{student.name}]의 성적 분석(원점수, 평균, 백분위, 석차), 4주 시험 대비 학습 계획표,
                  학습 습관 진단 결과가 포함된 스프레드시트를 생성합니다.
                </p>

                {exportSuccessUrl && (
                  <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold">스프레드시트가 성공적으로 생성되었습니다!</span>
                    </div>
                    <a
                      href={exportSuccessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-white rounded-lg text-emerald-800 font-bold border border-emerald-300 hover:bg-emerald-50 transition flex items-center gap-1"
                    >
                      <span>시트 열기</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <button
                  onClick={requestExportToSheets}
                  disabled={isExporting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Google Sheets에 기록 중...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Google Sheets로 즉시 내보내기</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Existing user spreadsheets in Google Drive */}
            {user && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-slate-600" />
                    <span>내 구글 드라이브 스프레드시트 목록</span>
                  </h4>
                  <button
                    onClick={loadSheetsList}
                    disabled={isLoadingSheets}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    title="새로고침"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingSheets ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                {isLoadingSheets ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    스프레드시트 목록 불러오는 중...
                  </div>
                ) : spreadsheets.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                    생성된 스프레드시트가 없습니다.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {spreadsheets.map((s) => (
                      <div
                        key={s.id}
                        className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-between text-xs transition"
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-800 truncate">
                            {s.name}
                          </div>
                          {s.modifiedTime && (
                            <div className="text-[10px] text-slate-400">
                              최종 수정: {new Date(s.modifiedTime).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {s.webViewLink && (
                          <a
                            href={s.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="스프레드시트 열기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="확인 및 생성"
        cancelLabel="취소"
        onConfirm={async () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await confirmDialog.action();
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};
