// ✨ 統一設定後端網址
const API_BASE_URL = "https://api.drift-bottles.xyz";

let posts = [];
let currentKeyword = '';
let currentAuthorId = null; // 🌟 新增：用來記住目前正在看哪位作者的文章！

// 👇 分頁設定與狀態紀錄
let currentPage = 1;
const POSTS_PER_PAGE = 6; 

let currentBoard = sessionStorage.getItem('savedBoard') || '😡 極度憤怒中';
let savedCatId = sessionStorage.getItem('savedCategoryId');
let currentCategoryId = savedCatId !== null ? Number(savedCatId) : 1;

let currentView = 'all';

const BOARD_CATEGORY_MAP = {
    '😡 極度憤怒中': 1,
    '🤫 沒人懂的秘密': 2,
    '💔 破碎的碎片': 3,
    '😑 極度厭世/躺平': 4,
    '😁 開心的事': 5,
};

// =========================================
// 🚀 魔法：防抖與高亮函數
// =========================================
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function highlightText(text, keyword) {
    if (!keyword) return text;
    const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeKeyword})`, 'gi');
    return String(text).replace(regex, '<span class="highlight">$1</span>');
}

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

// 🌊 向後端抓取文章 API
async function fetchBottles() {
    const token = localStorage.getItem("authToken");

    try {
        let endpointUrl = `${API_BASE_URL}/bottles/random`;

        if (currentView === 'mine') {
            if (!token) { renderPosts([]); return; }
            endpointUrl = `${API_BASE_URL}/bottles/mybottles`;
        } else if (currentView === 'saved') {
            if (!token) { renderPosts([]); return; }
            endpointUrl = `${API_BASE_URL}/bottles/saved`;
        } else if (currentKeyword) {
            endpointUrl = `${API_BASE_URL}/bottles/random`;
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
            } catch (e) {}

            try {
                const savedRes = await fetch(`${API_BASE_URL}/bottles/saved`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } });
                if (savedRes.ok) {
                    const savedData = await savedRes.json();
                    let arr = savedData.bottles || savedData.data || savedData;
                    if (Array.isArray(arr)) savedBottleIds = arr.map(i => String(i.bottle_id || i.id || i.bottleId));
                }
            } catch (e) {}
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

                // 🌟 加強版：把後端所有可能藏 ID 的地方都翻一遍！
                let realAuthorId = item.author_id || item.user_id || item.member_id || rawItem.author_id || rawItem.user_id;
                
                if (!realAuthorId && item.author?.id) realAuthorId = item.author.id;
                if (!realAuthorId && item.user?.id) realAuthorId = item.user.id;
                if (!realAuthorId && item.User?.id) realAuthorId = item.User.id;
                if (!realAuthorId && item.member?.id) realAuthorId = item.member.id;
                if (!realAuthorId && rawItem.author?.id) realAuthorId = rawItem.author.id;

                return {
                    id: safeId,
                    board: finalBoard,
                    author: (item.is_anonymous || item.isAnonymous) ? "匿名" : authorName,
                    authorId: realAuthorId || null, // 🌟 換成這行！
                    title: item.title || rawItem.title,
                    desc: item.content || rawItem.content,
                    likes: totalLikes,
                    msgs: item.comment_count || item.comments?.length || 0,
                    liked: isActuallyLiked,
                    saved: isActuallySaved,
                    createdAt: item.createdAt || item.created_at || rawItem.createdAt || rawItem.created_at
                };
            });

            applyFilters();
        } else if (response.status === 404) {
            posts = [];
            applyFilters();
        } else {
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

function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    const pageContainer = document.getElementById('pagination-container');
    if (!container) return;

    if (!data || data.length === 0) {
        if (currentKeyword) {
            container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">喵嗚...翻遍了整片海域，就是找不到包含「${escapeHTML(currentKeyword)}」的瓶子喔！😿</h3>`;
        } else {
            container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">目前這個海域空空的，快來拋出你的第一個漂流瓶吧！🌊</h3>`;
        }
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
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${highlightText(escapeHTML(p.board), currentKeyword)}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${highlightText(escapeHTML(p.author), currentKeyword)}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${highlightText(escapeHTML(p.title), currentKeyword)}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${highlightText(escapeHTML(p.desc), currentKeyword)}</p>
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
    } else if (!currentKeyword) {
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

    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.style.display = keyword ? 'block' : 'none';

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

let currentOpenPostId = null;

// =========================================
// 🚀 留言功能完美接軌後端 API 區
// =========================================

window.renderComments = async function (postId) {
    const lists = document.querySelectorAll('#detail-comments-list');
    const counts = document.querySelectorAll('#detail-comment-count');

    lists.forEach(listContainer => {
        if (listContainer) listContainer.innerHTML = '<div style="text-align:center; color:#888; padding: 30px 0;">潛入海底撈取留言中...🌊</div>';
    });

    try {
        const token = localStorage.getItem("authToken");
        const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/comments/bottles/${postId}`, {
            method: 'GET',
            headers: headers
        });

        let comments = [];
        if (response.ok) {
            const data = await response.json();
            comments = data.comments || data.data || data || [];
        }

        lists.forEach(listContainer => {
            if (!listContainer) return;
            if (comments.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center; color:#888; padding: 30px 0;">目前還沒有留言喔，來搶頭香吧！🐟</div>';
                return;
            }

            let html = '';
            comments.forEach((c, index) => {
                const authorName = c.isAnonymous ? "匿名" : (c.member?.name || c.author_name || c.author?.name || c.user?.name || c.username || c.author || '匿名');
                const likesCount = c.likeCount || c.like_count || c.likes || 0;
                const isLiked = c.isLiked || c.is_liked || c.liked || false;
                const commentId = c.id || c.comment_id || c.commentId || c._id;
                const content = c.content || c.text || '';
                const avatar = c.avatar || 'images/fish_logo.png';

                // 🌟 魔法：打撈子留言！檢查後端有沒有傳回 replies 或 children
                const replies = c.replies || c.children || c.subComments || [];
                let repliesHtml = '';
                
                if (replies.length > 0) {
                    // 用一條淺淺的左邊框把子留言包起來，看起來更有蓋樓的感覺
                    repliesHtml += '<div style="margin-top: 15px; border-left: 3px solid #e0e6ed; padding-left: 15px; display: flex; flex-direction: column; gap: 10px;">';
                    
                    replies.forEach(reply => {
                        const rAuthor = reply.isAnonymous ? "匿名" : (reply.member?.name || reply.author_name || reply.author?.name || '匿名');
                        const rContent = reply.content || reply.text || '';
                        const rAvatar = reply.avatar || 'images/fish_logo.png';
                        
                        repliesHtml += `
                            <div style="background: #f4f7fa; padding: 12px 16px; border-radius: 16px;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <img src="${rAvatar}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                                    <span style="font-size: 0.9rem; font-weight: bold; color: #4da6ff;">${escapeHTML(rAuthor)}</span>
                                </div>
                                <div style="font-size: 0.95rem; color: #333; line-height: 1.5; white-space: pre-wrap;">${escapeHTML(rContent)}</div>
                            </div>
                        `;
                    });
                    
                    repliesHtml += '</div>';
                }

                html += `
                    <div style="background: #fff; padding: 24px 0; border-bottom: 1px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; align-items: center;">
                            <span style="font-size: 1rem; font-weight: bold; color: #333; display: flex; align-items: center; gap: 12px;">
                                <img src="${avatar}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                                ${escapeHTML(authorName)}
                            </span>
                            <span style="font-size: 0.85rem; color: #aaa; font-weight: bold;">B${index + 1}</span>
                        </div>
                        <div style="color: #222; font-size: 1.05rem; line-height: 1.7; padding-left: 48px; white-space: pre-wrap; margin-bottom: 10px;">${escapeHTML(content)}</div>
                        
                        <!-- 🌟 這裡是剛剛蓋好的子留言展示區塊 -->
                        <div style="padding-left: 48px;">
                            ${repliesHtml}
                        </div>
                        
                        <!-- 動作區塊加上回覆按鈕 -->
                        <div style="text-align: right; padding-right: 15px; display: flex; justify-content: flex-end; gap: 15px; align-items: center; margin-top: 10px;">
                            <span style="cursor: pointer; color: #4da6ff; font-size: 0.95rem; user-select: none; transition: 0.2s; font-weight: bold;" onclick="toggleReplyBox('${commentId}')">
                                💬 回覆
                            </span>
                            <span id="comment-like-btn-${commentId}" style="cursor: pointer; color: ${isLiked ? '#e74c3c' : '#999'}; font-size: 0.95rem; user-select: none; transition: 0.2s;" onclick="toggleCommentLike('${postId}', '${commentId}')">
                                ${isLiked ? '❤️' : '🤍'} ${likesCount}
                            </span>
                        </div>

                        <!-- 專屬子留言輸入框 -->
                        <div id="reply-box-${commentId}" style="display: none; margin-top: 15px; padding-left: 48px;">
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <input type="text" id="reply-input-${commentId}" placeholder="偷偷回覆他一點溫暖..." class="comment-input" style="flex: 1; min-width: 150px; height: 40px; font-size: 0.95rem; border-radius: 20px; padding: 0 15px; border: 1px solid #dce4ec;" autocomplete="off">
                                <label style="font-size: 0.9rem; color: #6688aa; display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; white-space: nowrap;">
                                    <input type="checkbox" id="reply-anon-${commentId}"> 🎭 匿名
                                </label>
                                <button onclick="submitReply('${postId}', '${commentId}')" class="send-btn" style="height: 40px; padding: 0 18px; font-size: 0.95rem; border-radius: 20px;">送出</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        });

        counts.forEach(countSpan => { if (countSpan) countSpan.innerText = comments.length; });

        const p = posts.find(x => String(x.id) === String(postId));
        if (p) {
            p.msgs = comments.length;
            applyFilters();
        }

    } catch (error) {
        console.error("無法獲取留言:", error);
        lists.forEach(listContainer => {
            listContainer.innerHTML = '<div style="text-align:center; color:#ef4444; padding: 30px 0;">哎呀，讀取留言失敗了，請稍後再試！😿</div>';
        });
    }
}

window.submitComment = async function () {
    const inputs = document.querySelectorAll('#new-comment-input');
    let targetInput = null;

    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].offsetParent !== null) { targetInput = inputs[i]; break; }
    }

    if (!targetInput) return;
    const text = targetInput.value.trim();

    if (!text) { alert("請輸入溫暖的留言內容喔！"); return; }

    const token = localStorage.getItem("authToken");
    if (!token) { alert("寶寶，要先登入才能留言喔！"); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/comments/bottles/${currentOpenPostId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ content: text })
        });

        if (response.ok) {
            targetInput.value = '';
            await renderComments(currentOpenPostId);
            const detailView = document.getElementById('detail-view');
            if (detailView && detailView.offsetParent !== null) {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        } else {
            const err = await response.json();
            alert(`留言失敗：${err.message || '伺服器錯誤'}`);
        }
    } catch (error) {
        console.error("發送留言失敗:", error);
        alert("伺服器連線失敗，請稍後再試 😢");
    }
};
// 🌟 魔法 1：控制回覆框優雅地彈出來
window.toggleReplyBox = function (commentId) {
    const box = document.getElementById(`reply-box-${commentId}`);
    if (box) {
        // 如果原本是隱藏就顯示，如果是顯示就藏起來，就是這麼調皮
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
        
        // 如果打開了，順便貼心地幫寶寶把游標對焦到輸入框
        if (box.style.display === 'block') {
            const input = document.getElementById(`reply-input-${commentId}`);
            if (input) input.focus();
        }
    }
};

// 🌟 魔法 2：發射子留言 API
window.submitReply = async function (bottleId, parentId) {
    const replyInput = document.getElementById(`reply-input-${parentId}`);
    if (!replyInput) return;
    
    const text = replyInput.value.trim();
    if (!text) { 
        alert("寶寶，要先打點字才能回覆別人喔！📝"); 
        return; 
    }
// 🌟 抓取匿名選項有沒有被打勾
   const isAnon = document.getElementById('main-comment-anon')?.checked || false;
    const token = localStorage.getItem("authToken");
    if (!token) { 
        alert("哎呀！要先登入才能回覆喔！"); 
        window.location.href = 'login.html';
        return; 
    }

    try {
        // 🚀 依據給定的 API 格式：POST 給 /comments/bottles/:bottleId/comments/:parentId/reply
        const response = await fetch(`${API_BASE_URL}/comments/bottles/${bottleId}/comments/${parentId}/reply`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ content: text, isAnonymous: isAnon })
        });

        if (response.ok) {
            replyInput.value = ''; // 乖乖清空輸入框
            alert(isAnon ? "✨ 匿名回覆已悄悄送出！" : "✨ 回覆成功傳達囉！");
            // 重新讀取留言列表，讓最新回覆浮出水面
            await renderComments(bottleId); 
        } else {
            const err = await response.json();
            alert(`回覆失敗：${err.message || '深海電波干擾中，請稍後再試'}`);
        }
    } catch (error) {
        console.error("發送子留言失敗:", error);
        alert("伺服器開小差了，回覆失敗請稍後再試 😢");
    }
};
window.toggleCommentLike = async function (postId, commentId) {
    const token = localStorage.getItem("authToken");

    if (!token) {
        alert("寶寶，要先登入才能幫留言按讚喔！");
        window.location.href = 'login.html';
        return;
    }

    if (!commentId || commentId === 'undefined' || commentId === 'null') {
        alert("找不到這則留言的 ID，可能是後端沒有回傳正確的欄位名稱唷 😢");
        return;
    }

    const likeBtn = document.getElementById(`comment-like-btn-${commentId}`);
    let currentLikes = 0;
    let isCurrentlyLiked = false;

    if (likeBtn) {
        const text = likeBtn.innerText;
        isCurrentlyLiked = text.includes('❤️');
        currentLikes = parseInt(text.replace(/[^0-9]/g, '')) || 0;

        if (isCurrentlyLiked) {
            likeBtn.innerHTML = `🤍 ${Math.max(0, currentLikes - 1)}`;
            likeBtn.style.color = '#999';
        } else {
            likeBtn.innerHTML = `❤️ ${currentLikes + 1}`;
            likeBtn.style.color = '#e74c3c';
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}/comments/${commentId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ content: text, isAnonymous: isAnon })
        });

        if (!response.ok) {
            const err = await response.json();
            alert(`按讚失敗：${err.message || '伺服器錯誤'}`);
            if (likeBtn) {
                likeBtn.innerHTML = isCurrentlyLiked ? `❤️ ${currentLikes}` : `🤍 ${currentLikes}`;
                likeBtn.style.color = isCurrentlyLiked ? '#e74c3c' : '#999';
            }
        }
    } catch (error) {
        console.error("留言按讚處理失敗:", error);
        alert("伺服器開小差了，按讚失敗請稍後再試 😢");
        if (likeBtn) {
            likeBtn.innerHTML = isCurrentlyLiked ? `❤️ ${currentLikes}` : `🤍 ${currentLikes}`;
            likeBtn.style.color = isCurrentlyLiked ? '#e74c3c' : '#999';
        }
    }
}
// =========================================

window.openPostDetail = function (id) {
    const p = posts.find(x => String(x.id) === String(id));
    if (!p) return;
    
    currentOpenPostId = id;
    currentAuthorId = p.authorId; // 🌟 魔法在此：打開文章時，把這位作者的 ID 存下來給追蹤功能用！

    document.querySelectorAll('#detail-board-tag').forEach(el => el.innerText = p.board);
    document.querySelectorAll('#detail-author-tag').forEach(el => el.innerText = p.author || '匿名');
    document.querySelectorAll('#detail-post-title').forEach(el => el.innerHTML = highlightText(escapeHTML(p.title), currentKeyword));
    document.querySelectorAll('#detail-post-content').forEach(el => el.innerHTML = highlightText(escapeHTML(p.desc), currentKeyword));

    document.querySelectorAll('.detail-post-time').forEach(el => {
        if (p.createdAt) {
            const date = new Date(p.createdAt);
            el.innerText = date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } else {
            el.innerText = "剛剛發布";
        }
    });

    renderComments(id);

    const saveBtn = document.getElementById('save-bottle-btn');
    if (saveBtn) {
        if (p.saved) {
            saveBtn.classList.add('active');
        } else {
            saveBtn.classList.remove('active');
        }
        saveBtn.onclick = (e) => {
            saveBtn.classList.toggle('active');
            toggleAction(id, 'save', e);
        };
    }

    const feedView = document.getElementById('feed-view');
    const detailView = document.getElementById('detail-view');
    const sidebar = document.querySelector('.sidebar');
    const oceanBtn = document.querySelector('.ocean-refresh-btn');

    if (feedView && detailView) {
        feedView.style.display = 'none';
        detailView.style.display = 'block';
        if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
        if (oceanBtn) oceanBtn.style.setProperty('display', 'none', 'important');
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
        if (sidebar) sidebar.style.setProperty('display', 'block', 'important');
        if (oceanBtn) oceanBtn.style.setProperty('display', 'block', 'important');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.openReportModal = function () {
    const token = localStorage.getItem("authToken");
    if (!token) {
        alert("寶寶，要先登入才能檢舉喔！");
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('report-reason').value = '';
    document.getElementById('report-modal').style.display = 'block';
};

window.closeReportModal = function () {
    document.getElementById('report-modal').style.display = 'none';
};

window.submitReport = async function () {
    const reason = document.getElementById('report-reason').value.trim();
    if (!reason) { alert("請告訴我們檢舉的原因唷！"); return; }

    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/bottles/${currentOpenPostId}/report`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ reason: reason })
        });

        if (response.ok) {
            alert("🚨 檢舉已成功送出，我們會盡快處理！謝謝你的回報！");
            closeReportModal();
        } else {
            const err = await response.json();
            alert(`檢舉失敗：${err.message || '伺服器錯誤'}`);
        }
    } catch (error) {
        console.error("檢舉發生錯誤", error);
        alert("伺服器連線失敗，請稍後再試 😢");
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
    
    setInterval(() => {
        const detailView = document.getElementById('detail-view');
        if (detailView && detailView.style.display !== 'block') {
            callOceanCurrent();
        }
    }, 60000); 
    
    const searchInput = document.getElementById('main-search-input');
    const historyBox = document.getElementById('search-history-dropdown');
    const clearBtn = document.getElementById('clear-search-btn');

    const debouncedSearch = debounce(() => {
        fetchBottles();
    }, 300);

    if (searchInput && historyBox) {
        searchInput.oninput = (e) => {
            currentKeyword = e.target.value.toLowerCase().trim();
            currentPage = 1;
            if (clearBtn) clearBtn.style.display = currentKeyword ? 'block' : 'none';
            debouncedSearch();
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

    if (clearBtn && searchInput) {
        clearBtn.onclick = () => {
            searchInput.value = '';
            currentKeyword = '';
            clearBtn.style.display = 'none';
            currentPage = 1;
            fetchBottles();
            searchInput.focus();
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

    window.onclick = (event) => {
        if (userDropdown) userDropdown.classList.remove('show-dropdown');
        const reportModal = document.getElementById('report-modal');
        if (reportModal && event.target == reportModal) reportModal.style.display = 'none';
        const postModal = document.getElementById('post-modal');
        const profileModal = document.getElementById('profile-modal');
        const followingModal = document.getElementById('following-modal');
        if (profileModal && event.target == profileModal) profileModal.style.display = 'none';
        if (postModal && event.target == postModal) postModal.style.display = 'none';
        if (followingModal && event.target == followingModal) followingModal.style.display = 'none';
    };

    const profileModal = document.getElementById('profile-modal');
    const profileMenuItem = document.getElementById('open-profile');

    if (profileMenuItem) {
        profileMenuItem.onclick = (e) => {
            e.stopPropagation();
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user) {
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
                editZodiacSelect.value = calculateZodiac(dateObj.getMonth() + 1, dateObj.getDate());
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
            if (!newName) { alert("寶寶，姓名不能空白唷！"); return; }

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
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ name: user.name, birthday: user.birthday, constellation: user.zodiac, bio: user.bio })
                }).catch(e => console.log('API 更新稍有延遲', e));

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

    const closeProfileBtn = document.getElementById('close-profile-modal');
    if (closeProfileBtn) closeProfileBtn.onclick = () => profileModal.style.display = 'none';
});

window.callOceanCurrent = function () {
    const bottles = document.querySelectorAll('.post-card');
    bottles.forEach((bottle, index) => {
        setTimeout(() => { bottle.classList.add('swept-away'); }, index * 100);
    });
    setTimeout(() => { fetchBottles(); }, 1000);
}

function renderPagination(totalPages, dataArray) {
    const pageContainer = document.getElementById('pagination-container');
    if (!pageContainer) return;
    pageContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerText = '◀';
    prevBtn.disabled = (currentPage === 1);
    prevBtn.onclick = () => { currentPage--; renderPosts(dataArray); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pageContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.innerText = i;
        pageBtn.onclick = () => { currentPage = i; renderPosts(dataArray); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        pageContainer.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerText = '▶';
    nextBtn.disabled = (currentPage === totalPages);
    nextBtn.onclick = () => { currentPage++; renderPosts(dataArray); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pageContainer.appendChild(nextBtn);
}

document.addEventListener('DOMContentLoaded', () => {
    // 🐾 吉祥物外層容器生成 (這部分保留不變，節省版面)
    fetchPopularBottles();
});

// =========================================
// 📜 深海公約與熱門看板控制器
// =========================================
window.toggleRulesBoard = function () {
  const board = document.getElementById("ocean-rules-board");
  if (!board) return;
  board.classList.toggle("collapsed");
  const isCollapsed = board.classList.contains("collapsed");
  localStorage.setItem("rulesBoardCollapsed", isCollapsed);
};

document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("ocean-rules-board");
  const isCollapsed = localStorage.getItem("rulesBoardCollapsed") === "true";
  if (board && isCollapsed) {
    board.classList.add("collapsed");
  }
});

async function fetchPopularBottles() {
  const listContainer = document.getElementById("popular-posts-list");
  if (!listContainer) return;
  try {
    const token = localStorage.getItem("authToken");
    const headers = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/bottles/popular`, { method: "GET", headers: headers });

    if (response.ok) {
      const data = await response.json();
      let popularArray = [];
      if (Array.isArray(data)) popularArray = data;
      else if (data && Array.isArray(data.bottles)) popularArray = data.bottles;
      else if (data && Array.isArray(data.data)) popularArray = data.data;
      else if (data && Array.isArray(data.result)) popularArray = data.result;

      if (!popularArray || popularArray.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #ccc; padding: 20px 0;">目前海面上還沒有熱門貼文喔！🌊</div>';
        return;
      }
      listContainer.innerHTML = popularArray.slice(0, 6).map((rawItem, index) => {
          const item = rawItem.bottle || rawItem.Bottle || rawItem;
          const safeId = String(item.bottle_id || item.id || item.bottleId || rawItem.id || rawItem.bottle_id || "temp");
          const title = item.title || rawItem.title || "無標題貼文";
          const author = item.is_anonymous || item.isAnonymous ? "匿名" : item.author?.name || item.author_name || item.author || "用戶";
          const likes = parseInt(item.like_count || item.likeCount || item.likes || 0, 10);
          return `
          <div class="popular-item-card" onclick="openPostDetail('${safeId}')">
            <div class="popular-item-title">👑 TOP ${index + 1}: ${escapeHTML(title)}</div>
            <div class="popular-item-meta">
              <span>👤 ${escapeHTML(author)}</span>
              <span>❤️ ${likes}</span>
            </div>
          </div>
        `;
        }).join("");
    } else {
      listContainer.innerHTML = '<div style="text-align: center; color: #ff6b6b; padding: 20px 0;">打撈失敗，海象不佳 😢</div>';
    }
  } catch (error) {
    listContainer.innerHTML = '<div style="text-align: center; color: #ff6b6b; padding: 20px 0;">伺服器連線失敗 😢</div>';
  }
}

// =========================================
// 🫂 追蹤與我的追蹤功能邏輯 (完美乾淨版)
// =========================================

// 1. 切換追蹤 / 取消追蹤作者
window.toggleFollow = async function () {
    const token = localStorage.getItem("authToken");
    const btn = document.getElementById('follow-author-btn');
    const authorName = document.getElementById('detail-author-tag').innerText;

    if (!token) {
        alert("寶寶，請先登入才能追蹤作者喔！");
        return;
    }

    if (authorName === '匿名' || !currentAuthorId) {
        alert("這位作者使用了隱身斗篷，沒辦法追蹤喔！👻");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/follow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ followedId: currentAuthorId })
        });

        if (response.ok) {
            btn.classList.toggle('following');
            if (btn.classList.contains('following')) {
                btn.innerHTML = '<span>已追蹤</span>';
                alert(`成功把 ${authorName} 加入追蹤名單啦！🎉`);
            } else {
                btn.innerHTML = '+ 追蹤';
                alert(`已悄悄取消追蹤 ${authorName} 💔`);
            }
        } else {
            const errData = await response.json();
            alert(`操作失敗：${errData.message || '請稍後再試'}`);
        }
    } catch (error) {
        console.error("追蹤 API 連線錯誤:", error);
        alert("伺服器開小差了，請稍後再試 😢");
    }
};

// 2. 開啟並載入「我的追蹤列表」
window.openFollowingModal = async function () {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('show-dropdown');

    const modal = document.getElementById('following-modal');
    const container = document.getElementById('following-list-container');
    
    modal.style.display = 'block';
    container.innerHTML = '<div style="text-align: center; color: #888; padding: 30px 0;">潛入海底撈取你的追蹤名單中...🌊</div>';

    const token = localStorage.getItem("authToken");
    if (!token) {
        container.innerHTML = '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">寶寶，請先登入才能查看追蹤列表喔！</div>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/following`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            const backendData = await response.json();
            const followingList = backendData.data || backendData; 

            if (!followingList || followingList.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #888; padding: 30px 0;">目前還沒有追蹤任何人喔，快去海域逛逛吧！🐟</div>';
                return;
            }

            container.innerHTML = followingList.map(user => `
                <div class="following-item">
                    <div class="following-info">
                        <img src="${user.avatar || 'images/fish_logo.png'}" class="following-avatar">
                        <span class="following-name">${escapeHTML(user.name || user.username || '神秘海友')}</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">資料讀取失敗，海象不佳 😢</div>';
        }
    } catch (error) {
        console.error("取得追蹤列表連線錯誤:", error);
        container.innerHTML = '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">伺服器連線失敗！</div>';
    }
};

// 3. 關閉追蹤列表彈窗
window.closeFollowingModal = function () {
    const modal = document.getElementById('following-modal');
    if (modal) modal.style.display = 'none';
};