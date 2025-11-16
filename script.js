/**
 * script.js
 * Full client logic for index.html, exam.html, result.html, dashboard.html
 *
 * This variant submits results to a Google Form (formResponse endpoint).
 * The Google Form should contain fields for:
 *   - Student name
 *   - University
 *   - Email
 *   - Score
 *
 * You MUST replace the FORM_ACTION and ENTRY_* constants below with the values
 * from your Google Form (see instructions in comments).
 *
 * Behavior summary:
 *  - User enters name and selects exam on index.html
 *  - Exam runs on exam.html (one question at a time, shuffled, timer)
 *  - On finish the script builds a result object and submits it to the Google Form
 *    via a hidden form posted into a hidden iframe (user stays on your site)
 *  - result.html shows the candidate's score from sessionStorage
 *  - dashboard.html (optional) reads a CSV published from the responses sheet
 *
 * NOTE:
 *  - If your Google Form only has the four fields you requested (name, university, email, score)
 *    you must set ENTRY_NAME, ENTRY_UNIVERSITY, ENTRY_EMAIL, ENTRY_SCORE accordingly.
 *  - If you also want to record examId and timeTaken, add those fields to the Google Form,
 *    get their entry keys and set ENTRY_EXAM and ENTRY_TIME below; otherwise leave them null.
 */

/* ============ CONFIG ============ */
/* Replace FORM_ACTION with your formResponse endpoint:
   Example formResponse endpoint:
   https://docs.google.com/forms/d/e/1FAIpQLScXXXXX/formResponse
   (FORM_ID is the part between /d/e/ and /formResponse or /viewform)
*/
const FORM_ACTION = "https://docs.google.com/forms/d/e/FORM_ID/formResponse"; // <-- change

/* Replace the ENTRY_* values with the entry keys obtained from your "Get pre-filled link".
   Example entry key: entry.1234567890123456789
   - ENTRY_NAME: input for student name
   - ENTRY_UNIVERSITY: input for university
   - ENTRY_EMAIL: input for email
   - ENTRY_SCORE: input for score
   Optional:
   - ENTRY_EXAM: input for exam id (if you add it to the form)
   - ENTRY_TIME: input for time taken in seconds (if you add it to the form)
*/
const ENTRY_NAME = "entry.NAME_ENTRY_KEY";         // <-- change
const ENTRY_UNIVERSITY = "entry.UNI_ENTRY_KEY";   // <-- change
const ENTRY_EMAIL = "entry.EMAIL_ENTRY_KEY";       // <-- change
const ENTRY_SCORE = "entry.SCORE_ENTRY_KEY";       // <-- change
const ENTRY_EXAM = null;   // e.g. "entry.XXXX" or null if not present in the form
const ENTRY_TIME = null;   // e.g. "entry.YYYY" or null if not present

// Optional: published CSV URL for dashboard (Responses sheet -> File -> Publish to web -> CSV)
const PUBLISHED_SHEET_CSV_URL = ""; // leave empty if you don't use published CSV

/* ============ Exam list ============ */
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

/* ============ Utilities ============ */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function formatTime(s) { const mm = String(Math.floor(s/60)).padStart(2,"0"); const ss = String(s%60).padStart(2,"0"); return `${mm}:${ss}`; }
function shuffleArray(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// Simple CSV parser (handles quoted fields)
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

/* ============ Index page ============ */
function initIndexPage() {
  const select = $("#examSelect");
  EXAMS.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.file;
    opt.textContent = e.title;
    select.appendChild(opt);
  });

  $("#startForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("#name").value.trim();
    const file = $("#examSelect").value;
    if (!name) { alert("المرجوا إدخال الاسم"); return; }
    if (!file) { alert("اختر الامتحان"); return; }
    sessionStorage.setItem("candidateName", name);
    sessionStorage.setItem("examFile", file);
    sessionStorage.removeItem("examState");
    window.location.href = "exam.html";
  });
}

/* ============ Exam page ============ */
function initExamPage() {
  const candidateName = sessionStorage.getItem("candidateName") || "Anonymous";
  const examFile = sessionStorage.getItem("examFile");
  if (!examFile) { alert("لم يتم اختيار امتحان"); location.href = "index.html"; return; }
  $("#candidateName").textContent = candidateName;
  const meta = EXAMS.find(x => x.file===examFile);
  if (meta) $("#examTitle").textContent = meta.title;

  fetch(examFile).then(r => { if(!r.ok) throw new Error("فشل تحميل JSON"); return r.json(); })
    .then(json => {
      const totalTime = Number(json.totalTime || (json.questions && json.questions.length===15 ? 300 : 600));
      runExam(json, totalTime);
    }).catch(err => { console.error(err); alert("خطأ في تحميل الامتحان"); });
}

function normalizeQuestion(q){
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
    const opts = q.options.map((t,i)=>({ text: t, isCorrect: i===q.correct }));
    shuffleArray(opts);
    return { id: q.id, text: q.text, options: opts };
  });

  const saved = sessionStorage.getItem("examState");
  const state = saved ? JSON.parse(saved) : {
    questions, answers: Array(questions.length).fill(null),
    current:0, totalTime, timeLeft: totalTime, timerRunning:false,
    startedAt: Date.now(), candidateName: sessionStorage.getItem("candidateName")||"Anonymous",
    examFile: sessionStorage.getItem("examFile")
  };

  const qIndexEl = $("#qIndex"), qTextEl = $("#questionText"), optionsEl = $("#options"),
        progressGrid = $("#progressGrid"), prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn"),
        finishBtn = $("#finishBtn"), timerEl = $("#timer");

  progressGrid.innerHTML = "";
  state.questions.forEach((_,i)=>{
    const d=document.createElement("div"); d.className="progress-item"; d.textContent = i+1; d.dataset.index = i;
    d.addEventListener("click", ()=>showQuestion(i));
    progressGrid.appendChild(d);
  });

  function persist(){ sessionStorage.setItem("examState", JSON.stringify(state)); }

  function renderQuestion(){
    const q = state.questions[state.current];
    qIndexEl.textContent = `Question ${state.current+1} / ${state.questions.length}`;
    qTextEl.textContent = q.text;
    optionsEl.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const label = document.createElement("label"); label.className="option";
      const input = document.createElement("input"); input.type="radio"; input.name="option"; input.value=idx;
      if (state.answers[state.current] === idx) input.checked = true;
      input.addEventListener("change", ()=> saveAnswer(idx));
      const span = document.createElement("span"); span.textContent = opt.text;
      label.appendChild(input); label.appendChild(span);
      label.addEventListener("click", ()=>{ input.checked = true; saveAnswer(idx); });
      optionsEl.appendChild(label);
    });
    prevBtn.disabled = state.current===0;
    nextBtn.disabled = state.current>=state.questions.length-1;
    $all(".progress-item").forEach(el => {
      const i = Number(el.dataset.index);
      el.classList.toggle("answered", state.answers[i] !== null && state.answers[i] !== undefined);
      el.classList.toggle("active", i===state.current);
    });
    persist();
  }

  function showQuestion(i){ state.current = i; renderQuestion(); }
  function saveAnswer(idx){ state.answers[state.current] = idx; const el=document.querySelector(`.progress-item[data-index="${state.current}"]`); if(el) el.classList.add("answered"); persist(); }

  prevBtn.addEventListener("click", ()=>{ if(state.current>0) showQuestion(state.current-1); });
  nextBtn.addEventListener("click", ()=>{ if(state.current < state.questions.length-1) showQuestion(state.current+1); });
  finishBtn.addEventListener("click", ()=>{ if(confirm("هل أنت متأكد من إنهاء وتسليم الامتحان؟")) submitExam(false); });

  let timerInterval = null;
  function updateTimerUI(){ timerEl.textContent = formatTime(state.timeLeft); }
  function startTimer(){
    if(timerInterval) return;
    updateTimerUI();
    timerInterval = setInterval(()=>{
      state.timeLeft -= 1;
      if(state.timeLeft <= 0){ state.timeLeft = 0; updateTimerUI(); clearInterval(timerInterval); timerInterval = null; submitExam(true); }
      else updateTimerUI();
      persist();
    }, 1000);
  }

  function calculateScore(){
    let score = 0;
    state.questions.forEach((q, idx) => {
      const sel = state.answers[idx];
      if (sel == null) return;
      if (q.options[sel] && q.options[sel].isCorrect) score++;
    });
    return score;
  }

  function submitExam(timeExpired=false){
    if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
    const score = calculateScore();
    const total = state.questions.length;
    const timeTaken = state.totalTime - state.timeLeft;
    const result = {
      name: state.candidateName,
      university: (state.candidateUniversity || ""), // filled from index page if you add that field
      email: (state.candidateEmail || ""),
      examId: state.examFile.replace(".json",""),
      score, total, time: timeTaken,
      date: new Date().toISOString(),
      timeExpired: !!timeExpired
    };

    // store locally for result page
    sessionStorage.setItem("lastResult", JSON.stringify(result));

    // submit to Google Form (hidden)
    submitToGoogleForm(result);

    // redirect to result page after small delay
    setTimeout(()=> location.href = "result.html", 800);
  }

  renderQuestion();
  if(!state.timerRunning){ state.timerRunning = true; state.startedAt = Date.now(); }
  startTimer();
}

/* ============ Google Form submission helper ============ */
/**
 * Submits result to Google Form by creating & posting a hidden form into a hidden iframe.
 * The form fields must match the Google Form entry.* keys configured at top of this file.
 *
 * If the form lacks optional fields (ENTRY_EXAM, ENTRY_TIME) they are ignored.
 */
function submitToGoogleForm(result) {
  // validation of config
  if (!FORM_ACTION || FORM_ACTION.includes("FORM_ID")) {
    console.warn("FORM_ACTION not configured. Skipping submission to Google Form.");
    return;
  }
  if (!ENTRY_NAME || !ENTRY_UNIVERSITY || !ENTRY_EMAIL || !ENTRY_SCORE) {
    console.warn("One or more ENTRY_* keys not configured. Skipping submission to Google Form.");
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

  // required fields for your desired form
  addInput(ENTRY_NAME, result.name || "");
  addInput(ENTRY_UNIVERSITY, result.university || "");
  addInput(ENTRY_EMAIL, result.email || "");
  addInput(ENTRY_SCORE, String(result.score ?? ""));

  // optional fields - only add if you set entry keys in config
  if (ENTRY_EXAM) addInput(ENTRY_EXAM, result.examId || "");
  if (ENTRY_TIME) addInput(ENTRY_TIME, String(result.time ?? ""));

  // append -> submit -> cleanup
  document.body.appendChild(form);
  try { form.submit(); } catch (err) { console.warn("Form submit error:", err); }
  setTimeout(()=> { try { form.remove(); } catch(e){} }, 1200);
}

/* ============ Result page ============ */
function initResultPage() {
  const raw = sessionStorage.getItem("lastResult");
  const summaryEl = $("#resultSummary");
  const detailedEl = $("#detailed");
  if (!raw) { if (summaryEl) summaryEl.textContent = "لا توجد نتيجة محفوظة."; return; }
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

/* ============ Dashboard (reads published CSV) ============ */
async function initDashboardPage() {
  const rawRowsEl = $("#rawRows"), statsGrid = $("#statsGrid"), refreshBtn = $("#refreshBtn");

  if (!PUBLISHED_SHEET_CSV_URL) {
    statsGrid.innerHTML = `<div class="card">لم تحدد رابط CSV المنشور من Google Sheets في المتغير PUBLISHED_SHEET_CSV_URL داخل script.js</div>`;
    return;
  }

  async function fetchCSV() {
    try {
      const res = await fetch(PUBLISHED_SHEET_CSV_URL);
      if (!res.ok) throw new Error("فشل جلب CSV");
      const txt = await res.text();
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
      alert("فشل جلب بيانات اللوحة. تأكد من نشر الشيت كـ CSV.");
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
    const rows = await fetchCSV();
    if (rawRowsEl) rawRowsEl.textContent = JSON.stringify(rows.slice(-200), null, 2);
    const map = computeStats(rows);
    statsGrid.innerHTML = "";
    EXAMS.forEach(e => {
      const m = map[e.id] || { count:0, best:0, sumScore:0, sumTime:0, totalQuestions:null };
      const avgScore = m.count ? (m.sumScore/m.count).toFixed(2) : "N/A";
      const avgTime = m.count ? Math.round(m.sumTime/m.count) + "s" : "N/A";
      const totalQ = m.totalQuestions || (e.title.includes("30") ? 30 : 15);
      const card = document.createElement("div");
      card.className = "stat card";
      card.innerHTML = `<h3>${e.title}</h3>
        <p>Exam ID: <strong>${e.id}</strong></p>
        <p>Participants: <strong>${m.count}</strong></p>
        <p>Highest score: <strong>${m.best}</strong> / ${totalQ}</p>
        <p>Average score: <strong>${avgScore}</strong> / ${totalQ}</p>
        <p>Average time: <strong>${avgTime}</strong></p>`;
      statsGrid.appendChild(card);
    });
  }

  refreshBtn.addEventListener("click", render);
  render();
}

/* ============ Bootstrap ============ */
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;
  if (pageId === "page-index") initIndexPage();
  else if (pageId === "page-exam") initExamPage();
  else if (pageId === "page-result") initResultPage();
  else if (pageId === "page-dashboard") initDashboardPage();
});
