// ==========================================
// 1. 設定基礎參數
// ==========================================
const API_BASE_URL = "http://163.17.135.120";
const X_API_KEY = "jiwgoihiwrhgodag)3699822{jgijape'aejgipw'*APILOL*@5year}";

// ==========================================
// 2. 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否有存入 Token，若無則強制跳回登入
    const token = localStorage.getItem("authToken");
    const user = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!token || !user) {
        window.location.href = "login.html";
        return;
    }
    
    document.getElementById("admin-name").innerText = user.name + " (管理員)";
    
    // 記憶上次停留在哪個頁籤
    const lastTab = localStorage.getItem('adminLastTab') || 'dashboard';
    switchAdminTab(lastTab); 
});

// ==========================================
// 3. 頁面切換與記憶功能
// ==========================================
function switchAdminTab(tabName) {
    localStorage.setItem('adminLastTab', tabName);
    
    // 更新選單樣式
    const menuItems = document.querySelectorAll('.admin-menu li');
    menuItems.forEach(item => item.classList.remove('active'));
    const activeMenu = Array.from(menuItems).find(item => item.getAttribute('onclick')?.includes(tabName));
    if(activeMenu) activeMenu.classList.add('active');

    // 顯示對應區域
    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('section-' + tabName).style.display = 'block';

    const titleEl = document.getElementById("admin-page-title");
    if (tabName === 'dashboard') titleEl.innerText = "總覽數據";
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; }
}

// ==========================================
// 4. API 串接：管理使用者 (GET /admin/users)
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('admin-users-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        const users = result.data || [];
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>#${user.member_id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${new Date(user.birthday).toLocaleDateString()}</td>
                <td>正常</td>
                <td><button class="btn-delete">刪除</button></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限</td></tr>`;
    }
}

// ==========================================
// 5. API 串接：漂流瓶審核 (GET /bottles/random)
// ==========================================
async function loadBottles() {
    const tbody = document.getElementById('admin-bottles-body');
    const token = localStorage.getItem("authToken");
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        // 使用 README 規格的 GET /bottles/random
        const response = await fetch(`${API_BASE_URL}/bottles/random`, {
             headers: { 'Authorization': `Bearer ${token}` }
        }); 
        
        if (response.status === 401) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">登入驗證失敗 (401)，請重新登入！</td></tr>`;
            return;
        }
        
        const b = await response.json();
        
        if (!b || !b.bottle_id) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前無待審核文章</td></tr>`;
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td>#${b.bottle_id}</td>
                <td>${b.author || '匿名'}</td>
                <td>${b.title}</td>
                <td>${b.category_id || '一般'}</td>
                <td>${new Date().toLocaleDateString()}</td>
                <td><button class="btn-view" onclick="openBottleModal('${b.bottle_id}', '${b.title}', '${b.author}', '${b.content}')">審核</button></td>
            </tr>
        `;
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">連線錯誤</td></tr>`;
    }
}

// ==========================================
// 6. API 串接：審核動作 (PATCH /bottles/review)
// ==========================================
async function reviewBottle(bottleId, status, title) {
    const action = (status === 1) ? "通過" : "拒絕";
    if(!confirm(`⚠️ 確定要將「${title}」執行「${action}」嗎？`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/bottles/review`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': X_API_KEY // 規格要求的 API Key
            },
            body: JSON.stringify({
                "bottle_id": Number(bottleId),
                "status": status // 1: 通過, 2: 拒絕
            })
        });

        if (response.ok) {
            alert(`✅ 文章已成功「${action}」！`);
            closeAdminModal();
            loadBottles(); // 重新整理列表
        } else {
            alert("審核失敗，請確認 API Key 是否正確");
        }
    } catch (e) {
        alert("伺服器連線失敗");
    }
}

// ==========================================
// 7. UI 控制
// ==========================================
function openBottleModal(id, title, author, content) {
    document.getElementById('modal-title').innerText = `審核：${title}`;
    document.getElementById('modal-body').innerHTML = `<p>${content}</p>`;
    document.getElementById('modal-actions').innerHTML = `
        <button style="background:#888;" onclick="closeAdminModal()">關閉</button>
        <button class="btn-delete" onclick="reviewBottle('${id}', 2, '${title}'); closeAdminModal();">拒絕(2)</button>
        <button class="btn-view" onclick="reviewBottle('${id}', 1, '${title}'); closeAdminModal();">通過(1)</button>
    `;
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }
function adminLogout() { localStorage.clear(); window.location.href = "login.html"; }