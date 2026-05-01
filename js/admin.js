import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { firebaseConfig, scoreMoreCollections } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ui = {
  adminLoading: document.getElementById("adminLoading"),
  adminSignIn: document.getElementById("adminSignIn"),
  adminDenied: document.getElementById("adminDenied"),
  adminConsole: document.getElementById("adminConsole"),
  adminGoogleSignIn: document.getElementById("adminGoogleSignIn"),
  adminDeniedSignOut: document.getElementById("adminDeniedSignOut"),
  adminSignOut: document.getElementById("adminSignOut"),
  adminEmail: document.getElementById("adminEmail"),
  adminRole: document.getElementById("adminRole"),
  pendingCount: document.getElementById("pendingCount"),
  subjectCount: document.getElementById("subjectCount"),
  chapterCount: document.getElementById("chapterCount"),
  requestsContainer: document.getElementById("requestsContainer"),
  libraryContainer: document.getElementById("libraryContainer"),
  uploadForm: document.getElementById("uploadForm")
};

function showState(node) {
  [ui.adminLoading, ui.adminSignIn, ui.adminDenied, ui.adminConsole].forEach((item) => {
    item.style.display = item === node ? "" : "none";
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderRequests(users) {
  ui.pendingCount.textContent = String(users.length);

  if (!users.length) {
    ui.requestsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">OK</div>
        <h4>No pending requests</h4>
        <p>All current student accounts are already approved.</p>
      </div>
    `;
    return;
  }

  ui.requestsContainer.innerHTML = users.map((item) => `
    <article class="request-card">
      <div class="request-top">
        <div>
          <div class="request-name">${item.displayName || "Unnamed student"}</div>
          <div class="request-meta">${item.email || item.id}<br/>Requested class: ${item.class || item.requestedClass || "Not set"}</div>
        </div>
        <span class="tag">Pending</span>
      </div>
      <div class="request-tags">
        <span>Answer Keys ${item.answerKeysUnlocked ? "Unlocked" : "Locked"}</span>
        <span>${item.requestedSubjects || "Subjects not noted"}</span>
      </div>
      <div class="request-actions">
        <button class="btn btn-primary" type="button" data-approve="${item.id}" data-class="${item.class || item.requestedClass || ""}">Approve</button>
        <button class="btn btn-outline-dark" type="button" data-lock="${item.id}">Keep Pending</button>
      </div>
    </article>
  `).join("");

  ui.requestsContainer.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.approve;
      const assignedClass = button.dataset.class;
      if (!assignedClass) {
        alert("This user needs a class field before approval.");
        return;
      }
      await updateDoc(doc(db, scoreMoreCollections.users, userId), {
        approved: true,
        class: assignedClass
      });
      await loadAdminData();
    });
  });
}

function renderLibrary(entries) {
  ui.subjectCount.textContent = String(new Set(entries.map((entry) => `${entry.className}:${entry.subjectId}`)).size);
  ui.chapterCount.textContent = String(entries.length);

  if (!entries.length) {
    ui.libraryContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">LIB</div>
        <h4>No chapters published yet</h4>
        <p>Use the publish form to add the first subject chapter.</p>
      </div>
    `;
    return;
  }

  ui.libraryContainer.innerHTML = entries.slice(0, 10).map((entry) => `
    <article class="library-card">
      <h4>${entry.title}</h4>
      <p>${entry.className} • ${entry.subjectLabel || entry.subjectId}</p>
      <div class="library-meta">
        <span>${entry.format || "pdf"}</span>
        <span>${entry.deliveryStatus || "live"}</span>
        <span>${entry.questions || 0} questions</span>
      </div>
    </article>
  `).join("");
}

async function loadPublishedLibrary() {
  const classNames = ["Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
  const entries = [];

  for (const className of classNames) {
    const subjectSnap = await getDocs(collection(db, scoreMoreCollections.testSeries, className, "subjects"));
    for (const subjectDoc of subjectSnap.docs) {
      const subjectData = subjectDoc.data();
      const chapterSnap = await getDocs(collection(db, scoreMoreCollections.testSeries, className, "subjects", subjectDoc.id, "chapters"));
      chapterSnap.docs.forEach((chapterDoc) => {
        entries.push({
          className,
          subjectId: subjectDoc.id,
          subjectLabel: subjectData.label,
          id: chapterDoc.id,
          ...chapterDoc.data()
        });
      });
    }
  }

  renderLibrary(entries);
}

async function loadAdminData() {
  const pendingQuery = query(collection(db, scoreMoreCollections.users), where("approved", "==", false));
  const pendingSnap = await getDocs(pendingQuery);
  const pendingUsers = pendingSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderRequests(pendingUsers);
  await loadPublishedLibrary();
}

ui.adminGoogleSignIn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error(error);
    alert("Google sign-in failed for admin access.");
  }
});

[ui.adminDeniedSignOut, ui.adminSignOut].forEach((node) => {
  node.addEventListener("click", async () => {
    await signOut(auth);
  });
});

ui.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const className = document.getElementById("uploadClass").value;
  const subjectId = document.getElementById("uploadSubject").value.trim();
  const subjectLabel = document.getElementById("uploadSubjectLabel").value.trim() || subjectId;
  const title = document.getElementById("uploadTitle").value.trim();
  const order = Number(document.getElementById("uploadOrder").value || 0);
  const format = document.getElementById("uploadMode").value;
  const deliveryStatus = document.getElementById("uploadStatus").value;
  const questions = Number(document.getElementById("uploadQuestions").value || 0);
  const marks = Number(document.getElementById("uploadMarks").value || 0);
  const duration = Number(document.getElementById("uploadDuration").value || 0);
  const shortLabel = document.getElementById("uploadShortLabel").value.trim();
  const pdfUrl = document.getElementById("uploadPdfUrl").value.trim();
  const testUrl = document.getElementById("uploadTestUrl").value.trim();
  const answerKeyUrl = document.getElementById("uploadAnswerKeyUrl").value.trim();
  const summary = document.getElementById("uploadSummary").value.trim();

  if (!className || !subjectId || !title || !order) {
    alert("Please fill class, subject, title, and chapter order.");
    return;
  }

  const normalizedSubject = slugify(subjectId);
  const subjectDocId = normalizedSubject || subjectId;
  const chapterDocId = slugify(title) || `chapter-${Date.now()}`;

  await setDoc(
    doc(db, scoreMoreCollections.testSeries, className, "subjects", subjectDocId),
    {
      label: subjectLabel,
      order: 1
    },
    { merge: true }
  );

  await setDoc(doc(db, scoreMoreCollections.testSeries, className, "subjects", subjectDocId, "chapters", chapterDocId), {
    title,
    order,
    format,
    deliveryStatus,
    questions,
    marks,
    duration,
    shortLabel,
    pdfUrl,
    testUrl,
    answerKeyUrl,
    answerKeyLocked: true,
    summary,
    addedDate: new Date().toISOString().slice(0, 10)
  });

  ui.uploadForm.reset();
  alert("Chapter published successfully.");
  await loadAdminData();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showState(ui.adminSignIn);
    return;
  }

  showState(ui.adminLoading);

  try {
    const adminSnap = await getDoc(doc(db, scoreMoreCollections.adminUsers, user.uid));
    if (!adminSnap.exists() || adminSnap.data().active !== true) {
      showState(ui.adminDenied);
      return;
    }

    ui.adminEmail.textContent = user.email || user.displayName || "Admin";
    ui.adminRole.textContent = adminSnap.data().role || "Admin";
    showState(ui.adminConsole);
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showState(ui.adminDenied);
    alert("Could not load the admin console. Check Firestore rules and adminUsers setup.");
  }
});
