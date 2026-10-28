import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth } from "./lib/firebase";
import {
  DEMO_PROFILES,
  recomputeStudentProfile,
  createEmptySemester,
  SEMESTERS_META,
} from "./lib/gradeCalculator";
import { StudentProfile, StudyPlanResult, HabitDiagnosisResult, SemesterGradeRecord } from "./types";
import { Header } from "./components/Header";
import { GradeAnalysisTab } from "./components/GradeAnalysisTab";
import { StudyHoursRoiTab } from "./components/StudyHoursRoiTab";
import { SemesterTrendTab } from "./components/SemesterTrendTab";
import { AiCounselingTab } from "./components/AiCounselingTab";
import { StudyPlannerTab } from "./components/StudyPlannerTab";
import { HabitDiagnosisTab } from "./components/HabitDiagnosisTab";
import { GoogleSheetsModal } from "./components/GoogleSheetsModal";
import { StudentProfileModal } from "./components/StudentProfileModal";
import { ImportSpreadsheetModal } from "./components/ImportSpreadsheetModal";
import { SemesterSelectorBar } from "./components/SemesterSelectorBar";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { StudentStudyPlannerView } from "./components/StudentStudyPlannerView";
import { DataManagementModal } from "./components/DataManagementModal";
import { registerStudentSafeMeta } from "./lib/studySync";
import {
  loadLocalPersistedState,
  saveStateToStorage,
  fetchServerPersistedState,
  AppPersistedState,
} from "./lib/storage";
import {
  BarChart3,
  Clock,
  TrendingUp,
  Sparkles,
  Calendar,
  ClipboardCheck,
} from "lucide-react";

export default function App() {
  // Check if student mode is requested via URL parameter
  const [isStudentMode, setIsStudentMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("mode") === "student" || urlParams.get("studentLink") === "1";
  });

  const studentModeParams = React.useMemo(() => {
    if (typeof window === "undefined") return { studentId: "", name: "", subs: [] as string[] };
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get("studentId") || "";
    const name = urlParams.get("name") || "";
    const subsParam = urlParams.get("subs");
    const subs = subsParam ? subsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    return { studentId, name, subs };
  }, []);

  // Synchronously load persisted state from localStorage on first render
  const initialPersistedState = React.useMemo(() => {
    return loadLocalPersistedState();
  }, []);

  const [students, setStudents] = useState<StudentProfile[]>(() => {
    if (initialPersistedState?.students && initialPersistedState.students.length > 0) {
      return initialPersistedState.students;
    }
    return DEMO_PROFILES;
  });

  const [activeStudentId, setActiveStudentId] = useState<string>(() => {
    if (
      initialPersistedState?.activeStudentId &&
      initialPersistedState.students?.some((s) => s.id === initialPersistedState.activeStudentId)
    ) {
      return initialPersistedState.activeStudentId;
    }
    if (initialPersistedState?.students && initialPersistedState.students.length > 0) {
      return initialPersistedState.students[0].id;
    }
    return DEMO_PROFILES[0].id;
  });

  const [activeTab, setActiveTab] = useState<string>("analysis");

  // Per-student saved study plans and habit diagnosis results
  const [studyPlanMap, setStudyPlanMap] = useState<Record<string, StudyPlanResult>>(() => {
    return initialPersistedState?.studyPlanMap || {};
  });

  const [habitResultMap, setHabitResultMap] = useState<Record<string, HabitDiagnosisResult>>(() => {
    return initialPersistedState?.habitResultMap || {};
  });

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    return initialPersistedState?.lastSavedAt || null;
  });

  // Modals
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // Auth state
  const [user, setUser] = useState<User | null>(null);

  // Modals
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentProfile | null>(null);

  // Batch import success message
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => setUser(currentUser),
      () => setUser(null)
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const currentStudent =
    students.find((s) => s.id === activeStudentId) || students[0];

  // 1. If localStorage was empty on boot, attempt to restore from server
  useEffect(() => {
    if (!initialPersistedState) {
      fetchServerPersistedState().then((serverState) => {
        if (serverState && Array.isArray(serverState.students) && serverState.students.length > 0) {
          setStudents(serverState.students);
          if (serverState.activeStudentId) setActiveStudentId(serverState.activeStudentId);
          if (serverState.studyPlanMap) setStudyPlanMap(serverState.studyPlanMap);
          if (serverState.habitResultMap) setHabitResultMap(serverState.habitResultMap);
          if (serverState.lastSavedAt) setLastSavedAt(serverState.lastSavedAt);
        }
      });
    }
  }, [initialPersistedState]);

  // 2. Continuous Auto-Save: Any modification (grades, headcount, ranks, profiles) is instantly stored
  useEffect(() => {
    if (students && students.length > 0) {
      const saved = saveStateToStorage(students, activeStudentId, studyPlanMap, habitResultMap);
      setLastSavedAt(saved.lastSavedAt);
    }
  }, [students, activeStudentId, studyPlanMap, habitResultMap]);

  // Automatically register safe student metadata on server (names only, zero grade data!)
  useEffect(() => {
    if (currentStudent && currentStudent.id) {
      registerStudentSafeMeta(
        currentStudent.id,
        currentStudent.name,
        currentStudent.subjects.map((s) => s.name)
      );
    }
  }, [currentStudent?.id, currentStudent?.name, currentStudent?.subjects]);

  const handleUpdateStudent = (updated: StudentProfile) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleSelectSemester = (semId: string) => {
    const updated = recomputeStudentProfile(currentStudent, semId);
    handleUpdateStudent(updated);
  };

  // Open confirmation modal for student deletion
  const handleDeleteStudent = (studentId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;
    setStudentToDelete(targetStudent);
  };

  // Execute deletion without blocked window.confirm
  const handleConfirmDelete = () => {
    if (!studentToDelete) return;
    const targetId = studentToDelete.id;
    setStudentToDelete(null);

    if (students.length <= 1) {
      // If last student, reset to a clean zero-data student
      const resetId = `student-${Date.now()}`;
      const emptySemesters: Record<string, SemesterGradeRecord> = {};
      SEMESTERS_META.forEach((m) => {
        emptySemesters[m.id] = createEmptySemester(m.id, 240);
      });

      const freshStudent: StudentProfile = {
        id: resetId,
        name: "새 학생",
        gradeLevel: "중학교 1학년",
        currentSemester: "1학년 2학기",
        activeSemesterId: "1-2",
        totalStudents: 240,
        overallAverage: 0,
        overallPercentile: 0,
        estimatedRank: 0,
        totalScore: 0,
        studyGoal: "",
        notes: "",
        semesters: emptySemesters,
        subjects: [],
        previousSemester: undefined,
      };

      setStudents([freshStudent]);
      setActiveStudentId(resetId);
      return;
    }

    const remaining = students.filter((s) => s.id !== targetId);
    setStudents(remaining);
    if (activeStudentId === targetId) {
      setActiveStudentId(remaining[0].id);
    }
  };

  // Add new student starting completely from 0
  const handleAddNewStudent = () => {
    const newId = `student-${Date.now()}`;
    const emptySemesters: Record<string, SemesterGradeRecord> = {};
    SEMESTERS_META.forEach((m) => {
      emptySemesters[m.id] = createEmptySemester(m.id, 240);
    });

    const newStudent: StudentProfile = {
      id: newId,
      name: `신규 학생 ${students.length + 1}`,
      gradeLevel: "중학교 1학년",
      currentSemester: "1학년 2학기",
      activeSemesterId: "1-2",
      totalStudents: 240,
      overallAverage: 0,
      overallPercentile: 0,
      estimatedRank: 0,
      totalScore: 0,
      studyGoal: "",
      notes: "",
      semesters: emptySemesters,
      subjects: [],
      previousSemester: undefined,
    };

    setStudents((prev) => [...prev, newStudent]);
    setActiveStudentId(newId);
    setActiveTab("analysis");
  };

  // Batch import students (e.g. from 27-student class PDF)
  const handleBatchImportStudents = (newStudents: StudentProfile[]) => {
    if (newStudents.length === 0) return;
    setStudents(newStudents);
    setActiveStudentId(newStudents[0].id);
    setActiveTab("analysis");
    setBatchSuccessMessage(
      `🎉 [${newStudents[0].name}] 외 총 ${newStudents.length}명의 학생이 자동 생성되었으며, 1학년 2학기~3학년 1학기까지의 3개년 전과목 원점수 및 학년 석차가 모두 일괄 입력되었습니다!`
    );
  };

  // Handle per-semester student count updates (totalStudents & classTotalStudents)
  const handleUpdateSemesterStudents = (
    semesterId: string,
    totalStudents: number,
    classTotalStudents?: number
  ) => {
    const curSem =
      currentStudent.semesters?.[semesterId] ||
      createEmptySemester(semesterId, totalStudents, classTotalStudents || 30);

    const updatedSem = {
      ...curSem,
      totalStudents: totalStudents > 0 ? totalStudents : 240,
      classTotalStudents:
        classTotalStudents && classTotalStudents > 0
          ? classTotalStudents
          : curSem.classTotalStudents || 30,
    };

    const updatedProfile = recomputeStudentProfile(
      {
        ...currentStudent,
        totalStudents:
          semesterId === currentStudent.activeSemesterId
            ? updatedSem.totalStudents
            : currentStudent.totalStudents,
        classTotalStudents:
          semesterId === currentStudent.activeSemesterId
            ? updatedSem.classTotalStudents
            : currentStudent.classTotalStudents,
        semesters: {
          ...currentStudent.semesters,
          [semesterId]: updatedSem,
        },
      },
      currentStudent.activeSemesterId
    );
    handleUpdateStudent(updatedProfile);
  };

  const handleBatchUpdateSemesterStudents = (
    updates: Record<string, { totalStudents: number; classTotalStudents: number }>
  ) => {
    const newSemesters = { ...currentStudent.semesters };
    Object.entries(updates).forEach(([semId, counts]) => {
      const curSem =
        newSemesters[semId] ||
        createEmptySemester(semId, counts.totalStudents, counts.classTotalStudents);
      newSemesters[semId] = {
        ...curSem,
        totalStudents: counts.totalStudents,
        classTotalStudents: counts.classTotalStudents,
      };
    });

    const activeSem = newSemesters[currentStudent.activeSemesterId];
    const updatedProfile = recomputeStudentProfile(
      {
        ...currentStudent,
        totalStudents: activeSem?.totalStudents || currentStudent.totalStudents,
        classTotalStudents: activeSem?.classTotalStudents || currentStudent.classTotalStudents,
        semesters: newSemesters,
      },
      currentStudent.activeSemesterId
    );
    handleUpdateStudent(updatedProfile);
  };

  // Batch update semester counts across ALL students in the class
  const handleApplySemesterStudentsToAllStudents = (
    updates: Record<string, { totalStudents: number; classTotalStudents: number }>
  ) => {
    const updatedStudents = students.map((stu) => {
      const newSemesters = { ...stu.semesters };
      Object.entries(updates).forEach(([semId, counts]) => {
        const curSem =
          newSemesters[semId] ||
          createEmptySemester(semId, counts.totalStudents, counts.classTotalStudents);
        newSemesters[semId] = {
          ...curSem,
          totalStudents: counts.totalStudents,
          classTotalStudents: counts.classTotalStudents,
        };
      });

      const activeSem = newSemesters[stu.activeSemesterId];
      return recomputeStudentProfile(
        {
          ...stu,
          totalStudents: activeSem?.totalStudents || stu.totalStudents,
          classTotalStudents: activeSem?.classTotalStudents || stu.classTotalStudents,
          semesters: newSemesters,
        },
        stu.activeSemesterId
      );
    });

    setStudents(updatedStudents);
    setBatchSuccessMessage(
      `학급 전체 학생 ${updatedStudents.length}명의 학기별 전교생 수 및 반 인원이 일괄 반영되었습니다.`
    );
    setTimeout(() => setBatchSuccessMessage(null), 4500);
  };

  const tabs = [
    {
      id: "analysis",
      label: "성적 분석 & 백분위",
      icon: BarChart3,
      badge: `${currentStudent.overallAverage.toFixed(1)}점`,
    },
    {
      id: "study_hours",
      label: "과목별 학습 시간 ROI",
      icon: Clock,
      badge: `${currentStudent.subjects.reduce((sum, s) => sum + s.weeklyStudyHours, 0)}h/주`,
    },
    {
      id: "trends",
      label: "학기별 추이 리포트",
      icon: TrendingUp,
      badge: currentStudent.previousSemester ? "비교 가능" : undefined,
    },
    {
      id: "counseling",
      label: "1:1 AI 맞춤 상담",
      icon: Sparkles,
      badge: "AI 코칭",
    },
    {
      id: "planner",
      label: "4주 학습 계획표",
      icon: Calendar,
      badge: studyPlanMap[currentStudent.id] ? "생성됨" : undefined,
    },
    {
      id: "habits",
      label: "학습 습관 진단 (설문)",
      icon: ClipboardCheck,
      badge: habitResultMap[currentStudent.id] ? habitResultMap[currentStudent.id].personaName : undefined,
    },
  ];

  // If in student mode, strictly render the student study planner only (ZERO grades, ZERO teacher tools)
  if (isStudentMode) {
    const matchedStudent = students.find((s) => s.id === studentModeParams.studentId);
    const initialSubs =
      studentModeParams.subs.length > 0
        ? studentModeParams.subs
        : matchedStudent?.subjects?.map((s) => s.name);

    return (
      <StudentStudyPlannerView
        studentId={studentModeParams.studentId || activeStudentId}
        studentName={studentModeParams.name || matchedStudent?.name || "학생"}
        initialSubjects={initialSubs}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <Header
        students={students}
        currentStudent={currentStudent}
        onSelectStudent={(s) => setActiveStudentId(s.id)}
        onAddNewStudent={handleAddNewStudent}
        onOpenEditStudent={() => setIsStudentModalOpen(true)}
        onDeleteStudent={handleDeleteStudent}
        onOpenGoogleSheets={() => setIsSheetsModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenDataManagement={() => setIsDataModalOpen(true)}
        onQuickSave={() => {
          const saved = saveStateToStorage(students, activeStudentId, studyPlanMap, habitResultMap);
          setLastSavedAt(saved.lastSavedAt);
        }}
        lastSavedAt={lastSavedAt}
        user={user}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 3-Year Batch Apply Success Alert Banner */}
        {batchSuccessMessage && (
          <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs text-white flex items-center justify-center font-black text-base shrink-0 shadow-2xs">
                ✓
              </div>
              <div>
                <p className="font-black text-sm">
                  {batchSuccessMessage}
                </p>
                <p className="text-xs text-emerald-100 mt-0.5">
                  1학년, 2학년, 3학년 전 학기 Z-점수, 상위 누적 백분위, 예상 석차가 전원 산출되었습니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={() => {
                  setActiveTab("trends");
                  setBatchSuccessMessage(null);
                }}
                className="px-3.5 py-1.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-black text-xs transition cursor-pointer shadow-xs"
              >
                3개년 성장 궤적 보기 →
              </button>
              <button
                onClick={() => setBatchSuccessMessage(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200/90 shadow-2xs overflow-x-auto">
          <nav className="flex space-x-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 1, 2, 3 Grade Semester Switcher Bar */}
        <SemesterSelectorBar
          student={currentStudent}
          activeSemesterId={currentStudent.activeSemesterId || "2-2"}
          onSelectSemester={handleSelectSemester}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          allStudentsCount={students.length}
          onUpdateSemesterStudents={handleUpdateSemesterStudents}
          onBatchUpdateSemesterStudents={handleBatchUpdateSemesterStudents}
          onApplySemesterStudentsToAllStudents={handleApplySemesterStudentsToAllStudents}
        />

        {/* Tab Content Panels */}
        {activeTab === "analysis" && (
          <GradeAnalysisTab
            student={currentStudent}
            onUpdateStudent={handleUpdateStudent}
            onNavigateToTab={(tabId) => setActiveTab(tabId)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}

        {activeTab === "study_hours" && (
          <StudyHoursRoiTab
            student={currentStudent}
            onUpdateSubjectHours={(subId, hours) => {
              const semId = currentStudent.activeSemesterId || "2-2";
              const updatedSubjects = currentStudent.subjects.map((s) =>
                s.id === subId ? { ...s, weeklyStudyHours: hours } : s
              );
              const curSem = currentStudent.semesters?.[semId];
              handleUpdateStudent(
                recomputeStudentProfile(
                  {
                    ...currentStudent,
                    semesters: {
                      ...currentStudent.semesters,
                      [semId]: {
                        ...(curSem || {
                          semesterId: semId,
                          semesterName: currentStudent.currentSemester,
                          gradeYear: 2,
                          term: 2,
                          overallAverage: 0,
                          overallPercentile: 0,
                          estimatedRank: 0,
                          isEntered: true,
                        }),
                        subjects: updatedSubjects,
                      },
                    },
                    subjects: updatedSubjects,
                  },
                  semId
                )
              );
            }}
            onBatchUpdateSubjectHours={(updates) => {
              const semId = currentStudent.activeSemesterId || "2-2";
              const updatedSubjects = currentStudent.subjects.map((s) => {
                if (updates[s.name] !== undefined) {
                  return { ...s, weeklyStudyHours: updates[s.name] };
                }
                return s;
              });
              const curSem = currentStudent.semesters?.[semId];
              handleUpdateStudent(
                recomputeStudentProfile(
                  {
                    ...currentStudent,
                    semesters: {
                      ...currentStudent.semesters,
                      [semId]: {
                        ...(curSem || {
                          semesterId: semId,
                          semesterName: currentStudent.currentSemester,
                          gradeYear: 2,
                          term: 2,
                          overallAverage: 0,
                          overallPercentile: 0,
                          estimatedRank: 0,
                          isEntered: true,
                        }),
                        subjects: updatedSubjects,
                      },
                    },
                    subjects: updatedSubjects,
                  },
                  semId
                )
              );
            }}
          />
        )}

        {activeTab === "trends" && (
          <SemesterTrendTab
            student={currentStudent}
            onUpdateStudent={handleUpdateStudent}
            onNavigateToTab={(tabId) => setActiveTab(tabId)}
          />
        )}

        {activeTab === "counseling" && (
          <AiCounselingTab
            student={currentStudent}
            habitResult={habitResultMap[currentStudent.id]}
            onOpenGoogleSheetsExport={() => setIsSheetsModalOpen(true)}
          />
        )}

        {activeTab === "planner" && (
          <StudyPlannerTab
            student={currentStudent}
            studyPlan={studyPlanMap[currentStudent.id] || null}
            onUpdateStudyPlan={(plan) =>
              setStudyPlanMap((prev) => ({
                ...prev,
                [currentStudent.id]: plan,
              }))
            }
            onOpenGoogleSheetsExport={() => setIsSheetsModalOpen(true)}
          />
        )}

        {activeTab === "habits" && (
          <HabitDiagnosisTab
            student={currentStudent}
            diagnosisResult={habitResultMap[currentStudent.id] || null}
            onUpdateDiagnosis={(result) =>
              setHabitResultMap((prev) => ({
                ...prev,
                [currentStudent.id]: result,
              }))
            }
            onOpenGoogleSheetsExport={() => setIsSheetsModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">중학 성취e음 · 중학교 맞춤형 성적 상담 및 학습 코칭 솔루션</p>
          <p className="mt-1 text-[11px] text-slate-400">
            정규분포 Z-Score 기반 백분위 추정 · 과목별 학습 시간 효율 분석 · 4주 시험 대비 자동 플래너 · Google Sheets 연동
          </p>
        </div>
      </footer>

      {/* Google Sheets Integration Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        student={currentStudent}
        studyPlan={studyPlanMap[currentStudent.id] || null}
        habitResult={habitResultMap[currentStudent.id] || null}
        user={user}
        onUserChange={setUser}
      />

      {/* Student Profile Settings Modal */}
      <StudentProfileModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        student={currentStudent}
        onSaveStudent={handleUpdateStudent}
        onDeleteStudent={handleDeleteStudent}
      />

      {/* Import Google Spreadsheet Modal */}
      <ImportSpreadsheetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentStudent={currentStudent}
        onApplyStudentGrades={(updated) => {
          handleUpdateStudent(updated);
          const enteredSemesters = Object.values(updated.semesters || {}).filter(
            (s) => s.isEntered
          );
          setBatchSuccessMessage(
            `3개년(총 ${enteredSemesters.length}개 학기) 성적이 성공적으로 일괄 반영되었습니다! 전학년 백분위와 석차, 3개년 성장 곡선이 자동 산출되었습니다.`
          );
        }}
        onApplyBatchStudents={handleBatchImportStudents}
        user={user}
        onOpenGoogleSignIn={() => {
          setIsImportModalOpen(false);
          setIsSheetsModalOpen(true);
        }}
      />

      {/* Student Deletion In-App Confirmation Modal */}
      <ConfirmationModal
        isOpen={studentToDelete !== null}
        title={students.length <= 1 ? "학생 초기화 및 삭제" : "학생 삭제 확인"}
        message={
          students.length <= 1
            ? `[${studentToDelete?.name || "학생"}]은(는) 현재 등록된 유일한 학생입니다.\n삭제 시 모든 성적 데이터가 0인 새로운 학생으로 초기화됩니다.\n계속 진행하시겠습니까?`
            : `정말로 [${studentToDelete?.name || "학생"}] 학생을 명단에서 삭제하시겠습니까?\n삭제 후에는 해당 학생의 모든 학기 성적, 통계 및 리포트 데이터가 제거됩니다.`
        }
        confirmLabel={students.length <= 1 ? "초기화 후 삭제" : "학생 삭제하기"}
        cancelLabel="취소"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setStudentToDelete(null)}
      />

      {/* Data Save, Backup Export & Restore Modal */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        students={students}
        activeStudentId={activeStudentId}
        studyPlanMap={studyPlanMap}
        habitResultMap={habitResultMap}
        lastSavedAt={lastSavedAt}
        onRestoreState={(restored) => {
          setStudents(restored.students);
          setActiveStudentId(restored.activeStudentId);
          setStudyPlanMap(restored.studyPlanMap || {});
          setHabitResultMap(restored.habitResultMap || {});
          setLastSavedAt(restored.lastSavedAt);
        }}
        onForceSave={() => {
          const saved = saveStateToStorage(students, activeStudentId, studyPlanMap, habitResultMap);
          setLastSavedAt(saved.lastSavedAt);
        }}
      />
    </div>
  );
}
