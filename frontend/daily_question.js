// 🗓️ 【今日一題】論壇首頁上方的小卡片
// 每天一個 emoji 小問題，投完直接看大家的比例（每個帳號每天一票，投了不能改）
// 後端：GET /daily-question、POST /daily-question/vote { optionIndex }
(function () {
    const API_BASE_URL = "https://api.drift-bottles.xyz";
    const COLLAPSE_KEY = "dailyQuestionCollapsed"; // 今天收起來了就記住，隔天自動打開

    const card = document.getElementById("daily-question-card");
    if (!card) return;

    let state = null;
    let voting = false;

    const token = () => localStorage.getItem("authToken");

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function isCollapsed() {
        try { return localStorage.getItem(COLLAPSE_KEY) === state.date; } catch { return false; }
    }
    function setCollapsed(on) {
        try { on ? localStorage.setItem(COLLAPSE_KEY, state.date) : localStorage.removeItem(COLLAPSE_KEY); } catch { /* 私密模式存不了就算了 */ }
    }

    function render() {
        card.innerHTML = "";
        const collapsed = isCollapsed();
        card.classList.toggle("is-collapsed", collapsed);

        // 標題列：點一下收合／展開
        const head = el("button", "dq-head");
        head.type = "button";
        head.setAttribute("aria-expanded", String(!collapsed));
        const [, m, d] = state.date.split("-");
        head.appendChild(el("span", "dq-badge", `🗓️ 今日一題・${Number(m)}/${Number(d)}`));
        const voted = state.myVote !== null;
        head.appendChild(el("span", "dq-head-hint", collapsed ? (voted ? "已投票，點開看結果" : "點開來投票") : "收起"));
        head.appendChild(el("span", "dq-chevron", collapsed ? "▾" : "▴"));
        head.addEventListener("click", () => { setCollapsed(!collapsed); render(); });
        card.appendChild(head);
        if (collapsed) return;

        card.appendChild(el("p", "dq-question", state.question));

        const list = el("div", "dq-options" + (voted ? " is-voted" : ""));
        state.options.forEach((opt, i) => {
            const btn = el("button", "dq-option");
            btn.type = "button";
            if (voted) {
                btn.disabled = true;
                const percent = state.results.percents[i] || 0;
                btn.style.setProperty("--dq-percent", `${percent}%`);
                if (i === state.myVote) btn.classList.add("is-mine");
                btn.appendChild(el("span", "dq-bar"));
                btn.appendChild(el("span", "dq-emoji", opt.emoji));
                btn.appendChild(el("span", "dq-label", opt.label));
                btn.appendChild(el("span", "dq-percent", `${percent}%`));
            } else {
                btn.appendChild(el("span", "dq-emoji", opt.emoji));
                btn.appendChild(el("span", "dq-label", opt.label));
                btn.addEventListener("click", () => vote(i));
            }
            list.appendChild(btn);
        });
        card.appendChild(list);

        const foot = el("p", "dq-foot");
        if (voted) {
            foot.textContent = `共 ${state.results.total} 人回答・你選了 ${state.options[state.myVote].emoji}・明天會有新題目`;
        } else if (!token()) {
            foot.textContent = "登入後就能投票，看看大家今天怎麼樣 🌊";
        } else {
            foot.textContent = "選一個最接近你的，投完就能看到大家的答案";
        }
        card.appendChild(foot);
    }

    async function vote(index) {
        if (voting) return;
        if (!token()) {
            if (confirm("登入後才能投票喔！要現在去登入嗎？")) window.location.href = "login.html";
            return;
        }
        voting = true;
        card.classList.add("is-busy");
        try {
            const res = await fetch(`${API_BASE_URL}/daily-question/vote`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token()}` },
                body: JSON.stringify({ optionIndex: index }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                if (confirm("登入已過期，要重新登入嗎？")) window.location.href = "login.html";
                return;
            }
            if (!res.ok) {
                alert(data.message || "投票失敗，請稍後再試");
                await load(); // 例如已經在別的分頁投過了，重新抓一次結果
                return;
            }
            state = data.data;
            render();
        } catch (e) {
            alert("連線失敗，請稍後再試");
        } finally {
            voting = false;
            card.classList.remove("is-busy");
        }
    }

    async function load() {
        try {
            const headers = token() ? { "Authorization": `Bearer ${token()}` } : {};
            const res = await fetch(`${API_BASE_URL}/daily-question`, { headers });
            if (!res.ok) throw new Error();
            state = (await res.json()).data;
            card.hidden = false;
            render();
        } catch (e) {
            card.hidden = true; // 抓不到就不顯示，不影響首頁其他東西
        }
    }

    load();
})();
