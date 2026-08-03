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

// 3. 執行抽獎 (水晶球炸裂蹦出拼圖版)
function performDraw() {
  if (drawTokens <= 0) return;
  
  drawTokens--;
  updateTokenDisplay();
  const drawBtn = document.getElementById("draw-btn");
  const crystal = document.getElementById("crystal-ball");
  
  drawBtn.disabled = true;
  
  // 💥 階段一：蓄力期 (確保每次抽獎都先變回水晶球的樣貌)
  crystal.className = "crystal-ball drawing"; 
  
  // 利用 SVG 畫出三道會慢慢蔓延的裂痕，取代原本的漩渦
  crystal.innerHTML = `
    <svg class="crack-svg" viewBox="0 0 100 100">
      <!-- 主裂痕 (從上往下，0秒開始蔓延) -->
      <path class="crack-line" style="animation-duration: 0.8s; stroke-dasharray: 150; stroke-dashoffset: 150;" 
            d="M 45,0 L 55,20 L 45,45 L 60,65 L 45,85 L 50,100" />
      <!-- 左側分支裂痕 (延遲 0.3 秒出現，營造碎裂擴散感) -->
      <path class="crack-line" style="animation-duration: 0.5s; animation-delay: 0.3s; stroke-dasharray: 80; stroke-dashoffset: 80;" 
            d="M 45,45 L 25,50 L 10,40" />
      <!-- 右側分支裂痕 (延遲 0.6 秒出現，接近臨界點) -->
      <path class="crack-line" style="animation-duration: 0.5s; animation-delay: 0.6s; stroke-dasharray: 80; stroke-dashoffset: 80;" 
            d="M 60,65 L 85,60 L 95,75" />
    </svg>
  `;

  setTimeout(() => {
    // 🎲 決定稀有度與獎品
    const rand = Math.random();
    let rarity = 'N';
    if (rand < 0.03) rarity = 'SSR';             
    else if (rand < 0.15) rarity = 'SR';         
    else if (rand < 0.40) rarity = 'R';          
    else rarity = 'N';                           

    const pool = gachaPool[rarity];
    const pieceId = pool.pieces[Math.floor(Math.random() * pool.pieces.length)];

    // 💥 階段二：水晶球極速膨脹並炸裂
    crystal.className = "crystal-ball explode";
    crystal.innerHTML = "";

    // 💥 階段三：炸裂後，原地蹦出實體發光拼圖
    setTimeout(() => {
      // 拔掉水晶球外觀，切換成無邊框的「獎品模式」
      crystal.className = "prize-mode";
      
      crystal.innerHTML = `
        <div class="puzzle-reveal" style="background: linear-gradient(135deg, ${pool.color}, #000); box-shadow: 0 0 30px ${pool.color}, inset 0 0 15px rgba(255,255,255,0.6);">
          🧩
        </div>
        <div style="color: ${pool.color}; font-weight: 900; line-height: 1.4; text-align: center; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">
          <span style="font-size: 0.9rem; letter-spacing: 2px; color: #fff;">獲得</span><br>
          <span style="font-size: 1.6rem; filter: brightness(1.5);">${pool.name}</span><br>
          <span style="font-size: 1.1rem; color: #a0c4ff;">第 ${pieceId} 號碎片</span>
        </div>
      `;

      if (drawTokens > 0) drawBtn.disabled = false;
      
    }, 400); // 配合 CSS explode 炸裂的時間點 (0.4秒時蹦出)

  }, 1500); // 蓄力 1.5 秒
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