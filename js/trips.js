import { sb } from './supabase.js';
import { LOCS } from './routes.js';
import { promptJoinPhone, getJoinedTrips } from './auth.js';

export let tripsPublic = [];
export let tripsMine = [];
export let tripsAdmin = [];
export let openModalTripId = null;
export let openModalTripMode = null;

export const PUBLIC_TRIP_COLS = "id,user_role,origin,destination,departure_time,return_time,notes,seats_available,price_per_seat,has_ac,status,joined_passengers,created_at";
export const busyActions = new Set();

export function genToken() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    return 'tk' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getLocalTokens() {
    try { return JSON.parse(localStorage.getItem('sr_tokens') || '{}'); } catch (e) { return {}; }
}
export function getLocalToken(id) { return getLocalTokens()[id]; }
export function saveLocalToken(id, token) {
    const t = getLocalTokens(); t[id] = token; localStorage.setItem('sr_tokens', JSON.stringify(t));
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatPriceDisplay(price) {
    if (price === null || price === undefined) return 'حسب الاتفاق';
    const str = String(price).trim();
    if (!str || str === 'null' || str === 'undefined') return 'حسب الاتفاق';
    if (str.includes('ج.م')) return escapeHtml(str);
    return escapeHtml(str) + ' ج.م';
}

export async function apiGetTrips() {
    const list = document.getElementById('list-public');
    if (!list) return;
    list.innerHTML = '<p class="text-center py-20 text-gray-400 font-black italic">جاري البحث...</p>';
    const o = document.getElementById('f-o').value;
    const d = document.getElementById('f-d').value;
    const role = document.getElementById('f-user-identity').value;

    let q = sb.from('public_trips').select(PUBLIC_TRIP_COLS).eq('status', 'active').eq('user_role', role);
    if(o) q = q.eq('origin', o);
    if(d) q = q.eq('destination', d);
    const { data } = await q;
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
            list.innerHTML = `<div class="no-results-card"><div class="text-4xl mb-4">✨</div><h3 class="text-[#00a884] font-black mb-3 text-xl">${role==='captain'?'مفيش كباتن؟':'مفيش ركاب؟'}</h3><p class="text-gray-600 text-sm mb-6 font-bold leading-relaxed">سجل مشوارك دلوقتي في القائمة، والناس هتلاقي طلبك وتتواصل معاك.</p><button onclick="window.uiTab('post'); window.uiRole('${role}');" class="btn-green w-full text-lg shadow-xl pulse-loading italic">سجل مشوارك الآن ➕</button></div>`;
        }
    }
}

export async function apiGetMyTrips() {
    const list = document.getElementById('list-mine');
    if (!list) return;
    const tokens = Object.values(getLocalTokens());
    if (tokens.length === 0) {
        list.innerHTML = `<div class="no-results-card"><div class="text-4xl mb-4">📭</div><h3 class="text-[#00a884] font-black mb-3 text-xl">مفيش رحلات مربوطة بالجهاز ده</h3><button onclick="window.uiTab('post')" class="btn-green w-full text-lg shadow-xl italic mb-2">سجل مشوارك الآن ➕</button></div>`;
        return;
    }
    list.innerHTML = '<p class="text-center py-16 text-gray-400 font-black italic">جاري تحميل رحلاتك...</p>';
    const { data, error } = await sb.rpc('get_my_trips_by_tokens', { p_tokens: tokens });
    if (data) {
        const visibleData = data.filter(t => t.status !== 'archived');
        tripsMine = visibleData;
        list.innerHTML = visibleData.map(t => card(t, 'my')).join('');
    }
}

export async function apiPost(event) {
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

    const { data, error } = await sb.from('trips').insert([payload]).select('id').single();
    if(!error && data) {
        saveLocalToken(data.id, token);
        alert('تم تسجيل مشوارك بنجاح! 🎉');
        document.getElementById('postForm').reset(); window.uiTab('search');
    } else {
        alert('فشل النشر ❌: ' + error?.message);
    }
    btn.disabled = false; btn.innerText = "نشر الآن 🚀";
}

export async function saveEdit() {
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
    const { error } = await sb.rpc('update_trip_secure', { p_id: id, p_token: token, p_payload: payload });
    if (!error) {
        alert('تم التحديث بنجاح ✅');
        window.closeEdit();
        apiGetMyTrips();
        apiGetTrips();
    } else {
        alert('فشل التحديث ❌: ' + error.message);
    }
}

export function card(t, mode) {
    const isCap = t.user_role === 'captain';
    const priceFormatted = formatPriceDisplay(t.price_per_seat);
    return `
    <div class="trip-card">
        <div class="card-header">
            <div class="main-info">
                <h3 class="font-black text-[15px] text-slate-800 mb-1 truncate">${escapeHtml(t.origin)} ⬅️ ${escapeHtml(t.destination)}</h3>
            </div>
            <div class="side-info">
                <span class="role-badge ${isCap ? 'bg-blue-500' : 'bg-orange-500'}">${isCap?'كابتن':'راكب'}</span>
                ${isCap ? `<span class="price-text">${priceFormatted}</span>` : ''}
            </div>
        </div>
    </div>`;
}
