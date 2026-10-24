/* 🛠️ 伺服器整理中提示（全站共用）
 * 頁面連後端失敗時（連不上、或回 502／503／504），先再問一次後端首頁確認是不是真的壞了，
 * 真的壞了才跳出「伺服器整理中」，之後每 15 秒自動檢查，恢復了就告訴使用者可以重新整理。
 * 使用者自己網路斷線時改說「你的網路好像斷線了」，不會誤說是伺服器的問題。
 * 只看主要後端（AI 聊天、塔羅另外有自己的錯誤提示，不在這裡處理）。
 * 這支要放在 <head>、config.js 之後、其他程式之前載入，才包得到頁面一開始的請求。
 */
(function () {
  const API = API_BASE_URL; // 在 config.js 設定，config.js 要比這支先載入
  const HEALTH_URL = API + "/";
  const RETRY_MS = 15000;
  const DOWN_CODES = [502, 503, 504, 520, 521, 522, 523, 524];
  const nativeFetch = window.fetch.bind(window);

  let state = "up";          // up / checking / down / offline
  let dismissed = false;     // 使用者按了「先關閉」：這次壞掉期間不再跳卡片，只留上方小條
  let retryTimer = null;
  let checking = null;

  // AI 相關（聊天、塔羅解讀、審核）忙線不代表整站壞掉，交給各自頁面顯示「AI 休息中」
  const AI_PATHS = /\/api\/(chat|tarot|analyze)|\/ai\/|\/game\/tarot\/reading/;
  const isApi = (url) => String(url || "").startsWith(API) && !AI_PATHS.test(String(url));

  // 問後端首頁：8 秒內有回應（任何 2xx～4xx）就算活著
  async function healthCheck() {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    try {
      const res = await nativeFetch(HEALTH_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      return res.status < 500;
    } catch (e) {
      return false;
    } finally {
      if (t) clearTimeout(t);
    }
  }

  function confirmDown() {
    if (state === "down" || state === "offline") return;
    if (checking) return;
    if (navigator.onLine === false) { setState("offline"); return; }
    state = "checking";
    checking = healthCheck().then((ok) => {
      checking = null;
      if (ok) { state = "up"; return; }
      setState(navigator.onLine === false ? "offline" : "down");
    });
  }

  function setState(next) {
    const wasDown = state === "down" || state === "offline";
    state = next;
    if (next === "down" || next === "offline") {
      render();
      scheduleRetry();
    } else if (next === "up" && wasDown) {
      clearTimeout(retryTimer);
      renderRecovered();
    }
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(async () => {
      if (navigator.onLine === false) { state = "offline"; render(); scheduleRetry(); return; }
      const ok = await healthCheck();
      if (ok) setState("up");
      else { state = "down"; render(); scheduleRetry(); }
    }, RETRY_MS);
  }

  // 包住 fetch：只看主要後端的請求，頁面原本的處理完全不變
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!isApi(url)) return nativeFetch(input, init);
    try {
      const res = await nativeFetch(input, init);
      if (DOWN_CODES.includes(res.status)) confirmDown();
      else if (state === "down" || state === "offline") setState("up");
      return res;
    } catch (err) {
      // 頁面自己取消的請求不算
      if (!(err && err.name === "AbortError")) confirmDown();
      throw err;
    }
  };

  window.addEventListener("online", () => { if (state === "offline") { state = "down"; scheduleRetry(); healthCheck().then((ok) => ok ? setState("up") : null); } });
  window.addEventListener("offline", () => { if (state === "down" || state === "up") { state = "offline"; render(); scheduleRetry(); } });

  // ---------- 畫面 ----------
  const CSS = `
    .srv-status-veil { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 20px;
      background: rgba(6, 30, 52, .55); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; }
    .srv-status-card { width: min(380px, 100%); background: #fff; border-radius: 22px; padding: 28px 24px 22px; text-align: center; color: #14324a;
      box-shadow: 0 18px 50px rgba(0, 0, 0, .3); animation: srvPop .35s cubic-bezier(.18,.89,.32,1.28); }
    @keyframes srvPop { from { transform: scale(.85); opacity: 0; } }
    .srv-status-icon { font-size: 46px; line-height: 1; }
    .srv-status-card h2 { margin: 12px 0 6px; font-size: 22px; letter-spacing: 1px; }
    .srv-status-card p { margin: 6px 0; font-size: 15px; line-height: 1.7; color: #3f5a6e; }
    .srv-status-card .srv-en { font-size: 12px; color: #8aa0b0; }
    .srv-status-retry { margin-top: 10px; font-size: 13px; color: #0b6a8f; }
    .srv-status-btns { display: flex; gap: 10px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
    .srv-status-btns button { font: inherit; font-size: 15px; font-weight: 700; border-radius: 999px; padding: 9px 20px; cursor: pointer; border: 2px solid transparent; }
    .srv-status-reload { background: #0b6a8f; color: #fff; }
    .srv-status-close { background: #fff; color: #0b6a8f; border-color: #bcdbe8 !important; }
    .srv-status-btns button:focus-visible { outline: 3px solid #7cc4de; outline-offset: 2px; }
    .srv-status-bar { position: fixed; left: 0; right: 0; top: 0; z-index: 2147483000; padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 8px;
      background: #fff4d6; color: #7a5300; text-align: center; font: 700 14px "Noto Sans TC", "Microsoft JhengHei", sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    .srv-status-bar button { font: inherit; margin-left: 8px; border: 0; background: #7a5300; color: #fff; border-radius: 999px; padding: 3px 12px; cursor: pointer; }
    .srv-status-bar.is-ok { background: #e3f7ea; color: #1d6b3a; }
    .srv-status-bar.is-ok button { background: #1d6b3a; }
    @media (prefers-reduced-motion: reduce) { .srv-status-card { animation: none; } }
  `;
  function ensureStyle() {
    if (document.getElementById("srv-status-style")) return;
    const st = document.createElement("style");
    st.id = "srv-status-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function onBody(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }
  // 網站切成英文時翻譯卡片文字（i18n.js）；遊戲頁不會自動翻畫面，所以在這裡自己翻
  function localize(el) {
    const I = window.I18N;
    if (!I || I.lang !== "en") return el;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) n.nodeValue = I.t(n.nodeValue);
    return el;
  }
  function clearUi() {
    ["srv-status-veil", "srv-status-bar"].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
  }

  function render() {
    onBody(() => {
      ensureStyle();
      const offline = state === "offline";
      if (dismissed) { renderBar(offline ? "📡 你的網路好像斷線了，連上後會自動恢復" : "🛠️ 伺服器整理中，部分功能暫時無法使用，恢復後會通知你"); return; }
      clearUi();
      const veil = document.createElement("div");
      veil.id = "srv-status-veil";
      veil.className = "srv-status-veil";
      veil.setAttribute("role", "alertdialog");
      veil.setAttribute("aria-labelledby", "srv-status-title");
      veil.innerHTML = offline
        ? `<div class="srv-status-card">
             <div class="srv-status-icon" aria-hidden="true">📡</div>
             <h2 id="srv-status-title">你的網路好像斷線了</h2>
             <p>請檢查 Wi-Fi 或行動網路，連上之後會自動恢復。</p>
             <p class="srv-en">You seem to be offline.</p>
             <div class="srv-status-btns"><button type="button" class="srv-status-reload">重新整理</button><button type="button" class="srv-status-close">先關閉</button></div>
           </div>`
        : `<div class="srv-status-card">
             <div class="srv-status-icon" aria-hidden="true">🛠️</div>
             <h2 id="srv-status-title">伺服器整理中</h2>
             <p>海巡隊正在整理這片海域，請不用擔心，你的帳號和瓶子都安全保存著。</p>
             <p>請稍後再回來，我們很快就會恢復 🌊</p>
             <p class="srv-en">The server is under maintenance. Your data is safe — please check back soon.</p>
             <div class="srv-status-retry">每 15 秒會自動檢查一次，恢復時會通知你</div>
             <div class="srv-status-btns"><button type="button" class="srv-status-reload">重新整理</button><button type="button" class="srv-status-close">先關閉</button></div>
           </div>`;
      veil.querySelector(".srv-status-reload").addEventListener("click", () => location.reload());
      veil.querySelector(".srv-status-close").addEventListener("click", () => { dismissed = true; render(); });
      document.body.appendChild(localize(veil));
      veil.querySelector(".srv-status-reload").focus({ preventScroll: true });
    });
  }

  function renderBar(text, ok) {
    onBody(() => {
      ensureStyle();
      clearUi();
      const bar = document.createElement("div");
      bar.id = "srv-status-bar";
      bar.className = "srv-status-bar" + (ok ? " is-ok" : "");
      bar.setAttribute("role", "status");
      bar.textContent = text;
      if (ok) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "重新整理";
        btn.addEventListener("click", () => location.reload());
        bar.appendChild(btn);
      }
      document.body.appendChild(localize(bar));
    });
  }

  function renderRecovered() {
    dismissed = false;
    renderBar("✅ 伺服器恢復了！重新整理一下就能繼續使用", true);
  }

  // 給測試或其他程式用：手動觸發檢查
  window.ServerStatus = { check: confirmDown, state: () => state };
})();
