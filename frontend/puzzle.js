// ==================================================
// 🌐 多國語言 (i18n) 字典與狀態
// ==================================================
const translations = {
  zh: {
    "toggle-btn": "🌐 EN",
    "back-btn": "<span class='btn-icon'>🔙</span> 回遊樂場",
    "workshop-nav": "<span class='btn-icon'>📦</span> 碎片工坊",
    "gallery-nav": "<span class='btn-icon'>🖼️</span> 我的收藏",
    "gacha-title": "海域碎片喚醒",
    "idle-summon": "等待喚醒",
    "token-label": "喚醒石",
    "frag-badge-label": "普通/高級",
    "draw-btn": "消耗 1 顆喚醒石抽取",
    "task-panel-title": "每日任務 (獲取喚醒石)",
    "task-1-title": "每日簽到",
    "task-1-desc": "登入海洋世界報到",
    "claim-1-stone": "領取 1 顆",
    "claimed-btn": "已領取 ✔️",
    "task-2-title": "漂流初探",
    "task-2-desc": "累積發文 3 篇",
    "task-3-title": "侃侃而談",
    "task-3-desc": "累積發文 6 篇",
    "task-4-title": "海洋話匣子",
    "task-4-desc": "累積發文 10 篇",
    "task-locked": "未達成",
    "workshop-modal-title": "📦 碎片工坊與寶箱",
    "inv-normal-frag": "🧩 普通碎片：",
    "inv-prem-frag": "✨ 高級碎片：",
    "inv-normal-chest": "🎁 普通寶箱：",
    "inv-prem-chest": "👑 高級寶箱：",
    "chest-section-title": "🎁 開啟寶箱 (必得拼圖碎片)",
    "chest-normal-name": "普通寶箱",
    "chest-normal-desc": "必得普通稀有度碎片",
    "chest-prem-name": "高級寶箱",
    "chest-prem-desc": "必得高級稀有度碎片",
    "open-1-btn": "開啟 1 個",
    "exchange-section-title": "🔄 碎片兌換工坊",
    "exch-1": "10 普通碎片 ➔ 1 普通寶箱",
    "exch-2": "30 普通碎片 ➔ 1 高級寶箱",
    "exch-3": "1 高級碎片 ➔ 10 普通寶箱",
    "exch-4": "5 高級碎片 ➔ 1 高級寶箱",
    "exch-btn": "兌換",
    "gallery-modal-title": "🖼️ 拼圖收藏展示櫃",
    "page-prev": "⬅️ 上一頁",
    "page-next": "下一頁 ➡️",
    "page-text-1": "第",
    "page-text-2": "頁 (共",
    "page-text-3": "筆)",
    "puzzle-completed": "已集齊 (9/9)",
    "puzzle-progress": "碎片進度:",
    "rarity-normal": "NORMAL 普通",
    "rarity-prem": "✨ PREMIUM 高級",
    "shard-num-tag": "第 {num} 號碎片",
    "draw-congrats": "🎉 恭喜集齊完整拼圖！",
    "draw-progress": "收集進度：{count} / 9 ({rate})",
    "err-no-login": "請先登入後再進行碎片喚醒唷！🌊",
    "err-signin-done": "今天已經領取過簽到獎勵囉！明天再來吧～🌊",
    "empty-gallery": "目前還沒有圖鑑資料唷！🌊",
    "server-error": "伺服器連線中斷 😢"
  },
  en: {
    "toggle-btn": "🌐 中文",
    "back-btn": "<span class='btn-icon'>🔙</span> Arcade",
    "workshop-nav": "<span class='btn-icon'>📦</span> Workshop",
    "gallery-nav": "<span class='btn-icon'>🖼️</span> Gallery",
    "gacha-title": "Ocean Shard Awakening",
    "idle-summon": "Ready to Summon",
    "token-label": "Stones",
    "frag-badge-label": "Norm / Prem",
    "draw-btn": "Use 1 Stone to Summon",
    "task-panel-title": "Daily Quests (Get Stones)",
    "task-1-title": "Daily Check-in",
    "task-1-desc": "Log in to ocean realm",
    "claim-1-stone": "Claim 1",
    "claimed-btn": "Claimed ✔️",
    "task-2-title": "First Drift",
    "task-2-desc": "Post 3 bottles",
    "task-3-title": "Chatterbox",
    "task-3-desc": "Post 6 bottles",
    "task-4-title": "Ocean Speaker",
    "task-4-desc": "Post 10 bottles",
    "task-locked": "Locked",
    "workshop-modal-title": "📦 Fragment Workshop",
    "inv-normal-frag": "🧩 Normal Frags: ",
    "inv-prem-frag": "✨ Premium Frags: ",
    "inv-normal-chest": "🎁 Normal Chests: ",
    "inv-prem-chest": "👑 Premium Chests: ",
    "chest-section-title": "🎁 Open Chests (Guaranteed Shards)",
    "chest-normal-name": "Normal Chest",
    "chest-normal-desc": "Guaranteed normal shard",
    "chest-prem-name": "Premium Chest",
    "chest-prem-desc": "Guaranteed premium shard",
    "open-1-btn": "Open 1",
    "exchange-section-title": "🔄 Shard Exchange",
    "exch-1": "10 Normal Frags ➔ 1 Normal Chest",
    "exch-2": "30 Normal Frags ➔ 1 Premium Chest",
    "exch-3": "1 Premium Frag ➔ 10 Normal Chests",
    "exch-4": "5 Premium Frags ➔ 1 Premium Chest",
    "exch-btn": "Trade",
    "gallery-modal-title": "🖼️ Puzzle Showcase",
    "page-prev": "⬅️ Prev",
    "page-next": "Next ➡️",
    "page-text-1": "Page",
    "page-text-2": " / ",
    "page-text-3": " (Total ",
    "puzzle-completed": "Completed (9/9)",
    "puzzle-progress": "Progress:",
    "rarity-normal": "NORMAL",
    "rarity-prem": "✨ PREMIUM",
    "shard-num-tag": "Piece #{num}",
    "draw-congrats": "🎉 Puzzle Complete!",
    "draw-progress": "Progress: {count} / 9 ({rate})",
    "err-no-login": "Please log in before summoning shards! 🌊",
    "err-signin-done": "Already claimed today! Come back tomorrow~ 🌊",
    "empty-gallery": "No puzzle collections yet! 🌊",
    "server-error": "Server connection interrupted 😢"
  }
};

let currentLang = localStorage.getItem("game_lang") || "zh";

function applyTranslations() {
  const dict = translations[currentLang] || translations.zh;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  const toggleBtn = document.getElementById("lang-toggle-btn");
  if (toggleBtn) {
    toggleBtn.innerText = dict["toggle-btn"];
  }

  checkDailySignInStatus();
  if (galleryPictures.length > 0) {
    renderGalleryPage(currentGalleryPage);
  }
}

window.toggleLanguage = function () {
  currentLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("game_lang", currentLang);
  applyTranslations();
};

// ==================================================
// 🌐 API 統一設定與全域狀態管理
// ==================================================
const API_BASE_URL = "https://api.drift-bottles.xyz";

let drawTokens = parseInt(localStorage.getItem("puzzle_tokens") || "0", 10);
let galleryPictures = [];
let currentGalleryPage = 1;
const ITEMS_PER_PAGE = 6;
let isDrawing = false; // 🔒 防連點抽卡旗標

function getFullImageUrl(url) {
  if (!url) return "images/fish_logo.png";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getPieceCropStyle(pieceNumber, imageUrl) {
  const row = Math.floor((pieceNumber - 1) / 3);
  const col = (pieceNumber - 1) % 3;
  const posX = col * 50;
  const posY = row * 50;
  return `background-image: url('${imageUrl}'); background-size: 300% 300%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
}

function renderPuzzleFrameHTML(unlockedPieces, fullImg, isCompleted, isLocked) {
  if (isLocked) {
    return `
      <div class="puzzle-board-frame">
        <img src="${fullImg}" class="locked-preview-img" onerror="this.src='images/fish_logo.png'" />
        <div class="lock-icon">🔒</div>
      </div>
    `;
  }

  if (isCompleted) {
    return `
      <div class="puzzle-board-frame completed">
        <img src="${fullImg}" class="completed-img" onerror="this.src='images/fish_logo.png'" />
        <div class="frame-shine"></div>
      </div>
    `;
  }

  let cellsHtml = "";
  for (let i = 1; i <= 9; i++) {
    const isPieceUnlocked = unlockedPieces.includes(i);
    if (isPieceUnlocked) {
      cellsHtml += `
        <div class="puzzle-piece-cell unlocked" style="${getPieceCropStyle(i, fullImg)}">
          <span class="piece-num-tag">${i}</span>
        </div>
      `;
    } else {
      cellsHtml += `
        <div class="puzzle-piece-cell locked-slot">
          <span>${i}</span>
        </div>
      `;
    }
  }

  return `
    <div class="puzzle-board-frame in-progress-grid">
      ${cellsHtml}
    </div>
  `;
}

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ==================================================
// 💎 喚醒石、庫存與簽到任務
// ==================================================
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function checkDailySignInStatus() {
  const signBtn = document.getElementById("daily-sign-btn");
  if (!signBtn) return;

  const dict = translations[currentLang] || translations.zh;
  const today = getTodayDateString();
  const lastSignDate = localStorage.getItem("puzzle_last_sign_date");

  if (lastSignDate === today) {
    signBtn.disabled = true;
    signBtn.classList.remove("active");
    signBtn.innerText = dict["claimed-btn"];
    signBtn.style.background = "rgba(255, 255, 255, 0.1)";
    signBtn.style.color = "#4facfe";
  } else {
    signBtn.disabled = false;
    signBtn.classList.add("active");
    signBtn.innerHTML = `<span>${dict["claim-1-stone"]}</span>`;
    signBtn.style.background = "";
    signBtn.style.color = "";
  }
}

function claimToken(btnElement, amount) {
  const dict = translations[currentLang] || translations.zh;
  const today = getTodayDateString();
  const lastSignDate = localStorage.getItem("puzzle_last_sign_date");

  if (lastSignDate === today) {
    alert(dict["err-signin-done"]);
    checkDailySignInStatus();
    return;
  }

  localStorage.setItem("puzzle_last_sign_date", today);
  drawTokens += amount;
  localStorage.setItem("puzzle_tokens", drawTokens);

  checkDailySignInStatus();
  updateTokenDisplay();
}

function updateTokenDisplay() {
  const tokenCountEl = document.getElementById("token-count");
  const drawBtn = document.getElementById("draw-btn");

  if (tokenCountEl) tokenCountEl.innerText = drawTokens;
  if (drawBtn) drawBtn.disabled = drawTokens <= 0 || isDrawing;
}

async function fetchInventory() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/game/collect/inventory`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const { data } = await res.json();
      const fragEl = document.getElementById("fragment-counts");
      if (fragEl) {
        fragEl.innerText = `${data.normal_fragments || 0} / ${data.premium_fragments || 0}`;
      }

      const elNFrag = document.getElementById("inv-normal-frag");
      const elPFrag = document.getElementById("inv-premium-frag");
      const elNChest = document.getElementById("inv-normal-chest");
      const elPChest = document.getElementById("inv-premium-chest");

      if (elNFrag) elNFrag.innerText = data.normal_fragments || 0;
      if (elPFrag) elPFrag.innerText = data.premium_fragments || 0;
      if (elNChest) elNChest.innerText = data.normal_chests || 0;
      if (elPChest) elPChest.innerText = data.premium_chests || 0;
    }
  } catch (e) {
    console.error("更新庫存失敗:", e);
  }
}

// ==================================================
// 🔮 抽卡喚醒系統 (Gacha Draw)
// ==================================================
async function performDraw() {
  const dict = translations[currentLang] || translations.zh;
  if (drawTokens <= 0 || isDrawing) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    alert(dict["err-no-login"]);
    window.location.href = "login.html";
    return;
  }

  const drawBtn = document.getElementById("draw-btn");
  const crystal = document.getElementById("crystal-ball");
  if (!crystal || !drawBtn) return;

  isDrawing = true;
  drawBtn.disabled = true;

  crystal.className = "crystal-ball drawing";
  crystal.innerHTML = `
    <div class="crystal-core"></div>
    <svg class="crack-svg" viewBox="0 0 100 100">
      <path class="crack-line" style="animation-duration: 0.7s; stroke-dasharray: 150; stroke-dashoffset: 150;" 
            d="M 50,0 L 52,25 L 42,48 L 60,70 L 48,88 L 50,100" />
      <path class="crack-line" style="animation-duration: 0.45s; animation-delay: 0.25s; stroke-dasharray: 80; stroke-dashoffset: 80;" 
            d="M 42,48 L 20,52 L 8,42" />
      <path class="crack-line" style="animation-duration: 0.45s; animation-delay: 0.5s; stroke-dasharray: 80; stroke-dashoffset: 80;" 
            d="M 60,70 L 82,65 L 94,80" />
    </svg>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/game/collect/unlock`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ obtained_from: "DAILY_TASK" })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "喚醒失敗");
    }

    const resData = await response.json();
    const result = resData.data || {};
    const pic = result.picture || {};
    const drawnPiece = result.drawnPiece || 1;
    const unlockedPieces = result.puzzleProgress?.unlocked_pieces || [drawnPiece];
    const isCompletedNow = Boolean(result.isCompletedNow);
    const rarity = pic.rarity || "NORMAL";

    drawTokens--;
    localStorage.setItem("puzzle_tokens", drawTokens);
    updateTokenDisplay();
    fetchInventory();

    const isPremium = rarity === "PREMIUM";
    const rarityColor = isPremium ? "#ffd200" : "#00f2fe";
    const rarityTag = isPremium ? dict["rarity-prem"] : dict["rarity-normal"];
    const pieceNumTag = dict["shard-num-tag"].replace("{num}", drawnPiece);
    const fullImg = getFullImageUrl(pic.image_url);

    setTimeout(() => {
      crystal.className = "crystal-ball explode";
      crystal.innerHTML = "";

      setTimeout(() => {
        crystal.className = "prize-stage";

        let gridHtml = "";
        for (let i = 1; i <= 9; i++) {
          const isUnlocked = unlockedPieces.includes(i);
          const isDrawn = (i === drawnPiece);
          gridHtml += `<div class="grid-cell ${isUnlocked ? "unlocked" : ""} ${isDrawn ? "highlight" : ""}">${i}</div>`;
        }

        const cardDisplayContent = isCompletedNow
          ? `<img src="${fullImg}" alt="${pic.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='images/fish_logo.png'" />`
          : `<div style="width: 100%; height: 100%; ${getPieceCropStyle(drawnPiece, fullImg)}"></div>`;

        const descText = isCompletedNow
          ? dict["draw-congrats"]
          : dict["draw-progress"].replace("{count}", unlockedPieces.length).replace("{rate}", result.puzzleProgress?.progressRate || "0%");

        crystal.innerHTML = `
          <div class="prize-rays"></div>
          <div class="prize-puzzle-box">
            <div class="prize-card" style="box-shadow: 0 0 35px ${rarityColor}; border-color: ${rarityColor}; background: #061b36;">
              ${cardDisplayContent}
            </div>
            <div class="mini-grid-9">
              ${gridHtml}
            </div>
          </div>
          <div class="rarity-pill" style="background: ${rarityColor}; color: #021226;">
            ${rarityTag} · ${pieceNumTag}
          </div>
          <div class="prize-title" style="color: ${rarityColor}; text-shadow: 0 0 16px ${rarityColor};">
            ${pic.title || "海洋拼圖"}
          </div>
          <div class="prize-desc">
            ${descText}
          </div>
        `;

        isDrawing = false;
        if (drawTokens > 0) drawBtn.disabled = false;
        fetchGalleryData();
      }, 400);
    }, 1300);

  } catch (error) {
    console.error("喚醒抽卡錯誤:", error);
    alert(`喚醒發生錯誤：${error.message}`);

    isDrawing = false;
    crystal.className = "crystal-ball";
    crystal.innerHTML = `
      <div class="crystal-core"></div>
      <span class="idle-text">${dict["idle-summon"]}</span>
      <span class="idle-sub">TAP TO SUMMON</span>
    `;
    if (drawTokens > 0) drawBtn.disabled = false;
  }
}

// ==================================================
// 📦 碎片工坊與開啟寶箱 API
// ==================================================
function openWorkshop() {
  const modal = document.getElementById("workshop-modal");
  if (modal) {
    modal.style.display = "flex";
    fetchInventory();
  }
}

function closeWorkshop() {
  const modal = document.getElementById("workshop-modal");
  if (modal) modal.style.display = "none";
}

async function exchangeFragments(type) {
  const token = localStorage.getItem("authToken");
  if (!token) return alert(translations[currentLang]["err-no-login"]);

  try {
    const res = await fetch(`${API_BASE_URL}/game/collect/exchange`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ exchange_type: type, times: 1 })
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message || "兌換成功！🎉");
      fetchInventory();
    } else {
      alert(`兌換失敗：${data.message || "碎片不足"}`);
    }
  } catch (e) {
    alert("連線失敗，請稍後再試！");
  }
}

async function openChest(chestType) {
  const token = localStorage.getItem("authToken");
  if (!token) return alert(translations[currentLang]["err-no-login"]);

  try {
    const res = await fetch(`${API_BASE_URL}/game/collect/open-chest`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ chest_type: chestType, count: 1 })
    });

    const data = await res.json();
    if (res.ok) {
      const result = data.data?.results?.[0];
      if (result) {
        alert(`🎁 開啟成功！獲得【${result.picture?.title}】的第 ${result.drawnPiece} 號碎片！`);
      } else {
        alert(data.message || "開啟成功！");
      }
      fetchInventory();
      fetchGalleryData();
    } else {
      alert(`開啟失敗：${data.message || "寶箱數量不足"}`);
    }
  } catch (e) {
    alert("連線失敗，請稍後再試！");
  }
}

// ==================================================
// 🖼️ 拼圖收藏畫廊 API 與自然排序渲染
// ==================================================
async function fetchGalleryData() {
  const container = document.querySelector(".gallery-grid");
  const dict = translations[currentLang] || translations.zh;
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/game/collect/gallery`, {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const json = await response.json();
      galleryPictures = json.data?.pictures || [];

      // 自然排序 (Natural Sort)
      galleryPictures.sort((a, b) => {
        const titleA = String(a.title || "");
        const titleB = String(b.title || "");
        return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: "base" });
      });

      renderGalleryPage(currentGalleryPage);
    } else {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#88bbff; padding: 40px 0;">${dict["empty-gallery"]}</div>`;
    }
  } catch (error) {
    console.error("載入圖鑑失敗:", error);
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#ff7675; padding: 40px 0;">${dict["server-error"]}</div>`;
  }
}

function renderGalleryPage(page) {
  const container = document.querySelector(".gallery-grid");
  const paginationContainer = document.querySelector(".pagination-container");
  const dict = translations[currentLang] || translations.zh;
  if (!container) return;

  if (galleryPictures.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#88bbff; padding: 40px 0;">${dict["empty-gallery"]}</div>`;
    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }

  const totalPages = Math.ceil(galleryPictures.length / ITEMS_PER_PAGE);
  currentGalleryPage = Math.max(1, Math.min(page, totalPages));

  const start = (currentGalleryPage - 1) * ITEMS_PER_PAGE;
  const pageData = galleryPictures.slice(start, start + ITEMS_PER_PAGE);

  container.innerHTML = pageData.map((item) => {
    const prog = item.user_progress || {};
    const isCompleted = Boolean(prog.is_completed);
    const unlockedPieces = prog.unlocked_pieces || [];
    const pieceCount = prog.piece_count || 0;
    const isLocked = (pieceCount === 0);
    const fullImg = getFullImageUrl(item.image_url);
    const rarityColor = item.rarity === "PREMIUM" ? "style='color:#ffd200;'" : "";
    const progressText = isCompleted ? dict["puzzle-completed"] : `${dict["puzzle-progress"]} ${pieceCount}/9 (${prog.progress_rate || "0%"})`;

    return `
      <div class="gallery-item ${isCompleted ? "unlocked" : (pieceCount > 0 ? "in-progress" : "locked")}">
        <div class="img-frame">
          ${renderPuzzleFrameHTML(unlockedPieces, fullImg, isCompleted, isLocked)}
        </div>
        <p class="gallery-name" ${rarityColor}>${isCompleted ? "✨ " : ""}${item.title || "海洋拼圖"}</p>
        <span class="date">${progressText}</span>
      </div>
    `;
  }).join("");

  renderPaginationControls(totalPages);
}

// 🌟 拼圖收藏展示櫃分頁控制 (顯示目前頁面前後2頁，最多5個頁碼 + 上下頁 + 自輸入跳頁按鈕 + 總頁數提示)
function renderPaginationControls(totalPages) {
  const paginationContainer = document.querySelector(".pagination-container");
  const dict = translations[currentLang] || translations.zh;
  if (!paginationContainer) return;

  if (totalPages <= 0 || galleryPictures.length === 0) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";

  // 計算以 currentGalleryPage 為中心，前後各 2 個頁碼 (共 5 個)
  let startPage = Math.max(1, currentGalleryPage - 2);
  let endPage = Math.min(totalPages, currentGalleryPage + 2);

  if (endPage - startPage < 4) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + 4);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 4);
    }
  }

  const pages = [];
  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  const pagesHtml = pages
    .map(
      (p) =>
        `<button class="page-num ${p === currentGalleryPage ? 'active' : ''}" onclick="renderGalleryPage(${p})">${p}</button>`
    )
    .join("");

  const prevText = dict["page-prev"] || "&laquo; 上一頁";
  const nextText = dict["page-next"] || "下一頁 &raquo;";

  paginationContainer.innerHTML = `
    <button class="page-btn prev-btn" ${currentGalleryPage === 1 ? 'disabled' : ''} onclick="renderGalleryPage(${currentGalleryPage - 1})">${prevText}</button>
    <div class="page-numbers" style="display: flex; gap: 8px; align-items: center;">
      ${pagesHtml}
    </div>
    <button class="page-btn next-btn" ${currentGalleryPage === totalPages ? 'disabled' : ''} onclick="renderGalleryPage(${currentGalleryPage + 1})">${nextText}</button>
    <div id="gallery-jump-wrap" style="display: inline-flex; align-items: center; margin-left: 6px;">
      <button class="page-btn jump-btn" title="手動輸入頁碼 (共 ${totalPages} 頁)" onclick="openGalleryJumpInput(${totalPages})">🔢 跳頁</button>
    </div>
    <span class="gallery-page-indicator" style="color: #8cb4ff; font-size: 0.85rem; font-weight: 700; background: rgba(0, 30, 60, 0.6); padding: 5px 12px; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.25); margin-left: 4px; user-select: none;">
      第 ${currentGalleryPage} / ${totalPages} 頁 (共 ${galleryPictures.length} 筆)
    </span>
  `;
}

window.renderGalleryPage = renderGalleryPage;

window.openGalleryJumpInput = function (totalPages) {
  const wrap = document.getElementById("gallery-jump-wrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <input type="text" id="gallery-jump-input" value="${currentGalleryPage}" placeholder="1~${totalPages}" title="請輸入 1 ~ ${totalPages} 頁碼"
      style="width: 55px; height: 32px; text-align: center; border: 1.5px solid #00f2fe; border-radius: 8px; font-weight: 800; color: #fff; background: rgba(0, 30, 60, 0.95); outline: none; box-shadow: 0 0 10px rgba(0, 242, 254, 0.6); box-sizing: border-box;" />
  `;

  const input = document.getElementById("gallery-jump-input");
  if (!input) return;
  input.focus();
  input.select();

  let isSubmitted = false;
  let isAlerting = false;

  const handleJump = () => {
    if (isSubmitted) return;
    const val = input.value.trim();
    const pageNum = Number(val);

    if (!val || !/^\d+$/.test(val) || isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      isAlerting = true;
      alert(`請輸入正確的頁碼（範圍 1 ~ ${totalPages}）`);
      isAlerting = false;
      input.focus();
      input.select();
      return;
    }

    isSubmitted = true;
    renderGalleryPage(pageNum);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJump();
    } else if (e.key === "Escape") {
      e.preventDefault();
      renderPaginationControls(totalPages);
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (isSubmitted || isAlerting) return;
      const val = input.value.trim();
      const pageNum = Number(val);
      if (val && /^\d+$/.test(val) && !isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        if (pageNum !== currentGalleryPage) {
          isSubmitted = true;
          renderGalleryPage(pageNum);
          return;
        }
      }
      renderPaginationControls(totalPages);
    }, 150);
  });
};

// 模態窗控制
const galleryModal = document.getElementById("gallery-modal");
function openGallery() {
  const modal = document.getElementById("gallery-modal");
  if (modal) {
    modal.style.display = "flex";
    fetchGalleryData();
  }
}

function closeGallery() {
  const modal = document.getElementById("gallery-modal");
  if (modal) modal.style.display = "none";
}

window.addEventListener("click", (event) => {
  const galleryModal = document.getElementById("gallery-modal");
  const wsModal = document.getElementById("workshop-modal");
  if (event.target === galleryModal) closeGallery();
  if (event.target === wsModal) closeWorkshop();
});

// ==================================================
// ✨ 浮游微光粒子生成
// ==================================================
function createOceanSparkles() {
  const container = document.getElementById("ocean-sparkles");
  if (!container) return;
  container.innerHTML = "";

  const icons = ["✦", "✧", "·", "✨"];
  for (let i = 0; i < 28; i++) {
    const star = document.createElement("div");
    star.className = "sparkle-star";
    star.innerText = icons[Math.floor(Math.random() * icons.length)];

    star.style.top = `${Math.random() * 90}%`;
    star.style.left = `${Math.random() * 95}%`;
    star.style.fontSize = `${Math.random() * 10 + 10}px`;
    star.style.setProperty("--dur", `${Math.random() * 2 + 1.8}s`);
    star.style.setProperty("--delay", `${Math.random() * 3}s`);

    container.appendChild(star);
  }
}

// 頁面初次載入
document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  updateTokenDisplay();
  checkDailySignInStatus();
  fetchInventory();
  createOceanSparkles();

  const crystal = document.getElementById("crystal-ball");
  if (crystal) {
    crystal.addEventListener("click", () => {
      if (drawTokens > 0 && !isDrawing) {
        performDraw();
      }
    });
  }

});


// 🐟 自動生成深海發光游魚群
function createSwimmingFish() {
  const oceanBg = document.querySelector(".ocean-bg");
  if (!oceanBg) return;

  // 建立魚群圖層
  let fishLayer = document.querySelector(".swimming-fish-layer");
  if (!fishLayer) {
    fishLayer = document.createElement("div");
    fishLayer.className = "swimming-fish-layer";
    oceanBg.appendChild(fishLayer);
  } else {
    fishLayer.innerHTML = "";
  }

  // 魚的數量與顏色設定
  const fishList = [
    { top: "18%", dur: "14s", delay: "0s", dir: "L2R", scale: 1.1, color: "#00f2fe", wave: "-35px" },
    { top: "42%", dur: "11s", delay: "2s", dir: "R2L", scale: 0.9, color: "#ffd200", wave: "40px" },
    { top: "68%", dur: "16s", delay: "1s", dir: "L2R", scale: 1.2, color: "#00f2fe", wave: "-25px" },
    { top: "82%", dur: "13s", delay: "4s", dir: "R2L", scale: 0.8, color: "#4facfe", wave: "30px" },
    { top: "30%", dur: "20s", delay: "6s", dir: "L2R", scale: 0.65, color: "#ffffff", wave: "-20px" }
  ];

  fishList.forEach((cfg) => {
    const fishBox = document.createElement("div");
    fishBox.className = "fish-item";

    // 設定位置與動畫屬性
    fishBox.style.top = cfg.top;
    fishBox.style.width = `${85 * cfg.scale}px`;
    fishBox.style.height = `${50 * cfg.scale}px`;
    fishBox.style.setProperty("--wave-y", cfg.wave);
    fishBox.style.setProperty("--fish-scale", cfg.scale);
    fishBox.style.animation = `${cfg.dir === 'L2R' ? 'swimL2R' : 'swimR2L'} ${cfg.dur} linear infinite`;
    fishBox.style.animationDelay = cfg.delay;

    // SVG 魚本體
    fishBox.innerHTML = `
      <svg class="ocean-fish-svg" viewBox="0 0 100 50">
        <!-- 擺動尾巴 -->
        <polygon class="fish-tail" points="30,25 5,8 5,42" fill="${cfg.color}" opacity="0.85" />
        <!-- 背鰭 -->
        <polygon points="50,15 65,5 75,18" fill="${cfg.color}" opacity="0.6" />
        <!-- 魚身 -->
        <path d="M 25,25 Q 55,5 88,25 Q 55,45 25,25 Z" fill="${cfg.color}" opacity="0.95" />
        <!-- 眼睛 -->
        <circle cx="78" cy="22" r="2.8" fill="#ffffff" />
        <circle cx="79" cy="22" r="1.3" fill="#010814" />
      </svg>
    `;

    fishLayer.appendChild(fishBox);
  });
}

