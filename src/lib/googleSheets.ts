import { getAccessToken } from "./firebase";
import { StudentProfile } from "../types";

export interface GoogleSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export async function createCounselingSpreadsheet(
  student: StudentProfile,
  studyPlanJson?: any,
  habitResultJson?: any
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Google 계정 로그인이 필요합니다.");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const title = `[중학성취e음] ${student.name} 학생 성적상담 및 학습계획표 (${dateStr})`;

  // 1. Create Spreadsheet with sheets
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: "성적분석" } },
        { properties: { title: "학습계획표" } },
        { properties: { title: "학습습관진단" } },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || "스프레드시트 생성 실패");
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Prepare data for "성적분석"
  const gradeValues: (string | number)[][] = [
    ["[중학 성취e음] 학생 성적 분석 & 백분위 리포트"],
    ["학생 이름", student.name, "학년", student.gradeLevel, "학기", student.currentSemester],
    ["전체 평균 점수", `${student.overallAverage.toFixed(1)}점`, "추정 백분위", `상위 ${student.overallPercentile.toFixed(1)}%`, "추정 석차", `${student.totalStudents}명 중 ${student.estimatedRank}등`],
    [],
    ["과목명", "원점수", "학교평균", "표준편차", "성취도", "백분위(상위%)", "주간 학습시간(h)", "목표점수", "효율점수(점/시간)"],
  ];

  student.subjects.forEach((sub) => {
    const efficiency = sub.weeklyStudyHours > 0 ? (sub.score / sub.weeklyStudyHours).toFixed(1) : "-";
    gradeValues.push([
      sub.name,
      sub.score,
      sub.mean,
      sub.stdDev,
      sub.achievement,
      `상위 ${sub.percentile.toFixed(1)}%`,
      sub.weeklyStudyHours,
      sub.targetScore,
      efficiency,
    ]);
  });

  // Previous semester comparison if available
  if (student.previousSemester) {
    gradeValues.push([]);
    gradeValues.push(["[이전 학기 대비 성적 변화 추이]"]);
    gradeValues.push(["이전 학기명", student.previousSemester.name, "이전 평균", `${student.previousSemester.overallAverage.toFixed(1)}점`, "평균 증감", `${student.overallAverage - student.previousSemester.overallAverage >= 0 ? "+" : ""}${(student.overallAverage - student.previousSemester.overallAverage).toFixed(1)}점`]);
    gradeValues.push(["과목명", "이전 점수", "현재 점수", "점수 변동"]);
    student.previousSemester.subjects.forEach((prevSub) => {
      const curSub = student.subjects.find((s) => s.name === prevSub.name);
      const curScore = curSub ? curSub.score : "-";
      const diff = curSub ? (curSub.score - prevSub.score >= 0 ? `+${curSub.score - prevSub.score}` : `${curSub.score - prevSub.score}`) : "-";
      gradeValues.push([prevSub.name, prevSub.score, curScore, diff]);
    });
  }

  // 1, 2, 3학년 6개 학기 전체 누적 일람표
  if (student.semesters) {
    gradeValues.push([]);
    gradeValues.push(["[1·2·3학년 6개 학기 전체 성적 일람표]"]);
    gradeValues.push(["학기 구분", "전체 평균", "상위 백분위", "예상 석차", "입력 상태"]);
    const semKeys = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];
    semKeys.forEach((key) => {
      const rec = student.semesters[key];
      if (rec) {
        gradeValues.push([
          rec.semesterName,
          rec.isEntered ? `${rec.overallAverage.toFixed(1)}점` : "미입력",
          rec.isEntered ? `상위 ${rec.overallPercentile.toFixed(1)}%` : "-",
          rec.isEntered ? `${rec.estimatedRank}등` : "-",
          rec.isEntered ? "입력완료" : "미입력",
        ]);
      }
    });
  }

  // 3. Prepare data for "학습계획표"
  const planValues: (string | number)[][] = [
    ["[중학 성취e음] 4주 완성 맞춤형 시험 대비 학습 계획표"],
    ["목표 전략", studyPlanJson?.strategySummary || "취약 과목 집중 보완 및 균형 학습"],
    [],
    ["주차", "테마", "핵심 목표", "실천 과제"],
  ];

  if (studyPlanJson?.weeklyFourWeekPlan) {
    studyPlanJson.weeklyFourWeekPlan.forEach((wp: any) => {
      planValues.push([
        `D-${5 - wp.week}주차`,
        wp.theme,
        wp.focus,
        Array.isArray(wp.tasks) ? wp.tasks.join(" | ") : "",
      ]);
    });
  }

  planValues.push([]);
  planValues.push(["[주간 요일별 공부 시간표]"]);
  planValues.push(["요일", "배정 시간", "시간대", "과목", "학습 내용", "유형"]);

  if (studyPlanJson?.timetable) {
    studyPlanJson.timetable.forEach((dayItem: any) => {
      if (dayItem.blocks && dayItem.blocks.length > 0) {
        dayItem.blocks.forEach((block: any, idx: number) => {
          planValues.push([
            idx === 0 ? dayItem.day : "",
            idx === 0 ? `${dayItem.allocatedHours}시간` : "",
            block.timeSlot,
            block.subject,
            block.content,
            block.type,
          ]);
        });
      } else {
        planValues.push([dayItem.day, `${dayItem.allocatedHours}시간`, "-", "자율 복습", "자유 정리", "자율"]);
      }
    });
  }

  // 4. Prepare data for "학습습관진단"
  const habitValues: (string | number)[][] = [
    ["[중학 성취e음] 자기주도 학습 습관 진단 결과"],
    ["학습 성향 유형", habitResultJson?.personaName || "성실한 탐구형"],
    ["진단 총평", habitResultJson?.summary || "-"],
    [],
    ["진단 영역", "획득 점수", "만점", "영역별 평가"],
  ];

  if (habitResultJson?.scoresByCategory) {
    habitResultJson.scoresByCategory.forEach((cat: any) => {
      habitValues.push([cat.category, cat.score, cat.maxScore, cat.evaluation]);
    });
  }

  habitValues.push([]);
  habitValues.push(["[핵심 우수 습관]"]);
  (habitResultJson?.strengths || []).forEach((st: string) => habitValues.push(["✓", st]));

  habitValues.push([]);
  habitValues.push(["[보완 필요 습관 & 액션 플랜]"]);
  (habitResultJson?.actionPrescriptions || []).forEach((ap: any) => {
    habitValues.push([ap.title, ap.howTo, ap.expectedEffect]);
  });

  // 5. Batch update values to Google Sheets
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: "성적분석!A1",
            values: gradeValues,
          },
          {
            range: "학습계획표!A1",
            values: planValues,
          },
          {
            range: "학습습관진단!A1",
            values: habitValues,
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    console.warn("Spreadsheet data populate partial error:", await updateRes.text());
  }

  return { spreadsheetId, spreadsheetUrl };
}

export async function listUserSpreadsheets(): Promise<GoogleSpreadsheetItem[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    console.error("Failed to list sheets:", await res.text());
    return [];
  }

  const data = await res.json();
  return data.files || [];
}

export async function importStudentGradesFromSheet(
  spreadsheetId: string,
  range = "A1:Z50"
): Promise<{ rawRows: string[][] }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Google 로그인이 필요합니다.");
  }

  const encodedRange = encodeURIComponent(range);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "스프레드시트 데이터를 읽지 못했습니다.");
  }

  const data = await res.json();
  return { rawRows: data.values || [] };
}

export interface SheetTabContent {
  title: string;
  rows: (string | number)[][];
}

export async function importAllTabsFromSpreadsheet(
  spreadsheetId: string
): Promise<{ tabs: SheetTabContent[]; title: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Google 로그인이 필요합니다.");
  }

  // 1. Fetch metadata to inspect all sheet tabs
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(title,sheetId)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "스프레드시트 정보를 읽지 못했습니다.");
  }

  const metaData = await metaRes.json();
  const spreadsheetTitle = metaData.properties?.title || "스프레드시트";
  const sheetProperties = metaData.sheets || [];
  const tabTitles: string[] = sheetProperties
    .map((s: any) => s.properties?.title)
    .filter(Boolean);

  if (tabTitles.length === 0) {
    throw new Error("스프레드시트에 시트 탭이 없습니다.");
  }

  // 2. Batch get all tabs
  const rangesParam = tabTitles
    .map((t) => `ranges=${encodeURIComponent(`'${t}'!A1:Z60`)}`)
    .join("&");

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!batchRes.ok) {
    // Fallback: fetch default range
    const single = await importStudentGradesFromSheet(spreadsheetId);
    return {
      title: spreadsheetTitle,
      tabs: [{ title: tabTitles[0] || "Sheet1", rows: single.rawRows }],
    };
  }

  const batchData = await batchRes.json();
  const valueRanges = batchData.valueRanges || [];

  const tabs: SheetTabContent[] = tabTitles.map((title, idx) => {
    const vr = valueRanges[idx];
    return {
      title,
      rows: vr?.values || [],
    };
  });

  return {
    title: spreadsheetTitle,
    tabs,
  };
}
