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
    if (tabName === 'dashboard') {
        titleEl.innerText = "總覽數據";
    } else if (tabName === 'users') { 
        titleEl.innerText = "管理使用者"; 
        loadUsers(); 
    } else if (tabName === 'bottles') { 
        titleEl.innerText = "漂流瓶審核"; 
        loadBottles(); 
    } else if (tabName === 'reports') { 
        titleEl.innerText = "檢舉處理"; 
    }
}

// ==========================================
// 4. API 串接：管理使用者 (GET /admin/members)
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('admin-users-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">載入中...</td></tr>`;

    try {
        // 💡 修正：依據 README，這裡是 /admin/members
        const response = await fetch(`${API_BASE_URL}/admin/members`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            const result = await response.json();
            const users = result.data || result || [];
            
            if (users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">目前沒有任何使用者資料。</td></tr>`;
                return;
            }

            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>#${user.member_id || user.id}</td>
                    <td>${user.name || user.email.split('@')[0]}</td>
                    <td>${user.email}</td>
                    <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : (user.birthday ? new Date(user.birthday).toLocaleDateString() : '未知')}</td>
                    <td>
                        <span style="color: ${user.status === 'BANNED' ? 'red' : (user.status === 'INACTIVE' ? 'gray' : 'green')}; font-weight: bold;">
                            ${user.status || 'ACTIVE'}
                        </span>
                    </td>
                    <td>
                        <button style="padding: 5px 10px; cursor: pointer; background: #f5b041; border: none; border-radius: 5px; color: white;" onclick="changeUserStatus(${user.member_id || user.id})">更改狀態</button>
                    </td>
                </tr>
            `).join('');
        } else {
            const err = await response.json();
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">載入失敗 (${response.status})：${err.message || '無法載入，請確認權限'}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">連線錯誤，請檢查後端伺服器</td></tr>`;
    }
}

// ==========================================
// API 串接：更改使用者狀態 (PUT /admin/members/:id/status)
// ==========================================
window.changeUserStatus = async function(userId) {
    const newStatus = prompt("請輸入新狀態 (限填: ACTIVE, INACTIVE, BANNED):", "BANNED");
    
    if (!newStatus) return; // 按下取消
    
    const upperStatus = newStatus.toUpperCase();
    if (!['ACTIVE', 'INACTIVE', 'BANNED'].includes(upperStatus)) {
        alert("輸入無效！狀態只能填寫 ACTIVE, INACTIVE 或 BANNED");
        return;
    }

    const token = localStorage.getItem("authToken");
    try {
        // 💡 修正：依據 README，使用 PUT 更改狀態
        const response = await fetch(`${API_BASE_URL}/admin/members/${userId}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newStatus: upperStatus })
        });

        if (response.ok) {
            alert('✅ 使用者狀態已成功更新！');
            loadUsers(); // 更新畫面
        } else {
            const err = await response.json();
            alert(`更新失敗: ${err.message || '權限不足或伺服器錯誤'}`);
        }
    } catch (e) {
        alert('伺服器連線失敗');
    }
}

// ==========================================
// 5. API 串接：漂流瓶審核清單 (GET /bottles/random)
// ==========================================
async function loadBottles() {
    const tbody = document.getElementById('admin-bottles-body');
    const token = localStorage.getItem("authToken");
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/bottles/random`, {
             headers: { 
                 'Authorization': `Bearer ${token}`,
                 'ngrok-skip-browser-warning': 'true'
             }
        }); 
        
        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法取得文章 (${response.status})，請確認權限</td></tr>`;
            return;
        }
        
        const data = await response.json();
        const bottles = data.bottles || data.data || [];
        
        if (bottles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前無文章</td></tr>`;
            return;
        }

        // 將陣列存入全域，方便點擊時抓取詳細內容
        window._pendingBottles = bottles;
        
        tbody.innerHTML = bottles.map((b, index) => `
            <tr>
                <td>#${b.bottle_id}</td>
                <td>${b.author_name || b.author || '匿名'}</td>
                <td>${b.title}</td>
                <td>${b.category_name || b.category_list?.[0] || '綜合閒聊'}</td>
                <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</td>
                <td><button style="padding: 5px 10px; cursor: pointer; background: #0055a5; border: none; border-radius: 5px; color: white;" onclick="openBottleModalFromCache(${index})">查看/審核</button></td>
            </tr>
        `).join('');

    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">連線錯誤</td></tr>`;
    }
}

// ==========================================
// 6. API 串接：審核動作 (PUT /admin/bottles/review)
// ==========================================
window.reviewBottle = async function(bottleId, status, title) {
    const action = (status === 1) ? "通過" : "拒絕";
    let violation_reason = "";

    // 如果狀態是 2 (拒絕)，強迫填寫原因
    if (status === 2) {
        violation_reason = prompt(`請輸入拒絕「${title}」的原因 (必填):`, "內容不當");
        if (!violation_reason) {
            alert("拒絕必須填寫原因！");
            return;
        }
    } else {
        if(!confirm(`⚠️ 確定要將「${title}」設定為「${action}」嗎？`)) return;
    }

    try {
        const token = localStorage.getItem("authToken"); // 抓取管理員 Token

        // 💡 修正：使用正確的人類管理員專用 API 路徑與 PUT 方法
        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, {
            method: 'PUT', 
            headers: { 
                'Authorization': `Bearer ${token}`, // 只需 Token，不用給 AI 的 Key
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "bottle_id": Number(bottleId),
                "status": status, // 1 或 2
                "violation_reason": violation_reason
            })
        });

        if (response.ok) {
            alert(`✅ 文章已成功「${action}」！`);
            closeAdminModal();
            loadBottles(); // 重新整理列表
        } else {
            const err = await response.json();
            alert(`審核失敗: ${err.message || '權限不足或伺服器錯誤'}`);
        }
    } catch (e) {
        alert("伺服器連線失敗");
    }
}
// ==========================================
// 7. UI 控制 (彈出視窗)
// ==========================================
window.openBottleModalFromCache = function(index) {
    const b = window._pendingBottles[index];
    if (!b) return;
    openBottleModal(b.bottle_id, b.title, b.author_name, b.content);
}

window.openBottleModal = function(id, title, author, content) {
    document.getElementById('modal-title').innerText = `審核：${title}`;
    document.getElementById('modal-body').innerHTML = `<p style="white-space: pre-wrap; line-height: 1.6;">${content}</p>`;
    
    // 暫存 id 與 title 避免 onclick 屬性注入問題
    window._reviewBottleId = id;
    window._reviewBottleTitle = title;
    
    document.getElementById('modal-actions').innerHTML = `
        <button style="background:#888; padding: 8px 16px; border: none; border-radius: 5px; color: white; cursor: pointer; margin-right: 10px;" onclick="closeAdminModal()">取消關閉</button>
        <button style="background:#ff4d4d; padding: 8px 16px; border: none; border-radius: 5px; color: white; cursor: pointer; margin-right: 10px;" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">違規拒絕 (2)</button>
        <button style="background:#4da6ff; padding: 8px 16px; border: none; border-radius: 5px; color: white; cursor: pointer;" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">審核通過 (1)</button>
    `;
    document.getElementById('admin-modal').style.display = 'flex';
}

window.closeAdminModal = function() { 
    document.getElementById('admin-modal').style.display = 'none'; 
}

window.adminLogout = function() { 
    localStorage.clear(); 
    window.location.href = "login.html"; 
}