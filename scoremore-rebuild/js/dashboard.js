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
  stateDashboard: document.getElementById("stateDashboard"),
  googleSignInBtn: document.getElementById("googleSignInBtn"),
  pendingSignOut: document.getElementById("pendingSignOut"),
  dashSignOut: document.getElementById("dashSignOut"),
  pendingPhoto: document.getElementById("pendingPhoto"),
  pendingName: document.getElementById("pendingName"),
  dashUserPhoto: document.getElementById("dashUserPhoto"),
  dashUserName: document.getElementById("dashUserName"),
  classMenu: document.getElementById("classMenu"),
  dashClassTitle: document.getElementById("dashClassTitle"),
  dashClassSub: document.getElementById("dashClassSub"),
  subjectTabs: document.getElementById("subjectTabs"),
  pdfContainer: document.getElementById("pdfContainer")
};

let currentUserAccess = null;
let currentClass = "";

function showState(activeState) {
  [ui.stateLoading, ui.stateSignIn, ui.statePending, ui.stateDashboard].forEach((stateNode) => {
    stateNode.style.display = stateNode === activeState ? "" : "none";
  });
}

function safeText(value, fallback = "-") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function renderEmpty(title, text) {
  ui.pdfContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">PDF</div>
      <h4>${title}</h4>
      <p>${text}</p>
    </div>
  `;
}

function renderClassMenu(className) {
  ui.classMenu.innerHTML = `<button class="class-btn" type="button">${className}</button>`;
}

async function loadSubjects(className) {
  currentClass = className;
  ui.dashClassTitle.textContent = `${className} Test Papers`;
  ui.dashClassSub.textContent = "Select a subject to browse chapter-wise tests and answer key availability.";
  ui.subjectTabs.style.display = "flex";
  ui.pdfContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading subjects...</div>';

  try {
    const subjectsQuery = query(collection(db, scoreMoreCollections.testSeries, className, "subjects"), orderBy("order", "asc"));
    const subjectsSnap = await getDocs(subjectsQuery);
    const subjects = subjectsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (!subjects.length) {
      ui.subjectTabs.innerHTML = "";
      renderEmpty("No subjects yet", "This class is approved, but no subjects have been published yet.");
      return;
    }

    ui.subjectTabs.innerHTML = subjects.map((subject, index) => `
      <button class="subj-tab${index === 0 ? " active" : ""}" type="button" data-subject="${subject.id}">
        ${subject.label || subject.id}
      </button>
    `).join("");

    ui.subjectTabs.querySelectorAll(".subj-tab").forEach((button) => {
      button.addEventListener("click", async () => {
        ui.subjectTabs.querySelectorAll(".subj-tab").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        await loadChapters(className, button.dataset.subject);
      });
    });

    await loadChapters(className, subjects[0].id);
  } catch (error) {
    console.error(error);
    renderEmpty("Could not load subjects", "Please check Firestore indexes, rules, and subject documents.");
  }
}

function answerKeyAllowed(chapter) {
  if (!chapter.answerKeyUrl) return false;
  if (chapter.answerKeyLocked === false) return true;
  return currentUserAccess?.answerKeysUnlocked === true;
}

function chapterCard(chapter) {
  const canOpenAnswerKey = answerKeyAllowed(chapter);
  const answerKeyButton = chapter.answerKeyUrl
    ? canOpenAnswerKey
      ? `<a href="${chapter.answerKeyUrl}" target="_blank" rel="noreferrer" class="pdf-btn">Answer Key</a>`
      : `<span class="pdf-btn locked">Answer Key Locked</span>`
    : "";

  return `
    <div class="pdf-item">
      <div class="pdf-icon">PDF</div>
      <div class="pdf-info">
        <div class="pdf-title">${safeText(chapter.title, chapter.id)}</div>
        <div class="pdf-meta">
          <span>${safeText(chapter.questions)} questions</span>
          <span>${safeText(chapter.marks)} marks</span>
          <span>${safeText(chapter.duration)} mins</span>
          <span>Added: ${safeText(chapter.addedDate)}</span>
        </div>
      </div>
      <div class="pdf-actions">
        ${answerKeyButton}
        <a href="${chapter.pdfUrl}" target="_blank" rel="noreferrer" class="pdf-btn primary">Open PDF</a>
      </div>
    </div>
  `;
}

async function loadChapters(className, subjectId) {
  ui.pdfContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading chapter papers...</div>';

  try {
    const chaptersQuery = query(collection(db, scoreMoreCollections.testSeries, className, "subjects", subjectId, "chapters"), orderBy("order", "asc"));
    const chapterSnap = await getDocs(chaptersQuery);
    const chapters = chapterSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (!chapters.length) {
      renderEmpty("No chapter papers yet", "This subject exists, but no chapter PDFs are published yet.");
      return;
    }

    ui.pdfContainer.innerHTML = `<div class="pdf-list">${chapters.map(chapterCard).join("")}</div>`;
  } catch (error) {
    console.error(error);
    renderEmpty("Could not load chapter papers", "Please check the chapter collection structure and Firestore rules.");
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
    showState(ui.stateDashboard);
    ui.dashUserPhoto.src = user.photoURL || "";
    ui.dashUserName.textContent = user.displayName || user.email || "Approved user";
    renderClassMenu("No class assigned");
    ui.subjectTabs.style.display = "none";
    renderEmpty("No class assigned", "This account is approved, but no class has been assigned in Firestore.");
    return;
  }

  ui.dashUserPhoto.src = user.photoURL || "";
  ui.dashUserName.textContent = user.displayName || user.email || "Approved user";
  renderClassMenu(assignedClass);
  showState(ui.stateDashboard);
  await loadSubjects(assignedClass);
}

ui.googleSignInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error(error);
    alert("Google sign-in failed. Please check that Google Authentication is enabled in Firebase.");
  }
});

[ui.pendingSignOut, ui.dashSignOut].forEach((node) => {
  node.addEventListener("click", async () => {
    await signOut(auth);
  });
});

onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      currentUserAccess = null;
      currentClass = "";
      showState(ui.stateSignIn);
      return;
    }

    showState(ui.stateLoading);
    try {
      await loadUserDashboard(user);
    } catch (error) {
      console.error(error);
      showState(ui.stateSignIn);
      alert("Could not load dashboard data. Please verify Firebase config, Firestore rules, and your data structure.");
    }
  },
  (error) => {
    console.error(error);
    currentUserAccess = null;
    currentClass = "";
    showState(ui.stateSignIn);
    alert("Firebase authentication could not be initialized. Please check authorized domains and browser privacy settings.");
  }
);
