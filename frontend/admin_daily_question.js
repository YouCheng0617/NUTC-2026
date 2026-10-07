// ==========================================
// 📅 首頁今日一題的排程
// 後端：GET /admin/daily-questions、PUT /admin/daily-questions/:date、DELETE /admin/daily-questions/:date
// 沒有排程的日子會自動用內建題庫；已經有人投票的那天不能改
// 用到 admin.js 的 API_BASE_URL、escapeHTML、jsArg
// ==========================================
(function () {
    const MAX_OPTIONS = 6;
    const SOURCE_BADGE = {
        scheduled: { text: '📌 已排程', bg: '#dbeafe', color: '#1d4ed8' },
        bank: { text: '📚 題庫', bg: '#f1f5f9', color: '#475569' },
        'bank-preview': { text: '📚 題庫（預定）', bg: '#f8fafc', color: '#94a3b8' },
        none: { text: '—', bg: '#f8fafc', color: '#cbd5e1' },
    };

    let schedule = null; // { today, days: [...] }
    const $ = (id) => document.getElementById(id);
    const token = () => localStorage.getItem('authToken');

    // ---------- 排程表單 ----------
    function optionRow(opt = { emoji: '', label: '' }) {
        const row = document.createElement('div');
        row.className = 'dq-admin-option';
        row.innerHTML = `
            <input type="text" class="dq-admin-emoji" maxlength="16" placeholder="😊" />
            <input type="text" class="dq-admin-label" maxlength="20" placeholder="選項文字（可留空）" />
            <button type="button" class="btn-action btn-secondary" title="刪除這個選項">✕</button>`;
        row.querySelector('.dq-admin-emoji').value = opt.emoji || '';
        row.querySelector('.dq-admin-label').value = opt.label || '';
        row.querySelector('button').addEventListener('click', () => {
            if ($('dq-admin-options').children.length <= 2) return alert('至少要 2 個選項');
            row.remove();
            updateAddBtn();
        });
        return row;
    }

    function updateAddBtn() {
        $('dq-admin-add').disabled = $('dq-admin-options').children.length >= MAX_OPTIONS;
    }

    function fillForm(date, question, options) {
        $('dq-admin-date').min = schedule ? schedule.today : '';
        $('dq-admin-date').value = date || '';
        $('dq-admin-question').value = question || '';
        const box = $('dq-admin-options');
        box.innerHTML = '';
        const list = options && options.length ? options : [{}, {}];
        list.forEach(o => box.appendChild(optionRow(o)));
        updateAddBtn();
    }

    window.dqAddOption = function () {
        if ($('dq-admin-options').children.length >= MAX_OPTIONS) return;
        $('dq-admin-options').appendChild(optionRow());
        updateAddBtn();
    };

    window.dqEditDay = function (date) {
        const day = schedule && schedule.days.find(d => d.date === date);
        if (!day) return;
        fillForm(date, day.question, day.options);
        $('dq-admin-form-title').textContent = `✏️ 排程 ${date}${day.source === 'scheduled' ? '（修改）' : '（從題庫的題目改起）'}`;
        $('dq-admin-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.dqResetForm = function () {
        fillForm('', '', null);
        $('dq-admin-form-title').textContent = '📅 排程某一天的題目';
    };

    window.dqSave = async function () {
        const date = $('dq-admin-date').value;
        const body = {
            question: $('dq-admin-question').value.trim(),
            options: [...$('dq-admin-options').children].map(row => ({
                emoji: row.querySelector('.dq-admin-emoji').value.trim(),
                label: row.querySelector('.dq-admin-label').value.trim(),
            })).filter(o => o.emoji || o.label),
        };
        if (!date) return alert('請選擇日期');
        if (!body.question) return alert('請輸入題目');
        if (body.options.length < 2) return alert('至少要 2 個選項');
        if (body.options.some(o => !o.emoji)) return alert('每個選項都要有 emoji');

        try {
            const res = await fetch(`${API_BASE_URL}/admin/daily-questions/${encodeURIComponent(date)}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`排程失敗：${data.message || '請確認權限或網路狀態'}`);
            alert(`✅ ${data.message}`);
            dqResetForm();
            loadDailyQuestions();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    window.dqUnschedule = async function (date) {
        if (!confirm(`確定取消 ${date} 的排程嗎？這天會改用題庫的題目。`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/daily-questions/${encodeURIComponent(date)}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token()}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`取消失敗：${data.message || ''}`);
            loadDailyQuestions();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    // ---------- 排程列表 ----------
    function resultHTML(day) {
        if (!day.results) return day.isPast || day.isToday ? '<span style="color:#94a3b8;">還沒有人投票</span>' : '';
        const max = Math.max(...day.results.counts);
        return `<div class="dq-admin-results">${day.options.map((o, i) => `
            <span class="dq-admin-result ${day.results.counts[i] === max && max > 0 ? 'is-top' : ''}">
                ${escapeHTML(o.emoji)} ${day.results.percents[i]}%
                <small>(${day.results.counts[i]})</small>
            </span>`).join('')}</div>
            <div style="color:#64748b; font-size:0.85rem; margin-top:4px;">共 ${day.totalVotes} 人投票</div>`;
    }

    function render() {
        const tbody = $('admin-daily-body');
        tbody.innerHTML = schedule.days.slice().reverse().map(day => {
            const badge = SOURCE_BADGE[day.source] || SOURCE_BADGE.none;
            const editable = !day.isPast && day.totalVotes === 0;
            const dateLabel = `${escapeHTML(day.date)}${day.isToday ? ' <span class="badge" style="background:#fce7f3; color:#be185d; padding:2px 8px;">今天</span>' : ''}`;
            const actions = editable
                ? [
                    `<button class="btn-action btn-primary" onclick="dqEditDay(${jsArg(day.date)})">✏️ ${day.source === 'scheduled' ? '修改' : '排程'}</button>`,
                    day.source === 'scheduled' ? `<button class="btn-action btn-secondary" onclick="dqUnschedule(${jsArg(day.date)})">↩️ 改回題庫</button>` : '',
                ].join(' ')
                : `<span style="color:#94a3b8; font-size:0.85rem;">${day.isPast ? '已結束' : '已有人投票，不能改'}</span>`;
            return `
            <tr style="${day.isToday ? 'background:#fdf2f8;' : day.isPast ? 'opacity:0.75;' : ''}">
                <td data-label="日期">${dateLabel}</td>
                <td data-label="來源"><span class="badge" style="background:${badge.bg}; color:${badge.color}; padding:4px 10px;">${badge.text}</span></td>
                <td data-label="題目">
                    <div style="font-weight:700;">${escapeHTML(day.question)}</div>
                    <div class="dq-admin-emojis">${day.options.map(o => `<span title="${escapeHTML(o.label)}">${escapeHTML(o.emoji)}</span>`).join('')}</div>
                </td>
                <td data-label="結果">${resultHTML(day)}</td>
                <td data-label="操作">${actions}</td>
            </tr>`;
        }).join('');
    }

    window.loadDailyQuestions = async function () {
        const tbody = $('admin-daily-body');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">讀取中...</td></tr>`;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/daily-questions`, { headers: { 'Authorization': `Bearer ${token()}`, 'ngrok-skip-browser-warning': 'true' } });
            if (!res.ok) throw new Error();
            schedule = (await res.json()).data;
            if (!$('dq-admin-options').children.length) dqResetForm();
            $('dq-admin-date').min = schedule.today;
            render();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">無法載入</td></tr>`;
        }
    };
})();
