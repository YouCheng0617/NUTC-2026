const savedPosts = localStorage.getItem('forumPostsDB');
let posts = savedPosts ? JSON.parse(savedPosts) : [
    { id: 103, board: "💻 程式開發", title: "為什麼 2026 年大家還在學 HTML?", desc: "雖然 AI 很快，但理解底層結構還是超級重要。", likes: 520, msgs: 88, liked: false },
    { id: 102, board: "🍜 美食特搜", title: "台北最強拉麵店！", desc: "湯頭濃郁，不用排隊，真的不想分享出來...", likes: 1250, msgs: 432, liked: false }
];

let currentKeyword = '';
let currentBoard = '全部';

function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    if (!container) return;
    container.innerHTML = data.length === 0 ? `<h3 style="text-align:center; color:#003366;">找不到漂流瓶 😢</h3>` : 
    data.map(p => `
        <div class="post-card" onclick="alert('假裝打開漂流瓶 id=${p.id}')">
            <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${p.board}</div>
            <h2 style="margin:12px 0; color:#003366;">${p.title}</h2>
            <p style="color:#555; line-height: 1.5;">${p.desc}</p>
            <div style="display:flex; gap:15px; color:#666; font-weight:bold; margin-top: 15px;">
                <span class="like-btn" onclick="toggleLike(${p.id}, event)" style="color:${p.liked?'#ff4d4d':''}">
                    ${p.liked?'❤️':'🤍'} ${p.likes}
                </span>
                <span>💬 ${p.msgs}</span>
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

window.toggleLike = function(id, e) {
    e.stopPropagation();
    const p = posts.find(x => x.id === id);
    if (p) {
        p.liked ? (p.likes--, p.liked=false) : (p.likes++, p.liked=true);
        localStorage.setItem('forumPostsDB', JSON.stringify(posts));
        applyFilters();
    }
}

window.enterForum = function(boardName) {
    document.getElementById('ocean-view').style.display = 'none'; 
    document.getElementById('forum-view').style.display = 'block'; 
    currentBoard = boardName;
    document.querySelectorAll('.sidebar li').forEach(li => {
        li.style.color = ''; li.style.background = '';
        if (boardName === '全部' && li.innerText.includes('綜合閒聊')) { li.style.color = '#0055a5'; li.style.background = 'rgba(255, 255, 255, 0.6)'; } 
        else if (li.innerText.includes(boardName)) { li.style.color = '#0055a5'; li.style.background = 'rgba(255, 255, 255, 0.6)'; }
    });
    applyFilters(); 
};

function setupAuth() {
    const userProfile = document.getElementById('user-profile');
    const loginTrigger = document.getElementById('login-trigger');
    function updateUI() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            loginTrigger.style.display = 'none'; userProfile.style.display = 'flex';
            document.getElementById('user-name').innerText = user.email.split('@')[0];
            if(user.avatar) document.getElementById('user-avatar').src = user.avatar;
        } else {
            loginTrigger.style.display = 'block'; userProfile.style.display = 'none';
        }
    }
    document.getElementById('logout-btn').onclick = () => {
        localStorage.removeItem('currentUser'); updateUI(); alert('已登出！');
        document.getElementById('forum-view').style.display = 'none';
        document.getElementById('ocean-view').style.display = 'block';
    };
    updateUI();
}

function setupNewPost() {
    const form = document.getElementById('new-post-form');
    document.getElementById('btn-new-post').onclick = () => document.getElementById('post-modal').style.display='block';
    if(document.getElementById('ocean-add-btn')) document.getElementById('ocean-add-btn').onclick = () => document.getElementById('post-modal').style.display='block';
    document.getElementById('close-post-modal').onclick = () => document.getElementById('post-modal').style.display='none';
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newP = { id: Date.now(), board: document.getElementById('post-board').value, title: document.getElementById('post-title-input').value, desc: document.getElementById('post-content-input').value, likes: 0, msgs: 0, liked: false };
        posts.unshift(newP); localStorage.setItem('forumPostsDB', JSON.stringify(posts));
        form.reset(); document.getElementById('post-modal').style.display='none'; enterForum('全部');
    };
}

document.addEventListener('DOMContentLoaded', () => {
    renderPosts(); setupAuth(); setupNewPost();
    document.querySelector('.search-input').oninput = (e) => { currentKeyword = e.target.value.toLowerCase().trim(); applyFilters(); };
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        document.querySelectorAll('.sidebar li').forEach(el => { el.style.color = ''; el.style.background = ''; });
        e.target.style.color = '#0055a5'; e.target.style.background = 'rgba(255, 255, 255, 0.6)';
        currentBoard = e.target.innerText.includes('綜合閒聊') ? '全部' : e.target.innerText.substring(2); applyFilters();
    });
    document.getElementById('login-trigger').onclick = () => { window.location.href = "login.html"; };
    if(document.getElementById('ocean-home-btn')) document.getElementById('ocean-home-btn').onclick = () => enterForum('全部');
    if(document.getElementById('back-to-ocean')) document.getElementById('back-to-ocean').onclick = () => { document.getElementById('forum-view').style.display = 'none'; document.getElementById('ocean-view').style.display = 'block'; };
});