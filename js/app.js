/* CISM Exam Prep — vanilla JS single-page app. No build step, no dependencies. */
(function () {
  "use strict";

  const STORAGE_STATS = "cism_stats_v1";
  const STORAGE_HISTORY = "cism_exam_history_v1";

  const root = document.getElementById("app");

  // ---------------------------------------------------------------- utils
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function letterFor(i) {
    return String.fromCharCode(65 + i);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_STATS)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveStats(stats) {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
  }
  function recordAnswer(stats, questionId, correct) {
    if (!stats[questionId]) stats[questionId] = { seen: 0, correct: 0 };
    stats[questionId].seen += 1;
    if (correct) stats[questionId].correct += 1;
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || [];
    } catch (e) {
      return [];
    }
  }
  function pushHistory(entry) {
    const h = loadHistory();
    h.unshift(entry);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(h.slice(0, 10)));
  }

  function domainStats(stats, domain) {
    const qs = CISM_QUESTIONS.filter((q) => q.domain === domain);
    let seen = 0, correct = 0;
    qs.forEach((q) => {
      const s = stats[q.id];
      if (s) { seen += s.seen; correct += s.correct; }
    });
    return { seen, correct, total: qs.length };
  }

  function overallStats(stats) {
    let seen = 0, correct = 0;
    Object.values(stats).forEach((s) => { seen += s.seen; correct += s.correct; });
    return { seen, correct };
  }

  function accClass(pct) {
    if (pct >= 80) return "acc-good";
    if (pct >= 60) return "acc-mid";
    return "acc-bad";
  }

  function buildExamSet(n) {
    const domains = [1, 2, 3, 4];
    let counts = {};
    let allocated = 0;
    domains.forEach((d) => {
      counts[d] = Math.round((CISM_DOMAINS[d].weight / 100) * n);
      allocated += counts[d];
    });
    counts[3] += n - allocated; // absorb rounding drift into the largest domain
    domains.forEach((d) => {
      const pool = CISM_QUESTIONS.filter((q) => q.domain === d).length;
      if (counts[d] > pool) counts[d] = pool;
      if (counts[d] < 0) counts[d] = 0;
    });

    let selected = [];
    domains.forEach((d) => {
      const pool = shuffle(CISM_QUESTIONS.filter((q) => q.domain === d));
      selected = selected.concat(pool.slice(0, counts[d]));
    });

    if (selected.length < n) {
      const usedIds = new Set(selected.map((q) => q.id));
      const remaining = shuffle(CISM_QUESTIONS.filter((q) => !usedIds.has(q.id)));
      for (const q of remaining) {
        if (selected.length >= n) break;
        selected.push(q);
      }
    }
    return shuffle(selected).slice(0, n);
  }

  // ------------------------------------------------------------- app state
  let state = { screen: "home" };
  let deferredInstallPrompt = null;

  function go(screen, extra) {
    state = Object.assign({ screen }, extra || {});
    window.scrollTo(0, 0);
    render();
  }

  // ------------------------------------------------------------- screens
  function screenHome() {
    const stats = loadStats();
    const overall = overallStats(stats);
    const overallPct = overall.seen ? Math.round((overall.correct / overall.seen) * 100) : null;
    const history = loadHistory();

    const domainRows = [1, 2, 3, 4].map((d) => {
      const ds = domainStats(stats, d);
      const pct = ds.seen ? Math.round((ds.correct / ds.seen) * 100) : null;
      const info = CISM_DOMAINS[d];
      return `
        <div class="domain-row">
          <div>
            <div class="name">D${d}. ${escapeHtml(info.name)}</div>
            <div class="meta">${info.weight}% of exam &middot; ${ds.total} questions in bank${ds.seen ? ` &middot; ${ds.seen} attempts` : ""}</div>
          </div>
          <div class="acc ${pct === null ? "" : accClass(pct)}">${pct === null ? "—" : pct + "%"}</div>
        </div>`;
    }).join("");

    const historyHtml = history.length ? history.slice(0, 5).map((h) => `
        <div class="domain-row">
          <div>
            <div class="name">Mock exam &middot; ${h.total} questions</div>
            <div class="meta">${new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
          <div class="acc ${accClass(h.pct)}">${h.pct}%</div>
        </div>`).join("") : `<div class="empty-note">No mock exams taken yet.</div>`;

    root.innerHTML = `
      <div class="hero">
        <img class="logo" src="icons/icon-192.png" alt="" />
        <h1>CISM Exam Prep</h1>
        <p>${CISM_QUESTIONS.length} original practice questions &middot; 4 official domains</p>
      </div>

      <div class="install-banner" id="installBanner">
        <span>Install this app on your phone for offline studying.</span>
        <button data-action="install">Install</button>
      </div>

      <div class="stat-grid">
        <div class="stat-tile"><div class="val">${overall.seen}</div><div class="lbl">Answered</div></div>
        <div class="stat-tile"><div class="val">${overallPct === null ? "—" : overallPct + "%"}</div><div class="lbl">Accuracy</div></div>
        <div class="stat-tile"><div class="val">${history.length}</div><div class="lbl">Mock exams</div></div>
      </div>

      <div class="stack">
        <button class="btn primary" data-action="go" data-screen="practiceSetup">Practice</button>
        <button class="btn secondary" data-action="go" data-screen="examSetup">Mock Exam</button>
      </div>

      <div class="section-title">Domain performance</div>
      <div class="domain-list">${domainRows}</div>

      <div class="section-title">Recent mock exams</div>
      <div class="domain-list">${historyHtml}</div>

      <div class="section-title">&nbsp;</div>
      <button class="btn ghost" data-action="confirmReset">Reset all progress</button>
      <p class="empty-note" style="margin-top:18px;">Practice questions are original, written to ISACA's CISM Exam Content Outline style — not real/leaked exam content. See About for details.</p>
      <button class="btn ghost" data-action="go" data-screen="about">About this app</button>
    `;
    updateInstallBanner();
  }

  function screenAbout() {
    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="go" data-screen="home">&larr; Back</button>
        <h1>About</h1>
        <span></span>
      </header>
      <div class="card">
        <p>This question bank contains <strong>original practice questions</strong> written to match the style, difficulty, and "best answer" management-judgment format of the real ISACA CISM exam.</p>
        <p>Questions are mapped to the official <strong>CISM Exam Content Outline</strong> (current version, valid through 2 Nov 2026):</p>
        <p>
          D1. Information Security Governance — 17%<br/>
          D2. Information Security Risk Management — 20%<br/>
          D3. Information Security Program — 33%<br/>
          D4. Incident Management — 30%
        </p>
        <p>They are <strong>not</strong> reproductions of real or leaked ISACA exam items. Using actual secured exam content ("exam dumps") violates ISACA's certification agreement and copyright. This app is meant to build the same judgment skills the real exam tests.</p>
        <p style="color:var(--text-dim);font-size:13px;">Note: ISACA is updating the CISM exam content outline on 3 Nov 2026 with a revised domain structure. This bank reflects the outline in effect through that date.</p>
      </div>
      <div class="card">
        <p>All progress is stored locally on your device (localStorage) — nothing is sent to a server.</p>
      </div>
    `;
  }

  function screenPracticeSetup() {
    const chips = [0, 1, 2, 3, 4].map((d) => {
      const label = d === 0 ? "All domains" : `D${d}`;
      return `<button class="chip ${d === (state.pendingDomain ?? 0) ? "active" : ""}" data-action="setPendingDomain" data-domain="${d}">${label}</button>`;
    }).join("");

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="go" data-screen="home">&larr; Back</button>
        <h1>Practice</h1>
        <span></span>
      </header>
      <div class="card">
        <p style="margin-top:0;color:var(--text-dim);font-size:14px;">Get instant feedback and a full explanation after each question.</p>
        <div class="section-title" style="margin-top:0;">Domain</div>
        <div class="chip-row">${chips}</div>
      </div>
      <button class="btn primary" data-action="startPractice">Start Practice</button>
    `;
  }

  function startPractice(domain) {
    const pool = domain ? CISM_QUESTIONS.filter((q) => q.domain === domain) : CISM_QUESTIONS;
    const queue = shuffle(pool);
    go("quiz", { mode: "practice", queue, index: 0, answered: false, selected: null });
  }

  function screenExamSetup() {
    const lengths = [25, 50, 100, 150];
    const chips = lengths.map((n) => `<button class="chip ${n === (state.pendingLen ?? 50) ? "active" : ""}" data-action="setPendingLen" data-len="${n}">${n} questions</button>`).join("");
    const n = state.pendingLen ?? 50;
    const minutes = Math.max(10, Math.round((n * 235) / 150));
    const isFullLength = n === 150;

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="go" data-screen="home">&larr; Back</button>
        <h1>Mock Exam</h1>
        <span></span>
      </header>
      <div class="card">
        <p style="margin-top:0;color:var(--text-dim);font-size:14px;">Timed, no feedback until you finish — mirrors real exam conditions. Questions are drawn proportionally across all 4 domains, matching ISACA's exam weighting.</p>
        <div class="section-title" style="margin-top:0;">Length</div>
        <div class="chip-row">${chips}</div>
        <div class="section-title">Time limit</div>
        <p style="margin:0;font-size:15px;">${minutes} minutes ${isFullLength ? "" : `<span style="color:var(--text-dim);font-size:13px;">(scaled from the real exam's 235 min / 150 questions)</span>`}</p>
      </div>
      <button class="btn primary" data-action="startExam">Start Mock Exam</button>
    `;
  }

  function startExam(n, minutes) {
    const queue = buildExamSet(n);
    go("quiz", {
      mode: "exam",
      queue,
      index: 0,
      answers: new Array(queue.length).fill(null),
      flagged: new Array(queue.length).fill(false),
      endsAt: Date.now() + minutes * 60 * 1000,
    });
  }

  function screenQuiz() {
    const { mode, queue, index } = state;
    const q = queue[index];
    const total = queue.length;

    if (mode === "practice") {
      renderPracticeQuestion(q, index, total);
    } else {
      renderExamQuestion(q, index, total);
    }
  }

  function renderPracticeQuestion(q, index, total) {
    const answered = state.answered;
    const selected = state.selected;
    const info = CISM_DOMAINS[q.domain];

    const optionsHtml = q.options.map((opt, i) => {
      let cls = "option";
      if (answered) {
        if (i === q.answer) cls += " correct";
        else if (i === selected) cls += " incorrect";
        else cls += " dim";
      } else {
        cls += " selectable";
      }
      return `<button class="${cls}" ${answered ? "disabled" : ""} data-action="answer" data-index="${i}">
        <span class="letter">${letterFor(i)}</span>
        <span>${escapeHtml(opt)}</span>
      </button>`;
    }).join("");

    let explanationHtml = "";
    if (answered) {
      const correct = selected === q.answer;
      explanationHtml = `
        <div class="explanation">
          <span class="tag ${correct ? "correct-tag" : "incorrect-tag"}">${correct ? "Correct" : "Incorrect"}</span>
          <div>${escapeHtml(q.explanation)}</div>
        </div>`;
    }

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="confirmExitPractice">&larr; End</button>
        <h1>Practice</h1>
        <span></span>
      </header>
      <div class="progress-bar"><div style="width:${((index) / total) * 100}%"></div></div>
      <div class="qmeta"><span>Question ${index + 1} of ${total}</span><span>D${q.domain} &middot; ${info.name}</span></div>
      <div class="card">
        <div class="qtext">${escapeHtml(q.question)}</div>
        <div class="options">${optionsHtml}</div>
        ${explanationHtml}
      </div>
      <footer class="actions">
        ${answered
          ? `<button class="btn primary" data-action="nextPractice">${index + 1 < total ? "Next Question" : "Finish"}</button>`
          : `<button class="btn ghost" disabled>Select an answer</button>`}
      </footer>
    `;
  }

  function renderExamQuestion(q, index, total) {
    const info = CISM_DOMAINS[q.domain];
    const selected = state.answers[index];
    const flagged = state.flagged[index];

    const optionsHtml = q.options.map((opt, i) => {
      return `<button class="option selectable" data-action="examAnswer" data-index="${i}" style="${selected === i ? "border-color:var(--accent);background:color-mix(in srgb, var(--accent) 16%, var(--bg-elev));" : ""}">
        <span class="letter" style="${selected === i ? "border-color:var(--accent);color:var(--accent);" : ""}">${letterFor(i)}</span>
        <span>${escapeHtml(opt)}</span>
      </button>`;
    }).join("");

    const remainingMs = state.endsAt - Date.now();
    const low = remainingMs < 5 * 60 * 1000;

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="confirmExitExam">&larr; Exit</button>
        <h1>Mock Exam</h1>
        <span class="timer ${low ? "low" : ""}" id="examTimer"></span>
      </header>
      <div class="progress-bar"><div style="width:${((index) / total) * 100}%"></div></div>
      <div class="qmeta"><span>Question ${index + 1} of ${total}</span><span>D${q.domain} &middot; ${info.name}</span></div>
      <div class="card">
        <div class="qtext">${escapeHtml(q.question)}</div>
        <div class="options">${optionsHtml}</div>
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn ghost" data-action="flagQuestion">${flagged ? "★ Flagged" : "☆ Flag for review"}</button>
        <button class="btn ghost" data-action="openPalette">Question list</button>
      </div>
      <footer class="actions">
        <div class="btn-row">
          <button class="btn secondary" data-action="examPrev" ${index === 0 ? "disabled" : ""}>Previous</button>
          ${index + 1 < total
            ? `<button class="btn primary" data-action="examNext">Next</button>`
            : `<button class="btn primary" data-action="confirmFinishExam">Finish Exam</button>`}
        </div>
      </footer>
    `;
    startExamTimer();
  }

  let examTimerInterval = null;
  function startExamTimer() {
    stopExamTimer();
    const tick = () => {
      const el = document.getElementById("examTimer");
      if (!el) { stopExamTimer(); return; }
      const remainingMs = state.endsAt - Date.now();
      if (remainingMs <= 0) {
        stopExamTimer();
        finishExam();
        return;
      }
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      el.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
      if (remainingMs < 5 * 60 * 1000) el.classList.add("low");
    };
    tick();
    examTimerInterval = setInterval(tick, 1000);
  }
  function stopExamTimer() {
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
  }

  function screenExamPalette() {
    const { queue, answers, flagged, index } = state;
    const cells = queue.map((q, i) => {
      let cls = "chip";
      if (i === index) cls += " active";
      const label = `${i + 1}${flagged[i] ? " ★" : ""}${answers[i] !== null ? " ✓" : ""}`;
      return `<button class="${cls}" data-action="jumpTo" data-index="${i}">${label}</button>`;
    }).join("");
    const answeredCount = answers.filter((a) => a !== null).length;

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="closePalette">&larr; Back</button>
        <h1>Questions</h1>
        <span></span>
      </header>
      <div class="card">
        <p style="margin:0 0 10px;color:var(--text-dim);font-size:13px;">${answeredCount} of ${queue.length} answered</p>
        <div class="chip-row">${cells}</div>
      </div>
      <button class="btn primary" data-action="confirmFinishExam">Finish Exam</button>
    `;
  }

  function finishExam() {
    stopExamTimer();
    const { queue, answers } = state;
    const stats = loadStats();
    let correct = 0;
    const domainTally = { 1: { c: 0, t: 0 }, 2: { c: 0, t: 0 }, 3: { c: 0, t: 0 }, 4: { c: 0, t: 0 } };

    queue.forEach((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      domainTally[q.domain].t++;
      if (isCorrect) domainTally[q.domain].c++;
      recordAnswer(stats, q.id, isCorrect);
    });
    saveStats(stats);

    const pct = Math.round((correct / queue.length) * 100);
    pushHistory({ date: Date.now(), total: queue.length, correct, pct, domainTally });

    go("examResults", { queue, answers, correct, pct, domainTally });
  }

  function screenExamResults() {
    const { queue, answers, correct, pct, domainTally } = state;
    const passLikely = pct >= 75;

    const domainRows = [1, 2, 3, 4].map((d) => {
      const t = domainTally[d];
      const dpct = t.t ? Math.round((t.c / t.t) * 100) : null;
      return `
        <div class="domain-row">
          <div>
            <div class="name">D${d}. ${escapeHtml(CISM_DOMAINS[d].name)}</div>
            <div class="meta">${t.c} / ${t.t} correct</div>
          </div>
          <div class="acc ${dpct === null ? "" : accClass(dpct)}">${dpct === null ? "—" : dpct + "%"}</div>
        </div>`;
    }).join("");

    const reviewHtml = queue.map((q, i) => {
      const userAns = answers[i];
      const isCorrect = userAns === q.answer;
      const optsHtml = q.options.map((opt, oi) => {
        let cls = "option";
        if (oi === q.answer) cls += " correct";
        else if (oi === userAns) cls += " incorrect";
        else cls += " dim";
        return `<div class="${cls}"><span class="letter">${letterFor(oi)}</span><span>${escapeHtml(opt)}</span></div>`;
      }).join("");
      return `
        <div class="review-item ${isCorrect ? "right" : "wrong"}">
          <div class="qmeta"><span>Question ${i + 1}</span><span>D${q.domain}</span></div>
          <div class="qtext" style="font-size:15px;">${escapeHtml(q.question)}</div>
          <div class="options">${optsHtml}</div>
          <div class="explanation"><span class="tag ${isCorrect ? "correct-tag" : "incorrect-tag"}">${isCorrect ? "Correct" : userAns === null ? "Not answered" : "Incorrect"}</span><div>${escapeHtml(q.explanation)}</div></div>
        </div>`;
    }).join("");

    root.innerHTML = `
      <header class="topbar">
        <button class="back" data-action="go" data-screen="home">&larr; Home</button>
        <h1>Results</h1>
        <span></span>
      </header>
      <div class="card" style="text-align:center;">
        <div style="font-size:44px;font-weight:800;color:${passLikely ? "var(--good)" : "var(--bad)"};">${pct}%</div>
        <div style="color:var(--text-dim);font-size:14px;margin-bottom:4px;">${correct} of ${queue.length} correct</div>
        <div style="font-size:13px;color:var(--text-dim);">Rough guide only — ISACA scores on a scaled 200&ndash;800 range (pass = 450), not a raw percentage. Treat ~75%+ here as a healthy margin.</div>
      </div>
      <div class="section-title" style="margin-top:0;">By domain</div>
      <div class="domain-list">${domainRows}</div>
      <div class="section-title">Review</div>
      <div>${reviewHtml}</div>
      <button class="btn primary" data-action="go" data-screen="home" style="margin-top:10px;">Done</button>
    `;
  }

  // ------------------------------------------------------------- actions
  function handleAction(action, el) {
    switch (action) {
      case "go":
        go(el.dataset.screen);
        break;
      case "setPendingDomain":
        state.pendingDomain = Number(el.dataset.domain);
        render();
        break;
      case "startPractice":
        startPractice(state.pendingDomain || 0);
        break;
      case "setPendingLen":
        state.pendingLen = Number(el.dataset.len);
        render();
        break;
      case "startExam": {
        const n = state.pendingLen ?? 50;
        const minutes = Math.max(10, Math.round((n * 235) / 150));
        startExam(n, minutes);
        break;
      }
      case "answer": {
        if (state.answered) return;
        const i = Number(el.dataset.index);
        state.selected = i;
        state.answered = true;
        const q = state.queue[state.index];
        const stats = loadStats();
        recordAnswer(stats, q.id, i === q.answer);
        saveStats(stats);
        render();
        break;
      }
      case "nextPractice": {
        if (state.index + 1 >= state.queue.length) {
          go("home");
        } else {
          state.index += 1;
          state.answered = false;
          state.selected = null;
          render();
        }
        break;
      }
      case "confirmExitPractice":
        if (confirm("End this practice session? Your progress on answered questions is already saved.")) go("home");
        break;
      case "examAnswer": {
        const i = Number(el.dataset.index);
        state.answers[state.index] = i;
        render();
        break;
      }
      case "examNext":
        state.index = Math.min(state.index + 1, state.queue.length - 1);
        render();
        break;
      case "examPrev":
        state.index = Math.max(state.index - 1, 0);
        render();
        break;
      case "jumpTo":
        state.index = Number(el.dataset.index);
        state.screen = "quiz";
        render();
        break;
      case "openPalette":
        state.screen = "examPalette";
        render();
        break;
      case "closePalette":
        state.screen = "quiz";
        render();
        break;
      case "flagQuestion":
        state.flagged[state.index] = !state.flagged[state.index];
        render();
        break;
      case "confirmExitExam":
        if (confirm("Exit the mock exam? Your answers will be lost.")) { stopExamTimer(); go("home"); }
        break;
      case "confirmFinishExam": {
        const unanswered = state.answers.filter((a) => a === null).length;
        const msg = unanswered
          ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Finish anyway?`
          : "Finish the exam and see your results?";
        if (confirm(msg)) finishExam();
        break;
      }
      case "confirmReset":
        if (confirm("Reset all saved progress and exam history? This cannot be undone.")) {
          localStorage.removeItem(STORAGE_STATS);
          localStorage.removeItem(STORAGE_HISTORY);
          render();
        }
        break;
      case "install":
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.finally(() => {
            deferredInstallPrompt = null;
            updateInstallBanner();
          });
        }
        break;
    }
  }

  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    handleAction(el.dataset.action, el);
  });

  // ------------------------------------------------------------- install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallBanner();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallBanner();
  });

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function updateInstallBanner() {
    const banner = document.getElementById("installBanner");
    if (!banner) return;
    if (isStandalone()) { banner.classList.remove("show"); return; }
    if (deferredInstallPrompt) {
      banner.querySelector("span").textContent = "Install this app on your phone for offline studying.";
      banner.querySelector("button").style.display = "";
      banner.classList.add("show");
    } else if (isIos()) {
      banner.querySelector("span").textContent = "On iPhone/iPad: tap Share, then \"Add to Home Screen\" to install.";
      banner.querySelector("button").style.display = "none";
      banner.classList.add("show");
    }
  }

  // ------------------------------------------------------------- render
  function render() {
    stopExamTimer();
    switch (state.screen) {
      case "home": return screenHome();
      case "about": return screenAbout();
      case "practiceSetup": return screenPracticeSetup();
      case "examSetup": return screenExamSetup();
      case "quiz": return screenQuiz();
      case "examPalette": return screenExamPalette();
      case "examResults": return screenExamResults();
      default: return screenHome();
    }
  }

  render();
})();
