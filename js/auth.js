import { sb } from './supabase.js';

export function getMyPhone() {
    try { return localStorage.getItem('sr_my_phone') || ''; } catch (e) { return ''; }
}

export function saveMyPhone(phone) {
    try { localStorage.setItem('sr_my_phone', phone); } catch (e) {}
}

export function promptJoinPhone() {
    const saved = getMyPhone();
    if (saved) return saved;
    const raw = prompt("أدخل رقم تليفونك (01xxxxxxxxx) — هيتحفظ على الجهاز ده وميتسألش عنه تاني إلا لو غيّرته بنفسك:");
    if (!raw) return null;
    const p = raw.trim().replace(/[\s\-]/g, '');
    if (!/^01[0125]\d{8}$/.test(p)) { alert("رقم غير صحيح، لازم يكون 11 رقم ويبدأ بـ 01 (مثال: 01012345678)"); return null; }
    saveMyPhone(p);
    return p;
}

export function changeMyPhone() {
    const current = getMyPhone();
    const raw = prompt(current ? `رقمك الحالي المحفوظ: ${current}\nاكتب رقمك الجديد (01xxxxxxxxx):` : "اكتب رقمك (01xxxxxxxxx):");
    if (!raw) return;
    const p = raw.trim().replace(/[\s\-]/g, '');
    if (!/^01[0125]\d{8}$/.test(p)) return alert("رقم غير صحيح، لازم يكون 11 رقم ويبدأ بـ 01 (مثال: 01012345678)");
    saveMyPhone(p);
    alert('تم تحديث رقمك المحفوظ ✅');
    renderMyPhoneCard();
    renderHomePhoneCard();
}

export function renderMyPhoneCard() {
    const el = document.getElementById('my-phone-card');
    if (!el) return;
    const phone = getMyPhone();
    el.innerHTML = phone
        ? `<div class="flex items-center justify-between gap-2 bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-4"><p class="text-[11px] font-black text-blue-700 text-right">📱 رقم تسجيلك المحفوظ: ${phone}</p><button onclick="window.changeMyPhone()" class="bg-blue-600 text-white text-[10px] font-black px-3 py-2 rounded-xl shrink-0">تغيير</button></div>`
        : `<div class="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4"><p class="text-[11px] font-black text-amber-700 text-right">📱 لسه مفيش رقم تسجيل محفوظ على الجهاز ده</p><button onclick="window.changeMyPhone()" class="bg-amber-600 text-white text-[10px] font-black px-3 py-2 rounded-xl shrink-0">إضافة رقمي</button></div>`;
}

export function renderHomePhoneCard() {
    const el = document.getElementById('home-phone-card');
    if (!el) return;
    const phone = getMyPhone();
    if (phone) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    el.style.display = '';
    el.innerHTML = `
        <h2 class="text-base font-black text-slate-800 mb-2 text-center">سجّل رقمك دلوقتي 📱</h2>
        <p class="text-[11px] text-slate-500 font-bold leading-relaxed mb-4 text-center">إجهَز لمشوارك الجاي؟ وضيف رقمك 👋</p>
        <div class="flex gap-2">
            <input type="tel" id="home-phone-input" placeholder="01xxxxxxxxx" class="form-input text-center font-black flex-1 min-w-0">
            <button onclick="window.saveHomePhone()" class="bg-[#00a884] text-white font-black rounded-2xl px-6 py-[15px] text-sm shadow-md shrink-0" style="width:auto;">حفظ</button>
        </div>`;
}

export async function saveHomePhone() {
    const input = document.getElementById('home-phone-input');
    const raw = input.value.trim().replace(/[\s\-]/g, '');
    if (!/^01[0125]\d{8}$/.test(raw)) return alert("رقم غير صحيح، لازم يكون 11 رقم ويبدأ بـ 01 (مثال: 01012345678)");
    saveMyPhone(raw);
    renderHomePhoneCard();
    try { await sb.from('leads').insert([{ phone: raw, source: 'home_banner' }]); } catch (e) { console.error(e); }
}

// OAuth وتسجيل خروج الكباتن والركاب
export async function loginWithOAuth(provider) {
    const { error } = await sb.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: window.location.origin + '/login.html' }
    });
    if (error) alert("فشل الدخول: " + error.message);
}

export async function setRole(selectedRole) {
    const { error } = await sb.auth.updateUser({ data: { role: selectedRole } });
    if (error) return alert("حدث خطأ: " + error.message);
    window.location.href = selectedRole === 'captain' ? 'index.html' : 'index.html';
}

export async function checkAdminSession() {
    const { data: { session } } = await sb.auth.getSession();
    const navAdmin = document.getElementById('nav-admin');
    if (session || location.hash === '#owner-access') navAdmin.style.display = '';
    if (session) {
        document.getElementById('admin-auth').style.display = 'none';
        document.getElementById('admin-panel').classList.remove('hidden');
        if (window.loadAdminStats) window.loadAdminStats();
        if (window.apiAdminReload) window.apiAdminReload();
    }
}

export async function apiAdminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value;
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) return alert('بيانات الدخول غير صحيحة ❌');
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-panel').classList.remove('hidden');
    if (window.loadAdminStats) window.loadAdminStats();
    if (window.apiAdminReload) window.apiAdminReload();
}

export async function adminLogout() {
    await sb.auth.signOut();
    location.hash = '';
    location.reload();
}
