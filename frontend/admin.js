// ==========================================
// 1. 設定基礎參數與共用工具
// ==========================================
const API_BASE_URL = "https://163.17.135.120";

function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

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
// 3. 頁面切換與記憶功能 (升級版：自動抓數據)
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
        loadDashboardData(); // 🌟 切換到總覽時，啟動抓資料與畫圖表的魔法！
    }
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; }
}

// ==========================================
// ✨ 寶寶專屬：總覽數據與 Chart.js 圖表魔法
// ==========================================
let myDoughnutChart = null; // 用來記住圖表，避免重複畫疊在一起

async function loadDashboardData() {
    const token = localStorage.getItem("authToken");

    try {
        // 1. 同時發送請求，把「所有會員」跟「所有文章」抓下來
        const [usersRes, bottlesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/members`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }),
            fetch(`${API_BASE_URL}/admin/bottles`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } })
        ]);

        const usersData = await usersRes.json();
        const bottlesData = await bottlesRes.json();

        const users = usersData.data || usersData || [];
        const bottles = bottlesData.data || bottlesData.bottles || bottlesData || [];

        // 2. 🌟 更新上方卡片的真實數字！(算出陣列有幾個，就是總數)
        document.getElementById('stat-users').innerText = users.length;
        document.getElementById('stat-bottles').innerText = bottles.length;

        // 3. 計算各個「情緒分類」的數量
        let angry = 0, secret = 0, broken = 0, apathy = 0;

        bottles.forEach(b => {
            let rawCat = b.category_name || null;
            if (!rawCat && b.categories && b.categories.length > 0) {
                rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
            }
            if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
            if (!rawCat) rawCat = '綜合閒聊';

            if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) angry++;
            else if (rawCat.includes("秘密") || rawCat.includes("程式")) secret++;
            else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) broken++;
            else apathy++;
        });

        // 4. 畫出漂亮甜甜圈圖表
        drawDoughnutChart([angry, secret, broken, apathy]);

    } catch (error) {
        console.error("載入總覽數據失敗", error);
    }
}

function drawDoughnutChart(dataArray) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    // 如果已經畫過圖了，要先把它毀滅，不然新舊圖表會疊在一起閃爍
    if (myDoughnutChart) {
        myDoughnutChart.destroy();
    }

    myDoughnutChart = new Chart(ctx, {
        type: 'doughnut', 
        data: {
            labels: ['😡 憤怒', '🤫 秘密', '💔 破碎', '😑 厭世'],
            datasets: [{
                data: dataArray,
                // 對應我們前面設定的柔和色彩
                backgroundColor: ['#fff1f0', '#f9f0ff', '#fff7e6', '#f6ffed'],
                borderColor: ['#ffa39e', '#d3adf7', '#ffd591', '#b7eb8f'],
                borderWidth: 2,
                hoverOffset: 10 // 滑鼠移過去會彈出來的動畫
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right', // 標籤放在右邊
                    labels: { font: { size: 14 } }
                }
            }
        }
    });
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


window.filterUsers = function () {
    const keyword = document.getElementById('search-users').value.toLowerCase();
    const filtered = window._allUsers.filter(u =>
        String(u.member_id || '').includes(keyword) ||
        String(u.name || '').toLowerCase().includes(keyword) ||
        String(u.email || '').toLowerCase().includes(keyword)
    );
    renderUsers(filtered);
}

// 補上渲染使用者的函數 (進化版：把使用者名字傳給彈窗)
function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合的資料</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => `
        <tr>
            <td data-label="會員 ID">${escapeHTML(String(u.member_id || u.id || '未知'))}</td>
            <td data-label="姓名暱稱">${escapeHTML(u.name || '未命名')}</td>
            <td data-label="登入 Email">${escapeHTML(u.email || '無')}</td>
            <td data-label="註冊時間">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="帳號狀態"><span class="badge" style="background:#e6f7ff; color:#0066cc; border:1px solid #91d5ff;">${u.status || 'ACTIVE'}</span></td>
            <td data-label="項目操作">
                <button class="btn-action btn-secondary" onclick="changeUserStatus('${u.member_id || u.id}', '${escapeHTML(u.name || '未命名')}')">更改狀態</button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// ✨ 寶寶專屬：漂亮彈窗控制邏輯
// ==========================================
let currentEditingUserId = null;

// 1. 打開漂亮彈窗
window.changeUserStatus = function (userId, userName) {
    currentEditingUserId = userId;
    // 貼心地顯示正在修改誰
    document.getElementById('status-modal-user-name').innerText = `正在修改帳號：${userName}`;
    document.getElementById('status-modal').style.display = 'flex';
}

// 2. 關閉彈窗
window.closeStatusModal = function () {
    document.getElementById('status-modal').style.display = 'none';
    currentEditingUserId = null;
}

// 3. 點擊三個按鈕後，真正發送 API 給後端
window.confirmChangeStatus = async function (newStatus) {
    if (!currentEditingUserId) return;
    
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${currentEditingUserId}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ newStatus: newStatus })
        });
        
        if (response.ok) {
            alert('✅ 狀態已成功更新！');
            closeStatusModal(); // 成功後自動關閉彈窗
            loadUsers();        // 重新載入最新列表
        } else {
            alert('更新失敗，請確認權限或網路狀態');
        }
    } catch (e) { 
        alert('伺服器連線失敗'); 
    }
}
// ==========================================
// 5. API 串接：漂流瓶審核 (包含新舊兼容情緒分類)
// ==========================================
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
    if (!tbody) return;
    
    if (bottles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合的資料</td></tr>`;
        return;
    }

    tbody.innerHTML = bottles.map(b => {
        let rawCat = b.category_name || null;
        if (!rawCat && b.categories && b.categories.length > 0) {
            rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
        }
        if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
        if (!rawCat) rawCat = '綜合閒聊';

        // ✨ 寶寶的專屬情緒分類 (完美兼容舊文章)
        let catHtml = '';
        if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) {
            catHtml = `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">😡 極度憤怒中</span>`;
        } else if (rawCat.includes("秘密") || rawCat.includes("程式")) {
            catHtml = `<span class="badge" style="background:#f9f0ff; color:#531dab; border:1px solid #d3adf7;">🤫 沒人懂的秘密</span>`;
        } else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) {
            catHtml = `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">💔 破碎的碎片</span>`;
        } else {
            catHtml = `<span class="badge" style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f;">😑 極度厭世/躺平</span>`;
        }

        return `
        <tr>
            <td data-label="文章 ID">#${escapeHTML(String(b.bottle_id || b.id))}</td>
            <td data-label="發文者">${escapeHTML(String(b.member_name || b.author_name || '匿名'))}</td>
            <td data-label="標題">${escapeHTML(String(b.title))}</td>
            <td data-label="看板分類">${catHtml}</td>
            <td data-label="發布時間">${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="項目操作">
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
// 6. API 串接：審核動作與強制刪除
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

window.deleteBottleAsAdmin = async function(bottleId) {
    if (!confirm(`⚠️ 確定要以管理員身分強制刪除 #${bottleId} 號漂流瓶嗎？刪除後將無法復原！`)) {
        return;
    }

    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${bottleId}/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            alert("🗑️ 漂流瓶已成功強制刪除！");
            loadBottles(); // 刪除成功後自動重新抓取列表，不用重整頁面
        } else {
            const err = await response.json();
            alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤"));
        }
    } catch (error) {
        alert("伺服器連線失敗，請檢查網路！");
    }
};

// ==========================================
// 7. UI 輔助控制
// ==========================================
window.closeAdminModal = function () { document.getElementById('admin-modal').style.display = 'none'; }
window.adminLogout = function () { localStorage.clear(); window.location.href = "login.html"; }