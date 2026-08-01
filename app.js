const SUPABASE_URL = "https://owzaevvsvwufozynzvin.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93emFldnZzdnd1Zm96eW56dmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDQ4NTgsImV4cCI6MjEwMTA4MDg1OH0.LRd_ekWBrk_BWDPv1PSmpSD9RygerdeeUCHUOQlwukQ";
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const LOCS = ["أكتوبر", "الشيخ زايد", "القرية الذكية", "حدائق أكتوبر", "حدائق الأهرام", "الهرم", "فيصل", "أرض اللواء", "ميدان لبنان", "المهندسين", "الدقي", "الكيت كات", "إمبابة", "المعادي", "زهراء المعادي", "المقطم", "المنيل", "جاردن سيتي", "مصر القديمة", "وسط البلد ومحيطها", "حلوان", "البدرشين", "شبرا مصر", "الساحل", "شبرا الخيمة", "مدينة نصر", "مصر الجديدة", "المطرية", "عين شمس", "المرج", "المرج الجديدة", "جسر السويس", "النزهة", "التجمع الأول", "التجمع الثالث", "التجمع الخامس", "كايرو فيستيفال", "أكاديمية الشرطة", "الجامعة الأمريكية", "الشروق", "مدينة بدر", "العبور", "العاشر من رمضان", "العاصمة الإدارية"];

const app = {
    state: { searchRole: 'captain', formRole: 'captain', allTrips: [] },

    async init() {
        this.fillSelects();
        await this.trackVisit();
        await this.fetchTrips();
        setTimeout(() => document.getElementById('loading-screen').classList.add('opacity-0'), 1500);
        setTimeout(() => document.getElementById('loading-screen').remove(), 2000);
    },

    // --- WhatsApp Engine (PRO VERSION) ---
    openWhatsApp(phone, message) {
        const cleanPhone = phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
        const encodedMsg = encodeURIComponent(message);
        
        // Protocol 1: Universal Web Link (Best for Chrome/Safari)
        const webUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedMsg}`;
        
        // Protocol 2: Deep Link (Best for Native Apps)
        const deepLink = `whatsapp://send?phone=${finalPhone}&text=${encodedMsg}`;

        // Detection Logic
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Try deep link first, if fails browser handles webUrl
            window.location.assign(deepLink);
            setTimeout(() => {
                window.location.assign(webUrl);
            }, 500);
        } else {
            window.open(webUrl, '_blank');
        }
    },

    async fetchTrips() {
        const list = document.getElementById('list-public');
        list.innerHTML = '<div class="py-20 text-center animate-pulse text-slate-400">جاري مطابقة المسارات...</div>';
        
        const { data } = await _sb.from('trips').select('*').eq('status', 'active').eq('user_role', this.state.searchRole);
        
        if (data) {
            data.sort((a, b) => LOCS.indexOf(a.origin) - LOCS.indexOf(b.origin));
            this.state.allTrips = data;
            
            let html = '', lastRoute = "";
            data.forEach(t => {
                const route = `${t.origin} ⬅️ ${t.destination}`;
                if (route !== lastRoute) {
                    html += `<div class="route-header">📍 مسار: ${route}</div>`;
                    lastRoute = route;
                }
                html += this.renderCard(t, 'public');
            });
            list.innerHTML = html || '<p class="py-20 text-center text-slate-400">لا توجد رحلات حالياً</p>';
        }
    },

    renderCard(t, mode) {
        const isCap = t.user_role === 'captain';
        const passengers = t.joined_passengers || [];
        const isFull = isCap && passengers.length >= t.seats_total;
        
        let buttons = '';
        if (mode === 'public') {
            if (isCap) {
                buttons = isFull ? `<button class="w-full py-4 bg-slate-200 text-slate-500 rounded-2xl font-black cursor-not-allowed">🚫 الرحلة اكتملت</button>` :
                `<div class="flex gap-2">
                    <button onclick="app.waAction('inquiry', '${t.id}')" class="btn-outline flex-1">استفسار 💬</button>
                    <button onclick="app.joinAction('${t.id}')" class="btn-green flex-1 shadow-md italic font-black text-xs text-white">🤝 حجز مقعد</button>
                </div>`;
            } else {
                buttons = `<div class="flex gap-2">
                    <button onclick="app.waAction('offer', '${t.id}')" class="btn-blue flex-1 text-xs font-black shadow-md italic">تقديم عرض توصيل 🚗</button>
                    <button onclick="app.joinAction('${t.id}')" class="btn-outline flex-1">انضم للمجموعة 🤝</button>
                </div>`;
            }
        } else {
            buttons = `<div class="grid grid-cols-3 gap-2 mt-2">
                <button onclick="ui.openEdit('${t.id}')" class="bg-amber-500 text-white p-2 rounded-xl text-[10px] font-bold">📝 تعديل</button>
                <button onclick="app.completeTrip('${t.id}')" class="bg-slate-800 text-white p-2 rounded-xl text-[10px] font-bold">✅ اكتمل</button>
                <button onclick="app.deleteTrip('${t.id}')" class="bg-red-500 text-white p-2 rounded-xl text-[10px] font-bold">❌ حذف</button>
            </div>`;
        }

        return `
            <div class="trip-card">
                <div class="card-header">
                    <div class="main-info text-right">
                        <h3 class="font-black text-slate-800 mb-1">${t.origin} ⬅️ ${t.destination}</h3>
                        <div class="flex gap-4 text-[10px] text-slate-500 font-bold italic mb-2">
                            ${t.departure_time ? `<span>🕒 ذهاب: ${t.departure_time}</span>` : ''}
                            ${t.return_time ? `<span>🕒 عودة: ${t.return_time}</span>` : ''}
                        </div>
                        <div class="flex gap-2 mb-2">
                            ${isCap ? `<span class="feature-badge">💺 ${t.seats_total - passengers.length}/${t.seats_total} متاح</span>` : `<span class="feature-badge bg-orange-50 text-orange-600">👥 منضمين: ${passengers.length + 1}</span>`}
                        </div>
                    </div>
                    <div class="side-info">
                        <span class="role-badge ${isCap?'bg-emerald-500':'bg-orange-500'}">${isCap?'كابتن':'راكب'}</span>
                        ${isCap ? `<span class="price-text block">${t.price_per_seat || 'اتفاق'}</span>` : ''}
                    </div>
                </div>
                ${t.notes ? `<p class="text-[10px] bg-slate-50 p-3 rounded-2xl italic border-r-4 border-emerald-500">" ${t.notes} "</p>` : ''}
                <div class="mt-1">${buttons}</div>
            </div>`;
    },

    waAction(type, id) {
        const t = this.state.allTrips.find(x => x.id === id);
        let msg = "";
        if(type==='inquiry') msg = `سلام عليكم يا كابتن، شفت رحلتك من ${t.origin} إلى ${t.destination} وعاوز أستفسر عن حاجة.`;
        if(type==='offer') msg = `سلام عليكم، أنا كابتن ومعايا عربية وشفت طلبك لرحلة ${t.origin} ومتاح أوصلك.`;
        this.openWhatsApp(t.whatsapp_number, msg);
    },

    async joinAction(id) {
        const p = prompt("أدخل رقم هاتفك للتأكيد (01...):");
        if (!p || !/^01[0125]\d{8}$/.test(p)) return alert("رقم غير صحيح");

        const t = this.state.allTrips.find(x => x.id === id);
        let joined = t.joined_passengers || [];
        if (joined.includes(p)) return alert("أنت منضم بالفعل");

        const newSeats = t.seats_available - 1;
        const { error } = await _sb.from('trips').update({
            joined_passengers: [...joined, p],
            seats_available: newSeats,
            status: (t.user_role === 'captain' && newSeats <= 0) ? 'completed' : 'active'
        }).eq('id', id);

        if (!error) {
            const msg = t.user_role === 'captain' ? 
                `سلام عليكم يا كابتن، أنا حجزت معاك في رحلة ${t.origin} عبر ShareRide، ياريت تأكد ميعاد التحرك.` :
                `سلام عليكم، أنا زميل راكب وانضميت لطلباتك في مشوار ${t.origin} عبر ShareRide، يلا ننسق.`;
            this.openWhatsApp(t.whatsapp_number, msg);
            this.fetchTrips();
        }
    },

    async handlePost(e) {
        e.preventDefault();
        const mgmtCode = "SR-" + Math.floor(100000 + Math.random() * 900000);
        const payload = {
            origin: document.getElementById('in-o').value,
            destination: document.getElementById('in-d').value,
            departure_time: document.getElementById('h1').value ? `${document.getElementById('h1').value}:${document.getElementById('m1').value} ${document.getElementById('p1').value}` : null,
            return_time: document.getElementById('h2').value ? `${document.getElementById('h2').value}:${document.getElementById('m2').value} ${document.getElementById('p2').value}` : null,
            whatsapp_number: document.getElementById('in-phone').value.replace(/^0/, '20'),
            seats_total: parseInt(document.getElementById('in-seats').value) || 1,
            seats_available: parseInt(document.getElementById('in-seats').value) || 1,
            price_per_seat: document.getElementById('in-price').value ? document.getElementById('in-price').value + " ج.م" : "",
            user_role: this.state.formRole,
            notes: document.getElementById('in-notes').value,
            mgmt_code: mgmtCode,
            status: 'active'
        };

        const { error } = await _sb.from('trips').insert([payload]);
        if (!error) {
            ui.showMgmtModal(mgmtCode);
            e.target.reset();
        }
    },

    fillSelects() {
        const opts = `<option value="">اختر المنطقة</option>` + LOCS.map(l => `<option value="${l}">${l}</option>`).join('');
        ['in-o', 'in-d', 'f-o', 'f-d', 'search-origin', 'search-dest'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = opts;
        });

        const hrs = `<option value="">--</option>` + Array.from({length:12}, (_,i)=>(i+1).toString().padStart(2,'0')).map(h=>`<option value="${h}">${h}</option>`).join('');
        ['h1', 'h2'].forEach(id => document.getElementById(id).innerHTML = hrs);
        ['m1', 'm2'].forEach(id => document.getElementById(id).innerHTML = ['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join(''));
        document.getElementById('in-seats').innerHTML = [1,2,3,4].map(s=>`<option value="${s}">${s} مقاعد</option>`).join('');
    }
};

const ui = {
    switchTab(id) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('tab-' + id).classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-' + id).classList.add('active');
    },
    setSearchRole(role) {
        app.state.searchRole = role;
        document.getElementById('search-role-cap').className = role === 'captain' ? "flex-1 py-3 rounded-lg font-black text-[12px] bg-white text-[#00A884] shadow-sm" : "flex-1 py-3 rounded-lg font-black text-[12px] text-gray-500";
        document.getElementById('search-role-pas').className = role === 'passenger' ? "flex-1 py-3 rounded-lg font-black text-[12px] bg-white text-[#00A884] shadow-sm" : "flex-1 py-3 rounded-lg font-black text-[12px] text-gray-500";
        app.fetchTrips();
    },
    showMgmtModal(code) {
        document.getElementById('mgmt-code-display').innerText = code;
        document.getElementById('mgmt-modal').classList.remove('hidden');
    },
    closeMgmtModal() {
        document.getElementById('mgmt-modal').classList.add('hidden');
        this.switchTab('search');
    }
};

app.init();
