// ✨ 統一設定後端網址
const API_BASE_URL = "https://163.17.135.120";

let posts = [];
let currentKeyword = '';

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

        const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpointUrl, { method: 'GET', headers: headers });
        if (response.ok) {
            const backendData = await response.json();
            let postsArray = backendData.bottles || backendData || backendData.data || [];
            if (backendData.data?.result) postsArray = backendData.data.result;
            if (backendData.mybottles) postsArray = backendData.mybottles;
            if (backendData.result) postsArray = backendData.result;

            posts = postsArray.map(rawItem => {
                const item = rawItem.bottle || rawItem.Bottle || rawItem;
                const safeId = String(item.bottle_id || item.id || item.bottleId || rawItem.bottle_id || `temp_${Math.random().toString(36).substr(2, 9)}`);
                let isActuallyLiked = likedBottleIds.includes(safeId);
                let isActuallySaved = savedBottleIds.includes(safeId);
                if (currentView === 'saved') isActuallySaved = true;
                let totalLikes = parseInt(item.like_count || 0, 10);

                let authorName = item.author_name || item.username || "用戶";
                let rawBoard = item.category_name || item.board || "綜合閒聊";
                return {
                    id: safeId, board: rawBoard, author: item.isAnonymous ? "匿名" : authorName,
                    title: item.title, desc: item.content, likes: totalLikes, msgs: getComments(safeId).length, liked: isActuallyLiked, saved: isActuallySaved
                };
            });
            applyFilters();
      } else { posts = []; applyFilters(); }
    } catch (error) { posts = []; applyFilters(); }
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

function renderPosts(data = posts) {
    const container = document.getElementById('post-container');
    if (!container) return;
    if (!data || data.length === 0) {
        container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">目前這個海域空空的，快來拋出你的第一個漂流瓶吧！🌊</h3>`; return;
    }
    const totalPages = Math.ceil(data.length / POSTS_PER_PAGE);
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const pageData = data.slice(startIndex, startIndex + POSTS_PER_PAGE);
    
    container.innerHTML = pageData.map(p => `
        <div class="post-card" onclick="openPostDetail('${escapeHTML(String(p.id))}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${escapeHTML(p.board)}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${escapeHTML(p.author)}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${escapeHTML(p.title)}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(p.desc)}</p>
        </div>
    `).join('');
    renderPagination(totalPages, data);
}

function applyFilters() {
    let res = posts;
    if (currentView === 'saved') res = res.filter(p => p.saved);
    if (currentKeyword) res = res.filter(p => p.title.toLowerCase().includes(currentKeyword));
    renderPosts(res);
}

function getComments(postId) { return []; }

window.closePostDetail = function () {
    const feedView = document.getElementById('feed-view');
    const detailView = document.getElementById('detail-view');
    if (feedView && detailView) { detailView.style.display = 'none'; feedView.style.display = 'block'; }
};

document.addEventListener('DOMContentLoaded', () => {
    setupAuth(); setupNewPost(); fetchBottles();
    
    document.querySelectorAll('.sidebar li').forEach(li => li.onclick = (e) => {
        const liText = e.target.innerText.trim();
        currentBoard = liText;
        fetchBottles();
    });
});

function setupAuth() {} function setupNewPost() {} function renderPagination() {}

// =========================================================================
// ⭐ 原創海星寶寶 全螢幕降速防擋深海演算法
// =========================================================================

const MASCOT_QUOTES = [
    "寶寶，今天有什麼心事想跟海星寶寶說說嗎？⭐",
    "咕嚕咕嚕... 我在海底看到好多閃亮的瓶子喔！🌊",
    "不開心的時候，海星給你一個軟綿綿的擁抱！💖",
    "點點我，帶你去找聰明的 AI 小助理唷！✨",
    "我是一顆胖嘟嘟的星星，專門吸收寶寶的煩惱！🌟",
    "累了的話就放鬆飄浮一下下，海浪會溫柔托住寶寶的。😑",
    "看我翻個圓滾滾的跟斗～把壞心情都甩掉！",
    "不管發生什麼事，胖嘟嘟海星都會陪在寶寶身邊的喔！⭐💕"
];

function initStarfishRoaming() {
    const container = document.getElementById('mascot-container');
    const bubble = document.getElementById('mascot-bubble');
    if (!container || !bubble) return;

    let posX = window.innerWidth * 0.8;
    let posY = window.innerHeight * 0.7;
    let targetX = posX;
    let targetY = posY;
    
    const padding = 60;
    const topLimit = 100; 

    function pickNextDestination() {
        const maxX = window.innerWidth - padding - 80;
        const maxY = window.innerHeight - padding - 80;
        
        targetX = Math.max(padding, Math.random() * maxX);
        targetY = Math.max(topLimit, Math.random() * maxY);
        
        // 🌟 延長停留時間，讓牠在同一個地方呆更久再移動
        setTimeout(pickNextDestination, 6000 + Math.random() * 4000);
    }

    function updateFrame() {
        // 🌟 移動速度調降成極慢速 (0.005)，展現海星慢悠悠的慵懶感
        posX += (targetX - posX) * 0.005;
        posY += (targetY - posY) * 0.005;

        container.style.left = `${posX}px`;
        container.style.top = `${posY}px`;

        requestAnimationFrame(updateFrame);
    }

    function mascotSpeak() {
        const randomIndex = Math.floor(Math.random() * MASCOT_QUOTES.length);
        bubble.innerText = MASCOT_QUOTES[randomIndex];
        
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateY(0)';

        setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateY(5px)';
        }, 5000);
    }

    pickNextDestination();
    updateFrame();
    
    setTimeout(mascotSpeak, 2000);
    setInterval(mascotSpeak, 18000);
}

window.openAIAssistant = function() {
    alert("⭐ 嗶嗶啵啵！海星寶寶正在幫寶寶連線到祕密 AI 助理中...（後續串接 Gemini API 專題頁面唷！）");
};

document.addEventListener('DOMContentLoaded', () => {
    initStarfishRoaming();
});
