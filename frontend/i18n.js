/* 🌐 中英切換（全站共用）
 *
 * 每頁的 <head> 依序載入：config.js → i18n-en.js → i18n.js → server-status.js
 * 語言存在 localStorage 的 site_lang（zh / en），在首頁「網站設定」切換。
 *
 * 做法：切成英文時，把畫面上「整段等於字典原文」的中文換成英文，之後動態加進來的畫面也會自動換；
 *   - 字典在 i18n-en.js（中文原文 → 英文），{x} 是會變的部分（數字、名字）
 *   - 程式裡的中文完全不動，所以用中文判斷的邏輯不受影響
 *   - 使用者寫的內容（瓶子、留言、名字、自介）不翻：放在 SKIP 裡的區塊、或加上 data-no-i18n
 *   - 有自己中英切換的頁面（遊戲、教學、AI 聊天），<html data-i18n="own">：
 *     不自動翻畫面，只跟著這裡的設定決定一開始用哪個語言
 * 打 API 時會帶 X-Site-Lang: en，後端就回英文訊息。
 *
 *   I18N.lang         目前語言 "zh" / "en"
 *   I18N.t(中文)       翻成目前語言（找不到就原樣回傳）
 *   I18N.setLang(語言) 存起來並重新整理頁面
 */
(function () {
  if (window.I18N) return;

  const KEY = "site_lang";
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  let lang = read(KEY);
  if (lang !== "en" && lang !== "zh") lang = "zh";
  const own = document.documentElement.getAttribute("data-i18n") === "own";
  document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";

  const CJK = /[㐀-鿿]/;
  const exact = new Map();
  const patterns = [];
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  Object.entries(window.I18N_EN || {}).forEach(([zh, en]) => {
    if (zh.includes("{x}")) {
      const re = new RegExp("^" + zh.split("{x}").map(escapeRe).join("([\\s\\S]+?)") + "$");
      patterns.push({ re, en, len: zh.length });
    } else {
      exact.set(zh, en);
    }
  });
  patterns.sort((a, b) => b.len - a.len); // 越長越精準，先比對
  // 對話框的訊息常是好幾段接起來的，用「段落代換」：長的先換
  const pieces = [...exact.keys()].filter((k) => k.length >= 2 && CJK.test(k)).sort((a, b) => b.length - a.length);

  // 被代進 {x} 的部分（例如星期幾、海域名稱）也試著翻；用「、」接起來的清單逐項翻
  function trPart(s, depth) {
    const t = s.trim();
    if (!CJK.test(t)) return s;
    const r = core(t, depth + 1);
    if (r != null) return s.replace(t, r);
    if (t.includes("、")) {
      const parts = t.split("、").map((p) => core(p.trim(), depth + 1));
      if (parts.every((p) => p != null)) return s.replace(t, parts.join(", "));
    }
    return s;
  }

  function core(t, depth = 0) {
    const hit = exact.get(t);
    if (hit != null) return hit;
    if (depth > 2) return null;
    for (const p of patterns) {
      const m = p.re.exec(t);
      if (!m) continue;
      let i = 1;
      return p.en.replace(/\{x\}/g, () => trPart(m[i++] ?? "", depth));
    }
    return null;
  }

  // 前後的表情符號、標點不影響比對：「🎉 已儲存！」字典只有「已儲存！」也找得到
  const EDGE = /^([^㐀-鿿A-Za-z0-9「『【（(#]*)([\s\S]*?)([^㐀-鿿A-Za-z0-9」』】）)%。！？!?…~～]*)$/u;

  function t(s, opts) {
    if (lang !== "en" || s == null) return s;
    s = String(s);
    if (!CJK.test(s)) return s;
    const lead = s.match(/^\s*/)[0];
    const trail = s.slice(lead.length).match(/\s*$/)[0];
    const body = s.slice(lead.length, s.length - trail.length);
    let r = core(body);
    if (r == null) {
      const m = body.match(EDGE);
      if (m && (m[1] || m[3])) {
        const inner = core(m[2].trim());
        if (inner != null) r = m[1] + inner + m[3];
      }
    }
    if (r == null && opts && opts.pieces) {
      let out = body;
      for (const k of pieces) if (out.includes(k)) out = out.split(k).join(exact.get(k));
      if (out !== body) r = out;
    }
    return r == null ? s : lead + r + trail;
  }

  function setLang(next) {
    next = next === "en" ? "en" : "zh";
    write(KEY, next);
    // 遊戲和 AI 聊天原本各自記語言，一起改掉
    write("game_lang", next);
    write("chat_lang", next === "en" ? "en" : "zh-TW");
    location.reload();
  }

  window.I18N = { lang, own, t, setLang };
  if (lang !== "en") return;

  // ---------- 打 API 時告訴後端要英文 ----------
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (typeof API_BASE_URL !== "undefined" && String(url).startsWith(API_BASE_URL)) {
        init = Object.assign({}, init);
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        headers.set("X-Site-Lang", "en");
        init.headers = headers;
      }
    } catch (e) {}
    return nativeFetch(input, init);
  };

  // 瀏覽器內建的 alert / confirm / prompt（ocean_dialog.js 載入後會換成網站彈窗，那邊也會翻）
  ["alert", "confirm", "prompt"].forEach((fn) => {
    const orig = window[fn] && window[fn].bind(window);
    if (!orig) return;
    window[fn] = (msg, ...rest) => orig(t(msg, { pieces: true }), ...rest);
  });

  if (own) return;

  // ---------- 自動翻譯畫面 ----------
  // 使用者寫的內容不翻（就算剛好跟介面文字一樣）
  const SKIP = [
    "script", "style", "textarea", "[contenteditable]", "[data-no-i18n]",
    ".md-content", ".post-card h2", ".post-card p", ".post-card > div:first-child > div:last-child",
    "#detail-author-tag", "#detail-post-title", "#detail-post-content",
    ".detail-title", ".detail-content", ".reply-author", ".comment-author", "[data-block-name]",
    ".following-name", ".popular-item-title", ".poll-opt-text", ".bio-content", ".info-bio",
    "#detail-bio", "#detail-name", "#user-name", ".user-name-text", ".detail-author-name",
    "#block-target-name", ".history-item", ".ext-link-host", ".ext-link-url", "#pf-name", "#pf-bio",
    ".profile-name", ".note-text", ".cs-user-content",
  ].join(",");
  // 上面那些位置沒有內容時會顯示的系統文字（例如沒登入時名字處的「請先登入」），照樣翻
  const ALWAYS = new Set([
    "請先登入", "匿名", "匿名使用者", "已註銷使用者", "未知使用者", "神秘海友", "這位使用者", "用戶",
    "作者", "姓名", "未填寫", "尚未填寫...", "尚未填寫自我介紹...", "這個人還沒有寫自我介紹",
    "載入中...", "讀取中…", "（無標題）", "無標題貼文", "［貼圖］", "管理員", "📝 自我介紹：",
    "還沒有寫自我介紹，按「編輯個人資料」寫一點吧～",
  ]);
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];

  const skipped = (el) => !el || (el.closest && el.closest(SKIP));

  function doText(node) {
    const v = node.nodeValue;
    if (!v || !CJK.test(v)) return;
    const parent = node.parentElement;
    if (skipped(parent) && !ALWAYS.has(v.trim())) return;
    const r = t(v);
    if (r === v) return;
    // <option> 沒寫 value 時，送出的值就是文字；先把中文原文記成 value，翻譯才不會改到送出的值
    if (parent && parent.tagName === "OPTION" && !parent.hasAttribute("value")) parent.setAttribute("value", v.trim());
    node.nodeValue = r;
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && CJK.test(v)) {
        const r = t(v);
        if (r !== v) el.setAttribute(a, r);
      }
    }
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && CJK.test(el.value)) {
      el.value = t(el.value);
    }
  }
  function collectAlways(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (ALWAYS.has(n.nodeValue.trim())) doText(n);
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (skipped(root)) {
      collectAlways(root);
      if (root.tagName === "TEXTAREA") doAttrs(root);
      return;
    }
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType !== 1 || !n.matches(SKIP)) return NodeFilter.FILTER_ACCEPT;
        // 使用者內容的區塊不往裡面翻，但裡面系統文字（例如沒登入的「請先登入」）照樣翻
        collectAlways(n);
        if (n.tagName === "TEXTAREA") doAttrs(n); // 輸入框的提示文字要翻，內容不翻
        return NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else doAttrs(n);
    }
  }

  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes" && m.target.nodeType === 1 && (m.target.tagName === "TEXTAREA" || !skipped(m.target))) doAttrs(m.target);
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });
  document.addEventListener("DOMContentLoaded", () => walk(document.documentElement));
})();
