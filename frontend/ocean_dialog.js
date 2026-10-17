/* 🌊 心情漂流瓶的彈窗（全站共用），取代瀏覽器內建的 alert / confirm / prompt
 *
 *   oceanAlert(訊息, 選項)    → Promise，按「確定」後結束
 *   oceanConfirm(訊息, 選項)  → Promise<true/false>
 *   oceanPrompt(訊息, 選項)   → Promise<輸入的文字 / null>
 *   oceanLogin(訊息, 選項)    → 請他去登入：「前往登入」＋「再逛逛」（force: true 只有前往登入）
 *
 * 選項：{ title, icon, okText, cancelText, danger, defaultValue, okHref }
 *   okHref：「確定」做成真正的連結（新分頁開啟），等按完才 window.open 會被瀏覽器當成彈出視窗擋掉
 * 訊息開頭的表情符號會變成上面的大圖示；沒有的話依內容自動挑（成功、失敗、提醒）。
 * window.alert 也換成這個（不會卡住程式）：alert 後面緊接著換頁的地方，要改成 await oceanAlert(...)。
 */
(function () {
  if (window.oceanAlert) return;

  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : location.href;
  const LOGIN_URL = new URL("login.html", SCRIPT_SRC).href;
  const nativeAlert = window.alert.bind(window);

  const CSS = `
  .od-veil { position: fixed; inset: 0; z-index: 2147482500; display: flex; align-items: center; justify-content: center;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    background: rgba(6, 30, 52, .55); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; overscroll-behavior: contain;
    animation: odFade .2s ease-out; }
  .od-card { position: relative; width: min(400px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column;
    background: #fff; border-radius: 26px; overflow: hidden; color: #1e3a50; text-align: center;
    box-shadow: 0 22px 60px rgba(0, 20, 40, .35); animation: odPop .32s cubic-bezier(.18, .89, .32, 1.28); }
  .od-wave { height: 74px; flex: none; background: linear-gradient(135deg, #2a8fc4, #0b5a8c); position: relative; }
  .od-wave::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 26px;
    background: radial-gradient(60% 26px at 50% 100%, #fff 98%, transparent 100%); }
  .od-card.is-danger .od-wave { background: linear-gradient(135deg, #f08a6c, #c8463c); }
  .od-card.is-success .od-wave { background: linear-gradient(135deg, #43c59e, #1f8a70); }
  .od-icon { position: absolute; left: 50%; top: 30px; transform: translateX(-50%); width: 76px; height: 76px; border-radius: 50%;
    background: #fff; display: flex; align-items: center; justify-content: center; font-size: 40px; line-height: 1;
    box-shadow: 0 8px 20px rgba(0, 40, 80, .18); z-index: 1; }
  .od-body { padding: 44px 24px 4px; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .od-title { margin: 0 0 6px; font-size: 1.2rem; font-weight: 900; color: #0b4a75; letter-spacing: .5px; }
  .od-msg { margin: 0; font-size: 1rem; line-height: 1.75; white-space: pre-line; word-break: break-word; color: #34506a; }
  .od-input { display: block; width: 100%; box-sizing: border-box; margin-top: 14px; padding: 12px 16px; font: inherit; font-size: 16px;
    color: #1e3a50; background: #f3f8fc; border: 2px solid #cfe5f3; border-radius: 14px; outline: none; }
  .od-input:focus { border-color: #2a8fc4; background: #fff; }
  .od-btns { display: flex; gap: 10px; padding: 20px 22px 22px; flex: none; }
  .od-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; box-sizing: border-box; min-height: 48px; padding: 0 18px; border-radius: 999px; font: inherit; font-size: 1rem; font-weight: 800;
    cursor: pointer; border: 2px solid transparent; transition: transform .12s, filter .12s; -webkit-tap-highlight-color: transparent; }
  .od-btn:active { transform: scale(.97); }
  .od-btn:focus-visible { outline: 3px solid #7cc4de; outline-offset: 2px; }
  .od-ok { background: linear-gradient(135deg, #2a8fc4, #0b5a8c); color: #fff; box-shadow: 0 6px 16px rgba(11, 90, 140, .3); }
  .od-ok:hover { filter: brightness(1.08); }
  .od-card.is-danger .od-ok { background: linear-gradient(135deg, #f08a6c, #c8463c); box-shadow: 0 6px 16px rgba(200, 70, 60, .3); }
  .od-cancel { background: #fff; color: #0b5a8c; border-color: #cfe5f3; }
  .od-cancel:hover { background: #f3f8fc; }
  @media (max-width: 360px) { .od-btns { flex-direction: column-reverse; } .od-body { padding-left: 18px; padding-right: 18px; } }
  @keyframes odFade { from { opacity: 0; } }
  @keyframes odPop { from { transform: scale(.86); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .od-veil, .od-card { animation: none; } }
  `;

  function ensureStyle() {
    if (document.getElementById("od-style")) return;
    const st = document.createElement("style");
    st.id = "od-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  const whenBody = () => new Promise((r) => (document.body ? r() : document.addEventListener("DOMContentLoaded", r, { once: true })));

  // 訊息開頭的表情符號 → 大圖示；沒有就依內容挑
  const EMOJI_HEAD = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic})|\p{Emoji_Modifier})*)\s*/u;
  function splitIcon(msg, opts, kind) {
    let text = String(msg ?? "");
    let icon = opts.icon;
    const m = text.match(EMOJI_HEAD);
    if (m && !icon) { icon = m[1]; text = text.slice(m[0].length); }
    let tone = opts.danger ? "danger" : "";
    if (!icon) {
      if (/失敗|錯誤|無法|不能|不可以|過期|逾時|找不到|fail|error|expired/i.test(text)) icon = "⚠️";
      else if (/成功|完成|已經?送出|已更新|已儲存|謝謝|success|done/i.test(text)) icon = "🎉";
      else if (/登入|log ?in/i.test(text)) icon = "🔑";
      else icon = kind === "confirm" ? "🤔" : "🐟";
    }
    if (!tone && /^(🎉|✅|🥳|💙|✨)$/u.test(icon)) tone = "success";
    if (!tone && kind === "confirm" && /刪除|註銷|移除|下架|停用|封鎖|delete|remove/i.test(text)) tone = "danger";
    return { text: text.trim(), icon, tone };
  }
  // 訊息沒有中日文就用英文按鈕（遊戲切成英文時）
  const isEnglish = (s) => !/[぀-ヿ㐀-鿿]/.test(s);

  let chain = Promise.resolve();
  function open(kind, msg, opts = {}) {
    const run = () => new Promise(async (resolve) => {
      await whenBody();
      ensureStyle();
      const { text, icon, tone } = splitIcon(msg, opts, kind);
      const en = isEnglish(text + (opts.title || ""));
      const okText = opts.okText || (kind === "login" ? (en ? "Log in" : "前往登入") : en ? "OK" : "確定");
      const cancelText = (opts.cancelText !== false && opts.cancelText) || (kind === "login" ? (en ? "Not now" : "再逛逛") : en ? "Cancel" : "取消");
      // cancelText: false → 只留一個按鈕（例如「請手動複製」只需要關閉）
      const hasCancel = opts.cancelText !== false && (kind === "confirm" || kind === "prompt" || (kind === "login" && !opts.force));

      const prevFocus = document.activeElement;
      const veil = document.createElement("div");
      veil.className = "od-veil";
      veil.setAttribute("role", kind === "alert" ? "alertdialog" : "dialog");
      veil.setAttribute("aria-modal", "true");
      veil.innerHTML = `
        <div class="od-card ${tone ? "is-" + tone : ""}">
          <div class="od-wave"></div>
          <div class="od-icon" aria-hidden="true"></div>
          <div class="od-body">
            ${opts.title ? '<h2 class="od-title"></h2>' : ""}
            <p class="od-msg"></p>
            ${kind === "prompt" ? '<input class="od-input" type="text" autocomplete="off">' : ""}
          </div>
          <div class="od-btns">
            ${hasCancel ? '<button type="button" class="od-btn od-cancel"></button>' : ""}
            ${opts.okHref ? '<a class="od-btn od-ok" target="_blank" rel="noopener noreferrer nofollow"></a>' : '<button type="button" class="od-btn od-ok"></button>'}
          </div>
        </div>`;
      veil.querySelector(".od-icon").textContent = icon;
      if (opts.title) veil.querySelector(".od-title").textContent = opts.title;
      veil.querySelector(".od-msg").textContent = text;
      veil.querySelector(".od-ok").textContent = okText;
      if (opts.okHref) veil.querySelector(".od-ok").href = opts.okHref;
      if (hasCancel) veil.querySelector(".od-cancel").textContent = cancelText;
      const input = veil.querySelector(".od-input");
      if (input) input.value = opts.defaultValue ?? "";
      const msgId = "od-msg-" + Date.now();
      veil.querySelector(".od-msg").id = msgId;
      veil.setAttribute("aria-describedby", msgId);

      const close = (ok) => {
        document.removeEventListener("keydown", onKey, true);
        veil.remove();
        if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) {}
        if (kind === "confirm") resolve(ok);
        else if (kind === "prompt") resolve(ok ? input.value : null);
        else if (kind === "login") { if (ok) window.location.href = LOGIN_URL; resolve(ok); }
        else resolve();
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); close(kind === "alert"); }
        else if (e.key === "Enter" && (document.activeElement === input || !document.activeElement || !document.activeElement.matches(".od-cancel"))) {
          e.preventDefault();
          if (opts.okHref) veil.querySelector(".od-ok").click(); // 連結要真的點下去才會開
          else close(true);
        }
        else if (e.key === "Tab") {
          // 焦點留在彈窗裡
          const items = [...veil.querySelectorAll("button, input, a")];
          const i = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
      };
      veil.querySelector(".od-ok").addEventListener("click", () => close(true));
      if (hasCancel) veil.querySelector(".od-cancel").addEventListener("click", () => close(false));
      // 點外面：只有「確定／取消」類的才當作取消，單純提示要按確定
      veil.addEventListener("click", (e) => { if (e.target === veil && hasCancel) close(false); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(veil);
      (input || veil.querySelector(".od-ok")).focus({ preventScroll: true });
      if (input) input.select();
    });
    // 一次只顯示一個，後面的排隊
    const p = chain.then(run);
    chain = p.catch(() => {});
    return p;
  }

  window.oceanAlert = (msg, opts) => open("alert", msg, opts);
  window.oceanConfirm = (msg, opts) => open("confirm", msg, opts);
  window.oceanPrompt = (msg, opts) => open("prompt", msg, opts);
  window.oceanLogin = (msg, opts) => open("login", msg, opts);
  window.alert = (msg) => { open("alert", msg); };
  window.oceanNativeAlert = nativeAlert; // 真的需要擋住程式時才用
})();
