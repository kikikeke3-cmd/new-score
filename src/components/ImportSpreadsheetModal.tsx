import React, { useState, useRef } from "react";
import { User } from "firebase/auth";
import {
  FileSpreadsheet,
  Upload,
  Link2,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Download,
  Layers,
  Sparkles,
  ClipboardPaste,
  FileText,
  Users,
} from "lucide-react";
import {
  parseMultipleSpreadsheetFiles,
  parseGradeRows,
  extractSpreadsheetId,
  downloadThreeYearSampleWorkbook,
  generateSampleTemplateCsv,
  BatchThreeYearResult,
  parseGoogleSpreadsheetTabs,
  parseTextPastedGrades,
} from "../lib/sheetParser";
import {
  importStudentGradesFromSheet,
  importAllTabsFromSpreadsheet,
  listUserSpreadsheets,
  GoogleSpreadsheetItem,
} from "../lib/googleSheets";
import { StudentProfile, SubjectGrade, SemesterGradeRecord } from "../types";
import {
  computeSubjectMetrics,
  computeSemesterRecord,
  recomputeStudentProfile,
  createEmptySemester,
  SEMESTERS_META,
} from "../lib/gradeCalculator";
import {
  parsePdfReportCards,
  convertParsedToStudentProfile,
  PdfParseResult,
} from "../lib/pdfReportParser";

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: StudentProfile;
  onApplyStudentGrades: (updatedStudent: StudentProfile) => void;
  onApplyBatchStudents?: (students: StudentProfile[]) => void;
  user: User | null;
  onOpenGoogleSignIn?: () => void;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  currentStudent,
  onApplyStudentGrades,
  onApplyBatchStudents,
  user,
  onOpenGoogleSignIn,
}) => {
  const [activeMode, setActiveMode] = useState<"file" | "drive" | "url" | "paste">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Text paste input
  const [pastedText, setPastedText] = useState("");

  // Target semester for single semester fallback (1-2 to 3-2)
  const [targetSemesterId, setTargetSemesterId] = useState<string>(
    currentStudent.activeSemesterId || "2-2"
  );

  // URL input
  const [sheetUrlInput, setSheetUrlInput] = useState("");

  // Drive sheets list
  const [driveSheets, setDriveSheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  // Batch Result (Supports 1 to 6 semesters at once!)
  const [batchResult, setBatchResult] = useState<BatchThreeYearResult | null>(null);
  const [updateStudentMeta, setUpdateStudentMeta] = useState(true);
  const [resetUnenteredSemesters, setResetUnenteredSemesters] = useState(true);

  // Upfront Semester Headcounts (전입·전출 반영 학기별 전교생 수 & 반 인원 사전 설정)
  const [semesterHeadcounts, setSemesterHeadcounts] = useState<
    Record<string, { totalStudents: number; classTotalStudents: number }>
  >(() => {
    const initial: Record<string, { totalStudents: number; classTotalStudents: number }> = {};
    SEMESTERS_META.forEach((m) => {
      const rec = currentStudent.semesters?.[m.id];
      initial[m.id] = {
        totalStudents:
          rec?.totalStudents && rec.totalStudents > 0
            ? rec.totalStudents
            : currentStudent.totalStudents || 109,
        classTotalStudents:
          rec?.classTotalStudents && rec.classTotalStudents > 0
            ? rec.classTotalStudents
            : currentStudent.classTotalStudents || 30,
      };
    });
    return initial;
  });

  const handleSemesterCountChange = (
    semId: string,
    field: "totalStudents" | "classTotalStudents",
    valStr: string
  ) => {
    const num = parseInt(valStr.replace(/[^0-9]/g, ""), 10);
    const safeNum = isNaN(num) || num <= 0 ? 0 : num;

    setSemesterHeadcounts((prev) => {
      const updated = {
        ...prev,
        [semId]: {
          ...prev[semId],
          [field]: safeNum,
        },
      };

      if (pdfResult && pdfResult.rawParsedStudents) {
        const recomputed = pdfResult.rawParsedStudents.map((raw: any, idx: number) =>
          convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, updated)
        );
        setPdfResult((prevPdf) => (prevPdf ? { ...prevPdf, students: recomputed } : null));
      }

      return updated;
    });
  };

  const handleCopyFirstSemesterCountToAll = () => {
    const first = semesterHeadcounts["1-2"] || { totalStudents: 109, classTotalStudents: 30 };
    const updated: Record<string, { totalStudents: number; classTotalStudents: number }> = {};
    SEMESTERS_META.forEach((m) => {
      updated[m.id] = { ...first };
    });
    setSemesterHeadcounts(updated);

    if (pdfResult && pdfResult.rawParsedStudents) {
      const recomputed = pdfResult.rawParsedStudents.map((raw: any, idx: number) =>
        convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, updated)
      );
      setPdfResult((prevPdf) => (prevPdf ? { ...prevPdf, students: recomputed } : null));
    }
  };

  // PDF Parse Result (Supports full class report card with multiple students)
  const [pdfResult, setPdfResult] = useState<PdfParseResult | null>(null);
  const [selectedPdfStudentIndex, setSelectedPdfStudentIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Shortcut loader for user's uploaded sample PDF
  const handleLoadSamplePdf = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/sample-pdf-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await resp.json();
      if (!json.success || !json.result) {
        throw new Error(json.error || "샘플 PDF 불러오기 실패");
      }
      const sResult = json.result;
      const detectedTotal = sResult.rawParsedStudents[0]?.totalStudents || 109;
      const detectedClass = sResult.rawParsedStudents[0]?.classTotalStudents || 30;

      const activeCounts = { ...semesterHeadcounts };
      SEMESTERS_META.forEach((m) => {
        if (!activeCounts[m.id] || activeCounts[m.id].totalStudents === 240) {
          activeCounts[m.id] = { totalStudents: detectedTotal, classTotalStudents: detectedClass };
        }
      });
      setSemesterHeadcounts(activeCounts);

      const students = sResult.rawParsedStudents.map((raw: any, idx: number) =>
        convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, activeCounts)
      );
      setPdfResult({
        ...sResult,
        students,
      });
      setBatchResult(null);
    } catch (err: any) {
      console.error("Sample PDF load error:", err);
      setError(err.message || "샘플 성적통지표를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Handle file upload (Supports PDF, multi-tab .xlsx, or multiple files dropped together)
  const handleFilesUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setPdfResult(null);

    // Check if any file is PDF (e.g. 내신성적 통지표 PDF)
    const pdfFile = files.find(
      (f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
    );

    if (pdfFile) {
      try {
        let parsedPdf: PdfParseResult;
        try {
          parsedPdf = await parsePdfReportCards(pdfFile);
          const detectedTotal = parsedPdf.rawParsedStudents[0]?.totalStudents || 109;
          const detectedClass = parsedPdf.rawParsedStudents[0]?.classTotalStudents || 30;
          const activeCounts = { ...semesterHeadcounts };
          SEMESTERS_META.forEach((m) => {
            if (!activeCounts[m.id] || activeCounts[m.id].totalStudents === 240) {
              activeCounts[m.id] = { totalStudents: detectedTotal, classTotalStudents: detectedClass };
            }
          });
          setSemesterHeadcounts(activeCounts);
          parsedPdf.students = parsedPdf.rawParsedStudents.map((raw, idx) =>
            convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, activeCounts)
          );
        } catch (clientErr) {
          console.warn("Client PDF parse error, falling back to server API:", clientErr);
          const buffer = await pdfFile.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          const resp = await fetch("/api/parse-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdfBase64: base64 }),
          });
          const json = await resp.json();
          if (!json.success || !json.result) {
            throw new Error(json.error || "PDF 파일 분석에 실패했습니다.");
          }
          const sResult = json.result;
          const detectedTotal = sResult.rawParsedStudents[0]?.totalStudents || 109;
          const detectedClass = sResult.rawParsedStudents[0]?.classTotalStudents || 30;
          const activeCounts = { ...semesterHeadcounts };
          SEMESTERS_META.forEach((m) => {
            if (!activeCounts[m.id] || activeCounts[m.id].totalStudents === 240) {
              activeCounts[m.id] = { totalStudents: detectedTotal, classTotalStudents: detectedClass };
            }
          });
          setSemesterHeadcounts(activeCounts);

          const students = sResult.rawParsedStudents.map((raw: any, idx: number) =>
            convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, activeCounts)
          );
          parsedPdf = {
            ...sResult,
            students,
          };
        }

        if (!parsedPdf || parsedPdf.students.length === 0) {
          throw new Error("PDF에서 내신 성적 통지표 데이터를 추출하지 못했습니다.");
        }

        setPdfResult(parsedPdf);
        setBatchResult(null);
      } catch (err: any) {
        console.error("PDF parse error:", err);
        setError(err.message || "PDF 내신성적 통지표를 읽는데 실패했습니다.");
        setPdfResult(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const parsed = await parseMultipleSpreadsheetFiles(files);
      if (parsed.detectedSemesters.length === 0) {
        throw new Error("유효한 과목 및 성적 데이터를 찾을 수 없습니다.");
      }
      setBatchResult(parsed);

      // If single semester was detected, default targetSemesterId
      if (parsed.detectedSemesters.length === 1) {
        setTargetSemesterId(parsed.detectedSemesters[0].semesterId);
      }
    } catch (err: any) {
      console.error("Spreadsheet file parse error:", err);
      setError(err.message || "스프레드시트 파일을 읽는데 실패했습니다.");
      setBatchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesUpload(files);
    }
  };

  // 2. Handle Google Sheet URL or ID (supports 3-year multi-tabs or single sheet)
  const handleImportByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const spreadsheetId = extractSpreadsheetId(sheetUrlInput);
      const { tabs } = await importAllTabsFromSpreadsheet(spreadsheetId);
      const parsedBatch = parseGoogleSpreadsheetTabs(tabs);

      if (parsedBatch.detectedSemesters.length === 0) {
        throw new Error("유효한 과목 및 성적 데이터를 찾을 수 없습니다. 서식을 확인해주세요.");
      }

      setBatchResult(parsedBatch);
      if (parsedBatch.detectedSemesters.length === 1) {
        setTargetSemesterId(parsedBatch.detectedSemesters[0].semesterId);
      }
    } catch (err: any) {
      console.error("Sheet URL import error:", err);
      setError(
        err.message ||
          "구글 스프레드시트에서 데이터를 가져오지 못했습니다. 링크 및 접근 권한을 확인해주세요."
      );
      setBatchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Drive Sheet selection (supports 3-year multi-tabs or single sheet)
  const handleLoadDriveSheets = async () => {
    if (!user) return;
    setIsLoadingDrive(true);
    setError(null);
    try {
      const list = await listUserSpreadsheets();
      setDriveSheets(list);
    } catch (err: any) {
      setError(err.message || "드라이브 시트 목록 조회 실패");
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleSelectDriveSheet = async (sheetId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { tabs } = await importAllTabsFromSpreadsheet(sheetId);
      const parsedBatch = parseGoogleSpreadsheetTabs(tabs);

      if (parsedBatch.detectedSemesters.length === 0) {
        throw new Error("해당 스프레드시트에서 유효한 성적 데이터를 찾지 못했습니다.");
      }

      setBatchResult(parsedBatch);
      if (parsedBatch.detectedSemesters.length === 1) {
        setTargetSemesterId(parsedBatch.detectedSemesters[0].semesterId);
      }
    } catch (err: any) {
      console.error("Drive sheet import error:", err);
      setError(
        err.message || "해당 스프레드시트에서 성적 데이터를 읽지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle text/table paste
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setError(null);
    try {
      const parsed = parseTextPastedGrades(pastedText);
      if (parsed.subjects.length === 0) {
        throw new Error(
          "입력된 텍스트에서 과목명과 점수를 찾지 못했습니다.\n예시: 국어 95, 수학 88"
        );
      }

      const semId = targetSemesterId || currentStudent.activeSemesterId || "2-2";
      const targetMeta = SEMESTERS_META.find((m) => m.id === semId);
      const calcTotal = parsed.subjects.reduce((sum, s) => sum + s.score, 0);
      const avg =
        parsed.overallAverage && parsed.overallAverage > 0
          ? parsed.overallAverage
          : parseFloat((calcTotal / parsed.subjects.length).toFixed(1));

      const batch: BatchThreeYearResult = {
        studentName: currentStudent.name,
        gradeLevel: currentStudent.gradeLevel,
        totalStudents: currentStudent.totalStudents,
        classTotalStudents: currentStudent.classTotalStudents || 30,
        semesters: {
          [semId]: parsed.subjects,
        },
        semesterMeta: {
          [semId]: {
            totalScore: parsed.totalScore || calcTotal,
            overallAverage: avg,
            classRank: parsed.classRank,
            schoolRank: parsed.schoolRank,
          },
        },
        detectedSemesters: [
          {
            semesterId: semId,
            semesterName: targetMeta?.name || `${semId}학기`,
            subjectsCount: parsed.subjects.length,
            totalScore: parsed.totalScore || calcTotal,
            averageScore: avg,
            classRank: parsed.classRank,
            schoolRank: parsed.schoolRank,
            totalStudents: currentStudent.totalStudents,
          },
        ],
      };

      setBatchResult(batch);
    } catch (err: any) {
      setError(err.message || "텍스트 분석 실패");
      setBatchResult(null);
    }
  };

  // Apply parsed 3-year grades to the student profile
  const handleApplyToStudent = () => {
    if (!batchResult) return;

    const totalStudents =
      updateStudentMeta && batchResult.totalStudents
        ? batchResult.totalStudents
        : currentStudent.totalStudents;

    // Build updated semesters map across all 5 semesters
    const updatedSemesters: Record<string, SemesterGradeRecord> = {};
    SEMESTERS_META.forEach((m) => {
      const counts = semesterHeadcounts[m.id] || { totalStudents, classTotalStudents: 30 };
      if (resetUnenteredSemesters) {
        updatedSemesters[m.id] = createEmptySemester(m.id, counts.totalStudents, counts.classTotalStudents);
      } else {
        updatedSemesters[m.id] = currentStudent.semesters?.[m.id]
          ? currentStudent.semesters[m.id]
          : createEmptySemester(m.id, counts.totalStudents, counts.classTotalStudents);
      }
    });

    let latestSemId = targetSemesterId;

    if (!isMultiSemesterBatch) {
      // Single semester import: apply directly to targetSemesterId selected by user!
      const firstSemEntry = Object.entries(batchResult.semesters)[0];
      if (firstSemEntry) {
        const [_, parsedSubjects] = firstSemEntry;
        const targetMeta = SEMESTERS_META.find((m) => m.id === targetSemesterId);
        const existing = currentStudent.semesters?.[targetSemesterId];
        const semMeta = Object.values(batchResult.semesterMeta || {})[0];
        const semCounts = semesterHeadcounts[targetSemesterId] || { totalStudents, classTotalStudents: 30 };

        const fullSubjects: SubjectGrade[] = parsedSubjects.map((sub) =>
          computeSubjectMetrics(sub, semCounts.totalStudents)
        );

        updatedSemesters[targetSemesterId] = computeSemesterRecord(
          {
            ...(existing || {
              semesterId: targetSemesterId,
              semesterName: targetMeta?.name || `${targetSemesterId}학기`,
              gradeYear: (targetMeta?.gradeYear || 2) as 1 | 2 | 3,
              term: (targetMeta?.term || 2) as 1 | 2,
              overallAverage: 0,
              overallPercentile: 0,
              estimatedRank: 0,
              isEntered: true,
            }),
            subjects: fullSubjects,
            totalScore: semMeta?.totalScore ?? existing?.totalScore,
            overallAverage: semMeta?.overallAverage ?? existing?.overallAverage ?? 0,
            classRank: semMeta?.classRank ?? existing?.classRank,
            schoolRank: semMeta?.schoolRank ?? existing?.schoolRank,
            totalStudents: semCounts.totalStudents,
            classTotalStudents:
              semMeta?.classTotalStudents ?? semCounts.classTotalStudents ?? 30,
            isEntered: true,
          },
          semCounts.totalStudents
        );
      }
      latestSemId = targetSemesterId;
    } else {
      // Multi-semester batch: apply each semester to its matching semesterId
      for (const [semId, parsedSubjects] of Object.entries(batchResult.semesters)) {
        if (semId === "1-1") continue; // Exclude 1-1 free semester
        const targetMeta = SEMESTERS_META.find((m) => m.id === semId);
        const existing = currentStudent.semesters?.[semId];
        const semMeta = batchResult.semesterMeta?.[semId];
        const semCounts = semesterHeadcounts[semId] || { totalStudents, classTotalStudents: 30 };

        const fullSubjects: SubjectGrade[] = parsedSubjects.map((sub) =>
          computeSubjectMetrics(sub, semCounts.totalStudents)
        );

        updatedSemesters[semId] = computeSemesterRecord(
          {
            ...(existing || {
              semesterId: semId,
              semesterName: targetMeta?.name || `${semId}학기`,
              gradeYear: (targetMeta?.gradeYear || 2) as 1 | 2 | 3,
              term: (targetMeta?.term || 2) as 1 | 2,
              overallAverage: 0,
              overallPercentile: 0,
              estimatedRank: 0,
              isEntered: true,
            }),
            subjects: fullSubjects,
            totalScore: semMeta?.totalScore ?? existing?.totalScore,
            overallAverage: semMeta?.overallAverage ?? existing?.overallAverage ?? 0,
            classRank: semMeta?.classRank ?? existing?.classRank,
            schoolRank: semMeta?.schoolRank ?? existing?.schoolRank,
            totalStudents: semCounts.totalStudents,
            classTotalStudents:
              semMeta?.classTotalStudents ?? semCounts.classTotalStudents ?? 30,
            isEntered: true,
          },
          semCounts.totalStudents
        );
      }

      const semKeys = Object.keys(batchResult.semesters).filter((id) => id !== "1-1");
      const sortedDetected = SEMESTERS_META.filter((m) =>
        semKeys.includes(m.id)
      );
      latestSemId =
        sortedDetected.length > 0
          ? sortedDetected[sortedDetected.length - 1].id
          : currentStudent.activeSemesterId || "2-2";
    }

    const updatedProfile = recomputeStudentProfile(
      {
        ...currentStudent,
        name:
          updateStudentMeta && batchResult.studentName
            ? batchResult.studentName
            : currentStudent.name,
        totalStudents: semesterHeadcounts[latestSemId]?.totalStudents || totalStudents,
        classTotalStudents: semesterHeadcounts[latestSemId]?.classTotalStudents || currentStudent.classTotalStudents || 30,
        semesters: updatedSemesters,
      },
      latestSemId
    );

    onApplyStudentGrades(updatedProfile);
    onClose();
  };

  const handleApplyPdfAllStudents = () => {
    if (!pdfResult || pdfResult.students.length === 0) return;
    const finalStudents = pdfResult.rawParsedStudents.map((raw: any, idx: number) =>
      convertParsedToStudentProfile(raw, `${Date.now()}-${idx + 1}`, semesterHeadcounts)
    );
    if (onApplyBatchStudents) {
      onApplyBatchStudents(finalStudents);
    } else {
      onApplyStudentGrades(finalStudents[0]);
    }
    onClose();
  };

  const handleApplyPdfSingleStudent = () => {
    if (!pdfResult || !pdfResult.rawParsedStudents[selectedPdfStudentIndex]) return;
    const raw = pdfResult.rawParsedStudents[selectedPdfStudentIndex];
    const singleStudent = convertParsedToStudentProfile(
      raw,
      `${Date.now()}-${selectedPdfStudentIndex + 1}`,
      semesterHeadcounts
    );
    onApplyStudentGrades(singleStudent);
    onClose();
  };

  const isMultiSemesterBatch =
    batchResult && batchResult.detectedSemesters.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  3개년(1·2·3학년) 성적 파일 한번에 올리기
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  전학년 자동 산출
                </span>
              </div>
              <p className="text-xs text-slate-500">
                중학교 5개 학기(1-2, 2-1, 2-2, 3-1, 3-2) 시트가 포함된 통합 엑셀 파일이나 여러 파일을 올리면 전학년 성적이 한번에 계산됩니다. (1-1은 자유학기제로 제외)
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

        {/* Action & Mode Switcher Bar */}
        <div className="px-6 pt-3.5 pb-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => {
                setActiveMode("file");
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === "file"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>파일 올리기 (다중 지원)</span>
            </button>

            <button
              onClick={() => {
                setActiveMode("drive");
                setError(null);
                if (driveSheets.length === 0) handleLoadDriveSheets();
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === "drive"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>내 구글 드라이브</span>
            </button>

            <button
              onClick={() => {
                setActiveMode("url");
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === "url"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>구글 시트 링크</span>
            </button>

            <button
              onClick={() => {
                setActiveMode("paste");
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === "paste"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>텍스트/표 직접 붙여넣기</span>
            </button>
          </div>

          {/* Sample Download Button */}
          <button
            onClick={downloadThreeYearSampleWorkbook}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="1~3학년 6개 학기 탭이 포함된 엑셀 서식 다운로드"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>3개년 통합 양식(.xlsx) 다운로드</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Upfront Semester Headcounts Pre-Configuration Card */}
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-slate-50 border border-blue-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-2xs">
                  <Users className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <span>📋 학기별 전교생 수 & 반 인원 사전 설정 (전입·전출 반영)</span>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                      생성되는 전체 학생 자동 일괄 적용
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    전학생으로 인해 학기마다 전교생 수가 다를 경우 여기서 미리 입력해두면,
                    <strong> 생성되는 모든 학생({pdfResult ? `${pdfResult.studentsCount}명` : "전체"})의 성적표에 각각 자동 반영</strong>되어 개별 수정할 필요가 없습니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyFirstSemesterCountToAll}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline shrink-0 cursor-pointer self-start sm:self-auto"
              >
                1-2학기 인원을 전체 학기에 일괄 복사
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SEMESTERS_META.map((meta) => {
                const counts = semesterHeadcounts[meta.id] || { totalStudents: 109, classTotalStudents: 30 };
                return (
                  <div
                    key={meta.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                      <span>{meta.name}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold">전교생:</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="1"
                            max="2000"
                            value={counts.totalStudents}
                            onChange={(e) => handleSemesterCountChange(meta.id, "totalStudents", e.target.value)}
                            className="w-14 px-1 py-0.5 bg-blue-50/50 border border-blue-300 rounded font-black text-blue-950 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                            title="해당 학기 전교생 수"
                          />
                          <span className="text-[10px] text-slate-400">명</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold">학급:</span>
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={counts.classTotalStudents}
                            onChange={(e) => handleSemesterCountChange(meta.id, "classTotalStudents", e.target.value)}
                            className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 text-center text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                            title="해당 학기 반 인원"
                          />
                          <span className="text-[10px] text-slate-400">명</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mode 1: File Dropzone (Multiple files or 3-year workbook supported!) */}
          {activeMode === "file" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50/60 scale-[1.01]"
                  : "border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx, .xls, .csv, .ods, .pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesUpload(e.target.files);
                  }
                }}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Upload className="w-7 h-7" />
              </div>

              <h4 className="text-sm font-bold text-slate-900 mb-1">
                3개년 통합 엑셀 파일 또는 [내신성적 통지표 PDF]를 여기에 끌어다 놓으세요
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-3 leading-relaxed">
                5개 학기 엑셀 파일(.xlsx)이나 <strong>나이스/학교 내신성적 통지표 PDF</strong>를 올리면
                학생 자동 생성(학급 전체 일괄 등록)부터 3개년 전과목 원점수 및 석차가 한 번에 등록됩니다.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-semibold shadow-2xs hover:bg-slate-50"
                >
                  컴퓨터에서 파일 선택 (.xlsx, .csv, .pdf)
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadSamplePdf();
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isLoading ? "통지표 분석 중..." : "첨부된 통지표 PDF(27명 전체) 즉시 불러오기"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: Google Drive Sheets */}
          {activeMode === "drive" && (
            <div className="space-y-4">
              {!user ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <p className="font-semibold text-slate-700 text-sm mb-1">
                    Google 계정 연동 필요
                  </p>
                  <p className="text-slate-500 text-xs mb-4">
                    구글 드라이브의 스프레드시트 목록을 불러오려면 구글 로그인이 필요합니다.
                  </p>
                  {onOpenGoogleSignIn && (
                    <button
                      onClick={onOpenGoogleSignIn}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs"
                    >
                      Google 계정으로 로그인
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">
                      내 드라이브 스프레드시트 목록
                    </span>
                    <button
                      onClick={handleLoadDriveSheets}
                      disabled={isLoadingDrive}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isLoadingDrive ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>

                  {isLoadingDrive ? (
                    <div className="py-8 text-center text-slate-400">
                      스프레드시트 목록 로딩 중...
                    </div>
                  ) : driveSheets.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl">
                      드라이브에 스프레드시트가 없습니다.
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {driveSheets.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition flex items-center justify-between"
                        >
                          <div className="truncate pr-3">
                            <div className="font-bold text-slate-800 truncate">
                              {s.name}
                            </div>
                            {s.modifiedTime && (
                              <div className="text-[10px] text-slate-400">
                                {new Date(s.modifiedTime).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleSelectDriveSheet(s.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
                          >
                            이 시트 적용
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Direct URL */}
          {activeMode === "url" && (
            <form onSubmit={handleImportByUrl} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  구글 스프레드시트 공유 링크 또는 ID
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-hidden font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !sheetUrlInput.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isLoading ? "데이터 분석 중..." : "스프레드시트에서 성적 읽어오기"}
              </button>
            </form>
          )}

          {/* Mode 4: Direct Text / Table Paste */}
          {activeMode === "paste" && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    성적 텍스트 또는 엑셀 표를 여기에 직접 붙여넣으세요
                  </label>
                  <span className="text-[11px] text-slate-400">Ctrl+V 붙여넣기 지원</span>
                </div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`예시:\n국어 95\n수학 88\n영어 92\n과학 85\n사회 90\n도덕 94\n(또는 엑셀/한글 표를 복사하여 그대로 붙여넣으세요)`}
                  className="w-full p-3 font-mono text-xs bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-hidden leading-relaxed"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setPastedText(
                        "국어 95\n수학 88\n영어 92\n과학 85\n사회 90\n도덕 94\n기술가정 91"
                      )
                    }
                    className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
                  >
                    예시 텍스트 넣기
                  </button>
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    disabled={!pastedText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition shadow-xs disabled:opacity-40"
                  >
                    성적 데이터 분석 및 읽어오기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Case 0: PDF Report Card Preview (All students in class) */}
          {pdfResult && (
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-300 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-200">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      ✨ {pdfResult.schoolName} {pdfResult.gradeAndClass} 내신성적 통지표 분석 완료!
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      총 {pdfResult.studentsCount}명의 학생 명단과 1-2, 2-1, 2-2, 3-1학기 전과목 원점수 및 학년석차가 모두 감지되었습니다.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black px-3 py-1 bg-blue-600 text-white rounded-full self-start sm:self-auto shadow-2xs">
                  {pdfResult.studentsCount}명 일괄 인식
                </span>
              </div>

              {/* Student Roster Preview List */}
              <div className="bg-white rounded-xl border border-blue-200 p-3 max-h-56 overflow-y-auto space-y-2">
                <div className="text-xs font-bold text-slate-800 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span>감지된 학생 명단 ({pdfResult.students.length}명)</span>
                  <span className="text-[11px] font-normal text-slate-400">클릭하면 해당 학생 상세 정보 미리보기</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {pdfResult.students.map((st, idx) => {
                    const isSelected = idx === selectedPdfStudentIndex;
                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedPdfStudentIndex(idx)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "bg-blue-100/70 border-blue-400 font-bold text-blue-950"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold truncate">{st.name}</span>
                          <span className="text-[10px] text-slate-400">
                            ({st.notes?.split(" ")[0] || "3학년 2반"})
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono text-emerald-700 font-bold">
                            {st.schoolRank ? `전교 ${st.schoolRank}등` : ""}
                          </span>
                          {st.overallPercentile ? (
                            <span className="text-[10px] text-slate-400 ml-1">
                              (상위 {st.overallPercentile}%)
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Student Detail Peek */}
              {pdfResult.students[selectedPdfStudentIndex] && (
                <div className="p-3 bg-white/90 rounded-xl border border-blue-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">
                      선택된 학생: [{pdfResult.students[selectedPdfStudentIndex].name}]
                    </span>
                    <span className="text-slate-500 ml-2">
                      3학년 1학기 평균: <strong>{pdfResult.students[selectedPdfStudentIndex].overallAverage.toFixed(1)}점</strong> (과목 {pdfResult.students[selectedPdfStudentIndex].subjects.length}개)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyPdfSingleStudent}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    이 학생만 현재 프로필에 적용
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Case A: Multi-Semester 3-Year Batch Preview */}
          {isMultiSemesterBatch && batchResult && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 border border-emerald-300 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-black text-slate-900 text-sm">
                    ✨ 3개년 성적이 한번에 감지되었습니다! (총 {batchResult.detectedSemesters.length}개 학기)
                  </h4>
                </div>
                <span className="text-xs font-black px-3 py-1 bg-emerald-600 text-white rounded-full self-start sm:self-auto shadow-2xs">
                  전학년 자동 산출 준비 완료
                </span>
              </div>

              {/* Detected Semesters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {batchResult.detectedSemesters.map((ds) => (
                  <div
                    key={ds.semesterId}
                    className="bg-white rounded-xl p-3 border border-emerald-200/90 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-xs">
                        {ds.semesterName}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {ds.averageScore}점
                        </span>
                        {ds.totalScore && (
                          <span className="text-[10px] text-slate-500 ml-1 font-mono">
                            (총 {ds.totalScore}점)
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {ds.subjectsCount}개 과목
                      </span>
                    </div>

                    {(ds.schoolRank || ds.classRank) && (
                      <div className="mt-2 pt-1.5 border-t border-emerald-100 flex items-center justify-between text-[10px] font-bold">
                        {ds.schoolRank ? (
                          <span className="text-emerald-700">
                            학년 {ds.schoolRank}등
                          </span>
                        ) : (
                          <span />
                        )}
                        {ds.classRank && (
                          <span className="text-purple-700">
                            학급 {ds.classRank}등
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Student Metadata detection */}
              {(batchResult.studentName || batchResult.gradeLevel) && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200 text-xs">
                  <input
                    type="checkbox"
                    id="updateMetaBatch"
                    checked={updateStudentMeta}
                    onChange={(e) => setUpdateStudentMeta(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <label htmlFor="updateMetaBatch" className="text-slate-700 cursor-pointer font-medium">
                    파일에 기록된 학생 정보로 프로필 동기화:{" "}
                    <strong>{batchResult.studentName || currentStudent.name}</strong>
                  </label>
                </div>
              )}
              {/* Reset unentered semesters toggle for batch */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200 text-xs">
                <input
                  type="checkbox"
                  id="resetUnenteredBatch"
                  checked={resetUnenteredSemesters}
                  onChange={(e) => setResetUnenteredSemesters(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                />
                <label htmlFor="resetUnenteredBatch" className="text-slate-700 cursor-pointer font-medium">
                  파일에 없는 다른 학기는 <strong>미입력(0점) 상태로 유지/초기화</strong>
                  <span className="text-slate-400 block text-[11px] font-normal">
                    감지되지 않은 학기에 이전 임의 점수가 남아있지 않도록 깨끗하게 정리합니다.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Case B: Single Semester Preview (when only 1 semester was found) */}
          {!isMultiSemesterBatch && batchResult && batchResult.detectedSemesters.length === 1 && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    성적 데이터가 성공적으로 분석되었습니다!
                  </h4>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-200 text-emerald-900 rounded-full self-start sm:self-auto">
                  과목 {batchResult.detectedSemesters[0].subjectsCount}개 감지
                </span>
              </div>

              {/* Detected Subjects Badge Preview */}
              {Object.values(batchResult.semesters)[0] && (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2">
                  <span className="font-bold text-slate-800 text-xs">
                    인식된 과목명 및 원점수 ({Object.values(batchResult.semesters)[0].length}개):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Object.values(batchResult.semesters)[0].map((sub, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-bold flex items-center gap-1.5"
                      >
                        <span>{sub.name}</span>
                        <span className="text-emerald-700 font-black">{sub.score}점</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Semester Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-emerald-100 text-xs">
                <span className="font-bold text-slate-800">
                  성적을 적용할 대상 학기 선택:
                </span>
                <select
                  value={targetSemesterId}
                  onChange={(e) => setTargetSemesterId(e.target.value)}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg font-bold text-emerald-950 cursor-pointer outline-hidden"
                >
                  {SEMESTERS_META.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.gradeYear}학년 {m.term}학기)
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset unentered semesters toggle for single */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 text-xs">
                <input
                  type="checkbox"
                  id="resetUnenteredSingle"
                  checked={resetUnenteredSemesters}
                  onChange={(e) => setResetUnenteredSemesters(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                />
                <label htmlFor="resetUnenteredSingle" className="text-slate-700 cursor-pointer font-medium">
                  선택한 학기 외 다른 학기는 <strong>미입력(0점) 상태로 유지/초기화</strong>
                  <span className="text-slate-400 block text-[11px] font-normal">
                    체크 시 입력하지 않은 다른 학기는 그래프나 리포트에 임의 반영되지 않습니다.
                  </span>
                </label>
              </div>

              {/* Student Metadata detection */}
              {(batchResult.studentName || batchResult.gradeLevel) && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 text-xs">
                  <input
                    type="checkbox"
                    id="updateMetaSingle"
                    checked={updateStudentMeta}
                    onChange={(e) => setUpdateStudentMeta(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <label htmlFor="updateMetaSingle" className="text-slate-700 cursor-pointer">
                    시트에 기록된 학생 정보로 프로필도 함께 갱신:{" "}
                    <strong>{batchResult.studentName || currentStudent.name}</strong>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl font-semibold text-xs transition cursor-pointer"
          >
            취소
          </button>

          {pdfResult ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyPdfSingleStudent}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs"
              >
                [{pdfResult.students[selectedPdfStudentIndex]?.name}] 1명만 적용
              </button>
              <button
                type="button"
                onClick={handleApplyPdfAllStudents}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>전체 {pdfResult.studentsCount}명 학생 자동 생성 & 3개년 성적 일괄 등록</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApplyToStudent}
              disabled={!batchResult || batchResult.detectedSemesters.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isMultiSemesterBatch
                  ? `3개년(${batchResult.detectedSemesters.length}개 학기) 전체 성적 한번에 일괄 적용 및 산출하기`
                  : "이 성적 데이터를 학생에게 적용하기"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
