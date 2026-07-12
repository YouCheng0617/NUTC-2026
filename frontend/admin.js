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
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; }
}

// ==========================================
// 4. 總覽數據與 Chart.js 圖表 (加上「開心」分類)
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

        // ✨ 加上 happy 變數
        let angry = 0, secret = 0, broken = 0, apathy = 0, happy = 0;

        bottles.forEach(b => {
            let rawCat = b.category_name || null;
            if (!rawCat && b.categories && b.categories.length > 0) {
                rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
            }
            if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
            if (!rawCat) rawCat = '綜合閒聊';

            // ✨ 新增開心的判斷條件
            if (rawCat.includes("開心") || rawCat.includes("喜悅") || rawCat.includes("快樂")) happy++;
            else if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) angry++;
            else if (rawCat.includes("秘密") || rawCat.includes("程式")) secret++;
            else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) broken++;
            else apathy++;
        });

        // 傳遞 5 個分類的數據
        drawDoughnutChart([angry, secret, broken, apathy, happy]);

    } catch (error) {
        console.error("載入總覽數據失敗", error);
    }
}

function drawDoughnutChart(dataArray) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (myDoughnutChart) {
        myDoughnutChart.destroy();
    }

    myDoughnutChart = new Chart(ctx, {
        type: 'doughnut', 
        data: {
            // ✨ 加上開心的標籤
            labels: ['😡 憤怒', '🤫 秘密', '💔 破碎', '😑 厭世', '😁 開心'],
            datasets: [{
                data: dataArray,
                // ✨ 加上天空藍
                backgroundColor: ['#fff1f0', '#f9f0ff', '#fff7e6', '#f6ffed', '#e6f7ff'],
                borderColor: ['#ffa39e', '#d3adf7', '#ffd591', '#b7eb8f', '#91d5ff'],
                borderWidth: 2,
                hoverOffset: 10 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right', 
                    labels: { font: { size: 14 } }
                }
            }
        }
    });
}

// ==========================================
// 5. API 串接：管理使用者
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

function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合的資料</td></tr>`;
        return;
    }
    
    tbody.innerHTML = users.map(u => {
        let currentStatus = u.status || 'ACTIVE';
        let statusBadge = '';

        if (currentStatus === 'BANNED') {
            statusBadge = `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">🔴 ${currentStatus}</span>`;
        } else if (currentStatus === 'INACTIVE') {
            statusBadge = `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">🟡 ${currentStatus}</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:#e6f7ff; color:#0066cc; border:1px solid #91d5ff;">🟢 ${currentStatus}</span>`;
        }

        return `
        <tr>
            <td data-label="會員 ID">${escapeHTML(String(u.member_id || u.id || '未知'))}</td>
            <td data-label="姓名暱稱">${escapeHTML(u.name || '未命名')}</td>
            <td data-label="登入 Email">${escapeHTML(u.email || '無')}</td>
            <td data-label="註冊時間">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="帳號狀態">${statusBadge}</td>
            <td data-label="項目操作">
                <button class="btn-action btn-secondary" onclick="changeUserStatus('${u.member_id || u.id}', '${escapeHTML(u.name || '未命名')}')">更改狀態</button>
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

window.closeStatusModal = function () {
    document.getElementById('status-modal').style.display = 'none';
    currentEditingUserId = null;
}

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
            closeStatusModal(); 
            loadUsers();        
        } else {
            alert('更新失敗，請確認權限或網路狀態');
        }
    } catch (e) { 
        alert('伺服器連線失敗'); 
    }
}

// ==========================================
// 6. API 串接：漂流瓶審核 (加上開心分類與一鍵篩選)
// ==========================================
window._allBottles = [];
window._currentStatusFilter = 'all'; // 預設顯示全部

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
        filterBottles(); // 載入後直接過濾並渲染

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限或後端是否啟動</td></tr>`;
    }
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
        if (!rawCat && b.categories && b.categories.length > 0) {
            rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
        }
        if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
        if (!rawCat) rawCat = '綜合閒聊';

        let catHtml = '';
        if (rawCat.includes("開心") || rawCat.includes("喜悅") || rawCat.includes("快樂")) {
            catHtml = `<span class="badge" style="background:#e6f7ff; color:#0050b3; border:1px solid #91d5ff;">😁 開心的事</span>`;
        } else if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) {
            catHtml = `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">😡 極度憤怒中</span>`;
        } else if (rawCat.includes("秘密") || rawCat.includes("程式")) {
            catHtml = `<span class="badge" style="background:#f9f0ff; color:#531dab; border:1px solid #d3adf7;">🤫 沒人懂的秘密</span>`;
        } else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) {
            catHtml = `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">💔 破碎的碎片</span>`;
        } else {
            catHtml = `<span class="badge" style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f;">😑 極度厭世/躺平</span>`;
        }

        let statusBadge = '';
        let rowStyle = '';
        let btnText = '審核'; 

        if (b.status === 1) {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0;">✅ 已通過</span>`;
            rowStyle = `opacity: 0.8; background: #f8fafc;`; 
            btnText = '查看'; 
        } else if (b.status === 2) {
            statusBadge = `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca;">❌ 已拒絕</span>`;
            rowStyle = `opacity: 0.8; background: #f8fafc;`; 
            btnText = '查看'; 
        } else {
            statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;">⏳ 待審核</span>`;
            rowStyle = `opacity: 1; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);`;
            btnText = '審核';
        }

        return `
        <tr style="${rowStyle} transition: 0.3s;">
            <td data-label="文章 ID" style="color: #64748b; font-weight: 600;">#${escapeHTML(String(b.bottle_id || b.id))}</td>
            <td data-label="發文者">${escapeHTML(String(b.member_name || b.author_name || '匿名'))}</td>
            
            <td data-label="標題">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 600; color: #1e293b; font-size: 1.05rem;">${escapeHTML(String(b.title))}</span>
                    ${statusBadge}
                </div>
            </td>
            
            <td data-label="看板分類">${catHtml}</td>
            <td data-label="發布時間" style="color: #64748b;">${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="項目操作">
                <button class="btn-action btn-primary" onclick="openBottleModalFromCache('${b.bottle_id || b.id}')">${btnText}</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteBottleAsAdmin('${b.bottle_id || b.id}')">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

// 👇 這裡重新寫了過濾器，結合關鍵字和狀態篩選
window.filterBottles = function () {
    const keyword = document.getElementById('search-bottles').value.toLowerCase();
    
    const filtered = window._allBottles.filter(b => {
        // 1. 檢查關鍵字
        const matchKeyword = String(b.bottle_id || '').includes(keyword) ||
            String(b.title || '').toLowerCase().includes(keyword) ||
            String(b.content || '').toLowerCase().includes(keyword) ||
            String(b.member_name || b.author?.name || '').toLowerCase().includes(keyword);

        // 2. 檢查目前點擊的一鍵分類狀態
        let matchStatus = true;
        if (window._currentStatusFilter === 'pending') {
            matchStatus = (b.status !== 1 && b.status !== 2); // 待審核
        } else if (window._currentStatusFilter === 'passed') {
            matchStatus = (b.status === 1); // 已通過
        } else if (window._currentStatusFilter === 'rejected') {
            matchStatus = (b.status === 2); // 已拒絕
        }

        return matchKeyword && matchStatus;
    });
    
    renderBottles(filtered);
}

// ==========================================
// 7. 審核動作 
// ==========================================
window.openBottleModalFromCache = function (bottleId) {
    const b = window._allBottles.find(item => String(item.bottle_id || item.id) === String(bottleId));
    if (!b) return;

    let rawCat = b.category_name || null;
    if (!rawCat && b.categories && b.categories.length > 0) {
        rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
    }
    if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
    if (!rawCat) rawCat = '綜合閒聊';

    let catHtml = '';
    if (rawCat.includes("開心") || rawCat.includes("喜悅") || rawCat.includes("快樂")) {
        catHtml = `<span class="badge" style="background:#e6f7ff; color:#0050b3; border:1px solid #91d5ff;">😁 開心的事</span>`;
    } else if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) {
        catHtml = `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">😡 極度憤怒中</span>`;
    } else if (rawCat.includes("秘密") || rawCat.includes("程式")) {
        catHtml = `<span class="badge" style="background:#f9f0ff; color:#531dab; border:1px solid #d3adf7;">🤫 沒人懂的秘密</span>`;
    } else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) {
        catHtml = `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">💔 破碎的碎片</span>`;
    } else {
        catHtml = `<span class="badge" style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f;">😑 極度厭世/躺平</span>`;
    }

    document.getElementById('modal-title').innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; font-size: 1.4rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 0;">
            <span style="font-size: 1.6rem;">📝</span> 
            ${escapeHTML(b.title)}
        </div>
    `;

    document.getElementById('modal-body').innerHTML = `
        <div style="margin: 15px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">👤 作者：${escapeHTML(b.member_name || b.author_name || '匿名')}</span>
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">📅 ${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</span>
            ${catHtml}
        </div>
        
        <div style="background: #ffffff; border-left: 5px solid #3b82f6; padding: 24px; border-radius: 0 12px 12px 0; font-size: 1.05rem; color: #334155; white-space: pre-wrap; line-height: 1.8; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 20px;">
            ${escapeHTML(b.content)}
        </div>
    `;

    window._reviewBottleId = b.bottle_id || b.id;
    window._reviewBottleTitle = b.title;

    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">返回</button>
        <div style="margin-left: auto; display: flex; gap: 12px;">
            <button class="btn-action btn-danger" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">❌ 拒絕 (違規)</button>
            <button class="btn-action btn-primary" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">✅ 審核通過</button>
        </div>
    `;
    
    document.getElementById('admin-modal').style.display = 'flex';
}

window.reviewBottle = function (bottleId, status, title) {
    window._pendingReviewId = bottleId;
    window._pendingReviewTitle = title;

    if (status === 2) {
        document.getElementById('reject-reason-input').value = '內容不當'; 
        document.getElementById('reject-modal').style.display = 'flex';
    } else {
        if (!confirm(`✅ 確定要通過「${title}」，讓它流入海中嗎？`)) return;
        executeReviewAction(bottleId, 1, ""); 
    }
}

window.closeRejectModal = function() {
    document.getElementById('reject-modal').style.display = 'none';
}

window.confirmRejectAction = function() {
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) {
        alert("必須填寫拒絕原因唷！");
        return;
    }
    executeReviewAction(window._pendingReviewId, 2, reason);
    closeRejectModal(); 
}

window.executeReviewAction = async function(bottleId, status, reason) {
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
                "violation_reason": reason
            })
        });

        if (response.ok) {
            alert(`🎉 審核完成！`);
            closeAdminModal(); 
            loadBottles();     
        } else {
            const err = await response.json();
            alert(`審核失敗: ${err.message}`);
        }
    } catch (e) { 
        alert("伺服器連線失敗"); 
    }
}

window.deleteBottleAsAdmin = async function(bottleId) {
    if (!confirm(`⚠️ 確定要以管理員身分強制刪除 #${bottleId} 號漂流瓶嗎？刪除後將無法復原！`)) return;

    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${bottleId}/delete`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });

        if (response.ok) {
            alert("🗑️ 漂流瓶已成功強制刪除！");
            loadBottles(); 
        } else {
            const err = await response.json();
            alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤"));
        }
    } catch (error) {
        alert("伺服器連線失敗，請檢查網路！");
    }
};

// ==========================================
// 8. UI 輔助控制
// ==========================================
window.closeAdminModal = function () { document.getElementById('admin-modal').style.display = 'none'; }
window.adminLogout = function () { localStorage.clear(); window.location.href = "login.html"; }

// ==========================================
// 9. API 串接：文章列表一鍵分類篩選 ✨
// ==========================================
window.filterByStatus = function(status) {
    window._currentStatusFilter = status; // 記住現在點了哪個標籤
    
    // 幫按鈕換上漂亮的點擊顏色
    const btns = ['all', 'pending', 'passed', 'rejected'];
    btns.forEach(id => {
        const el = document.getElementById('filter-btn-' + id);
        if (!el) return;
        if (id === status) {
            el.style.background = '#3b82f6';
            el.style.color = '#fff';
            el.style.borderColor = '#3b82f6';
        } else {
            el.style.background = '#f8fafc';
            el.style.color = '#64748b';
            el.style.borderColor = '#e2e8f0';
        }
    });

    // 重新執行上面寫好的過濾器
    filterBottles(); 
}

// ==========================================
// 10. 🚀 專屬特製：一鍵審核所有待處理文章
// ==========================================
window.approveAllPendingBottles = async function() {
    // 找出所有「還沒審核」的瓶子 (狀態不是 1 通過，也不是 2 拒絕)
    const pendingBottles = window._allBottles.filter(b => b.status !== 1 && b.status !== 2);
    
    if (pendingBottles.length === 0) {
        alert("寶寶，目前沒有需要審核的漂流瓶唷！海灘已經很乾淨啦 🏖️✨");
        return;
    }

    if (!confirm(`🚀 準備將 ${pendingBottles.length} 個漂流瓶「一鍵全部通過」流入海中，確定要施展魔法嗎？`)) {
        return;
    }

    const token = localStorage.getItem("authToken");
    
    try {
        // 同時對所有待審核的瓶子發送「通過(1)」的請求
        const requests = pendingBottles.map(b => {
            const bottleId = b.bottle_id || b.id;
            return fetch(`${API_BASE_URL}/admin/bottles/review`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "bottle_id": Number(bottleId),
                    "status": 1, 
                    "violation_reason": ""
                })
            });
        });

        // 等待所有請求都完成
        await Promise.all(requests);
        
        alert(`🎉 太神啦！成功一鍵通過了 ${pendingBottles.length} 個漂流瓶！`);
        loadBottles(); // 幫你自動重新載入列表
        
    } catch (error) {
        alert("哎呀，批次施法過程中有些小失誤，請檢查網路狀態喔！");
        loadBottles(); // 就算出錯也幫你重整一下畫面
    }
};