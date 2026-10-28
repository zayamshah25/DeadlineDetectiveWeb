// Single source of truth for assignment lifecycle rules.
// Deadlines are stored as date-only (YYYY-MM-DD); a deadline ends at 23:59:59 local time that day.
export const DUE_SOON_HOURS = 24
const PRIORITY = { High: 3, Medium: 2, Low: 1 }

export function deadlineEnd(deadline) {
  const [y, m, d] = deadline.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export function getSection(item, now = new Date()) {
  if (item.completed) return 'completed'
  return deadlineEnd(item.deadline) < now ? 'pastDue' : 'upcoming'
}

export function isDueSoon(item, now = new Date()) {
  return (
    getSection(item, now) === 'upcoming' &&
    deadlineEnd(item.deadline) - now <= DUE_SOON_HOURS * 3600000
  )
}

// Earliest deadline first, then priority, then id (stable).
export function compareAssignments(a, b) {
  return (
    a.deadline.localeCompare(b.deadline) ||
    (PRIORITY[b.priority] ?? 0) - (PRIORITY[a.priority] ?? 0) ||
    Number(a.id) - Number(b.id)
  )
}

// Whole calendar days from today to the deadline (negative = overdue).
export function daysUntil(deadline, now = new Date()) {
  const [y, m, d] = deadline.split('-').map(Number)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(y, m - 1, d) - today) / 86400000)
}

export function timeRemaining(item, now = new Date()) {
  if (item.completed) return 'Completed'
  const n = daysUntil(item.deadline, now)
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return `${n} days left`
}
