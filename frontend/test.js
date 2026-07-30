// ✨ 統一設定後端網址
const API_BASE_URL = "https://api.drift-bottles.xyz";

let posts = [];
let currentKeyword = '';
let currentAuthorId = null; // 🌟 新增：用來記住目前正在看哪位作者的文章！

// 👇 分頁設定與狀態紀錄
let currentPage = 1;
const POSTS_PER_PAGE = 6; 

// 🌟 一進來就看到全海域！
let currentBoard = sessionStorage.getItem('savedBoard') || '全海域';
let savedCatId = sessionStorage.getItem('savedCategoryId');
// 注意：sessionStorage 存的 null 會變成字串 'null'，所以要防呆一下
let currentCategoryId = (savedCatId !== null && savedCatId !== 'null') ? Number(savedCatId) : null;

let currentView = 'all';

const BOARD_CATEGORY_MAP = {
    '🌊 全海域': null, // ✨ 這裡是新加入的！null 代表不帶 categoryId 請求
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
            endpointUrl = `${API_BASE_URL}/bottles/search?keyword=${currentKeyword}`;
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
    } 
    // ✨ 魔法在這裡：如果是全海域，我們就直接放行所有瓶子！
    else if (!currentKeyword && currentBoard !== '全海域') {
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

                        // 🌟 魔法：打撈子留言！
                        const replies = c.replies || c.children || c.subComments || [];
                        let repliesHtml = '';
                        
                        if (replies.length > 0) {
                            replies.forEach(reply => {
                                const rAuthor = reply.isAnonymous ? "匿名" : (reply.member?.name || reply.author_name || reply.author?.name || '匿名');
                                const rContent = reply.content || reply.text || '';
                                const rAvatar = reply.avatar || 'images/fish_logo.png';
                                
                                repliesHtml += `
                                    <div class="ocean-reply-item">
                                        <div class="reply-header">
                                            <img src="${rAvatar}" class="reply-avatar">
                                            <span class="reply-author">${escapeHTML(rAuthor)}</span>
                                        </div>
                                        <div class="reply-body">${escapeHTML(rContent)}</div>
                                    </div>
                                `;
                            });
                        }

                        html += `
                            <div class="ocean-comment-card">
                                <div class="comment-header">
                                    <span class="comment-author">
                                        <img src="${avatar}" class="comment-avatar">
                                        ${escapeHTML(authorName)}
                                    </span>
                                    <span class="comment-floor">B${index + 1}</span>
                                </div>
                                <div class="comment-body">${escapeHTML(content)}</div>
                                
                                <!-- 🌟 這裡是蓋好的子留言展示區塊 -->
                                <div class="reply-container" style="${repliesHtml ? '' : 'display: none;'}">
                                    ${repliesHtml}
                                </div>
                                
                                <!-- 動作區塊加上回覆按鈕 -->
                                <div class="comment-actions">
                                    <span class="action-btn reply-trigger" onclick="toggleReplyBox('${commentId}')">
                                        💬 回覆
                                    </span>
                                    <span id="comment-like-btn-${commentId}" class="action-btn like-trigger" style="color: ${isLiked ? '#e74c3c' : '#999'};" onclick="toggleCommentLike('${postId}', '${commentId}')">
                                        ${isLiked ? '❤️' : '🤍'} ${likesCount}
                                    </span>
                                </div>

                                <!-- 專屬子留言輸入框 -->
                                <div id="reply-box-${commentId}" class="reply-input-box" style="display: none;">
                                    <div class="reply-input-wrapper">
                                        <input type="text" id="reply-input-${commentId}" placeholder="偷偷回覆他一點溫暖..." class="custom-reply-input" autocomplete="off">
                                        <label class="anon-label">
                                            <input type="checkbox" id="reply-anon-${commentId}"> 🎭 匿名
                                        </label>
                                        <button onclick="submitReply('${postId}', '${commentId}')" class="send-btn mini-send-btn">送出</button>
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
// 🌟 抓取「專屬這則回覆」的匿名選項有沒有被打勾
const isAnon = document.getElementById(`reply-anon-${parentId}`)?.checked || false;
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
fetchNotificationCount(); // 🔔 登入後去跟後端要通知數量
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
        currentBoard = liText.substring(2).trim(); // 這樣「🌊 全海域」切出來就會剛好是「全海域」
        
        // ✨ 精準抓取 Map 裡的值，如果是全海域就會乖乖變成 null，不會報錯！
        currentCategoryId = BOARD_CATEGORY_MAP[liText] !== undefined ? BOARD_CATEGORY_MAP[liText] : 1;
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
    const mascotContainer = document.createElement('div');
    mascotContainer.id = 'svg-mermecat-mascot';
    mascotContainer.title = '點擊我去找 AI 小助理聊天！';

    mascotContainer.innerHTML = `
        <div class="svg-mermecat-wrapper">
            <svg width="130" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .line { stroke: #1a4c6d; stroke-width: 3.5; stroke-linejoin: round; stroke-linecap: round; }
                    .tail { fill: #7ac2c4; }
                    .fin { fill: #50b4ba; }
                    .cat { fill: #fcfdfe; }
                    .red-line { stroke: #b83e33; stroke-width: 3.5; stroke-linecap: round; fill: none; }
                    .blush { fill: #ffbaba; }
                    .bubble { fill: #e0f2f5; stroke: #1a4c6d; stroke-width: 2.5; }
                    .dolphin-body { fill: #9bcbf1; } 
                    .cat-paw { fill: #fcfdfe; }     
                    @keyframes paw-wave {
                        0% { transform: rotate(0deg); }
                        20% { transform: rotate(-12deg); }
                        40% { transform: rotate(8deg); }
                        60% { transform: rotate(-10deg); }
                        80% { transform: rotate(6deg); }
                        100% { transform: rotate(0deg); }
                    }
                    .wave-animation {
                        animation: paw-wave 1.8s infinite ease-in-out;
                        transform-origin: 75px 48px; 
                    }
                </style>
                <circle cx="15" cy="25" r="4.5" class="bubble"><animate attributeName="cy" values="25;20;25" dur="3s" repeatCount="indefinite"/></circle>
                <circle cx="22" cy="40" r="2.5" class="bubble"><animate attributeName="cy" values="40;36;40" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="85" cy="80" r="3.5" class="bubble"><animate attributeName="cy" values="80;75;80" dur="4s" repeatCount="indefinite"/></circle>
                <path d="M 25 75 C 5 70 5 95 18 95 C 15 105 35 100 35 85 Z" class="fin line">
                     <animateTransform attributeName="transform" type="rotate" values="-3 25 85; 3 25 85; -3 25 85" dur="3s" repeatCount="indefinite"/>
                </path>
                <path d="M 20 50 C 15 95 85 95 80 50 Z" class="tail line"/>
                <path d="M 32 65 Q 40 72 48 65 M 52 65 Q 60 72 68 65 M 42 75 Q 50 82 58 75" fill="none" stroke="#1a4c6d" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                <path d="M 22 55 C 20 28 25 25 35 25 L 38 12 L 46 22 L 54 22 L 62 12 L 65 25 C 75 25 80 28 78 55 Z" class="cat line"/>
                <circle cx="38" cy="40" r="4.5" fill="#1a4c6d"/>
                <circle cx="62" cy="40" r="4.5" fill="#1a4c6d"/>
                <ellipse cx="28" cy="44" rx="4.5" ry="3" class="blush"/>
                <ellipse cx="72" cy="44" rx="4.5" ry="3" class="blush"/>
                <path d="M 46 43 Q 50 47 54 43" class="red-line"/>
                <g id="cute-dolphin" transform="translate(33, 46) scale(1.1)">
                    <path d="M 28 16 C 27 12, 25 9, 21 9 C 17 9, 14 5, 13 3 C 12 6, 13 8, 10 10 C 6 12, 3 16, 2 20 C 1 23, 0 26, 1 26 C 3 25, 4 23, 5 22 C 6 24, 8 26, 9 25 C 8 22, 10 20, 11 19 C 16 21, 23 20, 28 16 Z" class="dolphin-body line"/>
                    <path d="M 27.5 16.5 C 22 20, 15 20, 11.5 18.5 C 15 16, 22 15, 27.5 15 Z" fill="#ffffff" stroke="none"/>
                    <path d="M 18 18 C 16 23, 14 25, 16 26 C 18 25, 19 22, 20 18 Z" class="dolphin-body line"/>
                    <circle cx="23" cy="14" r="1.3" fill="#1a4c6d" stroke="none" />
                </g>
                <path d="M 26 63 C 30 67, 36 69, 41 67 C 43 66, 42 62, 39 62 C 35 62, 30 62, 26 62 Z" class="cat-paw line"/>
                <g class="wave-animation">
                    <path d="M 76 48 C 82 45, 85 38, 85 32 C 85 27, 78 27, 76 34 C 75 38, 75 42, 76 48 Z" class="cat-paw line"/>
                    <path d="M 88 28 Q 91 31 89 34" fill="none" stroke="#1a4c6d" stroke-width="2" stroke-linecap="round"/>
                    <path d="M 91 24 Q 95 28 92 32" fill="none" stroke="#1a4c6d" stroke-width="2" stroke-linecap="round"/>
                </g>
            </svg>
            <div class="cute-dialogue" id="mermecat-dialogue"></div>
        </div>
    `;

    document.body.appendChild(mascotContainer);

    const mascotStyle = document.createElement('style');
    mascotStyle.innerHTML = `
        #svg-mermecat-mascot {
            position: fixed; z-index: 99999; width: 130px; height: 140px; cursor: pointer; user-select: none; pointer-events: auto;
            transform: none;
            filter: drop-shadow(0 6px 15px rgba(0, 30, 60, 0.25)); transition: top 8s ease-in-out, left 8s ease-in-out;
        }
        .svg-mermecat-wrapper { position: relative; width: 100%; height: 100%; animation: svg-float 4s infinite alternate ease-in-out; }
        @keyframes svg-float { 0% { transform: translateY(0px) rotate(-1deg); } 100% { transform: translateY(-8px) rotate(1deg); } }
        .cute-dialogue {
            position: absolute; bottom: calc(100% - 5px); left: 50%; transform: translateX(-50%) scale(0.8);
            width: max-content; max-width: 180px; background: #fff; color: #1a4c6d; padding: 10px 16px;
            border: 3.5px solid #1a4c6d; border-radius: 18px; font-size: 0.95rem; font-weight: bold;
            opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            z-index: 10000; box-shadow: 2px 4px 0px rgba(26, 76, 109, 0.15); 
        }
        .cute-dialogue.show-dialogue { opacity: 1; visibility: visible; transform: translateX(-50%) scale(1); }
    `;
    document.head.appendChild(mascotStyle);

    const mascot = document.getElementById('svg-mermecat-mascot');
    const AI_ASSISTANT_URL = "./chat_ui/chat.html";
    let currentZone = 0;
    let swimTimer;
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function swimLikeLazyMermaid() {
        const padding = 20;
        const borderThickness = 120;
        const w = window.innerWidth - 130;
        const h = window.innerHeight - 140;

        let targetX, targetY;
        if (currentZone === 0) { targetX = Math.random() * w; targetY = padding + Math.random() * (borderThickness - 50); }
        else if (currentZone === 1) { targetX = w - padding - Math.random() * (borderThickness - 50); targetY = Math.random() * h; }
        else if (currentZone === 2) { targetX = Math.random() * w; targetY = h - padding - Math.random() * (borderThickness - 50); }
        else { targetX = padding + Math.random() * (borderThickness - 50); targetY = Math.random() * h; }

        mascot.style.left = targetX + 'px';
        mascot.style.top = targetY + 'px';

        if (Math.random() > 0.1) currentZone = (currentZone + 1) % 4;

        const duration = 8000 + Math.random() * 4000;
        mascot.style.transition = `top ${duration}ms ease-in-out, left ${duration}ms ease-in-out`;
        swimTimer = setTimeout(swimLikeLazyMermaid, duration);
    }
    swimTimer = setTimeout(swimLikeLazyMermaid, 100);

    const randomPhrases = [
        "🌊 咕嚕咕嚕... 今天的水溫好舒服喵！", "🤫 有什麼秘密想跟我說嗎？", "✏️ 把不開心的事丟進瓶子裡吧！", "🎵 好像有很多有趣的瓶子呢！",
        "💖 今天過得好嗎？", "❔開發者團隊們都不知道我是什麼物種呢!", "今天心情像冒泡泡一樣開心！", "耶！水溫剛剛好，心情也剛剛好！",
        "看到你就覺得好溫暖喵～", "今天的海流超順，運氣一定很好！", "呼嚕呼嚕...這是我開心的聲音。", "快樂到想在水裡翻三個跟斗！"
    ];
    const dialogueBox = document.getElementById('mermecat-dialogue');
    let dialogueTimer;

    function showRandomDialogue() {
        if (dialogueBox.classList.contains('show-dialogue')) return;
        dialogueBox.innerText = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
        dialogueBox.classList.add('show-dialogue');
        clearTimeout(dialogueTimer);
        dialogueTimer = setTimeout(() => { dialogueBox.classList.remove('show-dialogue'); }, 4000);
    }
    setTimeout(showRandomDialogue, 2000);
    setInterval(() => { if (Math.random() > 0.2) showRandomDialogue(); }, 8000 + Math.random() * 6000);

    const startDrag = (clientX, clientY) => {
        isDragging = true;
        hasMoved = false;

        // 先保留畫面上的即時位置，再切斷游泳動畫，避免抓取瞬間跳到動畫終點。
        const currentPosition = mascot.getBoundingClientRect();
        clearTimeout(swimTimer);
        mascot.style.transition = 'none';
        mascot.style.left = `${currentPosition.left}px`;
        mascot.style.top = `${currentPosition.top}px`;

        startX = clientX;
        startY = clientY;
        initialLeft = currentPosition.left;
        initialTop = currentPosition.top;
    };

    const onDrag = (clientX, clientY) => {
        if (!isDragging) return;
        hasMoved = true;

        const dx = clientX - startX;
        const dy = clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // 防撞牆：left/top 是吉祥物左上角座標，限制整隻吉祥物留在視窗內。
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - mascot.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - mascot.offsetHeight));

        mascot.style.left = `${newLeft}px`;
        mascot.style.top = `${newTop}px`;

        // 拖曳時根據左右移動來翻轉臉的方向
        const mascotImage = mascot.querySelector('svg');
        if (mascotImage && dx !== 0) {
            mascotImage.style.transform = dx < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }
    };

    const stopDrag = () => {
        if (isDragging) {
            isDragging = false;
            // 🌟 鬆手後立刻呼叫游泳函數，讓牠立刻開始往新方向游！
            swimLikeLazyMermaid();
        }
    };

    // 🖱️ 滑鼠事件
    mascot.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => onDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', stopDrag);

    // 📱 手機觸控事件
    mascot.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) {
            e.preventDefault(); // 防止滾動整個網頁
            onDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // 🫧 雙擊頁面空白處，讓吉祥物游到使用者指定的位置。
    document.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target instanceof Element && target.closest(
            'a, button, input, textarea, select, label, [role="button"], #svg-mermecat-mascot'
        )) {
            return;
        }

        clearTimeout(swimTimer);

        const targetLeft = Math.max(
            0,
            Math.min(e.clientX - mascot.offsetWidth / 2, window.innerWidth - mascot.offsetWidth)
        );
        const targetTop = Math.max(
            0,
            Math.min(e.clientY - mascot.offsetHeight / 2, window.innerHeight - mascot.offsetHeight)
        );

        mascot.style.transition = 'top 1.2s ease-out, left 1.2s ease-out';
        mascot.style.left = `${targetLeft}px`;
        mascot.style.top = `${targetTop}px`;

        // 抵達後停留一下，再恢復原本的自動漫遊。
        swimTimer = setTimeout(swimLikeLazyMermaid, 3000);
    });

    // 🚀 防止拖曳完不小心觸發跳轉，只有真的「單純點擊」才會去 AI 助手頁面
    mascot.addEventListener('click', (e) => {
        if (hasMoved) {
            e.preventDefault();
            return;
        }
        window.location.href = AI_ASSISTANT_URL;
    });

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

    // 🌟 神奇魔法陣：在撈熱門文章前，先偷偷翻一下寶寶的包包，看看收藏過、按讚過哪些瓶子！
    let likedBottleIds = [];
    let savedBottleIds = [];

    if (token) {
        try {
            const likedRes = await fetch(`${API_BASE_URL}/bottles/liked`, { method: 'GET', headers });
            if (likedRes.ok) {
                const likedData = await likedRes.json();
                let arr = likedData.bottles || likedData.data || likedData;
                if (Array.isArray(arr)) likedBottleIds = arr.map(i => String(i.bottle_id || i.id || i.bottleId));
            }
        } catch (e) {}

        try {
            const savedRes = await fetch(`${API_BASE_URL}/bottles/saved`, { method: 'GET', headers });
            if (savedRes.ok) {
                const savedData = await savedRes.json();
                let arr = savedData.bottles || savedData.data || savedData;
                if (Array.isArray(arr)) savedBottleIds = arr.map(i => String(i.bottle_id || i.id || i.bottleId));
            }
        } catch (e) {}
    }

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

      // 🌟 魔法防護罩：建立熱門快取，防止被主海域的資料覆蓋導致點不到！
      if (!window.popularCache) window.popularCache = [];

      // 🌟 動態修復 openPostDetail，讓它可以去快取找文章
      if (!window.hasPatchedOpenDetail) {
          const originalOpen = window.openPostDetail;
          window.openPostDetail = function(id) {
              if (!posts.some(p => String(p.id) === String(id))) {
                  const cachedPost = window.popularCache.find(p => String(p.id) === String(id));
                  if (cachedPost) posts.push(cachedPost); 
              }
              originalOpen(id);
          };
          window.hasPatchedOpenDetail = true;
      }

      listContainer.innerHTML = popularArray.slice(0, 6).map((rawItem, index) => {
          const item = rawItem.bottle || rawItem.Bottle || rawItem;
          const safeId = String(item.bottle_id || item.id || item.bottleId || rawItem.id || rawItem.bottle_id || "temp");
          const title = item.title || rawItem.title || "無標題貼文";
          
          let author = "用戶";
          if (item.is_anonymous || item.isAnonymous) {
              author = "匿名";
          } else {
              if (typeof item.author === 'string') author = item.author;
              else if (item.author?.name) author = item.author.name;
              else if (item.author_name) author = item.author_name;
              else if (item.user?.name) author = item.user.name;
              else if (item.username) author = item.username;
              else if (item.User?.name) author = item.User.name;
              else if (typeof rawItem.author === 'string') author = rawItem.author;
              else if (rawItem.author?.name) author = rawItem.author.name;
              else if (rawItem.user?.name) author = rawItem.user.name;
              else if (rawItem.User?.name) author = rawItem.User.name;
              else if (rawItem.member?.name) author = rawItem.member.name;
              else if (item.member?.name) author = item.member.name;
              else if (item.member_name) author = item.member_name;
              else if (rawItem.member_name) author = rawItem.member_name;
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

          let boardName = "😑 極度厭世/躺平"; 
          let cId = item.category_id || rawItem.category_id || item.categoryId;
          if (!rawBoard && item.categories && item.categories.length > 0) cId = item.categories[0].category_id;

          const idToBoard = { 1: "😡 極度憤怒中", 2: "🤫 沒人懂的秘密", 3: "💔 破碎的碎片", 4: "😑 極度厭世/躺平", 5: "😁 開心的事" };

          if (rawBoard) {
              if (rawBoard.includes("憤怒")) boardName = "😡 極度憤怒中";
              else if (rawBoard.includes("秘密")) boardName = "🤫 沒人懂的秘密";
              else if (rawBoard.includes("破碎")) boardName = "💔 破碎的碎片";
              else if (rawBoard.includes("厭世") || rawBoard.includes("躺平")) boardName = "😑 極度厭世/躺平";
              else if (rawBoard.includes("開心")) boardName = "😁 開心的事";
              else boardName = rawBoard;
          } else if (cId !== undefined && cId !== null) {
              if (Array.isArray(cId) && cId.length > 0) boardName = idToBoard[cId[0]] || boardName;
              else if (!Array.isArray(cId)) boardName = idToBoard[cId] || boardName;
          }

          const savesCount = parseInt(item.save_count || item.saveCount || item.saves || 0, 10);

          // 🌟 終極記憶恢復：核對這篇文章有沒有在寶寶的清單裡！
          let isActuallyLiked = likedBottleIds.includes(safeId) || Boolean(item.is_liked || item.isLiked);
          let isActuallySaved = savedBottleIds.includes(safeId) || Boolean(item.is_saved || item.isSaved);

          const postObj = {
              id: safeId,
              board: boardName,
              author: author,
              authorId: item.author_id || item.user_id || item.member_id || null,
              title: title,
              desc: item.content || rawItem.content || "",
              likes: parseInt(item.like_count || item.likeCount || item.likes || 0, 10),
              msgs: item.comment_count || item.comments?.length || 0,
              liked: isActuallyLiked, // 寫入真實按讚狀態
              saved: isActuallySaved, // 寫入真實收藏狀態
              createdAt: item.createdAt || item.created_at || rawItem.createdAt || rawItem.created_at
          };
          
          if (!window.popularCache.some(p => String(p.id) === safeId)) window.popularCache.push(postObj);
          if (!posts.some(p => String(p.id) === safeId)) posts.push(postObj);

          return `
          <div class="popular-item-card" onclick="openPostDetail('${safeId}')">
            <div class="popular-item-title">👑 TOP ${index + 1}: ${escapeHTML(title)}</div>
            <div class="popular-item-meta" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
              <span style="color: #4da6ff; flex-shrink: 0;">[${escapeHTML(boardName)}]</span>
              <span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">👤 ${escapeHTML(author)}</span>
              <span style="flex-shrink: 0; margin-left: auto;">⭐ ${savesCount}</span>
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
// =========================================
// 🔔 抓取未讀通知數量的功能
// =========================================
async function fetchNotificationCount() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/unread`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true' 
            }
        });

        if (response.ok) {
            const data = await response.json();
            // 如果後端回傳屬性不是 count，記得稍微修改這裡喔
            const unreadCount = data.count || 0; 
            const badge = document.getElementById('notification-badge');
            
            if (badge) {
                if (unreadCount > 0) {
                    badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error("撈取通知數量失敗:", error);
    }
}
