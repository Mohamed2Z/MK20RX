/**
 * script.js
 * Client logic for index.html, exam.html, result.html, dashboard.html
 *
 * This version collects: student name, university, and email on the start page,
 * runs the exam (one question at a time, shuffles questions/options, global timer),
 * and on finish submits the result to a Google Form (via hidden form -> formResponse)
 * so responses appear in the linked Google Sheet.
 *
 * CONFIGURATION:
 * - Replace FORM_ACTION with your Google Form formResponse endpoint:
 *     https://docs.google.com/forms/d/e/FORM_ID/formResponse
 * - Replace ENTRY_* constants with the entry keys from your form (from "Get pre-filled link")
 * - Optionally set PUBLISHED_SHEET_CSV_URL to the published CSV URL for dashboard.
 *
 * NOTE:
 * - If you don't want to use Google Form, you can change submitToGoogleForm() to POST to your server.
 */

/* ================== CONFIG ================== */

// Google Form formResponse endpoint (replace FORM_ID)
const FORM_ACTION = "https://docs.google.com/forms/d/e/FORM_ID/formResponse"; // <-- replace

// Google Form entry keys (replace each with real entry.x from your form)
const ENTRY_NAME = "entry.NAME_ENTRY_KEY";         // student's full name
const ENTRY_UNIVERSITY = "entry.UNI_ENTRY_KEY";   // university name
const ENTRY_EMAIL = "entry.EMAIL_ENTRY_KEY";      // student's email
const ENTRY_SCORE = "entry.SCORE_ENTRY_KEY";      // score
const ENTRY_EXAM = "entry.EXAM_ENTRY_KEY";        // optional: exam id/name
const ENTRY_TIME = "entry.TIME_ENTRY_KEY";        // optional: time taken (seconds)

// Published CSV (Responses sheet -> File -> Publish to web -> CSV)
const PUBLISHED_SHEET_CSV_URL = ""; // optional

/* ================== Exams list ================== */
const EXAMS = [
  { id: "exam1", title: "Exam 1 - Comprehensive (30 Q)", file: "exam1.json" },
  { id: "exam2", title: "Exam 2 - Comprehensive (30 Q)", file: "exam2.json" },
  { id: "exam3", title: "Exam 3 - Comprehensive (30 Q)", file: "exam3.json" },
  { id: "exam4", title: "Exam 4 - Comprehensive (30 Q)", file: "exam4.json" },
  { id: "exam5", title: "Exam 5 - Short (15 Q)", file: "exam5.json" },
  { id: "exam6", title: "Exam 6 - Short (15 Q)", file: "exam6.json" },
  { id: "exam7", title: "Exam 7 - Short (15 Q)", file: "exam7.json" },
  { id: "exam8", title: "Exam 8 - Short (15 Q)", file: "exam8.json" }
];

/* ================== Utilities ================== */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function formatTime(s) { const mm = String(Math.floor(s/60)).padStart(2,"0"); const ss = String(s%60).padStart(2,"0"); return `${mm}:${ss}`; }
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ================== Index page (start) ================== */
/* index.html must have:
   - input#name
   - input#university
   - input#email
   - select#examSelect
   - form#startForm
*/
function initIndexPage() {
  const select = $("#examSelect");
  EXAMS.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.file;
    opt.textContent = e.title;
    select.appendChild(opt);
  });

  const form = $("#startForm");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = ($("#name").value || "").trim();
    const university = ($("#university").value || "").trim();
    const email = ($("#email").value || "").trim();
    const file = $("#examSelect").value;

    if (!name) { alert("المرجوا إدخال الاسم"); return; }
    if (!university) { alert("المرجوا إدخال اسم الجامعة"); return; }
    if (!email) { alert("المرجوا إدخال الإيميل"); return; }
    // simple email check
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) { if (!confirm("البريد الإلكتروني يبدو غير صحيح. المتابعة؟")) return; }

    if (!file) { alert("اختر الامتحان"); return; }

    sessionStorage.setItem("candidateName", name);
    sessionStorage.setItem("candidateUniversity", university);
    sessionStorage.setItem("candidateEmail", email);
    sessionStorage.setItem("examFile", file);
    sessionStorage.removeItem("examState");
    // go to exam page
    window.location.href = "exam.html";
  });
}

/* ================== Exam page ================== */
/* exam.html must have:
   - #examTitle, #candidateName, #timer
   - #qIndex, #questionText, #options
   - #prevBtn, #nextBtn, #finishBtn
   - #progressGrid
*/
function initExamPage() {
  const candidateName = sessionStorage.getItem("candidateName") || "Anonymous";
  const examFile = sessionStorage.getItem("examFile");
  if (!examFile) { alert("لم يتم اختيار امتحان"); window.location.href = "index.html"; return; }
  $("#candidateName").textContent = candidateName;
  const meta = EXAMS.find(x => x.file === examFile);
  if (meta) $("#examTitle").textContent = meta.title;

  fetch(examFile).then(r => {
    if (!r.ok) throw new Error("فشل تحميل ملف الامتحان");
    return r.json();
  }).then(json => {
    const totalTime = Number(json.totalTime || (json.questions && json.questions.length === 15 ? 300 : 600));
    runExam(json, totalTime);
  }).catch(err => {
    console.error(err);
    alert("خطأ في تحميل الامتحان. افتح console للمزيد.");
  });
}

function normalizeQuestion(q) {
  const id = q.id ?? null;
  const text = q.q ?? q.question ?? q.questionText ?? "";
  let options = [];
  if (Array.isArray(q.options)) options = q.options.slice();
  else if (q.options && typeof q.options === "object") options = Object.values(q.options);
  const correct = (typeof q.correct === "number") ? q.correct : (typeof q.correct_answer === "number" ? q.correct_answer : null);
  return { id, text, options, correct };
}

function runExam(examJson, totalTime) {
  let questions = examJson.questions.map(normalizeQuestion);
  questions = shuffleArray(questions);
  questions = questions.map(q => {
    const opts = q.options.map((txt, idx) => ({ text: txt, isCorrect: idx === q.correct }));
    shuffleArray(opts);
    return { id: q.id, text: q.text, options: opts };
  });

  const saved = sessionStorage.getItem("examState");
  const state = saved ? JSON.parse(saved) : {
    questions,
    answers: Array(questions.length).fill(null),
    current: 0,
    totalTime,
    timeLeft: totalTime,
    timerRunning: false,
    startedAt: Date.now(),
    candidateName: sessionStorage.getItem("candidateName") || "Anonymous",
    candidateUniversity: sessionStorage.getItem("candidateUniversity") || "",
    candidateEmail: sessionStorage.getItem("candidateEmail") || "",
    examFile: sessionStorage.getItem("examFile")
  };

  const qIndexEl = $("#qIndex"), qTextEl = $("#questionText"), optionsEl = $("#options"),
        progressGrid = $("#progressGrid"), prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn"),
        finishBtn = $("#finishBtn"), timerEl = $("#timer");

  // build progress grid
  progressGrid.innerHTML = "";
  state.questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "progress-item";
    d.textContent = i + 1;
    d.dataset.index = i;
    d.addEventListener("click", () => showQuestion(i));
    progressGrid.appendChild(d);
  });

  function persist() {
    sessionStorage.setItem("examState", JSON.stringify(state));
  }

  function renderQuestion() {
    const q = state.questions[state.current];
    qIndexEl.textContent = `Question ${state.current + 1} / ${state.questions.length}`;
    qTextEl.textContent = q.text;
    optionsEl.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "option";
      input.value = idx;
      if (state.answers[state.current] === idx) input.checked = true;
      input.addEventListener("change", () => saveAnswer(idx));
      const span = document.createElement("span");
      span.textContent = opt.text;
      label.appendChild(input);
      label.appendChild(span);
      label.addEventListener("click", () => { input.checked = true; saveAnswer(idx); });
      optionsEl.appendChild(label);
    });

    prevBtn.disabled = state.current === 0;
    nextBtn.disabled = state.current >= state.questions.length - 1;

    $all(".progress-item").forEach(el => {
      const i = Number(el.dataset.index);
      el.classList.toggle("answered", state.answers[i] !== null && state.answers[i] !== undefined);
      el.classList.toggle("active", i === state.current);
    });

    persist();
  }

  function showQuestion(i) { state.current = i; renderQuestion(); }
  function saveAnswer(idx) { state.answers[state.current] = idx; const el = document.querySelector(`.progress-item[data-index="${state.current}"]`); if (el) el.classList.add("answered"); persist(); }

  prevBtn.addEventListener("click", () => { if (state.current > 0) showQuestion(state.current - 1); });
  nextBtn.addEventListener("click", () => { if (state.current < state.questions.length - 1) showQuestion(state.current + 1); });
  finishBtn.addEventListener("click", () => { if (confirm("هل أنت متأكد من إنهاء وتسليم الامتحان؟")) submitExam(false); });

  // timer
  let timerInterval = null;
  function updateTimerUI() { timerEl.textContent = formatTime(state.timeLeft); }
  function startTimer() {
    if (timerInterval) return;
    updateTimerUI();
    timerInterval = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateTimerUI();
        clearInterval(timerInterval);
        timerInterval = null;
        submitExam(true);
      } else {
        updateTimerUI();
      }
      persist();
    }, 1000);
  }

  function calculateScore() {
    let score = 0;
    state.questions.forEach((q, idx) => {
      const sel = state.answers[idx];
      if (sel == null) return;
      if (q.options[sel] && q.options[sel].isCorrect) score++;
    });
    return score;
  }

  function submitExam(timeExpired = false) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const score = calculateScore();
    const total = state.questions.length;
    const timeTaken = state.totalTime - state.timeLeft;
    const result = {
      name: state.candidateName,
      university: state.candidateUniversity,
      email: state.candidateEmail,
      examId: state.examFile.replace(".json", ""),
      score,
      total,
      time: timeTaken,
      date: new Date().toISOString(),
      timeExpired: !!timeExpired
    };

    // store locally for result page
    sessionStorage.setItem("lastResult", JSON.stringify(result));

    // Submit to Google Form (hidden form)
    submitToGoogleForm(result);

    // Redirect to result page after short delay to allow form post
    setTimeout(() => { window.location.href = "result.html"; }, 700);
  }

  renderQuestion();
  if (!state.timerRunning) {
    state.timerRunning = true;
    state.startedAt = Date.now();
  }
  startTimer();
}

/* ================== Google Form submit helper ================== */
/* Creates a hidden form and posts to FORM_ACTION inside a hidden iframe */
function submitToGoogleForm(result) {
  // Validate config
  if (!FORM_ACTION || FORM_ACTION.includes("FORM_ID")) {
    console.warn("FORM_ACTION not configured. Skipping Google Form submission.");
    return;
  }
  if (!ENTRY_NAME || !ENTRY_UNIVERSITY || !ENTRY_EMAIL || !ENTRY_SCORE) {
    console.warn("One or more ENTRY_* keys not configured. Skipping Google Form submission.");
    return;
  }

  const iframeName = "hidden-form-iframe";
  let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  const form = document.createElement("form");
  form.action = FORM_ACTION;
  form.method = "POST";
  form.target = iframeName;

  function addInput(name, value) {
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = name;
    inp.value = value ?? "";
    form.appendChild(inp);
  }

  // Required fields (as requested)
  addInput(ENTRY_NAME, result.name || "");
  addInput(ENTRY_UNIVERSITY, result.university || "");
  addInput(ENTRY_EMAIL, result.email || "");
  addInput(ENTRY_SCORE, String(result.score ?? ""));

  // Optional extras if configured in form
  if (ENTRY_EXAM) addInput(ENTRY_EXAM, result.examId || "");
  if (ENTRY_TIME) addInput(ENTRY_TIME, String(result.time ?? ""));

  document.body.appendChild(form);
  try { form.submit(); } catch (err) { console.warn("Form submit error:", err); }
  setTimeout(() => { try { form.remove(); } catch (e) {} }, 1200);
}

/* ================== Result page ================== */
function initResultPage() {
  const raw = sessionStorage.getItem("lastResult");
  const summaryEl = $("#resultSummary");
  const detailedEl = $("#detailed");
  if (!raw) {
    if (summaryEl) summaryEl.textContent = "لا توجد نتيجة محفوظة.";
    return;
  }
  const r = JSON.parse(raw);
  if (summaryEl) summaryEl.textContent = `${r.name} — ${r.examId}: ${r.score} / ${r.total} — ${r.time}s`;
  if (detailedEl) {
    detailedEl.innerHTML = `
      <p>الاسم: <strong>${r.name}</strong></p>
      <p>الجامعة: <strong>${r.university || "-"}</strong></p>
      <p>البريد: <strong>${r.email || "-"}</strong></p>
      <p>الامتحان: <strong>${r.examId}</strong></p>
      <p>النتيجة: <strong>${r.score}</strong> من ${r.total}</p>
      <p>الزمن: <strong>${r.time}</strong> ثانية</p>
      <p>تم الإرسال: <strong>${new Date(r.date).toLocaleString()}</strong></p>
    `;
  }
}

/* ================== Dashboard (CSV) ================== */
function parseCSV(text) {
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cur.push(field); field = ""; }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === '\r') continue;
      else field += ch;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

async function initDashboardPage() {
  const rawRowsEl = $("#rawRows"), statsGrid = $("#statsGrid"), refreshBtn = $("#refreshBtn");
  if (!PUBLISHED_SHEET_CSV_URL) {
    statsGrid.innerHTML = `<div class="card">لم تقم بتعيين PUBLISHED_SHEET_CSV_URL في script.js</div>`;
    return;
  }

  async function fetchCSVRows() {
    try {
      const resp = await fetch(PUBLISHED_SHEET_CSV_URL);
      if (!resp.ok) throw new Error("Network response not ok");
      const txt = await resp.text();
      const rows = parseCSV(txt);
      if (rows.length <= 1) return [];
      const headers = rows[0].map(h => h.trim());
      const data = rows.slice(1).map(r => {
        const obj = {};
        headers.forEach((h,i) => obj[h] = r[i] ?? "");
        return obj;
      });
      return data;
    } catch (err) {
      console.error(err);
      alert("فشل تحميل CSV من الشيت المنشور. تأكد من نشر الشيت كـ CSV.");
      return [];
    }
  }

  function computeStats(rows) {
    const map = {};
    rows.forEach(r => {
      const exam = r.ExamID ?? r.examId ?? r['ExamID'] ?? r['examId'] ?? r['exam'] ?? "unknown";
      const score = Number(r.Score ?? r.score ?? r['Score'] ?? 0) || 0;
      const time = Number(r.TimeTaken ?? r.time ?? r['TimeTaken'] ?? 0) || 0;
      const total = Number(r.TotalQuestions ?? r.total ?? r['TotalQuestions'] ?? 0) || null;
      if (!map[exam]) map[exam] = { count:0, best:0, sumScore:0, sumTime:0, totalQuestions: total || null };
      const m = map[exam];
      m.count += 1; m.sumScore += score; m.sumTime += time; if (score > m.best) m.best = score;
    });
    return map;
  }

  async function render() {
    const rows = await fetchCSVRows();
    if (rawRowsEl) rawRowsEl.textContent = JSON.stringify(rows.slice(-200), null, 2);
    const map = computeStats(rows);
    statsGrid.innerHTML = "";
    EXAMS.forEach(e => {
      const m = map[e.id] || { count:0, best:0, sumScore:0, sumTime:0, totalQuestions: null };
      const avgScore = m.count ? (m.sumScore/m.count).toFixed(2) : "N/A";
      const avgTime = m.count ? Math.round(m.sumTime/m.count) + "s" : "N/A";
      const totalQ = m.totalQuestions || (e.title.includes("30") ? 30 : 15);
      const card = document.createElement("div");
      card.className = "stat card";
      card.innerHTML = `
        <h3>${e.title}</h3>
        <p>Exam ID: <strong>${e.id}</strong></p>
        <p>Participants: <strong>${m.count}</strong></p>
        <p>Highest score: <strong>${m.best}</strong> / ${totalQ}</p>
        <p>Average score: <strong>${avgScore}</strong> / ${totalQ}</p>
        <p>Average time: <strong>${avgTime}</strong></p>
      `;
      statsGrid.appendChild(card);
    });
  }

  refreshBtn.addEventListener("click", render);
  render();
}

/* ================== Bootstrap ================== */
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;
  if (pageId === "page-index") initIndexPage();
  else if (pageId === "page-exam") initExamPage();
  else if (pageId === "page-result") initResultPage();
  else if (pageId === "page-dashboard") initDashboardPage();
});
