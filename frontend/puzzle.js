// ==================================================
// 🌐 API 統一設定與狀態管理
// ==================================================
const API_BASE_URL = "https://api.drift-bottles.xyz";

let drawTokens = parseInt(localStorage.getItem("puzzle_tokens") || "0", 10);
let galleryPictures = [];
let currentGalleryPage = 1;
const ITEMS_PER_PAGE = 6;

// 輔助函式：取得圖片完整網址
function getFullImageUrl(url) {
  if (!url) return "images/fish_logo.png";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// 輔助函式：計算九宮格 (1~9) 碎片對應的背景裁切位置
function getPieceCropStyle(pieceNumber, imageUrl) {
  const row = Math.floor((pieceNumber - 1) / 3);
  const col = (pieceNumber - 1) % 3;
  const posX = col * 50; // 0%, 50%, 100%
  const posY = row * 50; // 0%, 50%, 100%
  return `background-image: url('${imageUrl}'); background-size: 300% 300%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
}

// 輔助函式：產生「我的收藏」九宮格拼圖遮罩 HTML
function renderPuzzleFrameHTML(unlockedPieces, fullImg, isCompleted, isLocked) {
  if (isLocked) {
    // 0/9 完全未解鎖：暗黑模糊 + 鎖頭
    return `
      <div class="puzzle-board-frame">
        <img src="${fullImg}" class="locked-preview-img" onerror="this.src='images/fish_logo.png'" />
        <div class="lock-icon">🔒</div>
      </div>
    `;
  }

  if (isCompleted) {
    // 9/9 完整集齊：全圖展示 + 金色光暈
    return `
      <div class="puzzle-board-frame completed">
        <img src="${fullImg}" class="completed-img" onerror="this.src='images/fish_logo.png'" />
        <div class="frame-shine"></div>
      </div>
    `;
  }

  // 1~8 收集進行中：3x3 九宮格拼圖塊
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

// 輔助函式：取得身分驗證 Header
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
// 💎 喚醒石、庫存與每日任務
// ==================================================

// 取得當前日期字串 (YYYY-MM-DD)
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 檢查每日簽到狀態
function checkDailySignInStatus() {
  const signBtn = document.getElementById("daily-sign-btn");
  if (!signBtn) return;

  const today = getTodayDateString();
  const lastSignDate = localStorage.getItem("puzzle_last_sign_date");

  if (lastSignDate === today) {
    // 今日已簽到
    signBtn.disabled = true;
    signBtn.classList.remove("active");
    signBtn.innerText = "已領取 ✔️";
    signBtn.style.background = "rgba(255, 255, 255, 0.1)";
    signBtn.style.color = "#4facfe";
  } else {
    // 今日尚未簽到
    signBtn.disabled = false;
    signBtn.classList.add("active");
    signBtn.innerHTML = "<span>領取 1 顆</span>";
    signBtn.style.background = "";
    signBtn.style.color = "";
  }
}

function claimToken(btnElement, amount) {
  const today = getTodayDateString();
  const lastSignDate = localStorage.getItem("puzzle_last_sign_date");

  // 防呆：如果今天已經領取過則直接阻擋
  if (lastSignDate === today) {
    alert("今天已經領取過簽到獎勵囉！明天再來吧～🌊");
    checkDailySignInStatus();
    return;
  }

  // 記錄今日簽到日期
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
  if (drawBtn) drawBtn.disabled = drawTokens <= 0;
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
// 🔮 真實後端九宮格抽卡喚醒 (Gacha System)
// ==================================================
async function performDraw() {
  if (drawTokens <= 0) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("請先登入後再進行碎片喚醒唷！🌊");
    window.location.href = "login.html";
    return;
  }

  const drawBtn = document.getElementById("draw-btn");
  const crystal = document.getElementById("crystal-ball");
  if (!crystal || !drawBtn) return;

  drawBtn.disabled = true;

  // 💥 階段一：蓄力
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
    const rarityTag = isPremium ? "✨ PREMIUM 高級" : "NORMAL 普通";
    const fullImg = getFullImageUrl(pic.image_url);

    setTimeout(() => {
      // 💥 階段二：碎裂
      crystal.className = "crystal-ball explode";
      crystal.innerHTML = "";

      // 💥 階段三：展示單格碎片與九宮格
      setTimeout(() => {
        crystal.className = "prize-stage";
        
        let gridHtml = "";
        for (let i = 1; i <= 9; i++) {
          const isUnlocked = unlockedPieces.includes(i);
          const isDrawn = (i === drawnPiece);
          gridHtml += `<div class="grid-cell ${isUnlocked ? 'unlocked' : ''} ${isDrawn ? 'highlight' : ''}">${i}</div>`;
        }

        const cardDisplayContent = isCompletedNow
          ? `<img src="${fullImg}" alt="${pic.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='images/fish_logo.png'" />`
          : `<div style="width: 100%; height: 100%; ${getPieceCropStyle(drawnPiece, fullImg)}"></div>`;

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
            ${rarityTag} · 第 ${drawnPiece} 號碎片
          </div>
          <div class="prize-title" style="color: ${rarityColor}; text-shadow: 0 0 16px ${rarityColor};">
            ${pic.title || "海洋拼圖"}
          </div>
          <div class="prize-desc">
            ${isCompletedNow ? '🎉 恭喜集齊完整拼圖！' : `收集進度：${unlockedPieces.length} / 9 (${result.puzzleProgress?.progressRate || '0%'})`}
          </div>
        `;

        if (drawTokens > 0) drawBtn.disabled = false;
        fetchGalleryData();
      }, 400);
    }, 1300);

  } catch (error) {
    console.error("喚醒抽卡錯誤:", error);
    alert(`喚醒發生錯誤：${error.message}`);
    
    crystal.className = "crystal-ball";
    crystal.innerHTML = `
      <div class="crystal-core"></div>
      <span class="idle-text">等待喚醒</span>
      <span class="idle-sub">TAP TO SUMMON</span>
    `;
    if (drawTokens > 0) drawBtn.disabled = false;
  }
}

// ==================================================
// 📦 碎片工坊與開啟寶箱 API 串接
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
  if (!token) return alert("請先登入！");

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
  if (!token) return alert("請先登入！");

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
// 🖼️ 收藏畫廊後端連線 (Gallery Modal)
// ==================================================
async function fetchGalleryData() {
  const container = document.querySelector(".gallery-grid");
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/game/collect/gallery`, {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const json = await response.json();
      galleryPictures = json.data?.pictures || [];
      renderGalleryPage(currentGalleryPage);
    } else {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#88bbff; padding: 40px 0;">載入圖鑑失敗，請稍後再試 🌊</div>';
    }
  } catch (error) {
    console.error("載入圖鑑失敗:", error);
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#ff7675; padding: 40px 0;">伺服器連線中斷 😢</div>';
  }
}

function renderGalleryPage(page) {
  const container = document.querySelector(".gallery-grid");
  const paginationContainer = document.querySelector(".pagination-container");
  if (!container) return;

  if (galleryPictures.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#88bbff; padding: 40px 0;">目前還沒有圖鑑資料唷！🌊</div>';
    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }

  const totalPages = Math.ceil(galleryPictures.length / ITEMS_PER_PAGE);
  currentGalleryPage = Math.max(1, Math.min(page, totalPages));

  const start = (currentGalleryPage - 1) * ITEMS_PER_PAGE;
  const pageData = galleryPictures.slice(start, start + ITEMS_PER_PAGE);

  container.innerHTML = pageData.map(item => {
    const prog = item.user_progress || {};
    const isCompleted = Boolean(prog.is_completed);
    const unlockedPieces = prog.unlocked_pieces || [];
    const pieceCount = prog.piece_count || 0;
    const isLocked = (pieceCount === 0);
    const fullImg = getFullImageUrl(item.image_url);
    const rarityColor = item.rarity === "PREMIUM" ? "style='color:#ffd200;'" : "";

    return `
      <div class="gallery-item ${isCompleted ? 'unlocked' : (pieceCount > 0 ? 'in-progress' : 'locked')}">
        <div class="img-frame">
          ${renderPuzzleFrameHTML(unlockedPieces, fullImg, isCompleted, isLocked)}
        </div>
        <p class="gallery-name" ${rarityColor}>${isCompleted ? '✨ ' : ''}${item.title || '海洋拼圖'}</p>
        <span class="date">${isCompleted ? '已集齊 (9/9)' : `碎片進度: ${pieceCount}/9 (${prog.progress_rate || '0%'})`}</span>
      </div>
    `;
  }).join("");

  renderPaginationControls(totalPages);
}

// 全部頁碼完整渲染
function renderPaginationControls(totalPages) {
  const paginationContainer = document.querySelector(".pagination-container");
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";

  // 直接生成 1 到 totalPages 的所有頁碼
  const pagesHtml = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map(
      (p) =>
        `<button class="page-num ${p === currentGalleryPage ? 'active' : ''}" onclick="renderGalleryPage(${p})">${p}</button>`
    )
    .join("");

  paginationContainer.innerHTML = `
    <button class="page-btn prev-btn" ${currentGalleryPage === 1 ? 'disabled' : ''} onclick="renderGalleryPage(${currentGalleryPage - 1})">&laquo; 上一頁</button>
    <div class="page-numbers">
      ${pagesHtml}
    </div>
    <button class="page-btn next-btn" ${currentGalleryPage === totalPages ? 'disabled' : ''} onclick="renderGalleryPage(${currentGalleryPage + 1})">下一頁 &raquo;</button>
  `;
}

// 模態窗控制
const galleryModal = document.getElementById("gallery-modal");
function openGallery() {
  if (galleryModal) {
    galleryModal.style.display = "flex";
    fetchGalleryData();
  }
}
function closeGallery() {
  if (galleryModal) galleryModal.style.display = "none";
}

window.addEventListener("click", function (event) {
  if (event.target === galleryModal) closeGallery();
  const wsModal = document.getElementById("workshop-modal");
  if (event.target === wsModal) closeWorkshop();
});

document.addEventListener("DOMContentLoaded", () => {
  updateTokenDisplay();
  checkDailySignInStatus(); // 🌟 每次開網頁或重新整理時，檢查今天是否已簽到
  fetchInventory();

  const crystal = document.getElementById("crystal-ball");
  if (crystal) {
    crystal.addEventListener("click", () => {
      if (drawTokens > 0 && !document.getElementById("draw-btn").disabled) {
        performDraw();
      }
    });
  }
});