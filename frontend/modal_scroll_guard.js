/* 📱 彈窗打開時，不讓手指的拉動傳到後面的網頁（全站共用）
 * iPhone Safari：在發文等彈窗裡捲到最上面再往下拉，會變成「下拉重新整理」，寫到一半的內容就不見了。
 * 1. 有彈窗打開時，<html> 加上 modal-open：關掉整頁捲動和下拉重新整理（iOS 16 以上靠 CSS 就夠）
 * 2. iOS 15 以前不支援 overscroll-behavior，改成在手指拉動時檢查：
 *    彈窗裡的捲動區已經到頂／到底還繼續拉，就攔下來，不讓它變成整頁捲動或重新整理
 */
(function () {
  const MODAL_SELECTOR = '.modal, .up-modal, .cute-modal, [role="dialog"], [aria-modal="true"], #edit-bottle-modal';
  const root = document.documentElement;

  const style = document.createElement("style");
  style.textContent = `
    html.modal-open, html.modal-open body { overflow: hidden !important; overscroll-behavior: none !important; }
    ${MODAL_SELECTOR}, .modal-content, .up-card, .up-body, .cute-modal-content { overscroll-behavior: contain; }
  `;
  (document.head || root).appendChild(style);

  const isShown = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const openModals = () => Array.from(document.querySelectorAll(MODAL_SELECTOR)).filter(isShown);

  let queued = false;
  function refresh() {
    queued = false;
    root.classList.toggle("modal-open", openModals().length > 0);
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  function start() {
    // 彈窗都是改 style / class 來開關，或是動態加進頁面
    new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden", "open"] });
    refresh();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  // ---------- iOS 15 以前的備案：手動攔下「捲到底還在拉」 ----------
  if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("overscroll-behavior", "contain")) return;

  const canScroll = (el) => {
    const oy = getComputedStyle(el).overflowY;
    return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
  };
  let startX = 0, startY = 0;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!root.classList.contains("modal-open") || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dy = t.clientY - startY; // > 0：手指往下拉（內容往上捲）
    const dx = t.clientX - startX;
    startX = t.clientX; startY = t.clientY; // 每次都跟上一次比，同一次滑動中途換方向也判斷得對
    if (Math.abs(dx) > Math.abs(dy)) return; // 左右滑（例如貼圖分頁）不管
    const modal = e.target instanceof Element ? e.target.closest(MODAL_SELECTOR) : null;
    if (!modal) { e.preventDefault(); return; } // 拉的是彈窗外面（後面的網頁）
    // 從手指底下往外找捲動區，找到還能往那個方向捲的就放行
    for (let el = e.target; el && el !== modal.parentElement; el = el.parentElement) {
      if (!(el instanceof Element) || !canScroll(el)) continue;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && !atTop) || (dy < 0 && !atBottom)) return;
    }
    e.preventDefault();
  }, { passive: false });
})();
