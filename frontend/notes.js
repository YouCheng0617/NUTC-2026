// =========================================
// 🌟 1. 翻譯字典
// =========================================
const i18nNotes = {
    zh: {
        title: "📝 每日便利貼", langBtn: "EN", backBtn: "回到大廳",
        refreshBtn: "🔄 換一批", modalTitle: "📝 寫下今天的便利貼", fabBtn: "✏️ 貼上心事",
        dragHint: "👆 自由滑動 3D 空間，點擊任一張便利貼可居中特寫",
        placeholder: "今天想記錄點什麼呢？...", addBtn: "發佈便利貼",
        empty: "目前海面上還沒有便利貼，趕快來寫第一張吧！🌊",
        errConn: "無法連接到秘密海域伺服器 🌊",
        warnEmpty: "請輸入便利貼內容！", warnLogin: "請先登入才能發佈便利貼！",
        duplicate: "今天已經有寫便利貼了，明天再來吧！",
        success: "發佈成功！已為你貼入海域 ✨", fail: "發送失敗，請檢查網路連線！",
        refreshed: "已為你換上一批新便利貼 🌊"
    },
    en: {
        title: "📝 Daily Notes", langBtn: "中文", backBtn: "Home",
        refreshBtn: "🔄 Refresh", modalTitle: "📝 Write a Daily Note", fabBtn: "✏️ Post Note",
        dragHint: "👆 Drag to explore, click any note to center",
        placeholder: "What's on your mind today?...", addBtn: "Post Note",
        empty: "No notes yet in the ocean. Be the first to write one! 🌊",
        errConn: "Cannot connect to the Secret Ocean server 🌊",
        warnEmpty: "Please enter note content!", warnLogin: "Please login to post a note!",
        duplicate: "You already posted today. Come back tomorrow!",
        success: "Posted successfully! ✨", fail: "Failed to send, please check network!",
        refreshed: "Loaded a new batch of notes 🌊"
    }
};

let currLangNotes = 'zh';

window.allNotesPool = [];   // 資料庫完整資料池
window.activeTenNotes = []; // 當前畫面上展示的便利貼

// 切換語言
window.toggleLang = function () {
    currLangNotes = currLangNotes === 'zh' ? 'en' : 'zh';
    const t = i18nNotes[currLangNotes];

    document.getElementById('page-title').innerText = t.title;
    document.getElementById('btn-lang').innerText = t.langBtn;
    document.getElementById('btn-back').innerText = t.backBtn;
    document.getElementById('btn-refresh').innerText = t.refreshBtn;
    document.getElementById('modal-title').innerText = t.modalTitle;
    document.getElementById('fab-create-btn').innerText = t.fabBtn;
    document.getElementById('drag-hint').innerText = t.dragHint;
    document.getElementById('note-text').placeholder = t.placeholder;
    document.getElementById('add-note-btn').innerText = t.addBtn;

    if (window.activeTenNotes.length > 0) {
        window._renderTenNotes(window.activeTenNotes);
    }
};

// 開關發布彈窗
window.toggleCreatorModal = function (show) {
    const modal = document.getElementById('creator-modal');
    modal.style.display = show ? 'flex' : 'none';
    if (show) document.getElementById('note-text').focus();
};

// =========================================
// 🌟 2. 3D 空間與互動核心 (永遠正面投影)
// =========================================
(async () => {
    const textInput = document.getElementById('note-text');
    const charCount = document.getElementById('char-count');
    const addBtn = document.getElementById('add-note-btn');
    const notesBoard = document.getElementById('notes-board');
    const viewport = document.getElementById('sphere-viewport');

    const updateCharCount = () => {
        if (!charCount) return;
        const len = textInput.value.length;
        charCount.innerText = `${len} / 50`;
        if (len >= 50) charCount.classList.add('limit');
        else charCount.classList.remove('limit');
    };
    textInput.addEventListener('input', updateCharCount);

    const API_BASE_URL = "https://api.drift-bottles.xyz";
    const API_URL = `${API_BASE_URL}/game/daily-note`;
    const themeColors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#e0c3fc', '#fef08a', '#bbf7d0', '#fed7aa'];

    // 互動視角參數
    let rotAngle = 0;      // 水平環繞角度
    let offsetY = 0;       // 垂直上下浮動視差
    let velRot = 0;        // 水平慣性
    let velY = 0;          // 垂直慣性
    let isDragging = false;
    let lastX = 0, lastY = 0;

    // 半徑參數 (手機自動調校)
    const isMobile = window.innerWidth <= 600;
    const RADIUS_X = isMobile ? 320 : 540; // 橢圓水平半徑
    const RADIUS_Z = isMobile ? 240 : 380; // 橢圓深度半徑

    // 錯落高度列表 (像 Framer 一樣高低錯開，避免互相遮擋)
    const STAGGER_Y = [-140, 20, 150, -60, 90, -150, 0, 130, -90, 60];

    // 從資料庫撈取真實便簽 (100% 只用資料庫資料)
    const fetchNotes = async () => {
        try {
            const res = await fetch(API_URL);
            const rawData = await res.json();
            const serverData = rawData.data || [];
            window.allNotesPool = Array.isArray(serverData) ? serverData : [];
            pickAndRenderTen();
        } catch (error) {
            console.error("連線錯誤：", error);
            window.allNotesPool = [];
            pickAndRenderTen();
        }
    };

    // 抽樣並渲染最多 10 張
    function pickAndRenderTen() {
        if (!window.allNotesPool || window.allNotesPool.length === 0) {
            window.activeTenNotes = [];
            window._renderTenNotes([]);
            return;
        }
        const shuffled = [...window.allNotesPool].sort(() => 0.5 - Math.random());
        window.activeTenNotes = shuffled.slice(0, 10);
        window._renderTenNotes(window.activeTenNotes);
    }

    // 刷新按鈕觸發
    window.refreshNotes = function () {
        notesBoard.classList.add('refreshing');
        setTimeout(() => {
            pickAndRenderTen();
            rotAngle = 0;
            offsetY = 0;
            velRot = 0;
            velY = 0;
            notesBoard.classList.remove('refreshing');
            showToast(i18nNotes[currLangNotes].refreshed, 'success');
        }, 220);
    };

    // 渲染卡片
    window._renderTenNotes = (notes) => {
        notesBoard.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesBoard.innerHTML = `<div style="position: absolute; width: 320px; left: -160px; text-align: center; color: rgba(255,255,255,0.7); font-size: 1.1rem;">${i18nNotes[currLangNotes].empty}</div>`;
            return;
        }

        const total = notes.length;
        const angleStep = 360 / total;

        notes.forEach((note, index) => {
            const baseAngle = index * angleStep;
            const baseY = STAGGER_Y[index % STAGGER_Y.length];
            const randomColor = themeColors[index % themeColors.length];
            const dateObj = new Date(note.created_at);
            const timeString = isNaN(dateObj.getTime()) ? "剛剛" : dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.background = randomColor;

            card.innerHTML = `
                <div class="note-text">${escapeHTML(note.content)}</div>
                <div class="note-footer"><span>🕒 ${timeString}</span></div>
            `;

            card.dataset.angle = baseAngle;
            card.dataset.baseY = baseY;

            // 點擊任意卡片，平滑滑動到正中央特寫
            card.onclick = () => {
                if (Math.abs(velRot) > 0.3) return;
                rotateToTarget(baseAngle, baseY);
            };

            notesBoard.appendChild(card);
        });

        updateCardsTransform();
    };

    // 🌟 核心：計算每個卡片的三維空間投影 (Billboard：永遠正面面向相機)
    function updateCardsTransform() {
        const cards = document.querySelectorAll('.note-card');
        let closestCard = null;
        let maxDepth = -9999;

        cards.forEach((card) => {
            const baseAngle = parseFloat(card.dataset.angle);
            const baseY = parseFloat(card.dataset.baseY);

            // 當前卡片所處的水平角度
            const currentDeg = (baseAngle + rotAngle) % 360;
            const rad = currentDeg * (Math.PI / 180);

            // 空間坐標計算 (X: 左右, Z: 前後深度)
            const x = Math.sin(rad) * RADIUS_X;
            const z = Math.cos(rad) * RADIUS_Z;
            const y = baseY + offsetY;

            // 正規化深度比例 (1 = 正前方最近, 0 = 正後方最遠)
            const depth = (z + RADIUS_Z) / (2 * RADIUS_Z);

            // Framer 風格：近大遠小、前後景深虛化
            const scale = 0.65 + depth * 0.45;       // 縮放 0.65 ~ 1.10
            const opacity = 0.25 + depth * 0.75;     // 透明度 0.25 ~ 1.0
            const blur = (1 - depth) * 2.5;          // 後方模糊度

            // 🎯 核心語句：只做平移與縮放，完全不加 rotateX / rotateY，永遠保持端正正面！
            card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) scale(${scale.toFixed(3)})`;
            card.style.opacity = opacity.toFixed(2);
            card.style.filter = `blur(${blur.toFixed(1)}px)`;
            card.style.zIndex = Math.round(depth * 100); // 靠前的層級高，完美遮蔽後方

            // 捕捉最靠近正中央正前方的卡片
            if (depth > maxDepth) {
                maxDepth = depth;
                closestCard = card;
            }
        });

        cards.forEach(c => c.classList.remove('is-focused'));
        // 當最靠前的卡片非常接近正中央時，觸發高亮光暈
        if (closestCard && maxDepth > 0.94) {
            closestCard.classList.add('is-focused');
        }
    }

    // 點擊卡片轉至正中央
    function rotateToTarget(targetAngle, targetY) {
        velRot = 0;
        velY = 0;
        const currentMod = (rotAngle % 360 + 360) % 360;
        let diff = (-targetAngle) - currentMod;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        rotAngle += diff;
        offsetY = -targetY * 0.6; // 稍微上下微調垂直視角
        updateCardsTransform();
    }

    // 手勢與滑鼠拖曳
    viewport.addEventListener('pointerdown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        velRot = 0;
        velY = 0;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;

        rotAngle += deltaX * 0.28;
        offsetY += deltaY * 0.4;
        offsetY = Math.max(-140, Math.min(140, offsetY)); // 限制上下移動範圍

        velRot = deltaX * 0.28;
        velY = deltaY * 0.4;

        lastX = e.clientX;
        lastY = e.clientY;

        updateCardsTransform();
    });

    window.addEventListener('pointerup', () => { isDragging = false; });
    window.addEventListener('pointercancel', () => { isDragging = false; });

    // 物理滑動慣性
    function animateInertia() {
        if (!isDragging) {
            if (Math.abs(velRot) > 0.02 || Math.abs(velY) > 0.02) {
                rotAngle += velRot;
                offsetY += velY;
                offsetY = Math.max(-140, Math.min(140, offsetY));

                velRot *= 0.92; // 摩擦阻尼
                velY *= 0.92;

                updateCardsTransform();
            }
        }
        requestAnimationFrame(animateInertia);
    }
    requestAnimationFrame(animateInertia);

    // 發布便利貼
    const addNote = async () => {
        const content = textInput.value;
        const t = i18nNotes[currLangNotes];

        if (content.trim() === '') { showToast(t.warnEmpty, 'warning'); return; }
        const token = localStorage.getItem('authToken');
        if (!token) { showToast(t.warnLogin, "warning"); return; }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: content })
            });

            if (!res.ok) {
                let errorMessage = t.duplicate;
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errData.error || errorMessage;
                } catch (e) { }
                showToast(errorMessage, "error");
                return;
            }

            const newNoteObj = { content: content, created_at: new Date().toISOString() };
            window.allNotesPool.unshift(newNoteObj);

            textInput.value = '';
            updateCharCount();
            toggleCreatorModal(false);
            showToast(t.success, 'success');

            window.activeTenNotes.unshift(newNoteObj);
            window.activeTenNotes = window.activeTenNotes.slice(0, 10);
            window._renderTenNotes(window.activeTenNotes);

            rotAngle = 0;
            offsetY = 0;
            updateCardsTransform();
        } catch (error) {
            console.error("發佈失敗：", error);
            showToast(t.fail, "error");
        }
    };

    const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', ">": '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));

    addBtn.addEventListener('click', addNote);
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
    });

    fetchNotes();
})();

// Toast 提示框
const showToast = (message, type = 'normal') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 2800);
};