import { useMemo } from 'react'
import { buildStudyPlan, isValidHours } from '../utils/studyPlan.js'

// The plan is derived from props + inputs on every render, so it can never
// go stale or get duplicated. "Generate" only reveals it; "Clear" hides it.
export default function StudyPlanner({ assignments, availableHours, onHoursChange, startTime, onStartTimeChange, generated, onGeneratedChange, onMessage }) {
  const plan = useMemo(
    () => (generated ? buildStudyPlan(assignments, availableHours, startTime) : null),
    [generated, assignments, availableHours, startTime]
  )

  function handleSubmit(event) {
    event.preventDefault()
    if (!isValidHours(availableHours)) {
      onMessage('Study hours 0 se zyada aur 24 ya us se kam rakho.')
      return
    }
    onMessage('')
    onGeneratedChange(true)
  }

  return (
    <section className="daily-planner">
      <div className="daily-planner-header">
        <div>
          <h2>📅 Daily Study Plan</h2>
          <p>Apne available study hours ke mutabiq aaj ka plan banao.</p>
        </div>
      </div>

      <form className="study-plan-form" onSubmit={handleSubmit}>
        <label htmlFor="availableHours">Aaj kitne ghantay parh sakte ho?</label>
        <div className="study-plan-controls">
          <input
            id="availableHours"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            value={availableHours}
            onChange={e => onHoursChange(e.target.value)}
          />
          <button type="submit">Generate My Plan</button>
        </div>

        <label htmlFor="studyStartTime">Study session kis waqt start karna hai?</label>
        <input
          id="studyStartTime"
          type="time"
          value={startTime}
          onChange={e => onStartTimeChange(e.target.value)}
        />
      </form>

      {generated && !plan && (
        <p>Study hours 0 se zyada aur 24 ya us se kam rakho, aur start time bharo.</p>
      )}

      {plan && (
        <div className="daily-plan-results">
          <div className="plan-summary">
            <div><span>Planned Hours (breaks ke saath)</span><strong>{plan.usedHours} hrs</strong></div>
            <div><span>Free Hours</span><strong>{plan.freeHours} hrs</strong></div>
            <div><span>Tasks Planned</span><strong>{plan.plannedTasks.length}</strong></div>
          </div>

          <h3>🕒 Your Daily Timetable</h3>
          <div className="plan-action-buttons">
            <button type="button" onClick={() => onGeneratedChange(false)}>✖ Clear Plan</button>
          </div>

          {plan.timetable.length === 0 ? (
            <p>Timetable banane ke liye pehle pending assignments add karo.</p>
          ) : (
            <div className="plan-task-list">
              {plan.timetable.map(slot => (
                <div className={`plan-task ${slot.type === 'break' ? 'break-task' : ''}`} key={slot.id}>
                  <div>
                    <strong>{slot.type === 'break' ? '☕ Short Break' : slot.title}</strong>
                    <p>
                      {slot.type === 'break'
                        ? `${slot.start} – ${slot.end}`
                        : `${slot.subject} · ${slot.start} – ${slot.end}`}
                    </p>
                  </div>
                  <span>{slot.type === 'break' ? '15 min' : `${slot.hours} hrs`}</span>
                </div>
              ))}
            </div>
          )}

          <h3>✅ Aaj ke Planned Assignments</h3>
          {plan.plannedTasks.length === 0 ? (
            <p>Koi assignment available hours mein fit nahi hui.</p>
          ) : (
            <div className="plan-task-list">
              {plan.plannedTasks.map(task => (
                <div className="plan-task" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.subject} · Due: {task.deadline}</p>
                  </div>
                  <span>{task.hours} hrs</span>
                </div>
              ))}
            </div>
          )}

          {plan.remainingTasks.length > 0 && (
            <>
              <h3>📌 Baqi Assignments</h3>
              <p>Ye assignments available hours mein fit nahi huin. Inhein aglay study session mein rakho.</p>
              <div className="plan-task-list">
                {plan.remainingTasks.map(task => (
                  <div className="plan-task remaining-task" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.subject} · Due: {task.deadline}</p>
                    </div>
                    <span>{task.hours} hrs</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
