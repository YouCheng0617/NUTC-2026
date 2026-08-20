// ==================================================
// 🔮 深海碎片抽獎系統 (Gacha VFX Core)
// ==================================================
let drawTokens = 0;

const gachaPool = {
  N: {
    chance: 0.60,
    pieces: [1, 2, 3],
    name: "普通碎片",
    color: "#00f2fe",
    bg: "radial-gradient(circle, #00f2fe 0%, #004e92 100%)",
    tag: "NORMAL"
  },
  R: {
    chance: 0.25,
    pieces: [4, 5, 6],
    name: "稀有碎片",
    color: "#2ed573",
    bg: "radial-gradient(circle, #2ed573 0%, #1e824c 100%)",
    tag: "RARE"
  },
  SR: {
    chance: 0.12,
    pieces: [7, 8],
    name: "史詩碎片",
    color: "#e056fd",
    bg: "radial-gradient(circle, #e056fd 0%, #68007a 100%)",
    tag: "SUPER RARE"
  },
  SSR: {
    chance: 0.03,
    pieces: [9],
    name: "傳說碎片",
    color: "#ffd200",
    bg: "radial-gradient(circle, #ffd200 0%, #ff6b08 100%)",
    tag: "SSR LEGENDARY"
  }
};

// 1. 領取任務獎勵
function claimToken(btnElement, amount) {
  btnElement.disabled = true;
  btnElement.classList.remove("active");
  btnElement.innerText = "已領取 ✔️";
  btnElement.style.background = "rgba(255, 255, 255, 0.1)";
  btnElement.style.color = "#4facfe";

  drawTokens += amount;
  updateTokenDisplay();
}

// 2. 更新喚醒石顯示與按鈕啟用
function updateTokenDisplay() {
  const tokenCountEl = document.getElementById("token-count");
  const drawBtn = document.getElementById("draw-btn");

  if (tokenCountEl) tokenCountEl.innerText = drawTokens;
  if (drawBtn) drawBtn.disabled = drawTokens <= 0;
}

// 3. 執行高級抽卡召喚動畫
function performDraw() {
  if (drawTokens <= 0) return;

  drawTokens--;
  updateTokenDisplay();

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

  setTimeout(() => {
    // 🎲 決定稀有度
    const rand = Math.random();
    let rarity = "N";
    if (rand < 0.03) rarity = "SSR";
    else if (rand < 0.15) rarity = "SR";
    else if (rand < 0.40) rarity = "R";
    else rarity = "N";

    const pool = gachaPool[rarity];
    const pieceId = pool.pieces[Math.floor(Math.random() * pool.pieces.length)];

    // 💥 階段二：水晶球極速碎裂光爆
    crystal.className = "crystal-ball explode";
    crystal.innerHTML = "";

    // 💥 階段三：展示手遊級發光卡牌與射線
    setTimeout(() => {
      crystal.className = "prize-stage";
      crystal.innerHTML = `
        <div class="prize-rays"></div>
        <div class="prize-card" style="background: ${pool.bg}; box-shadow: 0 0 45px ${pool.color}, inset 0 0 20px rgba(255,255,255,0.85); border-color: ${pool.color};">
          🧩
        </div>
        <div class="rarity-pill" style="background: ${pool.color}; color: #021226;">
          ${pool.tag}
        </div>
        <div class="prize-title" style="color: ${pool.color}; text-shadow: 0 0 16px ${pool.color};">
          ${pool.name}
        </div>
        <div class="prize-desc">第 ${pieceId} 號碎片</div>
      `;

      if (drawTokens > 0) drawBtn.disabled = false;
    }, 400);
  }, 1300);
}

// 支援點擊水晶球直接召喚
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

// ==================================================
// 🖼️ 收藏畫廊彈窗控制
// ==================================================
const galleryModal = document.getElementById("gallery-modal");

function openGallery() {
  if (galleryModal) galleryModal.style.display = "flex";
}

function closeGallery() {
  if (galleryModal) galleryModal.style.display = "none";
}

window.addEventListener("click", function (event) {
  if (event.target === galleryModal) {
    closeGallery();
  }
});