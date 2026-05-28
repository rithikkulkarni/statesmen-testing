let toastT;

function go(v) {
    view = v;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    document.getElementById('pageTitle').textContent = TITLES[v] || v;
    renderPage();
    if (aiOpen) renderQPs();
}

function renderPage() {
    const el = document.getElementById('page');
    if      (view === 'dashboard') el.innerHTML = dashHTML();
    else if (view === 'events')    el.innerHTML = evHTML();
    else if (view === 'members')   el.innerHTML = mbHTML();
    else if (view === 'comms')     el.innerHTML = ph('✉️', 'Communications', 'Use the AI assistant to draft re-engagement emails, newsletters, and event invitations.');
    else                           el.innerHTML = ph('📈', 'Reports', 'Analytics and reporting. Ask the AI assistant to summarise current data.');
}

function dashHTML() {
    const active = db.members.filter(m => m.status === 'Active').length;
    const conf   = db.events.filter(e => e.status === 'Confirmed').length;
    const chaps  = [...new Set(db.members.map(m => m.chapter))].length;
    return `<div class="stat-grid">
        <div class="stat-card"><div class="stat-lbl">Total Members</div><div class="stat-val">${db.members.length}</div><div class="stat-sub">${active} active</div></div>
        <div class="stat-card"><div class="stat-lbl">Events Planned</div><div class="stat-val">${db.events.length}</div><div class="stat-sub">${conf} confirmed</div></div>
        <div class="stat-card"><div class="stat-lbl">Chapters</div><div class="stat-val">${chaps}</div><div class="stat-sub">regions</div></div>
    </div>
    <div class="card"><div class="card-hd"><span class="card-title">Upcoming Events</span><span class="card-ct">${db.events.length} total</span></div>${evTable(false)}</div>`;
}

function evHTML() {
    return `<div class="card"><div class="card-hd"><span class="card-title">All Events</span>
    <div class="card-right"><span class="card-ct">${db.events.length} events</span>
    <button class="btn-new" onclick="openEvForm()">+ New Event</button></div></div>${evTable(true)}</div>`;
}

function mbHTML() {
    return `<div class="card"><div class="card-hd"><span class="card-title">All Members</span>
    <div class="card-right"><span class="card-ct">${db.members.length} members</span>
    <button class="btn-new" onclick="openMbForm()">+ Add Member</button></div></div>
    <table><thead><tr><th>Name</th><th>Email</th><th>Class Year</th><th>Chapter</th><th>Status</th><th class="th-action"></th></tr></thead><tbody>
    ${db.members.map(m => `<tr data-row="mb-${m.id}">
        <td><strong>${m.name}</strong></td><td>${m.email}</td><td>${m.year}</td><td>${m.chapter}</td><td>${badge(m.status)}</td>
        <td class="td-action"><button class="row-edit" onclick="editMb(${m.id})">Edit</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

function evTable(editable) {
    const actionCol = editable ? '<th class="th-action"></th>' : '';
    return `<table><thead><tr><th>Event</th><th>Date</th><th>Location</th><th>Capacity</th><th>Status</th>${actionCol}</tr></thead><tbody>
    ${db.events.map(e => `<tr data-row="ev-${e.id}">
        <td><strong>${e.name}</strong></td><td>${fmtDate(e.date)}</td><td>${e.location}</td><td>${e.capacity}</td><td>${badge(e.status)}</td>
        ${editable ? `<td class="td-action"><button class="row-edit" onclick="editEv(${e.id})">Edit</button></td>` : ''}
    </tr>`).join('')}
    </tbody></table>`;
}

function toggleAI() {
    aiOpen = !aiOpen;
    document.getElementById('ai').classList.toggle('open', aiOpen);
    document.getElementById('aiBtn').classList.toggle('open', aiOpen);
    if (aiOpen) { renderQPs(); setTimeout(() => document.getElementById('msgIn').focus(), 230); }
}

function renderQPs() {
    const list = document.getElementById('qpsList');
    const ps   = PROMPTS[view] || PROMPTS.dashboard;
    list.innerHTML = ps.map(([lbl, txt]) =>
        `<button class="qp" onclick="fireQP(this.dataset.t)" data-t="${xa(txt)}">${lbl}</button>`
    ).join('');
    document.getElementById('qps').style.display = qpGone ? 'none' : 'block';
}

function fireQP(txt) {
    document.getElementById('msgIn').value = txt;
    resize(document.getElementById('msgIn'));
    hideQPs();
    send();
}

function hideQPs() {
    if (!qpGone) { qpGone = true; document.getElementById('qps').style.display = 'none'; }
}

function hl(rowId) {
    setTimeout(() => {
        const r = document.querySelector(`[data-row="${rowId}"]`);
        if (r) { r.classList.remove('hl'); void r.offsetWidth; r.classList.add('hl'); r.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    }, 60);
}

function toast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    const el = document.getElementById('toast');
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 3500);
}
