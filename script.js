/**script.js - FIXED VERSION with better debugging */
/* ================== CONFIG ================== */
const FORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSc4vLnXpXPiYdsmpHcOoOTBi8GT71NhetKegIcaYAKEQyZrEQ/formResponse";

// Google Form entry keys - VERIFY THESE MATCH YOUR FORM
const ENTRY_NAME = "entry.1449005772";
const ENTRY_UNIVERSITY = "entry.1231911888"; 
const ENTRY_EMAIL = "entry.1685270148";
const ENTRY_SCORE = "entry.1281836784";
const ENTRY_EXAM = "entry.1906940628";
const ENTRY_TIME = "entry.1883999980";

const PUBLISHED_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPFloBt3Hd084km1RGTg4XSV10mxl2VelQm9v1HXVmxiotI9uhgoxM1OoChyI8XG0Bp8XbV2_Ayd9V/pub?gid=2020831747&single=true&output=csv";

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

/* ================== Index page ================== */
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

    if (!name) { alert("Please enter your name"); return; }
    if (!university) { alert("Please enter your university"); return; }
    if (!email) { alert("Please enter your email"); return; }
    
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) { 
      if (!confirm("Email looks invalid. Continue?")) return; 
    }

    if (!file) { alert("Please choose an exam"); return; }

    sessionStorage.setItem("candidateName", name);
    sessionStorage.setItem("candidateUniversity", university);
    sessionStorage.setItem("candidateEmail", email);
    sessionStorage.setItem("examFile", file);
    sessionStorage.removeItem("examState");
    
    window.location.href = "exam.html";
  });
}

/* ================== Exam page ================== */
function initExamPage() {
  const candidateName = sessionStorage.getItem("candidateName") || "Anonymous";
  const examFile = sessionStorage.getItem("examFile");
  if (!examFile) { 
    alert("No exam selected"); 
    window.location.href = "index.html"; 
    return; 
  }
  
  $("#candidateName").textContent = candidateName;
  const meta = EXAMS.find(x => x.file === examFile);
  if (meta) $("#examTitle").textContent = meta.title;

  fetch(examFile)
    .then(r => {
      if (!r.ok) throw new Error("Failed to load exam file");
      return r.json();
    })
    .then(json => {
      const totalTime = Number(json.totalTime || (json.questions && json.questions.length === 15 ? 300 : 600));
      runExam(json, totalTime);
    })
    .catch(err => {
      console.error(err);
      alert("Error loading exam. See console for details.");
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
    maxReached: 0,
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

  // Hide previous button completely
  if (prevBtn) prevBtn.style.display = "none";

  // Build progress grid
  progressGrid.innerHTML = "";
  state.questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "progress-item";
    d.textContent = i + 1;
    d.dataset.index = i;
    d.addEventListener("click", () => {
      if (i <= state.maxReached) {
        showQuestion(i);
      } else {
        alert("You must answer questions in order. You cannot skip ahead.");
      }
    });
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

    nextBtn.disabled = state.current >= state.questions.length - 1;

    // Update progress grid
    $all(".progress-item").forEach(el => {
      const i = Number(el.dataset.index);
      el.classList.toggle("answered", state.answers[i] !== null);
      el.classList.toggle("active", i === state.current);
      
      if (i > state.maxReached) {
        el.style.opacity = "0.4";
        el.style.cursor = "not-allowed";
      } else {
        el.style.opacity = "1";
        el.style.cursor = "pointer";
      }
    });

    persist();
  }

  function showQuestion(i) {
    if (i <= state.maxReached) {
      state.current = i;
      renderQuestion();
    }
  }

  function saveAnswer(idx) {
    state.answers[state.current] = idx;
    const el = document.querySelector(`.progress-item[data-index="${state.current}"]`);
    if (el) el.classList.add("answered");
    persist();
  }

  nextBtn.addEventListener("click", () => {
    if (state.current < state.questions.length - 1) {
      const nextIndex = state.current + 1;
      if (nextIndex > state.maxReached) {
        state.maxReached = nextIndex;
      }
      showQuestion(nextIndex);
    }
  });

  finishBtn.addEventListener("click", () => {
    const unanswered = state.answers.filter(a => a === null).length;
    if (unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered question(s). Are you sure you want to finish?`)) return;
    } else {
      if (!confirm("Are you sure you want to finish and submit the exam?")) return;
    }
    submitExam(false);
  });

  // Timer
  let timerInterval = null;
  function updateTimerUI() {
    timerEl.textContent = formatTime(state.timeLeft);
    if (state.timeLeft <= 300) {
      timerEl.classList.add("warning");
    }
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
        alert("Time's up! Your exam will be submitted automatically.");
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
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
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

    console.log("Exam result:", result);
    sessionStorage.setItem("lastResult", JSON.stringify(result));

    // Submit to Google Form
    submitToGoogleForm(result);
  }

  renderQuestion();
  if (!state.timerRunning) {
    state.timerRunning = true;
    state.startedAt = Date.now();
  }
  startTimer();
}

/* ================== IMPROVED Google Form Submission ================== */
function submitToGoogleForm(result) {
  console.log("🔧 Starting Google Form submission...", result);

  // Validate configuration
  if (!FORM_ACTION || FORM_ACTION.includes("FORM_ID")) {
    console.error("❌ FORM_ACTION not properly configured");
    alert("Error: Google Form not configured. Results saved locally only.");
    redirectToResult();
    return;
  }

  if (!ENTRY_NAME || ENTRY_NAME.includes("XXXXXXXXX")) {
    console.error("❌ Entry IDs not configured");
    alert("Error: Form entry IDs not configured. Results saved locally only.");
    redirectToResult();
    return;
  }

  // Create hidden iframe for submission
  const iframeName = "hidden-form-iframe-" + Date.now();
  let iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  // Create form
  const form = document.createElement("form");
  form.action = FORM_ACTION;
  form.method = "POST";
  form.target = iframeName;
  form.style.display = "none";

  // Helper to add form fields
  function addInput(name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value || "";
    form.appendChild(input);
    console.log(`📝 Adding field: ${name} = ${value}`);
  }

  // Add all required fields
  addInput(ENTRY_NAME, result.name);
  addInput(ENTRY_UNIVERSITY, result.university);
  addInput(ENTRY_EMAIL, result.email);
  addInput(ENTRY_SCORE, String(result.score));
  
  // Add optional fields if configured
  if (ENTRY_EXAM && !ENTRY_EXAM.includes("XXXXXXXXX")) {
    addInput(ENTRY_EXAM, result.examId);
  }
  if (ENTRY_TIME && !ENTRY_TIME.includes("XXXXXXXXX")) {
    addInput(ENTRY_TIME, String(result.time));
  }

  // Add the form to the page and submit
  document.body.appendChild(form);
  
  console.log("🚀 Submitting to Google Form...");
  console.log("📋 Form data:", {
    name: result.name,
    university: result.university,
    email: result.email,
    score: result.score,
    examId: result.examId,
    time: result.time
  });

  try {
    form.submit();
    console.log("✅ Form submitted successfully!");
    
    // Wait a bit for submission to complete, then redirect
    setTimeout(() => {
      console.log("🔄 Redirecting to results page...");
      redirectToResult();
    }, 1500);
    
  } catch (error) {
    console.error("❌ Form submission failed:", error);
    alert("Warning: Could not submit to Google Form. Results saved locally only.");
    redirectToResult();
  }

  // Clean up
  setTimeout(() => {
    try {
      form.remove();
      iframe.remove();
      console.log("🧹 Cleaned up form elements");
    } catch (e) {
      console.warn("Could not clean up form elements:", e);
    }
  }, 3000);
}

function redirectToResult() {
  window.location.href = "result.html";
}

/* ================== Result page ================== */
function initResultPage() {
  const raw = sessionStorage.getItem("lastResult");
  const summaryEl = $("#resultSummary");
  const detailedEl = $("#detailed");
  
  if (!raw) {
    if (summaryEl) summaryEl.textContent = "No saved result found.";
    return;
  }
  
  const r = JSON.parse(raw);
  if (summaryEl) {
    summaryEl.textContent = `${r.name} — ${r.examId}: ${r.score} / ${r.total} — ${r.time}s`;
  }
  
  if (detailedEl) {
    detailedEl.innerHTML = `
      <p>Name: <strong>${r.name}</strong></p>
      <p>University: <strong>${r.university || "-"}</strong></p>
      <p>Email: <strong>${r.email || "-"}</strong></p>
      <p>Exam: <strong>${r.examId}</strong></p>
      <p>Score: <strong>${r.score}</strong> of ${r.total}</p>
      <p>Time: <strong>${r.time}</strong> seconds</p>
      <p>Submitted: <strong>${new Date(r.date).toLocaleString()}</strong></p>
      ${r.timeExpired ? '<p style="color: #ef4444;"><strong>⏰ Time expired - auto-submitted</strong></p>' : ''}
    `;
  }
}

/* ================== Dashboard ================== */
// ... (keep the existing dashboard code as is)

/* ================== Bootstrap ================== */
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;
  if (pageId === "page-index") initIndexPage();
  else if (pageId === "page-exam") initExamPage();
  else if (pageId === "page-result") initResultPage();
  else if (pageId === "page-dashboard") initDashboardPage();
});
