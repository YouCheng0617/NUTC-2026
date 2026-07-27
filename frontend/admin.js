// ==========================================
// 1. 設定基礎參數與共用工具
// ==========================================
const API_BASE_URL = "https://api.drift-bottles.xyz";
const PAGE_SIZE = 10; // 🌟 每一頁顯示的資料筆數

function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// 🌟 共用分頁渲染產生器
function renderPagination(totalItems, currentPage, containerId, changePageFuncName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    
    container.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${changePageFuncName}(${currentPage - 1})">⬅️ 上一頁</button>
        <span class="pagination-info">第 ${currentPage} / ${totalPages} 頁 (共 ${totalItems} 筆)</span>
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${changePageFuncName}(${currentPage + 1})">下一頁 ➡️</button>
    `;
}

// ==========================================
// 2. 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("authToken");
    const userStr = localStorage.getItem("currentUser");
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || !user) {
        window.location.href = "login.html";
        return;
    }

    const nameEl = document.getElementById("admin-name");
    if (nameEl) nameEl.innerText = user.name + " (管理員)";

    const lastTab = localStorage.getItem('adminLastTab') || 'dashboard';
    switchAdminTab(lastTab);
});

// ==========================================
// 3. 頁面切換與記憶功能
// ==========================================
window.switchAdminTab = function (tabName) {
    localStorage.setItem('adminLastTab', tabName);

    document.querySelectorAll('.admin-menu li').forEach(item => item.classList.remove('active'));
    const activeMenu = Array.from(document.querySelectorAll('.admin-menu li')).find(item => item.getAttribute('onclick')?.includes(tabName));
    if (activeMenu) activeMenu.classList.add('active');

    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('section-' + tabName).style.display = 'block';

    const titleEl = document.getElementById("admin-page-title");
    if (tabName === 'dashboard') {
        titleEl.innerText = "總覽數據";
        loadDashboardData();
    }
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; loadReports(); }
}

// ==========================================
// 4. 總覽數據與圖表
// ==========================================
let myDoughnutChart = null;

async function loadDashboardData() {
    const token = localStorage.getItem("authToken");
    try {
        const [usersRes, bottlesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/members`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }),
            fetch(`${API_BASE_URL}/admin/bottles`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } })
        ]);

        const usersData = await usersRes.json();
        const bottlesData = await bottlesRes.json();

        const users = usersData.data || usersData || [];
        const bottles = bottlesData.data || bottlesData.bottles || bottlesData || [];

        document.getElementById('stat-users').innerText = users.length;
        document.getElementById('stat-bottles').innerText = bottles.length;

        let angry = 0, secret = 0, broken = 0, apathy = 0, happy = 0;
        bottles.forEach(b => {
            let rawCat = b.category_name || null;
            if (!rawCat && b.categories && b.categories.length > 0) {
                rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
            }
            if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
            if (!rawCat) rawCat = '綜合閒聊';

            if (rawCat.includes("開心") || rawCat.includes("喜悅") || rawCat.includes("快樂")) happy++;
            else if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) angry++;
            else if (rawCat.includes("秘密") || rawCat.includes("程式")) secret++;
            else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) broken++;
            else apathy++;
        });

        drawDoughnutChart([angry, secret, broken, apathy, happy]);
    } catch (error) {
        console.error("載入總覽數據失敗", error);
    }
}

function drawDoughnutChart(dataArray) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (myDoughnutChart) myDoughnutChart.destroy();

    myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['😡 憤怒', '🤫 秘密', '💔 破碎', '😑 厭世', '😁 開心'],
            datasets: [{
                data: dataArray,
                backgroundColor: ['#fff1f0', '#f9f0ff', '#fff7e6', '#f6ffed', '#e6f7ff'],
                borderColor: ['#ffa39e', '#d3adf7', '#ffd591', '#b7eb8f', '#91d5ff'],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { font: { size: 14 } } } }
        }
    });
}

// ==========================================
// 5. 管理使用者
// ==========================================
window._allUsers = [];
window._filteredUsersCache = [];
window._currentUserStatusFilter = 'all';
window._currentUserPage = 1;

async function loadUsers() {
    const tbody = document.getElementById('admin-users-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/members`, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) throw new Error();

        const result = await response.json();
        window._allUsers = result.data || result || [];
        filterUsers();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認是否有管理員權限</td></tr>`;
    }
}

window.filterUserByStatus = function (status) {
    window._currentUserStatusFilter = status;
    const statusMap = { 'all': 'all', 'ACTIVE': 'active', 'INACTIVE': 'inactive', 'BANNED': 'banned' };
    const btns = ['all', 'active', 'inactive', 'banned'];

    btns.forEach(id => {
        const el = document.getElementById('filter-user-' + id);
        if (!el) return;
        if (id === statusMap[status]) {
            el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6';
        } else {
            el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0';
        }
    });
    filterUsers();
}

window.filterUsers = function () {
    const keyword = document.getElementById('search-users').value.toLowerCase();
    window._filteredUsersCache = window._allUsers.filter(u => {
        const matchKeyword = String(u.member_id || '').includes(keyword) || String(u.name || '').toLowerCase().includes(keyword) || String(u.email || '').toLowerCase().includes(keyword);
        let matchStatus = true;
        if (window._currentUserStatusFilter !== 'all') {
            const currentStatus = u.status || 'ACTIVE';
            matchStatus = (currentStatus === window._currentUserStatusFilter);
        }
        return matchKeyword && matchStatus;
    });

    window._currentUserPage = 1; 
    applyUserPagination();
}

window.changeUserPage = function (newPage) {
    window._currentUserPage = newPage;
    applyUserPagination();
}

function applyUserPagination() {
    const startIndex = (window._currentUserPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredUsersCache.slice(startIndex, endIndex);
    
    renderUsers(pagedData);
    renderPagination(window._filteredUsersCache.length, window._currentUserPage, 'users-pagination', 'changeUserPage');
}

function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合條件的使用者</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        let currentStatus = u.status || 'ACTIVE';
        let statusBadge = currentStatus === 'BANNED' ? `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">🔴 ${currentStatus}</span>` :
                          currentStatus === 'INACTIVE' ? `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">🟡 ${currentStatus}</span>` :
                          `<span class="badge" style="background:#e6f7ff; color:#0066cc; border:1px solid #91d5ff;">🟢 ${currentStatus}</span>`;

        return `
        <tr>
            <td data-label="會員 ID">${escapeHTML(String(u.member_id || u.id || '未知'))}</td>
            <td data-label="姓名暱稱">${escapeHTML(u.name || '未命名')}</td>
            <td data-label="登入 Email">${escapeHTML(u.email || '無')}</td>
            <td data-label="註冊時間">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="帳號狀態">${statusBadge}</td>
            <td data-label="項目操作">
                <button class="btn-action btn-secondary" onclick="changeUserStatus('${u.member_id || u.id}', '${escapeHTML(u.name || '未命名')}')">更改狀態</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteUserAsAdmin('${u.member_id || u.id}', '${escapeHTML(u.name || '未命名')}')">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

let currentEditingUserId = null;
window.changeUserStatus = function (userId, userName) {
    currentEditingUserId = userId;
    document.getElementById('status-modal-user-name').innerText = `正在修改帳號：${userName}`;
    document.getElementById('status-modal').style.display = 'flex';
}
window.closeStatusModal = function () { document.getElementById('status-modal').style.display = 'none'; currentEditingUserId = null; }
window.confirmChangeStatus = async function (newStatus) {
    if (!currentEditingUserId) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${currentEditingUserId}/status`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ newStatus: newStatus })
        });
        if (response.ok) { alert('✅ 狀態已成功更新！'); closeStatusModal(); loadUsers(); } else { alert('更新失敗，請確認權限或網路狀態'); }
    } catch (e) { alert('伺服器連線失敗'); }
}
window.deleteUserAsAdmin = async function (userId, userName) {
    if (!confirm(`⚠️ 確定要強制刪除使用者「${userName} (ID: ${userId})」嗎？\n刪除後將無法復原，請三思！`)) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${userId}/delete`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) { alert(`🗑️ 成功將使用者「${userName}」從資料庫抹除！`); loadUsers(); } else { const err = await response.json(); alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤")); }
    } catch (error) { alert("伺服器連線失敗，請檢查網路狀態！"); }
};

// ==========================================
// 6. 漂流瓶文章審核
// ==========================================
window._allBottles = [];
window._filteredBottlesCache = [];
window._currentStatusFilter = 'all';
window._currentCategoryFilter = 'all'; 
window._currentBottlePage = 1;

function getBottleCategoryType(b) {
    let rawCat = b.category_name || null;
    if (!rawCat && b.categories && b.categories.length > 0) rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
    if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
    if (!rawCat) rawCat = '綜合閒聊';

    if (rawCat.includes("開心") || rawCat.includes("快樂") || rawCat.includes("喜悅")) return 'happy';
    if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) return 'angry';
    if (rawCat.includes("秘密") || rawCat.includes("程式")) return 'secret';
    if (rawCat.includes("破碎") || rawCat.includes("碎片")) return 'broken';
    return 'apathy'; 
}

async function loadBottles() {
    const tbody = document.getElementById('admin-bottles-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles`, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) throw new Error();

        const data = await response.json();
        window._allBottles = (data.data || data.bottles || data || []).reverse(); 
        filterBottles();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限或後端是否啟動</td></tr>`;
    }
}

window.filterByStatus = function (status) {
    window._currentStatusFilter = status;
    const btns = ['all', 'pending', 'passed', 'rejected'];
    btns.forEach(id => {
        const el = document.getElementById('filter-btn-' + id);
        if (!el) return;
        if (id === status) { el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6'; } 
        else { el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0'; }
    });
    filterBottles();
}

window.filterByCategory = function (category) {
    window._currentCategoryFilter = category;
    filterBottles();
}

window.filterBottles = function () {
    const keyword = document.getElementById('search-bottles').value.toLowerCase();
    
    window._filteredBottlesCache = window._allBottles.filter(b => {
        const matchKeyword = String(b.bottle_id || '').includes(keyword) || String(b.title || '').toLowerCase().includes(keyword) || String(b.member_name || b.author?.name || '').toLowerCase().includes(keyword);
        
        let matchStatus = true;
        const currentStatus = Number(b.status);
        if (window._currentStatusFilter === 'pending') matchStatus = (currentStatus !== 1 && currentStatus !== 2);
        else if (window._currentStatusFilter === 'passed') matchStatus = (currentStatus === 1);
        else if (window._currentStatusFilter === 'rejected') matchStatus = (currentStatus === 2);
        
        let matchCategory = true;
        if (window._currentCategoryFilter !== 'all') {
            const catType = getBottleCategoryType(b);
            matchCategory = (catType === window._currentCategoryFilter);
        }

        return matchKeyword && matchStatus && matchCategory;
    });

    window._currentBottlePage = 1;
    applyBottlePagination();
}

window.changeBottlePage = function (newPage) {
    window._currentBottlePage = newPage;
    applyBottlePagination();
}

function applyBottlePagination() {
    const startIndex = (window._currentBottlePage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredBottlesCache.slice(startIndex, endIndex);
    
    renderBottles(pagedData);
    renderPagination(window._filteredBottlesCache.length, window._currentBottlePage, 'bottles-pagination', 'changeBottlePage');
}

function renderBottles(bottles) {
    const tbody = document.getElementById('admin-bottles-body');
    if (!tbody) return;
    if (bottles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合條件的文章唷 🏖️</td></tr>`;
        return;
    }

    tbody.innerHTML = bottles.map(b => {
        let rawCat = b.category_name || null;
        if (!rawCat && b.categories && b.categories.length > 0) rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
        if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
        if (!rawCat) rawCat = '綜合閒聊';

        let catHtml = rawCat.includes("開心") || rawCat.includes("快樂") ? `<span class="badge" style="background:#e6f7ff; color:#0050b3; border:1px solid #91d5ff;">😁 開心的事</span>` :
                      rawCat.includes("憤怒") || rawCat.includes("閒聊") ? `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">😡 極度憤怒中</span>` :
                      rawCat.includes("秘密") || rawCat.includes("程式") ? `<span class="badge" style="background:#f9f0ff; color:#531dab; border:1px solid #d3adf7;">🤫 沒人懂的秘密</span>` :
                      rawCat.includes("破碎") || rawCat.includes("碎片") ? `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">💔 破碎的碎片</span>` :
                      `<span class="badge" style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f;">😑 極度厭世/躺平</span>`;

        const currentStatus = Number(b.status);
        let statusBadge = currentStatus === 1 ? `<span class="badge" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0;">✅ 已通過</span>` :
                          currentStatus === 2 ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca;">❌ 已下架 / 拒絕</span>` :
                          `<span class="badge" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;">⏳ 待審核</span>`;
        let rowStyle = currentStatus === 1 || currentStatus === 2 ? `opacity: 0.8; background: #f8fafc;` : `opacity: 1; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);`;

        // 🌟 這裡已幫您還原回最直覺的並排按鈕！
        return `
        <tr style="${rowStyle} transition: 0.3s;">
            <td data-label="文章 ID" style="color: #64748b; font-weight: 600;">#${escapeHTML(String(b.bottle_id || b.id))}</td>
            <td data-label="發文者">${escapeHTML(String(b.member_name || b.author_name || '匿名'))}</td>
            <td data-label="標題"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-weight: 600; color: #1e293b; font-size: 1.05rem;">${escapeHTML(String(b.title))}</span>${statusBadge}</div></td>
            <td data-label="看板分類">${catHtml}</td>
            <td data-label="發布時間" style="color: #64748b;">${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="項目操作">
                <button class="btn-action btn-primary" onclick="openBottleModalFromCache('${b.bottle_id || b.id}')">${currentStatus !== 0 ? '查看' : '審核'}</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteBottleAsAdmin('${b.bottle_id || b.id}')">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

window.openBottleModalFromCache = function (bottleId) {
    const b = window._allBottles.find(item => String(item.bottle_id || item.id) === String(bottleId));
    if (!b) return;
    document.getElementById('modal-title').innerHTML = `<div style="display: flex; align-items: center; gap: 10px; font-size: 1.4rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 0;"><span style="font-size: 1.6rem;">📝</span> ${escapeHTML(b.title)}</div>`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin: 15px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">👤 作者：${escapeHTML(b.member_name || b.author_name || '匿名')}</span>
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">📅 ${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</span>
        </div>
        <div style="background: #ffffff; border-left: 5px solid #3b82f6; padding: 24px; border-radius: 0 12px 12px 0; font-size: 1.05rem; color: #334155; white-space: pre-wrap; line-height: 1.8; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-top: 20px;">${escapeHTML(b.content)}</div>`;
    window._reviewBottleId = b.bottle_id || b.id; window._reviewBottleTitle = b.title;
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">返回</button>
        <div style="margin-left: auto; display: flex; gap: 12px;">
            <button class="btn-action btn-danger" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">❌ 拒絕 (違規)</button>
            <button class="btn-action btn-primary" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">✅ 審核通過</button>
        </div>`;
    document.getElementById('admin-modal').style.display = 'flex';
}
window.reviewBottle = function (bottleId, status, title) { window._pendingReviewId = bottleId; window._pendingReviewTitle = title; if (status === 2) { document.getElementById('reject-reason-input').value = '內容不當'; document.getElementById('reject-modal').style.display = 'flex'; } else { if (!confirm(`✅ 確定要通過「${title}」嗎？`)) return; executeReviewAction(bottleId, 1, ""); } }
window.closeRejectModal = function () { document.getElementById('reject-modal').style.display = 'none'; }
window.confirmRejectAction = function () { const reason = document.getElementById('reject-reason-input').value.trim(); if (!reason) { alert("必須填寫原因！"); return; } executeReviewAction(window._pendingReviewId, 2, reason); closeRejectModal(); }
window.executeReviewAction = async function (bottleId, status, reason) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ "bottle_id": Number(bottleId), "status": status, "violation_reason": reason }) });
        if (response.ok) { alert(`🎉 審核完成！`); closeAdminModal(); loadBottles(); } else { const err = await response.json(); alert(`審核失敗: ${err.message}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}
window.deleteBottleAsAdmin = async function (bottleId) {
    if (!confirm(`⚠️ 確定刪除 #${bottleId} 嗎？無法復原！`)) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${bottleId}/delete`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) { alert("🗑️ 成功刪除！"); window._allBottles = window._allBottles.filter(b => String(b.bottle_id || b.id) !== String(bottleId)); filterBottles(); } else { const err = await response.json(); alert("刪除失敗：" + err.message); }
    } catch (error) { alert("伺服器連線失敗！"); }
};
window.closeAdminModal = function () { const modal = document.getElementById('admin-modal'); if (modal) modal.style.display = 'none'; window._reviewBottleId = null; window._reviewBottleTitle = null; }
window.adminLogout = function () { if (confirm("確定要登出嗎？")) { localStorage.removeItem("authToken"); localStorage.removeItem("currentUser"); localStorage.removeItem("adminLastTab"); window.location.href = "login.html"; } }

// ==========================================
// 7. 檢舉處理 
// ==========================================
window._allReports = [];
window._filteredReportsCache = [];
window._currentReportStatusFilter = 'pending';
window._currentReportPage = 1;

window.updateDashboardReportCount = function () {
    if (!window._allReports) return;
    const pendingCount = window._allReports.filter(r => Number(r.bottle?.status || r.status || 0) !== 2).length;
    const statReports = document.getElementById('stat-reports');
    if (statReports) statReports.innerText = pendingCount;
}

async function loadReports() {
    const tbody = document.getElementById('admin-reports-body');
    const token = localStorage.getItem("authToken");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles/reported`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (!response.ok) throw new Error();
        const data = await response.json();
        // 將最新檢舉排前面
        window._allReports = (data.data || data || []).reverse();
        updateDashboardReportCount();
        filterReports();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入</td></tr>`;
    }
}

window.filterReportByStatus = function (status) {
    window._currentReportStatusFilter = status;
    const btns = ['all', 'pending', 'processed'];
    btns.forEach(id => {
        const el = document.getElementById('filter-report-' + id);
        if (!el) return;
        if (id === status) { el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6'; } 
        else { el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0'; }
    });
    filterReports();
}

window.filterReports = function () {
    const keyword = document.getElementById('search-reports')?.value.toLowerCase() || '';
    window._filteredReportsCache = window._allReports.filter(r => {
        const bottleId = String(r.bottle_id || r.id || '');
        const reason = String(r.reason || r.report_reason || r.content || '').toLowerCase();
        const matchKeyword = bottleId.includes(keyword) || reason.includes(keyword);
        const isProcessed = (Number(r.bottle?.status || r.status || 0) === 2);
        let matchStatus = true;
        if (window._currentReportStatusFilter === 'pending') matchStatus = !isProcessed;
        else if (window._currentReportStatusFilter === 'processed') matchStatus = isProcessed;
        return matchKeyword && matchStatus;
    });

    window._currentReportPage = 1;
    applyReportPagination();
}

window.changeReportPage = function (newPage) {
    window._currentReportPage = newPage;
    applyReportPagination();
}

function applyReportPagination() {
    const startIndex = (window._currentReportPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredReportsCache.slice(startIndex, endIndex);
    
    renderReports(pagedData);
    renderPagination(window._filteredReportsCache.length, window._currentReportPage, 'reports-pagination', 'changeReportPage');
}

function renderReports(reports) {
    const tbody = document.getElementById('admin-reports-body');
    if (!tbody) return;
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">☕</span><p>目前這個分類沒有資料唷！</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = reports.map(r => {
        const bottleId = r.bottle_id || r.id || '未知';
        const reason = r.reason || r.report_reason || '未提供原因';
        const reporter = r.reporter_id || r.member_id || r.reporter_name || '匿名';
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '未知';
        const bottleContent = r.bottle_content || r.bottle?.content || r.content || '（無法取得文章內容）';
        const isProcessed = (Number(r.bottle?.status || r.status || 0) === 2);

        let actionHtml = isProcessed ? `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding: 6px 12px;">✅ 已下架</span>`
                                     : `<button class="btn-action btn-danger" onclick="banReportedBottle('${bottleId}');">🚫 強制下架 (留存紀錄)</button>`;
        const rowBg = isProcessed ? '#f8fafc' : '#fffafa';
        const rowOpacity = isProcessed ? '0.7' : '1';

        return `
        <tr style="background: ${rowBg}; opacity: ${rowOpacity}; transition: 0.3s;">
            <td data-label="文章 ID" style="color: #64748b; font-weight: 600;">#${bottleId}</td>
            <td data-label="被檢舉內容" style="min-width: 220px; max-width: 350px;"><div style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; color: #334155; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(String(bottleContent))}</div></td>
            <td data-label="檢舉原因" style="color: #ef4444; font-weight: bold; white-space: normal; min-width: 150px;">${escapeHTML(String(reason))}</td>
            <td data-label="檢舉者 ID">${escapeHTML(String(reporter))}</td>
            <td data-label="檢舉時間" style="color: #64748b;">${date}</td>
            <td data-label="操作">${actionHtml}</td>
        </tr>
        `;
    }).join('');
}

window.banReportedBottle = async function (bottleId) {
    if (!confirm(`⚠️ 確定要將 #${bottleId} 號文章「強制下架」嗎？\n(保留在資料庫)`)) return;
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ "bottle_id": Number(bottleId), "status": 2, "violation_reason": "遭檢舉違規，管理員強制下架" }) });
        if (response.ok) {
            alert("✅ 文章已成功下架！");
            if (window._allReports) window._allReports.forEach(r => { if (String(r.bottle_id || r.id) === String(bottleId)) { if (r.bottle) r.bottle.status = 2; r.status = 2; } });
            filterReports(); loadBottles(); updateDashboardReportCount();
        } else { const err = await response.json(); alert(`下架失敗: ${err.message}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}