import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import path from "path";

const SEMESTER_X_RANGES = [
  { id: "1-2", minX: 175, maxX: 245 },
  { id: "2-1", minX: 250, maxX: 325 },
  { id: "2-2", minX: 330, maxX: 400 },
  { id: "3-1", minX: 405, maxX: 485 },
  { id: "3-2", minX: 495, maxX: 560 },
];

export async function parsePdfBuffer(dataArray: Uint8Array) {
  const doc = await (pdfjsLib as any).getDocument({ data: dataArray }).promise;
  const numPages = doc.numPages;

  const rawParsedStudents: any[] = [];
  let detectedSchoolName = "중학교";
  let detectedGradeAndClass = "3학년 2반";
  let detectedTeacher = "";
  let detectedDate = "";

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter((it: any) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it: any) => ({
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0,
        str: it.str,
      }));

    // Group by Y coordinates
    const rows: Record<number, { x: number; str: string }[]> = {};
    for (const item of items) {
      const y = Math.round(item.y);
      if (!rows[y]) rows[y] = [];
      rows[y].push({ x: Math.round(item.x), str: item.str.trim() });
    }

    const sortedY = Object.keys(rows)
      .map(Number)
      .sort((a, b) => b - a);

    let studentName = "";
    let classInfo = "";
    let gradeLevel = "중학교 3학년";
    let schoolName = "중학교";
    let teacherName = "";
    let issueDate = "";
    let schoolRank: number | undefined;
    let totalStudents = 109;
    let percentile: number | undefined;
    let classRank: number | undefined;
    const classTotalStudents = 30;

    const semestersData: Record<string, { name: string; score: number; achievement: string }[]> = {
      "1-2": [],
      "2-1": [],
      "2-2": [],
      "3-1": [],
      "3-2": [],
    };

    for (const y of sortedY) {
      const rowItems = rows[y].sort((a, b) => a.x - b.x);
      const line = rowItems.map((i) => i.str).join(" ");

      if (line.includes("중학교 :")) {
        const sm = line.match(/중학교\s*:\s*([가-힣A-Za-z0-9]+)/);
        if (sm) schoolName = sm[1];
      }

      if (line.includes("출력일자:")) {
        const dm = line.match(/출력일자:\s*([0-9년월일\s]+)/);
        if (dm) issueDate = dm[1].trim();
      }

      if (line.includes("이름 :") || line.includes("이름:")) {
        const nm = line.match(/이름\s*:\s*([가-힣A-Za-z]+)/);
        if (nm) studentName = nm[1];

        const cm = line.match(/제\s*([0-9]+)학년\s*([0-9]+)반\s*([0-9]+)번/);
        if (cm) {
          classInfo = `${cm[1]}학년 ${cm[2]}반 ${cm[3]}번`;
          gradeLevel = `중학교 ${cm[1]}학년`;
          classRank = parseInt(cm[3], 10);
        }

        const tm = line.match(/담임성명\s*:\s*([가-힣A-Za-z]+)/);
        if (tm) teacherName = tm[1];
      }

      // 내신점수 values row (Y ~ 300 to 315)
      if (y >= 295 && y <= 315) {
        const nums = rowItems.map((i) => parseFloat(i.str)).filter((n) => !isNaN(n));
        if (nums.length >= 6) {
          percentile = nums[4];
          schoolRank = Math.round(nums[5]);
        }
      }

      // Max capacity row (Y ~ 320 to 335)
      if (y >= 320 && y <= 335) {
        const nums = rowItems.map((i) => parseFloat(i.str)).filter((n) => !isNaN(n));
        if (nums.length >= 5) {
          const lastNum = nums[nums.length - 1];
          if (lastNum > 10) {
            totalStudents = Math.round(lastNum);
          }
        }
      }

      // Subject rows (Y between 415 and 615)
      if (y >= 415 && y <= 615) {
        const firstItem = rowItems[0];
        const subName = firstItem.str.replace(/\s+/g, "");
        if (["과목명", "교과", "구분", "학기별점수", "교과성적"].includes(subName)) continue;

        for (const sem of SEMESTER_X_RANGES) {
          const semItems = rowItems.filter((it) => it.x >= sem.minX && it.x <= sem.maxX);
          if (semItems.length === 0) continue;

          const isZero = semItems.every((it) => it.str === "0");
          if (isZero) continue;

          let rawScore = 0;
          let ach = "B";

          for (const it of semItems) {
            if (/^[A-E]$/.test(it.str)) {
              ach = it.str;
            } else if (/^[0-9]+(?:\.[0-9]+)?$/.test(it.str)) {
              const val = parseFloat(it.str);
              if (val > 5) {
                rawScore = val;
              }
            }
          }

          if (rawScore > 0 || semItems.some((it) => /^[A-E]$/.test(it.str))) {
            semestersData[sem.id].push({
              name: subName,
              score: rawScore,
              achievement: ach,
            });
          }
        }
      }
    }

    if (pageNum === 1) {
      if (schoolName) detectedSchoolName = schoolName;
      if (classInfo) detectedGradeAndClass = classInfo.split(" ").slice(0, 2).join(" ");
      if (teacherName) detectedTeacher = teacherName;
      if (issueDate) detectedDate = issueDate;
    }

    rawParsedStudents.push({
      pageNumber: pageNum,
      name: studentName || `학생 ${pageNum}`,
      gradeLevel,
      classInfo,
      schoolRank,
      totalStudents,
      percentile,
      classRank,
      classTotalStudents,
      semesters: semestersData,
      schoolName,
      teacherName,
      issueDate,
    });
  }

  return {
    schoolName: detectedSchoolName,
    gradeAndClass: detectedGradeAndClass,
    teacherName: detectedTeacher,
    issueDate: detectedDate,
    studentsCount: rawParsedStudents.length,
    rawParsedStudents,
  };
}

export async function parseAttachedSamplePdf() {
  const filePath = path.join(process.cwd(), "public/assets/aistudio/_____77fe04a7.pdf");
  if (!fs.existsSync(filePath)) {
    throw new Error("Sample PDF not found at path: " + filePath);
  }
  const buffer = fs.readFileSync(filePath);
  return parsePdfBuffer(new Uint8Array(buffer));
}
