/* script.js — unified client logic for index.html, exam.html, result.html, dashboard.html
   This version is updated to POST/GET results from your Google Apps Script Web App.
   Make sure to keep the Apps Script URL below exactly as deployed.
*/

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwodmph00-bSHea6EBOCNen_9I0rhLrUZu7ZN3Ni_uQXgDPbsEV8h9BMJeyMymCD3H-/exec";

/* --- Exam list: filenames must exist in repo root --- */
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

/* --- Utilities --- */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function formatTime(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function shuffleArray(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --- INDEX PAGE --- */
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
    const name = $("#name").value.trim();
    const file = $("#examSelect").value;
    if (!name) { alert("Please enter your name"); return; }
    if (!file) { alert("Please select an exam"); return; }
    sessionStorage.setItem("candidateName", name);
    sessionStorage.setItem("examFile", file);
    // Reset any previous answers
    sessionStorage.removeItem("examState");
    window.location.href = "exam.html";
  });
}

/* --- EXAM PAGE --- */
function initExamPage() {
  const candidateName = sessionStorage.getItem("candidateName") || "Anonymous";
  const examFile = sessionStorage.getItem("examFile");
  if (!examFile) {
    alert("No exam selected. Returning to start.");
    window.location.href = "index.html";
    return;
  }
  $("#candidateName").textContent = candidateName;

  const examMeta = EXAMS.find(x => x.file === examFile);
  if (examMeta) $("#examTitle").textContent = `${examMeta.title}`;

  fetch(examFile).then(r => {
    if (!r.ok) throw new Error("Failed to load exam JSON");
    return r.json();
  }).then(json => {
    const totalTime = Number(json.totalTime || (json.questions && json.questions.length === 15 ? 300 : 600));
    runExam(json, totalTime);
  }).catch(err => {
    console.error(err);
    alert("Failed to load exam file. Check console for details.");
  });
}

function normalizeQuestionObj(q) {
  const id = q.id ?? q.questionId ?? null;
  const text = q.q ?? q.question ?? q.questionText ?? "";
  let options = [];
  if (Array.isArray(q.options)) options = q.options.slice();
  else if (q.options && typeof q.options === "object") options = Object.values(q.options);
  const correct = (typeof q.correct === "number") ? q.correct : (typeof q.correct_answer === "number" ? q.correct_answer : null);
  return { id, text, options, correct };
}

function runExam(examJson, totalTime) {
  // Build question objects
  let questions = examJson.questions.map(normalizeQuestionObj);

  // Shuffle questions
  questions = shuffleArray(questions);

  // Convert options to objects preserving correctness
  questions = questions.map(q => {
    const opts = q.options.map((txt, idx) => ({ text: txt, isCorrect: idx === q.correct }));
    shuffleArray(opts);
    return { id: q.id, text: q.text, options: opts };
  });

  // Try to recover saved state if user reloads
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
    examFile: sessionStorage.getItem("examFile")
  };

  // UI references
  const qIndexEl = $("#qIndex");
  const qTextEl = $("#questionText");
  const optionsEl = $("#options");
  const progressGrid = $("#progressGrid");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");
  const finishBtn = $("#finishBtn");
  const timerEl = $("#timer");

  // Render progress grid
  progressGrid.innerHTML = "";
  state.questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "progress-item";
    d.textContent = i + 1;
    d.dataset.index = i;
    d.addEventListener("click", () => showQuestion(i));
    progressGrid.appendChild(d);
  });

  function persistState() {
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
      // clicking label also selects
      label.addEventListener("click", () => {
        input.checked = true;
        saveAnswer(idx);
      });
      optionsEl.appendChild(label);
    });

    prevBtn.disabled = state.current === 0;
    nextBtn.disabled = state.current >= state.questions.length - 1;

    // update progress highlight
    $all(".progress-item").forEach(el => {
      const i = Number(el.dataset.index);
      el.classList.toggle("answered", state.answers[i] !== null && state.answers[i] !== undefined);
      el.classList.toggle("active", i === state.current);
    });

    persistState();
  }

  function showQuestion(i) {
    state.current = i;
    renderQuestion();
  }

  function saveAnswer(selectedIdx) {
    state.answers[state.current] = selectedIdx;
    const el = document.querySelector(`.progress-item[data-index="${state.current}"]`);
    if (el) el.classList.add("answered");
    persistState();
  }

  prevBtn.addEventListener("click", () => {
    if (state.current > 0) showQuestion(state.current - 1);
  });
  nextBtn.addEventListener("click", () => {
    if (state.current < state.questions.length - 1) showQuestion(state.current + 1);
  });
  finishBtn.addEventListener("click", () => {
    if (confirm("Finish and submit your exam?")) submitExam(false);
  });

  // Timer
  let timerInterval = null;
  function updateTimerUI() {
    timerEl.textContent = formatTime(state.timeLeft);
  }
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
      persistState();
    }, 1000);
  }

  // Score calculation
  function calculateScore() {
    let score = 0;
    state.questions.forEach((q, idx) => {
      const sel = state.answers[idx];
      if (sel == null) return;
      if (q.options[sel] && q.options[sel].isCorrect) score++;
    });
    return score;
  }

  // Submit logic: save locally and POST to Apps Script
  function submitExam(timeExpired = false) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const score = calculateScore();
    const total = state.questions.length;
    const timeTaken = state.totalTime - state.timeLeft;
    const result = {
      name: state.candidateName,
      examId: state.examFile.replace(".json", ""),
      score,
      total,
      time: timeTaken,
      date: new Date().toISOString(),
      timeExpired: !!timeExpired
    };
    sessionStorage.setItem("lastResult", JSON.stringify(result));

    // POST to Apps Script
    if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes("REPLACE_WITH")) {
      console.warn("GOOGLE_APPS_SCRIPT_URL not configured. Result stored locally only.");
      window.location.href = "result.html";
      return;
    }

    fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: result.name,
        examId: result.examId,
        score: result.score,
        total: result.total,
        time: result.time,
        date: result.date
      })
    }).then(resp => {
      // best-effort: do not block user on network failures
      return resp.json().catch(() => ({ status: "unknown" }));
    }).then(data => {
      // optional: check data.status === 'success'
      // redirect to result page regardless
      window.location.href = "result.html";
    }).catch(err => {
      console.warn("Send to Apps Script failed:", err);
      // still redirect
      window.location.href = "result.html";
    });
  }

  // Initial render & start timer
  renderQuestion();
  if (!state.timerRunning) {
    state.timerRunning = true;
    state.startedAt = Date.now();
  }
  startTimer();
}

/* --- RESULT PAGE --- */
function initResultPage() {
  const raw = sessionStorage.getItem("lastResult");
  const summaryEl = $("#resultSummary");
  const detailedEl = $("#detailed");
  if (!raw) {
    if (summaryEl) summaryEl.textContent = "No result found. Please take an exam first.";
    return;
  }
  const res = JSON.parse(raw);
  if (summaryEl) summaryEl.textContent = `${res.name} — ${res.examId}: ${res.score} / ${res.total} (${Math.round((res.score/res.total)*100)}%) — Time taken: ${res.time}s`;
  if (detailedEl) {
    detailedEl.innerHTML = `
      <p>Exam ID: <strong>${res.examId}</strong></p>
      <p>Score: <strong>${res.score}</strong> of ${res.total}</p>
      <p>Time taken: <strong>${res.time}</strong> seconds</p>
      <p>Submitted: <strong>${new Date(res.date).toLocaleString()}</strong></p>
      ${res.timeExpired ? "<p style='color:#b91c1c'><strong>Submitted due to time expiry</strong></p>" : ""}
    `;
  }
}

/* --- DASHBOARD PAGE --- */
async function initDashboardPage() {
  const rawRowsEl = $("#rawRows");
  const statsGrid = $("#statsGrid");
  const refreshBtn = $("#refreshBtn");

  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL.includes("REPLACE_WITH")) {
    alert("Google Apps Script URL not configured in script.js.");
    return;
  }

  async function fetchRecent(hours = 24) {
    try {
      const url = `${GOOGLE_APPS_SCRIPT_URL}?action=getRecent&hours=${encodeURIComponent(hours)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response not ok");
      const json = await res.json();
      if (!json || json.status !== "ok") {
        console.warn("Apps Script returned:", json);
        return [];
      }
      return json.rows || [];
    } catch (err) {
      console.error("Failed to fetch recent rows:", err);
      alert("Failed to fetch dashboard data. Check Apps Script deployment and console.");
      return [];
    }
  }

  function computeStats(rows) {
    // rows are objects with keys: Name, ExamID, Score, TotalQuestions, TimeTaken, Date (depends on sheet headers)
    const map = {};
    rows.forEach(r => {
      // Normalize keys (case-insensitive)
      const exam = r.ExamID || r.examId || r['examId'] || r['ExamID'] || r['exam'] || "unknown";
      const score = Number(r.Score ?? r.score ?? r['Score'] ?? r['score']) || 0;
      const total = Number(r.TotalQuestions ?? r.total ?? r['TotalQuestions'] ?? r['total']) || null;
      const time = Number(r.TimeTaken ?? r.time ?? r['TimeTaken'] ?? r['time']) || 0;
      if (!map[exam]) map[exam] = { count:0, best:0, sumScore:0, sumTime:0, totalQuestions: total || null };
      const m = map[exam];
      m.count += 1;
      m.sumScore += score;
      m.sumTime += time;
      if (score > m.best) m.best = score;
    });
    return map;
  }

  async function render() {
    const rows = await fetchRecent(24);
    if (rawRowsEl) rawRowsEl.textContent = JSON.stringify(rows.slice(-200), null, 2);
    const map = computeStats(rows);
    statsGrid.innerHTML = "";
    EXAMS.forEach(e => {
      const m = map[e.id] || { count:0, best:0, sumScore:0, sumTime:0, totalQuestions: null };
      const avgScore = m.count ? (m.sumScore / m.count).toFixed(2) : "N/A";
      const avgTime = m.count ? Math.round(m.sumTime / m.count) + "s" : "N/A";
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

/* --- Page bootstrap --- */
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;
  if (pageId === "page-index") initIndexPage();
  else if (pageId === "page-exam") initExamPage();
  else if (pageId === "page-result") initResultPage();
  else if (pageId === "page-dashboard") initDashboardPage();
});
