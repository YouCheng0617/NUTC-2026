// 📱 首頁手機版（樣式在 home_mobile.css）
// 1. 熱門、殿規的底部面板：按鈕、遮罩、關閉（面板本身沿用原本的 #ocean-popular-board / #ocean-rules-board）
// 2. 在瓶子列表最上面往下拉 → 呼喚海流（index.js 的 window.callOceanCurrent）
(function () {
    const mobile = window.matchMedia("(max-width: 768px)");
    const boards = {
        popular: document.getElementById("ocean-popular-board"),
        rules: document.getElementById("ocean-rules-board"),
    };
    if (!boards.popular || !boards.rules) return;

    // ---------- 1. 底部面板 ----------
    const overlay = document.createElement("div");
    overlay.className = "home-sheet-overlay";
    document.body.appendChild(overlay);

    const isOpen = (board) => !board.classList.contains("collapsed");

    function closeAll() {
        Object.values(boards).forEach(b => b.classList.add("collapsed"));
        overlay.classList.remove("is-open");
    }

    function open(key) {
        Object.entries(boards).forEach(([k, b]) => b.classList.toggle("collapsed", k !== key));
        overlay.classList.add("is-open");
    }

    function makeButton(key, icon, label) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `home-sheet-btn is-${key}`;
        btn.setAttribute("aria-label", label);
        btn.innerHTML = `<span aria-hidden="true">${icon}</span><small>${label}</small>`;
        btn.addEventListener("click", () => (isOpen(boards[key]) ? closeAll() : open(key)));
        document.body.appendChild(btn);
    }
    makeButton("popular", "🔥", "熱門");
    makeButton("rules", "📜", "殿規");

    Object.values(boards).forEach((board) => {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "home-sheet-close";
        close.setAttribute("aria-label", "關閉");
        close.textContent = "✕";
        close.addEventListener("click", closeAll);
        board.appendChild(close);
    });
    overlay.addEventListener("click", closeAll);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

    // 點熱門裡的瓶子會打開詳情，面板要一起收起來
    document.getElementById("popular-posts-list")?.addEventListener("click", () => {
        if (mobile.matches) setTimeout(closeAll, 0);
    });

    // 從手機轉成電腦寬度：把遮罩收掉，抽屜照電腦版的方式運作
    mobile.addEventListener("change", (e) => { if (!e.matches) overlay.classList.remove("is-open"); });

    // ---------- 2. 往下拉刷新 ----------
    const feed = document.getElementById("feed-view");
    if (!feed) return;

    const TRIGGER = 70; // 拉超過這麼多（px）放開就刷新
    const indicator = document.createElement("div");
    indicator.className = "pull-refresh-indicator";
    indicator.innerHTML = `<span class="pr-icon">⬇️</span><span class="pr-text">下拉召喚海流</span>`;
    document.body.appendChild(indicator);
    const text = indicator.querySelector(".pr-text");
    const icon = indicator.querySelector(".pr-icon");

    let startY = null;
    let pull = 0;
    let loading = false;

    function place(distance) {
        const top = feed.getBoundingClientRect().top;
        indicator.style.top = `${top + 8}px`;
        indicator.style.transform = `translate(-50%, ${Math.min(distance, TRIGGER + 30) * 0.5}px)`;
    }

    function reset() {
        startY = null;
        pull = 0;
        indicator.classList.remove("is-pulling", "is-ready");
        indicator.style.transform = "";
    }

    feed.addEventListener("touchstart", (e) => {
        if (!mobile.matches || loading || feed.scrollTop > 0 || e.touches.length !== 1) return;
        startY = e.touches[0].clientY;
        pull = 0;
    }, { passive: true });

    feed.addEventListener("touchmove", (e) => {
        if (startY === null) return;
        pull = e.touches[0].clientY - startY;
        if (pull <= 0 || feed.scrollTop > 0) { reset(); return; }
        e.preventDefault(); // 拉的時候不要讓整頁跟著彈
        const ready = pull >= TRIGGER;
        indicator.classList.add("is-pulling");
        indicator.classList.toggle("is-ready", ready);
        icon.textContent = "⬇️";
        text.textContent = ready ? "放開召喚海流" : "下拉召喚海流";
        place(pull);
    }, { passive: false });

    feed.addEventListener("touchend", () => {
        if (startY === null) return;
        if (pull < TRIGGER || typeof window.callOceanCurrent !== "function") { reset(); return; }

        loading = true;
        startY = null;
        indicator.classList.remove("is-ready");
        indicator.classList.add("is-pulling", "is-loading");
        icon.textContent = "🌊";
        text.textContent = "海流來了…";
        place(TRIGGER);
        window.callOceanCurrent();
        // 呼喚海流的動畫大約 1 秒後重新抓瓶子，提示多留一下再收
        setTimeout(() => {
            loading = false;
            indicator.classList.remove("is-loading");
            reset();
        }, 1600);
    });
    feed.addEventListener("touchcancel", reset);
})();

// 📏 手機版首頁整頁不捲動：瓶子大小依「卡片下緣到底部按鈕」剩下的高度算出來（--bottle）
//    6 個瓶子排成 2 排：每排高度是 1.32 個瓶子（中間那個往下錯開 0.32），加上排距 0.3、上方瓶塞 0.28，
//    總共大約 3.22 個瓶子，再留一點餘裕
//    螢幕比較矮、兩張卡片都展開會擠到瓶子時：一開始先把「我的海域」收起來，
//    之後展開其中一張就自動收起另一張（一次只開一張），瓶子才放得下
(function () {
    const mobile = window.matchMedia("(max-width: 768px)");
    const feed = document.getElementById("feed-view");
    const container = document.getElementById("post-container");
    if (!feed || !container) return;

    const HEIGHT_RATIO = 3.3; // 兩排瓶子佔的高度 ÷ 瓶子直徑（對應 home_mobile.css 的間距比例）
    const MIN = 56, MAX = 140;
    const COMFORT = 76;       // 瓶子小於這個就算太擠
    const cards = {
        daily: { el: document.getElementById("daily-question-card"), toggle: ".dq-head" },
        ocean: { el: document.getElementById("my-ocean-card"), toggle: ".mo-toggle" },
    };
    const isOpen = (c) => c.el && !c.el.hidden && !c.el.classList.contains("is-collapsed");
    const collapse = (c) => { const t = c.el && c.el.querySelector(c.toggle); if (t && isOpen(c)) t.click(); };

    let frame = 0;
    let autoCollapsed = false;   // 開頁時只自動收一次
    let lastOpened = null;       // 使用者剛展開的那張（擠的時候收另一張）

    function idealSize() {
        const bar = document.getElementById("mobile-board-btn");
        // 底部按鈕是 position: fixed，offsetParent 永遠是 null，要用 getClientRects 判斷有沒有顯示
        const barVisible = bar && bar.getClientRects().length > 0;
        const bottom = (barVisible ? bar.getBoundingClientRect().top : window.innerHeight) - 10;
        const byHeight = (bottom - container.getBoundingClientRect().top) / HEIGHT_RATIO;
        const byWidth = Math.min(window.innerWidth * 0.27, MAX);
        return Math.min(byHeight, byWidth);
    }

    function fit() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            if (!mobile.matches) { feed.style.removeProperty("--bottle"); return; }
            const size = idealSize();

            if (size < COMFORT && isOpen(cards.daily) && isOpen(cards.ocean)) {
                // 太擠：剛展開的是哪張就留哪張；開頁時（還沒人動過）先收「我的海域」
                if (lastOpened === "ocean") collapse(cards.daily);
                else if (lastOpened === "daily" || !autoCollapsed) collapse(cards.ocean);
                autoCollapsed = true;
                return; // 收起來之後卡片高度會變，ResizeObserver 會再叫 fit
            }
            // 很小的手機：只開一張也放不下最小的瓶子，開頁時就先收起來（之後使用者自己打開就不再收）
            if (size < MIN && !autoCollapsed && !lastOpened) {
                const open = Object.values(cards).find(isOpen);
                if (open) { collapse(open); autoCollapsed = true; return; }
            }

            feed.style.setProperty("--bottle", `${Math.floor(Math.max(MIN, size))}px`);
            feed.scrollTop = 0; // 不能捲動，保險起見永遠停在最上面
        });
    }

    // 記下使用者剛展開哪一張
    Object.entries(cards).forEach(([key, c]) => {
        if (!c.el) return;
        new MutationObserver(() => { if (isOpen(c)) lastOpened = key; }).observe(c.el, { attributes: true, attributeFilter: ["class"] });
    });

    // 卡片展開／收起、投票後高度變了，瓶子重畫，或是轉向、視窗大小改變，都重新算
    const ro = new ResizeObserver(fit);
    Object.values(cards).forEach(c => c.el && ro.observe(c.el));
    new MutationObserver(fit).observe(container, { childList: true });
    window.addEventListener("resize", fit);
    mobile.addEventListener("change", fit);
    fit();
})();

// 🚫 手機版不要「呼喚海流」按鈕（改成往下拉刷新）
//    關掉文章時 index.js 會用行內 display:block !important 把它叫回來，CSS 蓋不掉，
//    所以手機寬度直接把按鈕從頁面拿掉（index.js 找不到按鈕時本來就會略過），變回電腦寬度再放回去
(function () {
    const btn = document.querySelector(".ocean-refresh-btn");
    if (!btn) return;
    const mobile = window.matchMedia("(max-width: 768px)");
    const spot = document.createComment("ocean-refresh-btn（手機版拿掉）");
    function sync() {
        if (mobile.matches && btn.isConnected) btn.replaceWith(spot);
        else if (!mobile.matches && spot.isConnected) spot.replaceWith(btn);
    }
    mobile.addEventListener("change", sync);
    sync();
})();
