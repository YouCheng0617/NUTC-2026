// ==================================================
// 🔮 深海碎片抽獎邏輯 (Gacha System)
// ==================================================
let drawTokens = 0; // 玩家目前持有的喚醒石數量

// 定義稀有度、機率與對應的碎片編號 (總共 9 片)
// N: 60% (3片), R: 25% (3片), SR: 12% (2片), SSR: 3% (1片)
const gachaPool = {
  N:   { chance: 0.60, pieces: [1, 2, 3], name: "普通碎片", color: "#2c3e50" },
  R:   { chance: 0.25, pieces: [4, 5, 6], name: "稀有碎片", color: "#004d40" },
  SR:  { chance: 0.12, pieces: [7, 8],    name: "史詩碎片", color: "#4a235a" },
  SSR: { chance: 0.03, pieces: [9],       name: "傳說碎片", color: "#b9770e" }
};

// 1. 領取喚醒石 (完成任務)
function claimToken(btnElement, amount) {
  btnElement.disabled = true;
  btnElement.innerText = "已領取 ✔️";
  btnElement.style.background = "rgba(255, 255, 255, 0.2)";
  btnElement.style.color = "#4da6ff";

  drawTokens += amount;
  updateTokenDisplay();
}

// 2. 更新畫面上的石頭數量與抽獎按鈕狀態
function updateTokenDisplay() {
  document.getElementById("token-count").innerText = drawTokens;
  const drawBtn = document.getElementById("draw-btn");
  if (drawTokens > 0) {
    drawBtn.disabled = false;
  } else {
    drawBtn.disabled = true;
  }
}

// 3. 執行抽獎
function performDraw() {
  if (drawTokens <= 0) return;
  
  // 扣除石頭並鎖定按鈕
  drawTokens--;
  updateTokenDisplay();
  const drawBtn = document.getElementById("draw-btn");
  const crystal = document.getElementById("crystal-ball");
  
  drawBtn.disabled = true;
  crystal.className = "crystal-ball shaking"; // 加上震動動畫
  crystal.innerHTML = `<span style="font-size:3rem;">🌀</span>`; // 旋轉特效圖示

  // 模擬抽獎延遲 (1.5秒後顯示結果)
  setTimeout(() => {
    // 🎲 決定稀有度 (0.00 ~ 0.99)
    const rand = Math.random();
    let rarity = 'N';
    if (rand < 0.03) rarity = 'SSR';             // 0~3%
    else if (rand < 0.15) rarity = 'SR';         // 3%~15%
    else if (rand < 0.40) rarity = 'R';          // 15%~40%
    else rarity = 'N';                           // 40%~100%

    // 🎲 在該稀有度中隨機抽出一張碎片
    const pool = gachaPool[rarity];
    const pieceId = pool.pieces[Math.floor(Math.random() * pool.pieces.length)];

    // ✨ 顯示華麗結果
    crystal.className = `crystal-ball rarity-${rarity}`;
    crystal.innerHTML = `
      <div style="color: ${pool.color}; font-weight: 900; line-height: 1.4;">
        <span style="font-size: 0.9rem; letter-spacing: 2px;">獲得</span><br>
        <span style="font-size: 1.5rem;">${pool.name}</span><br>
        <span style="font-size: 1.1rem; color: #333;">第 ${pieceId} 號碎片</span>
      </div>
    `;

    // 抽完後如果還有石頭，恢復按鈕
    if (drawTokens > 0) drawBtn.disabled = false;
    
  }, 1500); // 動畫持續 1.5 秒
}

// 網頁載入時初始化狀態 (移除原本的 initBoard)
window.onload = function() {
  updateTokenDisplay();
};

/* --- 以下原本的 galleryModal 控制邏輯不用動，請保留 --- */

// ==================================================
// 🖼️ 收藏冊畫廊控制邏輯
// ==================================================
const galleryModal = document.getElementById('gallery-modal');

function openGallery() {
  if (galleryModal) galleryModal.style.display = 'flex';
}

function closeGallery() {
  if (galleryModal) galleryModal.style.display = 'none';
}

// 點擊毛玻璃背景的空白處自動關閉
window.addEventListener('click', function(event) {
  if (event.target === galleryModal) {
    closeGallery();
  }
});

// 網頁載入時執行初始化
window.onload = initBoard;