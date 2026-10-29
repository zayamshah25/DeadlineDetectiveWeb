
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

let currentUser = null;
let assignments = [];
let unsubscribeAssignments = null;

const $ = (id) => document.getElementById(id);

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDaysUntil(deadline) {
  const [year, month, day] = deadline.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return Math.round((target - today) / 86400000);
}

function getDeadlineLabel(deadline) {
  const days = getDaysUntil(deadline);

  if (days < 0) return `Overdue by ${Math.abs(days)} day(s)`;
  if (days === 0) return "Due Today";
  if (days === 1) return "Due Tomorrow";

  return `Due in ${days} days`;
}

function getPriorityWeight(priority) {
  return { High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function sortAssignments(tasks) {
  return [...tasks].sort((a, b) => {
    const dateDifference = a.deadline.localeCompare(b.deadline);

    if (dateDifference !== 0) return dateDifference;

    return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
  });
}

function showDashboardMessage(message, type = "error", id = "dashboardMessage") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.className = `dashboard-message ${type}`;
}

function updateStats() {
  const total = assignments.length;
  const completed = assignments.filter((task) => task.completed).length;
  const pending = total - completed;

  const overdue = assignments.filter(
    (task) => !task.completed && getDaysUntil(task.deadline) < 0
  ).length;

  const percentage = total === 0
    ? 0
    : Math.round((completed / total) * 100);

  $("totalCount").textContent = total;
  $("pendingCount").textContent = pending;
  $("completedCount").textContent = completed;
  $("overdueCount").textContent = overdue;

  $("progressPercent").textContent = `${percentage}%`;
  $("progressRing").style.setProperty("--progress", `${percentage}%`);

  $("progressDescription").textContent = total === 0
    ? "Add your first assignment to begin tracking progress."
    : `${completed} of ${total} assignments completed. Keep going!`;
}

function createAssignmentElement(task) {
  const item = document.createElement("div");
  item.className = "assignment-item";

  const marker = document.createElement("div");
  marker.className = "assignment-marker";
  marker.textContent = "▤";

  const info = document.createElement("div");
  info.className = "assignment-info";

  const title = document.createElement("strong");
  title.textContent = task.title;

  const details = document.createElement("small");
  details.textContent =
    `${task.subject} • ${getDeadlineLabel(task.deadline)} • ${task.hours}h`;

  info.append(title, details);

  const priority = document.createElement("span");
  priority.className = `priority-pill priority-${task.priority.toLowerCase()}`;
  priority.textContent = task.priority;

  const completeButton = document.createElement("button");
  completeButton.className = "task-complete";
  completeButton.textContent = "✓ Complete";
  completeButton.setAttribute("aria-label", `Complete ${task.title}`);

  completeButton.addEventListener("click", async () => {
    if (!currentUser) return;

    completeButton.disabled = true;

    try {
      await updateDoc(
        doc(db, "users", currentUser.uid, "assignments", task.id),
        {
          completed: true,
          updatedAt: serverTimestamp()
        }
      );

      showDashboardMessage("Assignment completed!", "success");
    } catch (error) {
      console.error("Update error:", error);
      showDashboardMessage("Could not update the assignment.");
    } finally {
      completeButton.disabled = false;
    }
  });

  item.append(marker, info, priority, completeButton);

  return item;
}

function renderUpcoming() {
  const list = $("upcomingList");
  list.replaceChildren();

  const pendingTasks = sortAssignments(
    assignments.filter((task) => !task.completed)
  ).slice(0, 5);

  if (pendingTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No pending assignments. Add a task to get started!";
    list.appendChild(empty);
    return;
  }

  pendingTasks.forEach((task) => {
    list.appendChild(createAssignmentElement(task));
  });
}

function getUrgentTask() {
  return sortAssignments(
    assignments.filter((task) => !task.completed)
  )[0] || null;
}

function updateRescuePreview() {
  const urgentTask = getUrgentTask();

  if (!urgentTask) {
    $("rescueTitle").textContent = "You're All Caught Up!";
    $("rescueDescription").textContent =
      "Your most urgent task will appear here.";
    return;
  }

  $("rescueTitle").textContent = "Your Next Priority";
  $("rescueDescription").textContent =
    `${urgentTask.title} • ${getDeadlineLabel(urgentTask.deadline)}`;
}

function renderDashboard() {
  updateStats();
  renderUpcoming();
  updateRescuePreview();
}

function subscribeToAssignments(user) {
  if (unsubscribeAssignments) {
    unsubscribeAssignments();
    unsubscribeAssignments = null;
  }

  const assignmentsRef = collection(
    db,
    "users",
    user.uid,
    "assignments"
  );

  unsubscribeAssignments = onSnapshot(
    assignmentsRef,
    (snapshot) => {
      assignments = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }));

      showDashboardMessage("");
      renderDashboard();
    },
    (error) => {
      console.error("Firestore listener error:", error);
      showDashboardMessage(
        "Unable to load assignments. Check your connection and Firestore rules."
      );
    }
  );
}

function openModal() {
  $("assignmentModal").hidden = false;
  $("assignmentDeadline").value = getLocalDate();
  $("assignmentTitle").focus();
}

function closeModal() {
  $("assignmentModal").hidden = true;
  $("assignmentForm").reset();
  showDashboardMessage("", "error", "formMessage");
}

$("openAddModal").addEventListener("click", openModal);
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

$("assignmentModal").addEventListener("click", (event) => {
  if (event.target === $("assignmentModal")) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("assignmentModal").hidden) {
    closeModal();
  }
});

$("assignmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const title = $("assignmentTitle").value.trim();
  const subject = $("assignmentSubject").value.trim();
  const deadline = $("assignmentDeadline").value;
  const hours = Number($("assignmentHours").value);
  const priority = $("assignmentPriority").value;

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    && !Number.isNaN(new Date(`${deadline}T12:00:00`).getTime());

  if (
    title.length < 1 ||
    title.length > 120 ||
    subject.length < 1 ||
    subject.length > 80 ||
    !validDate ||
    !Number.isFinite(hours) ||
    hours < 0.25 ||
    hours > 200 ||
    !["High", "Medium", "Low"].includes(priority)
  ) {
    showDashboardMessage(
      "Please enter valid assignment details.",
      "error",
      "formMessage"
    );
    return;
  }

  const button = $("saveAssignmentButton");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    await addDoc(
      collection(db, "users", currentUser.uid, "assignments"),
      {
        title,
        subject,
        deadline,
        hours,
        priority,
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    closeModal();
    showDashboardMessage("Assignment saved successfully!", "success");

  } catch (error) {
    console.error("Save error:", error);
    showDashboardMessage(
      "Could not save assignment. Check Firestore permissions.",
      "error",
      "formMessage"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Save Assignment";
  }
});

$("rescueButton").addEventListener("click", () => {
  const task = getUrgentTask();

  if (!task) {
    showDashboardMessage("Add an assignment to use Rescue Mode.");
    return;
  }

  showDashboardMessage(
    `Focus next: ${task.title} (${task.priority} priority, ${getDeadlineLabel(task.deadline)}).`,
    "success"
  );

  $("upcomingList").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});

$("menuToggle").addEventListener("click", () => {
  const sidebar = $("sidebar");
  const isOpen = sidebar.classList.toggle("open");

  $("menuToggle").setAttribute("aria-expanded", String(isOpen));
});

$("todayDate").textContent = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

$("footerYear").textContent = new Date().getFullYear();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUser = null;
    assignments = [];

    if (unsubscribeAssignments) {
      unsubscribeAssignments();
      unsubscribeAssignments = null;
    }

    return;
  }

  currentUser = user;

  
const name = user.displayName || "Student";

$("studentName").textContent = name;
$("sidebarName").textContent = name;

// Avatar images are managed by user-avatar.js.
// Do not overwrite sidebarAvatar or topbarAvatar here.

subscribeToAssignments(user);

});
