const SUPABASE_URL = "https://owzaevvsvwufozynzvin.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93emFldnZzdnd1Zm96eW56dmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDQ4NTgsImV4cCI6MjEwMTA4MDg1OH0.LRd_ekWBrk_BWDPv1PSmpSD9RygerdeeUCHUOQlwukQ";
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCS = ["أكتوبر", "الشيخ زايد", "القرية الذكية", "حدائق أكتوبر", "حدائق الأهرام", "الهرم", "فيصل", "الدقي", "المهندسين", "المنيل", "جاردن سيتي", "مصر القديمة", "وسط البلد ومحيطها", "المعادي", "زهراء المعادي", "المقطم", "حلوان", "البدرشين", "مدينة نصر", "مصر الجديدة", "المطرية", "عين شمس", "المرج", "المرج الجديدة", "جسر السويس", "النزهة", "التجمع الأول", "التجمع الثالث", "التجمع الخامس", "كايرو فيستيفال", "أكاديمية الشرطة", "الجامعة الأمريكية", "الشروق", "مدينة بدر", "العبور", "العاشر من رمضان", "العاصمة الإدارية"];

const app = {
    state: {
        filterRole: 'captain',
        postRole: 'captain'
    },

    async init() {
        this.populateDropdowns();
        await this.trackVisit();
        await this.fetchTrips();
        setTimeout(() => document.getElementById('loading-screen').classList.add('opacity-0'), 1000);
        setTimeout(() => document.getElementById('loading-overlay')?.remove(), 1500);
    },

    async trackVisit() {
        if (localStorage.getItem('is_admin')) return;
        const { data } = await _sb.from('site_stats').select('visit_count').eq('id', 1).single();
        if (data) await _sb.from('site_stats').update({ visit_count: data.visit_count + 1 }).eq('id', 1);
    },

    async fetchTrips() {
        const container = document.getElementById('trips-list');
        container.innerHTML = '<p class="text-center py-10 opacity-50 font-bold">جاري البحث...</p>';
        
        const origin = document.getElementById('search-origin').value;
        const dest = document.getElementById('search-dest').value;

        let query = _sb.from('trips').select('*').eq('status', 'active').eq('user_role', this.state.filterRole);
        
        if (origin) query = query.eq('origin', origin);
        if (dest) query = query.eq('destination', dest);

        const { data, error } = await query;
        if (data) this.renderTrips(data);
    },

    renderTrips(trips) {
        const container = document.getElementById('trips-list');
        if (trips.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-slate-400 font-bold">لا يوجد نتائج.. كن أول من يسجل مشواره!</div>`;
            return;
        }

        // ترتيب جغرافي
        trips.sort((a, b) => LOCS.indexOf(a.origin) - LOCS.indexOf(b.origin));

        let html = '';
        let lastRoute = "";
        trips.forEach(t => {
            const route = `${t.origin} ⬅️ ${t.destination}`;
            if (route !== lastRoute) {
                html += `<div class="route-header">📍 مسار: ${route}</div>`;
                lastRoute = route;
            }
            html += this.createCard(t);
        });
        container.innerHTML = html;
    },

    createCard(t) {
        const isCap = t.user_role === 'captain';
        const passengers = t.joined_passengers || [];
        const phone = t.whatsapp_number.replace(/^2/, '0');
        
        const btn = isCap 
            ? `<button onclick="app.joinTrip('${t.id}')" class="btn-green w-full shadow-md">🤝 انضم (متاح ${t.seats_available})</button>`
            : `<div class="flex gap-2">
                <button onclick="app.wa('${t.whatsapp_number}', 'offer', '${t.origin}')" class="btn-blue flex-1 text-xs font-black shadow-md">تقديم عرض 🚗</button>
                <button onclick="app.joinTrip('${t.id}')" class="btn-outline flex-1">انضم للمجموعة 🤝</button>
               </div>`;

        return `
            <div class="trip-card">
                <div class="card-header">
                    <div class="main-info">
                        <h3 class="font-black text-slate-800 mb-1">${t.origin} ⬅️ ${t.destination}</h3>
                        <div class="flex gap-4 text-[10px] text-slate-500 font-bold italic mb-2">
                            <span>🕒 ذهاب: ${t.departure_time}</span>
                            ${t.return_time ? `<span>🕒 عودة: ${t.return_time}</span>` : ''}
                        </div>
                        <div class="flex gap-2">
                            ${isCap ? `<span class="feature-badge">💺 مقاعد: ${passengers.length}/${t.seats_total}</span>` : `<span class="feature-badge bg-orange-50 text-orange-600">👥 منضمين: ${passengers.length + 1}</span>`}
                        </div>
                    </div>
                    <div class="side-info">
                        <span class="role-badge ${isCap?'bg-emerald-500':'bg-orange-500'} shadow-sm">${isCap?'كابتن':'راكب'}</span>
                        ${isCap ? `<span class="price-text block">${t.price_per_seat || 'اتفاق'}</span>` : ''}
                    </div>
                </div>
                ${t.notes ? `<p class="text-[10px] bg-slate-50 p-3 rounded-2xl italic border-r-4 border-emerald-500">" ${t.notes} "</p>` : ''}
                <div class="mt-2">${btn}</div>
            </div>`;
    },

    async joinTrip(id) {
        const p = prompt("أدخل رقم هاتفك (01...):");
        if (!p || !/^01[0125]\d{8}$/.test(p)) return alert("رقم غير صحيح");

        const { data: t } = await _sb.from('trips').select('*').eq('id', id).single();
        let pass = t.joined_passengers || [];
        if (pass.includes(p)) return alert("منضم بالفعل");

        const newSeats = t.seats_available - 1;
        const newStatus = (t.user_role === 'captain' && newSeats <= 0) ? 'completed' : 'active';

        const { error } = await _sb.from('trips').update({
            joined_passengers: [...pass, p],
            seats_available: newSeats,
            status: newStatus
        }).eq('id', id);

        if (!error) {
            alert("تم الانضمام! سنقوم بفتح واتساب الآن للتنسيق.");
            this.wa(t.whatsapp_number, t.user_role === 'captain' ? 'join-cap' : 'join-pas', t.origin);
            this.fetchTrips();
        }
    },

    wa(phone, type, origin) {
        let msg = "";
        if(type==='offer') msg = `سلام عليكم، أنا كابتن وشفت طلبك لرحلة ${origin} ومتاح أوصلك.`;
        if(type==='join-cap') msg = `سلام عليكم يا كابتن، أنا حجزت معاك في رحلة ${origin} عبر ShareRide، كلمني ننسق.`;
        if(type==='join-pas') msg = `سلام عليكم، أنا زميل راكب وانضميت لطلبك لرحلة ${origin} عبر ShareRide.`;
        
        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
        window.location.assign(url);
    },

    populateDropdowns() {
        const opts = `<option value="">كل المناطق</option>` + LOCS.map(l => `<option value="${l}">${l}</option>`).join('');
        ['search-origin', 'search-dest', 'in-origin', 'in-dest', 'edit-o', 'edit-d'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = opts;
        });

        const hours = `<option value="">--</option>` + Array.from({length:12}, (_,i)=>(i+1).toString().padStart(2,'0')).map(h=>`<option value="${h}">${h}</option>`).join('');
        ['h1', 'h2'].forEach(id => document.getElementById(id).innerHTML = hours);
        document.getElementById('m1').innerHTML = document.getElementById('m2').innerHTML = ['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join('');
    }
};

const ui = {
    switchTab(id) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('tab-' + id).classList.remove('hidden');
        document.getElementById('tab-' + id).classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'text-[#00A884]'));
        document.getElementById('nav-' + id).classList.add('active');
    },
    setFilterRole(role) {
        app.state.filterRole = role;
        document.getElementById('filter-cap').className = role === 'captain' ? "flex-1 py-3 rounded-xl font-black text-xs bg-white text-[#00A884] shadow-sm" : "flex-1 py-3 rounded-xl font-black text-xs text-slate-500";
        document.getElementById('filter-pas').className = role === 'passenger' ? "flex-1 py-3 rounded-xl font-black text-xs bg-white text-[#00A884] shadow-sm" : "flex-1 py-3 rounded-xl font-black text-xs text-slate-500";
        app.fetchTrips();
    }
};

app.init();
