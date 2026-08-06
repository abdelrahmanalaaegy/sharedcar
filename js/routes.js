const LOCS = ["أكتوبر", "الشيخ زايد", "القرية الذكية", "حدائق أكتوبر", "حدائق الأهرام", "الهرم", "فيصل", "أرض اللواء", "ميدان لبنان", "المهندسين", "الدقي", "الكيت كات", "إمبابة", "المعادي", "زهراء المعادي", "المقطم", "المنيل", "جاردن سيتي", "مصر القديمة", "وسط البلد ومحيطها", "حلوان", "البدرشين", "شبرا مصر", "الساحل", "شبرا الخيمة", "مدينة نصر", "مصر الجديدة", "المطرية", "عين شمس", "المرج", "المرج الجديدة", "جسر السويس", "النزهة", "التجمع الأول", "التجمع الثالث", "التجمع الخامس", "كايرو فيستيفال", "أكاديمية الشرطة", "الجامعة الأمريكية", "الشروق", "مدينة بدر", "العبور", "العاشر من رمضان", "العاصمة الإدارية"];
window.LOCS = LOCS;

function fillDropdowns() {
    const dropdowns = ['in-o', 'in-d', 'f-o', 'f-d', 'edit-o', 'edit-d', 'admin-search-origin'];
    dropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = `<option value="">${id.includes('f-') || id.includes('admin') ? 'كل المناطق' : 'اختر منطقة'}</option>`;
            LOCS.forEach(l => { el.innerHTML += `<option value="${l}">${l}</option>`; });
        }
    });

    const hDropdowns = ['in-h1', 'in-h2', 'edit-h1', 'edit-h2'];
    const mDropdowns = ['in-m1', 'in-m2', 'edit-m1', 'edit-m2'];
    const hPlaceholders = { 'in-h1': 'بدون ذهاب', 'in-h2': 'بدون عودة', 'edit-h1': 'بدون ذهاب', 'edit-h2': 'بدون عودة' };
    const hoursHtml = Array.from({length:12}, (_,i)=>(i+1).toString().padStart(2,'0')).map(h=>`<option value="${h}">${h}</option>`).join('');
    const mHtml = ['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join('');
    hDropdowns.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = `<option value="">${hPlaceholders[id]}</option>` + hoursHtml; });
    mDropdowns.forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = mHtml; });
}
window.fillDropdowns = fillDropdowns;
