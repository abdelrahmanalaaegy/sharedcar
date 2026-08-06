function syncHeaderHeight() {
    const header = document.querySelector('header');
    if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
}
window.addEventListener('resize', syncHeaderHeight);

let scrollStopTimer;
const scrollTopBtn = () => document.getElementById('scroll-top-btn');

window.addEventListener('scroll', () => {
    const btn = scrollTopBtn();
    if (btn) btn.classList.remove('show');
    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(() => {
        if (btn && window.scrollY > 250) btn.classList.add('show');
    }, 220);
}, { passive: true });

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const btn = scrollTopBtn();
    if (btn) btn.classList.remove('show');
}
window.scrollToTop = scrollToTop;

function uiTab(id) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('view-' + id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-[#00a884]'));
    document.getElementById('nav-' + id).classList.add('active');
    if(id === 'search') apiGetTrips();
    if(id === 'my') { apiGetMyTrips(); renderMyPhoneCard(); }
}
window.uiTab = uiTab;

function uiSearchSwitch(identity) {
    document.getElementById('f-user-identity').value = identity;
    document.getElementById('search-role-cap').className = identity === 'captain' ? "flex-1 py-3 rounded-lg font-black text-[12px] bg-white text-[#00a884] shadow-sm" : "flex-1 py-3 rounded-lg font-black text-[12px] text-gray-500";
    document.getElementById('search-role-pas').className = identity === 'passenger' ? "flex-1 py-3 rounded-lg font-black text-[12px] bg-white text-[#00a884] shadow-sm" : "flex-1 py-3 rounded-lg font-black text-[12px] text-gray-500";
    apiGetTrips();
}
window.uiSearchSwitch = uiSearchSwitch;

function uiRole(r) {
    document.getElementById('in-role').value = r;
    const isCap = r === 'captain';
    document.getElementById('cap-box').classList.toggle('hidden', !isCap);
    document.getElementById('role-cap').className = isCap ? "flex-1 py-3 rounded-xl font-black text-xs bg-white text-[#00a884] shadow-sm" : "flex-1 py-3 rounded-xl font-black text-xs text-gray-500";
    document.getElementById('role-pas').className = !isCap ? "flex-1 py-3 rounded-xl font-black text-xs bg-white text-[#00a884] shadow-sm" : "flex-1 py-3 rounded-xl font-black text-xs text-gray-500";
}
window.uiRole = uiRole;

const HOME_ROLE_CONTENT = {
    captain: {
        text: 'سجّل مشوارك مرة واحدة وخليه ظاهر لكل الركاب اللي بيدوروا على نفس الطريق. الموضوع بياخد دقيقة، ومجاني بالكامل 🙌',
        btnLabel: 'سجّل مشوارك الآن ➕',
        btnClass: 'btn-green',
        btnAction: "uiTab('post'); uiRole('captain')"
    },
    passenger: {
        text: 'ابحث عن كابتن بيعمل نفس مشوارك، أو سجّل طلبك وخلي ركاب تانيين عندهم نفس الطريق يلاقوك وينضموا ليك 🚗',
        btnLabel: '🔎 دور على كابتن',
        btnClass: 'w-full bg-orange-500 hover:bg-orange-600 text-white rounded-[22px] font-black py-4 shadow-lg transition',
        btnAction: "uiTab('search'); uiSearchSwitch('captain')",
        linkLabel: 'أو سجّل نفسك كراكب بدل البحث',
        linkAction: "uiTab('post'); uiRole('passenger')"
    }
};

function homeRoleSelect(role) {
    const capBtn = document.getElementById('home-role-cap');
    const pasBtn = document.getElementById('home-role-pas');
    capBtn.className = role === 'captain'
        ? "flex-1 py-3 rounded-xl font-black text-[12px] bg-white text-[#00a884] shadow-sm transition"
        : "flex-1 py-3 rounded-xl font-black text-[12px] text-slate-500 transition";
    pasBtn.className = role === 'passenger'
        ? "flex-1 py-3 rounded-xl font-black text-[12px] bg-white text-orange-600 shadow-sm transition"
        : "flex-1 py-3 rounded-xl font-black text-[12px] text-slate-500 transition";

    const c = HOME_ROLE_CONTENT[role];
    document.getElementById('home-role-desc').innerHTML = `
        <p class="text-[12px] text-slate-500 font-bold leading-relaxed mb-4 text-center">${c.text}</p>
        <button onclick="${c.btnAction}" class="${c.btnClass} text-sm">${c.btnLabel}</button>
        ${c.linkLabel ? `<button onclick="${c.linkAction}" class="w-full mt-2 text-[11px] font-black text-slate-400 underline">${c.linkLabel}</button>` : ''}
    `;
}
window.homeRoleSelect = homeRoleSelect;

window.onload = async function() {
    setTimeout(() => {
        const loader = document.getElementById('loading-overlay');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 400);
        }
    }, 1000);
    syncHeaderHeight();
    try {
        fillDropdowns();
        homeRoleSelect('captain');
        renderHomePhoneCard();
        await checkAdminSession();
        apiGetTrips();
        refreshNotifBadge();
        setInterval(refreshNotifBadge, 45000);
        if (location.hash.startsWith('#trip=')) {
            const sharedTripId = decodeURIComponent(location.hash.replace('#trip=', ''));
            if (sharedTripId) openSingleTripModal(sharedTripId);
            history.replaceState(null, '', location.pathname + location.search);
        }
    } catch (e) { console.error(e); }
};
