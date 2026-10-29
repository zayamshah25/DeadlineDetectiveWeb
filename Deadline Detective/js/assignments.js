
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let assignments = [];
let editingId = null;
let unsubscribeAssignments = null;
let previousFocus = null;
let isSaving = false;

const priorityWeights = {
  High: 3,
  Medium: 2,
  Low: 1
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function daysUntil(deadline) {
  if (!isValidDate(deadline)) return 0;

  const [year, month, day] = deadline.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = new Date();

  const current = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round((target - current) / 86400000);
}

function deadlineStatus(task) {
  if (task.completed) {
    return { text: "Completed", className: "badge-completed" };
  }

  const days = daysUntil(task.deadline);

  if (days < 0) {
    return {
      text: `Overdue by ${Math.abs(days)} day(s)`,
      className: "badge-overdue"
    };
  }

  if (days === 0) {
    return { text: "Due Today", className: "badge-today" };
  }

  if (days === 1) {
    return { text: "Due Tomorrow", className: "badge-today" };
  }

  return {
    text: `Due in ${days} days`,
    className: "badge-upcoming"
  };
}

function formatDate(value) {
  if (!isValidDate(value)) return "Invalid date";

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
}

function showMessage(message, type = "error", target = "assignmentMessage") {
  const element = $(target);
  if (!element) return;

  element.textContent = message;
  element.className = `manager-message ${type}`;
}

function updateSummary() {
  const total = assignments.length;
  const completed = assignments.filter((task) => task.completed).length;
  const pending = total - completed;

  const overdue = assignments.filter(
    (task) => !task.completed && daysUntil(task.deadline) < 0
  ).length;

  $("allCount").textContent = total;
  $("pendingCount").textContent = pending;
  $("completedCount").textContent = completed;
  $("overdueCount").textContent = overdue;
}

function filteredAssignments() {
  const search = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const priority = $("priorityFilter").value;
  const sort = $("sortFilter").value;

  const filtered = assignments.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search) ||
      task.subject.toLowerCase().includes(search);

    const matchesPriority =
      priority === "All" || task.priority === priority;

    let matchesStatus = true;

    if (status === "Completed") {
      matchesStatus = task.completed;
    } else if (status === "Pending") {
      matchesStatus = !task.completed;
    } else if (status === "Overdue") {
      matchesStatus = !task.completed && daysUntil(task.deadline) < 0;
    }

    return matchesSearch && matchesPriority && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "priority") {
      return (priorityWeights[b.priority] - priorityWeights[a.priority])
        || a.deadline.localeCompare(b.deadline);
    }

    if (sort === "newest" || sort === "oldest") {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;

      return sort === "newest" ? bTime - aTime : aTime - bTime;
    }

    return a.deadline.localeCompare(b.deadline)
      || priorityWeights[b.priority] - priorityWeights[a.priority];
  });

  return filtered;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function makeBadge(text, className) {
  return makeElement("span", `task-badge ${className}`, text);
}

function makeAction(label, className, handler) {
  const button = makeElement(
    "button",
    `task-action ${className}`,
    label
  );

  button.type = "button";

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await handler();
    } catch (error) {
      console.error("Assignment action failed:", error);
      showMessage("Unable to update the assignment. Please try again.");
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

function createTaskCard(task) {
  const card = makeElement(
    "article",
    `manager-task ${task.completed ? "completed" : ""}`
  );

  const top = makeElement("div", "task-top");
  const main = makeElement("div", "task-main");
  const icon = makeElement("div", "task-icon", "▤");
  const info = makeElement("div", "task-info");

  const title = makeElement("h3", "manager-task-title", task.title);
  const subject = makeElement("p", "task-subject", task.subject);

  info.append(title, subject);
  main.append(icon, info);

  const badges = makeElement("div", "task-badges");
  const status = deadlineStatus(task);

  badges.append(
    makeBadge(task.priority, `badge-${task.priority.toLowerCase()}`),
    makeBadge(status.text, status.className)
  );

  top.append(main, badges);

  const bottom = makeElement("div", "task-bottom");
  const meta = makeElement("div", "task-meta");

  meta.append(
    makeElement("span", "", `◷ ${formatDate(task.deadline)}`),
    makeElement("span", "", `◈ ${task.hours} hours`)
  );

  const actions = makeElement("div", "task-actions");

  const toggleButton = makeAction(
    task.completed ? "↶ Undo" : "✓ Complete",
    "finish",
    () => toggleAssignment(task)
  );

  const editButton = makeAction(
    "✎ Edit",
    "",
    async () => openEditModal(task)
  );

  const deleteButton = makeAction(
    "× Delete",
    "delete",
    () => removeAssignment(task)
  );

  actions.append(toggleButton, editButton, deleteButton);
  bottom.append(meta, actions);
  card.append(top, bottom);

  return card;
}

function renderAssignments() {
  updateSummary();

  const list = $("assignmentCards");
  const results = filteredAssignments();

  list.replaceChildren();

  $("resultCount").textContent =
    `Showing ${results.length} of ${assignments.length} assignments`;

  if (results.length === 0) {
    const message = assignments.length === 0
      ? "No assignments yet. Create your first assignment!"
      : "No assignments match your search or filters.";

    list.append(makeElement("div", "manager-empty", message));
    return;
  }

  const fragment = document.createDocumentFragment();

  results.forEach((task) => {
    fragment.append(createTaskCard(task));
  });

  list.append(fragment);
}

function openModal() {
  previousFocus = document.activeElement;
  $("assignmentModal").hidden = false;
  document.body.style.overflow = "hidden";
  $("assignmentTitle").focus();
}

function closeModal() {
  if (isSaving) return;

  $("assignmentModal").hidden = true;
  document.body.style.overflow = "";
  $("assignmentForm").reset();
  editingId = null;
  showMessage("", "error", "formMessage");
  previousFocus?.focus?.();
}

function openCreateModal() {
  editingId = null;
  $("assignmentForm").reset();
  $("modalTitle").textContent = "New Assignment";
  $("saveAssignmentButton").textContent = "Save Assignment";
  $("assignmentDeadline").value = localDateString();
  openModal();
}

function openEditModal(task) {
  editingId = task.id;

  $("modalTitle").textContent = "Edit Assignment";
  $("saveAssignmentButton").textContent = "Update Assignment";

  $("assignmentTitle").value = task.title;
  $("assignmentSubject").value = task.subject;
  $("assignmentDeadline").value = task.deadline;
  $("assignmentHours").value = task.hours;
  $("assignmentPriority").value = task.priority;

  openModal();
}

function getFormData() {
  return {
    title: $("assignmentTitle").value.trim(),
    subject: $("assignmentSubject").value.trim(),
    deadline: $("assignmentDeadline").value,
    hours: Number($("assignmentHours").value),
    priority: $("assignmentPriority").value
  };
}

function validateAssignment(data) {
  if (data.title.length < 1 || data.title.length > 120) {
    return "Assignment title must be between 1 and 120 characters.";
  }

  if (data.subject.length < 1 || data.subject.length > 80) {
    return "Subject must be between 1 and 80 characters.";
  }

  if (!isValidDate(data.deadline)) {
    return "Please select a valid deadline.";
  }

  if (
    !Number.isFinite(data.hours) ||
    data.hours < 0.25 ||
    data.hours > 200
  ) {
    return "Estimated hours must be between 0.25 and 200.";
  }

  if (!["High", "Medium", "Low"].includes(data.priority)) {
    return "Please select a valid priority.";
  }

  return null;
}

async function saveAssignment(event) {
  event.preventDefault();

  if (!currentUser || isSaving) return;

  const data = getFormData();
  const validationError = validateAssignment(data);

  if (validationError) {
    showMessage(validationError, "error", "formMessage");
    return;
  }

  const button = $("saveAssignmentButton");
  const wasEditing = editingId !== null;
  const targetId = editingId;

  isSaving = true;
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    if (wasEditing) {
      await updateDoc(
        doc(db, "users", currentUser.uid, "assignments", targetId),
        {
          ...data,
          updatedAt: serverTimestamp()
        }
      );
    } else {
      await addDoc(
        collection(db, "users", currentUser.uid, "assignments"),
        {
          ...data,
          completed: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );
    }

    isSaving = false;
    closeModal();

    showMessage(
      wasEditing
        ? "Assignment updated successfully!"
        : "Assignment created successfully!",
      "success"
    );

  } catch (error) {
    console.error("Save assignment failed:", error);

    showMessage(
      "Could not save assignment. Check your connection and Firestore rules.",
      "error",
      "formMessage"
    );
  } finally {
    isSaving = false;
    button.disabled = false;
    button.textContent = wasEditing
      ? "Update Assignment"
      : "Save Assignment";
  }
}

async function toggleAssignment(task) {
  if (!currentUser) return;

  await updateDoc(
    doc(db, "users", currentUser.uid, "assignments", task.id),
    {
      completed: !task.completed,
      updatedAt: serverTimestamp()
    }
  );

  showMessage(
    task.completed
      ? "Assignment marked as pending."
      : "Assignment completed successfully!",
    "success"
  );
}

async function removeAssignment(task) {
  if (!currentUser) return;

  const confirmed = window.confirm(
    `Delete "${task.title}"? This action cannot be undone.`
  );

  if (!confirmed) return;

  await deleteDoc(
    doc(db, "users", currentUser.uid, "assignments", task.id)
  );

  showMessage("Assignment deleted successfully!", "success");
}

function subscribeToAssignments(user) {
  if (unsubscribeAssignments) {
    unsubscribeAssignments();
  }

  $("assignmentCards").replaceChildren(
    makeElement("div", "manager-empty", "Loading your assignments...")
  );

  unsubscribeAssignments = onSnapshot(
    collection(db, "users", user.uid, "assignments"),
    (snapshot) => {
      assignments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderAssignments();
    },
    (error) => {
      console.error("Firestore subscription failed:", error);
      showMessage("Unable to load assignments. Check Firestore permissions.");

      $("assignmentCards").replaceChildren(
        makeElement("div", "manager-empty", "Unable to load assignments.")
      );
    }
  );
}

$("openAssignmentModal").addEventListener("click", openCreateModal);
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);
$("assignmentForm").addEventListener("submit", saveAssignment);

$("assignmentModal").addEventListener("click", (event) => {
  if (event.target === $("assignmentModal")) closeModal();
});

document.addEventListener("keydown", (event) => {
  const modal = $("assignmentModal");

  if (modal.hidden) return;

  if (event.key === "Escape") {
    closeModal();
  }

  if (event.key === "Tab") {
    const focusable = [...modal.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
    )];

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

["searchInput", "statusFilter", "priorityFilter", "sortFilter"]
  .forEach((id) => {
    $(id).addEventListener(
      id === "searchInput" ? "input" : "change",
      renderAssignments
    );
  });

$("clearFilters").addEventListener("click", () => {
  $("searchInput").value = "";
  $("statusFilter").value = "All";
  $("priorityFilter").value = "All";
  $("sortFilter").value = "deadline";

  renderAssignments();
});

$("menuToggle").addEventListener("click", () => {
  const sidebar = $("sidebar");
  const isOpen = sidebar.classList.toggle("open");

  $("menuToggle").setAttribute("aria-expanded", String(isOpen));
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

  $("sidebarName").textContent = name;
  $("sidebarAvatar").textContent = name.charAt(0).toUpperCase();
  $("topbarAvatar").textContent = name.charAt(0).toUpperCase();

  subscribeToAssignments(user);
});
