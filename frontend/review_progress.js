/* ⏳ 發文／修改瓶子後的「審核中」進度條（首頁用）
 *
 *   showReviewProgress(瓶子ID, { edited, onDone })
 *     edited：修改後重新審核（文字不一樣）
 *     onDone(status)：審核有結果時呼叫（1 通過、2 違規），用來更新列表、通知鈴鐺
 *
 * 每幾秒問一次後端 GET /bottles/:id/review-status（0 審核中、1 通過、2 違規）。
 * 視窗可以隨時關掉：關掉後背景照樣在等結果，結果一樣會出現在通知裡（後端 AI 審核完會發通知）。
 */
(function () {
  if (window.showReviewProgress) return;

  const POLL_MS = 3000;
  const SLOW_MS = 60 * 1000; // 超過這麼久還沒好，提醒他可以先關掉
  const GIVE_UP_MS = 10 * 60 * 1000; // 背景最多等這麼久，之後就交給通知

  const CSS = `
  .rp-veil { position: fixed; inset: 0; z-index: 2147482400; display: flex; align-items: center; justify-content: center;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    background: rgba(6, 30, 52, .55); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; overscroll-behavior: contain;
    animation: rpFade .2s ease-out; }
  .rp-card { position: relative; width: min(400px, 100%); background: #fff; border-radius: 26px; overflow: hidden;
    color: #1e3a50; text-align: center; box-shadow: 0 22px 60px rgba(0, 20, 40, .35);
    animation: rpPop .32s cubic-bezier(.18, .89, .32, 1.28); }
  .rp-wave { height: 74px; background: linear-gradient(135deg, #2a8fc4, #0b5a8c); position: relative; transition: background .4s; }
  .rp-wave::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 26px;
    background: radial-gradient(60% 26px at 50% 100%, #fff 98%, transparent 100%); }
  .rp-card.is-pass .rp-wave { background: linear-gradient(135deg, #43c59e, #1f8a70); }
  .rp-card.is-fail .rp-wave { background: linear-gradient(135deg, #f08a6c, #c8463c); }
  .rp-close { position: absolute; top: 10px; right: 12px; z-index: 2; width: 36px; height: 36px; border: 0; border-radius: 50%;
    background: rgba(255, 255, 255, .22); color: #fff; font-size: 20px; line-height: 1; cursor: pointer; }
  .rp-close:hover { background: rgba(255, 255, 255, .35); }
  .rp-close:focus-visible { outline: 3px solid #7cc4de; outline-offset: 2px; }
  .rp-icon { position: absolute; left: 50%; top: 30px; transform: translateX(-50%); width: 76px; height: 76px; border-radius: 50%;
    background: #fff; display: flex; align-items: center; justify-content: center; font-size: 40px; line-height: 1;
    box-shadow: 0 8px 20px rgba(0, 40, 80, .18); z-index: 1; }
  .rp-card.is-pending .rp-icon span { display: inline-block; animation: rpBob 1.6s ease-in-out infinite; }
  .rp-body { padding: 44px 24px 4px; }
  .rp-title { margin: 0 0 6px; font-size: 1.2rem; font-weight: 900; color: #0b4a75; letter-spacing: .5px; }
  .rp-msg { margin: 0; font-size: .95rem; line-height: 1.7; white-space: pre-line; word-break: break-word; color: #34506a; }
  .rp-track { position: relative; height: 12px; margin: 18px 4px 8px; border-radius: 999px; background: #e3f0f8; overflow: hidden; }
  .rp-fill { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: inherit;
    background: linear-gradient(90deg, #7cc4de, #2a8fc4); transition: width .25s linear, background .4s; }
  .rp-card.is-pending .rp-fill::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .55), transparent); animation: rpShine 1.4s linear infinite; }
  .rp-card.is-pass .rp-fill { background: linear-gradient(90deg, #6fd8b6, #1f8a70); }
  .rp-card.is-fail .rp-fill { background: linear-gradient(90deg, #f5a48c, #c8463c); }
  .rp-steps { display: flex; justify-content: space-between; margin: 0 2px; padding: 0; list-style: none; font-size: .78rem; color: #8aa4b8; }
  .rp-steps li.on { color: #0b5a8c; font-weight: 800; }
  .rp-card.is-fail .rp-steps li.on:last-child { color: #c8463c; }
  .rp-btns { display: flex; padding: 20px 22px 22px; }
  .rp-btn { flex: 1; min-height: 48px; padding: 0 18px; border-radius: 999px; font: inherit; font-size: 1rem; font-weight: 800; cursor: pointer;
    border: 2px solid #cfe5f3; background: #fff; color: #0b5a8c; transition: transform .12s, filter .12s; -webkit-tap-highlight-color: transparent; }
  .rp-btn:hover { background: #f3f8fc; }
  .rp-btn:active { transform: scale(.97); }
  .rp-btn:focus-visible { outline: 3px solid #7cc4de; outline-offset: 2px; }
  .rp-card:not(.is-pending) .rp-btn { border-color: transparent; color: #fff; background: linear-gradient(135deg, #2a8fc4, #0b5a8c); box-shadow: 0 6px 16px rgba(11, 90, 140, .3); }
  .rp-card.is-pass .rp-btn { background: linear-gradient(135deg, #43c59e, #1f8a70); box-shadow: 0 6px 16px rgba(31, 138, 112, .3); }
  .rp-card.is-fail .rp-btn { background: linear-gradient(135deg, #f08a6c, #c8463c); box-shadow: 0 6px 16px rgba(200, 70, 60, .3); }
  @keyframes rpFade { from { opacity: 0; } }
  @keyframes rpPop { from { transform: scale(.86); opacity: 0; } }
  @keyframes rpBob { 50% { transform: translateY(-4px) rotate(-8deg); } }
  @keyframes rpShine { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  @media (prefers-reduced-motion: reduce) {
    .rp-veil, .rp-card, .rp-card.is-pending .rp-icon span, .rp-card.is-pending .rp-fill::after { animation: none; }
  }
  `;

  // 目前這一次審核的狀態；同時只追一個瓶子，新的開始就不管舊的（舊的結果一樣會有通知）
  let job = null;

  function ensureStyle() {
    if (document.getElementById("rp-style")) return;
    const style = document.createElement("style");
    style.id = "rp-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildCard() {
    const veil = document.createElement("div");
    veil.className = "rp-veil";
    veil.innerHTML = `
      <div class="rp-card is-pending" role="dialog" aria-modal="true" aria-labelledby="rp-title">
        <div class="rp-wave"></div>
        <button type="button" class="rp-close" aria-label="關閉">×</button>
        <div class="rp-icon" aria-hidden="true"><span>🍾</span></div>
        <div class="rp-body">
          <h3 class="rp-title" id="rp-title"></h3>
          <p class="rp-msg" aria-live="polite"></p>
          <div class="rp-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="rp-fill"></div></div>
          <ol class="rp-steps"><li class="on">已送出</li><li>AI 審核中</li><li>漂進海裡</li></ol>
        </div>
        <div class="rp-btns"><button type="button" class="rp-btn"></button></div>
      </div>`;
    return veil;
  }

  function stop(j) {
    clearTimeout(j.pollTimer);
    clearInterval(j.barTimer);
    j.stopped = true;
  }

  function hide(j) {
    if (!j.veil) return;
    j.veil.remove();
    j.veil = null;
    document.removeEventListener("keydown", j.onKey);
  }

  function setBar(j, pct) {
    j.pct = pct;
    if (!j.veil) return;
    j.veil.querySelector(".rp-fill").style.width = pct + "%";
    j.veil.querySelector(".rp-track").setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  function render(j) {
    if (!j.veil) return;
    const card = j.veil.querySelector(".rp-card");
    const steps = j.veil.querySelectorAll(".rp-steps li");
    const q = (s) => j.veil.querySelector(s);

    card.classList.toggle("is-pending", j.status === 0);
    card.classList.toggle("is-pass", j.status === 1);
    card.classList.toggle("is-fail", j.status === 2);
    steps[1].classList.toggle("on", j.pct >= 15 || j.status !== 0);
    steps[2].classList.toggle("on", j.status !== 0);
    steps[2].textContent = j.status === 2 ? "未通過" : "漂進海裡";

    if (j.status === 1) {
      q(".rp-icon span").textContent = "🌊";
      q(".rp-title").textContent = j.edited ? "重新審核通過！" : "審核通過！";
      q(".rp-msg").textContent = j.edited ? "修改後的瓶子又漂回海裡了。" : "你的瓶子已經漂進海裡了，等等看誰會撿到吧！";
      q(".rp-btn").textContent = "好";
    } else if (j.status === 2) {
      q(".rp-icon span").textContent = "🚫";
      q(".rp-title").textContent = "沒有通過審核";
      q(".rp-msg").textContent = j.reason
        ? `原因：${j.reason}`
        : "這個瓶子沒有被放進海裡，請留意社群規範。";
      q(".rp-btn").textContent = "我知道了";
    } else {
      q(".rp-icon span").textContent = "🍾";
      q(".rp-title").textContent = "瓶子審核中…";
      q(".rp-msg").textContent = j.slow
        ? "今天海上比較忙，審核要久一點。\n可以先關掉，結果出來會通知你。"
        : "AI 正在確認內容有沒有符合社群規範，通常幾秒鐘就好。\n關掉視窗也沒關係，結果出來會通知你。";
      q(".rp-btn").textContent = "先關掉，好了通知我";
    }
  }

  function finish(j, status, reason) {
    stop(j);
    j.status = status;
    j.reason = reason || "";
    setBar(j, 100);
    render(j);
    if (j.veil) j.veil.querySelector(".rp-btn").focus();
    try { j.onDone && j.onDone(status); } catch (e) { console.error(e); }
  }

  async function poll(j) {
    if (j.stopped) return;
    if (Date.now() - j.startedAt > GIVE_UP_MS) {
      stop(j); // 等太久就交給通知
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/bottles/${j.bottleId}/review-status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (j.stopped) return;
      if (res.status === 404 || res.status === 401) {
        // 瓶子被刪了或登出了，就不用等了
        stop(j);
        hide(j);
        return;
      }
      if (res.ok) {
        const { data } = await res.json();
        if (data && (data.status === 1 || data.status === 2)) {
          finish(j, data.status, data.violation_reason);
          return;
        }
      }
    } catch (e) {
      // 網路一時不穩就下一輪再問
    }
    if (!j.slow && Date.now() - j.startedAt > SLOW_MS) {
      j.slow = true;
      render(j);
    }
    j.pollTimer = setTimeout(() => poll(j), POLL_MS);
  }

  window.showReviewProgress = function (bottleId, opts = {}) {
    if (!bottleId) return;
    if (job) {
      stop(job);
      hide(job);
    }
    ensureStyle();

    const j = {
      bottleId,
      edited: !!opts.edited,
      onDone: opts.onDone,
      status: 0,
      reason: "",
      pct: 0,
      slow: false,
      stopped: false,
      startedAt: Date.now(),
      veil: buildCard(),
    };
    job = j;

    // 關掉只是把視窗收起來；還在審核中就繼續在背景等，有結果時照樣呼叫 onDone
    const close = () => {
      hide(j);
      if (j.status !== 0) job = null;
    };
    j.onKey = (e) => { if (e.key === "Escape") close(); };
    j.veil.addEventListener("click", (e) => { if (e.target === j.veil) close(); });
    j.veil.querySelector(".rp-close").addEventListener("click", close);
    j.veil.querySelector(".rp-btn").addEventListener("click", close);
    document.addEventListener("keydown", j.onKey);
    document.body.appendChild(j.veil);

    // 假的進度：越接近 90% 走越慢，真正的結果回來才跳到 100%
    j.barTimer = setInterval(() => {
      const next = j.pct + (90 - j.pct) * 0.05;
      const crossed = j.pct < 15 && next >= 15;
      setBar(j, next);
      if (crossed) render(j);
    }, 200);

    render(j);
    setBar(j, 4);
    j.veil.querySelector(".rp-btn").focus();
    j.pollTimer = setTimeout(() => poll(j), 1500);
  };
})();
