// ==========================================
// 第 1 部分：我們的「文章置物櫃」 (資料庫)
// ==========================================
// 這裡用一個陣列 (像是一大排置物櫃) 把文章一篇一篇存起來。
// 每一篇文章都有自己的專屬編號 (id)、看板分類、標題、內容、愛心數。
let posts = [
    {
        id: 1,
        board: "💻 程式開發",
        title: "為什麼 2026 年大家還在學 HTML?",
        desc: "雖然 AI 寫程式很快，但理解底層結構還是超級重要，大家覺得呢？",
        likes: 520,
        msgs: 88,
        liked: false // 記錄你是不是已經點過愛心了 (false 代表還沒)
    },
    {
        id: 2,
        board: "🍜 美食特搜",
        title: "巷弄內超驚人的拉麵店！",
        desc: "今天在台北車站附近發現一家沒人排隊但湯頭超濃郁的店，真的不想分享出來...",
        likes: 1250,
        msgs: 432,
        liked: false
    },
    {
        id: 3,
        board: "🎮 遊戲專區",
        title: "這款獨立遊戲也太燒腦了吧",
        desc: "玩了三個小時還在第一關，到底是我的問題還是設計師的問題？",
        likes: 42,
        msgs: 15,
        liked: false
    }
];

// ==========================================
// 第 2 部分：記住你目前的「搜尋條件」
// ==========================================
let currentKeyword = '';   // 記住你在上方搜尋框打了什麼字
let currentBoard = '全部'; // 記住你在左邊選了哪一個看板

// ==========================================
// 第 3 部分：把文章「畫」到網頁上的機器 (渲染函數)
// ==========================================
// 這個機器的任務很簡單：你給它文章資料，它就把文章變成網頁看得到的卡片。
function renderPosts(dataToRender = posts) {
    // 找到網頁中間那個要放文章的空白區塊
    const container = document.getElementById('post-container');
    if(!container) return; // 如果找不到區塊，就停止工作

    // 如果你搜尋的東西找不到任何文章，就顯示哭臉提示
    if (dataToRender.length === 0) {
        container.innerHTML = `<h3 style="text-align:center; color:#707d9a; margin-top: 50px;">找不到相關文章 😢</h3>`;
        return;
    }

    // 把資料庫裡的文章，一篇一篇套進 HTML 的卡片設計圖裡
    const postHTML = dataToRender.map(post => `
        <div class="post-card" onclick="goToArticle(${post.id})">
            <div class="post-meta">${post.board}</div>
            <h2 class="post-title">${post.title}</h2>
            <p class="post-content">${post.desc}</p>
            <div style="font-size: 0.95rem; color: #707d9a; margin-top: 15px; display: flex; gap: 15px;">
                <div class="like-btn" onclick="toggleLike(${post.id}, event)" 
                     style="color: ${post.liked ? '#ff4d4d' : '#707d9a'};">
                    ${post.liked ? '❤️' : '🤍'} ${post.likes}
                </div>
                <div>💬 ${post.msgs}</div>
            </div>
        </div>
    `).join('');

    // 把做好的所有卡片，一口氣貼到網頁上！
    container.innerHTML = postHTML;
}

// ==========================================
// 第 4 部分：超級過濾器 (篩選文章)
// ==========================================
// 當你打字搜尋或點擊看板時，這個過濾器就會啟動，把不符合的文章剔除。
function applyFilters() {
    let filtered = posts; // 先把所有文章拿在手上

    // 第一關：檢查你選了什麼看板。如果不是選「全部」，就只留下你選的那個看板的文章。
    if (currentBoard !== '全部') {
        filtered = filtered.filter(post => post.board.includes(currentBoard));
    }

    // 第二關：檢查你有沒有打字搜尋。如果有，就比對文章標題或內容有沒有這個字。
    if (currentKeyword) {
        filtered = filtered.filter(post => 
            post.title.toLowerCase().includes(currentKeyword) || 
            post.desc.toLowerCase().includes(currentKeyword)
        );
    }

    // 把過濾完留下來的文章，交給「畫文章的機器」重新畫在畫面上
    renderPosts(filtered);
}

// ==========================================
// 第 5 部分：點擊卡片跳轉文章的動作
// ==========================================
window.goToArticle = function(id) {
    // 暫時先跳出一個警告視窗，告訴你「本來應該要跳轉了喔」
    alert(`這會跳轉到 article.html?id=${id}`);
};

// ==========================================
// 第 6 部分：按讚愛心的動作
// ==========================================
window.toggleLike = function(id, event) {
    // 【重要魔法】：阻止事件冒泡！
    // 因為愛心放在卡片裡面，點愛心會不小心連「點擊卡片跳轉」一起觸發。
    // 加上這行，就像告訴瀏覽器：「我只有點愛心，不要理外面的卡片！」
    event.stopPropagation(); 
    
    // 從置物櫃(資料庫)裡找出你點擊的那篇文章
    const targetPost = posts.find(p => p.id === id);
    if (targetPost) {
        if (targetPost.liked) {
            // 如果已經按過讚了 -> 收回讚 (數字減 1，狀態變回 false)
            targetPost.likes -= 1;
            targetPost.liked = false;
        } else {
            // 如果還沒按過讚 -> 給讚 (數字加 1，狀態變成 true)
            targetPost.likes += 1;
            targetPost.liked = true;
        }
        // 按完讚之後，呼叫超級過濾器重新整理畫面，讓你看到變紅的愛心
        applyFilters(); 
    }
};

// ==========================================
// 第 7 部分：裝上「監聽器」 (讓網頁隨時注意你的動作)
// ==========================================

// 監聽器 A：隨時注意你有沒有在「搜尋框」打字
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentKeyword = e.target.value.toLowerCase().trim(); // 把你打的字記下來
            applyFilters(); // 呼叫超級過濾器開始工作
        });
    }
}

// 監聽器 B：隨時注意你有沒有點擊「左側看板」
function setupSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // 先把所有列表項目的發光顏色關掉
            sidebarItems.forEach(li => li.style.color = '');
            // 把你剛剛點擊的那個項目加上藍色發光效果
            e.target.style.color = '#00f2ff'; 

            const text = e.target.innerText;
            if (text.includes('綜合閒聊')) {
                currentBoard = '全部';
            } else {
                currentBoard = text.substring(2).trim(); // 把前面的表情符號切掉，只留文字
            }
            
            applyFilters(); // 呼叫超級過濾器開始工作
        });
    });
}

// 監聽器 C：隨時注意你有沒有點擊「登入按鈕」
function setupLoginModal() {
    const modal = document.getElementById("login-modal");
    const loginTrigger = document.getElementById("login-trigger");
    const closeBtn = document.getElementById("close-modal");

    if (loginTrigger && modal) {
        loginTrigger.onclick = () => modal.style.display = "block"; // 點按鈕打開彈窗
        closeBtn.onclick = () => modal.style.display = "none";      // 點叉叉關閉彈窗
        window.onclick = (event) => {
            // 如果點擊彈窗外面的黑色背景，也把彈窗關閉
            if (event.target == modal) modal.style.display = "none";
        };
    }
}

// ==========================================
// 第 8 部分：網頁一打開要做的第一件事
// ==========================================
// 當整個網頁都載入完畢後，把上面所有的機器和監聽器全部啟動！
document.addEventListener('DOMContentLoaded', () => {
    renderPosts();      // 啟動畫文章機器
    setupSearch();      // 啟動搜尋監聽器
    setupSidebar();     // 啟動看板監聽器
    setupLoginModal();  // 啟動登入視窗監聽器
});