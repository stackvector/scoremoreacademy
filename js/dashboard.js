import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getDoc, getDocs, getFirestore, collection, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { firebaseConfig, scoreMoreCollections } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ui = {
  stateLoading: document.getElementById("stateLoading"),
  stateSignIn: document.getElementById("stateSignIn"),
  statePending: document.getElementById("statePending"),
  stateLocked: document.getElementById("stateLocked"),
  stateDashboard: document.getElementById("stateDashboard"),
  googleSignInBtn: document.getElementById("googleSignInBtn"),
  pendingSignOut: document.getElementById("pendingSignOut"),
  dashSignOut: document.getElementById("dashSignOut"),
  lockedSignOut: document.getElementById("lockedSignOut"),
  pendingPhoto: document.getElementById("pendingPhoto"),
  pendingName: document.getElementById("pendingName"),
  dashUserPhoto: document.getElementById("dashUserPhoto"),
  dashUserName: document.getElementById("dashUserName"),
  dashClassTitle: document.getElementById("dashClassTitle"),
  dashClassSub: document.getElementById("dashClassSub"),
  subjectTabs: document.getElementById("subjectTabs"),
  contentContainer: document.getElementById("contentContainer"),
  statsGrid: document.getElementById("statsGrid"),
  graphCanvas: document.getElementById("graphCanvas"),
  modeFilters: document.getElementById("modeFilters"),
  chartFilters: document.getElementById("chartFilters"),
  welcomeNote: document.getElementById("welcomeNote"),
  seriesChip: document.getElementById("seriesChip"),
};

let currentUserAccess = null;
let currentClass = "";
let currentSubjectId = "";
let activeMode = "all";
let activeChart = "overall";
let subjectMap = new Map();
let chaptersBySubject = new Map();

function showState(activeState) {
  [ui.stateLoading, ui.stateSignIn, ui.statePending, ui.stateLocked, ui.stateDashboard].forEach((stateNode) => {
    stateNode.style.display = stateNode === activeState ? "" : "none";
  });
}

function safeText(value, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function formatMode(chapter) {
  const raw = String(chapter.format || chapter.mode || "pdf").toLowerCase();
  if (raw === "timed") return "timed";
  if (raw === "latex" || raw === "interactive") return "latex";
  return "pdf";
}

function formatStatus(chapter) {
  const raw = String(chapter.deliveryStatus || chapter.status || "live").toLowerCase();
  return raw === "coming-soon" || raw === "soon" ? "soon" : "live";
}

function chapterCountByMode(chapters) {
  return chapters.reduce((acc, chapter) => {
    const mode = formatMode(chapter);
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, { pdf: 0, latex: 0, timed: 0 });
}

function answerKeyAllowed(chapter) {
  if (!chapter.answerKeyUrl) return false;
  if (chapter.answerKeyLocked === false) return true;
  return currentUserAccess?.answerKeysUnlocked === true;
}

function chapterActionButton(chapter) {
  const mode = formatMode(chapter);
  const status = formatStatus(chapter);
  if (status === "soon") {
    return `<span class="action-btn locked">Coming Soon</span>`;
  }

  if (mode === "timed") {
    const target = chapter.testUrl || chapter.pdfUrl || "#";
    return `<a href="${target}" target="_blank" rel="noreferrer" class="action-btn primary">Start Timed Test</a>`;
  }

  if (mode === "latex") {
    const target = chapter.testUrl || chapter.pdfUrl || "#";
    return `<a href="${target}" target="_blank" rel="noreferrer" class="action-btn primary">Open Interactive Test</a>`;
  }

  return `<a href="${chapter.pdfUrl || "#"}" target="_blank" rel="noreferrer" class="action-btn primary">Open PDF</a>`;
}

function chapterCard(chapter) {
  const mode = formatMode(chapter);
  const status = formatStatus(chapter);
  const answerKeyButton = chapter.answerKeyUrl
    ? answerKeyAllowed(chapter)
      ? `<a href="${chapter.answerKeyUrl}" target="_blank" rel="noreferrer" class="action-btn">Answer Key</a>`
      : `<span class="action-btn locked">Answer Key Locked</span>`
    : "";

  const copyMap = {
    pdf: "Offline-first chapter paper ready to download and solve.",
    latex: "Built for future structured online practice inside the dashboard.",
    timed: "Prepared for live timed attempts, auto-submit, and analytics."
  };

  return `
    <article class="chapter-card" data-mode="${mode}">
      <div class="chapter-top">
        <div>
          <div class="chapter-badges">
            <span class="mode-badge ${mode}">${mode === "pdf" ? "PDF" : mode === "latex" ? "Work Practice" : "Timed"}</span>
            <span class="status-badge ${status}">${status === "live" ? "Live" : "Coming Soon"}</span>
          </div>
          <h5>${safeText(chapter.title, chapter.id)}</h5>
        </div>
      </div>
      <div class="chapter-meta">
        <span>${safeText(chapter.questions, 0)} questions</span>
        <span>${safeText(chapter.marks, 0)} marks</span>
        <span>${safeText(chapter.duration, 0)} mins</span>
      </div>
      <div class="chapter-copy">${safeText(chapter.summary, copyMap[mode])}</div>
      <div class="chapter-actions">
        ${chapterActionButton(chapter)}
        ${answerKeyButton}
      </div>
    </article>
  `;
}

function renderEmpty(title, text) {
  ui.contentContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">SM</div>
      <h4>${title}</h4>
      <p>${text}</p>
    </div>
  `;
}

function filterChaptersByMode(chapters) {
  if (activeMode === "all") return chapters;
  return chapters.filter((chapter) => formatMode(chapter) === activeMode);
}

function buildChapterGroups(chapters) {
  const live = [];
  const upcoming = [];
  chapters.forEach((chapter) => {
    if (formatStatus(chapter) === "soon") {
      upcoming.push(chapter);
    } else {
      live.push(chapter);
    }
  });

  const groups = [];
  if (live.length) groups.push({ label: "Available Now", items: live });
  if (upcoming.length) groups.push({ label: "Upcoming Modes", items: upcoming });
  return groups;
}

function renderStats(chapters) {
  const allChapters = chapters;
  const filtered = filterChaptersByMode(chapters);
  const totals = chapterCountByMode(filtered);
  const liveCount = filtered.filter((chapter) => formatStatus(chapter) === "live").length;
  const soonCount = filtered.filter((chapter) => formatStatus(chapter) === "soon").length;
  const avgDuration = filtered.length
    ? Math.round(filtered.reduce((sum, chapter) => sum + Number(chapter.duration || 0), 0) / filtered.length)
    : 0;

  ui.statsGrid.innerHTML = `
    <div class="stat-card">
      <h4>Published Chapters</h4>
      <div class="stat-main"><strong>${filtered.length}</strong><span>visible now</span></div>
      <div class="stat-breakdown">
        <span>Live <b>${liveCount}</b></span>
        <span>Upcoming <b>${soonCount}</b></span>
      </div>
    </div>
    <div class="stat-card">
      <h4>Delivery Mix</h4>
      <div class="stat-main"><strong>${totals.pdf + totals.latex + totals.timed}</strong><span>total items</span></div>
      <div class="stat-breakdown">
        <span>PDF <b>${totals.pdf}</b></span>
        <span>Work Practice <b>${totals.latex}</b></span>
        <span>Timed <b>${totals.timed}</b></span>
      </div>
    </div>
    <div class="stat-card">
      <h4>Practice Profile</h4>
      <div class="stat-main"><strong>${avgDuration}</strong><span>avg mins</span></div>
      <div class="stat-breakdown">
        <span>Answer Keys <b>${allChapters.filter((chapter) => chapter.answerKeyUrl).length}</b></span>
        <span>Subjects <b>${subjectMap.size}</b></span>
      </div>
    </div>
  `;
}

function lineColorForChart(type) {
  if (type === "pdf") return "#ef4444";
  if (type === "latex") return "#4f46e5";
  if (type === "timed") return "#10b981";
  return "#1f2937";
}

function renderGraph(chapters) {
  const source = activeChart === "overall"
    ? chapters
    : chapters.filter((chapter) => formatMode(chapter) === activeChart);

  if (!source.length) {
    ui.graphCanvas.innerHTML = `
      <div class="empty-state" style="height:100%; display:flex; flex-direction:column; justify-content:center;">
        <div class="empty-icon">Graph</div>
        <h4>No data for this mode yet</h4>
        <p>Once content or attempts exist for this track, the progress line will appear here.</p>
      </div>
    `;
    return;
  }

  const points = source.map((chapter, index) => {
    const x = 40 + (index * (720 / Math.max(source.length - 1, 1)));
    const value = Number(chapter.progressScore || chapter.marks || 0);
    const capped = Math.min(100, Math.max(15, value));
    const y = 250 - (capped * 2);
    return { x, y, label: safeText(chapter.shortLabel, `T${index + 1}`), mode: formatMode(chapter) };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const labels = points.map((point) => `
    <text x="${point.x}" y="292" text-anchor="middle" font-size="11" fill="#64748b">${point.label}</text>
  `).join("");
  const nodes = points.map((point) => `
    <circle cx="${point.x}" cy="${point.y}" r="5.5" fill="${lineColorForChart(point.mode)}" stroke="#fff" stroke-width="2"></circle>
  `).join("");

  ui.graphCanvas.innerHTML = `
    <svg class="graph-svg" viewBox="0 0 800 320" preserveAspectRatio="none" aria-label="Progress graph">
      <polyline fill="none" stroke="${lineColorForChart(activeChart)}" stroke-width="3" points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
      ${nodes}
      ${labels}
      <line x1="40" y1="250" x2="760" y2="250" stroke="#94a3b8" stroke-width="1"></line>
      <line x1="40" y1="30" x2="40" y2="250" stroke="#94a3b8" stroke-width="1"></line>
      <text x="20" y="38" font-size="11" fill="#94a3b8">100</text>
      <text x="22" y="105" font-size="11" fill="#94a3b8">70</text>
      <text x="22" y="175" font-size="11" fill="#94a3b8">40</text>
      <text x="24" y="248" font-size="11" fill="#94a3b8">10</text>
      <path d="${path}" fill="none" stroke="transparent"></path>
    </svg>
  `;
}

function renderSubject(subjectId) {
  currentSubjectId = subjectId;
  const subject = subjectMap.get(subjectId);
  const allChapters = chaptersBySubject.get(subjectId) || [];
  const filtered = filterChaptersByMode(allChapters);

  ui.dashClassTitle.textContent = `${currentClass} â€¢ ${safeText(subject?.label, subjectId)}`;
  ui.dashClassSub.textContent = "Chapter-wise content is grouped for PDFs today, and future online-test formats tomorrow.";

  renderStats(allChapters);
  renderGraph(filtered.length ? filtered : allChapters);

  if (!filtered.length) {
    renderEmpty("No chapters in this mode", "Try another mode filter or publish more content for this subject.");
    return;
  }

  const groups = buildChapterGroups(filtered);
  ui.contentContainer.innerHTML = `
    <div class="chapter-groups">
      ${groups.map((group) => `
        <section class="chapter-group">
          <h4>${group.label}</h4>
          <div class="chapter-grid">
            ${group.items.map(chapterCard).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

async function loadChaptersForSubject(className, subjectId) {
  const chaptersQuery = query(
    collection(db, scoreMoreCollections.testSeries, className, "subjects", subjectId, "chapters"),
    orderBy("order", "asc")
  );
  const chapterSnap = await getDocs(chaptersQuery);
  return chapterSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function loadSubjects(className) {
  currentClass = className;
  ui.subjectTabs.style.display = "flex";
  ui.contentContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading subjects and chapter content...</div>';

  try {
    const subjectsQuery = query(collection(db, scoreMoreCollections.testSeries, className, "subjects"), orderBy("order", "asc"));
    const subjectsSnap = await getDocs(subjectsQuery);
    const subjects = subjectsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (!subjects.length) {
      ui.subjectTabs.innerHTML = "";
      renderEmpty("No subjects yet", "This class is approved, but no subjects have been published yet.");
      return;
    }

    subjectMap = new Map();
    chaptersBySubject = new Map();

    await Promise.all(subjects.map(async (subject) => {
      subjectMap.set(subject.id, subject);
      const chapters = await loadChaptersForSubject(className, subject.id);
      chaptersBySubject.set(subject.id, chapters);
    }));

    ui.subjectTabs.innerHTML = subjects.map((subject, index) => `
      <button class="subj-tab${index === 0 ? " active" : ""}" type="button" data-subject="${subject.id}">
        ${subject.label || subject.id}
      </button>
    `).join("");

    ui.subjectTabs.querySelectorAll(".subj-tab").forEach((button) => {
      button.addEventListener("click", () => {
        ui.subjectTabs.querySelectorAll(".subj-tab").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        renderSubject(button.dataset.subject);
      });
    });

    renderSubject(subjects[0].id);
  } catch (error) {
    console.error(error);
    renderEmpty("Could not load dashboard data", `Firebase returned: ${error?.message || "Unknown error"}`);
  }
}

async function loadUserDashboard(user) {
  const userRef = doc(db, scoreMoreCollections.users, user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    ui.pendingPhoto.src = user.photoURL || "";
    ui.pendingName.textContent = user.displayName || user.email || "Signed in user";
    showState(ui.statePending);
    return;
  }

  currentUserAccess = userSnap.data();

  if (currentUserAccess.approved !== true) {
    ui.pendingPhoto.src = user.photoURL || "";
    ui.pendingName.textContent = user.displayName || user.email || "Signed in user";
    showState(ui.statePending);
    return;
  }

  const assignedClass = currentUserAccess.class;
  if (!assignedClass) {
    showState(ui.stateLocked);
    return;
  }

  ui.dashUserPhoto.src = user.photoURL || "";
  ui.dashUserName.textContent = user.displayName || user.email || "Approved student";
  ui.welcomeNote.textContent = `Hey ${user.displayName?.split(" ")[0] || "student"}, you are viewing`;
  ui.seriesChip.innerHTML = `<strong>âœ“</strong><span>${assignedClass} Test Series Dashboard</span>`;

  showState(ui.stateDashboard);
  await loadSubjects(assignedClass);
}

function bindModeFilters() {
  ui.modeFilters.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMode = button.dataset.mode;
      ui.modeFilters.querySelectorAll("[data-mode]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      if (currentSubjectId) renderSubject(currentSubjectId);
    });
  });
}

function bindChartFilters() {
  ui.chartFilters.querySelectorAll("[data-chart]").forEach((button) => {
    button.addEventListener("click", () => {
      activeChart = button.dataset.chart;
      ui.chartFilters.querySelectorAll("[data-chart]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      if (currentSubjectId) {
        const chapters = chaptersBySubject.get(currentSubjectId) || [];
        renderGraph(filterChaptersByMode(chapters).length ? filterChaptersByMode(chapters) : chapters);
      }
    });
  });
}

ui.googleSignInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error(error);
    alert("Google sign-in failed. Please check that Google Authentication is enabled in Firebase.");
  }
});

[ui.pendingSignOut, ui.dashSignOut, ui.lockedSignOut].forEach((node) => {
  node.addEventListener("click", async () => {
    await signOut(auth);
  });
});

bindModeFilters();
bindChartFilters();

onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      currentUserAccess = null;
      currentClass = "";
      currentSubjectId = "";
      showState(ui.stateSignIn);
      return;
    }

    showState(ui.stateLoading);
    try {
      await loadUserDashboard(user);
    } catch (error) {
      console.error(error);
      showState(ui.stateSignIn);
      const details = error?.message || "Unknown error";
      alert(`Could not load dashboard data: ${details}`);
    }
  },
  (error) => {
    console.error(error);
    currentUserAccess = null;
    currentClass = "";
    currentSubjectId = "";
    showState(ui.stateSignIn);
    alert("Firebase authentication could not be initialized. Please check authorized domains and browser privacy settings.");
  }
);




