// 🌊 【我的海域】論壇首頁今日一題下方的卡片（登入後才出現）
// 兩個分頁：追蹤的人最近 7 天的新瓶（不含匿名）、我的收藏；點瓶子直接打開詳情
// 後端：GET /bottles/following-feed、GET /bottles/saved
// 打開瓶子用 index.js 的 window.openBottleById
(function () {
    const API_BASE_URL = "https://api.drift-bottles.xyz";
    // 手機畫面小，先列 3 則就好
    const PREVIEW_COUNT = window.matchMedia("(max-width: 768px)").matches ? 3 : 5;
    const TAB_KEY = "myOceanTab";
    const COLLAPSE_KEY = "myOceanCollapsed";

    const card = document.getElementById("my-ocean-card");
    const token = localStorage.getItem("authToken");
    if (!card || !token) return; // 沒登入就不顯示

    // 「上次看到哪裡」依帳號分開記，同一台電腦換帳號不會混在一起
    let userKey = "guest";
    try { userKey = JSON.parse(localStorage.getItem("currentUser") || "{}").email || "guest"; } catch { /* 用預設 */ }
    const SEEN_KEY = `myOceanSeenAt:${userKey}`;

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* 私密模式存不了就算了 */ } },
    };

    let tab = store.get(TAB_KEY) === "saved" ? "saved" : "following";
    let expanded = false;
    const data = { following: null, saved: null };
    // 進來時記下「上次看到的時間」，這次畫面上比它新的都標 NEW
    const lastSeen = Number(store.get(SEEN_KEY)) || 0;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function timeAgo(iso) {
        const diff = Math.max(0, Date.now() - new Date(iso).getTime());
        const min = Math.floor(diff / 60000);
        if (min < 1) return "剛剛";
        if (min < 60) return `${min} 分鐘前`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} 小時前`;
        return `${Math.floor(hr / 24)} 天前`;
    }

    const newCount = () => (data.following ? data.following.bottles.filter(b => new Date(b.created_at).getTime() > lastSeen).length : 0);

    function itemNode(b, isNew) {
        const id = b.bottle_id ?? b.id;
        const btn = el("button", "mo-item");
        btn.type = "button";
        const top = el("span", "mo-item-top");
        const board = (b.category_list && b.category_list[0]) || "";
        if (board) top.appendChild(el("span", "mo-board", board));
        top.appendChild(el("span", "mo-title", b.title || "（無標題）"));
        if (isNew) top.appendChild(el("span", "mo-new", "NEW"));
        btn.appendChild(top);
        const preview = b.preview ?? String(b.content || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (preview) btn.appendChild(el("span", "mo-preview", preview));
        btn.appendChild(el("span", "mo-meta", `${b.member_name || "匿名使用者"}・${timeAgo(b.created_at)}`));
        btn.addEventListener("click", () => {
            if (typeof window.openBottleById === "function") window.openBottleById(id);
        });
        return btn;
    }

    function renderList(box) {
        if (tab === "following") {
            const feed = data.following;
            if (!feed) return box.appendChild(el("p", "mo-empty", "讀取中…"));
            if (feed.error) return box.appendChild(el("p", "mo-empty", "讀不到資料，等一下再試試看 🌊"));
            if (feed.followingCount === 0) return box.appendChild(el("p", "mo-empty", "還沒有追蹤任何人～點開瓶子，在作者名字旁邊就能追蹤 🫂"));
            if (!feed.bottles.length) return box.appendChild(el("p", "mo-empty", "你追蹤的人最近 7 天沒有新瓶，去海面上逛逛吧 🌊"));
            const list = expanded ? feed.bottles : feed.bottles.slice(0, PREVIEW_COUNT);
            list.forEach(b => box.appendChild(itemNode(b, new Date(b.created_at).getTime() > lastSeen)));
            if (feed.bottles.length > PREVIEW_COUNT) {
                const more = el("button", "mo-more", expanded ? "收起" : `看更多（共 ${feed.bottles.length} 則）`);
                more.type = "button";
                more.addEventListener("click", () => { expanded = !expanded; render(); });
                box.appendChild(more);
            }
            // 看過了：下次進來，比現在舊的就不再標 NEW
            const newest = Math.max(...feed.bottles.map(b => new Date(b.created_at).getTime()));
            if (newest > lastSeen) store.set(SEEN_KEY, String(newest));
            return;
        }

        const saved = data.saved;
        if (!saved) return box.appendChild(el("p", "mo-empty", "讀取中…"));
        if (saved.error) return box.appendChild(el("p", "mo-empty", "讀不到資料，等一下再試試看 🌊"));
        if (!saved.length) return box.appendChild(el("p", "mo-empty", "還沒有收藏任何瓶子～看到喜歡的就按 ⭐ 收起來吧"));
        saved.slice(0, PREVIEW_COUNT).forEach(b => box.appendChild(itemNode(b, false)));
        const all = el("a", "mo-more", `看全部收藏（${saved.length} 個）→`);
        all.href = "saved.html";
        box.appendChild(all);
    }

    function render() {
        card.innerHTML = "";
        const collapsed = store.get(COLLAPSE_KEY) === "1";
        card.classList.toggle("is-collapsed", collapsed);

        const head = el("div", "mo-head");
        const toggle = el("button", "mo-toggle");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.appendChild(el("span", "mo-badge", "🌊 我的海域"));
        const n = newCount();
        if (collapsed && n) toggle.appendChild(el("span", "mo-count", `${n} 則新瓶`));
        toggle.appendChild(el("span", "mo-chevron", collapsed ? "▾" : "▴"));
        toggle.addEventListener("click", () => { store.set(COLLAPSE_KEY, collapsed ? "0" : "1"); render(); });
        head.appendChild(toggle);
        card.appendChild(head);
        if (collapsed) return;

        const tabs = el("div", "mo-tabs");
        [["following", "🫂 追蹤的新瓶"], ["saved", "⭐ 我的收藏"]].forEach(([key, label]) => {
            const t = el("button", "mo-tab" + (tab === key ? " is-active" : ""), label);
            t.type = "button";
            if (key === "following" && n) t.appendChild(el("span", "mo-count", String(n)));
            t.addEventListener("click", () => { tab = key; expanded = false; store.set(TAB_KEY, key); render(); });
            tabs.appendChild(t);
        });
        card.appendChild(tabs);

        const box = el("div", "mo-list");
        renderList(box);
        card.appendChild(box);
    }

    async function getJSON(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.status === 401 || res.status === 403) { card.hidden = true; throw new Error("auth"); }
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
    }

    card.hidden = false;
    render();
    getJSON("/bottles/following-feed")
        .then(d => { data.following = d; })
        .catch(() => { data.following = { error: true }; })
        .finally(render);
    getJSON("/bottles/saved")
        .then(d => { data.saved = Array.isArray(d) ? d : (d.data || []); })
        .catch(() => { data.saved = Object.assign([], { error: true }); })
        .finally(render);
})();
