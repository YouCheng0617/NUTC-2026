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
// 💎 喚醒石與任務系統
// ==================================================
function claimToken(btnElement, amount) {
  btnElement.disabled = true;
  btnElement.classList.remove("active");
  btnElement.innerText = "已領取 ✔️";
  btnElement.style.background = "rgba(255, 255, 255, 0.1)";
  btnElement.style.color = "#4facfe";

  drawTokens += amount;
  localStorage.setItem("puzzle_tokens", drawTokens);
  updateTokenDisplay();
}

function updateTokenDisplay() {
  const tokenCountEl = document.getElementById("token-count");
  const drawBtn = document.getElementById("draw-btn");

  if (tokenCountEl) tokenCountEl.innerText = drawTokens;
  if (drawBtn) drawBtn.disabled = drawTokens <= 0;
}

// ==================================================
// 🔮 真實後端抽卡喚醒 (Gacha System)
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

  // 💥 階段一：水晶球聚能震動與裂痕蔓延
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
    const isNew = result.isNew;
    const rarity = pic.rarity || "NORMAL";

    // 扣除喚醒石並更新
    drawTokens--;
    localStorage.setItem("puzzle_tokens", drawTokens);
    updateTokenDisplay();

    // 稀有度視覺設定
    const isPremium = (rarity === "PREMIUM");
    const rarityColor = isPremium ? "#ffd200" : "#00f2fe";
    const rarityTag = isPremium ? "✨ PREMIUM 高級" : "NORMAL 普通";
    const fullImg = getFullImageUrl(pic.image_url);

    setTimeout(() => {
      // 💥 階段二：水晶球極速碎裂光爆
      crystal.className = "crystal-ball explode";
      crystal.innerHTML = "";

      // 💥 階段三：展示手遊級發光卡牌與射線
      setTimeout(() => {
        crystal.className = "prize-stage";
        crystal.innerHTML = `
          <div class="prize-rays"></div>
          <div class="prize-card" style="background: #062347; box-shadow: 0 0 45px ${rarityColor}, inset 0 0 20px rgba(255,255,255,0.85); border-color: ${rarityColor}; overflow: hidden; padding: 0;">
            <img src="${fullImg}" alt="${pic.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='images/fish_logo.png'" />
          </div>
          <div class="rarity-pill" style="background: ${rarityColor}; color: #021226;">
            ${rarityTag} ${isNew ? '<span style="color:#ff3838; margin-left:4px;">NEW!</span>' : ''}
          </div>
          <div class="prize-title" style="color: ${rarityColor}; text-shadow: 0 0 16px ${rarityColor};">
            ${pic.title || "神秘海洋圖鑑"}
          </div>
          <div class="prize-desc">${pic.category || "海洋生物"} · ${pic.description || "探索海洋獲得"}</div>
        `;

        if (drawTokens > 0) drawBtn.disabled = false;
        
        // 重新拉取最新圖鑑快取
        fetchGalleryData();
      }, 400);
    }, 1300);

  } catch (error) {
    console.error("喚醒抽卡錯誤:", error);
    alert(`喚醒發生錯誤：${error.message}`);
    
    // 重置水晶球
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
    const isUnlocked = Boolean(item.is_unlocked);
    const fullImg = getFullImageUrl(item.image_url);
    const dateStr = item.obtained_at ? new Date(item.obtained_at).toLocaleDateString('zh-TW') : "未達成";
    const rarityClass = item.rarity === "PREMIUM" ? "style='color:#ffd200;'" : "";

    return `
      <div class="gallery-item ${isUnlocked ? 'unlocked' : 'locked'}">
        <div class="img-frame">
          <img src="${fullImg}" alt="${item.title}" onerror="this.src='images/fish_logo.png'" />
          ${!isUnlocked ? '<div class="lock-icon">🔒</div>' : '<div class="frame-shine"></div>'}
        </div>
        <p class="gallery-name" ${rarityClass}>${isUnlocked ? '✨ ' + item.title : '❓ ' + (item.category || '神秘生物')}</p>
        <span class="date">${isUnlocked ? `${dateStr} 達成` : (item.task_requirement || '尚未解鎖')}</span>
      </div>
    `;
  }).join("");

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const paginationContainer = document.querySelector(".pagination-container");
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";
  paginationContainer.innerHTML = `
    <button class="page-btn prev-btn" ${currentGalleryPage === 1 ? 'disabled' : ''} onclick="renderGalleryPage(${currentGalleryPage - 1})">&laquo; 上一頁</button>
    <div class="page-numbers">
      ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
        <button class="page-num ${p === currentGalleryPage ? 'active' : ''}" onclick="renderGalleryPage(${p})">${p}</button>
      `).join('')}
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
});

// 初始化頁面
document.addEventListener("DOMContentLoaded", () => {
  updateTokenDisplay();

  const crystal = document.getElementById("crystal-ball");
  if (crystal) {
    crystal.addEventListener("click", () => {
      if (drawTokens > 0 && !document.getElementById("draw-btn").disabled) {
        performDraw();
      }
    });
  }
});