// ── EVENT MODAL ────────────────────────────────────────────────────────────────

function openEvForm() {
    evEditId = null; clearEvForm(); showEvButtons(true);
    document.getElementById('evAIBanner').style.display  = 'none';
    document.getElementById('evAIHint').style.display    = 'flex';
    document.getElementById('evModalTitle').textContent  = 'New Event';
    document.getElementById('evModalSub').innerHTML      = 'Fill in the details to create an event <span class="fields-badge">15 fields</span>';
    document.getElementById('evSubmitBtn').textContent   = 'Create Event →';
    document.getElementById('evModal').classList.add('show');
}

function editEv(id) {
    const ev = db.events.find(e => e.id === id);
    if (!ev) return;
    evEditId = id; clearEvForm(); showEvButtons(true);
    document.getElementById('evAIBanner').style.display  = 'none';
    document.getElementById('evAIHint').style.display    = 'none';
    document.getElementById('evModalTitle').textContent  = 'Edit Event';
    document.getElementById('evModalSub').innerHTML      = 'Update the event details below';
    document.getElementById('evSubmitBtn').textContent   = 'Save Changes →';
    document.getElementById('evName').value     = ev.name     || '';
    document.getElementById('evDate').value     = ev.date     || '';
    document.getElementById('evVenue').value    = ev.location || '';
    document.getElementById('evCapacity').value = ev.capacity || '';
    document.getElementById('evStatus').value   = ev.status   || 'Planning';
    document.getElementById('evModal').classList.add('show');
}

function closeEvModal() {
    document.getElementById('evModal').classList.remove('show');
    clearTimeout(evTimer); evEditId = null;
}

function clearEvForm() {
    ['evName','evDate','evTime','evEndDate','evVenue','evAddress','evCapacity','evRegDeadline','evPrice','evDesc','evOrganiser','evTags']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('evType').value    = '';
    document.getElementById('evStatus').value  = 'Planning';
    document.getElementById('evCountry').value = '';
}

function showEvButtons(on) {
    document.getElementById('evCloseX').style.display    = on ? 'block' : 'none';
    document.getElementById('evCancelBtn').style.display = on ? 'block' : 'none';
}

function submitEvForm() {
    const name = document.getElementById('evName').value.trim();
    if (!name) { alert('Event name is required.'); return; }
    const fields = {
        name,
        date:     document.getElementById('evDate').value,
        location: document.getElementById('evVenue').value || 'TBD',
        capacity: parseInt(document.getElementById('evCapacity').value) || 0,
        status:   document.getElementById('evStatus').value || 'Planning',
    };
    if (evEditId !== null) {
        const ev = db.events.find(e => e.id === evEditId);
        if (ev) Object.assign(ev, fields);
        closeEvModal(); renderPage(); if (ev) hl(`ev-${ev.id}`); toast(`✓ Event updated: "${name}"`);
    } else {
        const ev = {id: db.nextEv++, ...fields};
        db.events.push(ev); closeEvModal(); renderPage(); hl(`ev-${ev.id}`); toast(`✓ Event created: "${name}"`);
    }
}

function showEvAIFill(data, onDone) {
    clearEvForm();
    const name = data.name || '', date = data.date || '', loc = data.location || '';
    const cap = data.capacity, status = data.status || 'Planning';
    const type = inferEvType(name), country = inferCountry(loc);
    const desc = `${name} — ${type.toLowerCase()} event at ${loc}${cap ? `, capacity ${cap}` : ''}. ${status === 'Confirmed' ? 'Venue confirmed.' : 'Awaiting confirmation.'}`;
    const regDl = date ? subDays(date, 7) : '';
    let filled = 0;
    [['evName',name],['evDate',date],['evVenue',loc],['evCapacity',cap ? String(cap) : ''],['evDesc',desc],['evStatus',status],['evRegDeadline',regDl]]
        .forEach(([id, v]) => { if (setGlow(id, v)) filled++; });
    if (type)    { document.getElementById('evType').value = type; filled++; }
    if (country) { setSelectVal('evCountry', country); filled++; }
    document.getElementById('evFillTxt').textContent = `✨ AI auto-filled ${filled} of 15 fields · Submitting…`;
    const bar = document.getElementById('evProgBar');
    bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
    document.getElementById('evAIBanner').style.display = 'flex';
    document.getElementById('evAIHint').style.display   = 'none';
    showEvButtons(false);
    document.getElementById('evModal').classList.add('show');
    evTimer = setTimeout(() => { closeEvModal(); if (onDone) onDone(); }, 2100);
}

// ── MEMBER MODAL ───────────────────────────────────────────────────────────────

function openMbForm() {
    mbEditId = null; clearMbForm(); showMbButtons(true);
    document.getElementById('mbAIBanner').style.display  = 'none';
    document.getElementById('mbAIHint').style.display    = 'flex';
    document.getElementById('mbModalTitle').textContent  = 'Add Member';
    document.getElementById('mbModalSub').innerHTML      = 'Complete member details to add to the network <span class="fields-badge">11 fields</span>';
    document.getElementById('mbSubmitBtn').textContent   = 'Add Member →';
    document.getElementById('mbModal').classList.add('show');
}

function editMb(id) {
    const mb = db.members.find(m => m.id === id);
    if (!mb) return;
    mbEditId = id; clearMbForm(); showMbButtons(true);
    document.getElementById('mbAIBanner').style.display  = 'none';
    document.getElementById('mbAIHint').style.display    = 'none';
    document.getElementById('mbModalTitle').textContent  = 'Edit Member';
    document.getElementById('mbModalSub').innerHTML      = 'Update member details below';
    document.getElementById('mbSubmitBtn').textContent   = 'Save Changes →';
    document.getElementById('mbName').value  = mb.name  || '';
    document.getElementById('mbEmail').value = mb.email || '';
    document.getElementById('mbYear').value  = mb.year  || '';
    document.getElementById('mbStatus').value = mb.status || 'Active';
    setSelectVal('mbChapter', mb.chapter || '');
    document.getElementById('mbModal').classList.add('show');
}

function closeMbModal() {
    document.getElementById('mbModal').classList.remove('show');
    clearTimeout(mbTimer); mbEditId = null;
}

function clearMbForm() {
    ['mbName','mbEmail','mbPhone','mbYear','mbDegree','mbLinkedIn','mbCompany','mbJob','mbNotes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('mbChapter').value = '';
    document.getElementById('mbStatus').value  = 'Active';
}

function showMbButtons(on) {
    document.getElementById('mbCloseX').style.display    = on ? 'block' : 'none';
    document.getElementById('mbCancelBtn').style.display = on ? 'block' : 'none';
}

function submitMbForm() {
    const name = document.getElementById('mbName').value.trim();
    if (!name) { alert('Full name is required.'); return; }
    const fields = {
        name,
        email:   document.getElementById('mbEmail').value,
        year:    document.getElementById('mbYear').value,
        chapter: document.getElementById('mbChapter').value || 'Other',
        status:  document.getElementById('mbStatus').value  || 'Active',
    };
    if (mbEditId !== null) {
        const mb = db.members.find(m => m.id === mbEditId);
        if (mb) Object.assign(mb, fields);
        closeMbModal(); renderPage(); if (mb) hl(`mb-${mb.id}`); toast(`✓ Member updated: "${name}"`);
    } else {
        const mb = {id: db.nextMb++, ...fields};
        db.members.push(mb); closeMbModal(); renderPage(); hl(`mb-${mb.id}`); toast(`✓ Member added: ${name}`);
    }
}

function showMbAIFill(data, onDone) {
    clearMbForm();
    let filled = 0;
    [['mbName', data.name || ''],['mbEmail', data.email || ''],['mbYear', String(data.year || '')]]
        .forEach(([id, v]) => { if (setGlow(id, v)) filled++; });
    if (data.status)  { document.getElementById('mbStatus').value = data.status; filled++; }
    if (data.chapter) { setSelectVal('mbChapter', data.chapter); filled++; }
    document.getElementById('mbFillTxt').textContent = `✨ AI auto-filled ${filled} of 11 fields · Submitting…`;
    const bar = document.getElementById('mbProgBar');
    bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
    document.getElementById('mbAIBanner').style.display = 'flex';
    document.getElementById('mbAIHint').style.display   = 'none';
    showMbButtons(false);
    document.getElementById('mbModal').classList.add('show');
    mbTimer = setTimeout(() => { closeMbModal(); if (onDone) onDone(); }, 2100);
}

// ── SHARED ─────────────────────────────────────────────────────────────────────

function useAIInstead() {
    closeEvModal(); closeMbModal();
    if (!aiOpen) toggleAI();
    setTimeout(() => document.getElementById('msgIn').focus(), 280);
}
