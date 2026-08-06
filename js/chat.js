import { sb } from './supabase.js';

export const NOTIF_ICONS = { match: '🎉', joined: '🤝', left: '👋', status_change: '🔄' };
export const SUPPORT_WA_NUMBER = '201101002429';

export function fmtNotifTime(iso) {
    try {
        return new Date(iso).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' });
    } catch (e) { return ''; }
}

let lastNotifCount = 0;
let notifCountKnown = false;
let lastSeenMatchNotifId = null;

export async function refreshNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const tokens = Object.values(window.getLocalTokens ? window.getLocalTokens() : {});
    if (tokens.length === 0) { badge.classList.add('hidden'); return; }
    try {
        const { data, error } = await sb.rpc('get_my_notifications', { p_tokens: tokens });
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

let notifToastTimer;
export function showNotifToast(matchNotif) {
    const toast = document.getElementById('notif-toast');
    if (!toast) return;
    const titleEl = toast.querySelector('.notif-toast-title');
    const subEl = toast.querySelector('.notif-toast-sub');
    const btn = toast.querySelector('button');
    if (matchNotif && matchNotif.related_trip_id) {
        titleEl.textContent = '🎉 ظهر تطابق محتمل لبحثك';
        subEl.textContent = '👈 شوف الرحلة';
        btn.onclick = () => { toast.classList.remove('show'); if (window.openSingleTripModal) window.openSingleTripModal(matchNotif.related_trip_id); };
    } else {
        titleEl.textContent = 'عندك تحديث جديد';
        subEl.textContent = 'دوس هنا تشوف الإشعارات';
        btn.onclick = () => { document.getElementById('notif-toast').classList.remove('show'); openNotifications(); };
    }
    clearTimeout(notifToastTimer);
    toast.classList.add('show');
    notifToastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
}

export async function openNotifications() {
    const modal = document.getElementById('notif-modal');
    const list = document.getElementById('notif-list');
    modal.classList.remove('hidden');
    const tokens = Object.values(window.getLocalTokens ? window.getLocalTokens() : {});
    if (tokens.length === 0) {
        list.innerHTML = `<p class="text-center py-10 text-gray-400 font-black text-sm">لسه معندكش رحلة مربوطة بالجهاز ده، فمفيش إشعارات تتعرض.</p>`;
        return;
    }
    list.innerHTML = '<p class="text-center py-10 text-gray-400 font-black text-sm">جاري التحميل...</p>';
    const { data, error } = await sb.rpc('get_my_notifications', { p_tokens: tokens });
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
        const clickTarget = isMatch ? `window.openSingleTripModal('${n.related_trip_id}')` : (isOwnTripUpdate ? `window.openOwnTripModal('${n.trip_id}')` : '');
        const isMatchUnread = n.type === 'match' && !n.is_read;
        const styleClass = n.is_read ? 'bg-gray-50 border-gray-100' : (isMatchUnread ? 'bg-orange-50 border-orange-300' : 'bg-emerald-50 border-emerald-200');
        return `
        <div class="p-3 rounded-2xl border ${styleClass} ${clickable ? 'cursor-pointer active:scale-95 transition' : ''}" ${clickable ? `onclick="${clickTarget}"` : ''}>
            <div class="flex items-start gap-2">
                <span class="text-lg">${NOTIF_ICONS[n.type] || '🔔'}</span>
                <div class="flex-1 text-right">
                    <p class="font-black text-xs text-slate-800">${n.title}</p>
                    ${n.body ? `<p class="text-[11px] text-gray-500 font-bold mt-1">${n.body}</p>` : ''}
                    <p class="text-[9px] text-gray-400 font-bold mt-1">${fmtNotifTime(n.created_at)}</p>
                    ${clickable ? `<p class="text-[10px] text-orange-600 font-black mt-2">👈 دوس هنا تشوف الرحلة</p>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
        await sb.rpc('mark_notifications_read', { p_tokens: tokens, p_ids: unreadIds });
        refreshNotifBadge();
    }
}

export function closeNotifications() {
    document.getElementById('notif-modal').classList.add('hidden');
}

export async function markAllNotificationsRead() {
    const tokens = Object.values(window.getLocalTokens ? window.getLocalTokens() : {});
    if (tokens.length === 0) return;
    await sb.rpc('mark_all_notifications_read', { p_tokens: tokens });
    openNotifications();
}

// FOFi Bot Logic
export const FOFI_KB = {
    post: { title: 'نشر مشوار جديد 📝', body: 'تسجل مشوارك ببيانات المكان والمواعيد بسهولة.', chips: [{ label: '📲 سجّل دلوقتي', action: "window.closeFofi(); window.uiTab('post');" }] },
    search: { title: 'البحث عن رحلة 🔎', body: 'تستكشف الكباتن أو طلبات الركاب من التبويب المخصص.', chips: [{ label: '🔎 استكشف', action: "window.closeFofi(); window.uiTab('search');" }] }
};

export function openFofi(topic) {
    const panel = document.getElementById('fofi-panel');
    panel.classList.add('open');
    document.getElementById('fofi-body').innerHTML = '<div class="fofi-bubble-bot">أهلًا بيك! 👋 أنا <b>FOFi</b>، مساعدك في Sharride. تحب تسألني في إيه؟</div>';
}
export function closeFofi() { document.getElementById('fofi-panel').classList.remove('open'); }
