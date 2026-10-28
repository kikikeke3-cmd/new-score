import React, { useState, useEffect } from "react";
import { StudentProfile } from "../types";
import { recomputeStudentProfile } from "../lib/gradeCalculator";
import { UserCircle, X, Trash2 } from "lucide-react";

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile;
  onSaveStudent: (updated: StudentProfile) => void;
  onDeleteStudent?: (studentId: string) => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  onSaveStudent,
  onDeleteStudent,
}) => {
  const [name, setName] = useState(student.name);
  const [gradeLevel, setGradeLevel] = useState(student.gradeLevel);
  const [currentSemester, setCurrentSemester] = useState(student.currentSemester);
  const [totalStudents, setTotalStudents] = useState(student.totalStudents);
  const [studyGoal, setStudyGoal] = useState(student.studyGoal || "");
  const [notes, setNotes] = useState(student.notes || "");

  useEffect(() => {
    setName(student.name);
    setGradeLevel(student.gradeLevel);
    setCurrentSemester(student.currentSemester);
    setTotalStudents(student.totalStudents);
    setStudyGoal(student.studyGoal || "");
    setNotes(student.notes || "");
  }, [student, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const semIdMap: Record<string, string> = {
      "1학년 1학기": "1-1",
      "1학년 2학기": "1-2",
      "2학년 1학기": "2-1",
      "2학년 2학기": "2-2",
      "3학년 1학기": "3-1",
      "3학년 2학기": "3-2",
    };
    const activeSemId = semIdMap[currentSemester] || student.activeSemesterId || "2-2";

    const updated = recomputeStudentProfile(
      {
        ...student,
        name: name.trim() || "학생",
        gradeLevel,
        currentSemester,
        activeSemesterId: activeSemId,
        totalStudents: totalStudents > 0 ? totalStudents : 240,
        studyGoal,
        notes,
      },
      activeSemId
    );
    onSaveStudent(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">학생 정보 수정</h3>
              <p className="text-xs text-slate-500">학년, 기준 인원 및 목표 설정</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              학생 이름
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-bold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                학년 구분
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800"
              >
                <option value="중학교 1학년">중학교 1학년</option>
                <option value="중학교 2학년">중학교 2학년</option>
                <option value="중학교 3학년">중학교 3학년</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                현재 분석 학기
              </label>
              <select
                value={currentSemester}
                onChange={(e) => setCurrentSemester(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800"
              >
                <option value="1학년 1학기">1학년 1학기</option>
                <option value="1학년 2학기">1학년 2학기</option>
                <option value="2학년 1학기">2학년 1학기</option>
                <option value="2학년 2학기">2학년 2학기</option>
                <option value="3학년 1학기">3학년 1학기</option>
                <option value="3학년 2학기">3학년 2학기</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              전교 수강 인원 (석차 계산 기준)
            </label>
            <input
              type="number"
              min="10"
              max="1500"
              value={totalStudents}
              onChange={(e) => setTotalStudents(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              학교의 해당 학년 전체 학생 수를 입력하면 정확한 예상 등수가 산출됩니다.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              학습 및 성적 목표
            </label>
            <input
              type="text"
              placeholder="예: 전과목 올 A 달성 및 전교 20등 이내 진입"
              value={studyGoal}
              onChange={(e) => setStudyGoal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              학생 특징 및 상담 메모
            </label>
            <textarea
              rows={2}
              placeholder="취약점이나 상담 시 유의할 점을 적어두세요."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {onDeleteStudent ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteStudent(student.id);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer font-bold flex items-center gap-1.5"
                title="학생 명단에서 삭제"
              >
                <Trash2 className="w-4 h-4" />
                <span>학생 삭제</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition cursor-pointer shadow-xs"
              >
                저장하기
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
