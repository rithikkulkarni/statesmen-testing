function fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}); }
    catch { return d || '—'; }
}

function badge(s) {
    const map = {Confirmed:'bg-green',Active:'bg-green',Planning:'bg-blue',Draft:'bg-amber',Inactive:'bg-gray',Cancelled:'bg-red',Postponed:'bg-amber'};
    return `<span class="badge ${map[s] || 'bg-gray'}">${s}</span>`;
}

function ph(icon, title, desc) {
    return `<div class="ph"><div class="ph-icon">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`;
}

function setGlow(id, value) {
    const el = document.getElementById(id);
    if (!el || !value) return false;
    el.value = value;
    el.classList.remove('ai-glow');
    void el.offsetWidth;
    el.classList.add('ai-glow');
    return true;
}

function setSelectVal(id, value) {
    const el = document.getElementById(id);
    if (!el || !value) return;
    for (const opt of el.options) {
        if (opt.value.toLowerCase() === value.toLowerCase() || opt.text.toLowerCase() === value.toLowerCase()) {
            el.value = opt.value; return;
        }
    }
    const opt = document.createElement('option');
    opt.value = value; opt.text = value;
    el.appendChild(opt); el.value = value;
}

function inferEvType(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('career') || n.includes('fair'))                              return 'Career Fair';
    if (n.includes('gala')   || n.includes('dinner') || n.includes('banquet'))  return 'Social';
    if (n.includes('network') || n.includes('mixer'))                            return 'Networking';
    if (n.includes('reunion') || n.includes('homecoming') || n.includes('anniversary')) return 'Reunion';
    if (n.includes('workshop') || n.includes('seminar'))                         return 'Workshop';
    if (n.includes('fundrais') || n.includes('giving') || n.includes('charity')) return 'Fundraiser';
    if (n.includes('virtual') || n.includes('webinar'))                          return 'Webinar';
    return 'Networking';
}

function inferCountry(loc) {
    const l = (loc || '').toLowerCase();
    if (l.includes('london')   || l.includes(' uk'))      return 'United Kingdom';
    if (l.includes('new york') || l.includes(' usa'))     return 'United States';
    if (l.includes('virtual')  || l.includes('online'))   return 'Virtual / Online';
    if (l.includes('paris'))   return 'France';
    if (l.includes('berlin'))  return 'Germany';
    if (l.includes('dubai'))   return 'UAE';
    if (l.includes('lagos'))   return 'Nigeria';
    if (l.includes('mumbai'))  return 'India';
    if (l.includes('sydney'))  return 'Australia';
    return '';
}

function subDays(d, n) {
    try {
        const dt = new Date(d + 'T00:00:00');
        dt.setDate(dt.getDate() - n);
        return dt.toISOString().split('T')[0];
    } catch { return ''; }
}

function xa(s) { return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function esc(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function md(t) {
    let h = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    h = h.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`);
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    h = h.replace(/^---+$/gm, '<hr>');
    h = h.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    h = h.replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>');
    h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
    h = h.replace(/\n\n+/g, '</p><p>');
    h = h.replace(/\n/g, '<br>');
    if (!/^<(h[1-6]|ul|ol|pre|hr|p)/.test(h)) h = `<p>${h}</p>`;
    return h;
}

function resize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}
