// Shared study-plan logic. Pure functions only, so it is easy to test.

export const BREAK_MINUTES = 15
const DAY_MINUTES = 24 * 60
const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 }

export function isValidHours(value) {
  const hours = Number(value)
  return Number.isFinite(hours) && hours > 0 && hours <= 24
}

function toMinutes(hours) {
  return Math.round(Number(hours) * 60)
}

function parseStartTime(startTime) {
  const [h, m] = String(startTime).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

// 12-hour clock label. Minutes past midnight get a "(next day)" tag so a
// session that starts at night does not show a confusing "12:30 AM".
export function formatStudyTime(totalMinutes) {
  const dayOffset = Math.floor(totalMinutes / DAY_MINUTES)
  const inDay = ((totalMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(inDay / 60)
  const minutes = inDay % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  const label = `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`
  return dayOffset > 0 ? `${label} (next day)` : label
}

export function compareForPlan(a, b) {
  return (
    a.deadline.localeCompare(b.deadline) ||
    (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
  )
}

// Builds the whole plan in one pass: pick tasks, place breaks, count hours.
// Returns null when the inputs are invalid.
export function buildStudyPlan(assignments, availableHours, startTime) {
  if (!isValidHours(availableHours)) return null
  const startMinutes = parseStartTime(startTime)
  if (startMinutes === null) return null

  const totalMinutes = toMinutes(availableHours)
  const endLimit = startMinutes + totalMinutes

  const pending = assignments.filter(item => !item.completed).sort(compareForPlan)

  const timetable = []
  const plannedTasks = []
  const remainingTasks = []
  let cursor = startMinutes
  let studyMinutes = 0
  let breakMinutes = 0
  let lastTask = null

  for (const task of pending) {
    const duration = toMinutes(task.hours)
    // A break is only added when another task really follows it.
    const breakNeeded = lastTask ? BREAK_MINUTES : 0

    if (cursor + breakNeeded + duration > endLimit) {
      remainingTasks.push(task)
      continue
    }

    if (breakNeeded) {
      timetable.push({
        type: 'break',
        id: `break-${lastTask.id}`,
        start: formatStudyTime(cursor),
        end: formatStudyTime(cursor + breakNeeded),
      })
      cursor += breakNeeded
      breakMinutes += breakNeeded
    }

    timetable.push({
      type: 'task',
      id: task.id,
      title: task.title,
      subject: task.subject,
      start: formatStudyTime(cursor),
      end: formatStudyTime(cursor + duration),
      hours: Number(task.hours),
    })
    cursor += duration
    studyMinutes += duration
    plannedTasks.push(task)
    lastTask = task
  }

  const round2 = n => Math.round(n * 100) / 100
  const usedMinutes = studyMinutes + breakMinutes

  return {
    timetable,
    plannedTasks,
    remainingTasks,
    studyHours: round2(studyMinutes / 60),
    breakMinutes,
    // Study time plus breaks, so it matches the timetable.
    usedHours: round2(usedMinutes / 60),
    freeHours: round2((totalMinutes - usedMinutes) / 60),
  }
}
