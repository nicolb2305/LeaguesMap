'use strict';

/**
 * League Tasks Panel
 * Renders a full-height task list to the right of the map,
 * filtered by the existing region filter control.
 */

const TASKS_URL = 'data_osrs/Raging_Echoes_League-Tasks.json';

let allTasks = [];
let currentSearch = '';
let currentRegions = null; // null = show all (region control not yet connected)
let showGeneralTasks = true;
let selectedTaskName = null;

// ── DOM references ────────────────────────────────────────────────
const taskList   = document.getElementById('task-list');
const taskStats  = document.getElementById('task-panel-stats');
const taskSearch = document.getElementById('task-search');

// ── Filtering ─────────────────────────────────────────────────────
function filterTasks() {
    const search = currentSearch.toLowerCase();
    const regions = currentRegions;

    return allTasks.filter(task => {
        // General tasks (no area) — respect the show/hide toggle
        if (!task.area) {
            if (!showGeneralTasks) return false;
        } else if (regions !== null && !regions.includes(task.area)) {
            // Regional tasks must match an enabled region
            return false;
        }

        // Text search across name, task description, and area
        if (search) {
            const haystack = `${task.name} ${task.task} ${task.area}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });
}

// ── Rendering ─────────────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderStats(visible, total) {
    const pts = visible.reduce((sum, t) => sum + (t.points || 0), 0);
    taskStats.innerHTML =
        `<div class="stat-item">Tasks: <span>${visible.length}</span> / ${total}</div>` +
        `<div class="stat-item">Points: <span>${pts.toLocaleString()}</span></div>`;
}

function renderTasks() {
    if (allTasks.length === 0) return; // not yet loaded

    const visible = filterTasks();
    renderStats(visible, allTasks.length);

    if (visible.length === 0) {
        taskList.innerHTML = '<div class="task-panel-empty">No tasks match the current filters.</div>';
        return;
    }

    // Build fragment for performance
    const frag = document.createDocumentFragment();
    for (const task of visible) {
        const card = document.createElement('div');
        card.className = 'task-card';

        const areaHtml = task.area
            ? `<span class="task-card-area">${escHtml(task.area)}</span>`
            : `<span class="task-card-area" style="color:#7a6840;border-color:#2a2000;">General</span>`;

        const reqHtml = (task.requirements && task.requirements !== 'N/A')
            ? `<div class="task-card-requirements">Req: ${escHtml(task.requirements)}</div>`
            : '';

        const searchTerm = task.strategy && task.strategy.search ? task.strategy.search.trim() : '';
        if (searchTerm) {
            card.classList.add('task-card-has-strategy');
            card.title = `Click to search: "${searchTerm}"`;
        }

        if (task.name === selectedTaskName) {
            card.classList.add('task-card-selected');
        }

        card.innerHTML =
            `<div class="task-card-header">` +
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

        if (searchTerm) {
            card.addEventListener('click', () => {
                selectedTaskName = (selectedTaskName === task.name) ? null : task.name;
                renderTasks();
                const ctrl = window._unifiedSearch;
                if (ctrl && ctrl.triggerSearch) {
                    ctrl.triggerSearch(searchTerm, true);
                }
            });
        } else {
            card.addEventListener('click', () => {
                selectedTaskName = (selectedTaskName === task.name) ? null : task.name;
                renderTasks();
            });
        }

        frag.appendChild(card);
    }

    taskList.innerHTML = '';
    taskList.appendChild(frag);
}

// ── Search input ──────────────────────────────────────────────────
taskSearch.addEventListener('input', e => {
    currentSearch = e.target.value.trim();
    renderTasks();
});

document.getElementById('task-show-general').addEventListener('change', e => {
    showGeneralTasks = e.target.checked;
    renderTasks();
});

// ── Region filter integration  ────────────────────────────────────
// Wire the region control SYNCHRONOUSLY at module load time so the
// onRegionChange callback is always registered before any async work.
function wireRegionControl(regionControl) {
    currentRegions = regionControl.getEnabledRegions();
    regionControl.onRegionChange(regions => {
        currentRegions = regions;
        renderTasks();
    });
}

// main_osrs.js sets window._regionControl synchronously before this
// module runs (modules execute in HTML order). Wire it immediately.
if (window._regionControl) {
    wireRegionControl(window._regionControl);
} else {
    // Fallback: listen for the event in case execution order is unexpected
    window.addEventListener('regionControlReady', e => {
        wireRegionControl(e.detail);
        renderTasks(); // re-render now that regions are known
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
    // currentRegions is already set from wireRegionControl above;
    // just render with whatever region state is current.
    renderTasks();
}

init();
