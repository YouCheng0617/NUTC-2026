// 1. 資料初始化：優先從 localStorage 拿，沒有則用預設值
const savedPosts = localStorage.getItem('forumPostsDB');
let posts = savedPosts ? JSON.parse(savedPosts) : [
    { id: 103, board: "💻 程式開發", title: "為什麼 2026 年大家還在學 HTML?", desc: "雖然 AI 很快，但理解底層結構還是超級重要。", likes: 520, msgs: 88, liked: false },
    { id: 102, board: "🍜 美食特搜", title: "台北最強拉麵店！", desc: "湯頭濃郁，不用排隊，真的不想分享出來...", likes: 1250, msgs: 432, liked: false }
];

let currentKeyword = '';
let currentBoard = '全部';

// 2. 渲染文章機器
function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    if (!container) return;
    container.innerHTML = data.length === 0 ? `<h3 style="text-align:center;">找不到文章 😢</h3>` : 
    data.map(p => `
        <div class="post-card" onclick="location.href='article.html?id=${p.id}'">
            <div style="font-size:0.8rem; color:#00f2ff;">${p.board}</div>
            <h2 style="margin:10px 0;">${p.title}</h2>
            <p style="color:#a0aec0;">${p.desc}</p>
            <div style="display:flex; gap:15px; color:#707d9a;">
                <span class="like-btn" onclick="toggleLike(${p.id}, event)" style="color:${p.liked?'#ff4d4d':''}">
                    ${p.liked?'❤️':'🤍'} ${p.likes}
                </span>
                <span>💬 ${p.msgs}</span>
            </div>
        </div>
    `).join('');
}

// 3. 過濾器
function applyFilters() {
    let res = posts;
    if (currentBoard !== '全部') res = res.filter(p => p.board.includes(currentBoard));
    if (currentKeyword) res = res.filter(p => p.title.toLowerCase().includes(currentKeyword));
    renderPosts(res);
}

// 4. 按讚功能 (阻止事件冒泡)
window.toggleLike = function(id, e) {
    e.stopPropagation();
    const p = posts.find(x => x.id === id);
    if (p) {
        p.liked ? (p.likes--, p.liked=false) : (p.likes++, p.liked=true);
        localStorage.setItem('forumPostsDB', JSON.stringify(posts));
        applyFilters();
    }
}

// 5. 登入與大頭貼邏輯
function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const userProfile = document.getElementById('user-profile');
    const loginTrigger = document.getElementById('login-trigger');
    
    function updateUI() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            loginTrigger.style.display = 'none';
            userProfile.style.display = 'flex';
            document.getElementById('user-name').innerText = user.email.split('@')[0];
            if(user.avatar) document.getElementById('user-avatar').src = user.avatar;
        } else {
            loginTrigger.style.display = 'block';
            userProfile.style.display = 'none';
        }
    }

    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input').value;
        localStorage.setItem('currentUser', JSON.stringify({ email, avatar: '' }));
        document.getElementById('login-modal').style.display = 'none';
        updateUI();
    };

    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('currentUser');
        updateUI();
    };

    document.getElementById('avatar-upload').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            user.avatar = ev.target.result;
            localStorage.setItem('currentUser', JSON.stringify(user));
            updateUI();
        };
        reader.readAsDataURL(e.target.files[0]);
    };
    updateUI();
}

// 6. 發文邏輯
function setupNewPost() {
    const form = document.getElementById('new-post-form');
    document.getElementById('btn-new-post').onclick = () => document.getElementById('post-modal').style.display='block';
    document.getElementById('close-post-modal').onclick = () => document.getElementById('post-modal').style.display='none';
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newP = {
            id: Date.now(),
            board: document.getElementById('post-board').value,
            title: document.getElementById('post-title-input').value,
            desc: document.getElementById('post-content-input').value,
            likes: 0, msgs: 0, liked: false
        };
        posts.unshift(newP);
        localStorage.setItem('forumPostsDB', JSON.stringify(posts));
        form.reset();
        document.getElementById('post-modal').style.display='none';
        applyFilters();
    };
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderPosts();
    setupAuth();
    setupNewPost();
    document.querySelector('.search-input').oninput = (e) => {
        currentKeyword = e.target.value.toLowerCase().trim();
        applyFilters();
    };
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        currentBoard = e.target.innerText.includes('綜合閒聊') ? '全部' : e.target.innerText.substring(2);
        applyFilters();
    });
    document.getElementById('login-trigger').onclick = () => document.getElementById('login-modal').style.display='block';
    document.getElementById('close-modal').onclick = () => document.getElementById('login-modal').style.display='none';
});