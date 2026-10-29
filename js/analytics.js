
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let assignments = [];
let unsubscribeAssignments = null;
let charts = {};
let isLoaded = false;

const COLORS = {
  purple: "#8b5cf6",
  cyan: "#22d3ee",
  green: "#34d399",
  pink: "#f472b6",
  amber: "#fbbf24",
  red: "#fb7185",
  text: "#a4b2d1",
  grid: "rgba(255,255,255,0.07)"
};

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showMessage(message, type = "error") {
  const element = $("analyticsMessage");
  element.textContent = message;
  element.className = `analytics-message ${type}`;
}

function createElement(tag, className, content) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;

  return element;
}

function calculateAnalytics(tasks) {
  const today = localDateString();

  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;

  const pendingTasks = tasks.filter((task) => !task.completed);

  const overdueTasks = pendingTasks.filter(
    (task) => task.deadline < today
  );

  const dueToday = pendingTasks.filter(
    (task) => task.deadline === today
  );

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateString(tomorrowDate);

  const dueTomorrow = pendingTasks.filter(
    (task) => task.deadline === tomorrow
  );

  const later = pendingTasks.filter(
    (task) => task.deadline > tomorrow
  );

  const priority = {
    High: 0,
    Medium: 0,
    Low: 0
  };

  const subjectMap = new Map();

  tasks.forEach((task) => {
    if (Object.hasOwn(priority, task.priority)) {
      priority[task.priority]++;
    }

    const subjectName =
      typeof task.subject === "string" && task.subject.trim()
        ? task.subject.trim()
        : "Uncategorized";

    const subjectKey = subjectName.toLocaleLowerCase("en");

    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, {
        name: subjectName,
        total: 0,
        completed: 0,
        pending: 0
      });
    }

    const subject = subjectMap.get(subjectKey);

    subject.total++;

    if (task.completed) {
      subject.completed++;
    } else {
      subject.pending++;
    }
  });

  const subjects = [...subjectMap.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );

  const completionRate = total === 0
    ? 0
    : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    pending,
    overdue: overdueTasks.length,
    dueToday: dueToday.length,
    dueTomorrow: dueTomorrow.length,
    later: later.length,
    completionRate,
    priority,
    subjects,
    overdueTasks,
    pendingTasks
  };
}

function animateNumber(element, target, suffix = "") {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (reducedMotion) {
    element.textContent = `${target}${suffix}`;
    return;
  }

  const startValue = Number.parseInt(element.textContent, 10) || 0;
  const duration = 550;
  const startTime = performance.now();

  const animationId = (element._animationId || 0) + 1;
  element._animationId = animationId;

  function step(now) {
    if (element._animationId !== animationId) return;

    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(
      startValue + (target - startValue) * eased
    );

    element.textContent = `${value}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function renderStatistics(data) {
  animateNumber($("totalAssignments"), data.total);
  animateNumber($("completionRate"), data.completionRate, "%");
  animateNumber($("pendingAssignments"), data.pending);
  animateNumber($("overdueAssignments"), data.overdue);

  animateNumber($("deadlineOverdue"), data.overdue);
  animateNumber($("deadlineToday"), data.dueToday);
  animateNumber($("deadlineTomorrow"), data.dueTomorrow);
  animateNumber($("deadlineUpcoming"), data.later);

  $("completionBig").textContent = `${data.completionRate}%`;

  if (data.total === 0) {
    $("completionInsight").textContent =
      "Add your first assignment to begin tracking your progress.";
  } else if (data.completionRate === 100) {
    $("completionInsight").textContent =
      "Excellent! All tracked assignments are completed.";
  } else if (data.completionRate >= 50) {
    $("completionInsight").textContent =
      "Great progress! Keep completing your remaining tasks.";
  } else {
    $("completionInsight").textContent =
      "Every completed assignment brings you closer to your goal.";
  }
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches ? 0 : 650
    },
    plugins: {
      legend: {
        labels: {
          color: COLORS.text,
          usePointStyle: true,
          padding: 15,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: "#11172f",
        titleColor: "#ffffff",
        bodyColor: "#cbd5e1",
        borderColor: "#37415f",
        borderWidth: 1
      }
    }
  };
}

function replaceChart(key, canvasId, config) {
  if (charts[key]) {
    charts[key].destroy();
  }

  charts[key] = new window.Chart($(canvasId), config);
}

function renderCompletionChart(data) {
  const options = baseChartOptions();

  options.cutout = "76%";
  options.plugins.legend.display = false;

  replaceChart("completion", "completionChart", {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending"],
      datasets: [{
        data: [data.completed, data.pending],
        backgroundColor: [COLORS.purple, COLORS.cyan],
        borderColor: "#151b36",
        borderWidth: 4,
        hoverOffset: 7
      }]
    },
    options
  });
}

function renderPriorityChart(data) {
  const options = baseChartOptions();

  options.plugins.legend.display = false;

  options.scales = {
    x: {
      ticks: { color: COLORS.text, precision: 0 },
      grid: { color: COLORS.grid },
      beginAtZero: true
    },
    y: {
      ticks: { color: COLORS.text },
      grid: { display: false }
    }
  };

  replaceChart("priority", "priorityChart", {
    type: "bar",
    data: {
      labels: ["High", "Medium", "Low"],
      datasets: [{
        label: "Assignments",
        data: [
          data.priority.High,
          data.priority.Medium,
          data.priority.Low
        ],
        backgroundColor: [
          COLORS.red,
          COLORS.amber,
          COLORS.green
        ],
        borderRadius: 9,
        maxBarThickness: 55
      }]
    },
    options
  });
}

function renderSubjectChart(data) {
  const chartContainer = document.querySelector(
    ".subject-chart-container"
  );

  const chartHeight = Math.max(
    260,
    data.subjects.length * 43 + 70
  );

  chartContainer.style.height = `${Math.min(chartHeight, 1800)}px`;

  const options = baseChartOptions();

  options.indexAxis = "y";

  options.scales = {
    x: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        color: COLORS.text,
        precision: 0
      },
      grid: { color: COLORS.grid }
    },
    y: {
      stacked: true,
      ticks: {
        color: COLORS.text,
        font: { size: 11 }
      },
      grid: { display: false }
    }
  };

  replaceChart("subject", "subjectChart", {
    type: "bar",
    data: {
      labels: data.subjects.map((subject) => subject.name),
      datasets: [
        {
          label: "Completed",
          data: data.subjects.map((subject) => subject.completed),
          backgroundColor: COLORS.purple,
          borderRadius: 5,
          maxBarThickness: 28
        },
        {
          label: "Pending",
          data: data.subjects.map((subject) => subject.pending),
          backgroundColor: COLORS.cyan,
          borderRadius: 5,
          maxBarThickness: 28
        }
      ]
    },
    options
  });
}

function renderDeadlineChart(data) {
  const options = baseChartOptions();

  options.plugins.legend.display = false;

  options.scales = {
    x: {
      ticks: { color: COLORS.text },
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      ticks: { color: COLORS.text, precision: 0 },
      grid: { color: COLORS.grid }
    }
  };

  replaceChart("deadline", "deadlineChart", {
    type: "bar",
    data: {
      labels: ["Overdue", "Today", "Tomorrow", "Later"],
      datasets: [{
        label: "Pending Assignments",
        data: [
          data.overdue,
          data.dueToday,
          data.dueTomorrow,
          data.later
        ],
        backgroundColor: [
          COLORS.red,
          COLORS.amber,
          COLORS.cyan,
          COLORS.purple
        ],
        borderRadius: 7,
        maxBarThickness: 48
      }]
    },
    options
  });
}

function renderSubjectBreakdown(data) {
  const container = $("subjectBreakdown");
  container.replaceChildren();

  if (data.subjects.length === 0) {
    container.append(
      createElement(
        "div",
        "analytics-empty",
        "No subject data yet. Add assignments to see your performance."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();

  data.subjects.forEach((subject) => {
    const percentage = Math.round(
      (subject.completed / subject.total) * 100
    );

    const card = createElement("div", "subject-item");
    const header = createElement("div", "subject-item-header");

    const name = createElement("strong", "", subject.name);
    const percent = createElement("span", "", `${percentage}%`);

    header.append(name, percent);

    const track = createElement("div", "subject-progress-track");
    const fill = createElement("div", "subject-progress-fill");

    fill.style.width = `${percentage}%`;
    track.append(fill);

    const details = createElement(
      "p",
      "",
      `${subject.completed} completed • ${subject.pending} pending • ${subject.total} total`
    );

    card.append(header, track, details);
    fragment.append(card);
  });

  container.append(fragment);
}

function addInsight(container, icon, title, description) {
  const card = createElement("div", "insight-card");
  const iconElement = createElement("div", "insight-icon", icon);
  const content = createElement("div", "insight-text");

  content.append(
    createElement("strong", "", title),
    createElement("p", "", description)
  );

  card.append(iconElement, content);
  container.append(card);
}

function renderInsights(data) {
  const container = $("insightList");
  container.replaceChildren();

  if (data.total === 0) {
    addInsight(
      container,
      "✦",
      "Start Your Journey",
      "Add assignments to unlock personalized performance insights."
    );
    return;
  }

  if (data.overdue > 0) {
    addInsight(
      container,
      "⚠",
      "Overdue Work Needs Attention",
      `${data.overdue} pending assignment(s) have passed their deadlines. Review these tasks first.`
    );
  } else {
    addInsight(
      container,
      "✓",
      "No Overdue Assignments",
      "Great! You currently have no pending overdue assignments."
    );
  }

  if (data.dueToday > 0 || data.dueTomorrow > 0) {
    addInsight(
      container,
      "◷",
      "Upcoming Deadlines",
      `${data.dueToday} assignment(s) are due today and ${data.dueTomorrow} tomorrow. Plan your study time carefully.`
    );
  }

  if (data.completionRate === 100) {
    addInsight(
      container,
      "★",
      "All Tasks Completed",
      "You have completed every assignment currently in your workspace."
    );
  } else {
    addInsight(
      container,
      "▥",
      "Your Completion Progress",
      `You have completed ${data.completed} out of ${data.total} assignments (${data.completionRate}%).`
    );
  }

  if (data.subjects.length > 0) {
    const subjectWithMostPending = [...data.subjects].sort(
      (a, b) => b.pending - a.pending
    )[0];

    if (subjectWithMostPending.pending > 0) {
      addInsight(
        container,
        "✦",
        "Subject Focus",
        `${subjectWithMostPending.name} has ${subjectWithMostPending.pending} pending assignment(s), the highest pending count among your subjects.`
      );
    }
  }
}

function renderAnalytics() {
  const data = calculateAnalytics(assignments);

  renderStatistics(data);
  renderSubjectBreakdown(data);
  renderInsights(data);

  if (typeof window.Chart !== "function") {
    showMessage(
      "Statistics loaded, but charts could not start. Check your internet connection and reload."
    );
    return;
  }

  renderCompletionChart(data);
  renderPriorityChart(data);
  renderSubjectChart(data);
  renderDeadlineChart(data);

  showMessage("");
}

function subscribeToAssignments(user) {
  if (unsubscribeAssignments) {
    unsubscribeAssignments();
    unsubscribeAssignments = null;
  }

  isLoaded = false;
  showMessage("Loading your analytics...", "success");

  unsubscribeAssignments = onSnapshot(
    collection(db, "users", user.uid, "assignments"),
    (snapshot) => {
      if (auth.currentUser?.uid !== user.uid) return;

      assignments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      isLoaded = true;
      renderAnalytics();
    },
    (error) => {
      console.error("Analytics Firestore error:", error);
      showMessage(
        "Unable to load analytics. Check your connection and Firestore permissions."
      );
    }
  );
}

function initializePage() {
  $("analyticsDate").textContent = new Date().toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );

  $("footerYear").textContent = new Date().getFullYear();

  $("menuToggle").addEventListener("click", () => {
    const isOpen = $("sidebar").classList.toggle("open");
    $("menuToggle").setAttribute("aria-expanded", String(isOpen));
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      currentUser = null;
      assignments = [];
      isLoaded = false;

      if (unsubscribeAssignments) {
        unsubscribeAssignments();
        unsubscribeAssignments = null;
      }

      Object.values(charts).forEach((chart) => chart.destroy());
      charts = {};
      return;
    }

    currentUser = user;

    const name = user.displayName || "Student";

    $("sidebarName").textContent = name;
    $("sidebarAvatar").textContent = name.charAt(0).toUpperCase();
    $("topbarAvatar").textContent = name.charAt(0).toUpperCase();

    subscribeToAssignments(user);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePage);
} else {
  initializePage();
}
