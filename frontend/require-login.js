// 🎮 遊戲、AI 特助要登入才能用：放在頁面 <head> 最前面，沒有登入憑證就先請他去登入
//    （這裡只是擋畫面，後端的遊戲 API 也都要求登入）
(function () {
  let token = null;
  try {
    token = localStorage.getItem("authToken");
  } catch (e) {
    /* 讀不到本機儲存就當作沒登入 */
  }
  if (token) return;

  // 用這支檔案自己的位置找 login.html，子資料夾裡的遊戲頁（塔羅）也能用
  const loginUrl = new URL("login.html", document.currentScript.src).href;
  // 提示文字可以用 data-message 換掉（例如 AI 特助頁），沒寫就是遊戲頁的說法
  const message = document.currentScript.dataset.message || "要先登入才能玩遊戲喔！🎮";

  // 先把頁面藏起來（只留彈窗），免得遊戲畫面一閃而過
  const hide = document.createElement("style");
  hide.textContent = "body > *:not(.od-veil) { visibility: hidden !important; } body { background: #0b3a5e !important; }";
  document.head.appendChild(hide);

  // 等頁面上的 ocean_dialog.js 載入好，用網站風格的彈窗提示；按「前往登入」才跳頁
  document.addEventListener("DOMContentLoaded", () => {
    if (window.oceanLogin) window.oceanLogin(message, { force: true });
    else {
      (window.oceanNativeAlert || window.alert)(message);
      window.location.replace(loginUrl);
    }
  });
})();
