// ==========================================
// 1. 設定基礎參數
// ==========================================
const API_BASE_URL = "http://163.17.135.120";

// ==========================================
// 2. 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("authToken");
    const user = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!token || !user) {
        window.location.href = "login.html";
        return;
    }
    
    document.getElementById("admin-name").innerText = user.name + " (管理員)";
    const lastTab = localStorage.getItem('adminLastTab') || 'dashboard';
    switchAdminTab(lastTab); 
});

// ==========================================
// 3. 頁面切換與記憶功能
// ==========================================
window.switchAdminTab = function(tabName) {
    localStorage.setItem('adminLastTab', tabName);
    
    document.querySelectorAll('.admin-menu li').forEach(item => item.classList.remove('active'));
    const activeMenu = Array.from(document.querySelectorAll('.admin-menu li')).find(item => item.getAttribute('onclick')?.includes(tabName));
    if(activeMenu) activeMenu.classList.add('active');

    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('section-' + tabName).style.display = 'block';

    const titleEl = document.getElementById("admin-page-title");
    if (tabName === 'dashboard') { titleEl.innerText = "總覽數據"; }
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; }
}

// ==========================================
// 4. API 串接：管理使用者 (GET /admin/members)
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('admin-users-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>`;

    try {
        // ✅ 修正：使用 README 指定的 /admin/members API
        const response = await fetch(`${API_BASE_URL}/admin/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error();
        
        const result = await response.json();
        const users = result.data || result || [];
        
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有使用者資料</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(user => {
            let badgeClass = 'badge-active';
            if (user.status === 'BANNED') badgeClass = 'badge-banned';
            if (user.status === 'INACTIVE') badgeClass = 'badge-inactive';

            return `
            <tr>
                <td>#${user.member_id || user.id}</td>
                <td>${user.name || user.email.split('@')[0]}</td>
                <td>${user.email}</td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : '未知'}</td>
                <td><span class="badge ${badgeClass}">${user.status || 'ACTIVE'}</span></td>
                <td><button class="btn-action btn-warning" onclick="changeUserStatus(${user.member_id || user.id})">更改狀態</button></td>
            </tr>
        `}).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認是否有管理員權限</td></tr>`;
    }
}

// ✅ 修正：使用 README 指定的 PUT /admin/members/:id/status API
window.changeUserStatus = async function(userId) {
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
// 5. API 串接：漂流瓶審核 (GET /admin/bottles)
// ==========================================
async function loadBottles() {
    const tbody = document.getElementById('admin-bottles-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        // ✅ 修正：使用 README 新增的專屬管理員 API (不再用 random 就不會亂跳 ID 了)
        const response = await fetch(`${API_BASE_URL}/admin/bottles`, {
             headers: { 'Authorization': `Bearer ${token}` }
        }); 
        
        if (!response.ok) throw new Error();
        const data = await response.json();
        const bottles = data.data || data.bottles || data || [];
        
        if (bottles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前無待審核文章</td></tr>`;
            return;
        }

        window._pendingBottles = bottles; // 存入陣列供 Modal 讀取
        
        tbody.innerHTML = bottles.map((b, index) => `
            <tr>
                <td>#${b.bottle_id || b.id}</td>
                <td>${b.author_name || b.author?.name || b.author || '匿名'}</td>
                <td>${b.title}</td>
                <td><span class="badge badge-inactive">${b.category_name || b.category_list?.[0] || '綜合閒聊'}</span></td>
                <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</td>
                <td><button class="btn-action btn-primary" onclick="openBottleModalFromCache(${index})">查看/審核</button></td>
            </tr>
        `).join('');
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限或後端是否啟動</td></tr>`;
    }
}

// ==========================================
// 6. API 串接：審核動作 (PUT /admin/bottles/review)
// ==========================================
window.openBottleModalFromCache = function(index) {
    const b = window._pendingBottles[index];
    if (!b) return;
    
    document.getElementById('modal-title').innerText = `審核：${b.title}`;
    document.getElementById('modal-body').innerHTML = `<p style="white-space:pre-wrap; line-height:1.6;">${b.content}</p>`;
    
    window._reviewBottleId = b.bottle_id || b.id;
    window._reviewBottleTitle = b.title;
    
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">取消</button>
        <button class="btn-action btn-danger" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">拒絕 (2)</button>
        <button class="btn-action btn-primary" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">通過 (1)</button>
    `;
    document.getElementById('admin-modal').style.display = 'flex';
}

window.reviewBottle = async function(bottleId, status, title) {
    let violation_reason = "";
    
    // 根據 README，選擇 2 必須填寫原因
    if (status === 2) {
        violation_reason = prompt(`請輸入拒絕「${title}」的原因 (必填):`, "內容不當");
        if (!violation_reason) { alert("必須填寫拒絕原因！"); return; }
    } else {
        if(!confirm(`⚠️ 確定要通過「${title}」嗎？`)) return;
    }

    try {
        const token = localStorage.getItem("authToken");
        
        // ✅ 修正：使用 README 指定的 PUT /admin/bottles/review API
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
            loadBottles(); // 重新整理列表
        } else {
            const err = await response.json();
            alert(`審核失敗: ${err.message}`);
        }
    } catch (e) { alert("伺服器連線失敗"); }
}

// ==========================================
// 7. UI 輔助控制
// ==========================================
window.closeAdminModal = function() { document.getElementById('admin-modal').style.display = 'none'; }
window.adminLogout = function() { localStorage.clear(); window.location.href = "login.html"; }