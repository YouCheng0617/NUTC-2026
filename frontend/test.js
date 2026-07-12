// ✨ 統一設定後端網址
const API_BASE_URL = "https://163.17.135.120";

let posts = [];
let currentKeyword = '';

// 👇 分頁設定與狀態紀錄
let currentPage = 1; 
const POSTS_PER_PAGE = 5; // 設定每頁顯示 5 篇文章

// 🟢 安全讀取：如果有紀錄就讀取，沒紀錄預設就在「綜合閒聊」 (或你的預設看板)
let currentBoard = sessionStorage.getItem('savedBoard') || '綜合閒聊';
let savedCatId = sessionStorage.getItem('savedCategoryId');
let currentCategoryId = savedCatId !== null ? Number(savedCatId) : 1; 

// 🔴 紀錄狀態：'all' (一般), 'saved' (收藏頁), 'mine' (我的文章頁)
let currentView = 'all'; 

// 🌟 看板名稱 -> 後端 categoryId 對照表 (已嚴格對齊 HTML 裡的空格與表情符號！)
const BOARD_CATEGORY_MAP = {
    '😡 極度憤怒中': 1,
    '🤫 沒人懂的秘密': 2,
    '💔 破碎的碎片': 3,
    '😑 極度厭世/躺平': 4,
    '😁 開心的事': 5,
};

// ==========================================
// 🌟 星座自動計算小精靈
// ==========================================
function calculateZodiac(month, day) {
    if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) return "水瓶座";
    if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) return "雙魚座";
    if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) return "牡羊座";
    if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) return "金牛座";
    if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) return "雙子座";
    if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) return "巨蟹座";
    if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) return "獅子座";
    if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) return "處女座";
    if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) return "天秤座";
    if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) return "天蠍座";
    if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) return "射手座";
    if ((month == 12 && day >= 22) || (month == 1 && day <= 19)) return "摩羯座";
    return "未填寫";
}

// 🌊 向後端抓取文章 API (🟢 訪客友善版)
async function fetchBottles() {
    const token = localStorage.getItem("authToken");

    try {
        let endpointUrl = `${API_BASE_URL}/bottles/random`;
        
        // 訪客不能看「我的文章」或「收藏文章」，直接回傳空陣列
        if (currentView === 'mine') {
            if (!token) { renderPosts([]); return; }
            endpointUrl = `${API_BASE_URL}/bottles/mybottles`;
        } else if (currentView === 'saved') {
            if (!token) { renderPosts([]); return; }
            endpointUrl = `${API_BASE_URL}/bottles/saved`;
        } else if (currentCategoryId !== null) {
            endpointUrl = `${API_BASE_URL}/bottles/random?categoryId=${currentCategoryId}`;
        }

        let likedBottleIds = [];
        let savedBottleIds = [];
        
        if (token) {
            try {
                const likedRes = await fetch(`${API_BASE_URL}/bottles/liked`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } });
                if (likedRes.ok) {
                    const likedData = await likedRes.json();
                    let arr = likedData.bottles || likedData.data || likedData;
                    if (Array.isArray(arr)) likedBottleIds = arr.map(i => String(i.bottle_id || i.id || i.bottleId));
                }
            } catch (e) { console.log('偷偷抓取按讚清單失敗'); }

            try {
                const savedRes = await fetch(`${API_BASE_URL}/bottles/saved`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } });
                if (savedRes.ok) {
                    const savedData = await savedRes.json();
                    let arr = savedData.bottles || savedData.data || savedData;
                    if (Array.isArray(arr)) savedBottleIds = arr.map(i => String(i.bottle_id || i.id || i.bottleId));
                }
            } catch (e) { console.log('偷偷抓取收藏清單失敗'); }
        }

        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: headers
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
            } else if (backendData.mybottles && Array.isArray(backendData.mybottles)) { 
                postsArray = backendData.mybottles;
            } else if (backendData.result && Array.isArray(backendData.result)) { 
                postsArray = backendData.result;
            }

            posts = postsArray.map(rawItem => {
                const item = rawItem.bottle || rawItem.Bottle || rawItem;
                const safeId = String(item.bottle_id || item.id || item.bottleId || rawItem.bottle_id || `temp_${Math.random().toString(36).substr(2, 9)}`);

                let isActuallyLiked = likedBottleIds.includes(safeId) || Boolean(item.is_liked || item.isLiked || rawItem.is_liked);
                let isActuallySaved = savedBottleIds.includes(safeId) || Boolean(item.is_saved || item.isSaved || rawItem.is_saved);

                if (currentView === 'saved') isActuallySaved = true;

                let totalLikes = parseInt(item.like_count || item.likeCount || item.likes || item.view_count || rawItem.like_count || 0, 10);
                if (isActuallyLiked && totalLikes === 0) totalLikes = 1;

                let authorName = "用戶";
                if (typeof item.author === 'string') authorName = item.author;
                else if (item.author?.name) authorName = item.author.name;
                else if (item.author_name) authorName = item.author_name;
                else if (item.user?.name) authorName = item.user.name;
                else if (item.username) authorName = item.username;
                else if (item.User?.name) authorName = item.User.name;
                else if (typeof rawItem.author === 'string') authorName = rawItem.author;
                else if (rawItem.author?.name) authorName = rawItem.author.name;
                else if (rawItem.user?.name) authorName = rawItem.user.name;
                else if (rawItem.User?.name) authorName = rawItem.User.name;
                else if (rawItem.member?.name) authorName = rawItem.member.name;
                else if (item.member?.name) authorName = item.member.name;
                else if (item.member_name) authorName = item.member_name;
                else if (rawItem.member_name) authorName = rawItem.member_name;

                if (authorName === "用戶" && currentView === 'mine') {
                    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    authorName = currentUser.name || "用戶";
                }

                let rawBoard = item.category_name || item.board || null;

                if (!rawBoard && item.category_list && Array.isArray(item.category_list) && item.category_list.length > 0) {
                    rawBoard = item.category_list[0];
                }

                if (!rawBoard && item.categories && item.categories.length > 0) {
                    rawBoard = item.categories[0].category?.name;
                } else if (!rawBoard && rawItem.categories && rawItem.categories.length > 0) {
                    rawBoard = rawItem.categories[0].category?.name;
                }

                // 🌟 終極五大海域辨識邏輯
                let finalBoard = "😑 極度厭世/躺平";
                let cId = item.category_id || rawItem.category_id || item.categoryId;

                if (!rawBoard && item.categories && item.categories.length > 0) {
                    cId = item.categories[0].category_id;
                }

                if (rawBoard) {
                    if (rawBoard.includes("憤怒")) finalBoard = "😡 極度憤怒中";
                    else if (rawBoard.includes("秘密")) finalBoard = "🤫 沒人懂的秘密";
                    else if (rawBoard.includes("破碎")) finalBoard = "💔 破碎的碎片";
                    else if (rawBoard.includes("厭世") || rawBoard.includes("躺平")) finalBoard = "😑 極度厭世/躺平";
                    else if (rawBoard.includes("開心")) finalBoard = "😁 開心的事"; 
                    else finalBoard = rawBoard;
                }
                else if (cId !== undefined && cId !== null) {
                    const idToBoard = { 
                        1: "😡 極度憤怒中", 
                        2: "🤫 沒人懂的秘密", 
                        3: "💔 破碎的碎片", 
                        4: "😑 極度厭世/躺平",
                        5: "😁 開心的事" 
                    };
                    if (Array.isArray(cId) && cId.length > 0) {
                        finalBoard = idToBoard[cId[0]] || finalBoard;
                    } else if (!Array.isArray(cId)) {
                        finalBoard = idToBoard[cId] || finalBoard;
                    }
                }

                return {
                    id: safeId,
                    board: finalBoard,
                    author: (item.is_anonymous || item.isAnonymous) ? "匿名" : authorName,
                    title: item.title || rawItem.title,
                    desc: item.content || rawItem.content,
                    likes: totalLikes,
                    msgs: getComments(safeId).length,
                    liked: isActuallyLiked,
                    saved: isActuallySaved
                };
            });

            applyFilters();
      } else if (response.status === 404) {
        console.log(`🌊 該海域 (Category ${currentCategoryId}) 目前還沒有漂流瓶`);
        posts = []; 
        applyFilters(); 
    } else {
        console.error("獲取文章失敗，狀態碼:", response.status);
        posts = []; 
        applyFilters(); 
    }
} catch (error) {     
    console.error("連線錯誤:", error);
}                    
}                    
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// ==========================================
// 🖨️ 渲染文章與切換分頁核心
// ==========================================
function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    const pageContainer = document.getElementById('pagination-container');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">目前這個海域空空的，快來拋出你的第一個漂流瓶吧！🌊</h3>`;
        if (pageContainer) pageContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(data.length / POSTS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    const pageData = data.slice(startIndex, endIndex);
    
    container.innerHTML = pageData.map(p => `
        <div class="post-card" onclick="openPostDetail('${escapeHTML(String(p.id))}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${escapeHTML(p.board)}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${escapeHTML(p.author)}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${escapeHTML(p.title)}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(p.desc)}</p>
            <div class="action-bar">
                <span class="action-btn ${p.liked ? 'like-active' : ''}" onclick="toggleAction('${escapeHTML(String(p.id))}', 'like', event)">${p.liked ? '❤️' : '🤍'} ${p.likes}</span>
                <span class="action-btn">💬 ${p.msgs}</span>
                
                <div style="margin-left: auto; display: flex; gap: 15px;">
                    <span class="action-btn ${p.saved ? 'save-active' : ''}" onclick="toggleAction('${escapeHTML(String(p.id))}', 'save', event)">${p.saved ? '⭐ 已收藏' : '☆ 收藏'}</span>
                    
                    ${currentView === 'mine' ? `<span class="action-btn" style="color: #ff4d4d;" onclick="deleteMyBottle('${escapeHTML(String(p.id))}', event)">🗑️ 刪除</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    renderPagination(totalPages, data);
}

function applyFilters() {
    let res = posts;

    if (currentView === 'saved') {
        res = res.filter(p => p.saved === true);
    } else if (currentView === 'mine') {
    } else {
        res = res.filter(p => p.board.includes(currentBoard));
    }

    if (currentKeyword) {
        res = res.filter(p =>
            (p.title && p.title.toLowerCase().includes(currentKeyword)) ||
            (p.desc && p.desc.toLowerCase().includes(currentKeyword)) ||
            (p.board && p.board.toLowerCase().includes(currentKeyword)) ||
            (p.author && p.author.toLowerCase().includes(currentKeyword)) 
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
    const searchInput = document.getElementById('main-search-input');
    if (!historyBox || !searchInput) return;

    let history = getSearchHistory();
    const currentText = searchInput.value.trim().toLowerCase();
    
    if (currentText !== '') {
        history = history.filter(item => item.toLowerCase().includes(currentText));
    }

    if (history.length === 0) {
        historyBox.style.display = 'none';
        return;
    }

    let html = '';
    history.forEach(item => {
        html += `
            <div class="history-item" onmousedown="applyHistorySearch(event, '${item}')">
                <span>${item}</span>
                <span class="delete-history-btn" onmousedown="removeSingleHistory(event, '${item}')">&times;</span>
            </div>
        `;
    });
    
    historyBox.innerHTML = html;
    historyBox.style.display = 'block';
}

window.applyHistorySearch = function (e, keyword) {
    if (e) e.preventDefault();
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) searchInput.value = keyword;
    currentKeyword = keyword.toLowerCase();
    applyFilters();
    document.getElementById('search-history-dropdown').style.display = 'none';
}

window.removeSingleHistory = function (e, keyword) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    let history = getSearchHistory();
    history = history.filter(item => item !== keyword);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderSearchHistory();
}

// ----------------------------------------------------
// 📝 留言系統與文章切換功能 
// ----------------------------------------------------
let currentOpenPostId = null;

function getComments(postId) {
    if (!postId) return [];
    try {
        let allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
        if (typeof allComments !== 'object' || Array.isArray(allComments)) allComments = {};
        return allComments[postId] || [];
    } catch (e) { return []; }
}

function saveComment(postId, commentObj) {
    if (!postId) return;
    try {
        let allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
        if (typeof allComments !== 'object' || Array.isArray(allComments)) allComments = {};
        if (!allComments[postId]) allComments[postId] = [];
        allComments[postId].push(commentObj);
        localStorage.setItem('postComments', JSON.stringify(allComments));
    } catch (e) { console.error("儲存留言時發生錯誤", e); }
}

window.toggleCommentLike = function (postId, index) {
    try {
        let allComments = JSON.parse(localStorage.getItem('postComments') || '{}');
        if (!allComments[postId] || !allComments[postId][index]) return;
        let c = allComments[postId][index];

        if (c.liked) {
            c.likes = Math.max(0, (c.likes || 1) - 1);
            c.liked = false;
        } else {
            c.likes = (c.likes || 0) + 1;
            c.liked = true;
        }
        localStorage.setItem('postComments', JSON.stringify(allComments));
        renderComments(postId);
    } catch (error) { console.error("按讚處理失敗", error); }
}

function renderComments(postId) {
    const comments = getComments(postId);
    const lists = document.querySelectorAll('#detail-comments-list');
    const counts = document.querySelectorAll('#detail-comment-count');
    
    lists.forEach(listContainer => {
        if (!listContainer) return;
        if (comments.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#888; padding: 30px 0;">目前還沒有留言喔，來搶頭香吧！🐟</div>';
            return;
        }

        let html = '';
        comments.forEach((c, index) => {
            const likesCount = c.likes || 0;
            const isLiked = c.liked || false;

            html += `
                <div style="background: #fff; padding: 24px 0; border-bottom: 1px solid #f0f0f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center;">
                        <span style="font-size: 1rem; font-weight: bold; color: #333; display: flex; align-items: center; gap: 12px;">
                            <img src="${c.avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                            ${escapeHTML(c.author)}
                        </span>
                        <span style="font-size: 0.85rem; color: #aaa; font-weight: bold;">B${index + 1}</span>
                    </div>
                    <div style="color: #222; font-size: 1.05rem; line-height: 1.7; padding-left: 48px; white-space: pre-wrap; margin-bottom: 10px;">${escapeHTML(c.text)}</div>
                    
                    <div style="text-align: right; padding-right: 15px;">
                        <span style="cursor: pointer; color: ${isLiked ? '#e74c3c' : '#999'}; font-size: 0.95rem; user-select: none; transition: 0.2s;" onclick="toggleCommentLike('${postId}', ${index})">
                            ${isLiked ? '❤️' : '🤍'} ${likesCount}
                        </span>
                    </div>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    });

    counts.forEach(countSpan => { if (countSpan) countSpan.innerText = comments.length; });
}

window.openPostDetail = function (id) {
    const p = posts.find(x => String(x.id) === String(id));
    if (!p) return;
    currentOpenPostId = id;

    document.querySelectorAll('#detail-board-tag').forEach(el => el.innerText = p.board);
    document.querySelectorAll('#detail-author-tag').forEach(el => el.innerText = p.author || '匿名');
    document.querySelectorAll('#detail-post-title').forEach(el => el.innerText = p.title);
    document.querySelectorAll('#detail-post-content').forEach(el => el.innerText = p.desc);

    renderComments(id);

    // 👇 就是這裡！幫星星按鈕接上真正的收藏魔法 👇
    const saveBtn = document.getElementById('save-bottle-btn');
    if (saveBtn) {
        // 1. 打開文章時，先檢查是不是已經收藏過了，是的話就讓星星亮起來
        if (p.saved) {
            saveBtn.classList.add('active');
        } else {
            saveBtn.classList.remove('active');
        }

        // 2. 蓋掉原本只有視覺效果的點擊事件，換成會呼叫後端 API 的版本！
        saveBtn.onclick = (e) => {
            saveBtn.classList.toggle('active'); // 立刻給寶寶切換星星顏色的視覺回饋
            toggleAction(id, 'save', e);        // 呼叫原本寫好的 API 把資料存進資料庫！
        };
    }
    // 👆 就是這裡！幫星星按鈕接上真正的收藏魔法 👆

    const feedView = document.getElementById('feed-view');
    const detailView = document.getElementById('detail-view');
    const sidebar = document.querySelector('.sidebar');
    const oceanBtn = document.querySelector('.ocean-refresh-btn');

    if (feedView && detailView) {
        feedView.style.display = 'none';
        detailView.style.display = 'block';
        if(sidebar) sidebar.style.setProperty('display', 'none', 'important');
        if(oceanBtn) oceanBtn.style.setProperty('display', 'none', 'important');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.closePostDetail = function () {
    const feedView = document.getElementById('feed-view');
    const detailView = document.getElementById('detail-view');
    const sidebar = document.querySelector('.sidebar');
    const oceanBtn = document.querySelector('.ocean-refresh-btn');

    if (feedView && detailView) {
        detailView.style.display = 'none';
        feedView.style.display = 'block';
        if(sidebar) sidebar.style.setProperty('display', 'block', 'important');
        if(oceanBtn) oceanBtn.style.setProperty('display', 'block', 'important');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.submitComment = function () {
    const inputs = document.querySelectorAll('#new-comment-input');
    let targetInput = null;
    
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].offsetParent !== null) { targetInput = inputs[i]; break; }
    }
    
    if (!targetInput) return;
    const text = targetInput.value.trim();

    if (!text) { alert("請輸入留言內容！"); return; }

    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) { alert("請先登入才能留言喔！"); return; }

    const newComment = {
        author: user.name || '用戶',
        avatar: user.avatar || 'images/fish_logo.png',
        text: text,
        likes: 0,
        liked: false
    };
    
    saveComment(currentOpenPostId, newComment);

    setTimeout(() => {
        inputs.forEach(inp => inp.value = '');
        if (targetInput) targetInput.value = '';
    }, 50);
    
    renderComments(currentOpenPostId);

    const p = posts.find(x => String(x.id) === String(currentOpenPostId));
    if (p) { p.msgs = getComments(currentOpenPostId).length; applyFilters(); }

    const detailView = document.getElementById('detail-view');
    if (detailView && detailView.offsetParent !== null) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
        document.querySelectorAll('#post-detail-modal .modal-content').forEach(modal => {
            if (modal.offsetParent !== null) modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' });
        });
    }
};

window.toggleAction = async function (id, actionType, e) {
    e.stopPropagation();
    const token = localStorage.getItem("authToken");
    
    if (!token) {
        alert("請先登入才能操作喔！");
        window.location.href = 'login.html'; 
        return;
    }

    const p = posts.find(x => String(x.id) === String(id));
    if (!p) return;
    
    if (actionType === 'like') {
        if (p.liked) {
            p.likes = Math.max(0, p.likes - 1);
            p.liked = false;
        } else {
            p.likes++;
            p.liked = true;
        }
    } else if (actionType === 'save') { p.saved = !p.saved; }
    
    applyFilters();

    try {
        const endpoint = actionType === 'like' ? `/bottles/${id}/like` : `/bottles/${id}/save`;
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        if (!response.ok) throw new Error(`後端回傳錯誤碼: ${response.status}`);
    } catch (error) {
        console.error(`${actionType} 動作失敗:`, error);
        
        if (actionType === 'like') {
            if (p.liked) { p.likes = Math.max(0, p.likes - 1); p.liked = false; }
            else { p.likes++; p.liked = true; }
        } else if (actionType === 'save') { p.saved = !p.saved; }
        
        applyFilters();
        alert("伺服器開小差了，操作失敗請稍後再試 😢");
    }
}

window.deleteMyBottle = async function (id, e) {
    e.stopPropagation(); 
    if (!confirm("⚠️ 確定要刪除這個漂流瓶嗎？刪除後無法恢復喔！")) return;

    const token = localStorage.getItem("authToken");
    if (!token) { alert("請先登入！"); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/bottles/${id}/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            alert("✅ 漂流瓶已成功刪除！");
            fetchBottles();
        } else {
            const err = await response.json();
            alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤"));
        }
    } catch (error) {
        console.error("刪除失敗:", error);
        alert("伺服器連線失敗，請稍後再試 😢");
    }
}

function setupAuth() {
    const userProfile = document.getElementById('user-profile');
    const loginTrigger = document.getElementById('login-trigger');
    const identitySelect = document.getElementById('post-identity');
    const userDropdown = document.getElementById('user-dropdown');

    function updateUI() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const token = localStorage.getItem('authToken');

        if (user && Object.keys(user).length > 0 && token) {
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

            if (user.role === 'ADMIN' && userDropdown) {
                if (!document.getElementById('admin-link-item')) {
                    const adminLink = document.createElement('div');
                    adminLink.id = 'admin-link-item';
                    adminLink.className = 'menu-item';
                    adminLink.style.color = '#e74c3c';
                    adminLink.style.fontWeight = 'bold';
                    adminLink.style.borderTop = '1px solid #eee';
                    adminLink.innerHTML = '🛠️ 進入後台';
                    
                    adminLink.onclick = (e) => { e.stopPropagation(); window.location.href = 'admin.html'; };
                    userDropdown.insertBefore(adminLink, userDropdown.lastElementChild);
                }
                const btnNewPost = document.getElementById('btn-new-post');
                if (btnNewPost) btnNewPost.style.display = 'none';
                
                const savedMenuItem = document.querySelector('.menu-item[onclick*="saved.html"]');
                const postMenuItem = document.querySelector('.menu-item[onclick*="post.html"]');
                
                if (savedMenuItem) savedMenuItem.style.display = 'none';
                if (postMenuItem) postMenuItem.style.display = 'none';
            } else {
                const btnNewPost = document.getElementById('btn-new-post');
                if (btnNewPost) btnNewPost.style.display = 'block'; 
                
                const savedMenuItem = document.querySelector('.menu-item[onclick*="saved.html"]');
                const postMenuItem = document.querySelector('.menu-item[onclick*="post.html"]');
                
                if (savedMenuItem) savedMenuItem.style.display = 'block';
                if (postMenuItem) postMenuItem.style.display = 'block';
            }
        } else {
            if (loginTrigger) loginTrigger.style.display = 'block';
            if (userProfile) userProfile.style.display = 'none';
            const btnNewPost = document.getElementById('btn-new-post');
            if (btnNewPost) btnNewPost.style.display = 'block';
        }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
            updateUI();
            window.location.href = "login.html"; 
        };
    }
    updateUI();
}

function setupNewPost() {
    const form = document.getElementById('new-post-form');
    const btnNewPost = document.getElementById('btn-new-post');
    const closePostModal = document.getElementById('close-post-modal');
    
    if (btnNewPost) {
        btnNewPost.onclick = () => {
            const token = localStorage.getItem("authToken");
            if (!token) {
                alert("請先登入才能發文喔！");
                window.location.href = "login.html"; 
                return;
            }
            document.getElementById('post-modal').style.display = 'block';
        }
    }
    
    if (closePostModal) closePostModal.onclick = () => document.getElementById('post-modal').style.display = 'none';
    
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const token = localStorage.getItem("authToken");
            if (!token) { alert("請先登入才能拋出漂流瓶！"); return; }

            const title = document.getElementById('post-title-input').value;
            const content = document.getElementById('post-content-input').value;
            const identity = document.getElementById('post-identity').value;
            const isAnonymous = identity === "匿名";

            const boardSelect = form.querySelector('#post-board');
            const boardValue = boardSelect ? boardSelect.value : "";
            const selectedCategoryId = Number(boardValue);
            const categoryPayload = (boardValue !== "" && !isNaN(selectedCategoryId)) ? [selectedCategoryId] : [];

            if (categoryPayload.length === 0) { alert("發文失敗：請確實選擇一個海域 (分類)！"); return; }

            const postData = {
                title: title,
                content: content,
                isAnonymous: isAnonymous,
                category_id: categoryPayload
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/bottles`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify(postData)
                });
                
                if (response.ok) {
                    alert('漂流瓶拋出成功！🎉');
                    form.reset();
                    document.getElementById('post-modal').style.display = 'none';
                    fetchBottles();
                } else {
                    const err = await response.json();
                    alert(`發文失敗 (狀態碼: ${response.status})：\n${err.message || '未知錯誤'}`);
                }
            } catch (error) {
                console.error("連線錯誤:", error);
                alert('無法連線至伺服器，請檢查網路或後端是否啟動。');
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('saved.html')) {
        currentView = 'saved';
        currentPage = 1; 
    } else if (window.location.pathname.includes('post.html')) {
        currentView = 'mine';
        currentPage = 1; 
    } else {
        currentView = 'all';
    }

    document.querySelectorAll('.sidebar li').forEach(li => {
        li.classList.remove('active'); 
        const liText = li.innerText.trim();
        if (liText.includes(currentBoard)) { li.classList.add('active'); }
    });

    setupAuth();
    setupNewPost();
    fetchBottles(); 

    const searchInput = document.getElementById('main-search-input');
    const historyBox = document.getElementById('search-history-dropdown');

    if (searchInput && historyBox) {
        searchInput.oninput = (e) => {
            currentKeyword = e.target.value.toLowerCase().trim();
            currentPage = 1; 
            applyFilters();
            renderSearchHistory();
            historyBox.style.width = searchInput.offsetWidth + 'px';
            historyBox.style.left = searchInput.offsetLeft + 'px';
        };
        searchInput.onfocus = () => {
            renderSearchHistory();
            historyBox.style.width = searchInput.offsetWidth + 'px';
            historyBox.style.left = searchInput.offsetLeft + 'px';
        };
        searchInput.onblur = () => { setTimeout(() => { historyBox.style.display = 'none'; }, 200); };
        searchInput.onkeydown = (e) => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') {
                saveSearchHistory(searchInput.value.trim());
                historyBox.style.display = 'none';
                searchInput.blur();
            }
        };
    }

    const commentInputs = document.querySelectorAll('#new-comment-input');
    commentInputs.forEach(input => {
        input.setAttribute('name', 'user_comment_history');
        input.setAttribute('autocomplete', 'off');
        const wrapper = input.parentElement;
        
        if (wrapper && wrapper.tagName.toLowerCase() === 'div' && wrapper.classList.contains('comment-action-bar')) {
            const form = document.createElement('form');
            form.style.cssText = wrapper.style.cssText;
            
            form.className = wrapper.className; 
            
            form.onsubmit = (e) => { e.preventDefault(); submitComment(); };
            while (wrapper.firstChild) { form.appendChild(wrapper.firstChild); }
            wrapper.parentNode.replaceChild(form, wrapper);
            
            const btn = form.querySelector('.send-btn');
            if (btn) { btn.type = 'submit'; btn.removeAttribute('onclick'); }
        }
    });
    
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');

        const liText = e.target.innerText.trim();
        currentBoard = liText.substring(2).trim();
        currentCategoryId = BOARD_CATEGORY_MAP[liText] || 1;

        currentPage = 1; 

        sessionStorage.setItem('savedCategoryId', currentCategoryId);
        sessionStorage.setItem('savedBoard', currentBoard);

        closePostDetail();
        fetchBottles();
    });
    
    const loginTrigger = document.getElementById('login-trigger');
    if (loginTrigger) loginTrigger.onclick = () => { window.location.href = "login.html"; };

    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.onclick = (e) => { e.stopPropagation(); userDropdown.classList.toggle('show-dropdown'); };
    }
    document.addEventListener('click', () => { if (userDropdown) userDropdown.classList.remove('show-dropdown'); });

    const profileModal = document.getElementById('profile-modal');
    const profileMenuItem = document.getElementById('open-profile');

    if (profileMenuItem) {
        profileMenuItem.onclick = (e) => {
            e.stopPropagation();
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user) {
                // 已移除頭像載入程式碼
                document.getElementById('detail-name').innerText = user.name || '未設定姓名';
                document.getElementById('detail-email').innerText = user.email;
                document.getElementById('detail-birthday').innerText = user.birthday ? user.birthday.split('T')[0] : '未填寫';
                document.getElementById('detail-gender').innerText = user.gender || '未填寫';
                document.getElementById('detail-zodiac').innerText = user.zodiac || user.constellation || '未填寫';
                document.getElementById('detail-bio').innerText = user.bio || '這瓶子裡目前空空的...';
                
                document.getElementById('profile-view-mode').style.display = 'block';
                document.getElementById('profile-edit-mode').style.display = 'none';

                profileModal.style.display = 'block';
            } else { alert('請先登入！'); }
        };
    }

    const btnEditProfile = document.getElementById('btn-edit-profile');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnSaveProfile = document.getElementById('btn-save-profile');
    
    const editBirthdayInput = document.getElementById('edit-birthday');
    const editZodiacSelect = document.getElementById('edit-zodiac');

    if (editBirthdayInput && editZodiacSelect) {
        editBirthdayInput.addEventListener('change', (e) => {
            const dateStr = e.target.value;
            if (dateStr) {
                const dateObj = new Date(dateStr);
                const month = dateObj.getMonth() + 1;
                const day = dateObj.getDate();
                editZodiacSelect.value = calculateZodiac(month, day);
            }
        });
    }

    if (btnEditProfile) {
        btnEditProfile.onclick = () => {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (!user) return;
            
            document.getElementById('edit-name').value = user.name || '';
            document.getElementById('edit-email').value = user.email || '';
            document.getElementById('edit-birthday').value = user.birthday ? user.birthday.split('T')[0] : '';
            document.getElementById('edit-gender').value = user.gender || '未填寫';
            document.getElementById('edit-zodiac').value = user.zodiac || user.constellation || '未填寫';
            document.getElementById('edit-bio').value = user.bio || '';

            document.getElementById('profile-view-mode').style.display = 'none';
            document.getElementById('profile-edit-mode').style.display = 'block';
        };
    }

    if (btnCancelEdit) {
        btnCancelEdit.onclick = () => {
            document.getElementById('profile-edit-mode').style.display = 'none';
            document.getElementById('profile-view-mode').style.display = 'block';
        };
    }

    if (btnSaveProfile) {
        btnSaveProfile.onclick = async () => {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (!user) return;

            const newName = document.getElementById('edit-name').value.trim();
            if (!newName) {
                alert("寶寶，姓名不能空白唷！");
                return;
            }

            user.name = newName;
            user.birthday = document.getElementById('edit-birthday').value;
            user.gender = document.getElementById('edit-gender').value;
            user.zodiac = document.getElementById('edit-zodiac').value;
            user.constellation = user.zodiac; 
            user.bio = document.getElementById('edit-bio').value.trim();

            const token = localStorage.getItem("authToken");

            try {
                fetch(`${API_BASE_URL}/auth/update-data`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        name: user.name,
                        birthday: user.birthday,
                        constellation: user.zodiac,
                        bio: user.bio
                    })
                }).catch(e => console.log('API 更新稍有延遲，優先更新本地顯示', e));
                
                localStorage.setItem('currentUser', JSON.stringify(user));

                document.getElementById('detail-name').innerText = user.name;
                document.getElementById('detail-birthday').innerText = user.birthday || '未填寫';
                document.getElementById('detail-gender').innerText = user.gender || '未填寫';
                document.getElementById('detail-zodiac').innerText = user.zodiac || '未填寫';
                document.getElementById('detail-bio').innerText = user.bio || '這瓶子裡目前空空的...';
                
                const userNameEl = document.getElementById('user-name');
                if (userNameEl) userNameEl.innerText = user.name;

                document.getElementById('profile-edit-mode').style.display = 'none';
                document.getElementById('profile-view-mode').style.display = 'block';

                alert("🎉 資料修改成功！");

            } catch (error) {
                console.error("更新發生錯誤", error);
                alert("哎呀，好像出了一點小錯，請再試一次喔！");
            }
        };
    }

    const detailModals = document.querySelectorAll('#post-detail-modal');
    const closeDetailBtns = document.querySelectorAll('#close-detail-modal');
    const closeProfileBtn = document.getElementById('close-profile-modal');

    if (closeProfileBtn) closeProfileBtn.onclick = () => profileModal.style.display = 'none';
    closeDetailBtns.forEach(btn => { btn.onclick = () => { detailModals.forEach(m => m.style.display = 'none'); }; });
    
    window.onclick = (event) => {
        const postModal = document.getElementById('post-modal');
        if (profileModal && event.target == profileModal) profileModal.style.display = 'none';
        if (postModal && event.target == postModal) postModal.style.display = 'none';
        detailModals.forEach(m => { if (event.target == m) m.style.display = 'none'; });
    };
});

// 已移除頭像變更事件監聽器

// 呼喚海流：專屬寶寶的換瓶子特效
window.callOceanCurrent = function() {
    const bottles = document.querySelectorAll('.post-card');
    bottles.forEach((bottle, index) => {
        setTimeout(() => { bottle.classList.add('swept-away'); }, index * 100); 
    });
    setTimeout(() => { fetchBottles(); }, 1000);
}

// ==========================================
// 🚀 產生分頁按鈕的函數
// ==========================================
function renderPagination(totalPages, dataArray) {
    const pageContainer = document.getElementById('pagination-container');
    if (!pageContainer) return;
    
    pageContainer.innerHTML = ''; 
    if (totalPages <= 1) return;  

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerText = '◀';
    prevBtn.disabled = (currentPage === 1);
    prevBtn.onclick = () => {
        currentPage--;
        renderPosts(dataArray);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    pageContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.innerText = i;
        pageBtn.onclick = () => {
            currentPage = i;
            renderPosts(dataArray);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        pageContainer.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerText = '▶';
    nextBtn.disabled = (currentPage === totalPages);
    nextBtn.onclick = () => {
        currentPage++;
        renderPosts(dataArray);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    pageContainer.appendChild(nextBtn);
}