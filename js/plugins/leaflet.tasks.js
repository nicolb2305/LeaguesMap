'use strict';

/**
 * League Tasks Panel
 * Renders a full-height task list to the right of the map,
 * filtered by the existing region filter control.
 * Supports marking tasks complete with a two-tab view.
 */

const TASKS_URL = 'data_osrs/Raging_Echoes_League-Tasks.json';
const STORAGE_KEY = 'league_tasks_completed';

let allTasks = [];
let currentSearch = '';
let currentRegions = null;
let showGeneralTasks = true;
let selectedTaskName = null;
let activeTab = 'active'; // 'active' | 'completed'

// Persisted set of completed task names
let completedTasks = new Set();
try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) completedTasks = new Set(JSON.parse(saved));
} catch (e) { /* ignore */ }

function saveCompleted() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completedTasks)));
}

// ── DOM references ────────────────────────────────────────────────
const taskList   = document.getElementById('task-list');
const taskStats  = document.getElementById('task-panel-stats');
const taskSearch = document.getElementById('task-search');

// ── Filtering ─────────────────────────────────────────────────────
function filterActiveTasks() {
    const search = currentSearch.toLowerCase();
    const regions = currentRegions;

    return allTasks.filter(task => {
        if (completedTasks.has(task.name)) return false;

        if (!task.area) {
            if (!showGeneralTasks) return false;
        } else if (regions !== null && !regions.includes(task.area)) {
            return false;
        }

        if (search) {
            const haystack = `${task.name} ${task.task} ${task.area}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });
}

function filterCompletedTasks() {
    const search = currentSearch.toLowerCase();
    return allTasks.filter(task => {
        if (!completedTasks.has(task.name)) return false;
        if (search) {
            const haystack = `${task.name} ${task.task} ${task.area}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
}

// ── Rendering helpers ─────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderStats() {
    // Base set: tasks visible under current region + general toggle (no text search, no completion filter)
    const regions = currentRegions;
    const regionFiltered = allTasks.filter(task => {
        if (!task.area) {
            return showGeneralTasks;
        }
        return regions === null || regions.includes(task.area);
    });

    const total     = regionFiltered.length;
    const done      = regionFiltered.filter(t =>  completedTasks.has(t.name));
    const remaining = regionFiltered.filter(t => !completedTasks.has(t.name));
    const donePts   = done.reduce((s, t) => s + (t.points || 0), 0);
    const leftPts   = remaining.reduce((s, t) => s + (t.points || 0), 0);

    taskStats.innerHTML =
        `<div class="stat-item">Remaining: <span>${remaining.length}</span> / ${total}</div>` +
        `<div class="stat-item">Pts done: <span>${donePts.toLocaleString()}</span></div>` +
        `<div class="stat-item">Pts left: <span>${leftPts.toLocaleString()}</span></div>`;
}

function buildCard(task, isCompleted) {
    const card = document.createElement('div');
    card.className = 'task-card' + (isCompleted ? ' task-card-completed' : '');

    if (!isCompleted && task.name === selectedTaskName) {
        card.classList.add('task-card-selected');
    }

    const searchTerm = task.strategy && task.strategy.search ? task.strategy.search.trim() : '';
    if (!isCompleted && searchTerm) {
        card.classList.add('task-card-has-strategy');
        card.title = `Click to search: "${searchTerm}"`;
    }

    const areaHtml = task.area
        ? `<span class="task-card-area">${escHtml(task.area)}</span>`
        : `<span class="task-card-area" style="color:#7a6840;border-color:#2a2000;">General</span>`;

    const reqHtml = (task.requirements && task.requirements !== 'N/A')
        ? `<div class="task-card-requirements">Req: ${escHtml(task.requirements)}</div>`
        : '';

    const checkboxHtml =
        `<label class="task-card-check" title="${isCompleted ? 'Mark incomplete' : 'Mark complete'}" onclick="event.stopPropagation();">` +
            `<input type="checkbox" class="task-card-checkbox" data-name="${escHtml(task.name)}" ${isCompleted ? 'checked' : ''} />` +
        `</label>`;

    card.innerHTML =
        `<div class="task-card-header">` +
            checkboxHtml +
            `<div class="task-card-name">${escHtml(task.name)}</div>` +
            `<div class="task-card-points">${escHtml(task.points)} pts</div>` +
        `</div>` +
        `<div class="task-card-desc">${escHtml(task.task)}</div>` +
        reqHtml +
        `<div class="task-card-meta">` +
            areaHtml +
            (searchTerm ? `<span class="task-card-strategy-hint">🔍 ${escHtml(searchTerm)}</span>` : '') +
            `<span class="task-card-completion">${escHtml(task.completion)} players</span>` +
        `</div>`;

    // Checkbox toggle
    card.querySelector('.task-card-checkbox').addEventListener('change', e => {
        const name = e.target.dataset.name;
        if (e.target.checked) {
            completedTasks.add(name);
            if (selectedTaskName === name) selectedTaskName = null;
        } else {
            completedTasks.delete(name);
        }
        saveCompleted();
        updateTabBadges();
        renderTasks();
    });

    // Card body click (selection + strategy search) — only on active tab
    if (!isCompleted) {
        card.addEventListener('click', () => {
            selectedTaskName = (selectedTaskName === task.name) ? null : task.name;
            renderTasks();
            if (searchTerm) {
                const ctrl = window._unifiedSearch;
                if (ctrl && ctrl.triggerSearch) ctrl.triggerSearch(searchTerm, true);
            }
        });
    }

    return card;
}

function updateTabBadges() {
    const completedBtn = document.querySelector('.task-tab[data-tab="completed"]');
    if (completedBtn) {
        completedBtn.textContent = completedTasks.size
            ? `Completed (${completedTasks.size})`
            : 'Completed';
    }
}

function renderTasks() {
    if (allTasks.length === 0) return;

    renderStats();
    updateTabBadges();

    const frag = document.createDocumentFragment();

    if (activeTab === 'active') {
        const visible = filterActiveTasks();
        if (visible.length === 0) {
            taskList.innerHTML = '<div class="task-panel-empty">No tasks match the current filters.</div>';
            return;
        }
        for (const task of visible) frag.appendChild(buildCard(task, false));
    } else {
        const visible = filterCompletedTasks();

        // Reset button always shown when there are any completions
        if (completedTasks.size > 0) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'task-reset-btn';
            resetBtn.textContent = `Reset all (${completedTasks.size})`;
            resetBtn.addEventListener('click', () => {
                if (confirm('Clear all completed tasks?')) {
                    completedTasks.clear();
                    saveCompleted();
                    updateTabBadges();
                    renderTasks();
                }
            });
            frag.appendChild(resetBtn);
        }

        if (visible.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'task-panel-empty';
            empty.textContent = 'No completed tasks yet.';
            frag.appendChild(empty);
        } else {
            for (const task of visible) frag.appendChild(buildCard(task, true));
        }
    }

    taskList.innerHTML = '';
    taskList.appendChild(frag);
}

// ── Tabs ──────────────────────────────────────────────────────────
document.querySelectorAll('.task-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.task-tab').forEach(b => b.classList.remove('task-tab-active'));
        btn.classList.add('task-tab-active');
        renderTasks();
    });
});

// ── Search & toggles ─────────────────────────────────────────────
taskSearch.addEventListener('input', e => {
    currentSearch = e.target.value.trim();
    renderTasks();
});

document.getElementById('task-show-general').addEventListener('change', e => {
    showGeneralTasks = e.target.checked;
    renderTasks();
});

// ── Region filter integration ─────────────────────────────────────
function wireRegionControl(regionControl) {
    currentRegions = regionControl.getEnabledRegions();
    regionControl.onRegionChange(regions => {
        currentRegions = regions;
        renderTasks();
    });
}

if (window._regionControl) {
    wireRegionControl(window._regionControl);
} else {
    window.addEventListener('regionControlReady', e => {
        wireRegionControl(e.detail);
        renderTasks();
    }, { once: true });
}

// ── Bootstrap ─────────────────────────────────────────────────────
async function init() {
    try {
        const resp = await fetch(TASKS_URL);
        allTasks = await resp.json();
    } catch (err) {
        taskList.innerHTML = '<div class="task-panel-empty">Failed to load tasks.</div>';
        console.error('LeagueTasks: failed to fetch tasks JSON', err);
        return;
    }
    updateTabBadges();
    renderTasks();
}

init();

