/* script.js — single file for index, exam, result and dashboard pages.
   GOOGLE_APPS_SCRIPT_URL has been set to the Apps Script Web App URL you provided.
*/

const GOOGLE_APPS_SCRIPT_URL = "https://docs.google.com/spreadsheets/d/17oJb1gP1kXg9YmYBwsTHApfmI8ZcUvpCyYunUVSCQ7o/edit?usp=sharing";

/* List of exams available on the site.
   Each entry links to the corresponding JSON file present in repo root.
   Filenames must match those included (exam1.json ... exam8.json).
*/
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

/* UTILITIES */
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

/* INDEX PAGE: populate exam select and handle start */
function initIndexPage() {
  const select = $("#examSelect");
  EXAMS.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.file;
    opt.textContent = e.title;
    select.appendChild(opt);
  });

  const form = $("#startForm");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#name").value.trim();
    const file = $("#examSelect").value;
    if (!name) { alert("Please enter your name"); return; }
    // store candidate info in sessionStorage
    sessionStorage.setItem("candidateName", name);
    sessionStorage.setItem("examFile", file);
    window.location.href = "exam.html";
  });
}

/* EXAM PAGE LOGIC */
function initExamPage() {
  const candidateName = sessionStorage.getItem("candidateName") || "Anonymous";
  const examFile = sessionStorage.getItem("examFile");
  if (!examFile) {
    alert("No exam selected. Returning to start.");
    window.location.href = "index.html";
    return;
  }
  $("#candidateName").textContent = candidateName;

  // find exam title
  const examMeta = EXAMS.find(x => x.file === examFile);
  if (examMeta) $("#examTitle").textContent = `${examMeta.title}`;

  // load JSON
  fetch(examFile).then(r => r.json()).then(json => {
    const totalTime = json.totalTime || (json.questions.length === 15 ? 300 : 600);
    startExam(json, totalTime);
  }).catch(err => {
    console.error(err);
    alert("Failed to load exam JSON. Check the filename and that the JSON is present.");
  });
}

function startExam(examJson, totalTime) {
  // shuffle questions
  let questions = examJson.questions.map(q => {
    // normalize keys: expecting { id, q or question or questionText, options, correct }
    const id = q.id || q.questionId || q.q;
    const text = q.q || q.question || q.questionText || q.questionText;
    const options = Array.isArray(q.options) ? q.options.slice() :
                    (q.options && typeof q.options === "object") ? Object.values(q.options) : [];
    const correct = (typeof q.correct === "number") ? q.correct : q.correctAnswer || q.correct;
    return { id, text, options, correct };
  });

  questions = shuffleArray(questions);
  // convert each question options to objects { text, isCorrect }
  questions = questions.map((qq) => {
    const opts = qq.options.map((optText, idx) => ({ text: optText, isCorrect: idx === qq.correct }));
    shuffleArray(opts);
    return { id: qq.id, text: qq.text, options: opts };
  });

  // app state
  const state = {
    questions,
    answers: Array(questions.length).fill(null), // store selected option index per question (index in options array)
    current: 0,
    totalTime,
    timeLeft: totalTime,
    timerInterval: null,
    startedAt: Date.now(),
    candidateName: sessionStorage.getItem("candidateName") || "Anonymous",
    examFile: sessionStorage.getItem("examFile")
  };

  // build progress grid
  const progressGrid = $("#progressGrid");
  progressGrid.innerHTML = "";
  questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "progress-item";
    d.textContent = i + 1;
    d.dataset.index = i;
    d.addEventListener("click", () => {
      showQuestion(i);
    });
    progressGrid.appendChild(d);
  });

  // show question
  function renderQuestion() {
    const q = state.questions[state.current];
    $("#qIndex").textContent = `Question ${state.current + 1} / ${state.questions.length}`;
    $("#questionText").textContent = q.text;
    const optionsDiv = $("#options");
    optionsDiv.innerHTML = "";
    q.options.forEach((opt, idx) => {
      const b = document.createElement("label");
      b.className = "option";
      b.innerHTML = `<input type="radio" name="option" value="${idx}" ${state.answers[state.current]===idx ? "checked":""} /> <span>${opt.text}</span>`;
      b.addEventListener("click", (e) => {
        const input = b.querySelector("input");
        input.checked = true;
        saveAnswer(idx);
      });
      optionsDiv.appendChild(b);
    });

    $("#prevBtn").disabled = state.current === 0;
    $("#nextBtn").disabled = state.current >= state.questions.length - 1;

    // update progress highlight
    $all(".progress-item").forEach(el => {
      el.classList.toggle("answered", !!state.answers[Number(el.dataset.index)]);
      el.classList.toggle("active", Number(el.dataset.index) === state.current);
    });
  }

  function showQuestion(i) {
    state.current = i;
    renderQuestion();
  }

  function saveAnswer(selectedIdx) {
    state.answers[state.current] = selectedIdx;
    // mark progress
    const el = document.querySelector(`.progress-item[data-index="${state.current}"]`);
    if (el) el.classList.add("answered");
  }

  // timer
  function startTimer() {
    updateTimerUI();
    state.timerInterval = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        updateTimerUI();
        clearInterval(state.timerInterval);
        onFinish(true);
      } else {
        updateTimerUI();
      }
    }, 1000);
  }

  function updateTimerUI() {
    $("#timer").textContent = formatTime(state.timeLeft);
  }

  function calculateScore() {
    let score = 0;
    state.questions.forEach((q, idx) => {
      const selected = state.answers[idx];
      if (selected == null) return;
      if (q.options[selected] && q.options[selected].isCorrect) score++;
    });
    return score;
  }

  function onFinish(timeExpired = false) {
    // stop timer
    if (state.timerInterval) clearInterval(state.timerInterval);
    // compute
    const score = calculateScore();
    const total = state.questions.length;
    const timeTaken = state.totalTime - state.timeLeft;
    const result = {
      name: state.candidateName,
      examId: state.examFile.replace(".json", ""),
      score,
      total,
      time: timeTaken,
      date: (new Date()).toISOString(),
      timeExpired: !!timeExpired
    };
    // store locally for result page
    sessionStorage.setItem("lastResult", JSON.stringify(result));
    // send to Google Apps Script (fire & forget)
    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== "REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL") {
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
      }).catch(err => console.warn("Failed to send to Apps Script:", err));
    } else {
      console.warn("Google Apps Script URL is not configured; results will not be sent remotely.");
    }

    // redirect to result page
    window.location.href = "result.html";
  }

  // DOM wiring
  $("#prevBtn").addEventListener("click", () => { showQuestion(Math.max(0, state.current - 1)); });
  $("#nextBtn").addEventListener("click", () => {
    if (state.current < state.questions.length - 1) showQuestion(state.current + 1);
  });
  $("#finishBtn").addEventListener("click", () => {
    if (!confirm("Finish and submit your exam?")) return;
    onFinish(false);
  });

  // initially display first question & start timer
  showQuestion(0);
  startTimer();
}

/* RESULT PAGE */
function initResultPage() {
  const raw = sessionStorage.getItem("lastResult");
  if (!raw) {
    $("#resultSummary").textContent = "No result found. Please take an exam first.";
    return;
  }
  const res = JSON.parse(raw);
  $("#resultSummary").textContent = `${res.name} — ${res.examId}: ${res.score} / ${res.total} (${Math.round((res.score/res.total)*100)}%) — Time taken: ${res.time}s`;
  const detailed = $("#detailed");
  detailed.innerHTML = `
    <p>Exam ID: <strong>${res.examId}</strong></p>
    <p>Score: <strong>${res.score}</strong> of ${res.total}</p>
    <p>Time taken: <strong>${res.time}</strong> seconds</p>
    <p>Submitted: <strong>${new Date(res.date).toLocaleString()}</strong></p>
    ${res.timeExpired ? "<p style='color:#b91c1c'><strong>Submitted due to time expiry</strong></p>" : ""}
  `;
}

/* DASHBOARD PAGE */
async function initDashboardPage() {
  const rawRowsEl = $("#rawRows");
  const statsGrid = $("#statsGrid");
  const refreshBtn = $("#refreshBtn");

  async function fetchRows() {
    if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === "REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL") {
      alert("Please configure GOOGLE_APPS_SCRIPT_URL in script.js to your Apps Script web app URL.");
      return [];
    }
    try {
      const url = GOOGLE_APPS_SCRIPT_URL + "?action=getAll";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch from Apps Script");
      const json = await res.json();
      return json.rows || [];
    } catch (err) {
      console.error(err);
      alert("Failed to fetch dashboard data. Check Apps Script deployment and CORS.");
      return [];
    }
  }

  function computeStats(rows) {
    // rows are expected as objects: {Name,ExamID,Score,TotalQuestions,TimeTaken,Date}
    const map = {};
    rows.forEach(r => {
      const exam = r.ExamID || r.examId || r[1] || "unknown";
      const score = Number(r.Score ?? r.score ?? r[2]) || 0;
      const total = Number(r.TotalQuestions ?? r.total ?? r[3]) || 0;
      const time = Number(r.TimeTaken ?? r.time ?? r[4]) || 0;
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
    const rows = await fetchRows();
    rawRowsEl.textContent = JSON.stringify(rows.slice(-200), null, 2);
    const map = computeStats(rows);
    statsGrid.innerHTML = "";
    // show all EXAMS even if no data
    EXAMS.forEach(e => {
      const m = map[e.id] || { count:0, best:0, sumScore:0, sumTime:0, totalQuestions: null };
      const avgScore = m.count ? (m.sumScore / m.count).toFixed(2) : "N/A";
      const avgTime = m.count ? Math.round(m.sumTime / m.count) + "s" : "N/A";
      const totalQ = m.totalQuestions || (e.title.includes("30") ? 30 : 15);
      const card = document.createElement("div");
      card.className = "stat card";
      card.innerHTML = `<h3>${e.title}</h3>
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

/* Entry point - detect which page */
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;
  if (pageId === "page-index") initIndexPage();
  if (pageId === "page-exam") initExamPage();
  if (pageId === "page-result") initResultPage();
  if (pageId === "page-dashboard") initDashboardPage();
});
