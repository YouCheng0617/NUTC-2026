let score = 0;
let timeLeft = 30;
let combo = 0;
let gameInterval;
let spawnInterval;
let isGameRunning = false;

const gameArea = document.getElementById('game-area');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time-left');
const uiLayer = document.getElementById('ui-layer');
const comboDisplay = document.getElementById('combo-display');
const comboText = document.getElementById('combo');
const startModal = document.getElementById('start-modal');
const endModal = document.getElementById('end-modal');
const finalScoreDisplay = document.getElementById('final-score');

// 預載破圖
const preloadImg = new Image();
preloadImg.src = 'images/bottle2.png';

let smashSounds = [];
const poolSize = 5;
let isAudioInitialized = false;

function initAudioPool() {
    if (isAudioInitialized) return;
    for (let i = 0; i < poolSize; i++) {
        let audio = new Audio('smash.mp3');
        audio.volume = 0.5;
        audio.muted = true; 
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        }).catch(e => {});
        smashSounds.push(audio);
    }
    isAudioInitialized = true;
}

let soundIndex = 0;

// 1. 生成目標 (瓶子或魚)
function spawnTarget() {
    if (!isGameRunning) return;

    // ✨ 30% 機率出現深海魚干擾視線
    const isFish = Math.random() < 0.3; 

    const targetContainer = document.createElement('div');
    targetContainer.className = 'game-target';
    
    // 生成主要圖案
    const normalImg = document.createElement('img');
    normalImg.src = isFish ? 'images/fish.png' : 'images/bottle.png';
    
    // 如果是瓶子，套用迷彩保護色
    if (!isFish) {
        normalImg.classList.add('camouflaged');
    }

    // 建立破掉的瓶子圖片 (魚不需要)
    const brokenImg = document.createElement('img');
    if (!isFish) {
        brokenImg.src = 'images/bottle2.png?v=' + new Date().getTime();
        brokenImg.style.display = 'none';
    }

    targetContainer.appendChild(normalImg);
    if (!isFish) targetContainer.appendChild(brokenImg);
    
    const randomX = Math.random() * 80 + 10; 
    const randomSpeed = Math.random() * 2 + 2; // 目標移動速度變快了
    
    targetContainer.style.left = `${randomX}vw`;
    targetContainer.style.animationDuration = `${randomSpeed}s`;

    // 點擊判定邏輯
    const hitHandler = function(e) {
        e.preventDefault(); 
        if (targetContainer.classList.contains('shatter-effect') || targetContainer.classList.contains('swim-away')) return;

        if (isFish) {
            // ❌ 誤擊干擾目標 (魚)
            score = Math.max(0, score - 20); // 扣 20 分，最低 0 分
            combo = 0; // 連擊歸零
            scoreDisplay.innerText = score;
            updateComboUI();

            // 觸發紅光警告與魚逃跑動畫
            document.body.classList.add('penalty-flash');
            setTimeout(() => document.body.classList.remove('penalty-flash'), 300);
            targetContainer.classList.add('swim-away');

        } else {
            // ✅ 精準命中 (瓶子)
            if (isAudioInitialized) {
                const currentSound = smashSounds[soundIndex];
                currentSound.currentTime = 0;
                currentSound.play().catch(e => {}); 
                soundIndex = (soundIndex + 1) % poolSize;
            }

            combo++; // 增加連擊
            let multiplier = Math.min(combo, 5); // 最高 5 倍加成
            score += (10 * multiplier);
            scoreDisplay.innerText = score;
            updateComboUI();
            
            // 替換破裂圖片
            normalImg.style.display = 'none';
            brokenImg.style.display = 'block';
            targetContainer.classList.add('shatter-effect');
        }

        setTimeout(() => {
            if (gameArea.contains(targetContainer)) targetContainer.remove();
        }, 600); 
    };

    targetContainer.addEventListener('mousedown', hitHandler);
    targetContainer.addEventListener('touchstart', hitHandler, { passive: false });

    setTimeout(() => {
        if(gameArea.contains(targetContainer)) targetContainer.remove();
    }, randomSpeed * 1000);

    gameArea.appendChild(targetContainer);
}

// 更新 Combo 顯示
function updateComboUI() {
    if (combo > 1) {
        comboDisplay.style.display = 'block';
        comboText.innerText = combo;
        // 放大縮小的跳動特效
        comboDisplay.style.transform = 'scale(1.3)';
        setTimeout(() => comboDisplay.style.transform = 'scale(1)', 100);
    } else {
        comboDisplay.style.display = 'none';
    }
}

// 2. 開始遊戲
window.startGame = function() {
    initAudioPool();

    score = 0;
    combo = 0;
    timeLeft = 30;
    isGameRunning = true;
    scoreDisplay.innerText = score;
    timeDisplay.innerText = timeLeft;
    updateComboUI();
    
    startModal.style.display = 'none';
    endModal.style.display = 'none';
    uiLayer.style.display = 'flex';
    
    gameArea.innerHTML = '';

    // 出生頻率加快，考驗反應
    spawnInterval = setInterval(spawnTarget, 400);
    
    gameInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

// 3. 結束遊戲
function endGame() {
    isGameRunning = false;
    clearInterval(spawnInterval);
    clearInterval(gameInterval);
    
    uiLayer.style.display = 'none';
    endModal.style.display = 'block';
    finalScoreDisplay.innerText = score;
    
    const remainingTargets = document.querySelectorAll('.game-target');
    remainingTargets.forEach(t => t.style.pointerEvents = 'none');
}