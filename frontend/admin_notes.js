// ==========================================
// 📝 每日便利貼的審核與檢舉
// 後端：GET /admin/daily-notes、PUT /admin/daily-notes/:id/status（1 通過、2 下架）
// 新便利貼先交給 AI 審核，AI 沒回應的留在待審核；便利貼每天 00:00 清空
// 用到 admin.js 的 API_BASE_URL、PAGE_SIZE、escapeHTML、renderPagination、closeAdminModal
// ==========================================
window._allDailyNotes = [];
window._filteredDailyNotes = [];
window._dailyNoteFilter = 'todo'; // todo / pending / reported / approved / rejected / all
window._dailyNotePage = 1;

const NOTE_STATUS = {
    0: { text: '⏳ 待審核', bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd' },
    1: { text: '✅ 已通過', bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' },
    2: { text: '❌ 已下架', bg: '#fee2e2', color: '#dc2626', border: '#fecaca' },
};

function dailyNoteToken() {
    return localStorage.getItem('authToken');
}

// 還沒處理的檢舉
function pendingNoteReports(n) {
    return (n.reports || []).filter(r => Number(r.status) === 0);
}

// 要管理員處理的：待審核，或有還沒處理的檢舉
function noteNeedsAction(n) {
    return Number(n.status) === 0 || (Number(n.status) === 1 && pendingNoteReports(n).length > 0);
}

window.loadDailyNotes = async function () {
    const tbody = document.getElementById('admin-daily-notes-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/daily-notes`, {
            headers: { 'Authorization': `Bearer ${dailyNoteToken()}`, 'ngrok-skip-browser-warning': 'true' },
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        window._allDailyNotes = data.data || [];
        updateDailyNoteBadge();
        filterDailyNotes();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入</td></tr>`;
    }
};

function updateDailyNoteBadge() {
    const badge = document.getElementById('note-pending-badge');
    if (!badge) return;
    const count = window._allDailyNotes.filter(noteNeedsAction).length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

window.filterDailyNoteBy = function (filter) {
    window._dailyNoteFilter = filter;
    ['todo', 'pending', 'reported', 'approved', 'rejected', 'all'].forEach(id => {
        const el = document.getElementById('filter-note-' + id);
        if (!el) return;
        const on = id === filter;
        el.style.background = on ? '#3b82f6' : '#f8fafc';
        el.style.color = on ? '#fff' : '#64748b';
        el.style.borderColor = on ? '#3b82f6' : '#e2e8f0';
    });
    filterDailyNotes();
};

window.filterDailyNotes = function () {
    const keyword = (document.getElementById('search-daily-notes')?.value || '').trim().toLowerCase();
    const matchFilter = {
        todo: noteNeedsAction,
        pending: n => Number(n.status) === 0,
        reported: n => (n.reports || []).length > 0,
        approved: n => Number(n.status) === 1,
        rejected: n => Number(n.status) === 2,
        all: () => true,
    }[window._dailyNoteFilter] || (() => true);

    window._filteredDailyNotes = window._allDailyNotes.filter(n => {
        if (!matchFilter(n)) return false;
        if (!keyword) return true;
        const haystack = [
            n.id, n.content, n.member?.name, n.member?.email, n.violation_reason,
            ...(n.reports || []).map(r => r.reason),
        ].join(' ').toLowerCase();
        return haystack.includes(keyword);
    });

    window._dailyNotePage = 1;
    applyDailyNotePagination();
};

window.changeDailyNotePage = function (page) {
    window._dailyNotePage = page;
    applyDailyNotePagination();
};

function applyDailyNotePagination() {
    const start = (window._dailyNotePage - 1) * PAGE_SIZE;
    renderDailyNotes(window._filteredDailyNotes.slice(start, start + PAGE_SIZE));
    renderPagination(window._filteredDailyNotes.length, window._dailyNotePage, 'daily-notes-pagination', 'changeDailyNotePage');
}

function noteStatusBadge(status) {
    const s = NOTE_STATUS[Number(status)] || NOTE_STATUS[0];
    return `<span class="badge" style="background:${s.bg}; color:${s.color}; border:1px solid ${s.border}; padding: 4px 10px;">${s.text}</span>`;
}

// inModal：在檢舉視窗裡就不用再放「看檢舉」
function noteActionButtons(n, inModal = false) {
    const id = Number(n.id);
    const status = Number(n.status);
    return [
        !inModal && (n.reports || []).length > 0
            ? `<button class="btn-action" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;" onclick="openDailyNoteReports(${id})">📜 看檢舉</button>`
            : '',
        status !== 1 ? `<button class="btn-action btn-primary" onclick="reviewDailyNote(${id}, 1)">✅ 通過</button>` : '',
        status === 1 && pendingNoteReports(n).length > 0
            ? `<button class="btn-action btn-secondary" onclick="reviewDailyNote(${id}, 1)">❎ 檢舉不成立</button>`
            : '',
        status !== 2 ? `<button class="btn-action btn-danger" onclick="reviewDailyNote(${id}, 2)">❌ 下架</button>` : '',
    ].join(' ');
}

function renderDailyNotes(list) {
    const tbody = document.getElementById('admin-daily-notes-body');
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">☕</span><p>目前這個分類沒有資料唷！</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(n => {
        const time = n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '未知';
        const reports = n.reports || [];
        const pendingCount = pendingNoteReports(n).length;
        const reportCell = reports.length === 0
            ? '<span style="color:#94a3b8;">—</span>'
            : `<span style="color:${pendingCount ? '#ef4444' : '#64748b'}; font-weight:700;">🚩 ${reports.length}</span>${pendingCount ? ` <span style="color:#ef4444; font-size:0.85rem;">（${pendingCount} 待處理）</span>` : ''}`;
        const author = n.member
            ? `${escapeHTML(n.member.name || '未命名')} <span style="color:#94a3b8;">(ID ${escapeHTML(n.member.member_id)})</span>`
            : `ID ${escapeHTML(n.member_id)}`;
        const reason = Number(n.status) === 2 && n.violation_reason
            ? `<div style="margin-top:6px; color:#dc2626; font-size:0.85rem;">原因：${escapeHTML(n.violation_reason)}</div>`
            : '';

        return `
        <tr style="background:${noteNeedsAction(n) ? '#fffafa' : '#f8fafc'};">
            <td data-label="發布時間" style="color:#64748b; white-space:nowrap;">${escapeHTML(time)}</td>
            <td data-label="作者" style="font-size:0.9rem;">${author}</td>
            <td data-label="內容" style="max-width:320px; white-space:pre-wrap; word-break:break-word; color:#1e293b; font-weight:600;">${escapeHTML(n.content)}${reason}</td>
            <td data-label="狀態">${noteStatusBadge(n.status)}</td>
            <td data-label="檢舉">${reportCell}</td>
            <td data-label="操作" style="white-space:nowrap;">${noteActionButtons(n)}</td>
        </tr>`;
    }).join('');
}

// 檢舉視窗：便利貼內容＋每一筆檢舉原因
window.openDailyNoteReports = function (id) {
    const n = window._allDailyNotes.find(x => Number(x.id) === Number(id));
    if (!n) return;
    const REPORT_STATUS = { 0: '⏳ 待處理', 1: '✅ 成立', 2: '❎ 不成立' };
    const rows = (n.reports || []).map(r => `
        <div style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; background:#fff;">
            <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.85rem; color:#64748b;">
                <span>${escapeHTML(r.reporter?.name || '未知')} (ID ${escapeHTML(r.member_id)})・${r.created_at ? escapeHTML(new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : ''}</span>
                <span>${REPORT_STATUS[Number(r.status)] || ''}</span>
            </div>
            <div style="margin-top:4px; color:#ef4444; font-weight:700; white-space:pre-wrap; word-break:break-word;">${escapeHTML(r.reason)}</div>
        </div>`).join('');

    document.getElementById('modal-title').innerHTML = `<div style="font-size:1.3rem; color:#1e293b; border-bottom:2px solid #e2e8f0; padding-bottom:12px;">🚩 便利貼 #${Number(n.id)} 的檢舉</div>`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin:15px 0; padding:16px; background:#fef9c3; border-radius:4px 14px 4px 14px; color:#1e3a8a; font-weight:800; white-space:pre-wrap; word-break:break-word;">${escapeHTML(n.content)}</div>
        <div style="margin-bottom:12px;">${noteStatusBadge(n.status)}</div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:320px; overflow-y:auto;">${rows}</div>`;
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">返回</button>
        <div style="margin-left:auto; display:flex; gap:10px; flex-wrap:wrap;">${noteActionButtons(n, true)}</div>`;
    document.getElementById('admin-modal').style.display = 'flex';
};

window.reviewDailyNote = async function (id, status) {
    let violationReason = '';
    if (status === 2) {
        const reason = await oceanPrompt(`要下架便利貼 #${id} 嗎？\n請寫下架原因（會通知作者）`, {
            title: '下架便利貼', icon: '❌', okText: '下架', danger: true, defaultValue: '內容不當',
        });
        if (reason == null) return;
        if (!reason.trim()) { alert('必須填寫原因！'); return; }
        violationReason = reason.trim();
    } else {
        const n = window._allDailyNotes.find(x => Number(x.id) === Number(id));
        const msg = n && Number(n.status) === 1
            ? `確定便利貼 #${id} 沒有問題嗎？\n待處理的檢舉會改成「不成立」。`
            : `確定通過便利貼 #${id} 嗎？`;
        if (!await oceanConfirm(msg)) return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/daily-notes/${id}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${dailyNoteToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, violation_reason: violationReason }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { alert(`更新失敗：${data.message || '請確認權限或網路狀態'}`); return; }

        // 跟後端同一套規則更新畫面：通過 → 待處理檢舉不成立；下架 → 成立
        const n = window._allDailyNotes.find(x => Number(x.id) === Number(id));
        if (n) {
            n.status = status;
            n.violation_reason = status === 2 ? violationReason : null;
            pendingNoteReports(n).forEach(r => { r.status = status === 2 ? 1 : 2; });
        }
        updateDailyNoteBadge();
        filterDailyNotes();
        const modal = document.getElementById('admin-modal');
        if (modal && modal.style.display !== 'none') {
            if (n && (n.reports || []).length > 0) openDailyNoteReports(id);
            else closeAdminModal();
        }
    } catch (e) {
        alert('伺服器連線失敗');
    }
};

// 一進後台就先抓一次，側邊欄的待處理數字才會出現
document.addEventListener('DOMContentLoaded', () => {
    // 上次停在這一頁的話，switchAdminTab 會自己載入，不用抓兩次
    if (dailyNoteToken() && localStorage.getItem('adminLastTab') !== 'daily-notes') loadDailyNotes();
});
