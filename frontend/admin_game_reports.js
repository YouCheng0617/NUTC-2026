// ==========================================
// 🎮 寵物遊戲連線房間的玩家檢舉
// 後端：GET /admin/game-reports、PUT /admin/game-reports/:id/status
// 停權沿用「管理使用者」的狀態視窗（changeUserStatus）
// 用到 admin.js 的 API_BASE_URL、PAGE_SIZE、escapeHTML、jsArg、renderPagination、closeAdminModal
// ==========================================
window._allGameReports = [];
window._filteredGameReports = [];
window._gameReportFilter = 'pending'; // pending / upheld / rejected / all
window._gameReportPage = 1;

const GAME_REPORT_STATUS = {
    0: { text: '⏳ 待處理', bg: '#fef9c3', color: '#a16207', border: '#fde047' },
    1: { text: '✅ 檢舉成立', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
    2: { text: '❎ 不成立', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
};
const GAME_REPORT_FILTER_STATUS = { pending: 0, upheld: 1, rejected: 2 };

function gameReportToken() {
    return localStorage.getItem('authToken');
}

window.loadGameReports = async function () {
    const tbody = document.getElementById('admin-game-reports-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">讀取中...</td></tr>`;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/game-reports`, {
            headers: { 'Authorization': `Bearer ${gameReportToken()}`, 'ngrok-skip-browser-warning': 'true' },
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        window._allGameReports = data.data || [];
        updateGameReportBadge();
        filterGameReports();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">無法載入</td></tr>`;
    }
};

function updateGameReportBadge() {
    const badge = document.getElementById('game-report-pending-badge');
    if (!badge) return;
    const pending = window._allGameReports.filter(r => Number(r.status) === 0).length;
    badge.textContent = pending;
    badge.style.display = pending > 0 ? 'inline-block' : 'none';
}

window.filterGameReportByStatus = function (filter) {
    window._gameReportFilter = filter;
    ['pending', 'upheld', 'rejected', 'all'].forEach(id => {
        const el = document.getElementById('filter-game-report-' + id);
        if (!el) return;
        const on = id === filter;
        el.style.background = on ? '#3b82f6' : '#f8fafc';
        el.style.color = on ? '#fff' : '#64748b';
        el.style.borderColor = on ? '#3b82f6' : '#e2e8f0';
    });
    filterGameReports();
};

window.filterGameReports = function () {
    const keyword = (document.getElementById('search-game-reports')?.value || '').trim().toLowerCase();
    const wanted = GAME_REPORT_FILTER_STATUS[window._gameReportFilter];

    window._filteredGameReports = window._allGameReports.filter(r => {
        if (wanted !== undefined && Number(r.status) !== wanted) return false;
        if (!keyword) return true;
        const haystack = [
            r.reported_pet_name, r.reported?.name, r.reported?.email, r.reported_id,
            r.reporter?.name, r.reporter_id, r.reasonText, r.detail,
        ].join(' ').toLowerCase();
        return haystack.includes(keyword);
    });

    window._gameReportPage = 1;
    applyGameReportPagination();
};

window.changeGameReportPage = function (page) {
    window._gameReportPage = page;
    applyGameReportPagination();
};

function applyGameReportPagination() {
    const start = (window._gameReportPage - 1) * PAGE_SIZE;
    renderGameReports(window._filteredGameReports.slice(start, start + PAGE_SIZE));
    renderPagination(window._filteredGameReports.length, window._gameReportPage, 'game-reports-pagination', 'changeGameReportPage');
}

function gameReportStatusBadge(status) {
    const s = GAME_REPORT_STATUS[Number(status)] || GAME_REPORT_STATUS[0];
    return `<span class="badge" style="background:${s.bg}; color:${s.color}; border:1px solid ${s.border}; padding: 4px 10px;">${s.text}</span>`;
}

function memberLabel(member, fallbackId) {
    if (!member) return `ID ${escapeHTML(fallbackId)}`;
    return `${escapeHTML(member.name || '未命名')} <span style="color:#94a3b8;">(ID ${escapeHTML(member.member_id)})</span>`;
}

function renderGameReports(list) {
    const tbody = document.getElementById('admin-game-reports-body');
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">☕</span><p>目前這個分類沒有資料唷！</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleString() : '未知';
        const banned = r.reported?.status === 'BANNED';
        const pending = Number(r.status) === 0;
        const actions = [
            `<button class="btn-action" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;" onclick="openGameReportDetail(${Number(r.id)})">📜 看證據</button>`,
            pending ? `<button class="btn-action btn-danger" onclick="reviewGameReport(${Number(r.id)}, 1)">成立</button>` : '',
            pending ? `<button class="btn-action btn-secondary" onclick="reviewGameReport(${Number(r.id)}, 2)">不成立</button>` : '',
        ].join(' ');

        return `
        <tr style="background:${pending ? '#fffafa' : '#f8fafc'};">
            <td data-label="檢舉時間" style="color:#64748b; white-space:nowrap;">${escapeHTML(date)}</td>
            <td data-label="被檢舉玩家">
                <div style="font-weight:700; color:#0f172a;">🐌 ${escapeHTML(r.reported_pet_name)}</div>
                <div style="font-size:0.85rem;">${memberLabel(r.reported, r.reported_id)}${banned ? ' <span class="badge" style="background:#fee2e2; color:#b91c1c; padding:2px 8px;">已停權</span>' : ''}</div>
            </td>
            <td data-label="檢舉原因" style="color:#ef4444; font-weight:bold;">${escapeHTML(r.reasonText || r.reason)}</td>
            <td data-label="補充說明" style="max-width:240px; white-space:normal; color:#334155;">${r.detail ? escapeHTML(r.detail) : '<span style="color:#94a3b8;">（無）</span>'}</td>
            <td data-label="檢舉人" style="font-size:0.9rem;">${memberLabel(r.reporter, r.reporter_id)}</td>
            <td data-label="狀態">${gameReportStatusBadge(r.status)}</td>
            <td data-label="操作" style="white-space:nowrap;">${actions}</td>
        </tr>`;
    }).join('');
}

// 證據視窗：房間聊天紀錄，被檢舉人說的話標紅
window.openGameReportDetail = function (id) {
    const r = window._allGameReports.find(x => Number(x.id) === Number(id));
    if (!r) return;
    const evidence = Array.isArray(r.evidence) ? r.evidence : [];
    const lines = evidence.length
        ? evidence.map(e => {
            const time = e.at ? new Date(e.at).toLocaleTimeString() : '';
            const style = e.isReported
                ? 'background:#fee2e2; border-left:4px solid #ef4444;'
                : 'background:#f8fafc; border-left:4px solid #e2e8f0;';
            return `<div style="${style} padding:6px 10px; border-radius:6px; margin-bottom:6px;">
                <span style="color:#94a3b8; font-size:0.8rem;">${escapeHTML(time)}</span>
                <b style="color:${e.isReported ? '#b91c1c' : '#334155'};">${escapeHTML(e.petName)}</b>：${escapeHTML(e.message)}
            </div>`;
        }).join('')
        : '<p style="color:#94a3b8;">檢舉當時房間裡沒有聊天紀錄。</p>';

    document.getElementById('modal-title').textContent = `🎮 遊戲檢舉 #${r.id}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="line-height:1.8; margin-bottom:12px;">
            <div><b>被檢舉玩家：</b>🐌 ${escapeHTML(r.reported_pet_name)}（${memberLabel(r.reported, r.reported_id)}）</div>
            <div><b>檢舉原因：</b><span style="color:#ef4444; font-weight:bold;">${escapeHTML(r.reasonText || r.reason)}</span></div>
            <div><b>補充說明：</b>${r.detail ? escapeHTML(r.detail) : '（無）'}</div>
            <div><b>檢舉人：</b>${memberLabel(r.reporter, r.reporter_id)}</div>
            <div><b>房間：</b>${escapeHTML(r.room_id)}　<b>狀態：</b>${gameReportStatusBadge(r.status)}</div>
        </div>
        <div style="font-weight:700; margin-bottom:6px;">💬 檢舉當下的房間聊天（紅色是被檢舉人說的）</div>
        <div style="max-height:320px; overflow-y:auto;">${lines}</div>`;

    const pending = Number(r.status) === 0;
    const name = r.reported?.name || r.reported_pet_name;
    document.getElementById('modal-actions').innerHTML = [
        pending ? `<button class="btn-action btn-danger" onclick="reviewGameReport(${Number(r.id)}, 1)">✅ 檢舉成立</button>` : '',
        pending ? `<button class="btn-action btn-secondary" onclick="reviewGameReport(${Number(r.id)}, 2)">❎ 不成立</button>` : '',
        `<button class="btn-action" style="background:#fff7ed; color:#c2410c; border:1px solid #fdba74;" onclick="closeAdminModal(); changeUserStatus(${Number(r.reported_id)}, ${jsArg(name)})">🚫 調整被檢舉人帳號狀態</button>`,
    ].join(' ');
    document.getElementById('admin-modal').style.display = 'flex';
};

window.reviewGameReport = async function (id, status) {
    const label = status === 1 ? '成立' : '不成立';
    if (!confirm(`確定將檢舉 #${id} 判定為「${label}」嗎？${status === 1 ? '\n（如要停權，判定後可在證據視窗按「調整被檢舉人帳號狀態」）' : ''}`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/admin/game-reports/${id}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${gameReportToken()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { alert(`更新失敗：${data.message || '請確認權限或網路狀態'}`); return; }
        const r = window._allGameReports.find(x => Number(x.id) === Number(id));
        if (r) r.status = status;
        updateGameReportBadge();
        filterGameReports();
        const modal = document.getElementById('admin-modal');
        if (modal && modal.style.display !== 'none') openGameReportDetail(id);
    } catch (e) {
        alert('伺服器連線失敗');
    }
};

// 一進後台就先抓一次，側邊欄的待處理數字才會出現
document.addEventListener('DOMContentLoaded', () => {
    // 上次停在這一頁的話，switchAdminTab 會自己載入，不用抓兩次
    if (gameReportToken() && localStorage.getItem('adminLastTab') !== 'game-reports') loadGameReports();
});
