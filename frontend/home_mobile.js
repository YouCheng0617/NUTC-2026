// 📱 首頁手機版（樣式在 home_mobile.css）
// 改這個檔案時，這裡跟 index.html 的 home_mobile.js?v= 一起改，?debug=1 的診斷框會顯示這個版本
const HOME_MOBILE_VERSION = 14;
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
        // 在瓶子的 3D 球上拖是轉球，從球上方（今日一題、我的海域那一帶）往下拉才是刷新
        if (e.target.closest && e.target.closest("#post-container")) return;
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

// 📏🌐 手機版首頁：瓶子排在 3D 球上（跟「每日便利貼」notes.js 同一套轉法）
//    1. 量「卡片下緣到底部按鈕」剩下的高度 → 球的區域高度（--sphere-h）與瓶子大小（--bottle）
//       螢幕比較矮、兩張卡片都展開會擠到球時：一開始先收「我的海域」，之後一次只開一張
//    2. 用手指拖動轉球，放手有慣性，閒置一下會自己慢慢轉；
//       點正前方的瓶子打開文章，點後面的瓶子先把它轉到前面
(function () {
    const mobile = window.matchMedia("(max-width: 768px)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const feed = document.getElementById("feed-view");
    const container = document.getElementById("post-container");
    if (!feed || !container) return;

    // ---------- 1. 空間 ----------
    const MIN = 60, MAX = 120;
    const COMFORT = 72; // 瓶子小於這個就算太擠
    const cards = {
        daily: { el: document.getElementById("daily-question-card"), toggle: ".dq-head" },
        ocean: { el: document.getElementById("my-ocean-card"), toggle: ".mo-toggle" },
    };
    const isOpen = (c) => c.el && !c.el.hidden && !c.el.classList.contains("is-collapsed");
    const collapse = (c) => { const t = c.el && c.el.querySelector(c.toggle); if (t && isOpen(c)) t.click(); };
    let autoCollapsed = false; // 開頁時只自動收一次
    let lastOpened = null;     // 使用者剛展開的那張（擠的時候收另一張）
    let box = { w: 0, h: 0, bottle: 80, radius: 100, radiusY: 100 };
    let fitFrame = 0;

    // 球的大小：橫向半徑 R 加上前排放大後的半個瓶子要塞進寬度；直向球面只用到約 0.55R
    function measure() {
        const bar = document.getElementById("mobile-board-btn");
        // 底部按鈕是 position: fixed，offsetParent 永遠是 null，要用 getClientRects 判斷有沒有顯示
        const barVisible = bar && bar.getClientRects().length > 0;
        const bottom = (barVisible ? bar.getBoundingClientRect().top : window.innerHeight) - 8;
        const h = Math.max(0, bottom - container.getBoundingClientRect().top);
        const w = container.clientWidth || window.innerWidth;
        const bottle = Math.min(MAX, w * 0.24, h / 2.7); // 10 個瓶子，比 6 個時小一點才不會擠
        return { w, h, bottle };
    }

    function fit() {
        cancelAnimationFrame(fitFrame);
        fitFrame = requestAnimationFrame(() => {
            if (!mobile.matches) {
                feed.style.removeProperty("--bottle");
                container.style.removeProperty("--sphere-h");
                return;
            }
            const m = measure();
            if (m.bottle < COMFORT && isOpen(cards.daily) && isOpen(cards.ocean)) {
                // 太擠：剛展開的是哪張就留哪張；開頁時（還沒人動過）先收「我的海域」
                if (lastOpened === "ocean") collapse(cards.daily);
                else if (lastOpened === "daily" || !autoCollapsed) collapse(cards.ocean);
                autoCollapsed = true;
                return; // 收起來之後卡片高度會變，ResizeObserver 會再叫 fit
            }
            // 很小的手機：只開一張也放不下最小的瓶子，開頁時就先收起來（之後使用者自己打開就不再收）
            if (m.bottle < MIN && !autoCollapsed && !lastOpened) {
                const open = Object.values(cards).find(isOpen);
                if (open) { collapse(open); autoCollapsed = true; return; }
            }
            const bottle = Math.floor(Math.max(MIN, m.bottle));
            // 前排放大到 1.1 倍：橫向 R + 0.55 瓶 ≤ 半寬；直向球面最高約 0.56R，加上半個瓶子和瓶塞 ≤ 半高
            //    手機的區域通常比較高，直向另外算一個半徑，把球拉成上下比較長的橢圓，空間才不會空一大塊
            const radius = Math.max(40, m.w / 2 - bottle * 0.6);
            // 傾斜 θ 時，瓶子的高度是 y·cosθ + (前後距離)·sinθ；取所有瓶子、傾斜到極限時最大的那個
            // 上下再各留 0.75 個瓶子（前排放大 1.1 倍的一半 + 瓶塞）
            const pts = points.length ? points : spherePoints(Math.max(1, bottles().length));
            const t = (PITCH_LIMIT * Math.PI) / 180;
            const maxY = Math.max(0.3, ...pts.map(p => Math.abs(p.y) * Math.cos(t) + Math.hypot(p.x, p.z) * Math.sin(t)));
            const radiusY = Math.max(30, Math.min(radius * 1.6, (m.h / 2 - bottle * 0.75) / maxY));
            box = { w: m.w, h: m.h, bottle, radius, radiusY };
            feed.style.setProperty("--bottle", `${bottle}px`);
            container.style.setProperty("--sphere-h", `${Math.floor(m.h)}px`);
            layout();
        });
    }

    // 記下使用者剛展開哪一張
    Object.entries(cards).forEach(([key, c]) => {
        if (!c.el) return;
        new MutationObserver(() => { if (isOpen(c)) lastOpened = key; }).observe(c.el, { attributes: true, attributeFilter: ["class"] });
    });

    // ---------- 2. 3D 球（算法同 notes.js） ----------
    // 上下傾斜限制在 35 度：傾斜越多，球前後的瓶子會被轉到越上面／越下面，壓到卡片和底部按鈕
    //（35 度已經夠把最上、最下的瓶子轉到正前方）
    const PITCH_LIMIT = 35;
    const clampPitch = (v) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, v));
    const REST_PITCH = -8; // 平常微微俯看的角度
    let rotX = REST_PITCH, rotY = 0, velX = 0, velY = 0;
    let dragging = false, dragDistance = 0, lastX = 0, lastY = 0;
    let navigating = false, targetX = 0, targetY = 0;
    let lastInteract = Date.now();
    let points = []; // 每個瓶子在球上的原始座標（單位球）

    // 黃金角螺旋把瓶子平均撒在球面上；南北極收一點，每個瓶子都會水平繞圈
    function spherePoints(total) {
        if (total <= 1) return [{ x: 0, y: 0, z: 1 }];
        const phi = Math.PI * (3 - Math.sqrt(5));
        return Array.from({ length: total }, (_, i) => {
            const y = (1 - ((i + 0.5) / total) * 2) * 0.65;
            const r = Math.sqrt(Math.max(0.15, 1 - y * y));
            return { x: Math.cos(phi * i) * r, y: y * 0.85, z: Math.sin(phi * i) * r };
        });
    }

    const bottles = () => [...container.querySelectorAll(".post-card")];

    function layout() {
        const list = bottles();
        if (points.length !== list.length) points = spherePoints(list.length);
        render();
    }

    function render() {
        if (!mobile.matches) return;
        const list = bottles();
        const R = box.radius, RY = box.radiusY;
        const ax = (rotX * Math.PI) / 180, ay = (rotY * Math.PI) / 180;
        const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
        let front = null, best = -1;
        list.forEach((el, i) => {
            const p = points[i];
            if (!p) return;
            // 先繞 Y 軸（左右），再繞 X 軸（上下）
            const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy, y1 = p.y;
            const y2 = y1 * cx + z1 * sx, z2 = -y1 * sx + z1 * cx;
            const depth = (z2 + 1) / 2; // 0 在最後面、1 在最前面
            const scale = 0.55 + depth * 0.55;
            const tiltY = x1 * 30, tiltX = -y2 * 30; // 貼著球面微微轉向
            el.style.setProperty("--t", `translate3d(${(x1 * R).toFixed(1)}px, ${(y2 * RY).toFixed(1)}px, 0) rotateY(${tiltY.toFixed(1)}deg) rotateX(${tiltX.toFixed(1)}deg) scale(${scale.toFixed(3)})`);
            el.style.opacity = (0.25 + Math.pow(depth, 1.3) * 0.75).toFixed(2);
            el.style.filter = depth < 0.55 ? `blur(${((0.55 - depth) * 4).toFixed(1)}px)` : "";
            el.style.zIndex = String(Math.round(depth * 100));
            el.dataset.depth = depth.toFixed(3);
            if (depth > best) { best = depth; front = el; }
        });
        list.forEach(el => el.classList.toggle("is-front", el === front && best > 0.9));
    }

    // 把某個瓶子轉到正前方
    function bringToFront(el) {
        const p = points[bottles().indexOf(el)];
        if (!p) return;
        const yaw = -Math.atan2(p.x, p.z) * (180 / Math.PI);
        const pitch = -Math.atan2(p.y, Math.hypot(p.x, p.z)) * (180 / Math.PI);
        const cur = ((rotY % 360) + 360) % 360, dest = ((yaw % 360) + 360) % 360;
        let d = dest - cur;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        targetY = rotY + d;
        targetX = clampPitch(pitch);
        navigating = true;
        velX = velY = 0;
        lastInteract = Date.now();
    }

    container.addEventListener("pointerdown", (e) => {
        if (!mobile.matches) return;
        // 按在按鈕、連結上（例如連不上伺服器時的「重新連線」）就不轉球：鎖定手指後點擊會被導到容器上，按鈕會按不到
        if (e.target.closest && e.target.closest("button, a")) return;
        // 鎖定這根手指：iPhone 有時候手指放開不會送 pointerup 到 window，程式就以為還在拖、球停住不動
        try { container.setPointerCapture(e.pointerId); } catch (err) { /* 不支援就算了 */ }
        dragging = true;
        navigating = false;
        dragDistance = 0;
        lastX = e.clientX; lastY = e.clientY;
        velX = velY = 0;
        lastInteract = Date.now();
    });
    window.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        // 方向跟 notes.js 一樣：手指往上滑，前面的瓶子就往上走（之前正負號寫反，iPhone 上會卡在上面拉不下來）
        rotY += dx * 0.3;
        rotX = clampPitch(rotX + dy * 0.3);
        velY = dx * 0.3;
        velX = dy * 0.3;
        lastX = e.clientX; lastY = e.clientY;
        lastInteract = Date.now();
        render();
    });
    const endDrag = () => { dragging = false; };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    container.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("touchend", endDrag, { passive: true });
    window.addEventListener("touchcancel", endDrag, { passive: true });

    // 點瓶子：拖動中不算；在後面的先轉過來，正前方的才讓 index.js 打開文章
    container.addEventListener("click", (e) => {
        if (!mobile.matches) return;
        const el = e.target.closest(".post-card");
        if (!el) return;
        if (dragDistance > 8 || Number(el.dataset.depth) < 0.85) {
            e.stopPropagation();
            e.preventDefault();
            if (dragDistance <= 8) bringToFront(el);
        }
    }, true);

    function loop() {
        if (mobile.matches && !document.hidden) {
            if (navigating) {
                rotX += (targetX - rotX) * 0.12;
                rotY += (targetY - rotY) * 0.12;
                if (Math.abs(targetX - rotX) < 0.15 && Math.abs(targetY - rotY) < 0.15) {
                    rotX = targetX; rotY = targetY; navigating = false; lastInteract = Date.now();
                }
                render();
            } else if (!dragging) {
                if (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01) {
                    const nextX = rotX + velX;
                    rotX = clampPitch(nextX);
                    if (rotX !== nextX) velX = 0; // 撞到上下傾斜的上限就不要再推，放手後才能早點回正
                    rotY += velY;
                    velX *= 0.93; velY *= 0.93;
                    render();
                } else if (Date.now() - lastInteract > 1500) {
                    // 閒置時慢慢回到正面角度，瓶子不會一直停在球的上面或下面
                    const settle = (REST_PITCH - rotX) * 0.04;
                    if (Math.abs(settle) > 0.005) rotX += settle;
                    if (!reduceMotion.matches) rotY += 0.12; // 悠閒自轉
                    if (Math.abs(settle) > 0.005 || !reduceMotion.matches) render();
                }
            }
        }
        requestAnimationFrame(loop);
    }

    // 換一批瓶子（換海域、呼喚海流）就重新撒點；卡片高度變了、轉向就重算空間
    new MutationObserver(() => { points = []; fit(); }).observe(container, { childList: true });
    const ro = new ResizeObserver(fit);
    Object.values(cards).forEach(c => c.el && ro.observe(c.el));
    window.addEventListener("resize", fit);
    mobile.addEventListener("change", () => {
        if (!mobile.matches) bottles().forEach(el => { el.style.removeProperty("--t"); el.style.opacity = ""; el.style.filter = ""; el.style.zIndex = ""; });
        fit();
    });
    fit();
    requestAnimationFrame(loop);

    // 🩺 診斷用：網址加 ?debug=1 才會在左上角顯示，用來確認手機拿到的是哪一版、球的區域算出來多大
    if (/[?&]debug=1/.test(location.search)) {
        const panel = document.createElement("div");
        panel.style.cssText = "position:fixed;left:4px;top:4px;z-index:2147483647;max-width:70vw;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#0f0;font:11px/1.4 monospace;pointer-events:none;white-space:pre";
        document.body.appendChild(panel);
        setInterval(() => {
            const r = container.getBoundingClientRect();
            const bar = document.getElementById("mobile-board-btn");
            const fronts = bottles().filter(el => Number(el.dataset.depth) > 0.6).length;
            panel.textContent = [
                `home_mobile.js 版本 ${HOME_MOBILE_VERSION}`,
                `螢幕 ${innerWidth}x${innerHeight} 捲動 ${Math.round(feed.scrollTop)}`,
                `球區域 top ${Math.round(r.top)} 高 ${Math.round(r.height)}（設定 ${container.style.getPropertyValue("--sphere-h") || "無"}）`,
                `底部按鈕 top ${bar ? Math.round(bar.getBoundingClientRect().top) : "-"}`,
                `瓶子 ${feed.style.getPropertyValue("--bottle")} 半徑 ${Math.round(box.radius || 0)}/${Math.round(box.radiusY || 0)}`,
                `傾斜 ${rotX.toFixed(1)}° 旋轉 ${(rotY % 360).toFixed(0)}° 拖動中 ${dragging} 前排 ${fronts} 個`,
            ].join(String.fromCharCode(10));
        }, 300);
    }
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
