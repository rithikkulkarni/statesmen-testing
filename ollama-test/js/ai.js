async function send() {
    const inp = document.getElementById('msgIn');
    const text = inp.value.trim();
    if (!text || busy) return;
    document.querySelector('.ai-welcome')?.remove();
    hideQPs();
    inp.value = ''; inp.style.height = 'auto';
    hist.push({role: 'user', content: text});
    addMsg('user', text);
    setBusy(true);
    const botEl = addBotShell();
    try {
        const res = await fetch(`${OLLAMA}/api/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({model: MODEL, messages: buildCtx(), stream: true}),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rdr = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '', full = '';
        botEl.innerHTML = '';
        while (true) {
            const {done, value} = await rdr.read();
            if (done) break;
            buf += dec.decode(value, {stream: true});
            const lines = buf.split('\n');
            buf = lines.pop();
            for (const ln of lines) {
                if (!ln.trim()) continue;
                try {
                    const d = JSON.parse(ln);
                    if (d.message?.content) { full += d.message.content; botEl.innerHTML = md(strip(full)); scrollMsgs(); }
                } catch {}
            }
        }
        if (buf.trim()) { try { const d = JSON.parse(buf); if (d.message?.content) full += d.message.content; } catch {} }
        botEl.innerHTML = md(strip(full));
        scrollMsgs();
        hist.push({role: 'assistant', content: full});
        parseAct(full).forEach(exec);
    } catch (err) {
        if (err.name !== 'AbortError')
            botEl.innerHTML = `<span style="color:var(--red)">⚠️ Cannot reach Ollama at <code>${OLLAMA}</code> — is it running?</span>`;
    } finally {
        setBusy(false); rdr = null;
    }
}

function stopGen() { if (rdr) rdr.cancel(); }

function setBusy(on) {
    busy = on;
    document.getElementById('sendBtn').style.display = on ? 'none' : 'flex';
    document.getElementById('stopBtn').style.display = on ? 'flex'  : 'none';
    document.getElementById('msgIn').disabled = on;
    if (!on) document.getElementById('msgIn').focus();
}

function addMsg(role, content) {
    const wrap = document.getElementById('msgs');
    const d  = document.createElement('div'); d.className = `msg ${role === 'user' ? 'user' : 'asst'}`;
    const av = document.createElement('div'); av.className = 'msg-av'; av.textContent = role === 'user' ? 'AD' : '🤖';
    const b  = document.createElement('div'); b.className = 'msg-body';
    b.innerHTML = role === 'user' ? esc(content) : md(content);
    d.appendChild(av); d.appendChild(b); wrap.appendChild(d); scrollMsgs();
    return b;
}

function addBotShell() {
    const wrap = document.getElementById('msgs');
    const d  = document.createElement('div'); d.className = 'msg asst';
    const av = document.createElement('div'); av.className = 'msg-av'; av.textContent = '🤖';
    const b  = document.createElement('div'); b.className = 'msg-body';
    b.innerHTML = '<div class="typing"><div class="td"></div><div class="td"></div><div class="td"></div></div>';
    d.appendChild(av); d.appendChild(b); wrap.appendChild(d); scrollMsgs();
    return b;
}

function scrollMsgs() {
    const e = document.getElementById('msgs');
    e.scrollTop = e.scrollHeight;
}

function buildCtx() {
    const sys = `You are an AI assistant embedded in a network admin platform. Your key value: you replace tedious 10–15 field forms with natural conversation.

CURRENT DATA:
Events (${db.events.length}):
${db.events.map(e => `  [ID:${e.id}] "${e.name}" | ${e.date} | ${e.location} | cap:${e.capacity} | ${e.status}`).join('\n')}

Members (${db.members.length}):
${db.members.map(m => `  [ID:${m.id}] ${m.name} | ${m.email} | year:${m.year} | chapter:${m.chapter} | ${m.status}`).join('\n')}

ACTION FORMAT:
[ACTION:create_event]{"name":"...","date":"YYYY-MM-DD","location":"...","capacity":100,"status":"Planning"}[/ACTION]
[ACTION:update_event]{"id":1,"updates":{"status":"Confirmed","date":"2025-12-05"}}[/ACTION]
[ACTION:create_member]{"name":"...","email":"...","year":"2020","chapter":"...","status":"Active"}[/ACTION]
[ACTION:update_member]{"id":1,"updates":{"status":"Active"}}[/ACTION]

CONVERSATION RULES:
1. For create_event you need at minimum: name, date, location, capacity. If any are missing, ask for them conversationally — max 2 questions at a time, friendly and brief.
2. For create_member you need at minimum: name and email. Year and chapter are helpful but optional.
3. If the user says they don't know a field (e.g. "not sure about the date yet"), accept "TBD" and proceed — never block on a missing field indefinitely.
4. Only emit an [ACTION] block once you have enough to proceed. Never emit an action for incomplete data.
5. After every action, add one brief practical tip to help the admin learn.
6. For general questions, just answer normally — no action block needed.

Example conversation:
User: "I want to create a summer event"
You: "Happy to help! What date is it on, and where will it be held?"
User: "July 10th, somewhere in London, exact venue TBD"
You: "Got it. And roughly how many people are you expecting?"
User: "Around 80"
You: "Done! Created the event." [ACTION:create_event]{"name":"Summer Event","date":"2025-07-10","location":"London (TBD)","capacity":80,"status":"Planning"}[/ACTION]`;
    return [{role: 'system', content: sys}, ...hist];
}

function parseAct(text) {
    const out = [], re = /\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        try { out.push({type: m[1], data: JSON.parse(m[2])}); } catch {}
    }
    return out;
}

function strip(t) { return t.replace(/\[ACTION:\w+\][\s\S]*?\[\/ACTION\]/g, '').trim(); }

function exec({type, data}) {
    if (type === 'create_event') {
        const ev = {id: db.nextEv++, name: data.name || 'New Event', date: data.date || '', location: data.location || 'TBD', capacity: data.capacity || 0, status: data.status || 'Planning'};
        showEvAIFill(data, () => { db.events.push(ev); renderPage(); hl(`ev-${ev.id}`); toast(`✨ Event created: "${ev.name}"`); });
    } else if (type === 'update_event') {
        const ev = db.events.find(e => e.id === data.id);
        if (ev) {
            if (data.updates) Object.assign(ev, data.updates);
            else if (data.field) ev[data.field] = data.value;
            renderPage(); hl(`ev-${ev.id}`); toast(`✓ Updated: "${ev.name}"`);
        }
    } else if (type === 'create_member') {
        const mb = {id: db.nextMb++, name: data.name || 'New Member', email: data.email || '', year: data.year || '', chapter: data.chapter || '', status: data.status || 'Active'};
        showMbAIFill(data, () => { db.members.push(mb); renderPage(); hl(`mb-${mb.id}`); toast(`✨ Member added: ${mb.name}`); });
    } else if (type === 'update_member') {
        const mb = db.members.find(m => m.id === data.id);
        if (mb) {
            if (data.updates) Object.assign(mb, data.updates);
            else if (data.field) mb[data.field] = data.value;
            renderPage(); hl(`mb-${mb.id}`); toast(`✓ Updated: ${mb.name}`);
        }
    }
}
