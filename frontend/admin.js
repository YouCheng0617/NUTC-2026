// ==========================================
// 1. 設定基礎參數
// ==========================================
const API_BASE_URL = "https://163.17.135.120";

// ==========================================
// 2. 頁面初始化 (正式安全版)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("authToken");
    const userStr = localStorage.getItem("currentUser");
    const user = userStr ? JSON.parse(userStr) : null;

    // 嚴格檢查：只要沒有 Token 或 User 資訊，強制踢回登入頁
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
    if (tabName === 'dashboard') { titleEl.innerText = "總覽數據"; }
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; }
}

// ==========================================
// 4. API 串接：管理使用者 (支援搜尋)
// ==========================================
window._allUsers = [];

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
        renderUsers(window._allUsers);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認是否有管理員權限</td></tr>`;
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合的資料</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(user => {
        let badgeClass = 'badge-active';
        if (user.status === 'BANNED') badgeClass = 'badge-banned';
        if (user.status === 'INACTIVE') badgeClass = 'badge-inactive';
        return `
        <tr>
            <td>#${escapeHTML(String(user.member_id || user.id))}</td>
            <td>${escapeHTML(String(user.name || user.email.split('@')[0]))}</td>
            <td>${escapeHTML(String(user.email))}</td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '未知'}</td>
            <td><span class="badge ${badgeClass}">${escapeHTML(String(user.status || 'ACTIVE'))}</span></td>
            <td><button class="btn-action btn-warning" onclick="changeUserStatus(${escapeHTML(String(user.member_id || user.id))})">更改狀態</button></td>
        </tr>
        `}).join('');
}

window.filterUsers = function () {
    const keyword = document.getElementById('search-users').value.toLowerCase();
    const filtered = window._allUsers.filter(u =>
        String(u.member_id || '').includes(keyword) ||
        String(u.name || '').toLowerCase().includes(keyword) ||
        String(u.email || '').toLowerCase().includes(keyword)
    );
    renderUsers(filtered);
}

// API 串接：更改狀態
window.changeUserStatus = async function (userId) {
    const newStatus = prompt("請輸入新狀態 (限填: ACTIVE, INACTIVE, BANNED):", "BANNED");
    if (!newStatus) return;

    const upperStatus = newStatus.toUpperCase();
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${userId}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ newStatus: upperStatus })
        });
        if (response.ok) {
            alert('✅ 狀態已更新！');
            loadUsers();
        } else {
            alert('更新失敗，請確認權限');
        }
    } catch (e) { alert('連線失敗'); }
}

// ==========================================
// 5. API 串接：漂流瓶審核 (支援搜尋)
// ==========================================
function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

window._allBottles = [];

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
        window._allBottles = data.data || data.bottles || data || [];
        renderBottles(window._allBottles);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限或後端是否啟動</td></tr>`;
    }
}

function renderBottles(bottles) {
    const tbody = document.getElementById('admin-bottles-body');
    if (bottles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合的資料</td></tr>`;
        return;
    }

    tbody.innerHTML = bottles.map(b => {
        let rawCat = b.category_name || null;
        if (!rawCat && b.categories && b.categories.length > 0) {
            if (typeof b.categories[0] === 'string') rawCat = b.categories[0];
            else if (b.categories[0].category?.name) rawCat = b.categories[0].category.name;
        }
        if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
        if (!rawCat) rawCat = '綜合閒聊';

        let catHtml = '';
        if (rawCat.includes("程式")) catHtml = `<span class="badge" style="background:#e6f7ff; color:#0066cc; border:1px solid #91d5ff;">💻 程式開發</span>`;
        else if (rawCat.includes("美食")) catHtml = `<span class="badge" style="background:#fff0f6; color:#eb2f96; border:1px solid #ffadd2;">🍜 美食特搜</span>`;
        else if (rawCat.includes("遊戲")) catHtml = `<span class="badge" style="background:#f9f0ff; color:#722ed1; border:1px solid #d3adf7;">🎮 遊戲專區</span>`;
        else catHtml = `<span class="badge" style="background:#fff2e8; color:#fa541c; border:1px solid #ffbb96;">🔥 綜合閒聊</span>`;

        return `
        <tr>
            <td>#${escapeHTML(String(b.bottle_id || b.id))}</td>
            <td>${escapeHTML(String(b.member_name || b.author_name || b.author?.name || b.author || '匿名'))}</td>
            <td>${escapeHTML(String(b.title))}</td>
            <td>${catHtml}</td>
            <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</td>
            <td>
                <button class="btn-action btn-primary" onclick="openBottleModalFromCache('${b.bottle_id || b.id}')">查看/審核</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteBottleAsAdmin('${b.bottle_id || b.id}')">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

window.filterBottles = function () {
    const keyword = document.getElementById('search-bottles').value.toLowerCase();
    const filtered = window._allBottles.filter(b =>
        String(b.bottle_id || '').includes(keyword) ||
        String(b.title || '').toLowerCase().includes(keyword) ||
        String(b.content || '').toLowerCase().includes(keyword) ||
        String(b.member_name || b.author?.name || '').toLowerCase().includes(keyword)
    );
    renderBottles(filtered);
}

// ==========================================
// 6. API 串接：審核動作 (PUT /admin/bottles/review)
// ==========================================
window.openBottleModalFromCache = function (bottleId) {
    const b = window._allBottles.find(item => String(item.bottle_id || item.id) === String(bottleId));
    if (!b) return;

    document.getElementById('modal-title').innerText = `審核：${b.title}`;
    document.getElementById('modal-body').innerHTML = `<p style="white-space:pre-wrap; line-height:1.6;">${escapeHTML(b.content)}</p>`;

    window._reviewBottleId = b.bottle_id || b.id;
    window._reviewBottleTitle = b.title;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">取消</button>
        <button class="btn-action btn-danger" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">拒絕 (2)</button>
        <button class="btn-action btn-primary" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">通過 (1)</button>
    `;
    document.getElementById('admin-modal').style.display = 'flex';
}

window.reviewBottle = async function (bottleId, status, title) {
    let violation_reason = "";

    if (status === 2) {
        violation_reason = prompt(`請輸入拒絕「${title}」的原因 (必填):`, "內容不當");
        if (!violation_reason) { alert("必須填寫拒絕原因！"); return; }
    } else {
        if (!confirm(`⚠️ 確定要通過「${title}」嗎？`)) return;
    }

    try {
        const token = localStorage.getItem("authToken");

        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "bottle_id": Number(bottleId),
                "status": status,
                "violation_reason": violation_reason
            })
        });

        if (response.ok) {
            alert(`✅ 審核完成！`);
            closeAdminModal();
            loadBottles();
        } else {
            const err = await response.json();
            alert(`審核失敗: ${err.message}`);
        }
    } catch (e) { alert("伺服器連線失敗"); }
}

// ==========================================
// 7. UI 輔助控制
// ==========================================
window.closeAdminModal = function () { document.getElementById('admin-modal').style.display = 'none'; }
window.adminLogout = function () { localStorage.clear(); window.location.href = "login.html"; }
// 🗑️ 管理員強制刪除漂流瓶
window.deleteBottleAsAdmin = async function(bottleId) {
    if (!confirm(`⚠️ 確定要以管理員身分強制刪除 #${bottleId} 號漂流瓶嗎？刪除後將無法復原！`)) {
        return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
        alert("請先登入！");
        window.location.href = "login.html";
        return;
    }

    try {
        // 呼叫後端 admin.router.ts 設定好的 API
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${bottleId}/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            alert("🗑️ 漂流瓶已成功強制刪除！");
            
            // 💡 刪除成功後，記得重新呼叫一次「獲取列表」的函式來更新畫面
            // 例如：fetchAdminBottles(); 
            location.reload(); // 如果你還沒寫重新抓取的函式，可以先用這行讓網頁重新整理
            
        } else {
            const err = await response.json();
            alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤"));
        }
    } catch (error) {
        console.error("刪除發生錯誤:", error);
        alert("伺服器連線失敗，請檢查網路！");
    }
};