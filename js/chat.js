const NOTIF_ICONS = { match: '🎉', joined: '🤝', left: '👋', status_change: '🔄' };
const SUPPORT_WA_NUMBER = '201101002429';

function fmtNotifTime(iso) {
    try {
        return new Date(iso).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' });
    } catch (e) { return ''; }
}

let lastNotifCount = 0;
let notifCountKnown = false;
let lastSeenMatchNotifId = null;

async function refreshNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const tokens = Object.values(getLocalTokens());
    if (tokens.length === 0) { badge.classList.add('hidden'); return; }
    try {
        const { data, error } = await window.sb.rpc('get_my_notifications', { p_tokens: tokens });
        if (error) { console.error(error); return; }
        const notifData = data || [];

        const unreadCount = notifData.filter(n => !n.is_read).length;
        if (unreadCount > 0) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.classList.remove('hidden'); }
        else { badge.classList.add('hidden'); }

        const newestUnreadMatch = notifData.find(n => n.type === 'match' && !n.is_read && n.related_trip_id);
        const isGenuinelyNewMatch = notifCountKnown && newestUnreadMatch && newestUnreadMatch.id !== lastSeenMatchNotifId;

        if (isGenuinelyNewMatch) {
            showNotifToast(newestUnreadMatch);
        } else if (notifCountKnown && !newestUnreadMatch && unreadCount > lastNotifCount) {
            showNotifToast(null);
        }
        if (newestUnreadMatch) lastSeenMatchNotifId = newestUnreadMatch.id;

        lastNotifCount = unreadCount;
        notifCountKnown = true;
    } catch (e) { console.error(e); }
}
window.refreshNotifBadge = refreshNotifBadge;

let notifToastTimer;
function showNotifToast(matchNotif) {
    const toast = document.getElementById('notif-toast');
    if (!toast) return;
    const titleEl = toast.querySelector('.notif-toast-title');
    const subEl = toast.querySelector('.notif-toast-sub');
    const btn = toast.querySelector('button');
    if (matchNotif && matchNotif.related_trip_id) {
        titleEl.textContent = '🎉 ظهر تطابق محتمل لبحثك';
        subEl.textContent = '👈 شوف الرحلة';
        btn.onclick = () => { toast.classList.remove('show'); openSingleTripModal(matchNotif.related_trip_id); };
    } else {
        titleEl.textContent = 'عندك تحديث جديد';
        subEl.textContent = 'دوس هنا تشوف الإشعارات';
        btn.onclick = openNotifFromToast;
    }
    clearTimeout(notifToastTimer);
    toast.classList.add('show');
    notifToastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
}

function openNotifFromToast() {
    document.getElementById('notif-toast').classList.remove('show');
    openNotifications();
}
window.openNotifFromToast = openNotifFromToast;

async function openNotifications() {
    const modal = document.getElementById('notif-modal');
    const list = document.getElementById('notif-list');
    modal.classList.remove('hidden');
    const tokens = Object.values(getLocalTokens());
    if (tokens.length === 0) {
        list.innerHTML = `<p class="text-center py-10 text-gray-400 font-black text-sm">لسه معندكش رحلة مربوطة بالجهاز ده، فمفيش إشعارات تتعرض.</p>`;
        return;
    }
    list.innerHTML = '<p class="text-center py-10 text-gray-400 font-black text-sm">جاري التحميل...</p>';
    const { data, error } = await window.sb.rpc('get_my_notifications', { p_tokens: tokens });
    if (error || !data || data.length === 0) {
        list.innerHTML = `<p class="text-center py-10 text-gray-400 font-black text-sm leading-relaxed">لسه مفيش تحديثات.<br>لما حد يهتم بمشوارك أو يظهر تطابق مناسب، هتلاقيه هنا 🔔</p>`;
        return;
    }

    const sortedData = [...data].sort((a, b) => {
        const aPriority = (a.type === 'match' && !a.is_read) ? 1 : 0;
        const bPriority = (b.type === 'match' && !b.is_read) ? 1 : 0;
        return bPriority - aPriority;
    });

    list.innerHTML = sortedData.map(n => {
        const isMatch = n.type === 'match' && !!n.related_trip_id;
        const isOwnTripUpdate = (n.type === 'joined' || n.type === 'left') && !!n.trip_id;
        const clickable = isMatch || isOwnTripUpdate;
        const clickTarget = isMatch ? `openSingleTripModal('${n.related_trip_id}')` : (isOwnTripUpdate ? `openOwnTripModal('${n.trip_id}')` : '');
        const isMatchUnread = n.type === 'match' && !n.is_read;
        const styleClass = n.is_read ? 'bg-gray-50 border-gray-100' : (isMatchUnread ? 'bg-orange-50 border-orange-300' : 'bg-emerald-50 border-emerald-200');
        return `
        <div class="p-3 rounded-2xl border ${styleClass} ${clickable ? 'cursor-pointer active:scale-95 transition' : ''}" ${clickable ? `onclick="${clickTarget}"` : ''}>
            <div class="flex items-start gap-2">
                <span class="text-lg">${NOTIF_ICONS[n.type] || '🔔'}</span>
                <div class="flex-1 text-right">
                    <p class="font-black text-xs text-slate-800">${escapeHtml(n.title)}</p>
                    ${n.body ? `<p class="text-[11px] text-gray-500 font-bold mt-1">${escapeHtml(n.body)}</p>` : ''}
                    <p class="text-[9px] text-gray-400 font-bold mt-1">${fmtNotifTime(n.created_at)}</p>
                    ${clickable ? `<p class="text-[10px] text-orange-600 font-black mt-2">👈 دوس هنا تشوف الرحلة</p>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
        await window.sb.rpc('mark_notifications_read', { p_tokens: tokens, p_ids: unreadIds });
        refreshNotifBadge();
    }
}
window.openNotifications = openNotifications;

function closeNotifications() {
    document.getElementById('notif-modal').classList.add('hidden');
}
window.closeNotifications = closeNotifications;

async function markAllNotificationsRead() {
    const tokens = Object.values(getLocalTokens());
    if (tokens.length === 0) return;
    await window.sb.rpc('mark_all_notifications_read', { p_tokens: tokens });
    openNotifications();
}
window.markAllNotificationsRead = markAllNotificationsRead;

// FOFi Bot Logic
const FOFI_KB = {
    post: {
        title: 'نشر مشوار جديد 📝',
        body: 'تقدر تسجّل مشوارك في خطوات بسيطة: تختار دورك (كابتن ولا راكب)، تحدد مكان الانطلاق والوجهة، وتحط موعد ذهاب و/أو عودة.',
        chips: [ { label: '📲 سجّل مشوارك دلوقتي', action: "closeFofi(); uiTab('post');" } ]
    },
    search: {
        title: 'البحث عن رحلة 🔎',
        body: 'من قسم "استكشاف" تقدر تتنقل بين رحلات الكباتن ورحلات الركاب، وتفلتر حسب مكان الانطلاق والوجهة.',
        chips: [ { label: '🔎 روح لقسم الاستكشاف', action: "closeFofi(); uiTab('search');" } ]
    }
};

function fofiAddBot(html) {
    const body = document.getElementById('fofi-body');
    const div = document.createElement('div');
    div.className = 'fofi-bubble-bot';
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function fofiAddChips(chips) {
    if (!chips || chips.length === 0) return;
    const body = document.getElementById('fofi-body');
    const row = document.createElement('div');
    row.className = 'fofi-chip-row';
    chips.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'fofi-chip ' + (c.cls || '');
        btn.textContent = c.label;
        btn.setAttribute('onclick', c.action);
        row.appendChild(btn);
    });
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
}

function openFofi(topic) {
    const panel = document.getElementById('fofi-panel');
    panel.classList.add('open');
    document.getElementById('fofi-body').innerHTML = '';
    fofiAddBot('أهلًا بيك! 👋 أنا <b>FOFi</b>، مساعدك في Sharride. تحب تسألني في إيه؟');
    if (topic && FOFI_KB[topic]) {
        fofiGo(topic);
    } else {
        fofiAddChips([
            { label: '📝 نشر مشوار', action: "fofiGo('post')" },
            { label: '🔎 البحث عن رحلة', action: "fofiGo('search')" }
        ]);
    }
}
window.openFofi = openFofi;

function closeFofi() {
    document.getElementById('fofi-panel').classList.remove('open');
}
window.closeFofi = closeFofi;

function fofiGo(topicKey) {
    const t = FOFI_KB[topicKey];
    if (!t) return;
    fofiAddBot(`<b>${t.title}</b><br><br>${t.body}`);
    fofiAddChips(t.chips || []);
}
window.fofiGo = fofiGo;
