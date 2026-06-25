/**
 * calendar.js — Calendar Module
 * Renders a monthly calendar with refill event indicators.
 */

const Calendar = (() => {
    let currentYear  = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    let refillData   = [];
    let warningData  = [];
    let selectedDay  = null;
    let unsubscribe  = null;

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // ── Render Calendar ────────────────────────────────────────────────────
    function render() {
        const wrapper = document.getElementById('calendar-wrapper');
        if (!wrapper) return;

        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrev  = new Date(currentYear, currentMonth, 0).getDate();
        const today = new Date();

        // Build event map: date string → {approved, pending, rejected, warning}
        const events = {};
        refillData.forEach(r => {
            if (!events[r.date]) events[r.date] = {};
            events[r.date][r.status] = (events[r.date][r.status] || 0) + 1;
        });
        warningData.forEach(w => {
            const d = w.timestamp?.toDate ? w.timestamp.toDate() : new Date(w.timestamp || Date.now());
            const key = d.toISOString().split('T')[0];
            if (!events[key]) events[key] = {};
            events[key].warning = (events[key].warning || 0) + 1;
        });

        let html = `
        <div class="calendar-wrapper">
            <div class="calendar-header">
                <button class="btn btn-ghost btn-icon" id="cal-prev">‹</button>
                <h3>${MONTHS[currentMonth]} ${currentYear}</h3>
                <button class="btn btn-ghost btn-icon" id="cal-next">›</button>
            </div>
            <div class="calendar-grid">
                ${DAYS.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        `;

        // Previous month's overflow days
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
        }

        // Current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const ev = events[dateStr] || {};
            const isToday = today.getFullYear()===currentYear && today.getMonth()===currentMonth && today.getDate()===day;
            const isSel   = selectedDay === dateStr;

            let dots = '';
            if (ev.approved) dots += `<div class="cal-dot approved"></div>`;
            if (ev.pending)  dots += `<div class="cal-dot pending"></div>`;
            if (ev.rejected) dots += `<div class="cal-dot rejected"></div>`;
            if (ev.warning)  dots += `<div class="cal-dot warning" style="background:var(--orange)"></div>`;

            html += `<div class="cal-day ${isToday?'today':''} ${isSel?'selected':''}" 
                          data-date="${dateStr}" onclick="Calendar.selectDay('${dateStr}')">
                        ${day}
                        ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
                    </div>`;
        }

        // Next month's overflow to fill the grid
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
        for (let i = 1; i <= totalCells - firstDay - daysInMonth; i++) {
            html += `<div class="cal-day other-month">${i}</div>`;
        }

        html += '</div></div>';
        wrapper.innerHTML = html;

        document.getElementById('cal-prev')?.addEventListener('click', prevMonth);
        document.getElementById('cal-next')?.addEventListener('click', nextMonth);
    }

    // ── Day Selection / Detail Panel ───────────────────────────────────────
    function selectDay(dateStr) {
        selectedDay = dateStr;
        render(); // re-render to highlight selection

        const panel = document.getElementById('day-detail');
        if (!panel) return;

        const dayRefills  = refillData.filter(r => r.date === dateStr);
        const dayWarnings = warningData.filter(w => {
            const d = w.timestamp?.toDate ? w.timestamp.toDate() : new Date(w.timestamp || 0);
            return d.toISOString().split('T')[0] === dateStr;
        });

        const [y, m, d] = dateStr.split('-');
        const label = new Date(+y, +m-1, +d).toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' });

        if (dayRefills.length === 0 && dayWarnings.length === 0) {
            panel.innerHTML = `
                <div class="empty-state" style="padding:32px 0">
                    <div class="empty-icon">📅</div>
                    <h3>No activity on ${label}</h3>
                    <p>No refills or warnings were recorded.</p>
                </div>`;
            return;
        }

        let html = `<h4 style="margin-bottom:14px;color:var(--text-secondary)">${label}</h4>`;

        dayWarnings.forEach(w => {
            html += `<div class="feed-item" style="margin-bottom:10px;border-left:3px solid var(--orange)">
                <span style="font-size:1.3rem">⚠️</span>
                <div class="feed-body">
                    <div class="feed-header">
                        <span class="feed-name">${w.userName}</span>
                        <span class="feed-time">${App.timeAgo(w.timestamp)}</span>
                    </div>
                    <div class="feed-note">${w.message}</div>
                </div>
            </div>`;
        });

        dayRefills.forEach(r => {
            html += App.buildFeedItem(r, Auth.isApproverUser());
        });

        panel.innerHTML = html;
    }

    // ── Navigation ─────────────────────────────────────────────────────────
    function prevMonth() {
        if (currentMonth === 0) { currentMonth = 11; currentYear--; }
        else { currentMonth--; }
        render();
        loadMonthData();
    }

    function nextMonth() {
        if (currentMonth === 11) { currentMonth = 0; currentYear++; }
        else { currentMonth++; }
        render();
        loadMonthData();
    }

    // ── Load Data for Month ────────────────────────────────────────────────
    function loadMonthData() {
        const start = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`;
        const end   = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`;

        if (unsubscribe) unsubscribe();

        // Listen for refills in this month range
        const unsub1 = db.collection(CONFIG.COLLECTIONS.REFILLS)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .onSnapshot(snap => {
                refillData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                render();
            });

        // Load warnings for current month
        const startTs = new Date(currentYear, currentMonth, 1);
        const endTs   = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
        const unsub2  = db.collection(CONFIG.COLLECTIONS.WARNINGS)
            .where('timestamp', '>=', startTs)
            .where('timestamp', '<=', endTs)
            .onSnapshot(snap => {
                warningData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                render();
            });

        unsubscribe = () => { unsub1(); unsub2(); };
    }

    // ── Init ───────────────────────────────────────────────────────────────
    function init() {
        loadMonthData();
        render();
    }

    return { init, render, selectDay, prevMonth, nextMonth };
})();
