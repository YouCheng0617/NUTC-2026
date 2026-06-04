// ✨ 統一設定後端網址
const API_BASE_URL = "http://163.17.135.120";

let posts = [];
let currentKeyword = '';
let currentBoard = '全部';
let currentView = 'all'; // 🔴 紀錄狀態：'all' (一般), 'saved' (收藏頁), 'mine' (我的文章頁)

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

            posts = postsArray.map(item => {
                // 🟢 確保 ID 絕對是字串，且不會重複
                const safeId = String(item.bottle_id || `temp_${Math.random().toString(36).substr(2, 9)}`);
                return {
                    id: safeId,
                    board: "🔥 綜合閒聊", 
                    author: (item.is_anonymous || item.isAnonymous) ? "匿名" : (item.author?.name || item.author_name || "用戶"),
                    title: item.title,
                    desc: item.content, 
                    likes: item.view_count || 0,
                    msgs: getComments(safeId).length, // 讀取真實的留言數量
                    liked: false,
                    saved: false 
                };
            });
            
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
    
    let emptyMsg = '找不到漂流瓶 😢';
    if (currentView === 'saved') {
        emptyMsg = '你還沒有收藏任何漂流瓶喔 ⭐';
    } else if (currentView === 'mine') {
        emptyMsg = '你目前還沒有發過任何漂流瓶喔 📝';
    }

    container.innerHTML = data.length === 0 ? `<h3 style="text-align:center; color:#888; margin-top:40px;">${emptyMsg}</h3>` : 
    data.map(p => `
        <div class="post-card" onclick="openPostDetail('${p.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${p.board}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${p.author || '匿名'}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${p.title}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${p.desc}</p>
            <div class="action-bar">
                <span class="action-btn ${p.liked ? 'like-active' : ''}" onclick="toggleAction('${p.id}', 'like', event)">${p.liked ? '❤️' : '🤍'} ${p.likes}</span>
                <span class="action-btn">💬 ${p.msgs}</span>
                <span class="action-btn ${p.saved ? 'save-active' : ''}" onclick="toggleAction('${p.id}', 'save', event)" style="margin-left: auto;">${p.saved ? '⭐ 已收藏' : '☆ 收藏'}</span>
            </div>
        </div>
    `).join('');
}

function applyFilters() {
    let res = posts;
    
    if (currentView === 'saved') {
        res = res.filter(p => p.saved === true); 
    } else if (currentView === 'mine') {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const myName = user ? user.name : '';
        res = res.filter(p => p.author === myName);
    } else {
        if (currentBoard !== '全部') res = res.filter(p => p.board.includes(currentBoard));
    }
    
    if (currentKeyword) {
        res = res.filter(p => 
            (p.title && p.title.toLowerCase().includes(currentKeyword)) || 
            (p.desc && p.desc.toLowerCase().includes(currentKeyword)) || 
            (p.board && p.board.toLowerCase().includes(currentKeyword))
        );
    }
    
    renderPosts(res);
}

// ----------------------------------------------------
// 🔍 搜尋歷史紀錄功能
// ----------------------------------------------------
function getSearchHistory() {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]');
}

function saveSearchHistory(keyword) {
    if (!keyword.trim()) return;
    let history = getSearchHistory();
    history = history.filter(item => item !== keyword);
    history.unshift(keyword);
    if (history.length > 5) history.pop();
    
    localStorage.setItem('searchHistory', JSON.stringify(history));
}

function renderSearchHistory() {
    const historyBox = document.getElementById('search-history-dropdown');
    if (!historyBox) return;
    
    const history = getSearchHistory();
    
    if (history.length === 0) {
        historyBox.innerHTML = '<div style="padding: 15px; color:#888; font-size: 0.9rem; text-align: center;">尚無搜尋紀錄</div>';
        return;
    }

    let html = '';
    history.forEach(item => {
        html += `
            <div class="history-item" 
                 onmouseenter="document.getElementById('main-search-input').value = '${item}'" 
                 onclick="applyHistorySearch('${item}')">
                <span>${item}</span>
                <span class="delete-history-btn" onclick="removeSingleHistory(event, '${item}')">&times;</span>
            </div>
        `;
    });
    
    historyBox.innerHTML = html;
}

window.applyHistorySearch = function(keyword) {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) searchInput.value = keyword;
    
    currentKeyword = keyword.toLowerCase();
    applyFilters(); 
    document.getElementById('search-history-dropdown').style.display = 'none';
}

window.removeSingleHistory = function(e, keyword) {
    e.stopPropagation(); 
    let history = getSearchHistory();
    history = history.filter(item => item !== keyword);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderSearchHistory();
    
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) searchInput.focus();
}

// ----------------------------------------------------
// 📝 留言系統功能 (防呆增強版)
// ----------------------------------------------------
let currentOpenPostId = null;

function getComments(postId) {
    if (!postId) return [];
    try {
        let allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
        if (typeof allComments !== 'object' || Array.isArray(allComments)) allComments = {};
        return allComments[postId] || [];
    } catch (e) {
        return [];
    }
}

function saveComment(postId, commentObj) {
    if (!postId) return;
    try {
        let allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
        if (typeof allComments !== 'object' || Array.isArray(allComments)) allComments = {};
        if (!allComments[postId]) allComments[postId] = []; 
        allComments[postId].push(commentObj);
        localStorage.setItem('postComments', JSON.stringify(allComments));
    } catch (e) {
        console.error("儲存留言時發生錯誤", e);
    }
}

function renderComments(postId) {
    const comments = getComments(postId);
    
    // 防呆：抓取畫面上「最後一個」留言容器 (避免 HTML 裡有殘留的舊燈箱)
    const lists = document.querySelectorAll('#detail-comments-list');
    const listContainer = lists[lists.length - 1];
    
    const counts = document.querySelectorAll('#detail-comment-count');
    const countSpan = counts[counts.length - 1];

    if (!listContainer) return;

    if (countSpan) countSpan.innerText = comments.length;

    if (comments.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:#888; padding: 20px 0;">目前還沒有留言喔，來搶頭香吧！🐟</div>';
        return;
    }

    let html = '';
    comments.forEach((c, index) => {
        html += `
            <div style="background: #f9fbfd; padding: 15px; border-radius: 12px; border: 1px solid #e0e6ed; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; align-items: center;">
                    <span style="font-size: 0.9rem; font-weight: bold; color: #0055a5; display: flex; align-items: center; gap: 8px;">
                        <img src="${c.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">
                        ${c.author}
                    </span>
                    <span style="font-size: 0.8rem; color: #8892b0; font-weight: bold;">B${index + 1}</span>
                </div>
                <div style="color: #444; font-size: 0.95rem; line-height: 1.5; padding-left: 32px; white-space: pre-wrap;">
                    ${c.text}
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;
}

window.openPostDetail = function(id) {
    const p = posts.find(x => String(x.id) === String(id));
    if (!p) return;

    currentOpenPostId = id;

    // 更新燈箱文字
    const tagBoards = document.querySelectorAll('#detail-board-tag');
    if (tagBoards.length > 0) tagBoards[tagBoards.length - 1].innerText = p.board;
    
    const tagAuthors = document.querySelectorAll('#detail-author-tag');
    if (tagAuthors.length > 0) tagAuthors[tagAuthors.length - 1].innerText = p.author || '匿名';
    
    const titleEls = document.querySelectorAll('#detail-post-title');
    if (titleEls.length > 0) titleEls[titleEls.length - 1].innerText = p.title;
    
    const contentEls = document.querySelectorAll('#detail-post-content');
    if (contentEls.length > 0) contentEls[contentEls.length - 1].innerText = p.desc;

    renderComments(id);

    const modals = document.querySelectorAll('#post-detail-modal');
    if (modals.length > 0) modals[modals.length - 1].style.display = 'block';
};

window.submitComment = function() {
    // 抓取畫面上真正的輸入框
    const inputs = document.querySelectorAll('#new-comment-input');
    const input = inputs[inputs.length - 1];
    
    if (!input) return;
    
    const text = input.value.trim();

    if (!text) {
        alert("請輸入留言內容！");
        return;
    }

    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
        alert("請先登入才能留言喔！");
        return;
    }

    const newComment = {
        author: user.name || '用戶',
        avatar: user.avatar || 'images/fish_logo.png',
        text: text
    };

    saveComment(currentOpenPostId, newComment);
    input.value = '';
    
    renderComments(currentOpenPostId);

    const p = posts.find(x => String(x.id) === String(currentOpenPostId));
    if (p) {
        p.msgs = getComments(currentOpenPostId).length;
        applyFilters(); 
    }

    const modals = document.querySelectorAll('#post-detail-modal .modal-content');
    if (modals.length > 0) {
        const targetModal = modals[modals.length - 1];
        targetModal.scrollTo({ top: targetModal.scrollHeight, behavior: 'smooth' });
    }
};

window.toggleAction = function(id, actionType, e) {
    e.stopPropagation();
    const p = posts.find(x => String(x.id) === String(id));
    if (p) {
        if (actionType === 'like') p.liked ? (p.likes--, p.liked=false) : (p.likes++, p.liked=true);
        else if (actionType === 'save') p.saved = !p.saved;
        applyFilters();
    }
}

// ----------------------------------------------------
// 🚀 初始化與事件綁定
// ----------------------------------------------------
function setupAuth() {
    const userProfile = document.getElementById('user-profile');
    const loginTrigger = document.getElementById('login-trigger');
    const identitySelect = document.getElementById('post-identity');
    
    function updateUI() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) {
            if (loginTrigger) loginTrigger.style.display = 'none'; 
            if (userProfile) userProfile.style.display = 'flex';
            const displayName = user.name || (user.email ? user.email.split('@')[0] : '用戶');
            
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) userNameEl.innerText = displayName;
            
            const userAvatarEl = document.getElementById('user-avatar');
            if (user && user.avatar && userAvatarEl) userAvatarEl.src = user.avatar;
            
            if (identitySelect) {
                identitySelect.options[0].text = `實名 (${displayName})`;
                identitySelect.options[0].value = displayName;
            }
        } else {
            if (loginTrigger) loginTrigger.style.display = 'block'; 
            if (userProfile) userProfile.style.display = 'none';
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
    const btnNewPost = document.getElementById('btn-new-post');
    const closePostModal = document.getElementById('close-post-modal');
    
    if (btnNewPost) btnNewPost.onclick = () => document.getElementById('post-modal').style.display='block';
    if (closePostModal) closePostModal.onclick = () => document.getElementById('post-modal').style.display='none';
    
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem("authToken");
            const title = document.getElementById('post-title-input').value;
            const content = document.getElementById('post-content-input').value;
            const identity = document.getElementById('post-identity').value;
            const isAnonymous = identity === "匿名";
            
            const boardValue = document.getElementById('post-board').value;
            const categoryMap = { "綜合閒聊": 1, "程式開發": 2, "美食特搜": 3, "遊戲專區": 4 };
            const selectedCategoryId = categoryMap[boardValue];
            const categoryPayload = selectedCategoryId ? [selectedCategoryId] : [];

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
                        isAnonymous: isAnonymous,
                        category_id: categoryPayload 
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
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('saved.html')) {
        currentView = 'saved';
    } else if (window.location.pathname.includes('post.html')) {
        currentView = 'mine'; 
    } else {
        currentView = 'all';
    }

    setupAuth(); 
    setupNewPost();
    fetchBottles(); 
    
    const searchInput = document.getElementById('main-search-input');
    const historyBox = document.getElementById('search-history-dropdown');
    
    if (searchInput && historyBox) {
        searchInput.oninput = (e) => { 
            currentKeyword = e.target.value.toLowerCase().trim(); 
            applyFilters(); 
        };
        
        searchInput.onfocus = () => {
            renderSearchHistory();
            historyBox.style.display = 'block';
        };
        
        searchInput.onblur = () => {
            setTimeout(() => { historyBox.style.display = 'none'; }, 200);
        };
        
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveSearchHistory(searchInput.value.trim());
                historyBox.style.display = 'none'; 
                searchInput.blur(); 
            }
        };
    }

    // 🟢 貼心功能：在留言框按下 Enter 鍵也能直接送出！
    const commentInputs = document.querySelectorAll('#new-comment-input');
    commentInputs.forEach(input => {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                submitComment();
            }
        };
    });
    
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        currentBoard = e.target.innerText.includes('綜合閒聊') ? '全部' : e.target.innerText.substring(2); 
        applyFilters();
    });
    
    const loginTrigger = document.getElementById('login-trigger');
    if (loginTrigger) {
        loginTrigger.onclick = () => { window.location.href = "login.html"; };
    }

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuBtn && userDropdown) {
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