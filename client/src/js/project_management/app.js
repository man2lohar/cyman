/* =====================================================================
   CyManSquare Project Management — app.js
   Features: Kanban, Team, Subtasks, Recurring, Time Tracking,
             Notifications, Burndown Reports, File Attachments,
             Dependencies + all original functionality
   ===================================================================== */

/* ── Theme ── */
function applyTheme(on) {
  document.body.classList.toggle('dark-mode', on);
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  document.documentElement.style.colorScheme = on ? 'dark' : 'light';
}
applyTheme(localStorage.getItem('cymDark') === '1');

/* ── Globals ── */
window.members = window.members || [];
window.notifications = window.notifications || [];
let timerInterval = null, timerSeconds = 0, timerTaskId = null, timerRunning = false;
let subtasksInModal = [];
let selectedMemberColor = '#0b74ff';
let currentMonth = new Date().getMonth(), currentYear = new Date().getFullYear();
let statusChart = null, priorityChart = null, burndownChart = null, workloadChart = null, velocityChart = null;
let currentSort = { key: null, asc: true };
let currentTimelineSearch = '', currentTimelineProject = 'all', currentTimelineType = 'both';
let milestones = [], userId = null;

/* ── DOM refs ── */
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const views = {
  calendar: document.getElementById('calendarView'),
  kanban: document.getElementById('kanbanView'),
  assessment: document.getElementById('assessmentView'),
  timeline: document.getElementById('timelineView'),
  projects: document.getElementById('projectsView'),
  team: document.getElementById('teamView'),
  reports: document.getElementById('reportsView'),
  settings: document.getElementById('settingsView'),
  help: document.getElementById('helpView')
};
const projectModal   = new bootstrap.Modal(document.getElementById('projectModal'));
const taskModal      = new bootstrap.Modal(document.getElementById('taskModal'));
const timeModal      = new bootstrap.Modal(document.getElementById('timeModal'));
const memberModal    = new bootstrap.Modal(document.getElementById('memberModal'));
const milestoneModal = new bootstrap.Modal(document.getElementById('milestoneModal'));
const milestoneForm  = {
  id:      document.getElementById('editMilestoneId'),
  project: document.getElementById('milestoneProject'),
  title:   document.getElementById('milestoneTitle'),
  date:    document.getElementById('milestoneDate'),
  done:    document.getElementById('milestoneDone')
};

/* ── Helpers ── */
function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showLoader() { document.getElementById('loaderOverlay').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loaderOverlay').classList.add('hidden'); }
function rndColor() { return ['#0b74ff','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777'][Math.floor(Math.random()*7)]; }
function initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function fmtSecs(s) { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60; return [h,m,sc].map(v => String(v).padStart(2,'0')).join(':'); }
function fmtHours(s) { return (s / 3600).toFixed(1) + 'h'; }
function today() { return new Date().toISOString().split('T')[0]; }

/* ── View switching ── */
function switchView(key) {
  Object.values(views).forEach(v => { v.classList.add('hidden'); v.setAttribute('aria-hidden', 'true'); });
  if (views[key]) { views[key].classList.remove('hidden'); views[key].setAttribute('aria-hidden', 'false'); }
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
  const navId = { calendar:'navCalendar', kanban:'navKanban', assessment:'navAssessment', timeline:'navTimeline', projects:'navProjects', team:'navTeam', reports:'navReports', settings:'navSettings', help:'navHelp' }[key];
  const navEl = document.getElementById(navId); if (navEl) navEl.classList.add('active');
  const titles = { calendar:'Calendar', kanban:'Kanban Board', assessment:'Assessment', timeline:'Timeline', projects:'Projects', team:'Team', reports:'Reports', settings:'Settings', help:'Help & Support' };
  document.getElementById('topbarTitle').textContent = 'Project Management – ' + (titles[key] || '');
  if (key === 'calendar')   renderCalendar();
  if (key === 'kanban')     renderKanban();
  if (key === 'projects')   renderProjects();
  if (key === 'assessment') renderAllAssessment();
  if (key === 'timeline')   renderTimeline();
  if (key === 'team')       renderTeam();
  if (key === 'reports')    renderReports();
  if (key === 'settings')   refreshSettingsStats();
}
toggleSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
document.addEventListener('click', e => { if (window.innerWidth <= 1000 && !sidebar.contains(e.target) && !toggleSidebarBtn.contains(e.target)) sidebar.classList.remove('show'); });

/* ══════════════════════════════════════════════
   CALENDAR
══════════════════════════════════════════════ */
let calPopoverVisible = false;

function renderCalendar() {
  const calEl   = document.getElementById('calendar');
  const loadEl  = document.getElementById('loading');
  calEl.innerHTML = '';
  if (loadEl) loadEl.style.display = 'none';

  const first = new Date(currentYear, currentMonth, 1);
  const last  = new Date(currentYear, currentMonth + 1, 0);
  const todayStr = today();

  // Header: month title + mini stats bar
  document.getElementById('monthYear').textContent =
    first.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Month-level stats
  const monthStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
  const monthTasks = (window.tasks||[]).filter(t => (t.target||'').startsWith(monthStr));
  const doneCount = monthTasks.filter(t=>t.completed).length;
  const overdueCount = monthTasks.filter(t=>!t.completed && t.target < todayStr).length;
  let statsBar = document.getElementById('calStatsBar');
  if (!statsBar) {
    statsBar = document.createElement('div');
    statsBar.id = 'calStatsBar';
    const calView = document.getElementById('calendarView');
    calView.insertBefore(statsBar, calEl);
  }
  statsBar.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:var(--font-size-xs)';
  statsBar.innerHTML = `
    <span style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-weight:600;color:var(--text-secondary)">📋 ${monthTasks.length} tasks this month</span>
    <span style="background:var(--chip-low-bg);color:var(--chip-low-text);border-radius:6px;padding:3px 10px;font-weight:600">✅ ${doneCount} done</span>
    ${overdueCount ? `<span style="background:var(--chip-high-bg);color:var(--chip-high-text);border-radius:6px;padding:3px 10px;font-weight:600">⏰ ${overdueCount} overdue</span>` : ''}
    ${monthTasks.length ? `<span style="background:var(--soft);color:var(--accent);border-radius:6px;padding:3px 10px;font-weight:600">${Math.round(doneCount/monthTasks.length*100)}% complete</span>` : ''}`;

  // Hoist lookups
  const startDay       = parseInt(localStorage.getItem('cymWeekStart')||'0');
  const weekOffDays    = (localStorage.getItem('cymWeekOff')||'').split(',').map(Number).filter(n=>!isNaN(n));
  const specificOffArr = (() => { try { return JSON.parse(localStorage.getItem('cymSpecificOff')||'[]'); } catch(e){return[];} })();
  const membersList    = window.members || [];

  // Group tasks by date
  const grouped = {};
  (window.tasks||[]).forEach(t => { if (t.target) (grouped[t.target]=grouped[t.target]||[]).push(t); });

  // Day-name row (already in HTML) — just update if week starts Monday
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const calDays = document.querySelector('.calendar-days');
  if (calDays) {
    calDays.innerHTML = '';
    for (let i=0;i<7;i++) {
      const el = document.createElement('div');
      el.textContent = dayNames[(i+startDay)%7];
      el.style.cssText = 'font-size:var(--font-size-xs);font-weight:700;color:var(--muted);text-align:center;padding:4px 0';
      calDays.appendChild(el);
    }
  }

  // Empty offset cells
  const offset = (first.getDay() - startDay + 7) % 7;
  for (let i=0;i<offset;i++) {
    const blank = document.createElement('div');
    blank.style.cssText = 'border-radius:8px;min-height:96px;';
    calEl.appendChild(blank);
  }

  for (let d=1; d<=last.getDate(); d++) {
    const ds  = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow = new Date(ds+'T12:00:00').getDay();
    const specificOff = specificOffArr.find(x=>x.date===ds);
    const isOff       = weekOffDays.includes(dow) || !!specificOff;
    const isToday     = ds === todayStr;
    const dayTasks    = grouped[ds] || [];
    const hasOverdue  = dayTasks.some(t=>!t.completed && t.target<todayStr);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isToday) cell.classList.add('today');
    if (isOff) {
      cell.style.background = 'var(--bg-secondary)';
      cell.style.opacity = '0.48';
    }

    // Day number header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px';

    const numCircle = document.createElement('div');
    numCircle.style.cssText = `width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:var(--font-size-xs);font-weight:700;flex-shrink:0;${isToday ? 'background:var(--accent);color:#fff;' : 'color:var(--text-secondary);'}`;
    numCircle.textContent = d;

    const rightMeta = document.createElement('div');
    rightMeta.style.cssText = 'display:flex;align-items:center;gap:3px';
    if (isOff) {
      const offLbl = document.createElement('span');
      const offTxt = specificOff ? (specificOff.label||'Off') : 'Off';
      offLbl.style.cssText = 'font-size:.5rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      offLbl.textContent = offTxt;
      rightMeta.appendChild(offLbl);
    }
    if (dayTasks.length > 0) {
      const cnt = document.createElement('span');
      cnt.style.cssText = `font-size:.55rem;font-weight:700;padding:1px 5px;border-radius:99px;${hasOverdue ? 'background:#fee2e2;color:#b91c1c;' : 'background:var(--accent-dim);color:var(--accent);'}`;
      cnt.textContent = dayTasks.length;
      rightMeta.appendChild(cnt);
    }

    header.appendChild(numCircle);
    header.appendChild(rightMeta);
    cell.appendChild(header);

    // Task chips (show max 3, then "+N more")
    const MAX_SHOW = 3;
    dayTasks.slice(0, MAX_SHOW).forEach(t => {
      const chip = document.createElement('div');
      chip.className = `task-chip ${t.priority||''} ${t.completed?'completed':''}`;
      chip.style.cssText = 'display:flex;align-items:center;gap:3px;margin-bottom:2px;cursor:pointer;';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:var(--font-size-xs)';
      textSpan.innerHTML = `<strong style="font-size:.6rem">${esc(t.project||'')}</strong> ${esc(t.description||'')}`;
      chip.appendChild(textSpan);

      // Assignee avatars
      const assigneeAvatars = (t.assignees||[]).slice(0,2).map(n => {
        const mem = membersList.find(mm=>mm.name===n);
        return `<span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:${mem?mem.color:'#6b7280'};color:#fff;font-size:.42rem;font-weight:700;flex-shrink:0;border:1px solid var(--card)" title="${esc(n)}">${initials(n)}</span>`;
      }).join('');
      if (assigneeAvatars) {
        const avSpan = document.createElement('span');
        avSpan.style.cssText = 'display:flex;gap:1px;align-items:center;flex-shrink:0';
        avSpan.innerHTML = assigneeAvatars;
        chip.appendChild(avSpan);
      }

      chip.addEventListener('click', () => editTask(window.tasks.indexOf(t)));
      cell.appendChild(chip);
    });

    // "+N more" link
    if (dayTasks.length > MAX_SHOW) {
      const more = document.createElement('div');
      more.style.cssText = 'font-size:.6rem;color:var(--accent);font-weight:600;cursor:pointer;padding:1px 3px;margin-top:2px';
      more.textContent = `+${dayTasks.length - MAX_SHOW} more`;
      more.addEventListener('click', e => { e.stopPropagation(); showDayPopover(ds, dayTasks, more); });
      cell.appendChild(more);
    }

    calEl.appendChild(cell);
  }
}

// Day popover — shows all tasks for a date in a floating panel
function showDayPopover(ds, tasks, anchor) {
  document.getElementById('calDayPopover')?.remove();
  const pop = document.createElement('div');
  pop.id = 'calDayPopover';
  pop.style.cssText = 'position:fixed;z-index:4000;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lg);padding:12px;min-width:240px;max-width:290px;max-height:320px;overflow-y:auto';
  const rect = anchor.getBoundingClientRect();
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px';
  pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:var(--font-size-sm)">${ds}</strong><button onclick="document.getElementById('calDayPopover').remove()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:0;line-height:1">×</button></div>`;
  tasks.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid var(--divider);cursor:pointer';
    const mem = (t.assignees||[]).slice(0,2).map(n => { const m=(window.members||[]).find(m=>m.name===n); return `<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${m?m.color:'#6b7280'};color:#fff;font-size:.5rem;font-weight:700" title="${esc(n)}">${initials(n)}</span>`; }).join('');
    row.innerHTML = `<span class="task-chip ${t.priority||''}" style="margin:0;padding:1px 5px;font-size:.6rem;flex-shrink:0">${t.priority||'low'}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--font-size-xs);${t.completed?'text-decoration:line-through;color:var(--muted)':''}">${esc(t.description||'')}</span>${mem?`<div style="display:flex;gap:2px">${mem}</div>`:''}`;
    row.addEventListener('click', () => { editTask(window.tasks.indexOf(t)); document.getElementById('calDayPopover')?.remove(); });
    pop.appendChild(row);
  });
  document.body.appendChild(pop);
  setTimeout(() => document.addEventListener('click', function removePop(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', removePop); } }), 10);
}

document.getElementById('prevMonth').addEventListener('click', () => { currentMonth--; if (currentMonth<0){currentMonth=11;currentYear--;} renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentMonth++; if (currentMonth>11){currentMonth=0;currentYear++;} renderCalendar(); });

/* ══════════════════════════════════════════════
   KANBAN
══════════════════════════════════════════════ */

const KANBAN_COLS   = ['todo','inprogress','review','done'];
const COL_COLORS    = { todo:'#94a3b8', inprogress:'#f59e0b', review:'#8b5cf6', done:'#10b981' };
const PRIORITY_COLORS = { high:'#ef4444', medium:'#f59e0b', low:'#10b981' };
let   kbCollapseDone = false;

/* ── Drag listeners: attached ONCE at startup ── */
KANBAN_COLS.forEach(status => {
  const col = document.getElementById(`kCol-${status}`);
  col.addEventListener('dragover',  e => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const idx = parseInt(e.dataTransfer.getData('taskIdx'));
    if (isNaN(idx) || !window.tasks[idx]) return;
    const t = window.tasks[idx];
    if (t.kanbanStatus === status) return;           // no-op if same column
    t.kanbanStatus = status;
    if (status === 'done' && !t.completed) { t.completed = true; t.completedAt = today(); }
    if (status !== 'done') t.completed = false;
    if (typeof saveTasks === 'function') saveTasks();
    addNotification('Task moved', `"${t.description || ''}" → ${status}`, 'bi-kanban');
    renderKanban();
    renderAllAssessment();
  });
});

/* ── Quick-add from column footer ── */
window.openNewTaskInStatus = function(status) {
  openNewTask();
  // after modal opens, set the kanban status
  setTimeout(() => {
    const ks = document.getElementById('taskKanbanStatus');
    if (ks) ks.value = status;
  }, 80);
};

/* ── Clear done column ── */
document.getElementById('kClearDoneBtn')?.addEventListener('click', () => {
  const doneCount = (window.tasks||[]).filter(t=>t.kanbanStatus==='done').length;
  if (!doneCount) return;
  if (!confirm(`Archive ${doneCount} completed task(s) to trash?`)) return;
  window.trash = window.trash || [];
  window.tasks = (window.tasks||[]).filter(t => {
    if (t.kanbanStatus==='done') { window.trash.push({...t, deletedAt:new Date().toISOString()}); return false; }
    return true;
  });
  if (typeof saveTasks === 'function') saveTasks();
  renderKanban(); renderAllAssessment();
});

/* ── Collapse done column ── */
document.getElementById('kanbanCollapseBtn')?.addEventListener('click', () => {
  kbCollapseDone = !kbCollapseDone;
  const doneCol = document.getElementById('kCol-done');
  const btn     = document.getElementById('kanbanCollapseBtn');
  if (kbCollapseDone) {
    doneCol.style.opacity = '0.55';
    doneCol.querySelector('.kanban-col-body').style.display = 'none';
    doneCol.querySelector('.kanban-col-footer').style.display = 'none';
    btn.innerHTML = '<i class="bi bi-arrows-expand"></i>';
    btn.title = 'Expand done';
  } else {
    doneCol.style.opacity = '';
    doneCol.querySelector('.kanban-col-body').style.display = '';
    doneCol.querySelector('.kanban-col-footer').style.display = '';
    btn.innerHTML = '<i class="bi bi-arrows-collapse"></i>';
    btn.title = 'Collapse done';
  }
});

/* ── Filters ── */
['kanbanProjectFilter','kanbanAssigneeFilter','kanbanPriorityFilter'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderKanban);
});

/* ── Build a single card DOM node ── */
function buildKanbanCard(t, idx) {
  const nowStr     = today();
  const isOverdue  = !t.completed && t.target && t.target < nowStr;
  const dueDays    = t.target ? Math.ceil((new Date(t.target) - new Date(nowStr)) / 86400000) : null;
  const subDone    = (t.subtasks||[]).filter(s=>s.done).length;
  const subTotal   = (t.subtasks||[]).length;
  const totalSecs  = (t.timeLogs||[]).reduce((a,l)=>a+l.secs,0);
  const priColor   = PRIORITY_COLORS[t.priority||'low'];

  const card = document.createElement('div');
  card.className  = 'kanban-card';
  card.draggable  = true;
  card.dataset.idx= idx;
  if (t.completed) card.style.opacity = '0.72';

  /* Priority left-bar */
  const bar = document.createElement('div');
  bar.className = 'kc-priority-bar';
  bar.style.background = priColor;
  card.appendChild(bar);

  /* Project tag */
  const proj = document.createElement('div');
  proj.className = 'kc-project';
  proj.innerHTML = `<i class="bi bi-folder2" style="font-size:.6rem"></i>${esc(t.project||'')}`;
  card.appendChild(proj);

  /* Title */
  const title = document.createElement('div');
  title.className = 'kc-title';
  title.innerHTML = `${t.completed ? '<s>' : ''}${esc(t.description||'(no title)')}${t.completed ? '</s>' : ''}`;
  card.appendChild(title);

  /* Badges row */
  const badges = document.createElement('div');
  badges.className = 'kc-badges';
  if (t.recurring) badges.insertAdjacentHTML('beforeend', `<span class="kc-badge" style="background:#e0f2fe;color:#0369a1">↻ ${t.recurring}</span>`);
  if (t.dependsOn) badges.insertAdjacentHTML('beforeend', `<span class="kc-badge" style="background:#fef3c7;color:#92400e">⛓ dep</span>`);
  if (t.attachments?.length) badges.insertAdjacentHTML('beforeend', `<span class="kc-badge">📎 ${t.attachments.length}</span>`);
  if (totalSecs)  badges.insertAdjacentHTML('beforeend', `<span class="kc-badge">⏱ ${fmtHours(totalSecs)}</span>`);
  if (badges.children.length) card.appendChild(badges);

  /* Subtask mini progress */
  if (subTotal) {
    const subPct = Math.round(subDone/subTotal*100);
    const subEl  = document.createElement('div');
    subEl.className = 'kc-sub-bar';
    subEl.style.marginTop = '6px';
    subEl.innerHTML = `<div class="bar"><div class="bar-fill" style="width:${subPct}%"></div></div><span style="font-size:.58rem;color:var(--muted)">${subDone}/${subTotal} subtasks</span>`;
    card.appendChild(subEl);
  }

  /* Footer: due date + assignees + action buttons */
  const footer = document.createElement('div');
  footer.className = 'kc-footer';

  /* Due date chip */
  const dueWrap = document.createElement('div');
  if (t.target) {
    let dueCls = 'on-track', dueTxt = t.target;
    if (isOverdue)         { dueCls='overdue';  dueTxt='⏰ '+t.target; }
    else if (dueDays !== null && dueDays <= 2) { dueCls='due-soon'; dueTxt='⚡ '+t.target; }
    dueWrap.innerHTML = `<span class="kc-due ${dueCls}">${dueTxt}</span>`;
  }
  footer.appendChild(dueWrap);

  /* Right side: assignees + quick actions */
  const rightWrap = document.createElement('div');
  rightWrap.style.cssText = 'display:flex;align-items:center;gap:6px';

  /* Assignee avatars */
  const avDiv = document.createElement('div');
  avDiv.className = 'kc-assignees';
  (t.assignees||[]).slice(0,3).forEach(n => {
    const mem = (window.members||[]).find(m=>m.name===n);
    const av  = document.createElement('div');
    av.className = 'kc-avatar';
    av.style.background = mem ? mem.color : '#6b7280';
    av.title     = n;
    av.textContent = initials(n);
    avDiv.appendChild(av);
  });
  if ((t.assignees||[]).length > 3) {
    const more = document.createElement('div');
    more.className = 'kc-avatar';
    more.style.background = '#6b7280';
    more.textContent = `+${t.assignees.length-3}`;
    avDiv.appendChild(more);
  }
  rightWrap.appendChild(avDiv);

  /* Quick action: edit */
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-sm';
  editBtn.style.cssText = 'padding:2px 5px;font-size:.65rem;border:none;background:none;color:var(--muted);opacity:0;transition:opacity .15s';
  editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
  editBtn.title = 'Edit task';
  editBtn.addEventListener('click', e => { e.stopPropagation(); editTask(idx); });
  rightWrap.appendChild(editBtn);

  /* Quick action: time */
  const timeBtn = document.createElement('button');
  timeBtn.className = 'btn btn-sm';
  timeBtn.style.cssText = 'padding:2px 5px;font-size:.65rem;border:none;background:none;color:var(--muted);opacity:0;transition:opacity .15s';
  timeBtn.innerHTML = '<i class="bi bi-stopwatch"></i>';
  timeBtn.title = 'Track time';
  timeBtn.addEventListener('click', e => { e.stopPropagation(); openTimeTracker(idx); });
  rightWrap.appendChild(timeBtn);

  /* Show/hide buttons on card hover */
  card.addEventListener('mouseenter', () => { editBtn.style.opacity='1'; timeBtn.style.opacity='1'; });
  card.addEventListener('mouseleave', () => { editBtn.style.opacity='0'; timeBtn.style.opacity='0'; });

  footer.appendChild(rightWrap);
  card.appendChild(footer);

  /* Drag events */
  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('taskIdx', idx);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => card.classList.add('dragging'));
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });
  card.addEventListener('dblclick', () => editTask(idx));

  return card;
}

/* ── Main render function (smooth DOM-diff, no full wipe) ── */
function renderKanban() {
  const nowStr = today();

  /* Sync filters */
  const kpf = document.getElementById('kanbanProjectFilter');
  const kaf = document.getElementById('kanbanAssigneeFilter');
  const krf = document.getElementById('kanbanPriorityFilter');
  const pf  = kpf.value;
  const af  = kaf ? kaf.value : '';
  const rf  = krf ? krf.value : '';

  kpf.innerHTML = '<option value="">All Projects</option>';
  (window.projects||[]).forEach(p => { const o=document.createElement('option'); o.value=p.name; o.textContent=p.name; kpf.appendChild(o); });
  kpf.value = pf;

  if (kaf) {
    kaf.innerHTML = '<option value="">All Members</option>';
    (window.members||[]).forEach(m => { const o=document.createElement('option'); o.value=m.name; o.textContent=m.name; kaf.appendChild(o); });
    kaf.value = af;
  }

  KANBAN_COLS.forEach(status => {
    const container = document.getElementById(`kCards-${status}`);
    if (!container) return;

    let tasks = (window.tasks||[]).filter(t => (t.kanbanStatus||'todo') === status);
    if (pf) tasks = tasks.filter(t => t.project === pf);
    if (af) tasks = tasks.filter(t => (t.assignees||[]).includes(af));
    if (rf) tasks = tasks.filter(t => t.priority === rf);

    /* Sort: overdue first, then by date */
    tasks.sort((a,b) => {
      const aOv = !a.completed && a.target && a.target < nowStr;
      const bOv = !b.completed && b.target && b.target < nowStr;
      if (aOv && !bOv) return -1;
      if (!aOv && bOv) return 1;
      return (a.target||'').localeCompare(b.target||'');
    });

    /* Update badge count */
    const countEl = document.getElementById(`kCount-${status}`);
    if (countEl) countEl.textContent = tasks.length;

    /* DOM diff: remove stale cards */
    const desired = new Set(tasks.map(t => String(window.tasks.indexOf(t))));
    Array.from(container.querySelectorAll('.kanban-card')).forEach(c => {
      if (!desired.has(c.dataset.idx)) {
        c.style.transition = 'opacity .14s, transform .14s';
        c.style.opacity    = '0';
        c.style.transform  = 'scale(.94)';
        setTimeout(() => c.isConnected && c.remove(), 150);
      }
    });

    /* Empty state */
    const emptyEl = container.querySelector('.kanban-empty');
    if (!tasks.length) {
      if (!emptyEl) {
        const emp = document.createElement('div');
        emp.className = 'kanban-empty';
        emp.innerHTML = `<i class="bi bi-inbox"></i><span>No tasks here</span>`;
        container.appendChild(emp);
      }
      return;
    }
    if (emptyEl) emptyEl.remove();

    /* Add / update cards */
    tasks.forEach((t, i) => {
      const idx     = window.tasks.indexOf(t);
      const newCard = buildKanbanCard(t, idx);
      const exists  = container.querySelector(`.kanban-card[data-idx="${idx}"]`);

      if (exists) {
        /* Only swap if visually different */
        const newKey = `${t.description}|${t.priority}|${t.kanbanStatus}|${t.completed}|${(t.assignees||[]).join(',')}|${(t.subtasks||[]).map(s=>s.done).join(',')}|${(t.timeLogs||[]).length}`;
        if (exists.dataset.key !== newKey) {
          exists.dataset.key = newKey;
          /* Fade-swap */
          exists.style.transition = 'opacity .1s';
          exists.style.opacity    = '0';
          setTimeout(() => {
            if (!exists.isConnected) return;
            newCard.dataset.key = newKey;
            newCard.style.opacity = '0';
            exists.replaceWith(newCard);
            requestAnimationFrame(() => {
              newCard.style.transition = 'opacity .14s';
              newCard.style.opacity    = '1';
            });
          }, 110);
        }
      } else {
        /* Slide-in new card */
        newCard.style.opacity   = '0';
        newCard.style.transform = 'translateY(8px)';
        newCard.dataset.key     = `${t.description}|${t.priority}|${t.kanbanStatus}|${t.completed}|${(t.assignees||[]).join(',')}|${(t.subtasks||[]).map(s=>s.done).join(',')}|${(t.timeLogs||[]).length}`;

        /* Insert at correct sorted position */
        const siblings = Array.from(container.querySelectorAll('.kanban-card'));
        const after    = siblings[i-1] || null;
        if (after && after.nextSibling) {
          container.insertBefore(newCard, after.nextSibling);
        } else if (!after) {
          container.insertBefore(newCard, container.firstChild);
        } else {
          container.appendChild(newCard);
        }

        requestAnimationFrame(() => {
          newCard.style.transition = 'opacity .2s, transform .2s';
          newCard.style.opacity    = '1';
          newCard.style.transform  = 'translateY(0)';
        });
      }
    });
  });
}

/* ══════════════════════════════════════════════
   PROJECTS
══════════════════════════════════════════════ */
function renderProjects() {
  const pl = document.getElementById('projectList');
  const tps = document.getElementById('taskProject');
  pl.innerHTML = '';
  tps.innerHTML = '<option value="">Select project</option>';
  (window.projects || []).forEach((p, i) => {
    const tasks = (window.tasks || []).filter(t => t.project === p.name);
    const done = tasks.filter(t => t.completed).length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const row = document.createElement('div'); row.className = 'proj-row';
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="fw-bold">${esc(p.name)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--muted)">${p.description ? esc(p.description) + ' · ' : ''}${tasks.length} tasks · ${pct}% done${p.due ? ` · Due: ${p.due}` : ''}</div>
        <div style="margin-top:5px;height:4px;background:var(--border-md);border-radius:99px;overflow:hidden;max-width:200px"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:99px;transition:width .4s"></div></div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-sm btn-outline-primary" onclick="openAddTaskForProject(${i})" title="Add task"><i class="bi bi-plus-lg"></i></button>
        <button class="btn btn-sm btn-outline-secondary" onclick="editProject(${i})" title="Edit"><i class="bi bi-pencil-square"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteProject(${i})" title="Delete"><i class="bi bi-trash3"></i></button>
      </div>`;
    pl.appendChild(row);
    const opt = document.createElement('option'); opt.value = p.name; opt.textContent = p.name; tps.appendChild(opt);
  });
  if (!(window.projects || []).length) pl.innerHTML = '<div class="text-muted card-panel">No projects yet. Click <strong>New Project</strong> to add one.</div>';
}
document.getElementById('openProjectModalBtn').addEventListener('click', openNewProject);
document.getElementById('addProjectBtnTop')?.addEventListener('click', openNewProject);
function openNewProject() {
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectName').value = '';
  document.getElementById('projectDesc').value = '';
  document.getElementById('projectStart').value = '';
  document.getElementById('projectDue').value = '';
  projectModal.show();
}
window.editProject = function(i) {
  const p = (window.projects || [])[i]; if (!p) return;
  document.getElementById('editProjectId').value = i;
  document.getElementById('projectName').value = p.name;
  document.getElementById('projectDesc').value = p.description || '';
  document.getElementById('projectStart').value = p.start || '';
  document.getElementById('projectDue').value = p.due || '';
  projectModal.show();
};
window.deleteProject = function(i) {
  const p = (window.projects || [])[i]; if (!p) return;
  if (!confirm('Delete this project and all its tasks?')) return;
  window.projects.splice(i, 1);
  window.tasks = (window.tasks || []).filter(t => t.project !== p.name);
  if (typeof saveProjects === 'function') saveProjects();
  if (typeof saveTasks === 'function') saveTasks();
  renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
};
document.getElementById('saveProject').addEventListener('click', () => {
  const name = document.getElementById('projectName').value.trim(); if (!name) return alert('Enter project name');
  const desc = document.getElementById('projectDesc').value.trim();
  const start = document.getElementById('projectStart').value;
  const due   = document.getElementById('projectDue').value;
  const idx   = document.getElementById('editProjectId').value;
  if (idx !== '') {
    const prev = window.projects[idx].name;
    window.projects[idx] = { ...window.projects[idx], name, description: desc, start, due };
    (window.tasks || []).forEach(t => { if (t.project === prev) t.project = name; });
  } else {
    window.projects.push({ id: Date.now(), name, description: desc, start, due });
  }
  if (typeof saveProjects === 'function') saveProjects();
  if (typeof saveTasks === 'function') saveTasks();
  if (document.activeElement) document.activeElement.blur();
  projectModal.hide();
  renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
});

/* ══════════════════════════════════════════════
   TASK MODAL
══════════════════════════════════════════════ */
function populateTaskModal() {
  const tps = document.getElementById('taskProject');
  tps.innerHTML = '<option value="">Select project</option>';
  (window.projects || []).forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; tps.appendChild(o); });
  const as = document.getElementById('taskAssignee');
  as.innerHTML = '<option value="">Unassigned</option>';
  (window.members || []).forEach(m => { const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; as.appendChild(o); });
  const dep = document.getElementById('taskDependsOn');
  dep.innerHTML = '<option value="">None</option>';
  (window.tasks || []).forEach(t => { if (t.description) { const o = document.createElement('option'); o.value = t.description; o.textContent = `${t.project ? t.project + ': ' : ''}${t.description}`; dep.appendChild(o); } });
}
document.getElementById('openTaskModalBtn').addEventListener('click', () => openNewTask());
function openNewTask(prefill) {
  populateTaskModal();
  document.getElementById('editTaskId').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskTarget').value = '';
  document.getElementById('taskPriority').value = 'low';
  document.getElementById('taskCompleted').checked = false;
  document.getElementById('taskKanbanStatus').value = 'todo';
  document.getElementById('taskAssignee').value = '';
  document.getElementById('taskRecurring').value = '';
  document.getElementById('taskDependsOn').value = '';
  document.getElementById('taskEstHours').value = '';
  document.getElementById('taskNotes').value = '';
  document.getElementById('existingAttachments').innerHTML = '';
  document.getElementById('taskFileInput').value = '';
  subtasksInModal = []; renderSubtasksInModal();
  if (prefill) document.getElementById('taskProject').value = prefill;
  taskModal.show();
}
window.openAddTaskForProject = function(i) { const p = (window.projects || [])[i]; if (!p) return; openNewTask(p.name); };
window.editTask = function(i) {
  const t = (window.tasks || [])[i]; if (!t) return;
  populateTaskModal();
  document.getElementById('editTaskId').value = i;
  document.getElementById('taskProject').value = t.project || '';
  document.getElementById('taskDesc').value = t.description || '';
  document.getElementById('taskTarget').value = t.target || '';
  document.getElementById('taskPriority').value = t.priority || 'low';
  document.getElementById('taskCompleted').checked = !!t.completed;
  document.getElementById('taskKanbanStatus').value = t.kanbanStatus || 'todo';
  document.getElementById('taskAssignee').value = (t.assignees || [])[0] || '';
  document.getElementById('taskRecurring').value = t.recurring || '';
  document.getElementById('taskDependsOn').value = t.dependsOn || '';
  document.getElementById('taskEstHours').value = t.estHours || '';
  document.getElementById('taskNotes').value = t.notes || '';
  document.getElementById('taskFileInput').value = '';
  const ea = document.getElementById('existingAttachments'); ea.innerHTML = '';
  (t.attachments || []).forEach((a, ai) => {
    ea.insertAdjacentHTML('beforeend', `<a class="attach-chip" href="${a.url}" target="_blank"><i class="bi bi-paperclip"></i>${esc(a.name)}</a> <button type="button" class="btn btn-sm btn-outline-danger" style="font-size:.6rem;padding:1px 5px" onclick="removeAttachment(${i},${ai})"><i class="bi bi-x"></i></button>`);
  });
  subtasksInModal = JSON.parse(JSON.stringify(t.subtasks || []));
  renderSubtasksInModal();
  taskModal.show();
};
window.removeAttachment = function(taskIdx, attachIdx) {
  if (!window.tasks[taskIdx]) return;
  window.tasks[taskIdx].attachments = (window.tasks[taskIdx].attachments || []).filter((_, i) => i !== attachIdx);
  if (typeof saveTasks === 'function') saveTasks();
  editTask(taskIdx);
};
document.getElementById('addSubtaskBtn').addEventListener('click', () => { subtasksInModal.push({ text: '', done: false }); renderSubtasksInModal(); });
function renderSubtasksInModal() {
  const sl = document.getElementById('subtaskList'); sl.innerHTML = '';
  subtasksInModal.forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'subtask-row';
    row.innerHTML = `<input type="checkbox" ${s.done ? 'checked' : ''} onchange="subtasksInModal[${i}].done=this.checked" style="accent-color:var(--accent);width:14px;height:14px"><input type="text" value="${esc(s.text)}" placeholder="Subtask description" class="form-control form-control-sm" style="flex:1" oninput="subtasksInModal[${i}].text=this.value"><button type="button" class="btn btn-sm btn-outline-danger" style="padding:1px 6px;font-size:var(--font-size-xs)" onclick="subtasksInModal.splice(${i},1);renderSubtasksInModal()"><i class="bi bi-x"></i></button>`;
    sl.appendChild(row);
  });
}
document.getElementById('saveTask').addEventListener('click', () => {
  const proj = document.getElementById('taskProject').value;
  const date = document.getElementById('taskTarget').value;
  if (!proj || !date) return alert('Select project and target date');
  const idx = document.getElementById('editTaskId').value;
  const prev = idx !== '' ? window.tasks[idx] : null;
  const isCompleted = document.getElementById('taskCompleted').checked;
  const assigneeVal = document.getElementById('taskAssignee').value;
  const saveData = (attachments) => {
    const t = {
      id: prev ? prev.id : Date.now(),
      project: proj,
      description: document.getElementById('taskDesc').value.trim(),
      target: date,
      priority: document.getElementById('taskPriority').value,
      completed: isCompleted,
      completedAt: isCompleted ? (prev && prev.completedAt ? prev.completedAt : today()) : null,
      kanbanStatus: document.getElementById('taskKanbanStatus').value,
      assignees: assigneeVal ? [assigneeVal] : [],
      recurring: document.getElementById('taskRecurring').value || null,
      dependsOn: document.getElementById('taskDependsOn').value || null,
      estHours: parseFloat(document.getElementById('taskEstHours').value) || null,
      notes: document.getElementById('taskNotes').value.trim(),
      subtasks: subtasksInModal.filter(s => s.text.trim()),
      attachments,
      timeLogs: prev ? prev.timeLogs || [] : []
    };
    if (idx !== '') window.tasks[idx] = t; else window.tasks.push(t);
    if (typeof saveTasks === 'function') saveTasks();
    if (document.activeElement) document.activeElement.blur();
    taskModal.hide();
    renderCalendar(); renderProjects(); renderAllAssessment(); renderKanban();
    addNotification(idx !== '' ? 'Task updated' : 'Task created', `"${t.description || ''}" in ${t.project}`, 'bi-check-circle');
  };
  const existingAttachments = prev ? prev.attachments || [] : [];
  const fileInput = document.getElementById('taskFileInput');
  if (fileInput.files[0]) {
    const f = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = e => saveData([...existingAttachments, { name: f.name, url: e.target.result, type: f.type }]);
    reader.readAsDataURL(f);
  } else {
    saveData(existingAttachments);
  }
});
window.deleteTaskByIndex = function(i) {
  if (!confirm('Delete this task?')) return;
  window.trash = window.trash || [];
  const removed = (window.tasks || []).splice(i, 1)[0];
  if (removed) window.trash.push({ ...removed, deletedAt: new Date().toISOString() });
  if (typeof saveTasks === 'function') saveTasks();
  renderCalendar(); renderProjects(); renderAllAssessment(); renderKanban();
};

/* ══════════════════════════════════════════════
   TEAM
══════════════════════════════════════════════ */
function renderTeam() {
  const ml = document.getElementById('memberList'); ml.innerHTML = '';
  (window.members || []).forEach((m, i) => {
    const tasks = (window.tasks || []).filter(t => (t.assignees || []).includes(m.name));
    const done = tasks.filter(t => t.completed).length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const card = document.createElement('div'); card.className = 'card-panel';
    const pendingTasks = tasks.filter(t => !t.completed);
    const overdueTasks = tasks.filter(t => !t.completed && t.target && t.target < today());
    const taskListHtml = tasks.length ? tasks.map(t => {
      const isOverdue = !t.completed && t.target && t.target < today();
      return `<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid var(--divider)">
        <span class="task-chip ${t.priority||''}" style="margin:0;padding:1px 5px;font-size:.6rem;flex-shrink:0">${t.priority||'low'}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--font-size-xs);${t.completed?'text-decoration:line-through;color:var(--muted)':''}">${esc(t.description||'(no title)')}</span>
        ${t.target ? `<span style="font-size:var(--font-size-xs);color:var(--muted);white-space:nowrap;flex-shrink:0">${t.target}</span>` : ''}
        ${isOverdue ? '<span style="color:#ef4444;font-size:.7rem;flex-shrink:0">⏰</span>' : ''}
        ${t.completed ? '<span style="color:#10b981;font-size:.7rem;flex-shrink:0">✅</span>' : ''}
      </div>`;
    }).join('') + `<div style="font-size:var(--font-size-xs);color:var(--muted);padding:5px 0 0;font-style:italic">${tasks.length} task${tasks.length!==1?'s':''} total</div>`
    : '<div style="color:var(--muted);font-size:var(--font-size-xs);padding:8px 0;text-align:center">No tasks assigned yet</div>';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="member-avatar" style="background:${m.color || '#0b74ff'}">${initials(m.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:var(--font-size-md)">${esc(m.name)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--muted)">${esc(m.role || 'Member')}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-outline-secondary" onclick="editMember(${i})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteMember(${i})"><i class="bi bi-trash3"></i></button>
        </div>
      </div>
      <div style="display:flex;gap:10px;font-size:var(--font-size-xs);margin-bottom:6px;flex-wrap:wrap">
        <span style="color:var(--muted)">📋 ${tasks.length} total</span>
        <span style="color:#10b981">✅ ${done} done</span>
        <span style="color:#f59e0b">⏳ ${pendingTasks.length} pending</span>
        ${overdueTasks.length ? `<span style="color:#ef4444">⏰ ${overdueTasks.length} overdue</span>` : ''}
      </div>
      ${tasks.length ? `<div style="height:4px;background:var(--border-md);border-radius:99px;overflow:hidden;margin-bottom:10px"><div style="height:100%;width:${pct}%;background:${m.color||'var(--accent)'};border-radius:99px;transition:width .4s"></div></div>` : ''}
      <details style="font-size:var(--font-size-sm)">
        <summary style="cursor:pointer;font-weight:600;color:var(--accent);font-size:var(--font-size-sm);margin-bottom:4px;list-style:none;display:flex;align-items:center;gap:5px">
          <i class="bi bi-list-task"></i> Task List
          <span style="background:var(--accent-dim);color:var(--accent);border-radius:99px;padding:0 6px;font-size:var(--font-size-xs);font-weight:700">${tasks.length}</span>
        </summary>
        <div style="max-height:200px;overflow-y:auto;margin-top:4px">${taskListHtml}</div>
      </details>`;
    ml.appendChild(card);
  });
  if (!window.members.length) ml.innerHTML = '<div class="text-muted card-panel" style="grid-column:1/-1">No team members yet. Click <strong>Add Member</strong>.</div>';
}
window.toggleMemberTasks = function(id) {
  const el = document.getElementById(id); if (!el) return;
  const showing = el.style.display !== 'none';
  el.style.display = showing ? 'none' : 'block';
};
document.getElementById('addMemberBtn').addEventListener('click', () => {
  document.getElementById('editMemberId').value = '';
  document.getElementById('memberName').value = '';
  document.getElementById('memberRole').value = '';
  selectedMemberColor = '#0b74ff';
  document.querySelectorAll('#memberColorPicker .accent-swatch').forEach(b => b.classList.toggle('active', b.dataset.mcolor === selectedMemberColor));
  memberModal.show();
});
document.querySelectorAll('#memberColorPicker .accent-swatch').forEach(b => {
  b.addEventListener('click', () => {
    selectedMemberColor = b.dataset.mcolor;
    document.querySelectorAll('#memberColorPicker .accent-swatch').forEach(x => x.classList.toggle('active', x === b));
  });
});
window.editMember = function(i) {
  const m = window.members[i]; if (!m) return;
  document.getElementById('editMemberId').value = i;
  document.getElementById('memberName').value = m.name;
  document.getElementById('memberRole').value = m.role || '';
  selectedMemberColor = m.color || '#0b74ff';
  document.querySelectorAll('#memberColorPicker .accent-swatch').forEach(b => b.classList.toggle('active', b.dataset.mcolor === selectedMemberColor));
  memberModal.show();
};
window.deleteMember = function(i) {
  if (!confirm('Remove this member?')) return;
  window.members.splice(i, 1); saveMembers(); renderTeam();
};
document.getElementById('saveMember').addEventListener('click', () => {
  const name = document.getElementById('memberName').value.trim(); if (!name) return alert('Enter name');
  const role = document.getElementById('memberRole').value.trim();
  const idx  = document.getElementById('editMemberId').value;
  if (idx !== '') window.members[idx] = { ...window.members[idx], name, role, color: selectedMemberColor };
  else window.members.push({ id: Date.now(), name, role, color: selectedMemberColor });
  saveMembers(); memberModal.hide(); renderTeam();
});
function saveMembers() {
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    const uid = firebase.auth().currentUser.uid;
    firebase.database().ref(`users/${uid}/members`).set(window.members);
  } else {
    localStorage.setItem('cymMembers', JSON.stringify(window.members));
  }
}
function loadMembers() {
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    const uid = firebase.auth().currentUser.uid;
    firebase.database().ref(`users/${uid}/members`).once('value').then(s => {
      window.members = s.val() ? Object.values(s.val()) : [];
    });
  } else {
    try { window.members = JSON.parse(localStorage.getItem('cymMembers') || '[]'); } catch(e) { window.members = []; }
  }
}

/* ══════════════════════════════════════════════
   TIME TRACKING
══════════════════════════════════════════════ */
function openTimeTracker(taskIdx) {
  const t = window.tasks[taskIdx]; if (!t) return;
  timerTaskId = taskIdx; timerSeconds = 0; timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timerDisplay').textContent = '00:00:00';
  document.getElementById('timeModalTaskName').textContent = `${t.project || ''}: ${t.description || ''}`;
  document.getElementById('timerStartBtn').disabled = false;
  document.getElementById('timerPauseBtn').disabled = true;
  document.getElementById('timerStopBtn').disabled = true;
  renderTimeLogs(t);
  timeModal.show();
}
function renderTimeLogs(t) {
  const list = document.getElementById('timeLogList'); list.innerHTML = '';
  const logs = t.timeLogs || [];
  if (!logs.length) { list.innerHTML = '<div style="color:var(--muted);font-size:var(--font-size-sm);text-align:center;padding:12px">No time logged yet.</div>'; return; }
  const total = logs.reduce((a, l) => a + l.secs, 0);
  logs.forEach(l => { list.insertAdjacentHTML('beforeend', `<div class="time-log-row"><span>${new Date(l.date).toLocaleDateString()}</span><span>${fmtSecs(l.secs)}</span></div>`); });
  list.insertAdjacentHTML('beforeend', `<div class="time-log-row" style="font-weight:700;color:var(--accent)"><span>Total</span><span>${fmtHours(total)}</span></div>`);
}
document.getElementById('timerStartBtn').addEventListener('click', () => {
  if (timerRunning) return; timerRunning = true;
  document.getElementById('timerStartBtn').disabled = true;
  document.getElementById('timerPauseBtn').disabled = false;
  document.getElementById('timerStopBtn').disabled = false;
  timerInterval = setInterval(() => { timerSeconds++; document.getElementById('timerDisplay').textContent = fmtSecs(timerSeconds); }, 1000);
});
document.getElementById('timerPauseBtn').addEventListener('click', () => {
  timerRunning = false; clearInterval(timerInterval);
  document.getElementById('timerStartBtn').disabled = false;
  document.getElementById('timerPauseBtn').disabled = true;
});
document.getElementById('timerStopBtn').addEventListener('click', () => {
  clearInterval(timerInterval); timerRunning = false;
  if (timerSeconds < 3) { alert('Timer too short to log.'); return; }
  const t = window.tasks[timerTaskId]; if (!t) return;
  t.timeLogs = t.timeLogs || [];
  t.timeLogs.push({ date: new Date().toISOString(), secs: timerSeconds });
  if (typeof saveTasks === 'function') saveTasks();
  renderTimeLogs(t);
  timerSeconds = 0;
  document.getElementById('timerDisplay').textContent = '00:00:00';
  document.getElementById('timerStartBtn').disabled = false;
  document.getElementById('timerPauseBtn').disabled = true;
  document.getElementById('timerStopBtn').disabled = true;
  addNotification('Time logged', `${fmtHours(t.timeLogs[t.timeLogs.length-1].secs)} for "${t.description || ''}"`, 'bi-stopwatch');
  renderAllAssessment();
});
window.openTimeTracker = openTimeTracker;

/* ══════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════ */
function addNotification(title, body, icon) {
  window.notifications = window.notifications || [];
  // Deduplicate: ignore if exact same title+body fired within last 3 seconds
  const last = window.notifications[0];
  if (last && last.title === title && last.body === body && Date.now() - new Date(last.time).getTime() < 3000) return;
  window.notifications.unshift({ id: Date.now(), title, body, icon: icon || 'bi-bell', unread: true, time: new Date().toISOString() });
  window.notifications = window.notifications.slice(0, 50);
  updateNotifBadge();
}
function updateNotifBadge() {
  const count = (window.notifications || []).filter(n => n.unread).length;
  const badge = document.getElementById('notifBadge');
  badge.style.display = count ? '' : 'none';
  badge.textContent = count > 9 ? '9+' : count;
}
function renderNotifPanel() {
  const list = document.getElementById('notifList');
  const notifs = window.notifications || [];
  if (!notifs.length) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:var(--font-size-sm)">No notifications yet.</div>'; return; }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
      <div class="notif-icon"><i class="bi ${n.icon || 'bi-bell'}"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:var(--font-size-sm)">${esc(n.title)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--muted)">${esc(n.body)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:2px">${new Date(n.time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      ${n.unread ? '<div class="notif-dot" style="margin-top:6px;flex-shrink:0"></div>' : ''}
    </div>`).join('');
}
window.markNotifRead = function(id) { const n = (window.notifications || []).find(x => x.id === id); if (n) n.unread = false; updateNotifBadge(); renderNotifPanel(); };
document.getElementById('markAllReadBtn').addEventListener('click', () => { (window.notifications || []).forEach(n => n.unread = false); updateNotifBadge(); renderNotifPanel(); });
const notifPanel = document.getElementById('notifPanel');
document.getElementById('notifBellBtn').addEventListener('click', e => {
  e.stopPropagation();
  const showing = notifPanel.style.display === 'flex';
  notifPanel.style.display = showing ? 'none' : 'flex';
  if (!showing) renderNotifPanel();
});
document.addEventListener('click', e => { if (!notifPanel.contains(e.target) && e.target.id !== 'notifBellBtn') notifPanel.style.display = 'none'; });

/* ══════════════════════════════════════════════
   ASSESSMENT
══════════════════════════════════════════════ */
function populateAssessControls() {
  const fp = document.getElementById('filterProject');
  const prev = fp.value || '';
  fp.innerHTML = '<option value="">All Projects</option>';
  (window.projects || []).forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; fp.appendChild(o); });
  if (prev) { const m = Array.from(fp.options).find(o => o.value.toLowerCase() === prev.toLowerCase()); if (m) fp.value = m.value; }
}
function renderAllAssessment() {
  populateAssessControls();
  const projF = (document.getElementById('filterProject').value || '').trim().toLowerCase();
  const prioF = document.getElementById('filterPriority').value;
  const statF = document.getElementById('filterStatus').value;
  const from  = document.getElementById('filterFrom').value;
  const to    = document.getElementById('filterTo').value;
  let list = (window.tasks || []).slice();
  if (projF) list = list.filter(t => (t.project || '').toLowerCase() === projF);
  if (prioF) list = list.filter(t => (t.priority || '') === prioF);
  if (statF) list = list.filter(t => statF === 'completed' ? t.completed : !t.completed);
  if (from)  list = list.filter(t => t.target && t.target >= from);
  if (to)    list = list.filter(t => t.target && t.target <= to);
  list = applySort(list);
  renderKPIs(list); renderTable(list); renderCharts(list); renderTrash();
}
function renderKPIs(list) {
  const now = today();
  document.getElementById('kpProjects').textContent  = (window.projects || []).length;
  document.getElementById('kpTasks').textContent     = (window.tasks || []).length;
  const completed = list.filter(t => t.completed).length;
  document.getElementById('kpCompleted').textContent = completed;
  document.getElementById('kpPending').textContent   = list.filter(t => !t.completed).length;
  document.getElementById('kpOverdue').textContent   = list.filter(t => !t.completed && t.target && t.target < now).length;
  const total = list.length, pct = total ? Math.round(completed / total * 100) : 0;
  document.getElementById('progressTotal').textContent = total;
  document.getElementById('progressBar').style.width   = pct + '%';
  document.getElementById('progressTxt').textContent   = pct + '% completed';
}
function getGlobalIndex(task) {
  const arr = window.tasks || [];
  const idx = arr.indexOf(task);
  if (idx >= 0) return idx;
  return arr.findIndex(t => t.description === task.description && t.target === task.target && t.project === task.project);
}
function renderTable(list) {
  const tb = document.getElementById('taskBody'); tb.innerHTML = '';
  list.forEach((t, i) => {
    const now = today();
    const statusHtml = t.completed
      ? '<span class="badge" style="background:#10b981;font-size:.65rem">✅ Done</span>'
      : (t.target && t.target < now
          ? '<span class="badge bg-danger" style="font-size:.65rem">⏰ Overdue</span>'
          : '<span class="badge bg-warning text-dark" style="font-size:.65rem">⌛ Pending</span>');
    const assigneeHtml = (t.assignees || []).map(n => {
      const m = (window.members || []).find(m => m.name === n);
      return `<div class="kc-avatar" style="background:${m ? m.color : rndColor()};width:20px;height:20px;font-size:.55rem" title="${esc(n)}">${initials(n)}</div>`;
    }).join('') || '<span style="color:var(--muted);font-size:var(--font-size-xs)">—</span>';
    const totalSecs = (t.timeLogs || []).reduce((a, l) => a + l.secs, 0);
    const subDone = (t.subtasks || []).filter(s => s.done).length;
    const subTotal = (t.subtasks || []).length;
    const gi = getGlobalIndex(t);
    tb.insertAdjacentHTML('beforeend', `<tr>
      <td>${i + 1}</td>
      <td>${esc(t.project || '-')}</td>
      <td>${esc(t.description || '')}${t.recurring ? `<span class="badge-recurring ms-1">↻</span>` : ''}${subTotal ? `<br><small style="color:var(--muted)">${subDone}/${subTotal} subtasks</small>` : ''}</td>
      <td>${esc(t.target || '')}</td>
      <td><span class="task-chip ${t.priority || ''}" style="margin:0">${t.priority || 'low'}</span></td>
      <td>${statusHtml}</td>
      <td><div style="display:flex;gap:3px;flex-wrap:wrap">${assigneeHtml}</div></td>
      <td style="font-size:var(--font-size-xs);color:var(--muted)">${totalSecs ? fmtHours(totalSecs) : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="editTask(${gi})" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openTimeTracker(${gi})" title="Time tracker"><i class="bi bi-stopwatch"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTaskByIndex(${gi})" title="Delete"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`);
  });
}
function applySort(list) {
  if (!currentSort.key) return list;
  const { key, asc } = currentSort;
  return [...list].sort((a, b) => {
    let vA, vB;
    switch (key) {
      case 'project':     vA = (a.project || '').toLowerCase();     vB = (b.project || '').toLowerCase(); break;
      case 'description': vA = (a.description || '').toLowerCase(); vB = (b.description || '').toLowerCase(); break;
      case 'target':      vA = a.target || '';                      vB = b.target || ''; break;
      case 'priority':    { const o = {low:1,medium:2,high:3}; vA = o[a.priority]||0; vB = o[b.priority]||0; break; }
      case 'status':      { const gs = t => t.completed ? 3 : (t.target && t.target < today() ? 1 : 2); vA = gs(a); vB = gs(b); break; }
      default: vA = ''; vB = '';
    }
    return vA < vB ? (asc ? -1 : 1) : vA > vB ? (asc ? 1 : -1) : 0;
  });
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sortable').forEach(h => {
    h.addEventListener('click', () => {
      const key = h.getAttribute('data-key');
      if (currentSort.key === key) currentSort.asc = !currentSort.asc;
      else { currentSort.key = key; currentSort.asc = true; }
      document.querySelectorAll('.sortable').forEach(x => { x.classList.remove('active'); const ic = x.querySelector('.sort-icon'); if (ic) ic.textContent = ''; });
      h.classList.add('active');
      const ic = h.querySelector('.sort-icon'); if (ic) ic.textContent = currentSort.asc ? '▲' : '▼';
      renderAllAssessment();
    });
  });
});
function renderCharts(list) {
  const status = { completed: 0, pending: 0 };
  const prio   = { low: 0, medium: 0, high: 0 };
  list.forEach(t => { if (t.completed) status.completed++; else status.pending++; if (prio[t.priority] != null) prio[t.priority]++; });
  if (statusChart)   statusChart.destroy();
  if (priorityChart) priorityChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart').getContext('2d'), { type:'doughnut', data:{ labels:['Completed','Pending'], datasets:[{ data:[status.completed,status.pending], backgroundColor:['#10b981','#f59e0b'] }] }, options:{ cutout:'70%', plugins:{ legend:{ position:'bottom', labels:{ boxWidth:8, boxHeight:8 } } } } });
  priorityChart = new Chart(document.getElementById('priorityChart').getContext('2d'), { type:'bar', data:{ labels:['Low','Medium','High'], datasets:[{ data:[prio.low,prio.medium,prio.high], backgroundColor:['#3ddc84','#f59e0b','#ef4444'], barThickness:16 }] }, options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
}
function renderTrash() {
  const tb = document.getElementById('trashBody'); tb.innerHTML = '';
  (window.trash || []).forEach((t, i) => { tb.insertAdjacentHTML('beforeend', `<tr><td>${i+1}</td><td>${esc(t.description||'')}</td><td>${new Date(t.deletedAt||'').toLocaleString()}</td><td><button class="btn btn-sm btn-success me-1" onclick="restore(${i})">Restore</button><button class="btn btn-sm btn-danger" onclick="permanentDeleteConfirm(${i})">Delete</button></td></tr>`); });
}
function restore(i) {
  if (typeof restoreFromTrash === 'function') { restoreFromTrash(i); if (typeof loadAllData === 'function') loadAllData(() => { renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban(); }); }
  else { const item = (window.trash || []).splice(i, 1)[0]; if (item) { delete item.deletedAt; (window.tasks = window.tasks || []).push(item); if (typeof saveTasks === 'function') saveTasks(); renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban(); } }
}
function permanentDeleteConfirm(i) {
  if (!confirm('Permanently delete?')) return;
  if (typeof deletePermanently === 'function') deletePermanently(i); else (window.trash || []).splice(i, 1);
  if (typeof loadAllData === 'function') loadAllData(() => { renderProjects(); renderCalendar(); renderAllAssessment(); });
}
document.getElementById('applyFilters').addEventListener('click', renderAllAssessment);
document.getElementById('resetFilters').addEventListener('click', () => {
  ['filterProject','filterPriority','filterStatus','filterFrom','filterTo'].forEach(id => document.getElementById(id).value = '');
  renderAllAssessment();
});
document.getElementById('assessSearch').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderAllAssessment();
  const list = (window.tasks || []).filter(t => (t.description || '').toLowerCase().includes(q) || (t.project || '').toLowerCase().includes(q));
  renderKPIs(list); renderTable(list); renderCharts(list); renderTrash();
});

/* ══════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════ */
function renderReports() {
  const tasks = window.tasks || [];
  const now = today();
  const done = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => !t.completed && t.target && t.target < now).length;
  const totalSecs = tasks.reduce((a, t) => (t.timeLogs || []).reduce((b, l) => b + l.secs, a), 0);
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  document.getElementById('reportKpiGrid').innerHTML = `
    <div class="report-kpi"><div class="rk-num">${(window.projects||[]).length}</div><div class="rk-label">Projects</div></div>
    <div class="report-kpi"><div class="rk-num">${tasks.length}</div><div class="rk-label">Total Tasks</div></div>
    <div class="report-kpi"><div class="rk-num" style="color:#10b981">${done}</div><div class="rk-label">Completed</div></div>
    <div class="report-kpi"><div class="rk-num" style="color:#ef4444">${overdue}</div><div class="rk-label">Overdue</div></div>
    <div class="report-kpi"><div class="rk-num" style="color:var(--accent)">${pct}%</div><div class="rk-label">Progress</div></div>
    <div class="report-kpi"><div class="rk-num">${fmtHours(totalSecs)}</div><div class="rk-label">Time Logged</div></div>`;
  // Burndown — 30 days
  const days30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 29 + i); return d.toISOString().split('T')[0]; });
  const burnData = days30.map(day => tasks.filter(t => !t.completed || (t.completedAt && t.completedAt > day)).length);
  if (burndownChart) burndownChart.destroy();
  burndownChart = new Chart(document.getElementById('burndownChart').getContext('2d'), {
    type: 'line',
    data: { labels: days30.map(d => d.slice(5)), datasets: [{ label: 'Remaining', data: burnData, borderColor: 'var(--accent)', backgroundColor: 'rgba(11,116,255,.1)', fill: true, tension: .3, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
  // Workload
  const members = window.members || [];
  const wLabels = members.length ? members.map(m => m.name) : ['Unassigned'];
  const wData   = members.length ? members.map(m => tasks.filter(t => (t.assignees || []).includes(m.name)).length) : [tasks.filter(t => !(t.assignees || []).length).length];
  const wColors = members.length ? members.map(m => m.color || '#0b74ff') : ['#0b74ff'];
  if (workloadChart) workloadChart.destroy();
  workloadChart = new Chart(document.getElementById('workloadChart').getContext('2d'), {
    type: 'bar',
    data: { labels: wLabels, datasets: [{ data: wData, backgroundColor: wColors, barThickness: 20 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
  // Velocity — 8 weeks
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 7 * (7 - i)); return d.toISOString().split('T')[0]; });
  const velData = weeks.map((w, i) => { const next = i < 7 ? weeks[i + 1] : today(); return tasks.filter(t => t.completedAt && t.completedAt >= w && t.completedAt < next).length; });
  if (velocityChart) velocityChart.destroy();
  velocityChart = new Chart(document.getElementById('velocityChart').getContext('2d'), {
    type: 'bar',
    data: { labels: weeks.map(d => d.slice(5)), datasets: [{ label: 'Done', data: velData, backgroundColor: '#10b981', barThickness: 16 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
  // Time by project
  const ts = document.getElementById('timeTrackSummary');
  if (!totalSecs) { ts.innerHTML = '<div style="color:var(--muted);font-size:var(--font-size-sm)">No time logged yet. Use the ⏱ stopwatch on any task.</div>'; return; }
  const byProj = {};
  tasks.forEach(t => { const s = (t.timeLogs || []).reduce((a, l) => a + l.secs, 0); if (s) byProj[t.project] = (byProj[t.project] || 0) + s; });
  ts.innerHTML = Object.entries(byProj).sort((a, b) => b[1] - a[1]).map(([p, s]) => `<div class="time-log-row"><span>${esc(p)}</span><span style="color:var(--accent);font-weight:600">${fmtHours(s)}</span></div>`).join('');
}

/* ══════════════════════════════════════════════
   CSV EXPORT / IMPORT
══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   BACKUP, RESTORE & CSV
   Full backup = JSON containing every field from
   Firebase (projects, tasks, trash, members,
   milestones) + app settings from localStorage.
══════════════════════════════════════════════ */

/* ── Helpers ── */
function setBackupStatus(msg, isError) {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#ef4444' : '#10b981';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Full JSON backup ── */
async function fullBackup() {
  try {
    setBackupStatus('Preparing backup…');

    // Collect Firebase milestones for current user
    let savedMilestones = milestones || [];
    if (userId) {
      try {
        const snap = await firebase.database().ref(`users/${userId}/milestones`).once('value');
        savedMilestones = snap.val() ? Object.values(snap.val()) : [];
      } catch(e) { /* use in-memory */ }
    }

    // Collect members from Firebase
    let savedMembers = window.members || [];
    if (userId) {
      try {
        const snap = await firebase.database().ref(`users/${userId}/members`).once('value');
        savedMembers = snap.val() ? Object.values(snap.val()) : [];
      } catch(e) { /* use in-memory */ }
    }

    // Settings from localStorage
    const settings = {
      cymAccent:      localStorage.getItem('cymAccent')      || '',
      cymDark:        localStorage.getItem('cymDark')        || '0',
      cymDensity:     localStorage.getItem('cymDensity')     || 'default',
      cymDefaultSort: localStorage.getItem('cymDefaultSort') || '',
      cymWeekStart:   localStorage.getItem('cymWeekStart')   || '0',
      cymWeekOff:     localStorage.getItem('cymWeekOff')     || '',
      cymSpecificOff: localStorage.getItem('cymSpecificOff') || '[]',
      cymOverdueAlert:localStorage.getItem('cymOverdueAlert')|| '1',
    };

    const backup = {
      _version:   2,
      _exportedAt: new Date().toISOString(),
      _exportedBy: firebase.auth().currentUser?.email || 'unknown',
      projects:   window.projects  || [],
      tasks:      window.tasks     || [],
      trash:      window.trash     || [],
      members:    savedMembers,
      milestones: savedMilestones,
      settings,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `cyman_full_backup_${today()}.json`);

    const totalItems = backup.projects.length + backup.tasks.length + backup.members.length + backup.milestones.length;
    setBackupStatus(`✅ Backup downloaded — ${backup.projects.length} projects, ${backup.tasks.length} tasks, ${backup.members.length} members, ${backup.milestones.length} milestones`);
    addNotification('Backup complete', `${totalItems} items exported to JSON`, 'bi-shield-check');
  } catch(err) {
    console.error('Backup error:', err);
    setBackupStatus('❌ Backup failed: ' + err.message, true);
  }
}

/* ── Full JSON restore ── */
async function fullRestore(file) {
  if (!file) return alert('Select a backup file (.json)');
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const backup = JSON.parse(e.target.result);

      // Validate
      if (!backup.projects && !backup.tasks) {
        setBackupStatus('❌ Invalid backup file — missing projects and tasks', true);
        return;
      }

      const version   = backup._version || 1;
      const exportedAt = backup._exportedAt ? new Date(backup._exportedAt).toLocaleString() : 'unknown';
      const summary   = [
        `${(backup.projects||[]).length} projects`,
        `${(backup.tasks||[]).length} tasks`,
        `${(backup.trash||[]).length} trash items`,
        `${(backup.members||[]).length} members`,
        `${(backup.milestones||[]).length} milestones`,
      ].join(', ');

      if (!confirm(`Restore backup from ${exportedAt}?

Contains: ${summary}

⚠️ This will REPLACE all current data. Continue?`)) return;

      setBackupStatus('Restoring…');

      // Restore data arrays
      window.projects = backup.projects  || [];
      window.tasks    = backup.tasks     || [];
      window.trash    = backup.trash     || [];
      window.members  = backup.members   || [];

      // Ensure all tasks have required fields
      const now = today();
      window.tasks.forEach(t => {
        if (!t.id)            t.id            = Date.now() + Math.random();
        if (!t.kanbanStatus)  t.kanbanStatus  = t.completed ? 'done' : 'todo';
        if (!t.assignees)     t.assignees     = [];
        if (!t.subtasks)      t.subtasks      = [];
        if (!t.timeLogs)      t.timeLogs      = [];
        if (!t.attachments)   t.attachments   = [];
        if (t.completed && !t.completedAt) t.completedAt = t.target || now;
      });

      // Ensure all projects have required fields
      window.projects.forEach(p => {
        if (!p.id) p.id = Date.now() + Math.random();
      });

      // Save everything to Firebase
      if (typeof saveProjects === 'function') saveProjects();
      if (typeof saveTasks    === 'function') saveTasks();
      if (typeof saveTrash    === 'function') saveTrash();

      // Save members to Firebase
      if (userId && window.members.length) {
        try {
          await firebase.database().ref(`users/${userId}/members`).set(window.members);
        } catch(e) { console.warn('Members save failed:', e); }
      }

      // Save milestones to Firebase
      if (userId && backup.milestones && backup.milestones.length) {
        try {
          const msObj = {};
          backup.milestones.forEach(m => { if (m.id) msObj[m.id] = m; });
          await firebase.database().ref(`users/${userId}/milestones`).set(msObj);
          milestones = backup.milestones;
        } catch(e) { console.warn('Milestones save failed:', e); }
      }

      // Restore settings (but never force dark/light — user keeps their preference)
      if (backup.settings) {
        const s = backup.settings;
        if (s.cymAccent)       { localStorage.setItem('cymAccent', s.cymAccent); document.documentElement.style.setProperty('--accent', s.cymAccent); }
        if (s.cymDensity)        localStorage.setItem('cymDensity',      s.cymDensity);
        if (s.cymDefaultSort)    localStorage.setItem('cymDefaultSort',   s.cymDefaultSort);
        if (s.cymWeekStart)      localStorage.setItem('cymWeekStart',     s.cymWeekStart);
        if (s.cymWeekOff)        localStorage.setItem('cymWeekOff',       s.cymWeekOff);
        if (s.cymSpecificOff)    localStorage.setItem('cymSpecificOff',   s.cymSpecificOff);
        if (s.cymOverdueAlert)   localStorage.setItem('cymOverdueAlert',  s.cymOverdueAlert);
      }

      // Re-render everything
      renderProjects();
      renderCalendar();
      renderAllAssessment();
      renderKanban();
      renderTeam();
      renderTimeline();

      setBackupStatus(`✅ Restore complete — ${summary}`);
      addNotification('Restore complete', summary, 'bi-shield-check');
    } catch(err) {
      console.error('Restore error:', err);
      setBackupStatus('❌ Restore failed: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

/* ── CSV export (flat, for spreadsheets) ── */
function exportToCSV() {
  const headers = [
    'project','description','target','priority','completed','completedAt',
    'kanbanStatus','assignees','recurring','dependsOn','estHours',
    'notes','subtasks_total','subtasks_done','time_logged_hours',
    'attachments_count','tags'
  ];
  const rows = (window.tasks || []).map(t => {
    const subDone  = (t.subtasks   || []).filter(s => s.done).length;
    const subTotal = (t.subtasks   || []).length;
    const totalSecs= (t.timeLogs   || []).reduce((a,l) => a + l.secs, 0);
    return [
      t.project         || '',
      t.description     || '',
      t.target          || '',
      t.priority        || 'low',
      t.completed       ? '1' : '0',
      t.completedAt     || '',
      t.kanbanStatus    || 'todo',
      (t.assignees      || []).join(';'),
      t.recurring       || '',
      t.dependsOn       || '',
      t.estHours        || '',
      (t.notes          || '').replace(/
/g,' '),
      subTotal,
      subDone,
      (totalSecs / 3600).toFixed(2),
      (t.attachments    || []).length,
      '',
    ];
  });
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `cyman_tasks_${today()}.csv`);
  addNotification('CSV exported', `${rows.length} tasks exported`, 'bi-filetype-csv');
}

/* ── CSV import (flat, adds to existing data) ── */
function importFromCSVFile(file) {
  if (!file) return alert('Select a CSV file');
  const reader = new FileReader();
  reader.onload = function(e) {
    const lines = e.target.result.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return alert('CSV looks empty');

    // Parse header to find column indices
    const rawHeader = lines[0].split(',').map(h => h.replace(/^\"|\"$/g,'').trim().toLowerCase());
    const col = name => rawHeader.indexOf(name);

    const items = lines.slice(1).map(line => {
      // Proper CSV parse (handles quoted commas)
      const cols = [];
      let cur = '', inQ = false;
      for (let i = 0; i <= line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
        else if (i === line.length)  { cols.push(cur); }
        else { cur += ch; }
      }
      const g = i => (cols[i] || '').trim();
      return {
        id:           Date.now() + Math.random(),
        project:      g(col('project')),
        description:  g(col('description')),
        target:       g(col('target')),
        priority:     g(col('priority')) || 'low',
        completed:    g(col('completed')) === '1' || g(col('completed')) === 'true',
        completedAt:  g(col('completedat')) || null,
        kanbanStatus: g(col('kanbanstatus')) || (g(col('completed'))==='1'?'done':'todo'),
        assignees:    g(col('assignees')) ? g(col('assignees')).split(';').filter(Boolean) : [],
        recurring:    g(col('recurring'))  || null,
        dependsOn:    g(col('dependson'))  || null,
        estHours:     parseFloat(g(col('esthours'))) || null,
        notes:        g(col('notes'))      || '',
        subtasks:     [],
        timeLogs:     [],
        attachments:  [],
      };
    }).filter(it => it.description || it.target);

    window.projects = window.projects || [];
    window.tasks    = window.tasks    || [];
    const pNames    = new Set(window.projects.map(p => p.name));
    items.forEach(it => {
      if (it.project && !pNames.has(it.project)) {
        window.projects.push({ id: Date.now()+Math.random(), name: it.project });
        pNames.add(it.project);
      }
    });
    window.tasks.push(...items);

    if (typeof saveProjects === 'function') saveProjects();
    if (typeof saveTasks    === 'function') saveTasks();
    alert(`✅ Imported ${items.length} tasks.`);
    renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
    addNotification('CSV imported', `${items.length} tasks added`, 'bi-filetype-csv');
  };
  reader.readAsText(file);
}

/* ── Wire up all buttons ── */
document.getElementById('fullBackupBtn')?.addEventListener('click', fullBackup);
document.getElementById('backupBtn')?.addEventListener('click', fullBackup);

document.getElementById('restoreFile')?.addEventListener('change', function() {
  if (this.files[0]) fullRestore(this.files[0]);
  this.value = ''; // reset so same file can be re-selected
});

document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);
document.getElementById('importCsvBtn')?.addEventListener('click', () => {
  importFromCSVFile(document.getElementById('importFile').files[0]);
});

document.getElementById('clearDataBtn')?.addEventListener('click', () => {
  if (!confirm('Clear ALL projects, tasks and trash? This cannot be undone.')) return;
  window.projects = []; window.tasks = []; window.trash = [];
  if (typeof saveProjects === 'function') saveProjects();
  if (typeof saveTasks    === 'function') saveTasks();
  if (typeof saveTrash    === 'function') saveTrash();
  renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
  addNotification('Data cleared', 'All projects and tasks removed', 'bi-trash3');
});

/* ══════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════ */
function refreshSettingsStats() {
  const tasks = window.tasks || [], projects = window.projects || [];
  const now = today();
  const done = tasks.filter(t => t.completed).length;
  const pending = tasks.filter(t => !t.completed).length;
  const overdue = tasks.filter(t => !t.completed && t.target && t.target < now).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const s = id => document.getElementById(id);
  if (s('setStatProjects')) s('setStatProjects').textContent = projects.length;
  if (s('setStatDone'))     s('setStatDone').textContent     = done;
  if (s('setStatPending'))  s('setStatPending').textContent  = pending;
  if (s('setStatOverdue'))  s('setStatOverdue').textContent  = overdue;
  if (s('setProgressBar'))  s('setProgressBar').style.width  = pct + '%';
  if (s('setProgressPct'))  s('setProgressPct').textContent  = pct + '%';
  const alertOn = localStorage.getItem('cymOverdueAlert') !== '0';
  const banner = s('overdueAlertBanner');
  if (banner) {
    if (alertOn && overdue > 0) {
      banner.style.display = '';
      if (s('overdueAlertText')) s('overdueAlertText').textContent = `You have ${overdue} overdue task${overdue > 1 ? 's' : ''}!`;
    } else {
      banner.style.display = 'none';
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // Accent
  const savedAccent = localStorage.getItem('cymAccent') || '#0b74ff';
  document.documentElement.style.setProperty('--accent', savedAccent);
  document.querySelectorAll('#accentPicker .accent-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === savedAccent);
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      localStorage.setItem('cymAccent', color);
      document.documentElement.style.setProperty('--accent', color);
      const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
      document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.09)`);
      document.documentElement.style.setProperty('--accent-mid', `rgba(${r},${g},${b},0.17)`);
      document.querySelectorAll('#accentPicker .accent-swatch').forEach(s => s.classList.toggle('active', s === btn));
    });
  });
  // Density
  const savedDensity = localStorage.getItem('cymDensity') || 'default';
  const padMap = { compact:'5px 6px', default:'7px 8px', comfy:'10px 10px' };
  function applyDensity(d) { document.querySelectorAll('.nav a').forEach(a => a.style.padding = padMap[d] || padMap.default); localStorage.setItem('cymDensity', d); }
  const dr = document.querySelector(`input[name="sidebarDensity"][value="${savedDensity}"]`); if (dr) dr.checked = true;
  applyDensity(savedDensity);
  document.querySelectorAll('input[name="sidebarDensity"]').forEach(r => r.addEventListener('change', () => applyDensity(r.value)));
  // Default sort
  const savedSort = localStorage.getItem('cymDefaultSort') || '';
  const dss = document.getElementById('defaultSortSelect'); if (dss) { dss.value = savedSort; dss.addEventListener('change', () => localStorage.setItem('cymDefaultSort', dss.value)); }
  // Week start
  const savedWeek = localStorage.getItem('cymWeekStart') || '0';
  const wr = document.querySelector(`input[name="weekStart"][value="${savedWeek}"]`); if (wr) wr.checked = true;
  document.querySelectorAll('input[name="weekStart"]').forEach(r => r.addEventListener('change', () => { localStorage.setItem('cymWeekStart', r.value); renderCalendar(); }));
  // Overdue toggle
  const oat = document.getElementById('overdueAlertToggle');
  if (oat) { oat.checked = localStorage.getItem('cymOverdueAlert') !== '0'; oat.addEventListener('change', () => { localStorage.setItem('cymOverdueAlert', oat.checked ? '1' : '0'); refreshSettingsStats(); }); }

  // ── Week-off recurring days ──
  function getWeekOffDays() {
    return (localStorage.getItem('cymWeekOff') || '').split(',').map(Number).filter(n => !isNaN(n));
  }
  function syncWeekOffButtons() {
    const cur = getWeekOffDays();
    document.querySelectorAll('.weekoff-btn').forEach(btn => {
      btn.classList.toggle('active', cur.includes(parseInt(btn.dataset.day)));
    });
  }
  syncWeekOffButtons();
  document.querySelectorAll('.weekoff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.day);
      const cur = getWeekOffDays();
      const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
      localStorage.setItem('cymWeekOff', next.join(','));
      syncWeekOffButtons();
      renderCalendar();
    });
  });

  // ── Specific off dates (holidays / leaves) ──
  function getSpecificOffDates() {
    try { return JSON.parse(localStorage.getItem('cymSpecificOff') || '[]'); } catch(e) { return []; }
  }
  function saveSpecificOffDates(arr) {
    localStorage.setItem('cymSpecificOff', JSON.stringify(arr));
  }
  function renderSpecificOffList() {
    const list = document.getElementById('specificOffList'); if (!list) return;
    const dates = getSpecificOffDates();
    if (!dates.length) { list.innerHTML = '<span style="color:var(--muted);font-size:var(--font-size-xs)">No specific dates added yet.</span>'; return; }
    list.innerHTML = dates.map((item, i) =>
      `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--soft);color:var(--accent);border:1px solid var(--accent-mid);border-radius:6px;padding:3px 8px;font-size:var(--font-size-xs);font-weight:600">
        <i class="bi bi-calendar-x" style="font-size:.7rem"></i>
        ${item.date}${item.label ? ' — ' + esc(item.label) : ''}
        <button type="button" onclick="removeSpecificOffDate(${i})" style="background:none;border:none;padding:0;margin-left:3px;cursor:pointer;color:inherit;font-size:.75rem;line-height:1;opacity:.7">✕</button>
      </span>`
    ).join('');
    renderCalendar();
  }
  window.removeSpecificOffDate = function(i) {
    const arr = getSpecificOffDates(); arr.splice(i, 1); saveSpecificOffDates(arr);
    renderSpecificOffList(); renderCalendar();
  };
  const addSpecificBtn = document.getElementById('addSpecificOffBtn');
  if (addSpecificBtn) {
    addSpecificBtn.addEventListener('click', () => {
      const dateVal  = document.getElementById('specificOffDateInput').value;
      const labelVal = document.getElementById('specificOffLabelInput').value.trim();
      if (!dateVal) return alert('Pick a date first');
      const arr = getSpecificOffDates();
      if (arr.find(x => x.date === dateVal)) return alert('That date is already added');
      arr.push({ date: dateVal, label: labelVal });
      arr.sort((a, b) => a.date.localeCompare(b.date));
      saveSpecificOffDates(arr);
      document.getElementById('specificOffDateInput').value = '';
      document.getElementById('specificOffLabelInput').value = '';
      renderSpecificOffList();
    });
  }
  renderSpecificOffList();
});

/* ══════════════════════════════════════════════
   TIMELINE
══════════════════════════════════════════════ */
const timelineSearch = document.getElementById('timelineSearch');
const projectFilter  = document.getElementById('projectFilter');
if (timelineSearch) timelineSearch.addEventListener('input', e => { currentTimelineSearch = e.target.value.toLowerCase(); renderTimeline(); });
if (projectFilter)  projectFilter.addEventListener('change', e => { currentTimelineProject = e.target.value; renderTimeline(); });
document.querySelectorAll("input[name='typeFilter']").forEach(btn => btn.addEventListener('change', e => { currentTimelineType = e.target.value; renderTimeline(); }));

firebase.auth().onAuthStateChanged(user => { if (user) { userId = user.uid; loadMilestones(); } });
firebase.auth().onAuthStateChanged(user => { if (user) showUpdateNotice(user); });

function showUpdateNotice(user) {
  const notice = document.getElementById('timelineUpdateNotice');
  const closeBtn = document.getElementById('closeUpdateNotice');
  const key = `features_v2_seen_${user.uid}`;
  const seenData = JSON.parse(localStorage.getItem(key) || '{}');
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (!seenData.timestamp || (now - seenData.timestamp) < oneWeek) {
    notice.classList.remove('hidden');
    if (!seenData.timestamp) localStorage.setItem(key, JSON.stringify({ timestamp: now }));
    const remaining = Math.max(0, oneWeek - (now - (seenData.timestamp || now)));
    setTimeout(() => notice.classList.add('hidden'), remaining);
  }
  closeBtn.addEventListener('click', () => { notice.classList.add('hidden'); localStorage.setItem(key, JSON.stringify({ timestamp: Date.now() })); });
}

document.getElementById('addMilestoneBtn').addEventListener('click', () => {
  milestoneForm.id.value = '';
  milestoneForm.project.innerHTML = '<option value="">Select project</option>';
  (window.projects || []).forEach(p => { const opt = document.createElement('option'); opt.value = p.name; opt.textContent = p.name; milestoneForm.project.appendChild(opt); });
  milestoneForm.title.value = ''; milestoneForm.date.value = ''; milestoneForm.done.checked = false;
  milestoneModal.show();
});
document.getElementById('saveMilestoneBtn').addEventListener('click', async () => {
  const project = milestoneForm.project.value?.trim();
  const title   = milestoneForm.title.value.trim();
  const date    = milestoneForm.date.value;
  const done    = milestoneForm.done.checked;
  const isEditing = !!milestoneForm.id.value;
  if (!title || !date || (!isEditing && !project)) { alert('Please fill all required fields'); return; }
  const selProject = isEditing ? (milestones.find(m => m.id === milestoneForm.id.value)?.project || project) : project;
  const id = milestoneForm.id.value || Date.now().toString();
  const payload = { id, project: selProject, title, date, completed: !!done };
  const existing = milestones.find(m => m.id === id);
  if (existing && existing.completedAt) payload.completedAt = existing.completedAt;
  if (done && (!existing || !existing.completed)) payload.completedAt = new Date().toISOString();
  if (!done) payload.completedAt = null;
  try {
    await firebase.database().ref(`users/${userId}/milestones/${id}`).set(payload);
    if (document.activeElement) document.activeElement.blur();
    setTimeout(() => milestoneModal.hide(), 80);
    await loadMilestones();
    populateAssessControls();
  } catch (err) { console.error('Milestone save failed:', err); alert('Error saving milestone.'); }
});
async function loadMilestones() {
  if (!userId) return;
  const snap = await firebase.database().ref(`users/${userId}/milestones`).once('value');
  milestones = snap.val() ? Object.values(snap.val()) : [];
  renderTimeline();
}
async function deleteMilestone(id) {
  if (!confirm('Delete this milestone?')) return;
  await firebase.database().ref(`users/${userId}/milestones/${id}`).remove();
  loadMilestones();
}
async function toggleMilestoneDone(id, current) {
  const updates = { completed: !current, completedAt: !current ? new Date().toISOString() : null };
  await firebase.database().ref(`users/${userId}/milestones/${id}`).update(updates);
  loadMilestones();
}
function renderTimeline() {
  const tc = document.getElementById('timelineContainer');
  tc.innerHTML = '';

  // Sync project filter dropdown
  const prev = projectFilter ? projectFilter.value : 'all';
  projectFilter.innerHTML = '<option value="all">All Projects</option>';
  (window.projects||[]).forEach(p => { const opt=document.createElement('option'); opt.value=p.name; opt.textContent=p.name; projectFilter.append(opt); });
  if (prev) projectFilter.value = prev;

  const nowStr  = today();
  const visible = (window.projects||[]).filter(p => currentTimelineProject==='all' || p.name===currentTimelineProject);

  if (!visible.length) {
    tc.innerHTML = '<div class="card-panel text-muted" style="text-align:center;padding:32px">No projects yet. Create a project first.</div>';
    return;
  }

  visible.forEach(proj => {
    const projMilestones = milestones.filter(m => m.project===proj.name).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const projTasks = (window.tasks||[]).filter(t=>t.project===proj.name).map(t=>({
      id: String(t.id||''), title:t.description||'', date:t.target||'', completed:!!t.completed,
      completedAt:t.completedAt||null, isTask:true, priority:t.priority||'low',
      assignees:t.assignees||[], subtasks:t.subtasks||[]
    }));

    let combined = [];
    if      (currentTimelineType==='both')       combined = [...projMilestones, ...projTasks];
    else if (currentTimelineType==='tasks')       combined = projTasks;
    else                                          combined = projMilestones;
    if (currentTimelineSearch) combined = combined.filter(i=>(i.title||'').toLowerCase().includes(currentTimelineSearch));
    combined.sort((a,b)=>new Date(a.date||'9999')-new Date(b.date||'9999'));
    if (!combined.length) return;

    // Project progress stats
    const total   = projTasks.length;
    const done    = projTasks.filter(t=>t.completed).length;
    const overdue = projTasks.filter(t=>!t.completed&&t.date&&t.date<nowStr).length;
    const pct     = total ? Math.round(done/total*100) : 0;

    const card = document.createElement('div'); card.className='timeline-card';

    // ── Card header ──
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:8px';
    hdr.innerHTML = `
      <div>
        <h6 style="font-size:var(--font-size-md);font-weight:700;color:var(--accent);margin:0">${esc(proj.name)}</h6>
        ${proj.description?`<div style="font-size:var(--font-size-xs);color:var(--muted);margin-top:2px">${esc(proj.description)}</div>`:''}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:var(--font-size-xs);color:var(--muted)">${combined.length} items</span>
        ${total?`<span style="font-size:var(--font-size-xs);background:var(--chip-low-bg);color:var(--chip-low-text);border-radius:5px;padding:1px 7px;font-weight:600">✅ ${done}/${total}</span>`:''}
        ${overdue?`<span style="font-size:var(--font-size-xs);background:var(--chip-high-bg);color:var(--chip-high-text);border-radius:5px;padding:1px 7px;font-weight:600">⏰ ${overdue} overdue</span>`:''}
        <span style="font-size:var(--font-size-xs);background:var(--accent-dim);color:var(--accent);border-radius:5px;padding:1px 7px;font-weight:700">${pct}%</span>
      </div>`;
    card.appendChild(hdr);

    // ── Progress bar ──
    if (total) {
      const pb = document.createElement('div');
      pb.style.cssText = 'height:5px;background:var(--border-md);border-radius:99px;overflow:hidden;margin-bottom:14px';
      pb.innerHTML = `<div style="height:100%;width:${pct}%;background:var(--accent);border-radius:99px;transition:width .5s ease"></div>`;
      card.appendChild(pb);
    }

    // ── Timeline items: vertical list (much cleaner than horizontal scroll) ──
    const list = document.createElement('div');
    list.style.cssText = 'position:relative;padding-left:28px';

    // Vertical spine line
    const spine = document.createElement('div');
    spine.style.cssText = 'position:absolute;left:9px;top:8px;bottom:8px;width:2px;background:var(--timeline-line);border-radius:2px';
    list.appendChild(spine);

    combined.forEach((item, idx) => {
      const isOverdue = !item.completed && item.date && item.date < nowStr;
      const isPast    = item.date && item.date < nowStr;

      const row = document.createElement('div');
      row.style.cssText = 'position:relative;display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--divider)';
      if (idx === combined.length-1) row.style.borderBottom = 'none';

      // Dot
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;left:-19px;top:11px;width:18px;height:18px;border-radius:50%;border:2px solid ${item.completed?'var(--accent)':isOverdue?'#ef4444':'var(--border-md)'};background:${item.completed?'var(--accent)':isOverdue?'#fee2e2':'var(--card)'};display:flex;align-items:center;justify-content:center;font-size:.55rem;color:${item.completed?'#fff':isOverdue?'#ef4444':'var(--muted)'};flex-shrink:0;cursor:${item.isTask?'default':'pointer'};transition:transform .15s`;
      dot.innerHTML = item.completed ? '✓' : isOverdue ? '!' : (idx+1).toString();
      if (!item.isTask && item.id) {
        dot.title = 'Click to toggle complete';
        dot.onmouseenter = () => dot.style.transform='scale(1.2)';
        dot.onmouseleave = () => dot.style.transform='scale(1)';
        dot.addEventListener('click', () => toggleMilestoneDone(item.id, item.completed));
      }

      // Content
      const content = document.createElement('div');
      content.style.cssText = 'flex:1;min-width:0';

      // Title row
      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px';

      const titleEl = document.createElement('span');
      titleEl.style.cssText = `font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary);${item.completed?'text-decoration:line-through;color:var(--muted)':''}`;
      titleEl.textContent = item.title || '(untitled)';

      // Type badge
      const typeBadge = document.createElement('span');
      typeBadge.style.cssText = `font-size:.55rem;padding:1px 5px;border-radius:4px;font-weight:700;${item.isTask?'background:var(--soft);color:var(--accent)':'background:#fef3c7;color:#92400e'}`;
      typeBadge.textContent = item.isTask ? 'Task' : '🚩 Milestone';

      if (item.isTask && item.priority) {
        const priBadge = document.createElement('span');
        priBadge.className = `task-chip ${item.priority}`;
        priBadge.style.cssText = 'margin:0;padding:1px 5px;font-size:.55rem;flex-shrink:0';
        priBadge.textContent = item.priority;
        titleRow.append(titleEl, typeBadge, priBadge);
      } else {
        titleRow.append(titleEl, typeBadge);
      }

      // Meta row
      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px';

      // Date chip
      if (item.date) {
        const dateChip = document.createElement('span');
        dateChip.style.cssText = `font-size:var(--font-size-xs);color:${isOverdue?'#ef4444':isPast?'var(--muted)':'var(--muted)'};font-weight:${isOverdue?'700':'400'}`;
        dateChip.innerHTML = `<i class="bi bi-calendar3" style="margin-right:3px"></i>${item.date}${isOverdue?' ⚠️':''}`;
        metaRow.appendChild(dateChip);
      }

      // CompletedAt
      if (item.completedAt) {
        const doneChip = document.createElement('span');
        doneChip.style.cssText = 'font-size:var(--font-size-xs);color:#10b981;font-weight:600';
        doneChip.innerHTML = `<i class="bi bi-check-circle" style="margin-right:3px"></i>Done ${new Date(item.completedAt).toISOString().split('T')[0]}`;
        metaRow.appendChild(doneChip);
      }

      // Assignee avatars (tasks only)
      if (item.isTask && item.assignees && item.assignees.length) {
        const avRow = document.createElement('div');
        avRow.style.cssText = 'display:flex;gap:2px;align-items:center';
        item.assignees.slice(0,4).forEach(n => {
          const mem = (window.members||[]).find(m=>m.name===n);
          const av = document.createElement('span');
          av.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:${mem?mem.color:'#6b7280'};color:#fff;font-size:.5rem;font-weight:700;border:1.5px solid var(--card)`;
          av.title = n; av.textContent = initials(n);
          avRow.appendChild(av);
        });
        metaRow.appendChild(avRow);
      }

      // Subtask progress bar (tasks only)
      if (item.isTask && item.subtasks && item.subtasks.length) {
        const subDone  = item.subtasks.filter(s=>s.done).length;
        const subTotal = item.subtasks.length;
        const subPct   = Math.round(subDone/subTotal*100);
        const subEl = document.createElement('div');
        subEl.style.cssText = 'display:flex;align-items:center;gap:5px';
        subEl.innerHTML = `<div style="width:50px;height:3px;background:var(--border-md);border-radius:99px;overflow:hidden"><div style="height:100%;width:${subPct}%;background:var(--accent)"></div></div><span style="font-size:.58rem;color:var(--muted)">${subDone}/${subTotal}</span>`;
        metaRow.appendChild(subEl);
      }

      content.append(titleRow, metaRow);

      // Action buttons (milestone only)
      if (!item.isTask && item.id) {
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;margin-top:2px';
        actions.innerHTML = `<button class="btn btn-sm btn-outline-secondary" style="padding:1px 6px;font-size:var(--font-size-xs)" onclick="editMilestone('${item.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" style="padding:1px 6px;font-size:var(--font-size-xs)" onclick="deleteMilestone('${item.id}')"><i class="bi bi-trash"></i></button>`;
        row.append(dot, content, actions);
      } else {
        row.append(dot, content);
      }

      list.appendChild(row);
    });

    card.appendChild(list);
    tc.appendChild(card);
  });
}
async function editMilestone(id) {
  const m = milestones.find(x => x.id === id); if (!m) return;
  milestoneForm.project.innerHTML = '<option value="">Select project</option>';
  (window.projects || []).forEach(p => { const opt = document.createElement('option'); opt.value = p.name; opt.textContent = p.name; milestoneForm.project.appendChild(opt); });
  milestoneForm.id.value = m.id; milestoneForm.project.value = m.project || ''; milestoneForm.title.value = m.title || ''; milestoneForm.date.value = m.date || ''; milestoneForm.done.checked = !!m.completed;
  setTimeout(() => milestoneForm.title.focus(), 50);
  milestoneModal.show();
}
window.deleteMilestone = deleteMilestone;
window.editMilestone   = editMilestone;
window.toggleMilestoneDone = toggleMilestoneDone;
window.loadMilestones  = loadMilestones;

/* ══════════════════════════════════════════════
   RECURRING TASKS
══════════════════════════════════════════════ */
function generateRecurringTasks() {
  const now = today();
  (window.tasks || []).filter(t => t.recurring && t.completed && t.completedAt).forEach(t => {
    const next = getNextRecurringDate(t.completedAt, t.recurring);
    if (next && next <= now) {
      const exists = (window.tasks || []).some(x => x.description === t.description && x.project === t.project && x.target === next && !x.completed);
      if (!exists) {
        window.tasks.push({ ...t, id: Date.now() + Math.random() | 0, target: next, completed: false, completedAt: null, timeLogs: [], kanbanStatus: 'todo' });
        addNotification('Recurring task due', `"${t.description || ''}" (${t.recurring})`, 'bi-arrow-repeat');
      }
    }
  });
  if (typeof saveTasks === 'function') saveTasks();
}
function getNextRecurringDate(from, freq) {
  const d = new Date(from); if (isNaN(d)) return null;
  if (freq === 'daily')     d.setDate(d.getDate() + 1);
  else if (freq === 'weekly')    d.setDate(d.getDate() + 7);
  else if (freq === 'biweekly')  d.setDate(d.getDate() + 14);
  else if (freq === 'monthly')   d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

/* ══════════════════════════════════════════════
   OVERDUE NOTIFICATIONS
══════════════════════════════════════════════ */
function checkOverdueNotifications() {
  const now = today();
  const overdue = (window.tasks || []).filter(t => !t.completed && t.target && t.target < now);
  if (overdue.length && localStorage.getItem('cymOverdueAlert') !== '0') {
    addNotification(
      `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      overdue.slice(0, 3).map(t => t.description).join(', ') + (overdue.length > 3 ? '...' : ''),
      'bi-exclamation-triangle'
    );
  }
}

/* ══════════════════════════════════════════════
   AUTH + LOAD
══════════════════════════════════════════════ */
showLoader();
firebase.auth().onAuthStateChanged(user => {
  if (!user) return location.href = 'login.html';
  let name = (user.email || 'user').split('@')[0];
  name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  document.getElementById('userName').textContent     = name;
  document.getElementById('userIcon').textContent     = name[0].toUpperCase();
  const hr = new Date().getHours();
  document.getElementById('userGreeting').textContent = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ' 👋';
  userId = user.uid;
  loadMembers();
  if (typeof loadAllData === 'function') {
    try {
      loadAllData(() => {
        window.projects = window.projects || [];
        window.tasks    = window.tasks    || [];
        window.trash    = window.trash    || [];
        const now = today(); let updated = false;
        window.tasks.forEach(t => {
          if (t.completed && !t.completedAt) { t.completedAt = t.target || now; updated = true; }
          if (!t.kanbanStatus) { t.kanbanStatus = t.completed ? 'done' : 'todo'; updated = true; }
        });
        if (updated && typeof saveTasks === 'function') saveTasks();
        generateRecurringTasks();
        checkOverdueNotifications();
        renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
        hideLoader();
      });
    } catch(e) {
      console.error('loadAllData error', e);
      window.projects = window.projects || []; window.tasks = window.tasks || []; window.trash = window.trash || [];
      renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
      hideLoader();
    }
  } else {
    window.projects = window.projects || []; window.tasks = window.tasks || []; window.trash = window.trash || [];
    renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban();
    hideLoader();
  }
});
document.getElementById('logoutBtn').addEventListener('click', () => firebase.auth().signOut().then(() => location.href = 'login.html'));

/* ── NAV wiring ── */
window.refreshUI = function() { populateAssessControls(); renderProjects(); renderCalendar(); renderAllAssessment(); renderKanban(); };
document.getElementById('navCalendar').addEventListener('click',   () => switchView('calendar'));
document.getElementById('navKanban').addEventListener('click',     () => switchView('kanban'));
document.getElementById('navAssessment').addEventListener('click', () => switchView('assessment'));
document.getElementById('navTimeline').addEventListener('click',   () => { switchView('timeline'); renderTimeline(); });
document.getElementById('navProjects').addEventListener('click',   () => switchView('projects'));
document.getElementById('navTeam').addEventListener('click',       () => switchView('team'));
document.getElementById('navReports').addEventListener('click',    () => switchView('reports'));
document.getElementById('navSettings').addEventListener('click',   () => { switchView('settings'); refreshSettingsStats(); });
document.getElementById('navHelp').addEventListener('click',       () => switchView('help'));
switchView('calendar');
