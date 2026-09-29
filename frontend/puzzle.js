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
    "task-2-desc": "今日發文 3 篇",
    "task-3-title": "侃侃而談",
    "task-3-desc": "今日發文 6 篇",
    "task-4-title": "海洋話匣子",
    "task-4-desc": "今日發文 10 篇",
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
    "err-claim-failed": "領取失敗，請稍後再試",
    "history-empty": "目前尚無抽取紀錄，快去喚醒碎片吧！🌊",
    "history-load-more": "⬇️ 載入更多",
    "history-new": "✨ 新碎片",
    "history-completed": "🎉 集齊",
    "history-source-AWAKEN_STONE": "💎 喚醒石",
    "history-source-CHEST_NORMAL": "🎁 普通寶箱",
    "history-source-CHEST_PREMIUM": "👑 高級寶箱",
    "empty-gallery": "目前還沒有圖鑑資料唷！🌊",
    "server-error": "伺服器連線中斷 😢",
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
    "task-2-desc": "Post 3 bottles today",
    "task-3-title": "Chatterbox",
    "task-3-desc": "Post 6 bottles today",
    "task-4-title": "Ocean Speaker",
    "task-4-desc": "Post 10 bottles today",
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
    "err-claim-failed": "Claim failed, please try again later",
    "history-empty": "No summon records yet. Go awaken some shards! 🌊",
    "history-load-more": "⬇️ Load more",
    "history-new": "✨ New",
    "history-completed": "🎉 Completed",
    "history-source-AWAKEN_STONE": "💎 Stone",
    "history-source-CHEST_NORMAL": "🎁 Normal Chest",
    "history-source-CHEST_PREMIUM": "👑 Premium Chest",
    "empty-gallery": "No puzzle collections yet! 🌊",
    "server-error": "Server connection interrupted 😢",
  },
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

  renderTasks();
  renderHistoryList();
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

let drawTokens = 0; // 喚醒石數量，以後端的 awaken_stones 為準
let galleryPictures = [];
let currentGalleryPage = 1;
const ITEMS_PER_PAGE = 6;
let isDrawing = false;

function getFullImageUrl(url) {
  if (!url) return "images/fish_logo.webp";
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
        <img src="${fullImg}" class="locked-preview-img" onerror="this.src='images/fish_logo.webp'" />
        <div class="lock-icon">🔒</div>
      </div>
    `;
  }

  if (isCompleted) {
    return `
      <div class="puzzle-board-frame completed">
        <img src="${fullImg}" class="completed-img" onerror="this.src='images/fish_logo.webp'" />
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
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ==================================================
// 💎 喚醒石、庫存與每日任務 (全部由後端記錄，每天 00:00 重置)
// ==================================================
let puzzleTasks = []; // 後端回傳的今日任務：{ key, target, progress, completed, claimed }
let claimingTaskKey = null;

async function fetchTasks() {
  const token = localStorage.getItem("authToken");
  if (!token) {
    renderTasks();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/game/collect/tasks`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const { data } = await res.json();
      puzzleTasks = data.tasks || [];
      drawTokens = data.awaken_stones || 0;
      updateTokenDisplay();
    }
  } catch (e) {
    console.error("載入每日任務失敗:", e);
  }
  renderTasks();
}

// 依任務狀態更新每張任務卡的進度條與按鈕 (未達成 / 領取 1 顆 / 已領取)
function renderTasks() {
  const dict = translations[currentLang] || translations.zh;

  document.querySelectorAll(".task-card[data-task-key]").forEach((card) => {
    const task = puzzleTasks.find((t) => t.key === card.dataset.taskKey);
    const target = task ? task.target : Number(card.dataset.target) || 1;
    const progress = task ? task.progress : 0;

    const fill = card.querySelector(".progress-bar-fill");
    const num = card.querySelector(".progress-num");
    const btn = card.querySelector(".claim-btn");
    if (fill) fill.style.width = `${Math.min(progress / target, 1) * 100}%`;
    if (num) num.innerText = `${progress} / ${target}`;
    if (!btn) return;

    if (task && task.claimed) {
      btn.disabled = true;
      btn.classList.remove("active");
      btn.innerText = dict["claimed-btn"];
      btn.style.background = "rgba(255, 255, 255, 0.1)";
      btn.style.color = "#4facfe";
    } else if (task && task.completed) {
      btn.disabled = claimingTaskKey === task.key;
      btn.classList.add("active");
      btn.innerHTML = `<span>${dict["claim-1-stone"]}</span>`;
      btn.style.background = "";
      btn.style.color = "";
    } else {
      btn.disabled = true;
      btn.classList.remove("active");
      btn.innerText = dict["task-locked"];
      btn.style.background = "";
      btn.style.color = "";
    }
  });
}

async function claimTask(taskKey) {
  const dict = translations[currentLang] || translations.zh;
  const token = localStorage.getItem("authToken");
  if (!token) {
    alert(dict["err-no-login"]);
    window.location.href = "login.html";
    return;
  }
  if (claimingTaskKey) return; // 領取中再按一次就不理它

  claimingTaskKey = taskKey;
  renderTasks();

  try {
    const res = await fetch(
      `${API_BASE_URL}/game/collect/tasks/${encodeURIComponent(taskKey)}/claim`,
      { method: "POST", headers: getAuthHeaders() },
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || dict["err-claim-failed"]);
    }
  } catch (e) {
    alert(dict["server-error"]);
  } finally {
    claimingTaskKey = null;
    fetchTasks(); // 不管成功失敗都以後端狀態為準
  }
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
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const { data } = await res.json();
      drawTokens = data.awaken_stones || 0;
      updateTokenDisplay();

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
    // 後端會扣 1 顆喚醒石，不夠會回 400
    const response = await fetch(`${API_BASE_URL}/game/collect/unlock`, {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "喚醒失敗");
    }

    const resData = await response.json();
    const result = resData.data || {};
    const pic = result.picture || {};
    const drawnPiece = result.drawnPiece || 1;
    const unlockedPieces = result.puzzleProgress?.unlocked_pieces || [
      drawnPiece,
    ];
    const isCompletedNow = Boolean(result.isCompletedNow);
    const rarity = pic.rarity || "NORMAL";

    drawTokens = result.inventory?.awaken_stones ?? Math.max(drawTokens - 1, 0);
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
          const isDrawn = i === drawnPiece;
          gridHtml += `<div class="grid-cell ${isUnlocked ? "unlocked" : ""} ${isDrawn ? "highlight" : ""}">${i}</div>`;
        }

        const cardDisplayContent = isCompletedNow
          ? `<img src="${fullImg}" alt="${pic.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='images/fish_logo.webp'" />`
          : `<div style="width: 100%; height: 100%; ${getPieceCropStyle(drawnPiece, fullImg)}"></div>`;

        const descText = isCompletedNow
          ? dict["draw-congrats"]
          : dict["draw-progress"]
              .replace("{count}", unlockedPieces.length)
              .replace("{rate}", result.puzzleProgress?.progressRate || "0%");

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
    fetchInventory(); // 以後端的喚醒石數量為準
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
      body: JSON.stringify({ exchange_type: type, times: 1 }),
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
      body: JSON.stringify({ chest_type: chestType, count: 1 }),
    });

    const data = await res.json();
    if (res.ok) {
      const result = data.data?.results?.[0];
      if (result) {
        alert(
          `🎁 開啟成功！獲得【${result.picture?.title}】的第 ${result.drawnPiece} 號碎片！`,
        );
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
      headers: getAuthHeaders(),
    });

    if (response.ok) {
      const json = await response.json();
      galleryPictures = json.data?.pictures || [];

      // 自然排序 (Natural Sort)
      galleryPictures.sort((a, b) => {
        const titleA = String(a.title || "");
        const titleB = String(b.title || "");
        return titleA.localeCompare(titleB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
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

// 🌟 篩選全域資料：同時支援名稱搜尋與特定碎片編號
function getFilteredPictures() {
  const keyword = (document.getElementById("puzzleSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  const pieceFilter =
    document.getElementById("pieceSelectFilter")?.value || "all";

  return galleryPictures.filter((item) => {
    const title = String(item.title || "").toLowerCase();
    const matchKeyword = !keyword || title.includes(keyword);

    let matchPiece = true;
    if (pieceFilter !== "all") {
      const targetNum = parseInt(pieceFilter, 10);
      const prog = item.user_progress || {};
      const unlocked = prog.unlocked_pieces || [];
      const isCompleted = Boolean(prog.is_completed);

      // 已集齊(9/9)包含全碎片，或已解鎖陣列中含有該碎片號碼
      matchPiece = isCompleted || unlocked.includes(targetNum);
    }

    return matchKeyword && matchPiece;
  });
}

function renderGalleryPage(page) {
  const container = document.querySelector(".gallery-grid");
  const paginationContainer = document.querySelector(".pagination-container");
  const dict = translations[currentLang] || translations.zh;
  if (!container) return;

  // 1. 取得過濾後的拼圖清單
  const filteredData = getFilteredPictures();
  const currentPiece =
    document.getElementById("pieceSelectFilter")?.value || "all";

  // 2. 🌟 若沒有任何拼圖擁有該碎片，顯示「尚無此碎片」提示框
  if (filteredData.length === 0) {
    const noPieceTitle =
      currentPiece !== "all"
        ? `🧩 尚無第 ${currentPiece} 號碎片`
        : "🔍 查無符合的拼圖";

    container.innerHTML = `
      <div class="no-piece-box">
        <div class="no-piece-icon">🌊</div>
        <div class="no-piece-text">${noPieceTitle}</div>
        <div class="no-piece-sub">目前尚未喚醒此碎片，快去抽卡或開寶箱吧！</div>
      </div>
    `;

    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }

  // 3. 正常分頁渲染
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  currentGalleryPage = Math.max(1, Math.min(page, totalPages));

  const start = (currentGalleryPage - 1) * ITEMS_PER_PAGE;
  const pageData = filteredData.slice(start, start + ITEMS_PER_PAGE);

  container.innerHTML = pageData
    .map((item) => {
      const prog = item.user_progress || {};
      const isCompleted = Boolean(prog.is_completed);
      const unlockedPieces = prog.unlocked_pieces || [];
      const pieceCount = prog.piece_count || 0;
      const isLocked = pieceCount === 0;
      const fullImg = getFullImageUrl(item.image_url);
      const rarityColor =
        item.rarity === "PREMIUM" ? "style='color:#ffd200;'" : "";
      const progressText = isCompleted
        ? dict["puzzle-completed"]
        : `${dict["puzzle-progress"]} ${pieceCount}/9 (${prog.progress_rate || "0%"})`;

      return `
      <div class="gallery-item ${isCompleted ? "unlocked" : pieceCount > 0 ? "in-progress" : "locked"}">
        <div class="img-frame">
          ${renderPuzzleFrameHTML(unlockedPieces, fullImg, isCompleted, isLocked)}
        </div>
        <p class="gallery-name" ${rarityColor}>${isCompleted ? "✨ " : ""}${item.title || "海洋拼圖"}</p>
        <span class="date">${progressText}</span>
      </div>
    `;
    })
    .join("");

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const paginationContainer = document.querySelector(".pagination-container");
  const dict = translations[currentLang] || translations.zh;
  if (!paginationContainer) return;

  if (totalPages <= 0 || galleryPictures.length === 0) {
    paginationContainer.style.display = "none";
    paginationContainer.innerHTML = "";
    return;
  }

  paginationContainer.style.display = "flex";
  paginationContainer.innerHTML = "";

  // ◀ 上一頁按鈕
  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn prev-btn";
  prevBtn.innerText = "◀";
  prevBtn.title = dict["page-prev"] || "上一頁";
  prevBtn.disabled = currentGalleryPage === 1;
  prevBtn.onclick = () => renderGalleryPage(currentGalleryPage - 1);
  paginationContainer.appendChild(prevBtn);

  // 🔢 計算當前頁的前後2頁（最多5個頁碼）
  let startPage = Math.max(1, currentGalleryPage - 2);
  let endPage = Math.min(totalPages, currentGalleryPage + 2);

  if (endPage - startPage < 4) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + 4);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 4);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = `page-btn page-num ${i === currentGalleryPage ? "active" : ""}`;
    pageBtn.innerText = i;
    pageBtn.title = `第 ${i} 頁`;
    pageBtn.onclick = () => renderGalleryPage(i);
    paginationContainer.appendChild(pageBtn);
  }

  // ▶ 下一頁按鈕
  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn next-btn";
  nextBtn.innerText = "▶";
  nextBtn.title = dict["page-next"] || "下一頁";
  nextBtn.disabled = currentGalleryPage === totalPages;
  nextBtn.onclick = () => renderGalleryPage(currentGalleryPage + 1);
  paginationContainer.appendChild(nextBtn);

  // 🔢 跳頁按鈕（點擊後展開輸入框供使用者輸入）
  const jumpContainer = document.createElement("div");
  jumpContainer.style.display = "inline-flex";
  jumpContainer.style.alignItems = "center";
  jumpContainer.style.marginLeft = "2px";

  const jumpBtn = document.createElement("button");
  jumpBtn.className = "page-btn gallery-jump-btn";
  jumpBtn.innerText = "🔢";
  jumpBtn.title = `點擊手動輸入頁碼跳頁 (共 ${totalPages} 頁)`;

  jumpBtn.onclick = () => {
    jumpContainer.innerHTML = `
      <input type="number" class="gallery-jump-input" min="1" max="${totalPages}" value="${currentGalleryPage}" placeholder="1~${totalPages}" title="請輸入 1 ~ ${totalPages} 頁碼" />
    `;
    const input = jumpContainer.querySelector(".gallery-jump-input");
    if (!input) return;
    input.focus();
    input.select();

    let isSubmitted = false;

    const handleJumpSubmit = () => {
      if (isSubmitted) return;
      const val = input.value.trim();
      const pageNum = parseInt(val, 10);

      if (!val || isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        alert(
          currentLang === "zh"
            ? `請輸入正確的頁碼（範圍 1 ~ ${totalPages}）`
            : `Please enter a valid page number (1 ~ ${totalPages})`,
        );
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
        handleJumpSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        renderPaginationControls(totalPages);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (isSubmitted) return;
        const val = input.value.trim();
        const pageNum = parseInt(val, 10);
        if (val && !isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
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

  jumpContainer.appendChild(jumpBtn);
  paginationContainer.appendChild(jumpContainer);
}

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
  // 喚醒石、簽到、抽卡紀錄都改由後端記錄，清掉舊版留在瀏覽器裡的資料
  ["puzzle_tokens", "puzzle_last_sign_date", "gacha_puzzle_history"].forEach(
    (key) => localStorage.removeItem(key),
  );

  applyTranslations();
  updateTokenDisplay();
  fetchTasks();
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
// ==================================================
// 📜 歷史紀錄與搜尋篩選邏輯
// ==================================================

// 1. 抽卡紀錄由後端記錄 (喚醒石抽卡與開寶箱都會記)，這裡只負責分頁載入
const HISTORY_PAGE_SIZE = 20;
let historyRecords = [];
let historyPage = 0;
let historyTotalPages = 0;
let isHistoryLoading = false;

async function loadHistoryPage(page) {
  const token = localStorage.getItem("authToken");
  if (!token || isHistoryLoading) return;

  isHistoryLoading = true;
  try {
    const res = await fetch(
      `${API_BASE_URL}/game/collect/draw-records?page=${page}&limit=${HISTORY_PAGE_SIZE}`,
      { method: "GET", headers: getAuthHeaders() },
    );
    if (res.ok) {
      const { data } = await res.json();
      const records = data.records || [];
      historyRecords = page === 1 ? records : historyRecords.concat(records);
      historyPage = data.pagination?.page || page;
      historyTotalPages = data.pagination?.totalPages || 0;
    }
  } catch (e) {
    console.error("載入抽卡紀錄失敗:", e);
  } finally {
    isHistoryLoading = false;
  }
  renderHistoryList();
}

window.loadMoreHistory = function () {
  if (historyPage < historyTotalPages) loadHistoryPage(historyPage + 1);
};

// 2. 切換展示櫃與歷史分頁
window.switchCollectionTab = function (tab) {
  const isGallery = tab === "gallery";
  document.getElementById("tabGalleryContent").style.display = isGallery
    ? "block"
    : "none";
  document.getElementById("tabHistoryContent").style.display = isGallery
    ? "none"
    : "block";

  document
    .getElementById("tabBtnGallery")
    .classList.toggle("active", isGallery);
  document
    .getElementById("tabBtnHistory")
    .classList.toggle("active", !isGallery);

  if (!isGallery) {
    loadHistoryPage(1); // 每次打開都重新抓第一頁，才看得到剛抽的
  }
};

// 3. 渲染歷史紀錄清單
function formatHistoryTime(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderHistoryList() {
  const container = document.getElementById("historyListContainer");
  const loadMoreBtn = document.getElementById("historyLoadMoreBtn");
  const dict = translations[currentLang] || translations.zh;
  if (!container) return;

  if (loadMoreBtn) {
    loadMoreBtn.style.display = historyPage < historyTotalPages ? "" : "none";
  }

  if (historyRecords.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#88bbff; padding: 40px 0;">${dict["history-empty"]}</div>`;
    return;
  }

  container.innerHTML = historyRecords
    .map((item) => {
      const title = item.picture?.title || "海洋拼圖";
      const source = dict[`history-source-${item.obtained_from}`] || item.obtained_from;
      const pieceTag = dict["shard-num-tag"].replace("{num}", item.piece_number);
      const badges = item.is_completed_now
        ? ` · ${dict["history-completed"]}`
        : item.is_new_piece
          ? ` · ${dict["history-new"]}`
          : "";
      return `
    <div class="history-card">
      <div>
        <div class="title-text">${title} · ${pieceTag}${badges}</div>
        <div class="time-text">${source} · ${formatHistoryTime(item.created_at)}</div>
      </div>
      <div class="rarity-tag">${item.rarity}</div>
    </div>
  `;
    })
    .join("");
}

// 5. 碎片編號與關鍵字篩選
let searchFilterKeyword = "";
let searchFilterPiece = "all";

// 監聽下拉選單與輸入框，切換時即時過濾並重設至第 1 頁
document.getElementById("puzzleSearchInput")?.addEventListener("input", () => {
  renderGalleryPage(1);
});

document.getElementById("pieceSelectFilter")?.addEventListener("change", () => {
  renderGalleryPage(1);
});

function applyGalleryFilter() {
  const items = document.querySelectorAll(".gallery-grid .gallery-item");
  items.forEach((el) => {
    const titleText =
      el.querySelector(".gallery-name")?.innerText.toLowerCase() || "";
    const matchKeyword =
      !searchFilterKeyword || titleText.includes(searchFilterKeyword);

    let matchPiece = true;
    if (searchFilterPiece !== "all") {
      const pieceNum = parseInt(searchFilterPiece, 10);
      const targetCell = el.querySelector(
        `.puzzle-piece-cell:nth-child(${pieceNum})`,
      );
      matchPiece = targetCell && targetCell.classList.contains("unlocked");
    }

    el.style.display = matchKeyword && matchPiece ? "" : "none";
  });
}
