'use client';

import { useEffect, useMemo, useState } from 'react';
import { Empty, fmtD, uid, ymd } from './ui';

const TYPES = [
  { id: 'meeting', label: 'Meeting', color: 'blue' },
  { id: 'business', label: 'Business', color: 'green' },
  { id: 'personal', label: 'Personal', color: 'purple' },
  { id: 'deadline', label: 'Deadline', color: 'red' },
];
const REMINDERS = [
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 1440, label: '1 day before' },
];

const formatTime = time => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const dateLabel = date => fmtD(new Date(`${date}T00:00`), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dateAdd = (value, days) => { const date = new Date(`${value}T00:00`); date.setDate(date.getDate() + days); return ymd(date); };
const sorted = list => [...list].sort((a, b) => {
  if (!a.startTime) return b.startTime ? -1 : 0;
  if (!b.startTime) return 1;
  return a.startTime.localeCompare(b.startTime);
});

export default function Calendar({ of, put, del, workspace }) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState('month');
  const [taskTimeError, setTaskTimeError] = useState('');
  const [eventDraft, setEventDraft] = useState(null);
  const [taskDraft, setTaskDraft] = useState(null);
  const [rescheduleDraft, setRescheduleDraft] = useState(null);
  const [quickNote, setQuickNote] = useState('');
  const [filters, setFilters] = useState({ type: 'all', status: 'all', priority: 'all', project: 'all' });
  const [filterMessage, setFilterMessage] = useState('');
  const workspaceId = workspace?.id;
  useEffect(() => setFilters({ type: 'all', status: 'all', priority: 'all', project: 'all' }), [workspaceId]);
  const tasks = of('task');
  const events = of('event');
  const projects = of('project');
  const notes = of('note').filter(note => note.date === selectedDate);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const monthOffset = (monthStart.getDay() + 6) % 7;
  const monthDays = Array.from({ length: Math.ceil((monthOffset + monthEnd.getDate()) / 7) * 7 }, (_, index) => {
    const date = new Date(year, month, 1 - monthOffset + index);
    return { date: ymd(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
  const [weekDays, setWeekDays] = useState([]);
  useEffect(() => {
    const offset = (new Date(`${selectedDate}T00:00`).getDay() + 6) % 7;
    setWeekDays(Array.from({ length: 7 }, (_, index) => dateAdd(selectedDate, index - offset)));
  }, [selectedDate]);

  const allScheduled = useMemo(() => [
    ...tasks.map(task => ({ ...task, recordType: 'task', title: task.t || 'Untitled task', projectName: task.projectName || projects.find(project => project.id === task.projectId)?.name || '', category: 'business' })),
    ...events.map(event => ({ ...event, recordType: 'event', title: event.title || 'Untitled event', category: event.type || 'business' })),
  ], [tasks, events, projects]);
  const filteredScheduled = allScheduled.filter(item => {
    if (filters.type !== 'all' && (filters.type === 'task' ? item.recordType !== 'task' : item.recordType !== 'event' || item.category !== filters.type)) return false;
    if (item.recordType === 'task') {
      if (filters.status === 'open' && item.d || filters.status === 'completed' && !item.d) return false;
      if (filters.priority !== 'all' && (item.priority || 'normal') !== filters.priority) return false;
      if (filters.project !== 'all' && item.projectId !== filters.project) return false;
    } else if (filters.status !== 'all' || filters.priority !== 'all' || filters.project !== 'all') return false;
    return true;
  });
  const selectedItems = sorted(filteredScheduled.filter(item => item.date === selectedDate)).sort((a, b) => Number(b.recordType === 'task' && b.focusDate === selectedDate) - Number(a.recordType === 'task' && a.focusDate === selectedDate));
  const dayTasks = selectedItems.filter(item => item.recordType === 'task');
  const done = dayTasks.filter(task => task.d).length;
  const scopedTasks = filteredScheduled.filter(item => item.recordType === 'task');
  const todayTasks = scopedTasks.filter(task => task.date === today && !task.d);
  const completedToday = scopedTasks.filter(task => task.d && task.completedAt && ymd(new Date(task.completedAt)) === today).length;
  const totalCompletedTasks = scopedTasks.filter(task => task.d).length;
  const totalOpenTasks = scopedTasks.length - totalCompletedTasks;
  const completionRate = scopedTasks.length ? Math.round(totalCompletedTasks / scopedTasks.length * 100) : 0;
  const nowTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const overdue = scopedTasks.filter(task => !task.d && /^\d{4}-\d{2}-\d{2}$/.test(task.date || '') && (task.date < today || task.date === today && task.endTime && task.endTime <= nowTime)).length;
  const meetings = filteredScheduled.filter(event => event.recordType === 'event' && event.category === 'meeting' && !event.cancelled && !event.canceled && event.status !== 'cancelled' && event.date <= dateAdd(today, 30) && (event.date > today || event.date === today && (event.allDay || (event.endTime || event.startTime || '') > nowTime))).sort((a, b) => `${a.date}${a.startTime || '00:00'}`.localeCompare(`${b.date}${b.startTime || '00:00'}`));
  const dailyFocusCount = tasks.filter(task => task.focusDate === selectedDate).length;
  const projectOptions = [...new Map(tasks.filter(task => task.projectId).map(task => [task.projectId, task.projectName || projects.find(project => project.id === task.projectId)?.name || task.projectId])).entries()];

  const movePeriod = direction => {
    if (view === 'day') { const date = dateAdd(selectedDate, direction); setSelectedDate(date); setMonth(new Date(`${date}T00:00`).getMonth()); setYear(new Date(`${date}T00:00`).getFullYear()); return; }
    if (view === 'week') { const date = dateAdd(selectedDate, direction * 7); setSelectedDate(date); setMonth(new Date(`${date}T00:00`).getMonth()); setYear(new Date(`${date}T00:00`).getFullYear()); return; }
    const next = new Date(year, month + direction, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); setSelectedDate(ymd(next));
  };
  const goToday = () => { setSelectedDate(today); setMonth(new Date().getMonth()); setYear(new Date().getFullYear()); };
  const selectMonthDate = date => {
    setSelectedDate(date);
    const next = new Date(`${date}T00:00`);
    if (next.getMonth() !== month || next.getFullYear() !== year) { setMonth(next.getMonth()); setYear(next.getFullYear()); }
  };
  const title = view === 'month'
    ? fmtD(monthStart, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${fmtD(new Date(`${weekDays[0] || selectedDate}T00:00`), { month: 'short', day: 'numeric' })} – ${fmtD(new Date(`${weekDays[6] || selectedDate}T00:00`), { month: 'short', day: 'numeric', year: 'numeric' })}`
      : fmtD(new Date(`${selectedDate}T00:00`), { month: 'long', day: 'numeric', year: 'numeric' });

  const saveTask = e => {
    e.preventDefault();
    const form = e.currentTarget, data = new FormData(form);
    const startTime = String(data.get('startTime') || ''), endTime = String(data.get('endTime') || '');
    if (Boolean(startTime) !== Boolean(endTime)) { setTaskTimeError('Choose both a start and end time, or leave both blank.'); return; }
    if (startTime && endTime && endTime <= startTime) { setTaskTimeError('End time must be later than start time.'); return; }
    setTaskTimeError('');
    put('task', { id: uid(), date: selectedDate, t: String(data.get('t') || '').trim(), d: false, ...(startTime && endTime ? { startTime, endTime } : {}) });
    form.reset();
  };

  return <div className="calendar-page">
    <div className="calendar-summary">
      <Summary icon="▦" value={todayTasks.length} label="Today's tasks" detail={`${todayTasks.length} remaining`} tone="purple" />
      <Summary icon="✓" value={completedToday} label="Completed today" detail={`${completedToday + todayTasks.length ? Math.round(completedToday / (completedToday + todayTasks.length) * 100) : 0}% of today's tasks`} tone="green" />
      <Summary icon="✓" value={totalCompletedTasks} label="Total completed tasks" detail={`${completionRate}% complete · ${totalCompletedTasks} done / ${totalOpenTasks} open`} tone="green" />
      <Summary icon="◷" value={overdue} label="Overdue tasks" detail={overdue ? 'Needs attention' : 'All caught up'} tone="red" />
      <Summary icon="▣" value={meetings.length} label="Upcoming meetings" detail={meetings[0] ? `Next: ${meetings[0].date === today ? formatTime(meetings[0].startTime) || 'Today' : fmtD(new Date(`${meetings[0].date}T00:00`), { month: 'short', day: 'numeric' })}` : 'None scheduled'} tone="blue" />
    </div>

    <div className="calendar-filters" aria-label="Calendar filters">
      <label>Type <select aria-label="Filter calendar by type" value={filters.type} onChange={e => setFilters(current => ({ ...current, type: e.target.value }))}><option value="all">All items</option><option value="task">Tasks</option>{TYPES.map(type => <option key={type.id} value={type.id}>{type.label}s</option>)}</select></label>
      <label>Status <select aria-label="Filter tasks by status" value={filters.status} onChange={e => setFilters(current => ({ ...current, status: e.target.value }))}><option value="all">All statuses</option><option value="open">Open</option><option value="completed">Completed</option></select></label>
      <label>Priority <select aria-label="Filter tasks by priority" value={filters.priority} onChange={e => setFilters(current => ({ ...current, priority: e.target.value }))}><option value="all">All priorities</option>{['critical','high','normal','low'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      {projectOptions.length > 0 && <label>Project <select aria-label="Filter tasks by project" value={filters.project} onChange={e => setFilters(current => ({ ...current, project: e.target.value }))}><option value="all">All projects</option>{projectOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
      {Object.values(filters).some(value => value !== 'all') && <button className="btn sm" onClick={() => setFilters({ type: 'all', status: 'all', priority: 'all', project: 'all' })}>Clear filters</button>}
    </div>

    <div className="calendar-toolbar">
      <div className="calendar-period-actions">
        <button className="btn sm" onClick={goToday}>Today</button>
        <button className="btn sm calendar-arrow" aria-label="Previous period" onClick={() => movePeriod(-1)}>‹</button>
        <button className="btn sm calendar-arrow" aria-label="Next period" onClick={() => movePeriod(1)}>›</button>
        <strong>{title}</strong>
      </div>
      <div className="calendar-views" role="tablist" aria-label="Calendar view">
        {['month', 'week', 'day'].map(mode => <button key={mode} role="tab" aria-selected={view === mode} className={view === mode ? 'on' : ''} onClick={() => setView(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}
      </div>
    </div>

    <div className="calendar-layout">
      <section className="card calendar-main" aria-label={`${view} calendar`}>
        {view === 'month' && <MonthGrid days={monthDays} today={today} selected={selectedDate} scheduled={filteredScheduled} notes={of('note')} onSelect={selectMonthDate} />}
        {view === 'week' && <WeekGrid days={weekDays} today={today} selected={selectedDate} scheduled={filteredScheduled} onSelect={setSelectedDate} />}
        {view === 'day' && <DayTimeline date={selectedDate} items={selectedItems} onToggle={toggleDone} onEdit={editItem} onDelete={del} onReschedule={item => setRescheduleDraft(item)} onToggleFocus={toggleFocus} dailyFocusCount={dailyFocusCount} />}
        <div className="calendar-legend">{TYPES.map(type => <span key={type.id}><i className={`calendar-dot ${type.color}`} />{type.label}</span>)}<span><i className="calendar-dot gray" />Task</span></div>
      </section>

      <div className="calendar-side">
        <section className="card calendar-agenda">
          <div className="calendar-section-heading"><div><h2>{dateLabel(selectedDate)}</h2><span className="mut">{selectedItems.length} scheduled item{selectedItems.length === 1 ? '' : 's'}</span></div><div className="calendar-agenda-actions"><button className="btn" onClick={() => { setTaskTimeError(''); setTaskDraft({ date: selectedDate }); }}>＋ Add task</button><button className="btn pri" onClick={() => setEventDraft({ date: selectedDate })}>＋ Add event</button></div></div>
          {dayTasks.length > 0 && <div className="calendar-progress"><span className="mut">{done} of {dayTasks.length} tasks complete</span><div className="bar"><b style={{ width: `${done / dayTasks.length * 100}%` }} /></div></div>}
          <Agenda items={selectedItems} onToggle={toggleDone} onEdit={editItem} onDelete={del} onReschedule={item => setRescheduleDraft(item)} onToggleFocus={toggleFocus} dailyFocusCount={dailyFocusCount} />
          {filterMessage && <p className="calendar-modal-error" role="status">{filterMessage}</p>}
        </section>

        <section className="card calendar-notes">
          <div className="calendar-section-heading"><div><h2>Daily notes</h2><span className="mut">Context and reminders for this day</span></div></div>
          {notes.length ? notes.map(note => <EditableNote key={note.id} note={note} put={put} del={del} />) : <div className="calendar-note-empty">No notes for this day yet.</div>}
          <form className="calendar-quick-note" onSubmit={e => { e.preventDefault(); if (!quickNote.trim()) return; put('note', { id: uid(), date: selectedDate, text: quickNote.trim() }); setQuickNote(''); }}>
            <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows="2" placeholder="Quick note for today…" aria-label="Daily note" />
            <button className="btn pri">Add note</button>
          </form>
        </section>
      </div>
    </div>
    {eventDraft && <EventModal event={eventDraft.id ? eventDraft : null} date={eventDraft.date || selectedDate} workspace={workspace} onClose={() => setEventDraft(null)} onSave={async event => {
      const saved = await put('event', event);
      if (saved) setEventDraft(null);
      return saved;
    }} />}
    {taskDraft && <TaskModal key={taskDraft.id || 'new'} task={taskDraft.id ? taskDraft : null} date={taskDraft.date || selectedDate} error={taskTimeError} onError={setTaskTimeError} onClose={() => setTaskDraft(null)} onSave={async task => {
      const saved = await put('task', task);
      if (saved) {
        setTaskDraft(null);
        if (task.date !== selectedDate) {
          const nextDate = new Date(`${task.date}T00:00`);
          setSelectedDate(task.date); setMonth(nextDate.getMonth()); setYear(nextDate.getFullYear());
        }
      }
      return saved;
    }} />}
    {rescheduleDraft && <RescheduleModal task={rescheduleDraft} onClose={() => setRescheduleDraft(null)} onSave={async date => {
      const { recordType, title, category, ...task } = rescheduleDraft;
      const saved = await put('task', { ...task, date, ...(task.focusDate === task.date ? { focusDate: date } : {}) });
      if (saved) {
        setRescheduleDraft(null);
        const nextDate = new Date(`${date}T00:00`);
        setSelectedDate(date); setMonth(nextDate.getMonth()); setYear(nextDate.getFullYear());
      }
      return saved;
    }} />}
  </div>;

  function editItem(item) {
    if (item.recordType === 'task') { setTaskTimeError(''); setTaskDraft(item); }
    else setEventDraft(item);
  }
  function toggleDone(item) {
    const nextDone = !item.d;
    const updated = { ...item, d: nextDone, ...(item.recordType === 'task' ? { completedAt: nextDone ? new Date().toISOString() : null } : {}) };
    put(item.recordType === 'event' ? 'event' : 'task', updated);
    if (item.recordType === 'task' && item.projectId && item.milestoneId) {
      const project = of('project').find(p => p.id === item.projectId);
      if (project) put('project', { ...project, ms: (project.ms || []).map(m => m.id === item.milestoneId ? { ...m, d: updated.d } : m) });
    }
  }
  function toggleFocus(item) {
    if (item.focusDate === selectedDate) { setFilterMessage(''); put('task', { ...item, focusDate: null }); return; }
    if (dailyFocusCount >= 3) { setFilterMessage('Daily Focus is limited to three tasks for each date.'); return; }
    setFilterMessage(''); put('task', { ...item, focusDate: selectedDate });
  }
}

function Summary({ icon, value, label, detail, tone }) {
  return <div className="calendar-stat"><span className={`calendar-stat-icon ${tone}`}>{icon}</span><div><b>{value}</b><span>{label}</span><small>{detail}</small></div></div>;
}

function MonthGrid({ days, today, selected, scheduled, notes, onSelect }) {
  return <div className="calendar-month-grid">
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
    {days.map(({ date, day, inMonth }) => {
      const list = scheduled.filter(item => item.date === date), hasNote = notes.some(note => note.date === date);
      return <button key={date} className={`calendar-date-cell${date === today ? ' today' : ''}${date === selected ? ' selected' : ''}${!inMonth ? ' outside' : ''}`} onClick={() => onSelect(date)} aria-pressed={date === selected}>
        <span className="calendar-date-number">{day}</span>
        <span className="calendar-date-items">{list.slice(0, 2).map(item => <i key={`${item.recordType}-${item.id}`} className={`calendar-dot ${item.recordType === 'task' ? 'gray' : (TYPES.find(type => type.id === item.category)?.color || 'green')}`} title={item.title} />)}{list.length > 2 && <small>+{list.length - 2}</small>}{hasNote && <i className="calendar-note-marker" title="Has daily note" />}</span>
        <span className="calendar-date-chips">{list.slice(0, 2).map(item => <small key={`${item.recordType}-${item.id}`} className={`calendar-chip ${item.recordType === 'task' ? 'gray' : (TYPES.find(type => type.id === item.category)?.color || 'green')}`}>{item.title}</small>)}</span>
      </button>;
    })}
  </div>;
}

function WeekGrid({ days, today, selected, scheduled, onSelect }) {
  return <div className="calendar-week-grid">{days.map(date => {
    const items = sorted(scheduled.filter(item => item.date === date));
    return <button key={date} className={`calendar-week-day${date === today ? ' today' : ''}${date === selected ? ' selected' : ''}`} onClick={() => onSelect(date)}>
      <span className="calendar-week-date">{fmtD(new Date(`${date}T00:00`), { weekday: 'short', day: 'numeric' })}</span>
      {items.length ? items.slice(0, 5).map(item => <span key={`${item.recordType}-${item.id}`} className={`calendar-week-item ${item.recordType === 'task' ? 'gray' : (TYPES.find(type => type.id === item.category)?.color || 'green')}`}><small>{item.startTime ? formatTime(item.startTime) : 'All day'}</small>{item.title}</span>) : <span className="mut calendar-week-empty">No items</span>}
      {items.length > 5 && <small className="mut">+{items.length - 5} more</small>}
    </button>;
  })}</div>;
}

function DayTimeline({ date, items, onToggle, onEdit, onDelete, onReschedule, onToggleFocus, dailyFocusCount }) {
  return <div className="calendar-day-timeline"><h2>{dateLabel(date)}</h2>{items.length ? <Agenda items={items} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onReschedule={onReschedule} onToggleFocus={onToggleFocus} dailyFocusCount={dailyFocusCount} /> : <Empty>Nothing scheduled for this day.</Empty>}</div>;
}

function Agenda({ items, onToggle, onEdit, onDelete, onReschedule, onToggleFocus, dailyFocusCount = 0 }) {
  if (!items.length) return <div className="calendar-agenda-empty"><span>✓</span><p>Nothing planned for this day.</p></div>;
  return <div className="calendar-agenda-list">{items.map(item => {
    const type = TYPES.find(entry => entry.id === item.category) || TYPES[1];
    const event = item.recordType === 'event';
    const focused = !event && item.focusDate === item.date;
    const today = ymd(new Date()), now = new Date(), nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const overdue = !event && !item.d && item.date && (item.date < today || item.date === today && item.endTime && item.endTime <= nowTime);
    const urgency = item.d ? 'Completed' : overdue ? 'Overdue' : item.date === today ? 'Due today' : item.date ? 'Upcoming' : 'No due date';
    const priority = ['critical', 'high', 'normal', 'low'].includes(item.priority) ? item.priority : 'normal';
    const project = item.projectName || item.clientName || item.engagementName || '';
    return <div className={`calendar-agenda-item ${event ? type.color : 'gray task'}${focused ? ' focus' : ''}${overdue ? ' overdue' : ''}`} key={`${item.recordType}-${item.id}`}>
      <input type="checkbox" checked={!!item.d} onChange={() => onToggle(item)} aria-label={`Mark ${event ? 'event' : 'task'} ${item.title} ${item.d ? 'incomplete' : 'complete'}`} />
      <div className="calendar-agenda-time">{item.allDay ? 'All day' : item.startTime ? <>{formatTime(item.startTime)}{item.endTime && <small>to {formatTime(item.endTime)}</small>}</> : 'Anytime'}</div>
      <div className="calendar-agenda-copy"><div className="calendar-agenda-title"><b className={item.d ? 'done' : ''}>{item.title}</b>{!event && <span className={`calendar-priority ${priority}`} title={`${priority[0].toUpperCase() + priority.slice(1)} priority`}>{priority[0].toUpperCase() + priority.slice(1)}</span>}</div><span>{event ? `${type.label}${item.location ? ` · ${item.location}` : ''}` : `${urgency}${project ? ` · ${project}` : ''}`}{item.description ? ` · ${item.description}` : ''}</span></div>
      {event && <div className="calendar-item-actions"><button className="x txt" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>Edit</button><button className="x txt" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title}`}>Delete</button></div>}
      {!event && <div className="calendar-item-actions calendar-task-actions"><button className="x txt" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>Edit</button><button className="x txt" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.title}`}>Delete</button>{!item.d && <button className="x txt" onClick={() => onReschedule(item)} aria-label={`Reschedule ${item.title}`}>Reschedule</button>}<button className="x txt" onClick={() => onToggleFocus(item)} disabled={!focused && dailyFocusCount >= 3} aria-pressed={focused} aria-label={focused ? `Remove ${item.title} from Daily Focus` : `Add ${item.title} to Daily Focus`} title={focused ? 'Remove from Daily Focus' : dailyFocusCount >= 3 ? 'Daily Focus is full' : 'Add to Daily Focus'}>{focused ? '★' : '☆'}</button></div>}
    </div>;
  })}</div>;
}

function EditableNote({ note, put, del }) {
  const [editing, setEditing] = useState(false);
  return <div className="calendar-note-row">{editing
    ? <textarea autoFocus defaultValue={note.text} rows="3" aria-label="Edit daily note" onBlur={e => { const text = e.target.value.trim(); if (text && text !== note.text) put('note', { ...note, text }); setEditing(false); }} />
    : <p>{note.text}</p>}
    <div><button className="x txt" onClick={() => setEditing(true)} aria-label="Edit note">Edit</button><button className="x" onClick={() => del(note.id)} aria-label="Delete note">×</button></div>
  </div>;
}

function TaskModal({ task, date, error, onError, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [taskId] = useState(() => uid());
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);
  const save = async e => {
    e.preventDefault();
    if (saving) return;
    const data = new FormData(e.currentTarget);
    const title = String(data.get('title') || '').trim();
    const startTime = String(data.get('startTime') || ''), endTime = String(data.get('endTime') || '');
    const startProvided = data.get('startTimeProvided') === '1', endProvided = data.get('endTimeProvided') === '1';
    if ((startProvided && !startTime) || (endProvided && !endTime)) { onError('Choose the hour, minutes, and AM/PM for each time.'); return; }
    if (Boolean(startTime) !== Boolean(endTime)) { onError('Choose both a start and end time, or leave both blank.'); return; }
    if (startTime && endTime && endTime <= startTime) { onError('End time must be later than start time.'); return; }
    if (!title) return;
    onError(''); setSaveError(''); setSaving(true);
    const result = await onSave({ ...task, id: task?.id || taskId, date: String(data.get('date') || date), t: title, d: task?.d || false, priority: String(data.get('priority') || task?.priority || 'normal'), ...(task?.focusDate ? { focusDate: task.focusDate === task.date ? String(data.get('date') || date) : task.focusDate } : {}), ...(startTime && endTime ? { startTime, endTime } : { startTime: '', endTime: '' }) });
    setSaving(false);
    if (!result) setSaveError('The task could not be saved. Check the connection and try again.');
  };
  return <div className="calendar-modal-backdrop" role="presentation">
    <section className="calendar-modal calendar-task-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-task-title">
      <div className="calendar-modal-header"><div><span className="calendar-modal-icon">✓</span><div><h2 id="calendar-task-title">{task ? 'Edit task' : 'Add task'}</h2><p>{task ? 'Update this task’s details and schedule.' : `Add a task to ${dateLabel(date)}.`}</p></div></div><button className="x" onClick={onClose} aria-label="Close task form" disabled={saving}>×</button></div>
      <form onSubmit={save}>
        <label className="calendar-field full"><span>Task <b>*</b></span><input name="title" type="text" defaultValue={task?.t || ''} placeholder="What needs to get done?" autoFocus maxLength={200} required /></label>
        <label className="calendar-field full"><span>Date <b>*</b></span><input name="date" type="date" defaultValue={task?.date || date} required aria-label="Task date" /></label>
        <label className="calendar-field full"><span>Priority</span><select name="priority" defaultValue={task?.priority || 'normal'} aria-label="Task priority"><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
        <div className="calendar-field-row task-time-row">
          <TimePicker name="startTime" label="From" value={task?.startTime || ''} />
          <TimePicker name="endTime" label="To" value={task?.endTime || ''} />
        </div>
        {(error || saveError) && <p className="calendar-modal-error" role="alert">{saveError || error}</p>}
        <div className="calendar-modal-actions"><button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button><button className="btn pri" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</button></div>
      </form>
    </section>
  </div>;
}

function RescheduleModal({ task, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);
  const save = async e => {
    e.preventDefault();
    if (saving) return;
    const date = String(new FormData(e.currentTarget).get('date') || '');
    if (!date) { setError('Choose a date for this task.'); return; }
    setError(''); setSaving(true);
    const result = await onSave(date);
    setSaving(false);
    if (!result) setError('The task could not be rescheduled. Check the connection and try again.');
  };
  return <div className="calendar-modal-backdrop" role="presentation">
    <section className="calendar-modal reschedule-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-reschedule-title">
      <div className="calendar-modal-header"><div><span className="calendar-modal-icon">↗</span><div><h2 id="calendar-reschedule-title">Reschedule task</h2><p>Choose a new date for “{task.t}”.</p></div></div><button className="x" onClick={onClose} aria-label="Close reschedule form" disabled={saving}>×</button></div>
      <form onSubmit={save}>
        <label className="calendar-field"><span>New date <b>*</b></span><input type="date" name="date" defaultValue={task.date} required autoFocus /></label>
        {error && <p className="calendar-modal-error" role="alert">{error}</p>}
        <div className="calendar-modal-actions"><button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button><button className="btn pri" disabled={saving}>{saving ? 'Rescheduling…' : 'Reschedule'}</button></div>
      </form>
    </section>
  </div>;
}

function TimePicker({ name, label, value = '' }) {
  const parsed = value.match(/^(\d{2}):(\d{2})$/);
  const initialHours = parsed ? Number(parsed[1]) : 0;
  const [hour, setHour] = useState(parsed ? String(initialHours % 12 || 12) : ''), [minute, setMinute] = useState(parsed ? parsed[2] : ''), [meridiem, setMeridiem] = useState(parsed ? (initialHours >= 12 ? 'PM' : 'AM') : '');
  const [openField, setOpenField] = useState('');
  const provided = Boolean(hour || minute || meridiem);
  let currentValue = '';
  const validHour = /^(0?[1-9]|1[0-2])$/.test(hour);
  const validMinute = /^(?:[0-9]|[1-5][0-9])$/.test(minute);
  if (validHour && validMinute && (meridiem === 'AM' || meridiem === 'PM')) {
    let hours = Number(hour) % 12;
    if (meridiem === 'PM') hours += 12;
    currentValue = `${String(hours).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
  }
  const choices = {
    hour: Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')),
    minute: Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')),
    meridiem: ['AM', 'PM']
  };
  const renderPart = (part, partValue, setPartValue, placeholder, inputMode = 'text') => <div className="calendar-time-segment" key={part}>
    <input type="text" inputMode={inputMode} autoComplete="off" maxLength={2} aria-label={`${label} ${part === 'meridiem' ? 'AM or PM' : part}`} placeholder={placeholder} value={partValue} onFocus={() => setOpenField(part)} onBlur={() => window.setTimeout(() => setOpenField(current => current === part ? '' : current), 100)} onChange={e => setPartValue(part === 'meridiem' ? e.target.value.toUpperCase() : e.target.value)} />
    {openField === part && <div className="calendar-time-options" role="listbox" aria-label={`${label} ${part} options`} onMouseDown={e => e.preventDefault()}>
      {choices[part].map(option => <button type="button" role="option" aria-selected={partValue === option} key={option} onClick={() => { setPartValue(option); setOpenField(''); }}>{option}</button>)}
    </div>}
  </div>;
  return <div className="calendar-field task-time-picker">
    <span>{label}</span>
    <div className="calendar-time-selects">
      {renderPart('hour', hour, setHour, 'HH', 'numeric')}
      <span aria-hidden="true">:</span>
      {renderPart('minute', minute, setMinute, 'MM', 'numeric')}
      {renderPart('meridiem', meridiem, setMeridiem, 'AM/PM')}
    </div>
    <input type="hidden" name={name} value={currentValue} />
    <input type="hidden" name={`${name}Provided`} value={provided ? '1' : '0'} />
  </div>;
}

function EventModal({ event, date, workspace, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allDay, setAllDay] = useState(!!event?.allDay);
  const [reminders, setReminders] = useState(event?.reminders || []);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);
  const toggleReminder = value => setReminders(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const save = async e => {
    e.preventDefault();
    if (saving) return;
    const form = e.currentTarget, data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const startTime = String(data.get('startTime') || ''), endTime = String(data.get('endTime') || '');
    if (!title) { setError('Enter an event title.'); return; }
    if (!allDay && (!startTime || !endTime)) { setError('Choose a start and end time, or mark this as an all-day event.'); return; }
    if (!allDay && endTime <= startTime) { setError('End time must be later than start time.'); return; }
    setError(''); setSaving(true);
    const result = await onSave({
      id: event?.id || uid(), title, description: String(data.get('description') || '').trim(),
      date: String(data.get('date') || date), allDay, startTime: allDay ? '' : startTime, endTime: allDay ? '' : endTime,
      type: String(data.get('type') || 'business'), location: String(data.get('location') || '').trim(), reminders, d: !!event?.d,
    });
    setSaving(false);
    if (!result) setError('The event could not be saved. Check the connection and try again.');
  };
  return <div className="calendar-modal-backdrop" role="presentation">
    <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">
      <div className="calendar-modal-header"><div><span className="calendar-modal-icon">▦</span><div><h2 id="calendar-event-title">{event ? 'Edit event' : 'Add event'}</h2><p>Create a calendar event for this business space.</p></div></div><button className="x" onClick={onClose} aria-label="Close event form" disabled={saving}>×</button></div>
      <form onSubmit={save}>
        <label className="calendar-field full"><span>Title <b>*</b></span><input name="title" defaultValue={event?.title || ''} placeholder="e.g. Project review" autoFocus maxLength={160} required /></label>
        <label className="calendar-field full"><span>Description</span><textarea name="description" defaultValue={event?.description || ''} rows="3" placeholder="Add a description (optional)…" maxLength={2000} /></label>
        <div className="calendar-field-row date-time-row">
          <label className="calendar-field"><span>Date <b>*</b></span><input name="date" type="date" defaultValue={event?.date || date} required /></label>
          <label className="calendar-field"><span>Start time {!allDay && <b>*</b>}</span><input name="startTime" type="time" defaultValue={event?.startTime || '09:00'} disabled={allDay} required={!allDay} /></label>
          <label className="calendar-field"><span>End time {!allDay && <b>*</b>}</span><input name="endTime" type="time" defaultValue={event?.endTime || '10:00'} disabled={allDay} required={!allDay} /></label>
        </div>
        <label className="calendar-all-day"><input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> All day <span>Mark as an all-day event</span></label>
        <div className="calendar-field-row">
          <label className="calendar-field"><span>Space <b>*</b></span><input value={`${workspace?.name || 'Current business'} (Business)`} readOnly aria-label="Selected business space" /></label>
          <label className="calendar-field"><span>Event type</span><select name="type" defaultValue={event?.type || 'meeting'}>{TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
        </div>
        <label className="calendar-field full"><span>Location</span><input name="location" defaultValue={event?.location || ''} placeholder="Add location or meeting link" maxLength={500} /></label>
        <div className="calendar-reminders"><div><b>Reminder preferences</b><small>Saved with this event; notifications are not enabled.</small></div><div className="calendar-reminder-options">{REMINDERS.map(reminder => <label key={reminder.value}><input type="checkbox" checked={reminders.includes(reminder.value)} onChange={() => toggleReminder(reminder.value)} />{reminder.label}</label>)}</div></div>
        {error && <p className="calendar-modal-error" role="alert">{error}</p>}
        <div className="calendar-modal-actions"><button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button><button className="btn pri" disabled={saving}>{saving ? 'Saving…' : event ? 'Save changes' : 'Create event'}</button></div>
      </form>
    </section>
  </div>;
}
