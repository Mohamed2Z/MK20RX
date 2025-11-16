```markdown
# Cybersecurity Exam Platform — Static Web App (GitHub Pages)

This repository is a complete, static, web-based exam platform you can publish on GitHub Pages. It contains 8 ready-to-use exams (4 × 30-question exams and 4 × 15-question exams), a single-page exam flow (one question at a time), a results submission pipeline to Google Sheets (via Google Apps Script web app), and a basic dashboard that computes statistics from the sheet.

Files included
- index.html         — Landing page (enter name, pick exam)
- exam.html          — Exam runtime page (questions + countdown)
- result.html        — Results display page
- dashboard.html     — Aggregated stats (pulls data from Apps Script)
- style.css          — Styles
- script.js          — Front-end logic (fetch exams, timer, shuffle, save answers, submit results)
- exam1.json … exam8.json — All 8 exam JSON files (exam1..exam4 = 30Q, exam5..exam8 = 15Q)
- apps_script/Code.gs — Google Apps Script code (doGet, doPost) to read/write Google Sheets

Quick structure
- Exams 1–4: 30 questions each, totalTime = 600 seconds
- Exams 5–8: 15 questions each, totalTime = 300 seconds

IMPORTANT: script.js already contains the Apps Script Web App URL you provided earlier.

Google Sheets & Apps Script setup (brief)
1. Create a new Google Sheet. Add a sheet (tab) named `results`.
2. Add header row (row 1) exactly:
   Name | ExamID | Score | TotalQuestions | TimeTaken | Date
3. Open Extensions → Apps Script in the spreadsheet. Create a new project and paste apps_script/Code.gs (provided). Save.
4. Deploy → New deployment → “Web app”
   - Execute as: Me
   - Who has access: Anyone
   - Deploy and copy the Web App URL (you already provided it earlier).
5. Confirm the sheet receives rows after a test submission.

Deploy on GitHub Pages (brief)
1. Create a new repository (e.g., `cyber-exam-platform`).
2. Push the files to the `main` branch (instructions below).
3. Settings → Pages → Source: Branch: main / Folder: root → Save.
4. Wait a minute for the site to publish and open the provided URL.

Local git commands (quick)
# create project folder and push to new GitHub repo
mkdir cyber-exam-platform
cd cyber-exam-platform
# copy files into this folder (or create them)
git init
git add .
git commit -m "Initial commit - Cybersecurity exam platform"
# create repo on GitHub (use the GitHub web UI or gh CLI)
# using gh:
# gh repo create Mohamed2Z/cyber-exam-platform --public --source=. --remote=origin --push
git remote add origin https://github.com/Mohamed2Z/cyber-exam-platform.git
git branch -M main
git push -u origin main

Notes
- The front-end is entirely static. The only external call is to the Google Apps Script Web App URL for result submission and dashboard reads.
- To change the Apps Script URL later, edit script.js, update GOOGLE_APPS_SCRIPT_URL, and push.

```