// 🎮 遊戲要登入才能玩：放在遊戲頁 <head> 最前面，沒有登入憑證就先請他去登入
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
  alert("要先登入才能玩遊戲喔！🎮");
  window.location.replace(loginUrl);
})();
