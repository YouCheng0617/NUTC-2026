// ✨ 統一設定後端網址
const API_BASE_URL = "https://scabbed-balancing-gluten.ngrok-free.dev";

let posts = [];
let currentKeyword = '';
let currentBoard = '全部';

// 🌊 向後端抓取文章 API
async function fetchBottles() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        console.log("尚未登入，無法取得漂流瓶");
        renderPosts([]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/bottles/random`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        if (response.ok) {
            const backendData = await response.json();
            
            let postsArray = [];
            if (backendData.bottles && Array.isArray(backendData.bottles)) {
                postsArray = backendData.bottles;
            } else if (Array.isArray(backendData)) {
                postsArray = backendData;
            } else if (backendData.data && Array.isArray(backendData.data)) {
                postsArray = backendData.data;
            } else if (backendData.data?.result && Array.isArray(backendData.data.result)) {
                postsArray = backendData.data.result;
            } else if (backendData.bottle_id) {
                postsArray = [backendData];
            } else if (backendData.data?.result?.bottle_id) {
                postsArray = [backendData.data.result];
            }

            posts = postsArray.map(item => ({
                id: item.bottle_id || Date.now(),
                board: "🔥 綜合閒聊", 
                author: (item.is_anonymous || item.isAnonymous) ? "匿名" : (item.author?.name || item.author_name || "用戶"),
                title: item.title,
                desc: item.content, 
                likes: item.view_count || 0,
                msgs: 0,
                liked: false,
                saved: false
            }));
            
            applyFilters();
        } else {
            console.error("獲取文章失敗，狀態碼:", response.status);
        }
    } catch (error) {
        console.error("連線錯誤:", error);
    }
}

function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    if (!container) return;
    container.innerHTML = data.length === 0 ? `<h3 style="text-align:center; color:#888;">找不到漂流瓶 😢</h3>` : 
    data.map(p => `
        <div class="post-card" onclick="alert('假裝打開漂流瓶 id=${p.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${p.board}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${p.author || '匿名'}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${p.title}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${p.desc}</p>
            <div class="action-bar">
                <span class="action-btn ${p.liked ? 'like-active' : ''}" onclick="toggleAction(${p.id}, 'like', event)">${p.liked ? '❤️' : '🤍'} ${p.likes}</span>
                <span class="action-btn">💬 ${p.msgs}</span>
                <span class="action-btn ${p.saved ? 'save-active' : ''}" onclick="toggleAction(${p.id}, 'save', event)" style="margin-left: auto;">${p.saved ? '⭐ 已收藏' : '☆ 收藏'}</span>
            </div>
        </div>
    `).join('');
}

function applyFilters() {
    let res = posts;
    if (currentBoard !== '全部') res = res.filter(p => p.board.includes(currentBoard));
    if (currentKeyword) res = res.filter(p => p.title.toLowerCase().includes(currentKeyword));
    renderPosts(res);
}

window.toggleAction = function(id, actionType, e) {
    e.stopPropagation();
    const p = posts.find(x => x.id === id);
    if (p) {
        if (actionType === 'like') p.liked ? (p.likes--, p.liked=false) : (p.likes++, p.liked=true);
        else if (actionType === 'save') p.saved = !p.saved;
        applyFilters();
    }
}

function setupAuth() {
    const userProfile = document.getElementById('user-profile');
    const loginTrigger = document.getElementById('login-trigger');
    const identitySelect = document.getElementById('post-identity');
    
    function updateUI() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            loginTrigger.style.display = 'none'; userProfile.style.display = 'flex';
            const displayName = user.name || (user.email ? user.email.split('@')[0] : '用戶');
            document.getElementById('user-name').innerText = displayName;
            if(user.avatar) document.getElementById('user-avatar').src = user.avatar;
            if(identitySelect) {
                identitySelect.options[0].text = `實名 (${displayName})`;
                identitySelect.options[0].value = displayName;
            }
        } else {
            loginTrigger.style.display = 'block'; userProfile.style.display = 'none';
        }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('currentUser'); 
            localStorage.removeItem('authToken'); 
            updateUI(); 
            alert('已登出！期待再次與你相遇。');
            window.location.href = "index.html"; 
        };
    }
    updateUI();
}

function setupNewPost() {
    const form = document.getElementById('new-post-form');
    document.getElementById('btn-new-post').onclick = () => document.getElementById('post-modal').style.display='block';
    document.getElementById('close-post-modal').onclick = () => document.getElementById('post-modal').style.display='none';
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("authToken");
        const title = document.getElementById('post-title-input').value;
        const content = document.getElementById('post-content-input').value;
        const identity = document.getElementById('post-identity').value;
        const isAnonymous = identity === "匿名";

        try {
            const response = await fetch(`${API_BASE_URL}/bottles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    title: title,
                    content: content,
                    isAnonymous: isAnonymous
                })
            });

            if (response.ok) {
                alert('漂流瓶拋出成功！');
                form.reset(); 
                document.getElementById('post-modal').style.display='none'; 
                fetchBottles();
            } else {
                alert('發文失敗，請稍後再試。');
            }
        } catch (error) {
            console.error("連線錯誤:", error);
            alert('無法連線至伺服器');
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    setupAuth(); 
    setupNewPost();
    fetchBottles(); 
    
    document.querySelector('.search-input').oninput = (e) => { currentKeyword = e.target.value.toLowerCase().trim(); applyFilters(); };
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        currentBoard = e.target.innerText.includes('綜合閒聊') ? '全部' : e.target.innerText.substring(2); applyFilters();
    });
    
    document.getElementById('login-trigger').onclick = () => { window.location.href = "login.html"; };

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuBtn) {
        userMenuBtn.onclick = (e) => {
            e.stopPropagation(); 
            userDropdown.classList.toggle('show-dropdown');
        };
    }
    document.addEventListener('click', () => {
        if (userDropdown) userDropdown.classList.remove('show-dropdown');
    });

    const profileModal = document.getElementById('profile-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal');
    const profileMenuItem = document.getElementById('open-profile');

    if (profileMenuItem) {
        profileMenuItem.onclick = (e) => {
            e.stopPropagation();
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user) {
                document.getElementById('detail-avatar').src = user.avatar || 'images/fish_logo.png';
                document.getElementById('detail-name').innerText = user.name || '未設定姓名';
                document.getElementById('detail-email').innerText = user.email;
                document.getElementById('detail-birthday').innerText = user.birthday || '未填寫';
                document.getElementById('detail-gender').innerText = user.gender || '未填寫';
                document.getElementById('detail-zodiac').innerText = user.zodiac || '未填寫';
                document.getElementById('detail-bio').innerText = user.bio || '這瓶子裡目前空空的...';
                
                profileModal.style.display = 'block';
            } else {
                alert('請先登入！');
            }
        };
    }

    if (closeProfileBtn) {
        closeProfileBtn.onclick = () => profileModal.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target == profileModal) profileModal.style.display = 'none';
    };
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'change-avatar-input') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                if (document.getElementById('detail-avatar')) document.getElementById('detail-avatar').src = imageUrl;
                if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = imageUrl;
                const user = JSON.parse(localStorage.getItem('currentUser'));
                if (user) {
                    user.avatar = imageUrl;
                    localStorage.setItem('currentUser', JSON.stringify(user));
                }
            };
            reader.readAsDataURL(file);
        }
    }
});