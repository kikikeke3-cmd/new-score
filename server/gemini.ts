import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export interface StudentGradeAnalysisPayload {
  studentName: string;
  gradeLevel: string; // e.g. "중학교 2학년"
  semester: string; // e.g. "2학기 중간/기말"
  overallAverage: number;
  overallPercentile: number; // e.g. 15.2 (상위 15.2%)
  totalStudents: number;
  estimatedRank: number;
  subjects: {
    name: string;
    score: number;
    mean: number;
    stdDev: number;
    achievement: string; // A, B, C, D, E
    weeklyStudyHours: number;
    targetScore: number;
    percentile: number;
  }[];
  previousSemester?: {
    name: string;
    overallAverage: number;
    subjectDiffs: {
      name: string;
      diff: number;
    }[];
  };
  multiSemesterTrajectory?: {
    semesterName: string;
    average: number;
  }[];
  habitDiagnosis?: {
    type: string;
    totalScore: number;
  };
}

export async function generateCounselingReport(payload: StudentGradeAnalysisPayload) {
  const prompt = `
당신은 대한민국 중학교 교육과정과 청소년 학습심리를 15년 이상 지도해 온 최고의 중학교 전문 수석 진로·학습 상담 교사이자 학습 코치입니다.
아래 학생의 성적 데이터, 1·2·3학년 학기별 성장 추이, 과목별 백분위 및 추정 석차, 과목별 학습 시간, 학습 습관 정보를 바탕으로 학생과 학부모가 읽고 즉시 실천할 수 있는 감동적이고 매우 구체적인 1:1 맞춤형 성적 성장 상담 리포트를 작성해주세요.

[학생 정보 및 성적 데이터]
- 학생 이름: ${payload.studentName} (${payload.gradeLevel})
- 현재 분석 학기: ${payload.semester}
- 전체 평균 점수: ${payload.overallAverage.toFixed(1)}점
- 전체 추정 백분위: 상위 ${payload.overallPercentile.toFixed(1)}% (수강자 ${payload.totalStudents}명 중 예상 ${payload.estimatedRank}등)
${
  payload.multiSemesterTrajectory && payload.multiSemesterTrajectory.length > 0
    ? `[1~3학년 다학기 평균 점수 추이: ${payload.multiSemesterTrajectory.map((t) => `${t.semesterName}(${t.average.toFixed(1)}점)`).join(" → ")}]`
    : ""
}
${payload.habitDiagnosis ? `- 학습 습관 진단 결과: ${payload.habitDiagnosis.type} (진단 총점: ${payload.habitDiagnosis.totalScore}/60)` : ""}

[과목별 세부 데이터 (원점수, 평균, 성취도, 백분위, 주간 공부시간, 목표점수)]
${payload.subjects
  .map(
    (s) =>
      `* ${s.name}: 원점수 ${s.score}점 (학교평균 ${s.mean}점, 표준편차 ${s.stdDev}) | 성취도 ${s.achievement} | 백분위 상위 ${s.percentile.toFixed(1)}% | 주당 ${s.weeklyStudyHours}시간 공부 | 목표 ${s.targetScore}점`
  )
  .join("\n")}

${
  payload.previousSemester
    ? `[이전 학기(${payload.previousSemester.name}) 대비 변화]
- 평균 변화: ${payload.overallAverage >= payload.previousSemester.overallAverage ? "+" : ""}${(payload.overallAverage - payload.previousSemester.overallAverage).toFixed(1)}점
- 과목별 증감: ${payload.previousSemester.subjectDiffs.map((d) => `${d.name}(${d.diff > 0 ? "+" : ""}${d.diff}점)`).join(", ")}`
    : ""
}

리포트는 다음 5개 섹션으로 구성해 주세요:
1. 🌟 [성취도 총평 & 따뜻한 격려]: 학생의 현재 성취 수준과 긍정적인 잠재력을 칭찬하고 자신감을 북돋아주는 메시지.
2. 🚀 [성적 성장을 위한 핵심 공략 과목 (점수 상승 골든키)]: 가장 적은 노력으로 전체 등수를 크게 끌어올릴 수 있는 핵심 전략 과목 1~2개와 구체적 점수 도약 포인트.
3. ⏱️ [공부 시간 대비 효율성(ROI) 분석]: 과목별 투입 시간과 성적의 상관관계를 분석하여, 시간 낭비를 줄이고 학습 시간을 재분배하는 실천 처방.
4. 📚 [과목별 맞춤형 공부법 솔루션]: 주요 과목(국어, 수학, 영어, 과학/사회 등)별 중학생에게 딱 맞는 교과서·개념서·오답노트 학습 꿀팁.
5. 🎯 [다음 시험 5점~10점 상승을 위한 3대 실천 약속]: 오늘부터 당장 시작할 수 있는 하루 30분 액션 플랜.

어조: 친절하고 다정하며 전문적인 선생님의 말투 (~해요, ~해볼까요?, ~입니다). 이해하기 쉽고 직관적인 구성으로 작성해 주세요.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
  });

  return response.text;
}

export async function generateAutoStudyPlan(payload: {
  studentName: string;
  gradeLevel: string;
  targetGoal: string;
  weakSubjects: string[];
  strongSubjects: string[];
  weeklyAvailableHours: number;
}) {
  const prompt = `
학생(${payload.studentName}, ${payload.gradeLevel})의 중학교 중간/기말고사 대비 및 성적 향상을 위한 4주 완성 맞춤형 시험 대비 학습 계획표와 일주일 타임블록을 JSON 형식으로 작성해주세요.

- 목표: ${payload.targetGoal}
- 보완이 시급한 취약 과목: ${payload.weakSubjects.join(", ") || "전과목 균형"}
- 강점 과목: ${payload.strongSubjects.join(", ") || "기본기 유지"}
- 주간 가용 순공 시간: 약 ${payload.weeklyAvailableHours}시간

응답은 반드시 아래 JSON 스키마를 준수하여 유효한 JSON 문자열로만 응답해주세요.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strategySummary: {
            type: Type.STRING,
            description: "이번 4주 학습 계획의 핵심 전략 요약 한 문장",
          },
          weeklyFourWeekPlan: {
            type: Type.ARRAY,
            description: "D-4주부터 D-1주까지 4주차별 테마 및 체크리스트",
            items: {
              type: Type.OBJECT,
              properties: {
                week: { type: Type.INTEGER, description: "1, 2, 3, 4" },
                theme: {
                  type: Type.STRING,
                  description: "예: D-4주 교과서 기본 개념 완벽 정복",
                },
                focus: {
                  type: Type.STRING,
                  description: "이번 주 핵심 목표",
                },
                tasks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "이번 주 완료해야 할 필수 실천 과제 3~5개",
                },
              },
              required: ["week", "theme", "focus", "tasks"],
            },
          },
          timetable: {
            type: Type.ARRAY,
            description: "월요일부터 일요일까지의 주간 공부 시간표 블록",
            items: {
              type: Type.OBJECT,
              properties: {
                day: {
                  type: Type.STRING,
                  description: "월요일, 화요일, 수요일, 목요일, 금요일, 토요일, 일요일",
                },
                allocatedHours: { type: Type.NUMBER },
                blocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      timeSlot: {
                        type: Type.STRING,
                        description: "예: 17:00 ~ 18:30",
                      },
                      subject: { type: Type.STRING },
                      content: {
                        type: Type.STRING,
                        description: "학습 내용 및 분량",
                      },
                      type: {
                        type: Type.STRING,
                        description: "개념이해 / 문제풀이 / 오답정리 / 암기복습",
                      },
                    },
                    required: ["timeSlot", "subject", "content", "type"],
                  },
                },
              },
              required: ["day", "allocatedHours", "blocks"],
            },
          },
          counselorTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "중학생을 위한 집중력 유지 및 계획 실천 꿀팁 3가지",
          },
        },
        required: [
          "strategySummary",
          "weeklyFourWeekPlan",
          "timetable",
          "counselorTips",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateHabitDiagnosis(responses: {
  answers: { questionId: number; question: string; score: number; category: string }[];
  studentName: string;
}) {
  const prompt = `
중학생(${responses.studentName})의 12개 문항 학습 습관 진단 설문 결과를 분석해주세요.
각 문항은 1(전혀 아니다)부터 5(매우 그렇다)점까지의 5점 척도입니다.

[설문 응답 내역]
${responses.answers
  .map(
    (a) =>
      `[${a.category}] ${a.question} -> ${a.score}점`
  )
  .join("\n")}

이 학생의 종합적인 학습 습관 유형(예: "성실한 개념 완성형", "벼락치기 행동파", "계획 집중형이지만 실천 미흡", "잠재력 가득 미완성형", "자기주도 우수형" 등 창의적이고 친근한 명칭), 장점 습관, 취약 습관, 그리고 오늘부터 교정할 수 있는 구체적인 3대 행동 처방을 JSON으로 반환해주세요.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personaName: {
            type: Type.STRING,
            description: "학생의 학습 스타일 별명 및 유형 이름",
          },
          summary: {
            type: Type.STRING,
            description: "학습 습관 종합 진단 소견 (3~4문장)",
          },
          scoresByCategory: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: "계획력, 집중력/환경, 개념/복습, 시험대비",
                },
                score: { type: Type.NUMBER, description: "백분율 또는 합산점수" },
                maxScore: { type: Type.NUMBER },
                evaluation: { type: Type.STRING },
              },
              required: ["category", "score", "maxScore", "evaluation"],
            },
          },
          strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "현재 잘하고 있는 우수 습관 2~3가지",
          },
          vulnerabilities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "개선이 필요한 취약 습관 2~3가지",
          },
          actionPrescriptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                howTo: { type: Type.STRING },
                expectedEffect: { type: Type.STRING },
              },
              required: ["title", "howTo", "expectedEffect"],
            },
          },
        },
        required: [
          "personaName",
          "summary",
          "scoresByCategory",
          "strengths",
          "vulnerabilities",
          "actionPrescriptions",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
