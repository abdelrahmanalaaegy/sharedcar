let tripsPublic = [];
let tripsMine = [];
let tripsAdmin = [];
let openModalTripId = null;
let openModalTripMode = null;

const PUBLIC_TRIP_COLS = "id,user_role,origin,destination,departure_time,return_time,notes,seats_available,price_per_seat,has_ac,status,joined_passengers,created_at";
const ADMIN_HASH = '#owner-access';
const busyActions = new Set();

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.escapeHtml = escapeHtml;

function formatPriceDisplay(price) {
    if (price === null || price === undefined) return 'حسب الاتفاق';
    const str = String(price).trim();
    if (!str || str === 'null' || str === 'undefined') return 'حسب الاتفاق';
    if (str.includes('ج.م')) return escapeHtml(str);
    return escapeHtml(str) + ' ج.م';
}
window.formatPriceDisplay = formatPriceDisplay;

function extractPhoneFromRpcData(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string' || typeof data === 'number') return String(data);
    if (Array.isArray(data)) {
        if (data.length === 0) return '';
        const first = data[0];
        if (typeof first === 'string' || typeof first === 'number') return String(first);
        if (first && typeof first === 'object') return first.whatsapp_number || first.phone || first.value || '';
        return '';
    }
    if (typeof data === 'object') return data.whatsapp_number || data.phone || data.value || '';
    return '';
}

async function openWhatsApp(tripId, message, sheetTitle, sheetSubtitle) {
    try {
        const { data, error } = await window.sb.rpc('get_trip_contact', { p_trip_id: tripId });
        if (error) return alert('تعذر جلب رقم التواصل ❌');
        const phone = extractPhoneFromRpcData(data);
        if (!phone) return alert('تعذر جلب رقم التواصل ❌');
        const url = `https://wa.me/${encodeURIComponent(phone)}` + (message ? `?text=${encodeURIComponent(message)}` : '');
        showWhatsAppConfirmSheet(url, sheetTitle, sheetSubtitle);
    } catch (e) { alert('حدث خطأ أثناء محاولة التواصل ❌'); }
}
window.openWhatsApp = openWhatsApp;

function showWhatsAppConfirmSheet(url, title, subtitle) {
    document.getElementById('wa-confirm-link').href = url;
    document.getElementById('wa-confirm-title').textContent = title || 'تواصل واتساب 💬';
    document.getElementById('wa-confirm-subtitle').textContent = subtitle || 'دوس على الزرار عشان يفتح تطبيق واتساب مباشرة';
    document.getElementById('wa-confirm-sheet').classList.add('open');
}
function closeWaConfirmSheet() { document.getElementById('wa-confirm-sheet').classList.remove('open'); }
window.closeWaConfirmSheet = closeWaConfirmSheet;

function genToken() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    return 'tk' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function getLocalTokens() { try { return JSON.parse(localStorage.getItem('sr_tokens') || '{}'); } catch (e) { return {}; } }
window.getLocalTokens = getLocalTokens;

function getLocalToken(id) { return getLocalTokens()[id]; }
window.getLocalToken = getLocalToken;

function saveLocalToken(id, token) { const t = getLocalTokens(); t[id] = token; localStorage.setItem('sr_tokens', JSON.stringify(t)); }
function getJoinedTrips() { try { return JSON.parse(localStorage.getItem('sr_joined') || '{}'); } catch (e) { return {}; } }
window.getJoinedTrips = getJoinedTrips;

function saveJoinedTrip(id, phone) { const j = getJoinedTrips(); j[id] = phone; localStorage.setItem('sr_joined', JSON.stringify(j)); }
function removeJoinedTripLocal(id) { const j = getJoinedTrips(); delete j[id]; localStorage.setItem('sr_joined', JSON.stringify(j)); }
function copyMgmtCode(code) { navigator.clipboard.writeText(code).then(() => alert('تم نسخ الكود ✅')); }
window.copyMgmtCode = copyMgmtCode;

async function linkTripByCodeOnly() {
    const code = prompt('اكتب هنا كود إدارة الرحلة اللي وصلك:');
    if (!code) return;
    const { data: tripId, error } = await window.sb.rpc('find_trip_by_mgmt_code', { p_token: code.trim() });
    if (error || !tripId) { alert('الكود غير صحيح ❌'); return; }
    saveLocalToken(tripId, code.trim());
    alert('تم ربط الرحلة بجهازك ✅');
    apiGetMyTrips();
    refreshNotifBadge();
}
window.linkTripByCodeOnly = linkTripByCodeOnly;

async function apiGetTrips() {
    const list = document.getElementById('list-public');
    if (!list) return;
    list.innerHTML = '<p class="text-center py-20 text-gray-400 font-black italic">جاري البحث...</p>';
    const o = document.getElementById('f-o').value;
    const d = document.getElementById('f-d').value;
    const role = document.getElementById('f-user-identity').value;

    let q = window.sb.from('public_trips').select(PUBLIC_TRIP_COLS).eq('status', 'active').eq('user_role', role);
    if(o) q = q.eq('origin', o);
    if(d) q = q.eq('destination', d);
    const {data} = await q;
    if(data) {
        data.sort((a, b) => LOCS.indexOf(a.origin) - LOCS.indexOf(b.origin));
        tripsPublic = data;
        if(data.length > 0) {
            let html = ''; let lastRoute = "";
            data.forEach(t => {
                let route = `${t.origin} ⬅️ ${t.destination}`;
                if(route !== lastRoute) { html += `<div class="route-header">📍 مسار: ${escapeHtml(route)}</div>`; lastRoute = route; }
                html += card(t, 'public');
            });
            list.innerHTML = html;
        } else {
            list.innerHTML = `<div class="no-results-card"><div class="text-4xl mb-4">✨</div><h3 class="text-[#00a884] font-black mb-3 text-xl">${role==='captain'?'مفيش كباتن؟':'مفيش ركاب؟'}</h3><p class="text-gray-600 text-sm mb-6 font-bold leading-relaxed">سجل مشوارك دلوقتي في القائمة، والناس هتلاقي طلبك وتتواصل معاك.</p><button onclick="uiTab('post'); uiRole('${role}');" class="btn-green w-full text-lg shadow-xl pulse-loading italic">سجل مشوارك الآن ➕</button></div>`;
        }
    }
}
window.apiGetTrips = apiGetTrips;

async function apiGetMyTrips() {
    const list = document.getElementById('list-mine');
    if (!list) return;
    const tokens = Object.values(getLocalTokens());
    if (tokens.length === 0) {
        list.innerHTML = `<div class="no-results-card"><div class="text-4xl mb-4">📭</div><h3 class="text-[#00a884] font-black mb-3 text-xl">مفيش رحلات مربوطة بالجهاز ده</h3><button onclick="uiTab('post')" class="btn-green w-full text-lg shadow-xl italic mb-2">سجل مشوارك الآن ➕</button><button onclick="linkTripByCodeOnly()" class="w-full bg-orange-500 text-white py-3 rounded-2xl font-black text-[13px] shadow-md">🔑 رجّع رحلاتك القديمة</button></div>`;
        return;
    }
    list.innerHTML = '<p class="text-center py-16 text-gray-400 font-black italic">جاري تحميل رحلاتك...</p>';
    const {data, error} = await window.sb.rpc('get_my_trips_by_tokens', { p_tokens: tokens });
    if (data) {
        const visibleData = data.filter(t => t.status !== 'archived');
        tripsMine = visibleData;
        list.innerHTML = visibleData.length > 0 ? visibleData.map(t => card(t, 'my')).join('') : `<div class="no-results-card"><div class="text-4xl mb-4">📭</div><h3 class="text-[#00a884] font-black mb-3 text-xl">مفيش رحلات مربوطة بالجهاز ده</h3></div>`;
    }
}
window.apiGetMyTrips = apiGetMyTrips;

async function apiPost(event) {
    event.preventDefault();
    const h1 = document.getElementById('in-h1').value;
    const h2 = document.getElementById('in-h2').value;
    if(!h1 && !h2) return alert('يجب اختيار موعد واحد على الأقل');

    const myPhone = promptJoinPhone();
    if (!myPhone) return;

    const btn = document.getElementById('btn-pub'); btn.disabled = true; btn.innerText = "جاري الحفظ...";
    const postPriceRaw = document.getElementById('in-price').value ? document.getElementById('in-price').value.trim().replace(/[^0-9.]/g, '') : '';
    const token = genToken();

    const payload = {
        user_role: document.getElementById('in-role').value, origin: document.getElementById('in-o').value, destination: document.getElementById('in-d').value,
        departure_time: h1 ? `${h1}:${document.getElementById('in-m1').value} ${document.getElementById('in-p1').value}` : '',
        return_time: h2 ? `${h2}:${document.getElementById('in-m2').value} ${document.getElementById('in-p2').value}` : null,
        whatsapp_number: "2" + myPhone, notes: document.getElementById('in-notes').value,
        seats_available: document.getElementById('in-role').value === 'captain' ? (parseInt(document.getElementById('in-seats').value) || 0) : 0,
        has_ac: document.getElementById('in-ac').value === "true",
        price_per_seat: postPriceRaw ? postPriceRaw : "", status: 'active', joined_passengers: [],
        mgmt_code: token
    };

    const { data, error } = await window.sb.from('trips').insert([payload]).select('id').single();
    if(!error && data) {
        saveLocalToken(data.id, token);
        alert('تم تسجيل مشوارك بنجاح! 🎉');
        document.getElementById('postForm').reset(); uiTab('search');
        refreshNotifBadge();
    } else {
        alert('فشل النشر ❌: ' + error.message);
    }
    btn.disabled = false; btn.innerText = "نشر الآن 🚀";
}
window.apiPost = apiPost;

function openEdit(id, mode) {
    const source = mode === 'admin' ? tripsAdmin : mode === 'my' ? tripsMine : tripsPublic;
    const t = source.find(trip => trip.id === id);
    if(!t) return alert("حدث خطأ في تحميل البيانات");
    const isAdmin = mode === 'admin';
    const isCap = t.user_role === 'captain';
    document.getElementById('edit-admin-area').classList.toggle('hidden', !isAdmin);
    document.getElementById('edit-cap-area').style.display = isCap ? 'block' : 'none';
    document.getElementById('global-edit-form').style.display = 'flex';
    document.getElementById('edit-id').value = t.id;
    document.getElementById('edit-mode').value = mode;
    document.getElementById('edit-role').value = t.user_role;
    document.getElementById('edit-phone').value = t.whatsapp_number ? t.whatsapp_number.replace(/^20/, '0') : '';
    document.getElementById('edit-o').value = t.origin;
    document.getElementById('edit-d').value = t.destination;
    
    if(t.departure_time && t.departure_time !== 'null') {
        const p = t.departure_time.split(/[: ]/);
        document.getElementById('edit-h1').value = p[0];
        document.getElementById('edit-m1').value = p[1];
        document.getElementById('edit-p1').value = p[2];
    }
    if(t.return_time && t.return_time !== 'null') {
        const p = t.return_time.split(/[: ]/);
        document.getElementById('edit-h2').value = p[0];
        document.getElementById('edit-m2').value = p[1];
        document.getElementById('edit-p2').value = p[2];
    }

    document.getElementById('edit-price').value = t.price_per_seat ? String(t.price_per_seat).replace(/[^0-9.]/g, '') : '';
    document.getElementById('edit-seats').value = t.seats_available;
    document.getElementById('edit-ac').value = t.has_ac.toString();
    document.getElementById('edit-notes').value = t.notes || '';
}
window.openEdit = openEdit;

function closeEdit() { document.getElementById('global-edit-form').style.display = 'none'; }
window.closeEdit = closeEdit;

function toggleEditCapArea() {
    const isCap = document.getElementById('edit-role').value === 'captain';
    document.getElementById('edit-cap-area').style.display = isCap ? 'block' : 'none';
}
window.toggleEditCapArea = toggleEditCapArea;

async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const mode = document.getElementById('edit-mode').value;
    const source = mode === 'admin' ? tripsAdmin : mode === 'my' ? tripsMine : tripsPublic;
    const t = source.find(trip => trip.id === id);
    const isAdmin = mode === 'admin';
    const isCap = isAdmin ? (document.getElementById('edit-role').value === 'captain') : (t.user_role === 'captain');

    const h1 = document.getElementById('edit-h1').value;
    const h2 = document.getElementById('edit-h2').value;
    const editPriceRaw = document.getElementById('edit-price').value ? document.getElementById('edit-price').value.trim().replace(/[^0-9.]/g, '') : '';

    const payload = {
        origin: document.getElementById('edit-o').value, destination: document.getElementById('edit-d').value,
        departure_time: h1 ? `${h1}:${document.getElementById('edit-m1').value} ${document.getElementById('edit-p1').value}` : '',
        return_time: h2 ? `${h2}:${document.getElementById('edit-m2').value} ${document.getElementById('edit-p2').value}` : null,
        price_per_seat: isCap ? (editPriceRaw ? editPriceRaw : "") : "",
        seats_available: isCap ? parseInt(document.getElementById('edit-seats').value) : 0,
        has_ac: isCap ? (document.getElementById('edit-ac').value === "true") : false,
        notes: document.getElementById('edit-notes').value
    };

    const token = getLocalToken(id);
    const { error } = await window.sb.rpc('update_trip_secure', { p_id: id, p_token: token, p_payload: payload });
    if (!error) {
        alert('تم التحديث بنجاح ✅');
        closeEdit();
        apiGetMyTrips();
        apiGetTrips();
    } else {
        alert('فشل التحديث ❌: ' + error.message);
    }
}
window.saveEdit = saveEdit;

async function tripAction(id, act, mode) {
    if (busyActions.has(id)) return;
    const confirmMsg = act === 'archive' ? 'هتتخبى الرحلة نهائيًا. تأكيد؟' : 'تأكيد الإجراء؟';
    if(!confirm(confirmMsg)) return;
    busyActions.add(id);
    try {
        if (mode === 'admin') {
            let error;
            if(act === 'delperm') ({ error } = await window.sb.from('trips').delete().eq('id', id));
            else if(act === 'done') ({ error } = await window.sb.from('trips').update({status: 'completed'}).eq('id', id));
            else if(act === 'active') ({ error } = await window.sb.from('trips').update({status: 'active'}).eq('id', id));
            else if(act === 'del') ({ error } = await window.sb.from('trips').update({status: 'deleted'}).eq('id', id));
            if(error) throw error;
            apiAdminReload();
        } else {
            const token = getLocalToken(id);
            if(!token) { alert('الرحلة مش مربوطة بجهازك.'); return; }
            const realStatus = act === 'done' ? 'completed' : act === 'del' ? 'deleted' : act === 'archive' ? 'archived' : 'active';
            const { error } = await window.sb.rpc('set_trip_status_secure', { p_id: id, p_token: token, p_status: realStatus });
            if(error) throw error;
            apiGetMyTrips();
        }
        apiGetTrips();
    } catch (e) {
        alert('فشل تنفيذ الإجراء ❌: ' + e.message);
    } finally {
        busyActions.delete(id);
    }
}
window.tripAction = tripAction;

async function joinAction(tripId, origin, dest, ownerRole) {
    if (busyActions.has(tripId)) return;
    const newP = promptJoinPhone();
    if (!newP) return;
    busyActions.add(tripId);
    try {
        const { error } = await window.sb.rpc('join_trip_secure', { p_id: tripId, p_phone: newP });
        if (error) return alert('فشل الانضمام ❌: ' + error.message);

        saveJoinedTrip(tripId, newP);
        let msg = ownerRole === 'captain' ? `سلام عليكم يا كابتن، أنا حجزت معاك في رحلة ${origin} عبر Sharride.` : `سلام عليكم، أنا انضميت ليك في رحلة ${origin} عبر Sharride.`;
        openWhatsApp(tripId, msg, "تم الحجز بنجاح! ✅", "تواصل مع الطرف التاني لتأكيد الميعاد 💬");
        apiGetTrips();
        refreshNotifBadge();
    } finally {
        busyActions.delete(tripId);
    }
}
window.joinAction = joinAction;

async function leaveTrip(tripId) {
    if (busyActions.has(tripId)) return;
    const phone = getJoinedTrips()[tripId];
    if(!phone) { alert('مفيش بيانات انضمام محفوظة على هذا الجهاز.'); return; }
    if(!confirm('متأكد إنك عاوز تسيب المجموعة؟')) return;
    busyActions.add(tripId);
    try {
        const { error } = await window.sb.rpc('leave_trip_secure', { p_id: tripId, p_phone: phone });
        if(error) throw error;
        removeJoinedTripLocal(tripId);
        alert('تم خروجك بنجاح ✅');
        apiGetTrips();
    } catch (e) {
        removeJoinedTripLocal(tripId);
        alert('تم حذفك من الرحلة ✅');
        apiGetTrips();
    } finally {
        busyActions.delete(tripId);
    }
}
window.leaveTrip = leaveTrip;

async function removeJoiner(tripId, phoneToRemove, mode) {
    if(!confirm('إزالة هذا المنضم؟')) return;
    try {
        if (mode === 'admin') {
            const { data: trip } = await window.sb.from('trips').select('joined_passengers').eq('id', tripId).single();
            const passengers = (trip.joined_passengers || []).filter(p => p !== phoneToRemove);
            await window.sb.from('trips').update({ joined_passengers: passengers, status: 'active' }).eq('id', tripId);
            apiAdminReload();
        } else {
            const token = getLocalToken(tripId);
            await window.sb.rpc('remove_joiner_secure', { p_id: tripId, p_token: token, p_phone: phoneToRemove });
            apiGetMyTrips();
        }
        apiGetTrips();
    } catch (e) {
        alert('فشل ❌: ' + e.message);
    }
}
window.removeJoiner = removeJoiner;

let shareCtx = { text: '', url: '' };
const SHARE_FN_URL = "https://owzaevvsvwufozynzvin.supabase.co/functions/v1/share-trip";

async function shareTrip(text, tripId) {
    const url = SHARE_FN_URL + '?id=' + encodeURIComponent(tripId);
    shareCtx = { text, url };
    if (navigator.share) { navigator.share({ url: url }).catch(() => {}); }
    else { document.getElementById('share-sheet').classList.add('open'); }
}
window.shareTrip = shareTrip;

function closeShareSheet() { document.getElementById('share-sheet').classList.remove('open'); }
window.closeShareSheet = closeShareSheet;

function shareVia(platform) {
    const encodedUrl = encodeURIComponent(shareCtx.url);
    if (platform === 'copy') {
        navigator.clipboard.writeText(shareCtx.url).then(() => alert('تم نسخ اللينك ✅'));
        closeShareSheet();
        return;
    }
    const links = {
        whatsapp: `https://wa.me/?text=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        messenger: `fb-messenger://share/?link=${encodedUrl}`
    };
    window.open(links[platform], '_blank');
    closeShareSheet();
}
window.shareVia = shareVia;

function card(t, mode) {
    const isCap = t.user_role === 'captain';
    const isDone = t.status === 'completed';
    const isDeleted = t.status === 'deleted';
    const isArchived = t.status === 'archived';
    const passengers = t.joined_passengers || [];
    const displayPhone = t.whatsapp_number ? t.whatsapp_number.replace(/^20/, '0') : '';
    const fadeClass = (isDone || isDeleted || isArchived) ? 'content-fade' : '';

    const hasDep = t.departure_time && t.departure_time !== 'null';
    const hasRet = t.return_time && t.return_time !== 'null';
    let tripType = hasDep && hasRet ? '🔁 ذهاب وعودة' : hasDep ? '➡️ ذهاب فقط' : '⬅️ عودة فقط';

    const isAdminMode = mode === 'admin';
    const isLinked = isAdminMode || !!getLocalToken(t.id);
    let manageUI;
    if (mode === 'my' && !isLinked) {
        manageUI = `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 mt-2 text-center"><p class="text-[10px] font-black text-amber-700 mb-2">🔒 الرحلة مش مربوطة بالجهاز ده.</p><button onclick="linkTripWithCode('${t.id}')" class="bg-amber-600 text-white px-3 py-2 rounded-xl text-[10px] font-black">🔑 أدخل كود الإدارة</button></div>`;
    } else if(isArchived || isDeleted) {
        manageUI = `<div class="grid grid-cols-2 gap-2 mt-2"><button onclick="tripAction('${t.id}', 'active', '${mode}')" class="bg-green-600 text-white p-2 rounded-xl text-[9px] font-black">♻️ استرجاع</button><button onclick="tripAction('${t.id}', 'delperm', '${mode}')" class="bg-red-600 text-white p-2 rounded-xl text-[9px] font-black">🗑️ حذف نهائي</button></div>`;
    } else {
        manageUI = `<div class="grid grid-cols-3 gap-2 mt-2">${isDone ? `<button onclick="tripAction('${t.id}', 'active', '${mode}')" class="bg-green-600 text-white p-2 rounded-xl text-[9px] font-black">🔄 تنشيط</button>` : `<button onclick="tripAction('${t.id}', 'done', '${mode}')" class="bg-black text-white p-2 rounded-xl text-[9px] font-black">✅ اكتمال</button>`}<button onclick="openEdit('${t.id}', '${mode}')" class="bg-blue-600 text-white p-2 rounded-xl text-[9px] font-black">📝 تعديل</button><button onclick="tripAction('${t.id}', 'del', '${mode}')" class="bg-red-50 text-red-600 p-2 rounded-xl text-[9px] font-black">❌ حذف</button></div>`;
    }

    const localPhone = getJoinedTrips()[t.id];
    const alreadyJoined = !!localPhone && passengers.includes(localPhone);

    let btnUI;
    if (mode === 'public') {
        const inquiryMsg = 'سلام عليكم، شوفت رحلتك عبر Sharride وعاوز أستفسر.';
        if (isCap) {
            const inquiryLink = `<button onclick='openWhatsApp(${JSON.stringify(t.id)}, ${JSON.stringify(inquiryMsg)})' class="btn-outline flex-1">استفسار 💬</button>`;
            const actionBtn = alreadyJoined ? `<button onclick="leaveTrip('${t.id}')" class="btn-outline border-red-500 text-red-500 flex-1">إلغاء الحجز</button>` : `<button onclick='joinAction(${JSON.stringify(t.id)}, ${JSON.stringify(t.origin)}, ${JSON.stringify(t.destination)}, "captain")' class="btn-green flex-1 text-xs italic font-black">🤝 حجز مقعد</button>`;
            btnUI = `<div class="flex gap-2">${inquiryLink}${actionBtn}</div>`;
        } else {
            const offerLink = `<button onclick='openWhatsApp(${JSON.stringify(t.id)}, ${JSON.stringify(inquiryMsg)})' class="btn-blue flex-1 py-4 text-xs font-black italic shadow-md">كلمني 💬</button>`;
            const actionBtn = alreadyJoined ? `<button onclick="leaveTrip('${t.id}')" class="btn-outline border-red-500 text-red-500 flex-1">إلغاء الانضمام</button>` : `<button onclick='joinAction(${JSON.stringify(t.id)}, ${JSON.stringify(t.origin)}, ${JSON.stringify(t.destination)}, "passenger")' class="btn-outline flex-1 text-xs">انضم للمجموعة 🤝</button>`;
            btnUI = `<div class="flex gap-2 mt-1">${offerLink}${actionBtn}</div>`;
        }
    } else {
        btnUI = manageUI;
    }

    const priceFormatted = formatPriceDisplay(t.price_per_seat);

    return `<div class="trip-card"><div class="${fadeClass}"><div class="card-header"><div class="main-info"><h3 class="font-black text-[15px] text-slate-800 mb-1 truncate">${escapeHtml(t.origin)} ⬅️ ${escapeHtml(t.destination)}</h3><span class="inline-block bg-sky-100 text-sky-700 text-[9px] font-black px-2 py-1 rounded-lg mb-2">${tripType}</span><div class="flex gap-3 items-center text-[10px] text-gray-500 font-bold mb-2 italic">${hasDep?`<div>🕒 ذهاب: ${t.departure_time}</div>`:''} ${hasRet?`<div>🕒 عودة: ${t.return_time}</div>`:''}</div><div class="flex gap-2 mb-2">${isCap ? `<span class="feature-badge">💺 مقاعد: ${passengers.length}/${t.seats_available}</span><span class="feature-badge">${t.has_ac ? '❄️ مكيفة' : '❌ بدون'}</span>` : `<span class="feature-badge bg-orange-50 text-orange-700 font-black">👥 منضمين: ${passengers.length + 1} ركاب</span>`}</div></div><div class="side-info"><button onclick='shareTrip("", ${JSON.stringify(t.id)})' class="share-btn" aria-label="مشاركة"><svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M14 8V4l8 7-8 7v-4.05c-5.05.28-8.02 2-10 5.05.4-6.5 3.7-11.3 10-12z"/></svg></button><span class="role-badge ${isCap ? 'bg-blue-500' : 'bg-orange-500'}">${isCap?'كابتن':'راكب'}</span>${isCap ? `<span class="price-text">${priceFormatted}</span>` : ''}</div></div>${t.notes ? `<p class="text-[10px] bg-gray-50 p-3 rounded-2xl italic text-gray-600 font-medium border-r-4 border-gray-200 text-right">" ${escapeHtml(t.notes)} "</p>` : ''}</div><div>${btnUI}</div></div>`;
}
window.card = card;

async function openSingleTripModal(tripId) {
    closeNotifications();
    const modal = document.getElementById('single-trip-modal');
    const content = document.getElementById('single-trip-content');
    modal.classList.remove('hidden');
    openModalTripId = tripId;
    openModalTripMode = 'public';
    content.innerHTML = '<p class="text-center py-16 text-gray-400 font-black italic">جاري تحميل الرحلة...</p>';

    const { data, error } = await window.sb.from('public_trips').select(PUBLIC_TRIP_COLS).eq('id', tripId).maybeSingle();
    if (error || !data) {
        content.innerHTML = `<div class="no-results-card"><h3 class="text-slate-700 font-black mb-2 text-lg">الرحلة دي مبقتش متاحة</h3></div>`;
        return;
    }
    tripsPublic = tripsPublic.filter(t => t.id !== data.id).concat([data]);
    content.innerHTML = card(data, 'public');
}
window.openSingleTripModal = openSingleTripModal;

async function openOwnTripModal(tripId) {
    closeNotifications();
    const modal = document.getElementById('single-trip-modal');
    const content = document.getElementById('single-trip-content');
    modal.classList.remove('hidden');
    openModalTripId = tripId;
    openModalTripMode = 'my';
    content.innerHTML = '<p class="text-center py-16 text-gray-400 font-black italic">جاري تحميل الرحلة...</p>';

    const token = getLocalToken(tripId);
    if (!token) return;
    const { data } = await window.sb.rpc('get_my_trips_by_tokens', { p_tokens: [token] });
    const trip = (data || []).find(t => t.id === tripId);
    if (trip) {
        tripsMine = tripsMine.filter(t => t.id !== trip.id).concat([trip]);
        content.innerHTML = card(trip, 'my');
    }
}
window.openOwnTripModal = openOwnTripModal;

function closeSingleTripModal() {
    document.getElementById('single-trip-modal').classList.add('hidden');
    openModalTripId = null;
    openModalTripMode = null;
}
window.closeSingleTripModal = closeSingleTripModal;

async function loadAdminStats() {
    const { data: stats } = await window.sb.from('site_stats').select('visit_count').eq('id', 1).single();
    document.getElementById('visit-total').innerText = stats?.visit_count || 0;
    const { count: capsCount } = await window.sb.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('user_role', 'captain');
    const { count: passCount } = await window.sb.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('user_role', 'passenger');
    document.getElementById('count-cap').innerText = capsCount || 0;
    document.getElementById('count-pas').innerText = passCount || 0;
}
window.loadAdminStats = loadAdminStats;

async function apiAdminReload() {
    const phone = document.getElementById('admin-search-phone').value.trim();
    const origin = document.getElementById('admin-search-origin').value;
    const status = document.getElementById('admin-search-status').value;
    const dateFrom = document.getElementById('admin-search-date-from').value;
    const dateTo = document.getElementById('admin-search-date-to').value;

    let q = window.sb.from('trips').select('*');
    if(phone) q = q.ilike('whatsapp_number', `%${phone.replace(/^0/, '')}%`);
    if(origin) q = q.eq('origin', origin);
    if(status) q = q.eq('status', status);
    if(dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`);
    if(dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`);

    const {data} = await q;
    if(data) {
        tripsAdmin = data;
        document.getElementById('list-admin').innerHTML = data.length > 0 ? data.map(t => card(t, 'admin')).join('') : `<p class="text-center py-16 text-gray-400 font-black italic">مفيش رحلات مطابقة للبحث</p>`;
    }
}
window.apiAdminReload = apiAdminReload;

function adminClearFilters() {
    document.getElementById('admin-search-phone').value = '';
    document.getElementById('admin-search-origin').value = '';
    document.getElementById('admin-search-status').value = '';
    document.getElementById('admin-search-date-from').value = '';
    document.getElementById('admin-search-date-to').value = '';
    apiAdminReload();
}
window.adminClearFilters = adminClearFilters;

function toggleSelectAll(el) {
    document.querySelectorAll('.admin-select-cb').forEach(cb => cb.checked = el.checked);
    updateBulkBar();
}
window.toggleSelectAll = toggleSelectAll;

function getSelectedTripIds() {
    return Array.from(document.querySelectorAll('.admin-select-cb:checked')).map(cb => cb.value);
}
window.getSelectedTripIds = getSelectedTripIds;

function updateBulkBar() {
    const count = getSelectedTripIds().length;
    const bar = document.getElementById('bulk-actions-bar');
    if(bar) bar.style.display = count > 0 ? 'flex' : 'none';
}
window.updateBulkBar = updateBulkBar;

async function bulkAction(act) {
    const ids = getSelectedTripIds();
    if(ids.length === 0) return;
    if(!confirm(`تأكيد الإجراء الجماعي؟`)) return;

    if(act === 'delperm') await window.sb.from('trips').delete().in('id', ids);
    else if(act === 'done') await window.sb.from('trips').update({status: 'completed'}).in('id', ids);
    else if(act === 'active') await window.sb.from('trips').update({status: 'active'}).in('id', ids);

    apiAdminReload();
    apiGetTrips();
}
window.bulkAction = bulkAction;
