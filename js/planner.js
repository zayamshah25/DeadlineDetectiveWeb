
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let assignments = [];
let unsubscribeAssignments = null;
let currentPlan = null;
let saving = false;

const BREAK_MINUTES = 15;

const priorityWeight = {
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

function minutesFromTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const hours24 = Math.floor(minutes / 60) % 24;
  const minutesPart = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(minutesPart).padStart(2, "0")} ${suffix}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;

  return `${hours}h ${remainder}m`;
}

function showMessage(message, type = "error") {
  const element = $("plannerMessage");
  element.textContent = message;
  element.className = `planner-message ${type}`;
}

function sortedPendingTasks() {
  return assignments
    .filter((task) => !task.completed)
    .sort((a, b) => {
      const deadlineComparison = a.deadline.localeCompare(b.deadline);

      if (deadlineComparison !== 0) return deadlineComparison;

      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
}

function generatePlan(tasks, studyHours, startTime, maxSession) {
  const budget = Math.round(studyHours * 60);
  const startMinutes = minutesFromTime(startTime);

  let remainingBudget = budget;
  let currentMinutes = startMinutes;
  let studyMinutes = 0;
  let breakMinutes = 0;

  const slots = [];
  const remaining = [];
  const scheduledIds = new Set();

  for (const task of tasks) {
    const estimatedMinutes = Math.round(Number(task.hours) * 60);
    let taskMinutes = estimatedMinutes;

    while (taskMinutes > 0 && remainingBudget > 0) {
      const needsBreak = slots.length > 0;
      const breakLength = needsBreak ? BREAK_MINUTES : 0;

      const availableClockMinutes =
        1440 - currentMinutes - breakLength;

      const sessionLength = Math.min(
        taskMinutes,
        remainingBudget,
        maxSession,
        availableClockMinutes
      );

      if (sessionLength < 15) break;

      if (needsBreak) {
        slots.push({
          type: "break",
          title: "Recharge Break",
          start: currentMinutes,
          end: currentMinutes + BREAK_MINUTES,
          minutes: BREAK_MINUTES
        });

        currentMinutes += BREAK_MINUTES;
        breakMinutes += BREAK_MINUTES;
      }

      slots.push({
        type: "task",
        assignmentId: task.id,
        title: task.title,
        subject: task.subject,
        priority: task.priority,
        deadline: task.deadline,
        start: currentMinutes,
        end: currentMinutes + sessionLength,
        minutes: sessionLength
      });

      scheduledIds.add(task.id);
      currentMinutes += sessionLength;
      remainingBudget -= sessionLength;
      studyMinutes += sessionLength;
      taskMinutes -= sessionLength;
    }

    if (taskMinutes > 0) {
      remaining.push({
        assignmentId: task.id,
        title: task.title,
        subject: task.subject,
        priority: task.priority,
        deadline: task.deadline,
        remainingMinutes: taskMinutes
      });
    }
  }

  return {
    date: localDateString(),
    studyHours,
    startTime,
    maxSession,
    slots,
    remaining,
    studyMinutes,
    breakMinutes,
    freeMinutes: remainingBudget,
    scheduledCount: scheduledIds.size,
    endMinutes: currentMinutes
  };
}

function createElement(tag, className, content) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;

  return element;
}

function renderTimetable(plan) {
  const container = $("timetable");
  container.replaceChildren();

  if (plan.slots.length === 0) {
    container.append(
      createElement(
        "div",
        "empty-state",
        "No study sessions could fit in the selected time window."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  plan.slots.forEach((slot) => {
    const row = createElement("div", "timeline-slot");

    const time = createElement(
      "div",
      "timeline-time",
      `${formatTime(slot.start)} – ${formatTime(slot.end)}`
    );

    const card = createElement(
      "div",
      `timeline-card ${slot.type === "break" ? "break-card" : ""}`
    );

    const label = createElement(
      "span",
      "timeline-label",
      slot.type === "break"
        ? "RECOVERY TIME"
        : `${slot.priority.toUpperCase()} PRIORITY`
    );

    const title = createElement("h3", "", slot.title);

    const details = createElement(
      "p",
      "",
      slot.type === "break"
        ? `${slot.minutes} minutes to recharge`
        : `${slot.subject} • ${formatDuration(slot.minutes)} study session`
    );

    card.append(label, title, details);
    row.append(time, card);
    fragment.append(row);
  });

  container.append(fragment);
}

function renderRemaining(plan) {
  const container = $("remainingTasks");
  container.replaceChildren();

  if (plan.remaining.length === 0) {
    container.append(
      createElement(
        "div",
        "empty-state",
        "All pending work has been scheduled!"
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  plan.remaining.forEach((task) => {
    const item = createElement("div", "remaining-item");

    item.append(
      createElement("strong", "", task.title),
      createElement(
        "p",
        "",
        `${task.subject} • ${formatDuration(task.remainingMinutes)} remaining`
      )
    );

    fragment.append(item);
  });

  container.append(fragment);
}

function renderInsight(plan) {
  const overdue = sortedPendingTasks().filter(
    (task) => task.deadline < localDateString()
  );

  let insight = "";

  if (plan.slots.length === 0) {
    insight = "No sessions were scheduled. Try an earlier start time or adjust your study hours.";
  } else if (overdue.length > 0) {
    insight = `You have ${overdue.length} overdue assignment(s). Focus on urgent deadlines first and review your workload.`;
  } else if (plan.remaining.length > 0) {
    insight = "Your schedule is ready, but some work remains. Consider another study session tomorrow.";
  } else {
    insight = "Excellent! Your pending assignments fit into your available study schedule.";
  }

  $("studyInsight").textContent = insight;
}

function renderPlan(plan) {
  $("planResults").hidden = false;
  $("initialPlannerState").hidden = true;

  $("plannedHours").textContent = formatDuration(plan.studyMinutes);
  $("breakMinutes").textContent = formatDuration(plan.breakMinutes);
  $("freeHours").textContent = formatDuration(plan.freeMinutes);
  $("scheduledCount").textContent = plan.scheduledCount;

  const endTime = plan.slots.length
    ? formatTime(plan.endMinutes)
    : "No sessions";

  $("scheduleSummary").textContent =
    `Start: ${formatTime(minutesFromTime(plan.startTime))} | End: ${endTime} | ${plan.slots.length} timetable slots`;

  renderTimetable(plan);
  renderRemaining(plan);
  renderInsight(plan);
}

function readPlannerSettings() {
  const studyHours = Number($("studyHours").value);
  const startTime = $("startTime").value;
  const maxSession = Number($("sessionMinutes").value);

  if (
    !Number.isFinite(studyHours) ||
    studyHours < 0.25 ||
    studyHours > 24 ||
    !Number.isInteger(studyHours * 4)
  ) {
    throw new Error("Choose study hours in 15-minute increments, between 0.25 and 24.");
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw new Error("Select a valid start time.");
  }

  if (![30, 45, 60, 90, 120].includes(maxSession)) {
    throw new Error("Select a valid session length.");
  }

  return { studyHours, startTime, maxSession };
}

function buildCurrentPlan() {
  const settings = readPlannerSettings();

  currentPlan = generatePlan(
    sortedPendingTasks(),
    settings.studyHours,
    settings.startTime,
    settings.maxSession
  );

  renderPlan(currentPlan);
  $("savedPlanInfo").textContent = "";
}

$("plannerForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) {
    showMessage("Please sign in before generating a plan.");
    return;
  }

  try {
    buildCurrentPlan();
    showMessage("Your smart study plan is ready!", "success");
  } catch (error) {
    showMessage(error.message);
  }
});

$("savePlanButton").addEventListener("click", async () => {
  if (!currentUser || !currentPlan || saving) return;

  if (currentPlan.date !== localDateString()) {
    showMessage("The date has changed. Generate a new plan before saving.");
    return;
  }

  const button = $("savePlanButton");
  saving = true;
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const planRef = doc(
      db,
      "users",
      currentUser.uid,
      "studyPlans",
      currentPlan.date
    );

    await setDoc(planRef, {
      ...currentPlan,
      updatedAt: serverTimestamp()
    });

    showMessage("Study plan saved to Firebase!", "success");
    $("savedPlanInfo").textContent =
      "Your plan is securely stored in your account.";
  } catch (error) {
    console.error("Plan save error:", error);
    showMessage("Could not save plan. Check Firestore permissions.");
  } finally {
    saving = false;
    button.disabled = false;
    button.textContent = "Save Plan to Firebase";
  }
});

async function loadSavedPlan(user) {
  const date = localDateString();

  try {
    const snapshot = await getDoc(
      doc(db, "users", user.uid, "studyPlans", date)
    );

    if (!snapshot.exists() || auth.currentUser?.uid !== user.uid) return;

    const saved = snapshot.data();

    if (
      !Array.isArray(saved.slots) ||
      !Array.isArray(saved.remaining) ||
      typeof saved.studyHours !== "number" ||
      typeof saved.startTime !== "string" ||
      ![30, 45, 60, 90, 120].includes(saved.maxSession)
    ) return;

    $("studyHours").value = saved.studyHours;
    $("startTime").value = saved.startTime;
    $("sessionMinutes").value = saved.maxSession;

    currentPlan = saved;
    renderPlan(saved);

    $("savedPlanInfo").textContent =
      "Today's previously saved plan has been restored.";

    showMessage("Saved study plan loaded!", "success");
  } catch (error) {
    console.error("Saved plan load error:", error);
    showMessage("Could not restore your saved plan.");
  }
}

function subscribeToAssignments(user) {
  if (unsubscribeAssignments) unsubscribeAssignments();

  unsubscribeAssignments = onSnapshot(
    collection(db, "users", user.uid, "assignments"),
    (snapshot) => {
      assignments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      if (currentPlan) {
        $("savedPlanInfo").textContent =
          "Assignments may have changed. Regenerate to refresh the schedule.";
      }
    },
    (error) => {
      console.error("Assignments load error:", error);
      showMessage("Unable to load assignments from Firebase.");
    }
  );
}

$("menuToggle").addEventListener("click", () => {
  const isOpen = $("sidebar").classList.toggle("open");
  $("menuToggle").setAttribute("aria-expanded", String(isOpen));
});

$("plannerDate").textContent = new Date().toLocaleDateString(
  "en-US",
  { weekday: "long", month: "long", day: "numeric", year: "numeric" }
);

$("footerYear").textContent = new Date().getFullYear();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    assignments = [];
    currentPlan = null;

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
  await loadSavedPlan(user);
});
