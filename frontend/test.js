let savedPosts = localStorage.getItem('forumPostsDB');
if (savedPosts && savedPosts.includes('"author":undefined')) {
    localStorage.removeItem('forumPostsDB'); savedPosts = null;
}

let posts = savedPosts ? JSON.parse(savedPosts) : [
    { id: 103, board: "💻 程式開發", author: "蔡孟勳", title: "為什麼 2026 年大家還在學 HTML?", desc: "雖然 AI 很快，但理解底層結構還是超級重要。", likes: 520, msgs: 88, liked: false, saved: false },
    { id: 102, board: "🍜 美食特搜", author: "匿名", title: "台北最強拉麵店！", desc: "湯頭濃郁，不用排隊，真的不想分享出來...", likes: 1250, msgs: 432, liked: true, saved: true }
];

let currentKeyword = '';
let currentBoard = '全部';

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
        localStorage.setItem('forumPostsDB', JSON.stringify(posts));
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
            const displayName = user.name || user.email.split('@')[0];
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
            localStorage.removeItem('currentUser'); updateUI(); 
            alert('已登出！即將返回登入頁');
            window.location.href = "login.html"; 
        };
    }
    updateUI();
}

function setupNewPost() {
    const form = document.getElementById('new-post-form');
    document.getElementById('btn-new-post').onclick = () => document.getElementById('post-modal').style.display='block';
    document.getElementById('close-post-modal').onclick = () => document.getElementById('post-modal').style.display='none';
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newP = { 
            id: Date.now(), board: document.getElementById('post-board').value, 
            author: document.getElementById('post-identity').value, title: document.getElementById('post-title-input').value, 
            desc: document.getElementById('post-content-input').value, likes: 0, msgs: 0, liked: false, saved: false 
        };
        posts.unshift(newP); localStorage.setItem('forumPostsDB', JSON.stringify(posts));
        form.reset(); document.getElementById('post-modal').style.display='none'; 
        currentBoard = '全部';
        document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
        document.querySelector('.sidebar li').classList.add('active'); 
        applyFilters();
    };
}

document.addEventListener('DOMContentLoaded', () => {
    renderPosts(); setupAuth(); setupNewPost();
    
    document.querySelector('.search-input').oninput = (e) => { currentKeyword = e.target.value.toLowerCase().trim(); applyFilters(); };
    
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        currentBoard = e.target.innerText.includes('綜合閒聊') ? '全部' : e.target.innerText.substring(2); applyFilters();
    });
    
    document.getElementById('login-trigger').onclick = () => { window.location.href = "login.html"; };

    // 🌟 下拉選單控制邏輯
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
});
// 在 DOMContentLoaded 裡面加入這段控制邏輯
document.addEventListener('DOMContentLoaded', () => {
    // ... 原有的程式碼 ...

    const profileModal = document.getElementById('profile-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal');

    // 🌟 找到下拉選單中的個人資料按鈕 (原本是 alert)
    const profileMenuItem = document.querySelector('.menu-item[onclick*="個人資料"]');
    if (profileMenuItem) {
        profileMenuItem.removeAttribute('onclick'); // 移除原本的 alert
        profileMenuItem.onclick = (e) => {
            e.stopPropagation();
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user) {
                // 填入資料
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

    // 關閉燈箱邏輯
    if (closeProfileBtn) {
        closeProfileBtn.onclick = () => profileModal.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target == profileModal) profileModal.style.display = 'none';
    };
});
// 🌟 這是全新的功能，直接補在檔案最後面
document.addEventListener('change', (e) => {
    if (e.target.id === 'change-avatar-input') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const imageUrl = event.target.result;
                
                // 更換畫面上的大、小頭像
                if (document.getElementById('detail-avatar')) document.getElementById('detail-avatar').src = imageUrl;
                if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = imageUrl;
                
                // 存入瀏覽器暫存
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