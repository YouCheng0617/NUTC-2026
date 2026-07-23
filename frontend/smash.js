// ✨ 1. 新增：防作弊分數管理器 (取代原本的 let score = 0)
const ScoreManager = (() => {
    let _score = 0;
    let _shadow = btoa("0_secret_ocean_salt"); // 影子變數

    const _check = () => {
        if (_shadow !== btoa(_score + "_secret_ocean_salt")) {
            console.warn("⚠️ 系統偵測到異常修改，分數已強制重置！");
            _score = 0;
            _shadow = btoa("0_secret_ocean_salt");
        }
    };

    return {
        add: (points) => {
            _check();
            _score = Math.max(0, _score + points); // 確保分數不會扣到負數
            _shadow = btoa(_score + "_secret_ocean_salt");
        },
        get: () => {
            _check();
            return _score;
        },
        reset: () => {
            _score = 0;
            _shadow = btoa("0_secret_ocean_salt");
        }
    };
})();

let timeLeft = 30;
let combo = 0;
let currentAmmo = 10; 
let gameInterval;
let spawnInterval;
let isGameRunning = false;

const gameArea = document.getElementById('game-area');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time-left');
const ammoDisplay = document.getElementById('ammo'); 
const uiLayer = document.getElementById('ui-layer');
const comboDisplay = document.getElementById('combo-display');
const comboText = document.getElementById('combo');
const startModal = document.getElementById('start-modal');
const endModal = document.getElementById('end-modal');
const finalScoreDisplay = document.getElementById('final-score');

// ✨ 2. 難易度設定 (補上 label 標籤以供排行榜顯示)
let currentDifficulty = 'normal';
const diffConfig = {
    easy: { label: '簡單', spawnRate: 1000, speedMin: 5.0, speedMax: 7.5, fishChance: 0.10, maxAmmo: 20 }, 
    normal: { label: '普通', spawnRate: 700, speedMin: 3.5, speedMax: 5.5, fishChance: 0.25, maxAmmo: 15 }, 
    hard: { label: '困難', spawnRate: 500, speedMin: 2.0, speedMax: 4.0, fishChance: 0.40, maxAmmo: 10 }  
};

window.setDifficulty = function(level) {
    currentDifficulty = level;
    
    // 切換按鈕的發光狀態
    document.querySelectorAll(".diff-btn").forEach(btn => btn.classList.remove("active-diff"));
    document.getElementById("btn-diff-" + level).classList.add("active-diff");

    // ✨ 動態更新右上角排行榜按鈕的文字
    const diffLabel = diffConfig[level].label;
    const lbButton = document.getElementById("top-right-leaderboard");
    if (lbButton) {
        lbButton.innerText = `🏆 看 [${diffLabel}] 排行榜`;
    }
}

// 🌟 這裡就是不小心被刪除的音效初始化程式碼，已經補回來了！
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playShootSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function playShatterSound() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
    const gain = audioCtx.createGain(); const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 6000;
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    noise.start();
}

function playAmmoSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

function createShatterParticles(x, y, color = 'rgba(173, 216, 230, 0.9)') {
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.style.position = 'absolute'; p.style.left = `${x}px`; p.style.top = `${y}px`;
        p.style.width = `${Math.random() * 6 + 4}px`; p.style.height = p.style.width;
        p.style.background = color; 
        p.style.boxShadow = `0 0 8px ${color}`;
        p.style.pointerEvents = 'none'; p.style.borderRadius = '50%'; p.style.zIndex = '150';
        gameArea.appendChild(p);

        const vx = (Math.random() - 0.5) * 150; 
        const vy = (Math.random() - 0.5) * 150 - 50; 

        p.animate([
            { transform: `translate(0, 0) scale(1)`, opacity: 1 },
            { transform: `translate(${vx}px, ${vy + 200}px) scale(0)`, opacity: 0 }
        ], { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'forwards' });
        setTimeout(() => p.remove(), 800);
    }
}

function createFloatingText(x, y, text, color) {
    const el = document.createElement('div');
    el.innerText = text;
    el.style.position = 'absolute'; el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.color = color; el.style.fontWeight = 'bold'; el.style.fontSize = '1.5rem';
    el.style.pointerEvents = 'none'; el.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
    el.style.zIndex = '200';
    gameArea.appendChild(el);

    el.animate([
        { transform: 'translate(-50%, 0)', opacity: 1 },
        { transform: 'translate(-50%, -50px)', opacity: 0 }
    ], { duration: 800, fill: 'forwards' });
    setTimeout(() => el.remove(), 800);
}

function handleShoot(e) {
    if (!isGameRunning) return;
    e.preventDefault(); 

    if (currentAmmo <= 0) return; 

    initAudio();
    playShootSound();
    currentAmmo--; 

    const rect = gameArea.getBoundingClientRect();
    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const target = e.target.closest('.game-target');

    if (target && target.style.display !== 'none' && !target.classList.contains('swim-away')) {
        const type = target.dataset.type;
        const targetRect = target.getBoundingClientRect();
        
        if (type === 'fish') {
            ScoreManager.add(-20);
            combo = 0; 
            createFloatingText(mouseX, mouseY, "-20分", "#ff4d4d");

            document.body.classList.add('penalty-flash');
            setTimeout(() => document.body.classList.remove('penalty-flash'), 300);
            target.classList.add('swim-away');
            
        } else if (type === 'ammo') {
            const ammoVal = parseInt(target.dataset.val);
            currentAmmo += ammoVal; 
            
            playAmmoSound(); 
            createShatterParticles(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2, '#00ffcc');
            createFloatingText(mouseX, mouseY, `+${ammoVal} 彈藥`, "#00ffcc");
            
            target.style.display = 'none';
        } else {
            playShatterSound(); 
            createShatterParticles(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2);

            combo++; 
            let multiplier = Math.min(combo, 5); 
            let gainedScore = 10 * multiplier;
            
            ScoreManager.add(gainedScore);
            
            createFloatingText(mouseX, mouseY, `+${gainedScore} 分`, "#4da6ff");
            
            target.style.display = 'none';
        }

        setTimeout(() => { if (gameArea.contains(target)) target.remove(); }, 600); 

    } else {
        combo = 0; 
        createFloatingText(mouseX, mouseY, "Miss!", "#ff4d4d");
    }
    
    scoreDisplay.innerText = ScoreManager.get();
    ammoDisplay.innerText = currentAmmo;
    updateComboUI();

    if (currentAmmo <= 0) endGame("彈藥耗盡！");
}

gameArea.addEventListener('mousedown', handleShoot);
gameArea.addEventListener('touchstart', handleShoot, { passive: false });

function spawnTarget() {
    if (!isGameRunning) return;

    const conf = diffConfig[currentDifficulty];
    const rand = Math.random();
    
    let type = 'bottle';
    if (rand < conf.fishChance) {
        type = 'fish';
    } else if (rand > 0.85) { 
        type = 'ammo'; 
    }

    const targetContainer = document.createElement('div');
    targetContainer.className = 'game-target';
    targetContainer.dataset.type = type; 
    
    if (type === 'ammo') {
        const ammoDiv = document.createElement('div');
        ammoDiv.className = 'ammo-shell';
        
        const valRand = Math.random();
        const val = valRand < 0.1 ? 5 : (valRand < 0.4 ? 3 : 1);
        targetContainer.dataset.val = val;
        
        ammoDiv.innerText = '🐚'; 
        ammoDiv.dataset.text = `+${val}`;
        targetContainer.appendChild(ammoDiv);
        
    } else {
        const normalImg = document.createElement('img');
        normalImg.className = 'normal-img';
        normalImg.src = type === 'fish' ? 'images/fish.png' : 'images/bottle.png';
        if (type === 'bottle') normalImg.classList.add('camouflaged');

        const brokenImg = document.createElement('img');
        brokenImg.className = 'broken-img';
        if (type === 'bottle') {
            brokenImg.src = 'images/bottle2.png';
            brokenImg.style.display = 'none';
        }

        targetContainer.appendChild(normalImg);
        if (type === 'bottle') targetContainer.appendChild(brokenImg);
    }
    
    const randomX = Math.random() * 80 + 10; 
    const randomSpeed = Math.random() * (conf.speedMax - conf.speedMin) + conf.speedMin;
    
    targetContainer.style.left = `${randomX}vw`;
    targetContainer.style.animationDuration = `${randomSpeed}s`;

    setTimeout(() => { if(gameArea.contains(targetContainer)) targetContainer.remove(); }, randomSpeed * 1000);
    gameArea.appendChild(targetContainer);
}

function updateComboUI() {
    if (combo > 1) {
        comboDisplay.style.display = 'block';
        comboText.innerText = combo;
        comboDisplay.style.transform = 'scale(1.3)';
        setTimeout(() => comboDisplay.style.transform = 'scale(1)', 100);
    } else {
        comboDisplay.style.display = 'none';
    }
}

window.startGame = function() {
    initAudio();

    const conf = diffConfig[currentDifficulty];

    // ✨ 遊戲開始時重置安全分數
    ScoreManager.reset();
    combo = 0;
    timeLeft = 30;
    currentAmmo = conf.maxAmmo; 
    isGameRunning = true;
    
    scoreDisplay.innerText = ScoreManager.get();
    timeDisplay.innerText = timeLeft;
    ammoDisplay.innerText = currentAmmo;
    updateComboUI();
    
    startModal.style.display = 'none';
    endModal.style.display = 'none';
    uiLayer.style.display = 'flex';
    
    document.getElementById('top-right-leaderboard').style.display = 'none';

    gameArea.innerHTML = '';

    spawnInterval = setInterval(spawnTarget, conf.spawnRate);
    
    gameInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft;
        if (timeLeft <= 0) endGame("時間到！");
    }, 1000);
}

// ================= 真實後端 API 專屬排行榜系統 =================
const API_BASE_URL = "https://163.17.135.120"; 
const GAME_NAME = 'bottle_shooter'; 
let previousModal = 'start-modal'; 

async function showLeaderboard() {
    if (document.getElementById('end-modal').style.display === 'block') {
        previousModal = 'end-modal';
    } else {
        previousModal = 'start-modal';
    }
    
    startModal.style.display = 'none';
    endModal.style.display = 'none';
    document.getElementById('top-right-leaderboard').style.display = 'none';
    
    // ✨ 3. 動態更新排行榜的標題難度
    const diffLabel = diffConfig[currentDifficulty].label;
    const titleEl = document.getElementById('leaderboard-title');
    if (titleEl) {
        titleEl.innerText = `🏆 [${diffLabel}] 狙擊排行榜`;
    }

    const listContainer = document.getElementById('leaderboard-list');
    listContainer.innerHTML = '<li style="justify-content: center; color: #d1e8ff;">連線抓取中... 🌊</li>';
    document.getElementById('leaderboard-modal').style.display = 'block';

    try {
        const token = localStorage.getItem("authToken");
        
        const response = await fetch(`${API_BASE_URL}/game/${GAME_NAME}/${currentDifficulty.toUpperCase()}/ranking?limit=5`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const rawData = await response.json();
            listContainer.innerHTML = ''; 
            
            let leaderboard = [];
            if (Array.isArray(rawData)) leaderboard = rawData;
            else if (rawData.data && Array.isArray(rawData.data)) leaderboard = rawData.data;
            else if (rawData.ranking && Array.isArray(rawData.ranking)) leaderboard = rawData.ranking;

            if (!leaderboard || leaderboard.length === 0) {
                listContainer.innerHTML = '<li style="justify-content: center; color: #aaa;">目前這個難度還沒有人挑戰喔，快來搶榜首！</li>';
            } else {
                const medals = ["🥇", "🥈", "🥉"];
                leaderboard.forEach((entry, index) => {
                    let rankIcon = index < 3 ? medals[index] : `&nbsp;&nbsp;${index + 1}&nbsp;&nbsp;`;
                    
                    let playerName = entry.name || entry.username || entry.nickname || entry.member_name || (entry.member && entry.member.name) || (entry.user && entry.user.name) || "匿名玩家";
                    let playerScore = entry.high_score || entry.score || 0;
                    
                    let li = document.createElement('li');
                    li.innerHTML = `<span>${rankIcon} ${playerName}</span> <span style="color: #ffeb3b;">${playerScore} 分</span>`;
                    listContainer.appendChild(li);
                });
            }
        } else {
            listContainer.innerHTML = '<li style="justify-content: center; color: #ff4d4d;">連線被拒絕，請確認是否已登入！</li>';
        }
    } catch (error) {
        console.error("讀取排行榜失敗", error);
        listContainer.innerHTML = '<li style="justify-content: center; color: #ff4d4d;">伺服器無回應，請稍後再試</li>';
    }
}

function closeLeaderboard() {
    document.getElementById('leaderboard-modal').style.display = 'none';
    document.getElementById(previousModal).style.display = 'block'; 
    document.getElementById('top-right-leaderboard').style.display = 'block'; 
}

async function saveScore(finalScore) {
    if (finalScore <= 0) return; 
    
    const token = localStorage.getItem("authToken");

    try {
        const response = await fetch(`${API_BASE_URL}/game/${GAME_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                difficulty: currentDifficulty.toUpperCase(), 
                score: finalScore
            })
        });

        if (response.status === 401 || response.status === 403) {
            console.log("玩家未登入，無法儲存分數");
            return;
        }

        if (response.ok) {
            console.log("上傳分數成功！");
        }
    } catch (error) {
        console.error("分數上傳失敗", error);
    }
}

// ================= endGame 函式 =================
function endGame(reason = "時間到！") {
    isGameRunning = false;
    clearInterval(spawnInterval);
    clearInterval(gameInterval);
    
    uiLayer.style.display = 'none';
    endModal.style.display = 'block';
    
    document.getElementById('end-title').innerText = reason; 
    
    // ✨ 遊戲結束時，從安全管理器獲取分數
    const finalScore = ScoreManager.get();
    finalScoreDisplay.innerText = finalScore;
    
    const remainingTargets = document.querySelectorAll('.game-target');
    remainingTargets.forEach(t => t.style.pointerEvents = 'none');

    document.getElementById('top-right-leaderboard').style.display = 'block';
    
    // ✨ 使用安全分數進行存檔
    saveScore(finalScore);
}