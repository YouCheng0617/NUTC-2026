// 🛡️ 安全解析 JSON 的小幫手 (防範 localStorage 資料異常導致頁面中斷崩潰)
        function safeJsonParse(rawString, fallbackValue) {
            if (!rawString) return fallbackValue;
            try {
                return JSON.parse(rawString);
            } catch (e) {
                console.warn('[SafeJSON] 解析 JSON 發生錯誤，使用預設值：', e);
                return fallbackValue;
            }
        }

// 🌟 【後台與網路連線資料】
        const API_BASE = 'https://api.drift-bottles.xyz'; // 伺服器網址
        
        // 🌟 1. 嚴格綁定帳號！直接去拿你真實登入系統存下來的 Token
        // 💡 寶寶注意：請把裡面的 'token' 換成你主程式登入時存進 localStorage 的名稱 
        // 💡 把括號裡的字，換成你在 F12 裡面找到的一模一樣的真實名字！
let GAME_TOKEN = localStorage.getItem('authToken') || localStorage.getItem('access_token');
        
        // 🌟 2. 殺掉單機測試防呆！如果沒抓到真實帳號，就不准他玩！
        if (!GAME_TOKEN) {
            alert("請先登入帳號才能看見您的海兔喔！");
            window.location.href = "login.html"; // 封印解除！無情踢回登入頁
        }
        
        let socket = null;
        let currentRoomId = null;
        let otherPlayersData = {};
        let isRoomHost = false; // 🌟 判斷：用來確認目前這個人是不是房間的主人！
        
        // 單機模擬展示模式狀態
        let isMockMode = false;
        let mockIntervals = [];

        // 🌟 【呼叫伺服器 API 的小幫手】
        async function fetchAPI(endpoint, method = 'GET', payload = null) {
            try {
                const options = {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GAME_TOKEN}` }
                };
                if (payload) options.body = JSON.stringify(payload);
                const response = await fetch(`${API_BASE}${endpoint}`, options);
                return await response.json();
            } catch (error) {
                console.warn(`[API] ${endpoint} 失敗，使用本地邏輯...`);
                return null;
            }
        }

        // 🪙 【取得使用者現在金幣/積分數量】
        async function fetchUserCoins() {
            if (!GAME_TOKEN) return;
            try {
                const data = await fetchAPI('/pet-games/coin', 'GET');
                if (data && !data.error) {
                    const coins = data.coin !== undefined ? data.coin : (data.coins !== undefined ? data.coins : (data.points !== undefined ? data.points : null));
                    if (coins !== null && !isNaN(Number(coins))) {
                        gameState.points = Number(coins);
                        saveGame();
                        updateUI();
                    }
                }
            } catch (e) {
                console.warn('抓取金幣數量失敗，使用本地存檔數值', e);
            }
        }

        // 🌟 【多人連線小總管】負責跟伺服器打招呼，處理誰加進來、誰離開，還有房主權限的判定
        function initSocketIO() {
            try {
                socket = io(API_BASE, { reconnectionAttempts: 3, timeout: 2000, transports: ['websocket', 'polling'] });
                socket.on('connect', () => { console.log('Socket 連線成功!'); });
                
                // 創立房間成功 -> 代表我是房主
                socket.on('room_created', (data) => { 
                    isRoomHost = true; 
                    currentRoomId = data.roomId; 
                    updateRoomUI(`房間代碼: ${currentRoomId} (房主)`); 
                    showFloatText('創立房間成功！'); 
                });
                
                // 加入別人的房間 -> 代表我是作客的
                socket.on('room_joined', (data) => {
                    console.log("偷看後端傳來的房間資料：", data); // 👈 加上這行！132
                    isRoomHost = false; 
                    currentRoomId = data.roomId; 
                    updateRoomUI(`已加入房間: ${currentRoomId}`); 
                    showFloatText('加入房間成功！');
                    document.getElementById('otherPlayersLayer').innerHTML = ''; 
                    otherPlayersData = {};
                    // 把房間裡原有的玩家畫出來
                    if(data.players) { 
                        data.players.forEach(p => { if(p.socketId !== socket.id) addOtherPlayer(p); }); 
                    }
                });

                socket.on('player_joined', (p) => { addOtherPlayer(p); showFloatText(`${p.petName} 來串門子了！`); });
                socket.on('player_moved', (data) => { /* 寶寶專屬護法陣型，不吃原本亂跑的設定 */ });
                socket.on('player_left', (data) => {
                    const el = document.getElementById(`player-${data.socketId}`);
                    if(el) { el.remove(); delete otherPlayersData[data.socketId]; }
                });
                socket.on('receive_message', (data) => { showChatBubble(data.senderName, data.message); });
                socket.on('error', (err) => { alert(err.message || "發生錯誤"); });
            } catch (e) { console.log('Socket.IO 未連線'); }
        }

        function getPlayerData() { return { memberId: Math.floor(Math.random() * 1000), petName: gameState.petName || '小可愛', petColor: gameState.currentSpecies }; }
        
        function createSocketRoom() { 
            if(!socket || !socket.connected) {
                if(confirm("伺服器未連線！要先開啟「單機模擬展示」看看連線後的樣子嗎？")) {
                    startMockMultiplayer();
                }
                return;
            }
            socket.emit('create_room', { playerData: getPlayerData(), maxPlayers: 6 }); 
        }

        function joinSocketRoom() {
            if(!socket || !socket.connected) {
                if(confirm("伺服器未連線！要先開啟「單機模擬展示」看看連線後的樣子嗎？")) {
                    startMockMultiplayer();
                }
                return;
            }
            const code = prompt("請輸入 6 碼房間邀請碼 (大寫英數):");
            if (code && code.trim().length > 0) socket.emit('join_room', { roomId: code.trim().toUpperCase(), playerData: getPlayerData() });
        }

        function leaveSocketRoom() { 
            if(isMockMode) {
                isMockMode = false;
                mockIntervals.forEach(clearInterval);
                mockIntervals = [];
            } else if(socket) {
                socket.emit('leave_room'); 
            }
            currentRoomId = null; 
            document.getElementById('otherPlayersLayer').innerHTML = ''; 
            otherPlayersData = {}; 
            updateRoomUI("尚未連線"); 
        }
        // 🌟 展開或收合連線面板的小魔法
        function toggleMpPanel() {
            const panel = document.getElementById('mpPanel');
            // 如果是隱藏的，就讓它彈出來；如果已經打開了，就把它收回去
            if (panel.style.display === 'none') {
                panel.style.display = 'flex';
            } else {
                panel.style.display = 'none';
            }
        }
        function toggleShopPanel() {
    const panel = document.getElementById('uiPanel');
    if (panel) {
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
        } else {
            panel.classList.add('open');
        }
    }
}
// 🌟 【貼心小工具：一鍵複製房間代碼】
function copyRoomId() {
    if (!currentRoomId) return; // 防呆：如果沒有代碼就不做事

    // 呼叫瀏覽器內建的剪貼簿 API 來複製
    navigator.clipboard.writeText(currentRoomId).then(() => {
        // 複製成功，觸發畫面上飄起可愛的提示字！
        showFloatText('📋 代碼複製成功！', 2000);
    }).catch(err => {
        // 萬一遇到某些舊版瀏覽器擋住，就跳出傳統的框框讓玩家自己複製
        prompt("請手動複製代碼：", currentRoomId);
    });
}
        function sendChatPrompt() { 
            const msg = prompt("想說些什麼呀？"); 
            if(msg) {
                if (isMockMode) { showChatBubble(gameState.petName || '我的海兔', msg); } 
                else if(socket && currentRoomId) { socket.emit('send_message', { roomId: currentRoomId, message: msg }); }
            } 
        }

        function broadcastMove(x, y) { 
            if (socket && currentRoomId && !isMockMode) { socket.emit('move', { roomId: currentRoomId, x, y }); } 
        }
        
        // 🌟 【單機展示模式】沒網路時的備用方案，假裝有人陪你玩
        function startMockMultiplayer() {
            isMockMode = true;
            isRoomHost = true; // 🌟 單機模式下，你當然就是老大！
            currentRoomId = "DEMO99";
            updateRoomUI(`房間代碼: ${currentRoomId} (模擬展示)`);
            showFloatText('進入模擬連線模式！');

            // 隨便捏造兩隻可愛的海兔鄰居
            const fakePlayers = [
                { socketId: 'fake_1', petName: '隔壁小明', petColor: 'ocean', x: 50, y: 80 },
                { socketId: 'fake_2', petName: '可愛兔兔', petColor: 'sakura', x: 220, y: 140 }
            ];
            fakePlayers.forEach(p => addOtherPlayer(p));
        }

        // 🌟 【寶寶專屬：好友護法列陣系統】讓好友乖乖排在你旁邊
        function updateFriendsPosition() {
            const slugEl = document.getElementById('slugContainer');
            const cx = parseFloat(slugEl.style.left) || (window.innerWidth / 2 - 170);
            const cy = parseFloat(slugEl.style.top) || (window.innerHeight * 0.29 - 120);

            // 排列位置：左、右、左下、右下
            const offsets = [
                { dx: -240, dy: 20 }, { dx: 260, dy: 20 },
                { dx: -130, dy: 160 }, { dx: 150, dy: 160 }
            ];

            Object.keys(otherPlayersData).forEach((id, index) => {
                const el = document.getElementById(`player-${id}`);
                if (el) {
                    const offset = offsets[index % 4];
                    el.style.left = (cx + offset.dx) + 'px';
                    el.style.top = (cy + offset.dy) + 'px';
                }
            });
        }

// 把其他玩家畫到畫面上（完整全配版！）
        function addOtherPlayer(p) {
            otherPlayersData[p.socketId] = p;
            const spec = speciesData[p.petColor] || speciesData['snow'];
            const el = document.createElement('div'); 
            el.className = 'other-player'; 
            el.id = `player-${p.socketId}`; 
            
            // 🌟 幫每個朋友生出完整的 SVG 結構，包含尾巴、斑點跟專屬漸層！
            el.innerHTML = `
                <div class="other-player-name">${p.petName}</div>
                <svg viewBox="0 0 340 240" style="width: 100%; height: 100%; transform: scale(0.9); transform-origin: top left; filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));">
                    <defs>
                        <!-- 替每個朋友建立專屬的耳朵漸層 ID，才不會大家都共用到同一個顏色 -->
                        <linearGradient id="earGrad-${p.socketId}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="${spec.earTop}" />
                            <stop offset="60%" stop-color="${spec.earTop}" />
                            <stop offset="100%" stop-color="${spec.body}" />
                        </linearGradient>
                    </defs>
                    <g filter="url(#handDrawn)">
                        <ellipse cx="170" cy="205" rx="120" ry="15" fill="rgba(0,0,0,0.12)" />

                        <!-- 🌟 補回毛茸茸的尾巴 -->
                        <g class="anim-tail" stroke="${spec.outline}" stroke-width="4" stroke-linejoin="round">
                            <path d="M 250 170 C 270 180, 300 190, 290 140 C 280 100, 250 140, 240 170 Z" fill="${spec.tail}"/>
                            <path d="M 260 150 C 290 160, 320 120, 280 80 C 260 60, 230 110, 250 150 Z" fill="${spec.tail}"/>
                            <path d="M 240 130 C 260 100, 270 70, 240 50 C 210 30, 200 90, 230 120 Z" fill="${spec.tail}"/>
                        </g>

                        <!-- 身體主體 -->
                        <path d="M 70 190 C 20 180, 30 120, 90 110 C 160 100, 220 105, 260 130 C 290 150, 280 200, 200 210 C 130 220, 90 200, 70 190 Z" fill="${spec.body}" stroke="${spec.outline}" stroke-width="5" stroke-linejoin="round"/>

                        <!-- 🌟 補回靈魂小斑點 -->
                        <g fill="${spec.spot}">
                            <circle cx="90" cy="135" r="4"/><circle cx="125" cy="125" r="5"/><circle cx="170" cy="130" r="3.5"/><circle cx="210" cy="140" r="5.5"/><circle cx="245" cy="155" r="4"/>
                            <circle cx="75" cy="160" r="4.5"/><circle cx="110" cy="165" r="3"/><circle cx="145" cy="180" r="5.5"/><circle cx="190" cy="185" r="4"/><circle cx="230" cy="175" r="4.5"/>
                            <circle cx="100" cy="190" r="4"/><circle cx="160" cy="200" r="4.5"/><circle cx="205" cy="195" r="3.5"/>
                        </g>

                        <!-- 補回帶有漸層的耳朵 -->
                        <g stroke="${spec.outline}" stroke-width="4" stroke-linejoin="round">
                            <path class="anim-earL" d="M 100 105 C 80 50, 95 20, 110 25 C 125 30, 120 90, 115 105 Z" fill="url(#earGrad-${p.socketId})"/>
                            <path class="anim-earR" d="M 145 100 C 135 45, 160 15, 175 25 C 190 35, 165 85, 160 100 Z" fill="url(#earGrad-${p.socketId})"/>
                        </g>

                        <!-- 五官與 🌟 補回可愛腮紅 -->
                        <g transform="translate(130, 150)">
                            <ellipse cx="-35" cy="12" rx="14" ry="8" fill="${spec.blush}" opacity="0.85"/>
                            <ellipse cx="35" cy="12" rx="14" ry="8" fill="${spec.blush}" opacity="0.85"/>
                            <circle cx="-20" cy="0" r="7" fill="#2c3e50" />
                            <circle cx="20" cy="0" r="7" fill="#2c3e50" />
                            <circle cx="-18" cy="-2" r="2.5" fill="#ffffff" />
                            <circle cx="22" cy="-2" r="2.5" fill="#ffffff" />
                            <path d="M -7 5 Q 0 12 7 5" fill="none" stroke="#2c3e50" stroke-width="3.5" stroke-linecap="round"/>
                        </g>
                    </g>
                </svg>`;
            document.getElementById('otherPlayersLayer').appendChild(el);
            
            updateFriendsPosition(); // 呼叫排隊系統
        }

// 🌟 【切換介面顯示狀態】進入房間後，把商店收起來，只有房主能開百寶袋
function updateRoomUI(text) {
    const statusEl = document.getElementById('roomStatusText');
    
    if (currentRoomId && text !== "尚未連線") {
        statusEl.innerHTML = text + ` <button onclick="copyRoomId()" style="background: var(--accent-color); border: none; border-radius: 8px; cursor: pointer; padding: 4px 8px; font-size: 0.85rem; color: white; font-weight: 900; margin-left: 8px; box-shadow: 0 3px 0 rgba(255, 182, 193, 0.8); vertical-align: middle;" onmousedown="this.style.transform='translateY(3px)'; this.style.boxShadow='none';" onmouseup="this.style.transform='none'; this.style.boxShadow='0 3px 0 rgba(255, 182, 193, 0.8)';">📋 複製</button>`;
    } else {
        statusEl.innerText = text;
    }

    const btnFeed = document.getElementById('btnFeed');
    const btnClean = document.getElementById('btnClean');
    const btnPet = document.getElementById('btnPet');
    const tabs = document.querySelector('.ui-panel .tabs');
    const shopGrid = document.getElementById('shopGrid');
    const btnCatalog = document.getElementById('btnCatalog');

    if (currentRoomId) {
        // 已連線：隱藏大廳按鈕，顯示房間按鈕
        document.getElementById('btnCreateRoom').style.display = 'none'; 
        document.getElementById('btnJoinRoom').style.display = 'none'; 
        document.getElementById('btnChat').style.display = 'block'; 
        document.getElementById('btnLeaveRoom').style.display = 'block';
        
        // 隱藏互動按鈕與商店區塊
        if (btnFeed) btnFeed.style.display = 'none';
        if (btnClean) btnClean.style.display = 'none';
        if (btnPet) btnPet.style.display = 'none';
        if (tabs) tabs.style.display = 'none';
        if (shopGrid) shopGrid.style.display = 'none';
        
        // 🌟 房主專屬特權：如果是房主就顯示百寶袋，不然就隱藏
        if (btnCatalog) {
            btnCatalog.style.display = isRoomHost ? 'flex' : 'none';
        }
    } else {
        // 未連線：顯示大廳按鈕
        document.getElementById('btnCreateRoom').style.display = 'block'; 
        document.getElementById('btnJoinRoom').style.display = 'block'; 
        document.getElementById('btnChat').style.display = 'none'; 
        document.getElementById('btnLeaveRoom').style.display = 'none';
        
        // 恢復原狀，顯示互動按鈕與商店
        if (btnFeed) btnFeed.style.display = 'flex';
        if (btnClean) btnClean.style.display = 'flex';
        if (btnPet) btnPet.style.display = 'flex';
        if (tabs) tabs.style.display = 'flex';
        if (shopGrid) shopGrid.style.display = 'grid';
        if (btnCatalog) btnCatalog.style.display = 'none';
    }
}

        // 🌟 產生對話泡泡
        function showChatBubble(name, message) {
            const el = document.createElement('div'); 
            el.className = 'chat-bubble'; 
            el.innerHTML = `<span style="font-size:0.8em; color:var(--text-dim);">${name}</span><br/>${message}`;
            let targetEl = document.getElementById('slugContainer');
            // 如果不是自己說的，就貼到對應的玩家頭上
            if (name !== gameState.petName && name !== '系統') {
                const others = document.querySelectorAll('.other-player-name');
                others.forEach(node => { if (node.innerText === name) targetEl = node.parentElement; });
            }
            if (targetEl) targetEl.appendChild(el);
            setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
        }

        // 🌟 【多國語言翻譯字典】
const i18n = {
            zh: {
                backBtn: "🏠 返回", points: "積分", langBtn: "EN", 
                gachaTitle: "發現神祕海兔卵", gachaBox: "點擊孵化", startBtn: "開始照顧",
                feed: "餵食海藻", clean: "淨化水質", pet: "活力運動",
                dailyTitle: "📅 任務", dailyDesc: "點我領錢",
                modalDailyHeader: "📅 每日任務", modalDailySub: "完成任務領取豐厚獎勵！", closeBtn: "關閉",
                taskCompletedToast: "🎉 達成每日任務！快去領取獎勵～",
                taskClaimedToast: "🎁 成功領取任務獎勵 +",
                taskStatus: { claimed: "已領取", claim: "領取 +", uncompleted: "進行中" },
                taskNames: {
                    pet: { title: "陪伴海兔運動", desc: "丟球讓海兔撿球運動 1 次" },
                    feed: { title: "餵食美味海藻", desc: "餵海兔吃美味海藻 1 次" },
                    clean: { title: "淨化水質環境", desc: "拿抹布擦乾淨魚缸 1 次" }
                },
                cooldown: "冷卻", ready: "可互動",
                tabSpecies: "圖鑑", tabBg: "背景", tabEffect: "特效",
                equip: "使用中", owned: "已解鎖",
                mpBtn: "📡 連線", roomNotConnected: "尚未連線", createRoom: "創立房間", joinRoom: "加入房間", chat: "💬 聊天", leaveRoom: "離開房間",

                // 🌟 14天簽到與累計簽到
                dailyGiftTitle: "14天簽到",
                modalCheckInHeader: "🎁 14天簽到獎勵",
                modalCheckInSub: "連續簽到拿大獎，第7與14天翻倍！",
                dayPrefix: "第 ",
                daySuffix: " 天",
                checkInBtn: "馬上簽到！",
                checkInClaimed: "今天已簽到 (明天再來)",
                closeCalendarBtn: "關閉日曆",
                checkInSuccessToast: "✨ 簽到成功 +",
                alreadyCheckedInToast: "今天已經簽到過囉！",
                serverErrorToast: "伺服器連線異常，請稍後再試！",
                modalStreakHeader: "📅 每日簽到",
                streakPrefix: "累計簽到第",
                streakSuffix: "天",
                todayRewardTitle: "今日獎勵",
                claimStreakRewardBtn: "開心收下！💰",

                // 🪪 海兔身份證名片
                idCardTitle: "🪪 身份證",
                idCardDesc: "海兔檔案",
                idCardHeader: "🪪 海兔名片",
                idCardPhotoHint: "證件照拍攝中...",
                idCardNameLabel: "名字：",
                idCardSpeciesLabel: "品種：",
                editNameTitle: "修改名字",
                closeIdCardBtn: "收起名片",
                unknownSpecies: "未知品種",
                defaultPetName: "神祕海兔",

                // 🎨 自選純色背景
                pickColor: "換顏色",
                colorTitle: "挑一個喜歡的顏色",
                colorCustom: "自訂顏色",
                colorDone: "完成"
            },
            en: {
                backBtn: "🏠 Home", points: "Pts", langBtn: "中文", 
                gachaTitle: "Mystic Egg Found", gachaBox: "Incubate", startBtn: "Start Caring",
                feed: "Feed Algae", clean: "Purify Water", pet: "Play Catch",
                dailyTitle: "📅 Quests", dailyDesc: "Get Coins",
                modalDailyHeader: "📅 Daily Quests", modalDailySub: "Complete quests to earn rewards!", closeBtn: "Close",
                taskCompletedToast: "🎉 Quest Completed! Claim your reward now!",
                taskClaimedToast: "🎁 Reward Claimed +",
                taskStatus: { claimed: "Claimed", claim: "Claim +", uncompleted: "In Progress" },
                taskNames: {
                    pet: { title: "Play catch with slug", desc: "Throw the ball for slug 1 time" },
                    feed: { title: "Feed tasty algae", desc: "Feed delicious algae 1 time" },
                    clean: { title: "Purify aquarium water", desc: "Wipe and clean aquarium 1 time" }
                },
                cooldown: "CD", ready: "Ready",
                tabSpecies: "Species", tabBg: "Background", tabEffect: "Effects",
                equip: "Active", owned: "Unlocked",
                mpBtn: "📡 Connect", roomNotConnected: "Not Connected", createRoom: "Create Room", joinRoom: "Join Room", chat: "💬 Chat", leaveRoom: "Leave Room",

                // 🌟 14-day check-in and streak reward
                dailyGiftTitle: "14-Day Check-in",
                modalCheckInHeader: "🎁 14-Day Check-in Rewards",
                modalCheckInSub: "Check in daily for rewards! Doubled on Day 7 & 14!",
                dayPrefix: "Day ",
                daySuffix: "",
                checkInBtn: "Check In Now!",
                checkInClaimed: "Checked in today (Come back tomorrow)",
                closeCalendarBtn: "Close Calendar",
                checkInSuccessToast: "✨ Check-in successful +",
                alreadyCheckedInToast: "You have already checked in today!",
                serverErrorToast: "Server connection failed, please try again later!",
                modalStreakHeader: "📅 Daily Check-in",
                streakPrefix: "Checked in for",
                streakSuffix: "day(s)",
                todayRewardTitle: "Today's Reward",
                claimStreakRewardBtn: "Claim Reward! 💰",

                // 🪪 Slug ID card
                idCardTitle: "🪪 ID Card",
                idCardDesc: "Slug Profile",
                idCardHeader: "🪪 Slug ID Card",
                idCardPhotoHint: "Taking ID photo...",
                idCardNameLabel: "Name: ",
                idCardSpeciesLabel: "Species: ",
                editNameTitle: "Rename",
                closeIdCardBtn: "Close Card",
                unknownSpecies: "Unknown Species",
                defaultPetName: "Mystic Slug",

                // 🎨 Custom color background
                pickColor: "Change Color",
                colorTitle: "Pick a color you like",
                colorCustom: "Custom",
                colorDone: "Done"
            }
        };
        let currLang = 'zh';

        // 🌟 【遊戲資料大腦】所有關於你有什麼東西、多少錢，都存在這裡
        let gameState = {
            hasAdopted: false,
            points: 2000,
            petName: '', 
            currentSpecies: 'snow',
            currentBg: 'sky',
            currentEffect: 'none',
            dirtiness: 0, // 🌟 0: 乾淨清澈, 100: 最髒且完全看不見海兔
            lastDirtTime: Date.now(), // 記錄上次計算髒污的時間戳記
            hunger: 100, // 🌟 100 代表吃飽飽，0 代表肚子快餓扁了
            lastHungerTime: Date.now(), // 記錄上次計算飢餓度的時間戳記
            unlockedSpecies: [],
            customBgColor: '#dbeafe', // 🎨 免費的自選純色背景，玩家挑的顏色存在這
            unlockedBgs: ['sky'],
            unlockedEffects: ['none'],
            cooldowns: { feed: 0, clean: 0, pet: 0 }
        };

        // 🌟 【圖鑑資料庫：幻獸、背景、特效】
        /* ... 原本的顏色與商品設定，完全保留不變 ... */
        const speciesData = {
            snow: { name: {zh: '經典雪兔', en: 'Snow Bunny'}, cost: 0, body: '#ffffff', outline: '#3f2a2a', earTop: '#3f2a2a', tail: '#3f2a2a', spot: '#3f2a2a', blush: '#fca5a5' },
            ocean: { name: {zh: '深海藍寶', en: 'Ocean Gem'}, cost: 1200, body: '#e0f2fe', outline: '#1e3a8a', earTop: '#1e3a8a', tail: '#1e3a8a', spot: '#1e3a8a', blush: '#f472b6' },
            matcha: { name: {zh: '抹茶麻糬', en: 'Matcha Mochi'}, cost: 1500, body: '#ecfccb', outline: '#14532d', earTop: '#14532d', tail: '#14532d', spot: '#14532d', blush: '#f87171' },
            berry: { name: {zh: '草莓牛奶', en: 'Strawberry Milk'}, cost: 1800, body: '#fce7f3', outline: '#831843', earTop: '#831843', tail: '#831843', spot: '#831843', blush: '#fb7185' },
            choco: { name: {zh: '焦糖布丁', en: 'Caramel Pudding'}, cost: 2000, body: '#fef3c7', outline: '#713f12', earTop: '#713f12', tail: '#713f12', spot: '#713f12', blush: '#f87171' },
            grape: { name: {zh: '薰衣草', en: 'Lavender'}, cost: 2200, body: '#f3e8ff', outline: '#4c1d95', earTop: '#4c1d95', tail: '#4c1d95', spot: '#4c1d95', blush: '#f472b6' },
            lemon: { name: {zh: '黃金檸檬', en: 'Golden Lemon'}, cost: 2500, body: '#fef08a', outline: '#9a3412', earTop: '#ea580c', tail: '#ea580c', spot: '#ea580c', blush: '#ef4444' },
            sesame: { name: {zh: '黑糖芝麻', en: 'Sesame'}, cost: 2800, body: '#f1f5f9', outline: '#0f172a', earTop: '#0f172a', tail: '#0f172a', spot: '#0f172a', blush: '#f87171' },
            sakura: { name: {zh: '櫻花雪兔', en: 'Sakura Bunny'}, cost: 3000, body: '#ffffff', outline: '#be185d', earTop: '#f472b6', tail: '#f472b6', spot: '#f472b6', blush: '#fb7185' },
            peachSlug: { name: {zh: '甜心水蜜桃', en: 'Sweet Peach'}, cost: 3200, body: '#fff1f2', outline: '#881337', earTop: '#fb7185', tail: '#fda4af', spot: '#f43f5e', blush: '#f43f5e' },
            banana: { name: {zh: '香蕉牛奶', en: 'Banana Milk'}, cost: 3200, body: '#fefce8', outline: '#713f12', earTop: '#facc15', tail: '#fde047', spot: '#ca8a04', blush: '#fca5a5' },
            blueberry: { name: {zh: '藍莓起司', en: 'Blueberry Pie'}, cost: 3400, body: '#e0e7ff', outline: '#1e1b4b', earTop: '#6366f1', tail: '#818cf8', spot: '#4f46e5', blush: '#c7d2fe' },
            avocado: { name: {zh: '酪梨優格', en: 'Avocado Yogurt'}, cost: 3400, body: '#f7fee7', outline: '#365314', earTop: '#84cc16', tail: '#a3e635', spot: '#65a30d', blush: '#fca5a5' },
            mint: { name: {zh: '薄荷巧克力', en: 'Mint Choco'}, cost: 3500, body: '#ccfbf1', outline: '#0f766e', earTop: '#3f2a2a', tail: '#3f2a2a', spot: '#3f2a2a', blush: '#f472b6' },
            springBlossom: { name: {zh: '春日櫻笛', en: 'Spring Blossom'}, cost: 3500, body: '#fff1f2', outline: '#831843', earTop: '#fb7185', tail: '#f43f5e', spot: '#fda4af', blush: '#f43f5e' },
            summerBreeze: { name: {zh: '夏日微風', en: 'Summer Breeze'}, cost: 3500, body: '#ecfeff', outline: '#164e63', earTop: '#22d3ee', tail: '#67e8f9', spot: '#0891b2', blush: '#99f6e4' },
            autumnMaple: { name: {zh: '秋意楓紅', en: 'Autumn Maple'}, cost: 3500, body: '#fff7ed', outline: '#7c2d12', earTop: '#f97316', tail: '#ea580c', spot: '#c2410c', blush: '#fca5a5' },
            winterSnow: { name: {zh: '冬夜初雪', en: 'Winter Snow'}, cost: 3500, body: '#f8fafc', outline: '#334155', earTop: '#94a3b8', tail: '#cbd5e1', spot: '#64748b', blush: '#e2e8f0' },
            taro: { name: {zh: '香芋布丁', en: 'Taro Pudding'}, cost: 3600, body: '#f3e8ff', outline: '#581c87', earTop: '#a855f7', tail: '#c084fc', spot: '#9333ea', blush: '#fbcfe8' },
            papaya: { name: {zh: '木瓜牛奶', en: 'Papaya Milk'}, cost: 3600, body: '#ffedd5', outline: '#7c2d12', earTop: '#fb923c', tail: '#fdba74', spot: '#f97316', blush: '#fca5a5' },
            watermelon: { name: {zh: '清涼西瓜', en: 'Watermelon'}, cost: 3800, body: '#bbf7d0', outline: '#14532d', earTop: '#f87171', tail: '#f87171', spot: '#000000', blush: '#fca5a5' },
            kiwi: { name: {zh: '奇異果派', en: 'Kiwi Tart'}, cost: 3800, body: '#f7fee7', outline: '#1a2e05', earTop: '#65a30d', tail: '#84cc16', spot: '#4d7c0f', blush: '#fca5a5' },
            dragonfruit: { name: {zh: '火龍果精靈', en: 'Dragon Fruit'}, cost: 4000, body: '#fdf2f8', outline: '#500724', earTop: '#ec4899', tail: '#f472b6', spot: '#db2777', blush: '#fbcfe8' },
            mango: { name: {zh: '夏日芒果', en: 'Summer Mango'}, cost: 4000, body: '#fff7ed', outline: '#7c2d12', earTop: '#f97316', tail: '#fb923c', spot: '#ea580c', blush: '#fca5a5' },
            ruby: { name: {zh: '璀璨紅寶石', en: 'Ruby Glow'}, cost: 4200, body: '#ffe4e6', outline: '#881337', earTop: '#e11d48', tail: '#e11d48', spot: '#9f1239', blush: '#fb7185' },
            sapphire: { name: {zh: '皇家藍寶石', en: 'Royal Sapphire'}, cost: 4200, body: '#e0f2fe', outline: '#172554', earTop: '#2563eb', tail: '#2563eb', spot: '#1d4ed8', blush: '#93c5fd' },
            emeraldSlug: { name: {zh: '微光祖母綠', en: 'Glow Emerald'}, cost: 4200, body: '#ecfdf5', outline: '#022c22', earTop: '#059669', tail: '#059669', spot: '#047857', blush: '#6ee7b7' },
            amethyst: { name: {zh: '夢幻紫水晶', en: 'Amethyst Dream'}, cost: 4200, body: '#f5f3ff', outline: '#3b0764', earTop: '#7c3aed', tail: '#7c3aed', spot: '#6d28d9', blush: '#c084fc' },
            topaz: { name: {zh: '耀眼托帕石', en: 'Solar Topaz'}, cost: 4200, body: '#fffbeb', outline: '#78350f', earTop: '#d97706', tail: '#d97706', spot: '#b45309', blush: '#fcd34d' },
            coconut: { name: {zh: '椰香白巧', en: 'Coconut White'}, cost: 4200, body: '#ffffff', outline: '#292524', earTop: '#d7d3d0', tail: '#d7d3d0', spot: '#a8a29e', blush: '#fbcfe8' },
            galaxy: { name: {zh: '星空宇宙', en: 'Galaxy'}, cost: 4500, body: '#1e1b4b', outline: '#c7d2fe', earTop: '#8b5cf6', tail: '#8b5cf6', spot: '#fde047', blush: '#d8b4fe' },
            jade: { name: {zh: '溫潤白玉', en: 'Soft Jade'}, cost: 4500, body: '#f0fdf4', outline: '#134e4a', earTop: '#2dd4bf', tail: '#2dd4bf', spot: '#0f766e', blush: '#99f6e4' },
            macaron: { name: {zh: '法式馬卡龍', en: 'French Macaron'}, cost: 4500, body: '#fbcfe8', outline: '#831843', earTop: '#fed7aa', tail: '#a7f3d0', spot: '#f472b6', blush: '#f472b6' },
            cottonCandy: { name: {zh: '夢幻棉花糖', en: 'Cotton Candy'}, cost: 4500, body: '#e0e7ff', outline: '#3730a3', earTop: '#fbcfe8', tail: '#c7d2fe', spot: '#818cf8', blush: '#f472b6' },
            puddingCaramel: { name: {zh: '焦糖布丁燒', en: 'Caramel Flan'}, cost: 4500, body: '#fef3c7', outline: '#78350f', earTop: '#b45309', tail: '#d97706', spot: '#92400e', blush: '#f87171' },
            matchaLatte: { name: {zh: '特濃抹茶拿鐵', en: 'Matcha Latte'}, cost: 4500, body: '#dcfce7', outline: '#14532d', earTop: '#15803d', tail: '#22c55e', spot: '#166534', blush: '#fca5a5' },
            obsidian: { name: {zh: '神祕黑曜石', en: 'Dark Obsidian'}, cost: 4800, body: '#18181b', outline: '#71717a', earTop: '#27272a', tail: '#27272a', spot: '#52525b', blush: '#a1a1aa' },
            sunset: { name: {zh: '日落晚霞', en: 'Sunset'}, cost: 5000, body: '#ffedd5', outline: '#9a3412', earTop: '#f97316', tail: '#f43f5e', spot: '#9a3412', blush: '#fca5a5' },
            pearl: { name: {zh: '極光珍珠', en: 'Aurora Pearl'}, cost: 5000, body: '#fafafa', outline: '#475569', earTop: '#e2e8f0', tail: '#e2e8f0', spot: '#cbd5e1', blush: '#fbcfe8' },
            halloweenBat: { name: {zh: '萬聖小蝙蝠', en: 'Spooky Bat'}, cost: 5000, body: '#18181b', outline: '#f97316', earTop: '#a855f7', tail: '#7e22ce', spot: '#f97316', blush: '#c084fc' },
            christmasTree: { name: {zh: '耶誕小樹', en: 'Xmas Tree'}, cost: 5000, body: '#064e3b', outline: '#fef08a', earTop: '#ef4444', tail: '#10b981', spot: '#f59e0b', blush: '#f87171' },
            valentineRose: { name: {zh: '情人玫瑰', en: 'Valentine Rose'}, cost: 5000, body: '#fff1f2', outline: '#9f1239', earTop: '#e11d48', tail: '#be123c', spot: '#fb7185', blush: '#f43f5e' },
            newYearTiger: { name: {zh: '迎春小福虎', en: 'Lunar Tiger'}, cost: 5000, body: '#fffbeb', outline: '#78350f', earTop: '#f59e0b', tail: '#d97706', spot: '#1c1917', blush: '#f87171' },
            amber: { name: {zh: '千年琥珀', en: 'Ancient Amber'}, cost: 5200, body: '#fef3c7', outline: '#451a03', earTop: '#b45309', tail: '#b45309', spot: '#92400e', blush: '#f87171' },
            coffee: { name: {zh: '焦糖拿鐵', en: 'Caramel Latte'}, cost: 5500, body: '#ddbea9', outline: '#6b705c', earTop: '#ffe8d6', tail: '#ffe8d6', spot: '#cb997e', blush: '#ffb4a2' },
            coralSlug: { name: {zh: '海底珊瑚', en: 'Deep Coral'}, cost: 5500, body: '#ffe4e6', outline: '#4c0519', earTop: '#fb7185', tail: '#fb7185', spot: '#f43f5e', blush: '#fda4af' },
            ghost: { name: {zh: '幽靈白兔', en: 'Spooky Ghost'}, cost: 6000, body: '#f8fafc', outline: '#475569', earTop: '#94a3b8', tail: '#94a3b8', spot: '#475569', blush: '#cbd5e1' },
            unicorn: { name: {zh: '獨角獸之夢', en: 'Unicorn Dream'}, cost: 6500, body: '#fdf4ff', outline: '#701a75', earTop: '#e879f9', tail: '#f472b6', spot: '#c084fc', blush: '#fbcfe8' },
            frost: { name: {zh: '永凍冰晶', en: 'Eternal Frost'}, cost: 6500, body: '#f0f9ff', outline: '#0c4a6e', earTop: '#38bdf8', tail: '#7dd3fc', spot: '#0284c7', blush: '#bae6fd' },
            storm: { name: {zh: '雷鳴風暴', en: 'Thunder Storm'}, cost: 6800, body: '#f8fafc', outline: '#0f172a', earTop: '#facc15', tail: '#fde047', spot: '#334155', blush: '#fca5a5' },
            phoenix: { name: {zh: '不死鳥之羽', en: 'Phoenix Feather'}, cost: 7000, body: '#fff1f2', outline: '#450a0a', earTop: '#f43f5e', tail: '#fb7185', spot: '#e11d48', blush: '#fca5a5' },
            magma: { name: {zh: '熔岩之心', en: 'Magma Core'}, cost: 7200, body: '#450a0a', outline: '#fef08a', earTop: '#ef4444', tail: '#f97316', spot: '#dc2626', blush: '#f87171' },
            dragonSlug: { name: {zh: '烈焰小龍', en: 'Flame Dragon'}, cost: 7500, body: '#fff7ed', outline: '#431407', earTop: '#ea580c', tail: '#f97316', spot: '#c2410c', blush: '#fca5a5' },
            starlight: { name: {zh: '流星微光', en: 'Starlight Dust'}, cost: 7800, body: '#020617', outline: '#38bdf8', earTop: '#fef08a', tail: '#7dd3fc', spot: '#fde047', blush: '#bae6fd' },
            nebula: { name: {zh: '璀璨星雲', en: 'Cosmic Nebula'}, cost: 8000, body: '#2e1065', outline: '#fbcfe8', earTop: '#c084fc', tail: '#e879f9', spot: '#818cf8', blush: '#f472b6' },
            eclipse: { name: {zh: '日蝕幻影', en: 'Solar Eclipse'}, cost: 8500, body: '#0f172a', outline: '#fbbf24', earTop: '#334155', tail: '#f59e0b', spot: '#1e293b', blush: '#f87171' },
            gold: { name: {zh: '招財純金', en: 'Pure Gold'}, cost: 8888, body: '#fef08a', outline: '#b45309', earTop: '#f59e0b', tail: '#f59e0b', spot: '#b45309', blush: '#fbbf24' },
            abyssSlug: { name: {zh: '深淵使者', en: 'Abyss Herald'}, cost: 9000, body: '#030712', outline: '#14b8a6', earTop: '#0d9488', tail: '#0f766e', spot: '#115e59', blush: '#2dd4bf' }
        };

        // 🏠 【背景插畫零件】每件家具都以「底部中央」為原點繪製，
        //    擺放時 translate 決定落地位置、scale 決定大小，
        //    所以同一組家具能在電腦版橫幅與手機版直幅裡各自重新排版，
        //    而且整張圖是向量，螢幕越大家具就等比例跟著放大。
        const roomParts = {
            rug: `<g>
    <ellipse rx="212" ry="54" fill="#efe6cd" stroke="#c2ad82" stroke-width="4"/>
    <ellipse rx="178" ry="41" fill="none" stroke="#d8c89c" stroke-width="3"/>
    <g stroke="#cbb88e" stroke-width="3" stroke-linecap="round">
      <line x1="-120" y1="-16" x2="-106" y2="-7"/>
      <line x1="-64" y1="-29" x2="-50" y2="-20"/>
      <line x1="48" y1="-27" x2="62" y2="-18"/>
      <line x1="100" y1="-10" x2="114" y2="-1"/>
      <line x1="-44" y1="22" x2="-30" y2="31"/>
      <line x1="40" y1="24" x2="54" y2="33"/>
    </g>
  </g>`,
            sofa: `<g stroke="#5b7a94" stroke-width="5" stroke-linejoin="round">
    <g fill="#6b4c2a" stroke="#4a3821">
      <rect x="-114" y="-28" width="13" height="28" rx="4"/>
      <rect x="101" y="-28" width="13" height="28" rx="4"/>
    </g>
    <rect x="-126" y="-154" width="252" height="80" rx="24" fill="#a9c3d9"/>
    <rect x="-118" y="-98" width="236" height="76" rx="18" fill="#c6dae9"/>
    <line x1="0" y1="-88" x2="0" y2="-28" stroke="#8fb0c9" stroke-width="4"/>
    <rect x="-144" y="-128" width="36" height="106" rx="18" fill="#9ab7cf"/>
    <rect x="108" y="-128" width="36" height="106" rx="18" fill="#9ab7cf"/>
    <g stroke="#b08968" stroke-width="4">
      <rect x="-92" y="-136" width="52" height="50" rx="13" fill="#f1e2c6" transform="rotate(-8 -66 -111)"/>
      <rect x="42" y="-136" width="52" height="50" rx="13" fill="#e8cfae" transform="rotate(7 68 -111)"/>
    </g>
  </g>`,
            armchair: `<g stroke="#5b7a94" stroke-width="5" stroke-linejoin="round">
    <g fill="#6b4c2a" stroke="#4a3821">
      <rect x="-59" y="-26" width="12" height="26" rx="4"/>
      <rect x="47" y="-26" width="12" height="26" rx="4"/>
    </g>
    <rect x="-67" y="-136" width="134" height="76" rx="22" fill="#a9c3d9"/>
    <rect x="-59" y="-86" width="118" height="66" rx="17" fill="#c6dae9"/>
    <rect x="-83" y="-114" width="32" height="94" rx="16" fill="#9ab7cf"/>
    <rect x="51" y="-114" width="32" height="94" rx="16" fill="#9ab7cf"/>
  </g>`,
            table: `<g stroke="#4a3821" stroke-width="5" stroke-linejoin="round">
    <g stroke-width="6" stroke-linecap="round">
      <line x1="-52" y1="-46" x2="-64" y2="-4"/>
      <line x1="54" y1="-46" x2="66" y2="-4"/>
      <line x1="1" y1="-40" x2="1" y2="0"/>
    </g>
    <ellipse cy="-56" rx="82" ry="19" fill="#a67c4a"/>
    <g stroke-width="4">
      <rect x="-32" y="-80" width="58" height="12" rx="4" fill="#d98080"/>
      <rect x="-27" y="-91" width="49" height="11" rx="4" fill="#e8cfae"/>
      <rect x="-22" y="-102" width="41" height="11" rx="4" fill="#8fb0c9"/>
    </g>
  </g>`,
            lamp: `<g stroke="#8a6a3f" stroke-width="5" stroke-linejoin="round">
    <g stroke="none">
      <path d="M -44 -186 L 44 -186 L 104 -14 L -104 -14 Z" fill="url(#lampCone)"/>
      <ellipse cy="-192" rx="86" ry="58" fill="url(#lampGlow)"/>
    </g>
    <ellipse cy="-11" rx="36" ry="11" fill="#8b6136"/>
    <rect x="-6" y="-185" width="11" height="174" fill="#a67c4a"/>
    <path d="M -30 -241 L 30 -241 L 46 -185 L -46 -185 Z" fill="#fdf6e3" stroke="#c9a227"/>
  </g>`,
            plant: `<g>
    <g stroke="#2f6b43" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M -6 -86 C -12 -134, -28 -170, -50 -190"/>
      <path d="M 0 -86 C 4 -138, 12 -174, 26 -198"/>
      <path d="M -3 -86 C -6 -122, -16 -148, -28 -168"/>
    </g>
    <g fill="#4b8b5a" stroke="#2f6b43" stroke-width="4" stroke-linejoin="round">
      <path d="M -50 -190 C -84 -198, -104 -228, -90 -254 C -64 -262, -36 -244, -30 -218 C -27 -202, -36 -188, -50 -190 Z"/>
      <path d="M 26 -198 C 60 -204, 84 -236, 70 -262 C 42 -270, 12 -250, 6 -224 C 3 -208, 12 -196, 26 -198 Z"/>
      <path d="M -28 -168 C -52 -190, -56 -226, -34 -244 C -10 -238, 6 -210, -4 -184 C -9 -172, -18 -166, -28 -168 Z"/>
    </g>
    <g fill="#3f7a4e" stroke="#2f6b43" stroke-width="4" stroke-linejoin="round">
      <path d="M -10 -214 C -30 -228, -38 -252, -24 -270 C -2 -266, 12 -244, 4 -222 C 1 -214, -4 -210, -10 -214 Z"/>
    </g>
    <g stroke="#9c5338" stroke-width="5" stroke-linejoin="round">
      <path d="M -40 -80 L 40 -80 L 27 0 L -27 0 Z" fill="#c97b5a"/>
      <rect x="-48" y="-96" width="96" height="20" rx="7" fill="#d98e6b"/>
    </g>
  </g>`
        };

        // 把零件擺到指定位置並縮放
        const placePart = (part, x, y, scale) => `<g transform="translate(${x}, ${y}) scale(${scale})">${part}</g>`;

        // 房間的共用外殼：牆面、踢腳板、榻榻米、窗戶與灑進來的陽光
        const wrapRoomSvg = (W, H, floorY, floor, win, furniture) => {
            const beam = `${win.x + win.w},${win.y + win.h} ${win.x + win.w},${win.y + win.h * 0.45} ${win.x + win.w + win.h * 0.8},${floorY + 30} ${win.x + win.w * 0.3},${floorY + 30}`;
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <pattern id="hl" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#e6dec3"/>
      <line x1="0" y1="3" x2="6" y2="3" stroke="#d1c5a5" stroke-width="1.8"/>
    </pattern>
    <pattern id="vl" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#e6dec3"/>
      <line x1="3" y1="0" x2="3" y2="6" stroke="#d1c5a5" stroke-width="1.8"/>
    </pattern>
    <radialGradient id="lampGlow">
      <stop offset="0%" stop-color="#fde68a" stop-opacity="0.6"/>
      <stop offset="55%" stop-color="#fde68a" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde68a" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#fde68a" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${floorY}" fill="#fffbeb"/>
  <rect y="${floorY}" width="${W}" height="22" fill="#6b4c2a"/>
  <g stroke="#4a3821" stroke-width="9">${floor}</g>

  <g transform="translate(${win.x}, ${win.y})">
    <rect width="${win.w}" height="${win.h}" fill="#bae6fd"/>
    <circle cx="${win.w * 0.72}" cy="${win.h * 0.22}" r="${win.h * 0.11}" fill="#ffffff" opacity="0.8"/>
    <circle cx="${win.w * 0.86}" cy="${win.h * 0.26}" r="${win.h * 0.075}" fill="#ffffff" opacity="0.8"/>
    <rect width="${win.w}" height="${win.h}" fill="none" stroke="#5a4425" stroke-width="18"/>
    <line x1="${win.w / 2}" y1="0" x2="${win.w / 2}" y2="${win.h}" stroke="#5a4425" stroke-width="13"/>
    <line x1="0" y1="${win.h / 2}" x2="${win.w}" y2="${win.h / 2}" stroke="#5a4425" stroke-width="13"/>
  </g>
  <polygon points="${beam}" fill="#ffffff" opacity="0.16"/>

  ${furniture}
</svg>`;
        };

        // 🏞️ 【陽光公園零件】同樣以「底部中央」為原點
        const parkParts = {
            tree: `<g>
    <rect x="-11" y="-86" width="22" height="88" rx="6" fill="#a2703f" stroke="#6b4423" stroke-width="5"/>
    <g fill="#3f9e57" stroke="#2c7a42" stroke-width="5" stroke-linejoin="round">
      <circle cx="-46" cy="-104" r="44"/>
      <circle cx="48" cy="-108" r="42"/>
      <circle cx="0" cy="-146" r="58"/>
    </g>
    <g fill="#63c47a" stroke="none">
      <circle cx="-16" cy="-168" r="28"/>
      <circle cx="30" cy="-140" r="20"/>
      <circle cx="-44" cy="-120" r="18"/>
    </g>
  </g>`,
            // 溜滑梯遊具：藍色爬梯 + 平台 + 尖屋頂 + 粉色滑道
            slideTower: `<g stroke="#5b6b7a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <g stroke="#3f8fd0" stroke-width="11" fill="none">
      <path d="M -96 -152 L -150 -4"/>
      <path d="M -62 -152 L -116 -4"/>
      <path d="M -142 -26 L -108 -26"/>
      <path d="M -129 -62 L -95 -62"/>
      <path d="M -116 -98 L -82 -98"/>
      <path d="M -103 -132 L -69 -132"/>
    </g>
    <rect x="-88" y="-212" width="15" height="212" fill="#c7d2dc"/>
    <rect x="73" y="-212" width="15" height="212" fill="#c7d2dc"/>
    <g stroke="#b06274" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M 86 -150 C 142 -138, 168 -80, 196 -8" stroke="#f0798e" stroke-width="44"/>
      <path d="M 86 -150 C 142 -138, 168 -80, 196 -8" stroke="#f9a8b5" stroke-width="14"/>
    </g>
    <rect x="-98" y="-164" width="196" height="24" rx="7" fill="#e0a94a"/>
    <rect x="-98" y="-206" width="196" height="13" rx="6" fill="#7ec8e3"/>
    <path d="M -114 -210 L 0 -302 L 114 -210 Z" fill="#2a9d8f"/>
    <path d="M -114 -210 L 114 -210" stroke="#1f7a70"/>
    <circle cx="0" cy="-312" r="10" fill="#f6bd60"/>
  </g>`,
            swingSet: `<g stroke="#3f8fd0" stroke-width="11" stroke-linecap="round" fill="none">
    <path d="M -118 -2 L -62 -172"/>
    <path d="M -8 -2 L -62 -172"/>
    <path d="M 118 -2 L 62 -172"/>
    <path d="M 8 -2 L 62 -172"/>
    <path d="M -66 -172 L 66 -172"/>
    <g stroke="#94a3b8" stroke-width="5">
      <path d="M -34 -170 L -34 -66"/>
      <path d="M -6 -170 L -6 -66"/>
      <path d="M 34 -170 L 34 -66"/>
      <path d="M 62 -170 L 62 -66"/>
    </g>
    <g stroke="#e0a94a" stroke-width="12" stroke-linecap="round">
      <path d="M -36 -64 L -4 -64"/>
      <path d="M 32 -64 L 64 -64"/>
    </g>
  </g>`,
            climbFrame: `<g stroke="#4fa65b" stroke-width="10" stroke-linecap="round" fill="none">
    <path d="M -92 -2 L -92 -108"/>
    <path d="M -30 -2 L -30 -108"/>
    <path d="M 32 -2 L 32 -108"/>
    <path d="M 94 -2 L 94 -108"/>
    <path d="M -96 -108 L 98 -108"/>
    <g stroke="#f6bd60" stroke-width="8">
      <path d="M -96 -74 L 98 -74"/>
      <path d="M -96 -40 L 98 -40"/>
    </g>
  </g>`,
            bench: `<g stroke="#6b4423" stroke-width="5" stroke-linejoin="round">
    <g stroke="#5b6b7a" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M -44 -2 L -44 -34"/>
      <path d="M 44 -2 L 44 -34"/>
    </g>
    <rect x="-58" y="-42" width="116" height="12" rx="5" fill="#c58b52"/>
    <rect x="-58" y="-66" width="116" height="10" rx="5" fill="#c58b52"/>
    <rect x="-58" y="-82" width="116" height="10" rx="5" fill="#c58b52"/>
  </g>`,
            house: `<g stroke="#8a7461" stroke-width="4" stroke-linejoin="round">
    <rect x="-46" y="-62" width="92" height="62" fill="#f1e5d4"/>
    <path d="M -56 -60 L 0 -98 L 56 -60 Z" fill="#c08457"/>
    <g fill="#9ec9e8" stroke="#8a7461" stroke-width="3">
      <rect x="-32" y="-48" width="22" height="20" rx="3"/>
      <rect x="10" y="-48" width="22" height="20" rx="3"/>
      <rect x="-12" y="-22" width="24" height="22" rx="3"/>
    </g>
  </g>`,
            // 雲與太陽的原點在中心
            cloud: `<g fill="#ffffff">
    <ellipse cx="-44" cy="6" rx="46" ry="26"/>
    <ellipse cx="34" cy="8" rx="40" ry="24"/>
    <ellipse cx="-6" cy="-14" rx="44" ry="32"/>
    <ellipse cx="0" cy="14" rx="62" ry="20"/>
  </g>`,
            sun: `<g>
    <circle r="132" fill="url(#sunGlow)"/>
    <circle r="66" fill="#fef3c7"/>
    <circle r="50" fill="#fde047"/>
  </g>`
        };

        // 地平線上的遠景樹林：一排圓弧，下半截會被草地蓋住
        const parkTreeLine = (W, skyY, layer) => {
            let out = '';
            if (layer === 'far') {
                for (let x = -40, i = 0; x < W + 60; x += 46, i++) {
                    const r = 26 + (i % 3) * 9;
                    out += `<circle cx="${x}" cy="${skyY - r * 0.55}" r="${r}"/>`;
                }
                return `<g fill="#3b8f55">${out}</g>`;
            }
            for (let x = -20, i = 0; x < W + 60; x += 62, i++) {
                const r = 20 + (i % 2) * 8;
                out += `<circle cx="${x + 18}" cy="${skyY - r * 0.35}" r="${r}"/>`;
            }
            return `<g fill="#2f7a46">${out}</g>`;
        };

        // 草地上的小草叢與野花
        const parkLawnDetails = (W, H, skyY) => {
            let out = '';
            const tuftY = skyY + (H - skyY) * 0.62;
            for (let i = 0; i < 14; i++) {
                const x = ((i * 137) % (W - 40)) + 20;
                const y = tuftY + ((i * 53) % Math.max(40, (H - tuftY) * 0.8));
                out += `<g transform="translate(${x}, ${y})" stroke="#2f7a46" stroke-width="4" stroke-linecap="round" fill="none"><path d="M 0 0 L -7 -13"/><path d="M 0 0 L 0 -16"/><path d="M 0 0 L 7 -13"/></g>`;
                if (i % 3 === 0) {
                    const color = i % 2 === 0 ? '#fde047' : '#f9a8d4';
                    out += `<g transform="translate(${x + 26}, ${y - 6})" fill="${color}"><circle cx="-6" r="5"/><circle cx="6" r="5"/><circle cy="-6" r="5"/><circle cy="6" r="5"/><circle r="4" fill="#fff7ed"/></g>`;
                }
            }
            return out;
        };

        // 🌲 【迷霧森林零件】逆光森林靠三層樹幹製造縱深
        // 一根樹幹：底寬頂窄、可以傾斜，並長出幾根細枝
        const forestTrunk = (x, groundY, h, w, lean, fill, branch) => {
            const topY = groundY - h;
            const topX = x + lean;
            const half = w / 2;
            const halfTop = w * 0.34;
            let out = `<path d="M ${x - half} ${groundY} C ${x - half + 2} ${groundY - h * 0.4}, ${topX - halfTop - 2} ${topY + h * 0.3}, ${topX - halfTop} ${topY} L ${topX + halfTop} ${topY} C ${topX + halfTop + 2} ${topY + h * 0.3}, ${x + half - 2} ${groundY - h * 0.4}, ${x + half} ${groundY} Z" fill="${fill}"/>`;
            if (branch) {
                const by = topY + h * 0.2;
                const bw = Math.max(5, w * 0.42);
                out += `<g stroke="${fill}" stroke-width="${bw}" stroke-linecap="round" fill="none">`
                    + `<path d="M ${topX - halfTop + 2} ${by} C ${topX - w * 0.9} ${by - 10}, ${topX - w * 1.3} ${by - 24}, ${topX - w * 1.6} ${by - 42}"/>`
                    + `<path d="M ${topX + halfTop - 2} ${by + h * 0.1} C ${topX + w * 0.8} ${by + h * 0.06}, ${topX + w * 1.2} ${by - 6}, ${topX + w * 1.5} ${by - 26}"/>`
                    + `</g>`;
            }
            return out;
        };

        // 一整排樹幹：越遠越細越淡
        const forestTrunkRow = (W, groundY, layer) => {
            const cfg = {
                far: { step: 86, w: 13, h: 0.74, fill: '#a8d8bd', lean: 5, branch: false, offset: 18 },
                mid: { step: 138, w: 24, h: 0.88, fill: '#5f9c76', lean: -8, branch: true, offset: 64 },
                near: { step: 232, w: 46, h: 1.06, fill: '#2f5d43', lean: 10, branch: true, offset: 8 }
            }[layer];

            let out = '';
            for (let i = 0, x = -40 + cfg.offset; x < W + 60; x += cfg.step, i++) {
                const jitter = ((i * 37) % 23) - 11;
                const hMul = cfg.h * (0.86 + ((i * 17) % 9) / 32);
                out += forestTrunk(x + jitter, groundY + 6, groundY * hMul + 40, cfg.w + ((i * 13) % 7), cfg.lean * (i % 2 ? 1 : -1), cfg.fill, cfg.branch);
            }
            return out;
        };

        // 樹冠：頂端兩層深綠葉團，中間刻意留縫讓光透下來
        const forestCanopy = (W, lightX) => {
            let back = '', front = '';
            for (let x = -40, i = 0; x < W + 70; x += 54, i++) {
                const gap = Math.abs(x - lightX) < 130;
                const r = (gap ? 34 : 64) + (i % 4) * 13;
                const y = (gap ? -42 : 18) - (i % 3) * 20;
                back += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
            }
            for (let x = -20, i = 0; x < W + 70; x += 74, i++) {
                const gap = Math.abs(x - lightX) < 150;
                const r = (gap ? 24 : 46) + (i % 3) * 14;
                const y = (gap ? -58 : -6) - (i % 2) * 24;
                front += `<circle cx="${x + 26}" cy="${y}" r="${r}"/>`;
            }
            return `<g fill="#2b5c3c">${back}</g><g fill="#1a3f2a">${front}</g>`;
        };

        const forestParts = {
            bush: `<g>
    <g fill="#2a5a3c"><ellipse cx="-28" cy="-14" rx="34" ry="24"/><ellipse cx="26" cy="-12" rx="30" ry="21"/><ellipse cx="0" cy="-30" rx="34" ry="26"/></g>
    <g fill="#3f7d53"><ellipse cx="-16" cy="-30" rx="18" ry="13"/><ellipse cx="18" cy="-24" rx="15" ry="11"/></g>
  </g>`,
            fern: `<g stroke="#4c8c60" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M 0 0 C -6 -22, -20 -36, -40 -44"/>
    <path d="M 0 0 C -2 -26, -4 -46, -2 -64"/>
    <path d="M 0 0 C 8 -22, 22 -36, 42 -42"/>
    <path d="M 0 0 C 6 -26, 16 -44, 26 -58"/>
  </g>`
        };

        // 🎨 【場景背景庫】其餘背景共用的繪圖元件與各款場景。
        // 包在 IIFE 裡，元件名稱不會外漏，只回傳各款背景的繪製函式。
        const sceneArt = (() => {

    const canvasOf = (mode) => mode === 'thumb' ? { W: 900, H: 900 }
        : (mode === 'portrait' ? { W: 640, H: 1040 } : { W: 1200, H: 520 });

    const svgOf = (W, H, defs, body) =>
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;

    // 穩定的偽隨機：同一個 i 永遠得到同一個值，畫面才不會每次重整都跳動
    const rnd = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
    const times = (n, fn) => { let o = ''; for (let i = 0; i < n; i++) o += fn(i, rnd(i, 1), rnd(i, 2), rnd(i, 3)); return o; };

    // --- 漸層 ---
    const vg = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a]) => `<stop offset="${o}%" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
    const rg = (id, stops) => `<radialGradient id="${id}">${stops.map(([o, c, a]) => `<stop offset="${o}%" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
    const glowDef = (id, color) => rg(id, [[0, color, 0.95], [45, color, 0.4], [100, color, 0]]);

    // --- 基本形狀 ---
    const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
    const bg = (W, H, fill) => rect(0, 0, W, H, fill);
    const disc = (x, y, r, fill, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
    const ell = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;

    // 發光天體（太陽 / 月亮 / 光球）
    const glow = (x, y, r, id, core) => disc(x, y, r * 2.6, `url(#${id})`) + disc(x, y, r, core);

    // 波浪狀地形：從 y 開始往下填滿
    const hill = (W, H, y, amp, fill, phase = 0) => {
        const seg = W / 4;
        let d = `M 0 ${y + Math.sin(phase) * amp}`;
        for (let i = 0; i < 4; i++) {
            const x0 = i * seg, x1 = (i + 1) * seg;
            const y1 = y + Math.sin(phase + (i + 1) * 1.7) * amp;
            d += ` C ${x0 + seg * 0.4} ${y + Math.sin(phase + i * 1.7 + 0.8) * amp * 1.6}, ${x1 - seg * 0.4} ${y1 - amp * 0.6}, ${x1} ${y1}`;
        }
        return `<path d="${d} L ${W} ${H} L 0 ${H} Z" fill="${fill}"/>`;
    };

    // 鋸齒狀山脈
    const peaks = (W, H, y, h, n, fill) => {
        let d = `M -20 ${y + h * 0.5}`;
        const step = (W + 40) / n;
        for (let i = 0; i < n; i++) {
            const x = -20 + step * (i + 0.5);
            d += ` L ${x} ${y - h * (0.55 + rnd(i, 7) * 0.65)} L ${x + step / 2} ${y + h * 0.4}`;
        }
        return `<path d="${d} L ${W + 20} ${H} L -20 ${H} Z" fill="${fill}"/>`;
    };

    // 建築剪影（城市 / 街景）
    const buildings = (W, baseY, fill, win, seed = 0) => times(Math.ceil(W / 86) + 1, (i, a, b) => {
        const w = 52 + a * 46, x = -30 + i * 86, h = 90 + b * 190;
        let out = rect(x, baseY - h, w, h, fill, 'rx="4"');
        for (let r = 0; r < Math.floor(h / 42); r++) {
            for (let c = 0; c < 3; c++) {
                if (rnd(i * 31 + r * 7 + c + seed, 5) > 0.45) out += rect(x + 9 + c * (w - 22) / 3, baseY - h + 18 + r * 42, 11, 15, win, 'rx="2"');
            }
        }
        return out;
    });

    // 神殿柱子
    const column = (x, baseY, h, w, fill, cap) =>
        rect(x - w / 2 - 6, baseY - 12, w + 12, 14, cap, 'rx="3"')
        + rect(x - w / 2, baseY - h + 14, w, h - 26, fill)
        + rect(x - w / 2 - 8, baseY - h, w + 16, 16, cap, 'rx="3"');

    // 粒子系列
    const stars = (W, H, n, color) => times(n, (i, a, b, c) => disc((a * W).toFixed(0), (b * H * 0.8).toFixed(0), (1 + c * 2.4).toFixed(1), color, `opacity="${(0.35 + c * 0.6).toFixed(2)}"`));
    const flakes = (W, H, n, color, r = 4) => times(n, (i, a, b, c) => disc((a * W).toFixed(0), (b * H).toFixed(0), (r * (0.5 + c)).toFixed(1), color, `opacity="${(0.5 + c * 0.45).toFixed(2)}"`));
    const rain = (W, H, n, color) => times(n, (i, a, b) => `<path d="M ${(a * W).toFixed(0)} ${(b * H).toFixed(0)} l -7 26" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`);
    const bubbles = (W, H, n, color) => times(n, (i, a, b, c) => disc((a * W).toFixed(0), (b * H).toFixed(0), (4 + c * 12).toFixed(1), 'none', `stroke="${color}" stroke-width="2.5" opacity="${(0.3 + c * 0.4).toFixed(2)}"`));
    const sparkles = (W, H, n, color) => times(n, (i, a, b, c) => {
        const x = (a * W).toFixed(0), y = (b * H).toFixed(0), r = (5 + c * 9).toFixed(1);
        return `<path d="M ${x} ${y - r} L ${+x + +r * 0.3} ${y} L ${x} ${+y + +r} L ${+x - +r * 0.3} ${y} Z" fill="${color}" opacity="${(0.4 + c * 0.5).toFixed(2)}"/>`;
    });

    // 光束（從上方或某點灑下）
    const rays = (W, H, x0, y0, n, color) => times(n, (i, a) => {
        const spread = (i - (n - 1) / 2) / ((n - 1) / 2 || 1);
        const bx = x0 + spread * W * 0.7, w = 22 + a * 30;
        return `<polygon points="${x0 - 14},${y0} ${x0 + 14},${y0} ${bx + w},${H} ${bx - w},${H}" fill="${color}"/>`;
    });

    // 雲朵
    const cloud = (x, y, s, fill, op = 1) => `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" opacity="${op}"><ellipse cx="-44" cy="6" rx="46" ry="26"/><ellipse cx="34" cy="8" rx="40" ry="24"/><ellipse cx="-6" cy="-14" rx="44" ry="32"/><ellipse cx="0" cy="14" rx="62" ry="20"/></g>`;

    // 樹（圓樹冠）
    const tree = (x, y, s, canopy, trunkFill, light) => `<g transform="translate(${x},${y}) scale(${s})">`
        + rect(-11, -86, 22, 90, trunkFill, 'rx="6"')
        + `<g fill="${canopy}"><circle cx="-44" cy="-104" r="42"/><circle cx="46" cy="-108" r="40"/><circle cx="0" cy="-146" r="56"/></g>`
        + `<g fill="${light}"><circle cx="-16" cy="-166" r="26"/><circle cx="28" cy="-138" r="18"/></g></g>`;

    // 針葉樹（雪山用）
    const pine = (x, y, s, fill, snow) => `<g transform="translate(${x},${y}) scale(${s})">`
        + rect(-8, -34, 16, 36, '#6b4423', 'rx="4"')
        + `<path d="M 0 -170 L 44 -84 L -44 -84 Z" fill="${fill}"/><path d="M 0 -130 L 52 -30 L -52 -30 Z" fill="${fill}"/>`
        + `<path d="M 0 -170 L 22 -128 L -22 -128 Z" fill="${snow}"/><path d="M 0 -130 L 26 -78 L -26 -78 Z" fill="${snow}" opacity="0.85"/></g>`;

    // 棕櫚樹
    const palm = (x, y, s, leaf, trunkFill) => `<g transform="translate(${x},${y}) scale(${s})">`
        + `<path d="M -10 0 C -4 -50, 6 -96, 26 -132 L 44 -126 C 22 -92, 12 -48, 10 0 Z" fill="${trunkFill}"/>`
        + `<g fill="${leaf}">`
        + `<path d="M 34 -130 C 4 -156, -30 -150, -50 -126 C -18 -134, 8 -128, 34 -116 Z"/>`
        + `<path d="M 34 -130 C 54 -162, 92 -166, 118 -148 C 86 -150, 58 -138, 38 -118 Z"/>`
        + `<path d="M 34 -132 C 28 -168, 44 -196, 74 -206 C 54 -182, 46 -156, 44 -128 Z"/>`
        + `<path d="M 34 -128 C 0 -128, -26 -110, -40 -84 C -14 -102, 12 -108, 36 -112 Z"/>`
        + `</g></g>`;

            return {
    // 陽光草原：只有陽光與一望無際的草原，草地上零星幾撮草
    sunshineGrassland(mode) {
        const { W, H } = canvasOf(mode);
        const portrait = mode === 'portrait';
        const hz = H * (portrait ? 0.46 : 0.5);
        const sunX = portrait ? W * 0.66 : W * 0.24;
        const sunY = H * (portrait ? 0.15 : 0.2);

        // 一撮草：三片彎曲的草葉
        const tuft = (x, y, s, color) => `<g transform="translate(${x},${y}) scale(${s})" stroke="${color}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M 0 0 C -6 -14, -12 -22, -20 -30"/><path d="M 0 0 C -1 -16, -2 -28, -1 -40"/><path d="M 0 0 C 7 -14, 15 -23, 23 -32"/></g>`;

        let tufts = '';
        const n = portrait ? 6 : 7;
        for (let i = 0; i < n; i++) {
            const x = 40 + rnd(i, 11) * (W - 80);
            const y = hz + (H - hz) * (0.34 + rnd(i, 12) * 0.5);
            tufts += tuft(x.toFixed(0), y.toFixed(0), (0.85 + (i % 3) * 0.4).toFixed(2), i % 2 ? '#2f7a46' : '#3f9153');
        }

        return svgOf(W, H,
            vg('sgSky', [[0, '#4fb8f0'], [58, '#a9e0fa'], [100, '#e2f6ff']])
            + glowDef('sgSun', '#fff6c4')
            + vg('sgRay', [[0, '#fff6c4', 0.32], [100, '#fff6c4', 0]])
            + vg('sgFar', [[0, '#a3e08f'], [100, '#79c877']])
            + vg('sgNear', [[0, '#6fc470'], [100, '#3f9153']]),
            bg(W, H, 'url(#sgSky)')
            + rays(W, H * 0.92, sunX, sunY, 5, 'url(#sgRay)')
            + glow(sunX, sunY, H * 0.075, 'sgSun', '#fff3b0')
            + hill(W, H, hz, H * 0.05, 'url(#sgFar)')
            + hill(W, H, hz + H * 0.12, H * 0.055, 'url(#sgNear)', 1.6)
            + tufts
        );
    },

    // 碧紗庭院：中式亭台望出去的朦朧綠意，輕紗與垂枝被晨風吹動
        breezeMorning(mode) {
            const { W, H } = canvasOf(mode);
            const portrait = mode === 'portrait';
            const u = Math.min(W, H) / 520;
            const railY = H * 0.9;

            // 木格柵：柱子與上方橫楣
            const lattice = (x, y, w, h, cols, rows) => {
                let g = rect(x, y, w, h, '#5f5a3c', 'rx="3"');
                const cw = w / cols, ch = h / rows;
                for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
                    g += rect(x + c * cw + 5 * u, y + r * ch + 5 * u, cw - 10 * u, ch - 10 * u, '#9fc08f', 'opacity="0.45"');
                }
                return g;
            };

            // 隨風鼓起的輕紗
            const veil = (x, w, y0, y1, sway, op) => {
                const h = y1 - y0;
                const edge = (ox, k) => `M ${x + ox} ${y0} C ${x + ox + sway * k} ${y0 + h * 0.34}, ${x + ox - sway * 0.8 * k} ${y0 + h * 0.68}, ${x + ox + sway * 0.6 * k} ${y1}`;
                return `<path d="${edge(0, 1)} L ${x + w + sway * 0.6} ${y1} C ${x + w - sway * 0.8} ${y0 + h * 0.68}, ${x + w + sway} ${y0 + h * 0.34}, ${x + w} ${y0} Z" fill="url(#bmVeil)" opacity="${op}"/>`
                    // 布面皺摺與邊緣的亮線，讓紗看得出飄動
                    + `<g stroke="#ffffff" fill="none" stroke-linecap="round">`
                    + `<path d="${edge(w * 0.3, 0.92)}" stroke-width="${(2.6 * u).toFixed(1)}" opacity="${(op * 0.55).toFixed(2)}"/>`
                    + `<path d="${edge(w * 0.62, 0.86)}" stroke-width="${(2.2 * u).toFixed(1)}" opacity="${(op * 0.45).toFixed(2)}"/>`
                    + `<path d="${edge(0, 1)}" stroke-width="${(3.4 * u).toFixed(1)}" opacity="${(op * 0.9).toFixed(2)}"/>`
                    + `<path d="M ${x + w} ${y0} C ${x + w + sway} ${y0 + h * 0.34}, ${x + w - sway * 0.8} ${y0 + h * 0.68}, ${x + w + sway * 0.6} ${y1}" stroke-width="${(3.4 * u).toFixed(1)}" opacity="${(op * 0.9).toFixed(2)}"/>`
                    + `</g>`;
            };

            // 柳條：細長下垂的枝條，沿途密生細長柳葉，末端被風吹向右
            const willow = (x, y, len, sway, s, tint) => {
                const tipX = x + sway * 1.5;
                let b = `<path d="M ${x} ${y} C ${x + sway * 0.35} ${y + len * 0.42}, ${x + sway} ${y + len * 0.72}, ${tipX} ${y + len}" stroke="#7a9c58" stroke-width="${(2.4 * s).toFixed(1)}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
                const n = Math.max(6, Math.round(len / (17 * s)));
                for (let i = 1; i <= n; i++) {
                    const t = i / n;
                    const bx = x + sway * (0.35 * t + 1.15 * t * t);
                    const by = y + len * t;
                    const side = i % 2 ? 1 : -1;
                    // 葉片接近垂直懸掛，越往下越順著風向傾斜
                    const rot = (72 - side * 16 + t * 16).toFixed(0);
                    const lx = (bx + side * 5 * s).toFixed(1);
                    const ly = by.toFixed(1);
                    b += `<ellipse cx="${lx}" cy="${ly}" rx="${(11 * s).toFixed(1)}" ry="${(3.1 * s).toFixed(1)}" fill="${tint}" transform="rotate(${rot} ${lx} ${ly})"/>`;
                }
                return b;
            };
            const willowTints = ['#a8d77a', '#8cc45f', '#6faa4f', '#5b9447'];

            // 成片柳條：沿寬度均勻分佈再加抖動，長短深淺交錯出層次
            let willows = '';
            const wn = portrait ? 26 : 38;
            for (let i = 0; i < wn; i++) {
                const wx = W * ((i + 0.5) / wn) + (rnd(i, 51) - 0.5) * W * 0.05;
                const wy = H * 0.1 + rnd(i, 52) * H * 0.05;
                const wlen = H * (0.3 + rnd(i, 53) * 0.46);
                willows += willow(wx, wy, wlen, (16 + rnd(i, 54) * 30) * u, (0.78 + rnd(i, 55) * 0.5) * u, willowTints[i % willowTints.length]);
            }

            // 空中飄散的花瓣，越往右下越小，表現被風帶走
            let petals = '';
            for (let i = 0; i < (portrait ? 12 : 14); i++) {
                const t = i / 13;
                const px = W * 0.12 + rnd(i, 31) * W * 0.8;
                const py = H * 0.1 + rnd(i, 32) * H * 0.72;
                const s = (0.7 + rnd(i, 33) * 0.7) * u;
                petals += `<ellipse cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" rx="${(9 * s).toFixed(1)}" ry="${(5 * s).toFixed(1)}" fill="#ffd9e6" opacity="${(0.55 + rnd(i, 34) * 0.4).toFixed(2)}" transform="rotate(${(rnd(i, 35) * 140 - 30).toFixed(0)} ${px.toFixed(0)} ${py.toFixed(0)})"/>`;
            }

            // 風的流線
            const gust = (x, y, len, op) => `<path d="M ${x} ${y} c ${(len * 0.3).toFixed(0)} -${(10 * u).toFixed(0)}, ${(len * 0.7).toFixed(0)} -${(10 * u).toFixed(0)}, ${len.toFixed(0)} 0" stroke="#ffffff" stroke-width="${(3.5 * u).toFixed(1)}" fill="none" stroke-linecap="round" opacity="${op}"/>`;

            const pillarW = Math.max(22, W * 0.035);
            return svgOf(W, H,
                rg('bmMist', [[0, '#fbffe8'], [38, '#dff2d2'], [72, '#8fc48a'], [100, '#4f8a5c']])
                + vg('bmVeil', [[0, '#ffffff', 0.92], [45, '#f2fbef', 0.72], [100, '#dff2db', 0.48]])
                + glowDef('bmGlow', '#fffbe0'),
                bg(W, H, 'url(#bmMist)')
                // 晨光
                + glow(W * 0.5, H * 0.3, H * 0.1, 'bmGlow', '#fffde8')
                // 遠景朦朧樹叢
                + times(9, (i, a, b) => ell((a * W).toFixed(0), (H * 0.18 + b * H * 0.45).toFixed(0), (80 + b * 120) * u, (48 + b * 70) * u, i % 2 ? '#8fc48a' : '#6fae78', `opacity="${(0.3 + b * 0.3).toFixed(2)}"`))
                // 主樹幹與垂枝
                + `<path d="M ${W * 0.66} ${railY} C ${W * 0.6} ${H * 0.62}, ${W * 0.64} ${H * 0.4}, ${W * 0.58} ${H * 0.2}" stroke="#5f7a4f" stroke-width="${(26 * u).toFixed(0)}" fill="none" stroke-linecap="round" opacity="0.9"/>`
                // 成片的柳條從上方橫楣下緣垂下來
                + willows
                // 霧氣
                + times(3, (i, a) => ell((a * W).toFixed(0), (H * (0.5 + i * 0.16)).toFixed(0), W * 0.4, (26 * u).toFixed(0), '#ffffff', 'opacity="0.3"'))
                + petals
                // 亭台結構：上楣、左右柱、欄杆
                + lattice(0, 0, W, H * 0.11, Math.max(6, Math.round(W / 130)), 1)
                + lattice(0, 0, pillarW, H, 1, Math.max(5, Math.round(H / 150)))
                + lattice(W - pillarW, 0, pillarW, H, 1, Math.max(5, Math.round(H / 150)))
                + rect(0, railY, W, 10 * u, '#5f5a3c', 'rx="3"')
                + times(Math.max(5, Math.round(W / 120)), (i) => rect((pillarW + 10 + i * ((W - pillarW * 2 - 20) / Math.max(5, Math.round(W / 120)))).toFixed(0), railY + 10 * u, 8 * u, H - railY, '#5f5a3c'))
                // 飄動的輕紗
                + veil(W * 0.05, W * 0.19, H * 0.09, H * 0.99, 40 * u, 0.9)
                + veil(W * 0.31, W * 0.15, H * 0.09, H * 0.94, -32 * u, 0.75)
                + veil(W * 0.72, W * 0.21, H * 0.09, H * 1.0, 46 * u, 0.85)
                + gust(W * 0.42, H * 0.34, W * 0.14, 0.45)
                + gust(W * 0.52, H * 0.52, W * 0.11, 0.35)
            );
        },

        // 午後茶會：玫瑰拱門框景，正中央是鋪蕾絲桌巾的圓桌與兩張椅子
        afternoonTea(mode) {
            const { W, H } = canvasOf(mode);
            const portrait = mode === 'portrait';
            const u = Math.min(W, H) / 520;
            const cx = W / 2;
            const hz = H * (portrait ? 0.44 : 0.5);        // 草坪起點
            const tableY = H * (portrait ? 0.7 : 0.72);     // 桌面高度

            // 玫瑰花：外層花瓣 + 內層 + 花心
            const rose = (x, y, s, c1, c2) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<g fill="${c1}"><circle cx="-17" r="15"/><circle cx="17" r="15"/><circle cy="-17" r="15"/><circle cy="17" r="15"/><circle cx="-12" cy="-12" r="13"/><circle cx="12" cy="12" r="13"/></g>`
                + `<g fill="${c2}"><circle cx="-8" cy="-6" r="10"/><circle cx="8" cy="-4" r="10"/><circle cy="8" r="10"/></g>`
                + `<circle r="5.5" fill="#fff1f5"/></g>`;

            const leafAt = (x, y, rot, s) => `<ellipse cx="${x}" cy="${y}" rx="${(17 * s).toFixed(1)}" ry="${(9 * s).toFixed(1)}" fill="#4f9f5c" transform="rotate(${rot} ${x} ${y})"/>`;

            // 拱門：用一個超出畫布的橢圓當骨架，只有上半部會出現在畫面裡
            const arcCx = cx, arcCy = H * 1.06, arcRx = W * 0.56, arcRy = H * 1.0;
            let arch = `<ellipse cx="${arcCx}" cy="${arcCy}" rx="${arcRx}" ry="${arcRy}" fill="none" stroke="#6b8f4f" stroke-width="${(26 * u).toFixed(0)}"/>`
                + `<ellipse cx="${arcCx}" cy="${arcCy}" rx="${arcRx}" ry="${arcRy}" fill="none" stroke="#8a6a3f" stroke-width="${(10 * u).toFixed(0)}"/>`;
            const N = portrait ? 20 : 26;
            for (let i = 0; i <= N; i++) {
                const th = Math.PI + (Math.PI * i) / N;             // 180° → 360°：拱門上緣
                const px = arcCx + arcRx * Math.cos(th);
                const py = arcCy + arcRy * Math.sin(th);
                const off = (18 + rnd(i, 41) * 16) * u;
                arch += leafAt((px + (i % 2 ? off : -off)).toFixed(0), (py + (i % 3 ? off * 0.6 : -off * 0.6)).toFixed(0), (rnd(i, 42) * 180).toFixed(0), u * 1.1);
                if (i % 2 === 0) {
                    const rs = (0.75 + rnd(i, 43) * 0.55) * u;
                    arch += rose((px - off * 0.4).toFixed(0), (py + off * 0.2).toFixed(0), rs.toFixed(2), i % 4 === 0 ? '#ef92b4' : '#f6b0c8', '#fbd0dd');
                }
            }

            // 椅子：正面視角，椅背直條 + 椅面 + 前腳
            const chair = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})" fill="#d9a86a" stroke="#a37d4c" stroke-width="3" stroke-linejoin="round">`
                + `<rect x="-30" y="-116" width="9" height="82" rx="4"/><rect x="21" y="-116" width="9" height="82" rx="4"/>`
                + `<rect x="-34" y="-124" width="68" height="12" rx="6"/>`
                + `<g stroke-width="2.5"><rect x="-14" y="-108" width="7" height="62" rx="3"/><rect x="-3.5" y="-108" width="7" height="62" rx="3"/><rect x="7" y="-108" width="7" height="62" rx="3"/></g>`
                + `<rect x="-38" y="-46" width="76" height="13" rx="6"/>`
                + `<rect x="-32" y="-33" width="9" height="33" rx="4"/><rect x="23" y="-33" width="9" height="33" rx="4"/>`
                + `</g>`;

            // 三層點心架
            const stand = (x, y, s, h) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<ellipse cy="2" rx="30" ry="8" fill="#fff8ee" stroke="#e2c98f" stroke-width="2"/>`
                + `<rect x="-2.5" y="${-h}" width="5" height="${h}" fill="#e0b95f"/>`
                + `<ellipse cy="${-h * 0.5}" rx="26" ry="7" fill="#fff8ee" stroke="#e2c98f" stroke-width="2"/>`
                + `<ellipse cy="${-h}" rx="19" ry="5.5" fill="#fff8ee" stroke="#e2c98f" stroke-width="2"/>`
                + `<circle cy="${-h - 8}" r="4" fill="#e0b95f"/>`
                + `<g fill="#fff0e2" stroke="#f0c9b0" stroke-width="1.6"><circle cx="-13" cy="-6" r="8"/><circle cx="4" cy="-8" r="9"/><circle cx="19" cy="-5" r="7"/>`
                + `<circle cx="-9" cy="${-h * 0.5 - 6}" r="8"/><circle cx="9" cy="${-h * 0.5 - 7}" r="7"/><circle cx="0" cy="${-h - 6}" r="7"/></g>`
                + `<g fill="#e2637f"><circle cx="4" cy="-14" r="3.4"/><circle cx="-13" cy="-12" r="3"/><circle cx="-9" cy="${-h * 0.5 - 12}" r="3"/><circle cx="0" cy="${-h - 11}" r="3"/></g></g>`;

            // 茶杯與高腳杯
            const cup = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<ellipse cy="6" rx="26" ry="7" fill="#ffffff" stroke="#e8c9d2" stroke-width="2"/>`
                + `<path d="M -17 2 C -17 -16, 17 -16, 17 2 Z" fill="#ffffff" stroke="#e8c9d2" stroke-width="2"/>`
                + `<path d="M 17 -8 C 27 -10, 27 2, 18 2" stroke="#ffffff" stroke-width="4" fill="none"/>`
                + `<circle cx="-6" cy="-6" r="2.6" fill="#f2a0bd"/><circle cx="4" cy="-8" r="2.2" fill="#f2a0bd"/></g>`;
            const glass = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})" fill="#eef7ff" opacity="0.9" stroke="#cfe4f2" stroke-width="2">`
                + `<path d="M -11 -34 L 11 -34 L 8 -8 L -8 -8 Z"/><rect x="-2" y="-9" width="4" height="7"/><ellipse cy="0" rx="12" ry="4"/></g>`;

            // 桌上的玫瑰花瓶
            const vase = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<path d="M -13 0 C -16 -16, -10 -22, -9 -30 L 9 -30 C 10 -22, 16 -16, 13 0 Z" fill="#eef7ff" stroke="#cfe4f2" stroke-width="2"/>`
                + rose(0, -44, 0.85, '#ef92b4', '#fbd0dd') + rose(-16, -34, 0.6, '#f6b0c8', '#fde2ea') + rose(15, -36, 0.55, '#f6b0c8', '#fde2ea')
                + leafAt(-22, -24, 30, 0.7) + leafAt(22, -26, -30, 0.7) + `</g>`;

            // 草地上的落花瓣，數量多但零散，越靠畫面下方越大
            let fallen = '';
            for (let i = 0; i < (portrait ? 26 : 30); i++) {
                const fx = W * 0.02 + rnd(i, 61) * W * 0.96;
                const t = rnd(i, 62);
                const fy = hz + 12 * u + t * (H - hz - 16 * u);
                const fs = (0.5 + t * 0.85) * u;
                const fc = i % 3 === 0 ? '#fde2ea' : (i % 3 === 1 ? '#ef92b4' : '#f6b0c8');
                fallen += `<ellipse cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" rx="${(9 * fs).toFixed(1)}" ry="${(5.2 * fs).toFixed(1)}" fill="${fc}" opacity="${(0.72 + rnd(i, 63) * 0.28).toFixed(2)}" transform="rotate(${(rnd(i, 64) * 170 - 40).toFixed(0)} ${fx.toFixed(0)} ${fy.toFixed(0)})"/>`;
            }

            // 草地兩側的小花叢，中央留空才不會擋到桌椅
            let clumps = '';
            for (let i = 0; i < 8; i++) {
                const side = i % 2 ? 1 : -1;
                // 直式的可視寬度較窄，小花叢往內收才看得到
                const gx = cx + side * (W * (portrait ? 0.22 : 0.3) + rnd(i, 65) * W * 0.16);
                const gy = hz + 26 * u + rnd(i, 66) * (H - hz - 40 * u);
                const gs = (0.42 + rnd(i, 67) * 0.3) * u;
                clumps += `<g><ellipse cx="${gx.toFixed(0)}" cy="${(gy + 10 * gs).toFixed(0)}" rx="${(30 * gs).toFixed(0)}" ry="${(12 * gs).toFixed(0)}" fill="#6fae5c"/>`
                    + rose(gx.toFixed(0), gy.toFixed(0), gs.toFixed(2), i % 3 === 0 ? '#ef92b4' : '#f6b0c8', '#fde2ea')
                    + rose((gx - 26 * gs).toFixed(0), (gy + 12 * gs).toFixed(0), (gs * 0.75).toFixed(2), '#f6b0c8', '#fde2ea')
                    + leafAt((gx + 26 * gs).toFixed(0), (gy + 14 * gs).toFixed(0), -24, gs * 1.4) + `</g>`;
            }

            const ts = u * 1.0;
            return svgOf(W, H,
                vg('atSky', [[0, '#eaf7d9'], [55, '#dff0c9'], [100, '#f6ffe8']])
                + vg('atLawn', [[0, '#9ccf72'], [100, '#5da257']])
                + glowDef('atGlow', '#fff6cf')
                + vg('atCloth', [[0, '#fffdf8'], [100, '#f2e6d2']]),
                bg(W, H, 'url(#atSky)')
                + glow(cx, H * 0.3, H * 0.13, 'atGlow', '#fffbe8')
                // 遠景：朦朧的庭園樹叢
                + times(10, (i, a, b) => disc((a * W).toFixed(0), (H * 0.2 + b * H * 0.24).toFixed(0), (60 + b * 90) * u, i % 2 ? '#7fbf72' : '#5da257', `opacity="${(0.35 + b * 0.35).toFixed(2)}"`))
                + rect(0, hz, W, H - hz, 'url(#atLawn)')
                + ell(cx, hz + 6 * u, W * 0.42, 14 * u, '#b7dd8f', 'opacity="0.5"')
                // 草地上的落花瓣與兩側小花叢
                + fallen
                + clumps
                // 玫瑰拱門（只在畫面上緣與兩側，中央留空）
                + arch
                // 椅子畫在桌子後面，兩張都露出椅背。
                // 手機直式只看得到畫布中間約七成五的寬度，椅距要收窄才不會被裁掉
                + chair(cx - (portrait ? 118 : 150) * ts, tableY + 44 * ts, ts * 1.02)
                + chair(cx + (portrait ? 118 : 150) * ts, tableY + 44 * ts, ts * 1.02)
                // 圓桌與蕾絲桌巾
                + `<g transform="translate(${cx},${tableY}) scale(${ts})">`
                + `<ellipse cy="150" rx="186" ry="26" fill="#3f6b45" opacity="0.22"/>`
                + `<path d="M -168 0 C -186 58, -190 108, -180 146 L 180 146 C 190 108, 186 58, 168 0 Z" fill="url(#atCloth)"/>`
                + `<ellipse rx="168" ry="42" fill="#fffdf8"/>`
                + `<g stroke="#e8d9bd" stroke-width="2.5" fill="none"><path d="M -180 140 C -90 154, 90 154, 180 140"/><path d="M -184 120 C -92 134, 92 134, 184 120"/></g>`
                + `<g fill="#f2c4d2" opacity="0.75"><circle cx="-120" cy="70" r="7"/><circle cx="-44" cy="96" r="6"/><circle cx="52" cy="90" r="6.5"/><circle cx="130" cy="64" r="5.5"/></g>`
                + `</g>`
                // 桌上的茶具（正中央擺點心架，兩側茶杯與高腳杯）
                + stand(cx - 52 * ts, tableY - 8 * ts, ts * 1.05, 96)
                + stand(cx + 62 * ts, tableY + 2 * ts, ts * 0.9, 62)
                + cup(cx - 138 * ts, tableY + 16 * ts, ts * 0.95)
                + cup(cx + 140 * ts, tableY + 14 * ts, ts * 0.95)
                + glass(cx - 96 * ts, tableY + 22 * ts, ts * 0.95)
                + glass(cx + 104 * ts, tableY + 24 * ts, ts * 0.95)
                + vase(cx - 6 * ts, tableY + 26 * ts, ts * 0.9)
            );
        },

        // 櫻花小徑：兩排櫻花樹夾出的街道，樹冠在頭頂接成花隧道，滿地櫻花瓣
        cherryPark(mode) {
            const { W, H } = canvasOf(mode);
            const portrait = mode === 'portrait';
            const u = Math.min(W, H) / 520;
            const cx = W / 2;
            const hz = H * (portrait ? 0.38 : 0.42);        // 消失點
            const hwTop = W * 0.035;                         // 街道在遠處的半寬
            const hwBot = W * (portrait ? 0.4 : 0.28);       // 街道在眼前的半寬

            const py = (t) => hz + (H - hz) * Math.pow(t, 1.6);
            const phw = (t) => hwTop + (hwBot - hwTop) * Math.pow(t, 1.3);

            // 櫻花花瓣：末端帶凹口的五瓣櫻花瓣型
            const petal = (x, y, s, rot, c, op) =>
                `<path d="M 0 0 C -7 -3, -10 -13, -4.5 -20 L 0 -15 L 4.5 -20 C 10 -13, 7 -3, 0 0 Z" fill="${c}" opacity="${op}" transform="translate(${x},${y}) rotate(${rot}) scale(${s})"/>`;

            // 一朵完整的櫻花（五片花瓣 + 花蕊）
            const flower = (x, y, s, c) => {
                let f = `<g transform="translate(${x},${y}) scale(${s})">`;
                for (let k = 0; k < 5; k++) f += `<path d="M 0 0 C -7 -3, -10 -13, -4.5 -20 L 0 -15 L 4.5 -20 C 10 -13, 7 -3, 0 0 Z" fill="${c}" transform="rotate(${k * 72})"/>`;
                return f + `<circle r="3.4" fill="#fff6d6"/></g>`;
            };

            // 櫻花樹：樹幹微微朝街道傾斜，樹冠是一團團花雲
            const sakura = (x, baseY, s, lean) => {
                const th = 150 * s;                       // 樹幹高度
                const tx = lean * 26 * s;                 // 樹冠偏移
                let g = `<g transform="translate(${x.toFixed(1)},${baseY.toFixed(1)})">`;
                g += `<path d="M ${(-15 * s).toFixed(1)} 0 C ${(-11 * s).toFixed(1)} ${(-th * 0.5).toFixed(1)}, ${(tx - 9 * s).toFixed(1)} ${(-th * 0.8).toFixed(1)}, ${(tx - 4 * s).toFixed(1)} ${(-th).toFixed(1)} L ${(tx + 13 * s).toFixed(1)} ${(-th).toFixed(1)} C ${(11 * s).toFixed(1)} ${(-th * 0.78).toFixed(1)}, ${(15 * s).toFixed(1)} ${(-th * 0.46).toFixed(1)}, ${(17 * s).toFixed(1)} 0 Z" fill="#5b4033"/>`;
                g += `<g stroke="#5b4033" fill="none" stroke-linecap="round">`
                    + `<path d="M ${(tx - 2 * s).toFixed(1)} ${(-th * 0.92).toFixed(1)} C ${(tx + lean * 40 * s).toFixed(1)} ${(-th * 1.1).toFixed(1)}, ${(tx + lean * 78 * s).toFixed(1)} ${(-th * 1.12).toFixed(1)}, ${(tx + lean * 110 * s).toFixed(1)} ${(-th * 1.02).toFixed(1)}" stroke-width="${(9 * s).toFixed(1)}"/>`
                    + `<path d="M ${(tx * 0.4).toFixed(1)} ${(-th * 0.72).toFixed(1)} C ${(tx - lean * 26 * s).toFixed(1)} ${(-th * 0.92).toFixed(1)}, ${(tx - lean * 52 * s).toFixed(1)} ${(-th * 0.98).toFixed(1)}, ${(tx - lean * 74 * s).toFixed(1)} ${(-th * 0.9).toFixed(1)}" stroke-width="${(7 * s).toFixed(1)}"/>`
                    + `</g>`;
                // 樹冠：深淺兩層花雲
                const cy0 = -th * 1.16;
                const blobs = [[0, 0, 62], [-58, 16, 46], [58, 10, 48], [-30, -34, 44], [34, -30, 46], [lean * 104, 6, 40], [-lean * 78, 20, 36]];
                g += `<g fill="#f095b8">` + blobs.map(([bx, by, r]) => `<circle cx="${(bx * s).toFixed(1)}" cy="${((cy0 / s + by) * s).toFixed(1)}" r="${(r * s).toFixed(1)}"/>`).join('') + `</g>`;
                g += `<g fill="#f9bdd4">` + blobs.slice(0, 5).map(([bx, by, r]) => `<circle cx="${((bx - 10) * s).toFixed(1)}" cy="${((cy0 / s + by - 12) * s).toFixed(1)}" r="${(r * 0.66 * s).toFixed(1)}"/>`).join('') + `</g>`;
                g += `<g fill="#ffe0ec">` + blobs.slice(0, 3).map(([bx, by, r]) => `<circle cx="${((bx - 18) * s).toFixed(1)}" cy="${((cy0 / s + by - 22) * s).toFixed(1)}" r="${(r * 0.4 * s).toFixed(1)}"/>`).join('') + `</g>`;
                // 樹冠上點綴幾朵看得出花型的櫻花
                g += flower((-24 * s).toFixed(1), (cy0 - 26 * s).toFixed(1), s * 0.5, '#ffffff')
                    + flower((30 * s).toFixed(1), (cy0 + 6 * s).toFixed(1), s * 0.42, '#fff2f7');
                return g + `</g>`;
            };

            // 由遠而近排出兩排樹，遠的先畫才不會蓋住近的；
            // 每排再往外補一列，讓畫面最旁邊也是滿滿的櫻花
            const ts = portrait ? [0.1, 0.2, 0.34, 0.54, 0.82, 1.15] : [0.1, 0.2, 0.34, 0.54, 0.8, 1.1];
            let trees = '';
            const treeSpots = [];   // 記下每棵樹的落點，等等在樹下堆花瓣
            for (const t of ts) {
                const tc = Math.min(t, 1);
                const baseY = py(tc) + (t > 1 ? (H - py(1)) * (t - 1) : 0);
                const s = (0.16 + t * 0.92) * u;
                const offset = phw(tc) + (16 + 40 * tc) * u;
                const outer = offset + (90 + 150 * tc) * u;
                // 外側那列稍微矮一點、位置錯開，看起來像更遠的第二排
                trees += sakura(cx - outer, baseY + 6 * u, s * 0.86, 1) + sakura(cx + outer, baseY + 6 * u, s * 0.86, -1);
                trees += sakura(cx - offset, baseY, s, 1) + sakura(cx + offset, baseY, s, -1);
                treeSpots.push([cx - offset, baseY, s], [cx + offset, baseY, s], [cx - outer, baseY, s * 0.86], [cx + outer, baseY, s * 0.86]);
            }

            // 地面花瓣：樹下堆得最厚，路緣成帶狀，路中央只有零星幾片
            let ground = '';
            let seed = 0;
            const drop = (x, y, s, i) => {
                if (x < -30 || x > W + 30 || y < hz - 4 * u) return '';
                return petal(x.toFixed(0), y.toFixed(0), s.toFixed(2), (rnd(i, 73) * 360).toFixed(0),
                    i % 5 === 0 ? '#ffffff' : (i % 3 === 0 ? '#f7b0ca' : '#fbd3e0'), (0.82 + rnd(i, 74) * 0.18).toFixed(2));
            };
            // 1. 每棵樹底下的落花堆
            for (const [tx, ty, s] of treeSpots) {
                const n = Math.max(6, Math.round(26 * s / u));
                for (let k = 0; k < n; k++, seed++) {
                    const a = rnd(seed, 61) * Math.PI * 2;
                    const r = Math.sqrt(rnd(seed, 62));
                    ground += drop(tx + Math.cos(a) * r * 132 * s, ty + Math.sin(a) * r * 34 * s, (0.3 + s / u * 0.55) * u, seed);
                }
            }
            // 2. 路緣兩側的花瓣帶
            for (let i = 0; i < (portrait ? 90 : 110); i++, seed++) {
                const t = 0.06 + rnd(seed, 63) * 0.96;
                const tc = Math.min(t, 1);
                const side = i % 2 ? 1 : -1;
                const x = cx + side * phw(tc) * (0.72 + rnd(seed, 64) * 0.42);
                ground += drop(x, py(tc), (0.26 + tc * 0.55) * u, seed);
            }
            // 3. 路中央零星幾片
            for (let i = 0; i < (portrait ? 22 : 26); i++, seed++) {
                const tc = 0.1 + rnd(seed, 65) * 0.9;
                ground += drop(cx + (rnd(seed, 66) - 0.5) * phw(tc) * 1.25, py(tc), (0.26 + tc * 0.55) * u, seed);
            }

            // 空中正在飄落的花瓣：上半部多、越往下越少，大小不一
            let air = '';
            for (let i = 0; i < (portrait ? 40 : 46); i++) {
                const fy = Math.pow(rnd(i, 82), 0.7) * H * 0.95;
                air += petal((rnd(i, 81) * W).toFixed(0), fy.toFixed(0), ((0.34 + rnd(i, 83) * 0.8) * u).toFixed(2), (rnd(i, 84) * 360).toFixed(0), i % 4 === 0 ? '#ffffff' : '#f9c6da', (0.6 + rnd(i, 85) * 0.4).toFixed(2));
            }

            return svgOf(W, H,
                vg('cpSky', [[0, '#1f7fd4'], [45, '#5ab4ef'], [100, '#bfe4fa']])
                + vg('cpRoad', [[0, '#b9ada1'], [100, '#8f8378']])
                + vg('cpSide', [[0, '#7fa36a'], [100, '#4f6f47']]),
                bg(W, H, 'url(#cpSky)')
                // 遠景樹林與地面
                + rect(0, hz - 6 * u, W, H - hz + 6 * u, 'url(#cpSide)')
                + times(9, (i, a, b) => disc((a * W).toFixed(0), (hz - (16 + b * 40) * u).toFixed(0), (26 + b * 40) * u, i % 2 ? '#f7b8cf' : '#f095b8', 'opacity="0.9"'))
                // 街道
                + `<path d="M ${(cx - hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx + hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx + hwBot).toFixed(0)} ${H} L ${(cx - hwBot).toFixed(0)} ${H} Z" fill="url(#cpRoad)"/>`
                // 路緣
                + `<path d="M ${(cx - hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx - hwBot).toFixed(0)} ${H}" stroke="#d9cfc2" stroke-width="${(5 * u).toFixed(1)}" fill="none"/>`
                + `<path d="M ${(cx + hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx + hwBot).toFixed(0)} ${H}" stroke="#d9cfc2" stroke-width="${(5 * u).toFixed(1)}" fill="none"/>`
                + ground
                + trees
                + air
            );
        },

        // 翠綠竹林：中央土徑往深處延伸，兩側是密不透風的竹牆，竹葉在頭頂蓋成綠蔭
        bambooGrove(mode) {
            const { W, H } = canvasOf(mode);
            const portrait = mode === 'portrait';
            const u = Math.min(W, H) / 520;
            const cx = W / 2;
            const hz = H * (portrait ? 0.58 : 0.62);          // 消失點
            // 直式畫布較高，小徑遠端要寬一點、透視收斂放緩，否則會看起來像一座土丘
            const hwTop = W * (portrait ? 0.1 : 0.055);
            const hwBot = W * (portrait ? 0.42 : 0.32);

            const py = (t) => hz + (H - hz) * Math.pow(t, portrait ? 1.35 : 1.7);
            const phw = (t) => hwTop + (hwBot - hwTop) * Math.pow(t, 1.35);

            // 單片竹葉
            const leaf = (x, y, s, rot, fill, op = 1) =>
                `<path d="M 0 0 C 12 -5, 30 -7, 46 0 C 30 7, 12 5, 0 0 Z" fill="${fill}" opacity="${op}" transform="translate(${x},${y}) rotate(${rot}) scale(${s})"/>`;

            // 一叢竹葉：從一點放射出去的細長葉子
            const cluster = (x, y, s, fill, n = 9) => {
                let g = '';
                for (let k = 0; k < n; k++) {
                    const ang = -150 + (300 / n) * k + rnd(k + x * 0.01, 111) * 24;
                    g += leaf(x.toFixed(0), y.toFixed(0), (s * (0.7 + rnd(k + x * 0.01, 112) * 0.6)).toFixed(2), ang.toFixed(0), fill, 0.95);
                }
                return g;
            };

            // 竹竿：由地面往上超出畫面，帶竹節與側枝
            const stalk = (x, baseY, w, tint, dark, lean) => {
                const top = -30;
                let g = `<path d="M ${(x - w / 2).toFixed(1)} ${baseY.toFixed(1)} C ${(x - w / 2 + lean * 0.3).toFixed(1)} ${(baseY * 0.6).toFixed(1)}, ${(x - w / 2 + lean * 0.7).toFixed(1)} ${(baseY * 0.3).toFixed(1)}, ${(x - w / 2 + lean).toFixed(1)} ${top} L ${(x + w / 2 + lean).toFixed(1)} ${top} C ${(x + w / 2 + lean * 0.7).toFixed(1)} ${(baseY * 0.3).toFixed(1)}, ${(x + w / 2 + lean * 0.3).toFixed(1)} ${(baseY * 0.6).toFixed(1)}, ${(x + w / 2).toFixed(1)} ${baseY.toFixed(1)} Z" fill="${tint}"/>`;
                const seg = Math.max(34 * u, w * 5.2);
                for (let y = top + seg * 0.5, k = 0; y < baseY; y += seg, k++) {
                    const off = lean * (1 - y / baseY);
                    g += `<rect x="${(x - w / 2 - 1.5 + off).toFixed(1)}" y="${y.toFixed(1)}" width="${(w + 3).toFixed(1)}" height="${Math.max(2, w * 0.24).toFixed(1)}" fill="${dark}" rx="1.5"/>`;
                }
                return g;
            };

            // 兩側竹牆：每側由遠而近排一整排，離小徑越遠的排在更外面
            const wall = (dir) => {
                let g = '';
                const n = portrait ? 16 : 22;
                for (let i = 0; i < n; i++) {
                    const t = 0.08 + (i / n) * 1.0;
                    const tc = Math.min(t, 1);
                    const baseY = py(tc) + (t > 1 ? (H - py(1)) * (t - 1) * 2 : 0);
                    const spread = rnd(i + (dir > 0 ? 50 : 0), 121);
                    const x = cx + dir * (phw(tc) + (6 + spread * 300 * tc) * u);
                    const w = (3.5 + tc * 15 * (0.7 + rnd(i, 122) * 0.6)) * u;
                    const shade = rnd(i, 123);
                    const tint = shade > 0.66 ? '#9fd45f' : (shade > 0.33 ? '#7cc44f' : '#5aa844');
                    const dark = shade > 0.5 ? '#4f8f3f' : '#3d7a35';
                    g += stalk(x, baseY + 4 * u, w, tint, dark, dir * (4 + tc * 20) * u);
                }
                return g;
            };

            // 頭頂的竹葉綠蔭
            // 上方的綠蔭：先鋪一層深綠底，再疊上大量葉叢
            let canopy = times(14, (i, a, b) => ell((a * W).toFixed(0), (-20 + b * H * 0.22).toFixed(0), (90 + b * 90) * u, (46 + b * 50) * u, i % 2 ? '#4f9640' : '#3f7d36', 'opacity="0.9"'));
            const cn = portrait ? 30 : 42;
            for (let i = 0; i < cn; i++) {
                const x = W * ((i + 0.5) / cn) + (rnd(i, 131) - 0.5) * W * 0.09;
                const y = -16 + Math.pow(rnd(i, 132), 1.3) * H * 0.46;
                const s = (0.85 + rnd(i, 133) * 1.0) * u;
                canopy += cluster(x, y, s, i % 3 === 0 ? '#5aa844' : (i % 3 === 1 ? '#7cc44f' : '#48963c'), 11);
            }

            // 小徑上的落葉、青苔與石頭
            let litter = '';
            for (let i = 0; i < (portrait ? 90 : 110); i++) {
                const t = 0.05 + rnd(i, 141) * 0.98;
                const tc = Math.min(t, 1);
                const x = cx + (rnd(i, 142) - 0.5) * phw(tc) * 2.1;
                litter += leaf(x.toFixed(0), py(tc).toFixed(0), ((0.22 + tc * 0.5) * u).toFixed(2), (rnd(i, 143) * 360).toFixed(0), i % 4 === 0 ? '#c9b06a' : (i % 3 === 0 ? '#8fae4f' : '#a8964f'), 0.95);
            }
            let rocks = '';
            for (let i = 0; i < 14; i++) {
                const t = 0.15 + rnd(i, 151) * 0.85;
                const side = i % 2 ? 1 : -1;
                const x = cx + side * phw(t) * (0.85 + rnd(i, 152) * 0.5);
                rocks += ell(x.toFixed(0), py(t).toFixed(0), ((10 + rnd(i, 153) * 26) * t * u).toFixed(1), ((5 + rnd(i, 154) * 12) * t * u).toFixed(1), i % 3 === 0 ? '#6f7a52' : '#8a8f6a', 'opacity="0.95"');
            }

            // 空中緩緩飄落的竹葉
            let falling = '';
            for (let i = 0; i < (portrait ? 20 : 26); i++) {
                const y = Math.pow(rnd(i, 161), 0.75) * H * 0.92;
                falling += leaf((rnd(i, 162) * W).toFixed(0), y.toFixed(0), ((0.6 + rnd(i, 163) * 0.8) * u).toFixed(2), (10 + rnd(i, 164) * 70 + (y / H) * 40).toFixed(0), i % 3 === 0 ? '#cfe8a8' : '#8fc45a', (0.75 + rnd(i, 165) * 0.25).toFixed(2));
            }

            return svgOf(W, H,
                vg('bgSky', [[0, '#d9f5a8'], [40, '#a8dd6f'], [100, '#4f8f3f']])
                + glowDef('bgGlow', '#f7ffd9')
                + vg('bgRay', [[0, '#f2ffcf', 0.3], [100, '#f2ffcf', 0]])
                + vg('bgPath', [[0, '#8a7a56'], [100, '#5f5436']])
                + vg('bgFloor', [[0, '#5f8f42'], [100, '#39602f']]),
                bg(W, H, 'url(#bgSky)')
                + glow(cx, H * 0.16, H * 0.12, 'bgGlow', '#fbffe8')
                + rays(W, H * 0.9, cx, H * 0.12, 5, 'url(#bgRay)')
                // 林地：先鋪滿地面再畫小徑，否則土徑會像浮在半空
                + rect(0, hz - 6 * u, W, H - hz + 6 * u, 'url(#bgFloor)')
                + times(12, (i, a, b) => ell((a * W).toFixed(0), (hz + b * (H - hz)).toFixed(0), (60 + b * 160) * u, (16 + b * 40) * u, i % 2 ? '#3f6b35' : '#4f7a3f', 'opacity="0.85"'))
                // 小徑
                + `<path d="M ${(cx - hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx + hwTop).toFixed(0)} ${hz.toFixed(0)} L ${(cx + hwBot).toFixed(0)} ${H} L ${(cx - hwBot).toFixed(0)} ${H} Z" fill="url(#bgPath)"/>`
                // 地面橫向紋理，強化「平面往後延伸」的感覺
                + times(6, (i, a) => {
                    const t = 0.16 + (i / 6) * 0.88;
                    const yy = py(Math.min(t, 1));
                    return `<path d="M 0 ${yy.toFixed(0)} C ${(W * 0.3).toFixed(0)} ${(yy - 6 * u * t).toFixed(0)}, ${(W * 0.7).toFixed(0)} ${(yy + 6 * u * t).toFixed(0)}, ${W} ${yy.toFixed(0)}" stroke="#2f5b2a" stroke-width="${(2.5 * u * t).toFixed(1)}" fill="none" opacity="0.35"/>`;
                })
                // 路兩旁的青苔
                + times(10, (i, a, b) => ell((cx + (i % 2 ? 1 : -1) * phw(0.2 + b * 0.8) * 1.15).toFixed(0), py(0.2 + b * 0.8).toFixed(0), (30 + b * 80) * u * (0.3 + b), (10 + b * 24) * u * (0.3 + b), i % 2 ? '#4f7a3f' : '#3f6b35', 'opacity="0.9"'))
                + rocks
                + litter
                // 兩側竹牆與頭頂綠蔭
                + wall(-1) + wall(1)
                + canopy
                + falling
            );
        },

        // 雨中街景：灰藍街屋、路燈與雨絲
        rainyStreet(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.74;
            return svgOf(W, H,
                vg('rsSky', [[0, '#7c93ab'], [100, '#c3d3de']]) + vg('rsRoad', [[0, '#5b6b7a'], [100, '#3d4a57']]),
                bg(W, H, 'url(#rsSky)')
                + buildings(W, hz, '#6b7f92', '#ffe9a8', 3)
                + rect(0, hz, W, H - hz, 'url(#rsRoad)')
                + times(5, (i, a) => ell(a * W, hz + H * 0.12 + (i % 2) * H * 0.07, W * 0.07, H * 0.018, '#8fa6b8', 'opacity="0.55"'))
                // 路燈
                + `<g transform="translate(${W * 0.78},${hz + 10})"><rect x="-5" y="-190" width="10" height="190" fill="#3f4c59"/><path d="M -26 -196 L 26 -196 L 16 -166 L -16 -166 Z" fill="#ffe9a8"/><ellipse cx="0" cy="-168" rx="60" ry="40" fill="#ffe9a8" opacity="0.22"/></g>`
                + rain(W, H, 46, '#dbe8f2')
            );
        },

        // 夕陽海灘：落日、海面反光與沙灘
        sunsetBeach(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.56;
            return svgOf(W, H,
                vg('sbSky', [[0, '#5d4b9e'], [38, '#f4786b'], [72, '#ffb15c'], [100, '#ffe1a8']])
                + glowDef('sbGlow', '#fff0b8') + vg('sbSea', [[0, '#f0a05f'], [55, '#d4694f'], [100, '#8f4a63']]) + vg('sbSand', [[0, '#f2dcb0'], [100, '#d9bd86']]),
                bg(W, H, 'url(#sbSky)') + glow(W * 0.52, hz - H * 0.02, H * 0.13, 'sbGlow', '#ffe9a0')
                + rect(0, hz, W, H * 0.22, 'url(#sbSea)')
                + times(9, (i, a, b) => rect(W * 0.52 - (10 + b * 60), hz + 8 + i * (H * 0.021), 20 + b * 120, 5, '#ffe6ad', 'opacity="0.7" rx="2"'))
                + `<path d="M 0 ${hz + H * 0.2} C ${W * 0.3} ${hz + H * 0.16}, ${W * 0.62} ${hz + H * 0.26}, ${W} ${hz + H * 0.19} L ${W} ${H} L 0 ${H} Z" fill="url(#sbSand)"/>`
                + palm(W * 0.14, H * 0.96, mode === 'wide' ? 1.1 : 1.3, '#2f6b43', '#7a4a2a')
                + times(3, (i, a) => cloud(a * W, H * (0.12 + i * 0.07), 0.6, '#ff9d7a', 0.55))
            );
        },

        // 秋日楓紅：紅黃楓樹與落葉
        autumnLeaves(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.62;
            return svgOf(W, H,
                vg('alSky', [[0, '#ffd28a'], [55, '#ffe3b8'], [100, '#fff1d9']]) + vg('alG', [[0, '#d9a85f'], [100, '#a97b42']]),
                bg(W, H, 'url(#alSky)')
                + hill(W, H, hz, 18, '#c9915a') + hill(W, H, hz + H * 0.08, 22, 'url(#alG)', 1.1)
                + tree(W * 0.2, hz + 24, 0.95, '#e2643f', '#7a4a2a', '#f59b52')
                + tree(W * 0.82, hz + 32, 1.05, '#d4512f', '#7a4a2a', '#f0863f')
                + tree(W * 0.52, hz + 4, 0.62, '#f0a03f', '#7a4a2a', '#ffc766')
                + times(20, (i, a, b, c) => `<path d="M 0 -9 L 8 0 L 0 9 L -8 0 Z" fill="${c > 0.5 ? '#e2643f' : '#f0a03f'}" opacity="${(0.55 + c * 0.4).toFixed(2)}" transform="translate(${(a * W).toFixed(0)},${(b * H).toFixed(0)}) rotate(${(c * 120).toFixed(0)})"/>`)
            );
        },

        // 深海秘境：海水漸層、光束、珊瑚與氣泡
        deepSea(mode) {
            const { W, H } = canvasOf(mode), floorY = H * 0.78;
            const coral = (x, y, s, fill) => `<g transform="translate(${x},${y}) scale(${s})" stroke="${fill}" stroke-width="13" fill="none" stroke-linecap="round"><path d="M 0 0 L 0 -60"/><path d="M 0 -30 C -18 -44, -26 -62, -24 -84"/><path d="M 0 -40 C 18 -54, 28 -70, 28 -92"/></g>`;
            const weed = (x, y, s, fill) => `<g transform="translate(${x},${y}) scale(${s})" stroke="${fill}" stroke-width="10" fill="none" stroke-linecap="round"><path d="M 0 0 C -14 -34, 10 -58, -4 -96"/><path d="M 18 0 C 32 -30, 12 -54, 26 -92"/></g>`;
            return svgOf(W, H,
                vg('dsSea', [[0, '#2aa7d4'], [45, '#166fa8'], [100, '#062d54']]) + vg('dsRay', [[0, '#bff0ff', 0.45], [100, '#bff0ff', 0]]) + vg('dsFloor', [[0, '#3f6f8f'], [100, '#12314f']]),
                bg(W, H, 'url(#dsSea)') + rays(W, H, W * 0.44, -H * 0.05, 6, 'url(#dsRay)')
                + `<path d="M 0 ${floorY + 18} C ${W * 0.25} ${floorY - 16}, ${W * 0.6} ${floorY + 26}, ${W} ${floorY - 4} L ${W} ${H} L 0 ${H} Z" fill="url(#dsFloor)"/>`
                + coral(W * 0.18, floorY + 24, 1.1, '#f0798e') + coral(W * 0.78, floorY + 20, 0.9, '#f4a259')
                + weed(W * 0.42, floorY + 26, 1.1, '#2f9e6f') + weed(W * 0.62, floorY + 22, 0.9, '#3fb37f')
                + times(4, (i, a, b) => `<g transform="translate(${(a * W).toFixed(0)},${(H * 0.2 + b * H * 0.4).toFixed(0)}) scale(${(0.6 + b).toFixed(2)})" fill="#ffd166"><path d="M 0 0 C 16 -14, 44 -14, 58 0 C 44 14, 16 14, 0 0 Z"/><path d="M 58 0 L 76 -14 L 76 14 Z"/><circle cx="16" cy="-4" r="3.4" fill="#0b2a44"/></g>`)
                + bubbles(W, H, 16, '#cdeeff')
            );
        },

        // 銀白雪山：雪峰、針葉樹與飄雪
        snowyMountain(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.64;
            return svgOf(W, H,
                vg('smSky', [[0, '#9fd6f5'], [60, '#d6ecfa'], [100, '#f2fbff']]) + vg('smG', [[0, '#ffffff'], [100, '#d6e6f2']]),
                bg(W, H, 'url(#smSky)')
                + peaks(W, H, hz - H * 0.04, H * 0.3, 4, '#b9d4e8') + peaks(W, H, hz, H * 0.22, 5, '#e8f4fb')
                + hill(W, H, hz + H * 0.09, 16, 'url(#smG)')
                + pine(W * 0.16, hz + H * 0.16, 0.8, '#2f6b52', '#eaf6ff')
                + pine(W * 0.3, hz + H * 0.2, 0.6, '#2f6b52', '#eaf6ff')
                + pine(W * 0.82, hz + H * 0.18, 0.9, '#2f6b52', '#eaf6ff')
                + flakes(W, H, 34, '#ffffff', 3.4)
            );
        },

        // 璀璨星空：銀河、月亮與遠山
        starryNight(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.76;
            return svgOf(W, H,
                vg('snSky', [[0, '#0b1140'], [55, '#23306e'], [100, '#4a4e8c']]) + glowDef('snMoon', '#fff6d0') + vg('snG', [[0, '#1e2450'], [100, '#0c0f2c']]),
                bg(W, H, 'url(#snSky)')
                + `<ellipse cx="${W * 0.5}" cy="${H * 0.36}" rx="${W * 0.62}" ry="${H * 0.13}" fill="#7b83d8" opacity="0.28" transform="rotate(-12 ${W * 0.5} ${H * 0.36})"/>`
                + stars(W, H, 80, '#ffffff')
                + glow(W * 0.74, H * 0.2, H * 0.07, 'snMoon', '#fff3c4')
                + peaks(W, H, hz, H * 0.16, 4, '#2a3060')
                + hill(W, H, hz + H * 0.08, 12, 'url(#snG)')
            );
        },

        // 糖果王國：棒棒糖、糖果拐杖與軟糖山丘
        candyLand(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.64;
            const lolli = (x, y, s, c1, c2) => `<g transform="translate(${x},${y}) scale(${s})"><rect x="-5" y="-86" width="10" height="90" fill="#ffffff" rx="5"/><circle cy="-112" r="42" fill="${c1}"/><path d="M 0 -112 m -42 0 a 42 42 0 0 1 42 -42 a 21 21 0 0 0 0 42 a 21 21 0 0 1 0 42 a 42 42 0 0 1 -42 -42 Z" fill="${c2}"/></g>`;
            return svgOf(W, H,
                vg('clSky', [[0, '#ffd1e8'], [55, '#ffe4f2'], [100, '#fff2f8']]) + vg('clG', [[0, '#ff9ecb'], [100, '#e2589f']]),
                bg(W, H, 'url(#clSky)')
                + times(3, (i, a) => cloud(a * W, H * (0.12 + i * 0.08), 0.75, '#ffffff', 0.85))
                + hill(W, H, hz, 20, '#f9c0dd') + hill(W, H, hz + H * 0.1, 24, 'url(#clG)', 1.3)
                + lolli(W * 0.18, hz + H * 0.2, 0.9, '#ff6fa5', '#fff0f6')
                + lolli(W * 0.8, hz + H * 0.24, 1.05, '#7ad0f0', '#ffffff')
                + `<g transform="translate(${W * 0.5},${hz + H * 0.18}) scale(1)"><path d="M -8 0 L -8 -96 C -8 -128, 44 -128, 44 -96 L 28 -96 C 28 -110, 8 -110, 8 -96 L 8 0 Z" fill="#ffffff" stroke="#ff6fa5" stroke-width="9"/></g>`
                + times(18, (i, a, b, c) => rect((a * W).toFixed(0), (b * H).toFixed(0), 14, 5, c > 0.5 ? '#ffe066' : '#7ad0f0', `rx="2.5" transform="rotate(${(c * 140).toFixed(0)} ${(a * W).toFixed(0)} ${(b * H).toFixed(0)})"`))
            );
        },

        // 魔法學院：紫色夜空下的尖塔與魔法光點
        magicAcademy(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.8;
            const tower = (x, y, h, w, body, roof) => `<g>${rect(x - w / 2, y - h, w, h, body, 'rx="4"')}<path d="M ${x - w / 2 - 10} ${y - h} L ${x} ${y - h - w * 1.1} L ${x + w / 2 + 10} ${y - h} Z" fill="${roof}"/>${rect(x - 9, y - h * 0.62, 18, 26, '#ffe9a8', 'rx="9"')}${rect(x - 9, y - h * 0.34, 18, 26, '#ffe9a8', 'rx="9"')}</g>`;
            return svgOf(W, H,
                vg('maSky', [[0, '#2b1259'], [55, '#5b2f8f'], [100, '#8e5bb5']]) + glowDef('maMoon', '#ffeec4'),
                bg(W, H, 'url(#maSky)') + stars(W, H, 50, '#ffffff') + glow(W * 0.2, H * 0.18, H * 0.055, 'maMoon', '#ffeec4')
                + tower(W * 0.36, hz, H * 0.44, W * 0.075, '#3f2a63', '#6f3fa0')
                + tower(W * 0.5, hz, H * 0.6, W * 0.095, '#4a3272', '#7d49b0')
                + tower(W * 0.66, hz, H * 0.38, W * 0.07, '#3f2a63', '#6f3fa0')
                + rect(0, hz, W, H - hz, '#2a1a4a')
                + sparkles(W, H * 0.8, 16, '#c4a8ff')
            );
        },

        // 薰衣草田：一畦畦紫色花田
        lavenderField(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.44;
            let rows = '';
            for (let i = 0; i < 7; i++) {
                const t = i / 6;
                const y = hz + (H - hz) * (t * t * 0.95 + 0.05);
                rows += `<path d="M ${-W * 0.1} ${y} C ${W * 0.3} ${y - 14 - t * 22}, ${W * 0.7} ${y + 12 + t * 20}, ${W * 1.1} ${y}" stroke="${i % 2 ? '#8b6fd6' : '#a98cf0'}" stroke-width="${10 + t * 46}" fill="none" stroke-linecap="round"/>`;
            }
            return svgOf(W, H,
                vg('lfSky', [[0, '#bfd9ff'], [60, '#e4dcff'], [100, '#f6efff']]) + glowDef('lfGlow', '#fff3c9'),
                bg(W, H, 'url(#lfSky)') + glow(W * 0.76, H * 0.16, H * 0.06, 'lfGlow', '#fff0b8')
                + times(2, (i, a) => cloud(a * W, H * 0.16, 0.7, '#ffffff', 0.8))
                + rect(0, hz, W, H - hz, '#b7d38f') + rows
                + times(10, (i, a, b, c) => disc((a * W).toFixed(0), (hz + b * (H - hz)).toFixed(0), (3 + c * 4).toFixed(1), '#e9d5ff', 'opacity="0.8"'))
            );
        },

        // 夢幻極光：極光帶、星空與雪原
        auroraSky(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.76;
            const ribbon = (y, amp, color, w) => `<path d="M ${-W * 0.1} ${y} C ${W * 0.25} ${y - amp}, ${W * 0.55} ${y + amp}, ${W * 1.1} ${y - amp * 0.5}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="0.55"/>`;
            return svgOf(W, H,
                vg('asSky', [[0, '#071b38'], [60, '#0e3550'], [100, '#1b5a6b']]) + vg('asG', [[0, '#d6f0f5'], [100, '#8fb9cc']]),
                bg(W, H, 'url(#asSky)') + stars(W, H, 60, '#ffffff')
                + ribbon(H * 0.24, H * 0.16, '#5ef0b8', 58) + ribbon(H * 0.34, H * 0.12, '#7ad8ff', 44) + ribbon(H * 0.44, H * 0.1, '#b78cff', 32)
                + hill(W, H, hz, 18, '#b9dae6') + hill(W, H, hz + H * 0.08, 14, 'url(#asG)', 1.2)
                + pine(W * 0.2, hz + H * 0.12, 0.55, '#1f4a3f', '#e8f6fb') + pine(W * 0.84, hz + H * 0.14, 0.62, '#1f4a3f', '#e8f6fb')
            );
        },

        // 復古街機：霓虹格線地板與像素方塊
        retroArcade(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.5;
            let grid = '';
            for (let i = 0; i <= 12; i++) grid += `<path d="M ${W / 2} ${hz} L ${(i / 12) * W * 2.4 - W * 0.7} ${H}" stroke="#ff4fd8" stroke-width="2.6" opacity="0.7"/>`;
            for (let i = 1; i <= 7; i++) { const y = hz + (H - hz) * Math.pow(i / 7, 2); grid += `<path d="M 0 ${y} L ${W} ${y}" stroke="#4fe3ff" stroke-width="2.6" opacity="0.65"/>`; }
            return svgOf(W, H,
                vg('raSky', [[0, '#1b0836'], [60, '#3d1063'], [100, '#7a1f83']]) + glowDef('raSun', '#ff7ad8'),
                bg(W, H, 'url(#raSky)') + stars(W, H, 40, '#ffd6ff')
                + glow(W * 0.5, hz - H * 0.06, H * 0.14, 'raSun', '#ffb15c')
                + rect(0, hz, W, H - hz, '#1a0630') + grid
                + times(7, (i, a, b, c) => rect((a * W).toFixed(0), (b * hz * 0.8).toFixed(0), (16 + c * 18).toFixed(0), (16 + c * 18).toFixed(0), c > 0.5 ? '#4fe3ff' : '#ffe066', 'opacity="0.85"'))
            );
        },

        // 賽博霓虹：夜城剪影與霓虹招牌
        neonCity(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.78;
            return svgOf(W, H,
                vg('ncSky', [[0, '#06132e'], [55, '#12305c'], [100, '#3f2f6e']]) + vg('ncRoad', [[0, '#12224a'], [100, '#070f24']]),
                bg(W, H, 'url(#ncSky)') + stars(W, H, 36, '#9fd8ff')
                + buildings(W, hz, '#10224a', '#4fe3ff', 11)
                + buildings(W, hz, '#0a1738', '#ff6fd8', 5)
                + rect(0, hz, W, H - hz, 'url(#ncRoad)')
                + times(6, (i, a, b) => rect((a * W).toFixed(0), (hz + 10 + b * (H - hz) * 0.7).toFixed(0), 10, 46, i % 2 ? '#4fe3ff' : '#ff6fd8', 'opacity="0.35" rx="5"'))
                + `<g opacity="0.9">${rect(W * 0.12, hz - H * 0.3, 16, H * 0.2, '#ff4fd8', 'rx="8"')}${rect(W * 0.86, hz - H * 0.26, 14, H * 0.16, '#4fe3ff', 'rx="7"')}</g>`
            );
        },

        // 水晶洞穴：鐘乳石與發光水晶
        crystalCave(mode) {
            const { W, H } = canvasOf(mode), floorY = H * 0.76;
            const crystal = (x, y, s, c1, c2) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M 0 0 L -26 -46 L -12 -96 L 14 -104 L 30 -50 Z" fill="${c1}"/><path d="M 0 0 L 30 -50 L 14 -104 L 8 -96 Z" fill="${c2}"/></g>`;
            let stal = '';
            for (let i = 0; i < 9; i++) { const x = (i + 0.5) * (W / 9); const h = 60 + rnd(i, 9) * 160; stal += `<path d="M ${x - 30} -10 L ${x} ${h} L ${x + 30} -10 Z" fill="#4a2f6e"/>`; }
            return svgOf(W, H,
                vg('ccWall', [[0, '#3a1f5c'], [60, '#5b2f83'], [100, '#2a1442']]) + glowDef('ccGlow', '#c4a8ff') + vg('ccFloor', [[0, '#4a2f6e'], [100, '#1e0f33']]),
                bg(W, H, 'url(#ccWall)') + stal
                + disc(W * 0.5, floorY - H * 0.1, H * 0.3, 'url(#ccGlow)')
                + `<path d="M 0 ${floorY + 10} C ${W * 0.3} ${floorY - 14}, ${W * 0.7} ${floorY + 24}, ${W} ${floorY - 6} L ${W} ${H} L 0 ${H} Z" fill="url(#ccFloor)"/>`
                + crystal(W * 0.24, floorY + 20, 1.1, '#a78bfa', '#c4b5fd') + crystal(W * 0.36, floorY + 26, 0.7, '#7dd3fc', '#bae6fd')
                + crystal(W * 0.72, floorY + 22, 1.25, '#f0abfc', '#f5d0fe') + crystal(W * 0.84, floorY + 28, 0.8, '#a78bfa', '#ddd6fe')
                + sparkles(W, H * 0.9, 12, '#e9d5ff')
            );
        },

        // 浩瀚銀河：星雲、行星與星環
        galaxySpace(mode) {
            const { W, H } = canvasOf(mode);
            return svgOf(W, H,
                vg('gsSky', [[0, '#05061f'], [55, '#160b3f'], [100, '#2c0f4f']]) + glowDef('gsNeb', '#b06bff') + glowDef('gsNeb2', '#3fa8ff') + glowDef('gsStar', '#fff3c4'),
                bg(W, H, 'url(#gsSky)')
                + disc(W * 0.3, H * 0.34, H * 0.42, 'url(#gsNeb)') + disc(W * 0.72, H * 0.6, H * 0.36, 'url(#gsNeb2)')
                + stars(W, H, 110, '#ffffff')
                + `<g transform="translate(${W * 0.7},${H * 0.36})">${disc(0, 0, H * 0.11, '#f4a259')}${ell(0, 0, H * 0.2, H * 0.05, 'none', 'stroke="#ffd7a8" stroke-width="7" opacity="0.85" transform="rotate(-22)"')}</g>`
                + disc(W * 0.22, H * 0.72, H * 0.055, '#7dd3fc')
                + sparkles(W, H, 10, '#ffffff')
            );
        },

        // 沙漠綠洲：沙丘、水池與棕櫚
        desertOasis(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.52;
            return svgOf(W, H,
                vg('doSky', [[0, '#7fd4f5'], [55, '#ffe9a8'], [100, '#ffd98a']]) + glowDef('doSun', '#fff4c4') + vg('doSand', [[0, '#f5d98f'], [100, '#d9a95f']]),
                bg(W, H, 'url(#doSky)') + glow(W * 0.24, H * 0.2, H * 0.075, 'doSun', '#fff2a8')
                + hill(W, H, hz, 22, '#f0cf8a') + hill(W, H, hz + H * 0.1, 26, 'url(#doSand)', 1.5)
                + ell(W * 0.58, H * 0.82, W * 0.22, H * 0.075, '#45b6d9')
                + ell(W * 0.58, H * 0.815, W * 0.17, H * 0.05, '#7ad0ea')
                + palm(W * 0.42, H * 0.83, mode === 'wide' ? 0.95 : 1.15, '#3f8f58', '#8a5a34')
                + palm(W * 0.76, H * 0.85, mode === 'wide' ? 0.8 : 1, '#2f7a4a', '#7a4a2a')
                + times(4, (i, a) => `<path d="M ${(a * W).toFixed(0)} ${(hz + H * 0.24).toFixed(0)} q 14 -6 28 0" stroke="#c9a05f" stroke-width="4" fill="none" opacity="0.7"/>`)
            );
        },

        // 遠古遺跡：斷柱、石階與藤蔓
        ancientRuins(mode) {
            const { W, H } = canvasOf(mode), baseY = H * 0.8;
            return svgOf(W, H,
                vg('arSky', [[0, '#c9b28f'], [55, '#e8d6b4'], [100, '#f5ead2']]) + vg('arG', [[0, '#a98f6b'], [100, '#7a6647']]),
                bg(W, H, 'url(#arSky)')
                + times(3, (i, a) => cloud(a * W, H * 0.15, 0.6, '#fff8e8', 0.7))
                + rect(0, baseY, W, H - baseY, 'url(#arG)')
                + column(W * 0.16, baseY, H * 0.4, W * 0.05, '#d9c7a3', '#c2ab84')
                + column(W * 0.3, baseY, H * 0.26, W * 0.045, '#cfbc97', '#b89f78')
                + column(W * 0.72, baseY, H * 0.46, W * 0.052, '#d9c7a3', '#c2ab84')
                + column(W * 0.86, baseY, H * 0.2, W * 0.042, '#c9b694', '#b09774')
                + rect(W * 0.34, baseY - H * 0.5, W * 0.4, H * 0.06, '#d9c7a3', 'rx="4"')
                + times(6, (i, a, b) => `<path d="M ${(a * W).toFixed(0)} ${(baseY - b * H * 0.3).toFixed(0)} c 12 20, -10 34, 4 56" stroke="#5f8f52" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/>`)
            );
        },

        // 熔岩火山：噴發的火山口與岩漿河
        volcanoCore(mode) {
            const { W, H } = canvasOf(mode), baseY = H * 0.78;
            return svgOf(W, H,
                vg('vcSky', [[0, '#2b0a14'], [50, '#7a1d1d'], [100, '#e2542a']]) + glowDef('vcGlow', '#ffb15c') + vg('vcRock', [[0, '#4a2a2a'], [100, '#1f1010']]),
                bg(W, H, 'url(#vcSky)') + disc(W * 0.5, baseY - H * 0.34, H * 0.34, 'url(#vcGlow)')
                + `<path d="M ${W * 0.12} ${baseY} L ${W * 0.4} ${baseY - H * 0.42} L ${W * 0.6} ${baseY - H * 0.42} L ${W * 0.88} ${baseY} Z" fill="#3f2222"/>`
                + `<path d="M ${W * 0.4} ${baseY - H * 0.42} L ${W * 0.6} ${baseY - H * 0.42} L ${W * 0.56} ${baseY - H * 0.36} L ${W * 0.44} ${baseY - H * 0.36} Z" fill="#ffb15c"/>`
                + `<path d="M ${W * 0.47} ${baseY - H * 0.42} C ${W * 0.44} ${baseY - H * 0.26}, ${W * 0.38} ${baseY - H * 0.14}, ${W * 0.33} ${baseY} L ${W * 0.43} ${baseY} C ${W * 0.46} ${baseY - H * 0.16}, ${W * 0.5} ${baseY - H * 0.3}, ${W * 0.52} ${baseY - H * 0.42} Z" fill="#f4713f"/>`
                + rect(0, baseY, W, H - baseY, 'url(#vcRock)')
                + times(5, (i, a, b) => ell((a * W).toFixed(0), (baseY + 16 + b * (H - baseY) * 0.7).toFixed(0), (30 + b * 60).toFixed(0), (8 + b * 10).toFixed(0), '#f4713f', 'opacity="0.85"'))
                + times(14, (i, a, b, c) => disc((a * W).toFixed(0), (b * baseY).toFixed(0), (2 + c * 4).toFixed(1), '#ffd166', `opacity="${(0.4 + c * 0.5).toFixed(2)}"`))
            );
        },

        // 浮空島嶼：漂浮的草地島與瀑布
        floatingIsland(mode) {
            const { W, H } = canvasOf(mode);
            const island = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<path d="M -110 0 L 110 0 L 62 54 L 16 96 L -34 60 Z" fill="#8a6a4a"/>`
                + ell(0, 0, 112, 26, '#5fae5f') + ell(0, -6, 112, 24, '#7ed07a')
                + `</g>`;
            return svgOf(W, H,
                vg('fiSky', [[0, '#69c8f5'], [55, '#a9e0fa'], [100, '#e2f6ff']]) + vg('fiFall', [[0, '#bfeaff', 0.9], [100, '#bfeaff', 0]]),
                bg(W, H, 'url(#fiSky)')
                + times(4, (i, a) => cloud(a * W, H * (0.1 + i * 0.16), 0.7 + rnd(i, 4) * 0.5, '#ffffff', 0.85))
                + island(W * 0.5, H * 0.56, mode === 'wide' ? 1.05 : 1.25)
                + tree(W * 0.46, H * 0.55, 0.5, '#4f9f5c', '#7a4a2a', '#7ed07a')
                + `<path d="M ${W * 0.52} ${H * 0.57} L ${W * 0.56} ${H * 0.57} L ${W * 0.57} ${H} L ${W * 0.51} ${H} Z" fill="url(#fiFall)"/>`
                + island(W * 0.18, H * 0.3, 0.5) + island(W * 0.84, H * 0.36, 0.42)
                + times(3, (i, a) => `<path d="M ${a * W} ${H * 0.82} q 20 -10 40 0" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.6"/>`)
            );
        },

        // 亞特蘭提斯：沉沒的神殿與水下光束
        underwaterTemple(mode) {
            const { W, H } = canvasOf(mode), baseY = H * 0.82;
            return svgOf(W, H,
                vg('utSea', [[0, '#3fc4d9'], [50, '#1f7fa8'], [100, '#0a3a5c']]) + vg('utRay', [[0, '#d6f7ff', 0.4], [100, '#d6f7ff', 0]]) + vg('utFloor', [[0, '#4a8fa8'], [100, '#123f59']]),
                bg(W, H, 'url(#utSea)') + rays(W, H, W * 0.5, -H * 0.04, 5, 'url(#utRay)')
                + rect(0, baseY, W, H - baseY, 'url(#utFloor)')
                + column(W * 0.2, baseY, H * 0.42, W * 0.05, '#bfe0e8', '#9fc8d4')
                + column(W * 0.34, baseY, H * 0.3, W * 0.045, '#a9cfd9', '#8fb8c4')
                + column(W * 0.66, baseY, H * 0.46, W * 0.05, '#bfe0e8', '#9fc8d4')
                + column(W * 0.8, baseY, H * 0.24, W * 0.042, '#a9cfd9', '#8fb8c4')
                + `<path d="M ${W * 0.14} ${baseY - H * 0.46} L ${W * 0.5} ${baseY - H * 0.58} L ${W * 0.86} ${baseY - H * 0.46} L ${W * 0.86} ${baseY - H * 0.4} L ${W * 0.14} ${baseY - H * 0.4} Z" fill="#cfe8ee"/>`
                + times(3, (i, a, b) => `<g transform="translate(${(a * W).toFixed(0)},${(H * 0.3 + b * H * 0.4).toFixed(0)}) scale(0.8)" fill="#ffd166"><path d="M 0 0 C 16 -14, 44 -14, 58 0 C 44 14, 16 14, 0 0 Z"/><path d="M 58 0 L 76 -14 L 76 14 Z"/></g>`)
                + bubbles(W, H, 14, '#d6f7ff')
            );
        },

        // 數位母體：落下的綠色字碼與網格
        cyberMatrix(mode) {
            const { W, H } = canvasOf(mode);
            let cols = '';
            const n = Math.ceil(W / 46);
            for (let i = 0; i < n; i++) {
                const x = i * 46 + 12, len = 3 + Math.floor(rnd(i, 3) * 7), y0 = rnd(i, 6) * H * 0.6;
                for (let j = 0; j < len; j++) cols += rect(x, y0 + j * 34, 16, 22, j === len - 1 ? '#d6ffe4' : '#22c55e', `rx="3" opacity="${(0.25 + j / len * 0.7).toFixed(2)}"`);
            }
            let grid = '';
            for (let i = 0; i <= 10; i++) grid += `<path d="M 0 ${H * 0.72 + Math.pow(i / 10, 2) * H * 0.3} L ${W} ${H * 0.72 + Math.pow(i / 10, 2) * H * 0.3}" stroke="#16a34a" stroke-width="2" opacity="0.5"/>`;
            return svgOf(W, H,
                vg('cmBg', [[0, '#020c07'], [60, '#052e16'], [100, '#0a4023']]) + glowDef('cmGlow', '#22c55e'),
                bg(W, H, 'url(#cmBg)') + disc(W * 0.5, H * 0.45, H * 0.4, 'url(#cmGlow)') + cols + grid
            );
        },

        // 雲端神域：金色雲海、光柱與神殿階梯
        celestialRealm(mode) {
            const { W, H } = canvasOf(mode), baseY = H * 0.74;
            return svgOf(W, H,
                vg('crSky', [[0, '#7fd4f5'], [45, '#ffeab8'], [100, '#fff6e0']]) + glowDef('crGlow', '#fff3c4') + vg('crRay', [[0, '#fff6d0', 0.5], [100, '#fff6d0', 0]]),
                bg(W, H, 'url(#crSky)') + glow(W * 0.5, H * 0.2, H * 0.1, 'crGlow', '#fff8dc')
                + rays(W, H, W * 0.5, H * 0.18, 6, 'url(#crRay)')
                + times(5, (i, a, b) => cloud(a * W, H * (0.12 + b * 0.3), 0.8 + b * 0.6, '#ffffff', 0.9))
                + `<path d="M ${W * 0.2} ${H} L ${W * 0.3} ${baseY} L ${W * 0.7} ${baseY} L ${W * 0.8} ${H} Z" fill="#fff1d0"/>`
                + times(4, (i) => rect(W * (0.26 - i * 0.02), baseY + i * (H - baseY) / 4, W * (0.48 + i * 0.04), (H - baseY) / 4 - 4, '#ffe8b8', 'rx="4"'))
                + column(W * 0.3, baseY, H * 0.34, W * 0.045, '#fff8e8', '#ffe8b8')
                + column(W * 0.7, baseY, H * 0.34, W * 0.045, '#fff8e8', '#ffe8b8')
                + sparkles(W, H * 0.7, 10, '#fff3c4')
            );
        },

        // 夢境仙境：巨大蘑菇、泡泡與粉紫霧氣
        dreamWonderland(mode) {
            const { W, H } = canvasOf(mode), hz = H * 0.66;
            const mushroom = (x, y, s, cap, dot) => `<g transform="translate(${x},${y}) scale(${s})">`
                + `<path d="M -22 0 C -26 -40, -16 -58, 0 -60 C 16 -58, 26 -40, 22 0 Z" fill="#fff1f7"/>`
                + `<path d="M -74 -56 C -74 -104, 74 -104, 74 -56 C 40 -40, -40 -40, -74 -56 Z" fill="${cap}"/>`
                + `<g fill="${dot}"><circle cx="-34" cy="-70" r="12"/><circle cx="8" cy="-80" r="14"/><circle cx="42" cy="-64" r="10"/></g></g>`;
            return svgOf(W, H,
                vg('dwSky', [[0, '#f6c8f0'], [50, '#e2b6f7'], [100, '#c4a8f0']]) + glowDef('dwGlow', '#ffe6ff') + vg('dwG', [[0, '#c98fe0'], [100, '#9a6cc4']]),
                bg(W, H, 'url(#dwSky)') + disc(W * 0.7, H * 0.22, H * 0.2, 'url(#dwGlow)')
                + stars(W, H * 0.6, 28, '#fff1ff')
                + hill(W, H, hz, 20, '#d6a8ea') + hill(W, H, hz + H * 0.1, 22, 'url(#dwG)', 1.4)
                + mushroom(W * 0.22, hz + H * 0.2, mode === 'wide' ? 0.95 : 1.15, '#ff7ab8', '#fff1f7')
                + mushroom(W * 0.78, hz + H * 0.26, mode === 'wide' ? 1.15 : 1.35, '#a78bfa', '#f3e8ff')
                + mushroom(W * 0.52, hz + H * 0.12, 0.6, '#7dd3fc', '#e0f2fe')
                + bubbles(W, H * 0.9, 14, '#ffffff')
            );
        },

        // 皇家宮殿：紅毯、金柱與吊燈
        royalPalace(mode) {
            const { W, H } = canvasOf(mode), floorY = H * 0.62;
            return svgOf(W, H,
                vg('rpWall', [[0, '#7a1f2b'], [55, '#9c2f3a'], [100, '#5e1620']]) + vg('rpFloor', [[0, '#c9a05f'], [100, '#8a6a34']]) + glowDef('rpGlow', '#ffe9a8'),
                bg(W, H, 'url(#rpWall)')
                + rect(0, floorY, W, H - floorY, 'url(#rpFloor)')
                + `<path d="M ${W * 0.36} ${floorY} L ${W * 0.64} ${floorY} L ${W * 0.78} ${H} L ${W * 0.22} ${H} Z" fill="#c02a3a"/>`
                + `<path d="M ${W * 0.38} ${floorY} L ${W * 0.62} ${floorY} L ${W * 0.74} ${H} L ${W * 0.26} ${H} Z" fill="#e2453f"/>`
                + column(W * 0.16, floorY, H * 0.52, W * 0.05, '#f0d9a8', '#e0b95f')
                + column(W * 0.32, floorY, H * 0.5, W * 0.042, '#e8cf9f', '#d9ae57')
                + column(W * 0.68, floorY, H * 0.5, W * 0.042, '#e8cf9f', '#d9ae57')
                + column(W * 0.84, floorY, H * 0.52, W * 0.05, '#f0d9a8', '#e0b95f')
                // 拱窗與吊燈
                + `<path d="M ${W * 0.44} ${floorY - H * 0.16} L ${W * 0.44} ${floorY - H * 0.36} A ${W * 0.06} ${W * 0.06} 0 0 1 ${W * 0.56} ${floorY - H * 0.36} L ${W * 0.56} ${floorY - H * 0.16} Z" fill="#ffe9a8" opacity="0.85"/>`
                + `<g transform="translate(${W * 0.5},${H * 0.06})">${rect(-3, 0, 6, H * 0.1, '#e0b95f')}${disc(0, H * 0.12, H * 0.055, 'url(#rpGlow)')}${disc(0, H * 0.12, H * 0.03, '#ffe9a8')}</g>`
                + sparkles(W, H * 0.5, 8, '#ffe9a8')
            );
        }
            };
        })();

        const bgArt = {
            // 場景庫裡的其餘背景
            ...sceneArt,


            // 溫馨房間：依用途挑版面。
            // 'wide' 給電腦版的寬扁舞台、'portrait' 給手機的直式滿版、
            // 'thumb' 給商店卡片的正方形小縮圖（45px 見方，所以只留最好認的家具）。
            // 三種版面共用同一組家具零件，只是落點與縮放不同。
            cozyRoom(mode) {
                const thumb = mode === 'thumb';
                const portrait = mode === 'portrait';
                const wide = !thumb && !portrait;
                const W = thumb ? 900 : (wide ? 1200 : 640);
                const H = thumb ? 900 : (wide ? 520 : 1040);
                const floorY = thumb ? 470 : (wide ? 318 : 640);

                // 榻榻米：磚砌排列，每列交錯半格
                const matW = thumb ? 300 : (wide ? 300 : 260);
                const matH = thumb ? 190 : 150;
                let floor = '';
                let row = 0;
                for (let y = floorY + 22; y < H + matH; y += matH, row++) {
                    const offset = row % 2 === 0 ? 0 : -matW / 2;
                    for (let x = -matW + offset; x < W + matW; x += matW) {
                        const fill = (row + Math.round(x / matW)) % 2 === 0 ? 'hl' : 'vl';
                        floor += `<rect x="${x}" y="${y}" width="${matW}" height="${matH}" fill="url(#${fill})"/>`;
                    }
                }

                // 窗戶
                const win = thumb
                    ? { x: 96, y: 74, w: 260, h: 230 }
                    : (wide
                        ? { x: 96, y: 46, w: 250, h: 208 }
                        : { x: 92, y: 132, w: 262, h: 280 });

                if (thumb) {
                    // 縮圖只留窗戶、沙發、地毯、茶几與盆栽，縮到 45px 還認得出是房間
                    const furniture = placePart(roomParts.rug, 470, 596, 1.25)
                        + placePart(roomParts.plant, 762, 502, 0.95)
                        + placePart(roomParts.sofa, 470, 500, 1.2)
                        + placePart(roomParts.table, 470, 628, 1);
                    return wrapRoomSvg(W, H, floorY, floor, win, furniture);
                }

                const furniture = wide
                    ? placePart(roomParts.rug, 620, 392, 0.8)
                    + placePart(roomParts.plant, 392, 352, 0.7)
                    + placePart(roomParts.sofa, 620, 350, 0.78)
                    + placePart(roomParts.armchair, 886, 350, 0.74)
                    + placePart(roomParts.lamp, 1062, 350, 0.72)
                    + placePart(roomParts.table, 620, 404, 0.62)
                    : placePart(roomParts.rug, 330, 754, 0.88)
                    + placePart(roomParts.lamp, 140, 668, 0.6)
                    + placePart(roomParts.plant, 506, 672, 0.6)
                    + placePart(roomParts.sofa, 330, 672, 0.85)
                    + placePart(roomParts.table, 330, 772, 0.7)
                    // 這張椅子擺在前景，尺寸要比後排家具大才有遠近感
                    + placePart(roomParts.armchair, 214, 948, 0.95);

                return wrapRoomSvg(W, H, floorY, floor, win, furniture);
            },

            // 陽光公園：藍天白雲、遠景樹林與住宅，沙地上擺著溜滑梯、盪鞦韆與攀爬架
            sunnyPark(mode) {
                const thumb = mode === 'thumb';
                const portrait = mode === 'portrait';
                const wide = !thumb && !portrait;

                const W = thumb ? 900 : (wide ? 1200 : 640);
                const H = thumb ? 900 : (wide ? 520 : 1040);
                const skyY = thumb ? 430 : (wide ? 250 : 470);   // 地平線
                const sandY = thumb ? 620 : (wide ? 360 : 700);  // 沙地中心高度

                const sun = thumb
                    ? placePart(parkParts.sun, 690, 150, 1)
                    : (wide ? placePart(parkParts.sun, 980, 96, 1) : placePart(parkParts.sun, 470, 150, 1));

                const clouds = wide
                    ? placePart(parkParts.cloud, 210, 96, 1) + placePart(parkParts.cloud, 560, 62, 0.8) + placePart(parkParts.cloud, 830, 150, 0.62)
                    : (portrait
                        ? placePart(parkParts.cloud, 170, 120, 0.92) + placePart(parkParts.cloud, 430, 260, 0.7) + placePart(parkParts.cloud, 110, 330, 0.55)
                        : placePart(parkParts.cloud, 230, 130, 0.95) + placePart(parkParts.cloud, 620, 300, 0.62));

                // 遠處住宅：屋頂剛好從樹林上緣露出來
                const skyline = wide
                    ? placePart(parkParts.house, 150, skyY + 2, 0.76) + placePart(parkParts.house, 370, skyY, 0.62) + placePart(parkParts.house, 1010, skyY + 2, 0.7)
                    : (portrait
                        ? placePart(parkParts.house, 120, skyY + 2, 0.7) + placePart(parkParts.house, 500, skyY, 0.6)
                        : placePart(parkParts.house, 180, skyY + 2, 0.66) + placePart(parkParts.house, 700, skyY, 0.58));

                const sand = wide
                    ? `<ellipse cx="640" cy="${sandY + 40}" rx="470" ry="118" fill="#f0dcae" stroke="#d9bd86" stroke-width="6"/>`
                    : (portrait
                        ? `<ellipse cx="330" cy="${sandY + 60}" rx="330" ry="186" fill="#f0dcae" stroke="#d9bd86" stroke-width="6"/>`
                        : `<ellipse cx="450" cy="${sandY + 50}" rx="400" ry="170" fill="#f0dcae" stroke="#d9bd86" stroke-width="6"/>`);

                const equipment = wide
                    ? placePart(parkParts.tree, 176, skyY + 64, 0.86)
                    + placePart(parkParts.tree, 1064, skyY + 72, 0.94)
                    + placePart(parkParts.swingSet, 372, sandY + 34, 0.82)
                    + placePart(parkParts.climbFrame, 560, sandY + 58, 0.7)
                    + placePart(parkParts.slideTower, 790, sandY + 74, 0.86)
                    + placePart(parkParts.bench, 1004, sandY + 96, 0.9)
                    : (portrait
                        ? placePart(parkParts.tree, 96, skyY + 80, 0.8)
                        + placePart(parkParts.tree, 560, skyY + 90, 0.86)
                        + placePart(parkParts.swingSet, 170, sandY + 16, 0.72)
                        + placePart(parkParts.slideTower, 380, sandY + 66, 0.84)
                        + placePart(parkParts.climbFrame, 196, sandY + 150, 0.72)
                        + placePart(parkParts.bench, 470, sandY + 178, 0.9)
                        : placePart(parkParts.tree, 150, skyY + 80, 0.92)
                        + placePart(parkParts.tree, 790, skyY + 96, 0.84)
                        + placePart(parkParts.swingSet, 250, sandY + 40, 0.82)
                        + placePart(parkParts.slideTower, 560, sandY + 70, 0.96));

                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="parkSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3fb0ef"/>
      <stop offset="55%" stop-color="#8ed3f7"/>
      <stop offset="100%" stop-color="#d8f0fb"/>
    </linearGradient>
    <radialGradient id="sunGlow">
      <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#fde68a" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="parkLawn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8ed977"/>
      <stop offset="100%" stop-color="#4fae53"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${skyY + 4}" fill="url(#parkSky)"/>
  ${sun}
  ${clouds}
  ${parkTreeLine(W, skyY, 'far')}
  ${skyline}
  ${parkTreeLine(W, skyY, 'near')}

  <rect y="${skyY}" width="${W}" height="${H - skyY}" fill="url(#parkLawn)"/>
  <path d="M 0 ${skyY + 2} L ${W} ${skyY + 2}" stroke="#6bbf62" stroke-width="10"/>
  ${parkLawnDetails(W, H, skyY)}
  ${sand}
  ${equipment}
</svg>`;
            },

            // 迷霧森林：正中央透下來的逆光、三層樹幹、地面霧氣與光斑
            mistyForest(mode) {
                const thumb = mode === 'thumb';
                const portrait = mode === 'portrait';
                const wide = !thumb && !portrait;

                const W = thumb ? 900 : (wide ? 1200 : 640);
                const H = thumb ? 900 : (wide ? 520 : 1040);
                const groundY = thumb ? 660 : (wide ? 392 : 790);
                const lightX = W / 2;
                const lightY = thumb ? 300 : (wide ? 170 : 380);

                // 光束：從光源往下散開的細長梯形
                let rays = '';
                const rayCount = 7;
                for (let i = 0; i < rayCount; i++) {
                    const spread = (i - (rayCount - 1) / 2) / ((rayCount - 1) / 2);
                    const baseX = lightX + spread * W * 0.62;
                    const width = 26 + (i % 3) * 16;
                    rays += `<polygon points="${lightX - 16},${lightY} ${lightX + 16},${lightY} ${baseX + width},${groundY + 40} ${baseX - width},${groundY + 40}" fill="url(#forestRay)"/>`;
                }

                // 地面上的光斑
                let dapples = '';
                for (let i = 0; i < 10; i++) {
                    const x = ((i * 211) % (W - 60)) + 30;
                    const y = groundY + 22 + ((i * 47) % Math.max(30, (H - groundY) * 0.7));
                    const rx = 26 + (i % 4) * 14;
                    dapples += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.32}" fill="#eaffc4" opacity="${0.22 + (i % 3) * 0.1}"/>`;
                }

                // 空氣中的光點（逆光的粉塵感）
                let motes = '<g fill="#f7ffd9">';
                for (let i = 0; i < 18; i++) {
                    const x = lightX + (((i * 173) % 100) - 50) / 50 * W * 0.44;
                    const y = lightY - 60 + ((i * 97) % Math.max(80, groundY - lightY + 120));
                    const r = 2.5 + (i % 4) * 1.8;
                    motes += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" opacity="${(0.3 + (i % 3) * 0.16).toFixed(2)}"/>`;
                }
                motes += '</g>';

                const mist = `<g fill="#ffffff">
    <ellipse cx="${W * 0.3}" cy="${groundY - 26}" rx="${W * 0.36}" ry="34" opacity="0.3"/>
    <ellipse cx="${W * 0.72}" cy="${groundY - 8}" rx="${W * 0.34}" ry="30" opacity="0.26"/>
    <ellipse cx="${W * 0.5}" cy="${groundY + 30}" rx="${W * 0.44}" ry="30" opacity="0.2"/>
  </g>`;

                const undergrowth = wide
                    ? placePart(forestParts.bush, 130, groundY + 66, 1) + placePart(forestParts.fern, 340, groundY + 84, 1) + placePart(forestParts.bush, 900, groundY + 74, 1.15) + placePart(forestParts.fern, 1080, groundY + 60, 0.9)
                    : (portrait
                        ? placePart(forestParts.bush, 120, groundY + 90, 1.05) + placePart(forestParts.fern, 330, groundY + 140, 1.1) + placePart(forestParts.bush, 540, groundY + 70, 1) + placePart(forestParts.fern, 90, groundY + 200, 0.9)
                        : placePart(forestParts.bush, 170, groundY + 80, 1.1) + placePart(forestParts.fern, 470, groundY + 120, 1.1) + placePart(forestParts.bush, 730, groundY + 70, 1));

                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="forestLight" cx="50%" cy="${(lightY / H * 100).toFixed(0)}%" r="72%">
      <stop offset="0%" stop-color="#f7ffd9"/>
      <stop offset="28%" stop-color="#cdeb9c"/>
      <stop offset="62%" stop-color="#5aa46a"/>
      <stop offset="100%" stop-color="#1d4430"/>
    </radialGradient>
    <linearGradient id="forestRay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4ffd6" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#f4ffd6" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="forestFloor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3f7d53"/>
      <stop offset="100%" stop-color="#1c3f2b"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#forestLight)"/>
  ${forestTrunkRow(W, groundY, 'far')}
  ${rays}
  ${forestTrunkRow(W, groundY, 'mid')}
  ${forestCanopy(W, lightX)}

  <path d="M 0 ${groundY + 14} C ${W * 0.2} ${groundY - 12}, ${W * 0.36} ${groundY + 18}, ${W * 0.54} ${groundY + 4} C ${W * 0.72} ${groundY - 10}, ${W * 0.88} ${groundY + 16}, ${W} ${groundY + 2} L ${W} ${H} L 0 ${H} Z" fill="url(#forestFloor)"/>
  ${dapples}
  ${mist}
  ${forestTrunkRow(W, groundY, 'near')}
  ${undergrowth}
  ${motes}
</svg>`;
            }
        };

        // 把 SVG 原始碼包成可以直接餵給 CSS background 的字串。
        // fit 用 cover 會填滿並裁掉超出的部分，用 contain 則是完整顯示、周圍留白。
        const toBgUrl = (svg, fit = 'cover') => `url("data:image/svg+xml,${encodeURIComponent(svg)}") center center / ${fit} no-repeat`;

        // 🖼️ 【插畫型背景的共用設定】新畫好的背景只要在 bgArt 裡加一筆，
        //     然後在 bgData 寫 `...illustratedBg('該筆的名字')`，就會自動具備：
        //       1. 舞台背景依比例挑版面（函式型的 bgArt 會收到 'wide' / 'portrait'）
        //       2. 商店卡片的小方塊顯示整個背景的縮小畫面（函式型會收到 'thumb'）
        //     bgArt 也可以直接放固定的 SVG 字串，此時縮圖會完整縮放顯示不裁切。
        //     產生好的字串會快取起來，商店一次要畫 30 幾張縮圖才不會重複編碼同一張圖。
        const bgUrlCache = {};
        const illustratedBg = (artKey) => {
            const build = (mode, fit) => {
                const cacheKey = `${artKey}:${mode}:${fit}`;
                if (!bgUrlCache[cacheKey]) {
                    const art = bgArt[artKey];
                    bgUrlCache[cacheKey] = typeof art === 'function'
                        ? toBgUrl(art(mode), fit)
                        : `#fffbeb ${toBgUrl(art, fit)}`;
                }
                return bgUrlCache[cacheKey];
            };
            return {
                preview: () => build('thumb', typeof bgArt[artKey] === 'function' ? 'cover' : 'contain'),
                style: (mode) => build(mode, 'cover'),
                hasDots: false
            };
        };

       const bgData = {
            // 🌟 01 ~ 04：基礎入門系列（純白、暖黃、青綠、粉薄荷）
            // 免費的自選純色：顏色由玩家自己挑，存在 gameState.customBgColor
            none: { name: {zh: '自選純色', en: 'Custom Color'}, cost: 0, preview: () => gameState.customBgColor, style: () => gameState.customBgColor, hasDots: false },
            cozy_room: { name: {zh: '溫馨房間', en: 'Cozy Room'}, cost: 100, ...illustratedBg('cozyRoom') },
            sunshine_grassland: { name: {zh: '陽光草原', en: 'Sunshine Grassland'}, cost: 150, ...illustratedBg('sunshineGrassland') },
            sunny_park: { name: {zh: '陽光公園', en: 'Sunny Park'}, cost: 200, ...illustratedBg('sunnyPark') },

            // 🌟 05 ~ 10：自然與日常系列（森林綠、天空藍、杏桃橘、櫻花粉、竹林翠、陰雨灰）
            misty_forest: { name: {zh: '迷霧森林', en: 'Misty Forest'}, cost: 250, ...illustratedBg('mistyForest') },
            breeze_morning: { name: {zh: '碧紗庭院', en: 'Emerald Veil Court'}, cost: 300, ...illustratedBg('breezeMorning') },
            afternoon_tea: { name: {zh: '午後茶會', en: 'Afternoon Tea'}, cost: 350, ...illustratedBg('afternoonTea') },
            cherry_park: { name: {zh: '櫻花小徑', en: 'Cherry Park'}, cost: 400, ...illustratedBg('cherryPark') },
            bamboo_grove: { name: {zh: '翠綠竹林', en: 'Bamboo Grove'}, cost: 300, ...illustratedBg('bambooGrove') },
            rainy_street: { name: {zh: '雨中街景', en: 'Rainy Street'}, cost: 500, ...illustratedBg('rainyStreet') },

            // 🌟 11 ~ 15：風景與探險系列（晚霞橘、楓葉紅、深海藍、雪山白、星夜藍）
            sunset_beach: { name: {zh: '夕陽海灘', en: 'Sunset Beach'}, cost: 550, ...illustratedBg('sunsetBeach') },
            autumn_leaves: { name: {zh: '秋日楓紅', en: 'Autumn Leaves'}, cost: 600, ...illustratedBg('autumnLeaves') },
            deep_sea: { name: {zh: '深海秘境', en: 'Deep Ocean'}, cost: 650, ...illustratedBg('deepSea') },
            snowy_mountain: { name: {zh: '銀白雪山', en: 'Snow Mountain'}, cost: 700, ...illustratedBg('snowyMountain') },
            starry_night: { name: {zh: '璀璨星空', en: 'Starry Night'}, cost: 800, ...illustratedBg('starryNight') },

            // 🌟 16 ~ 21：奇幻異想系列（糖果粉、魔法紫、薰衣草、極光綠、街機桃紅、霓虹青）
            candy_land: { name: {zh: '糖果王國', en: 'Candy Land'}, cost: 900, ...illustratedBg('candyLand') },
            magic_academy: { name: {zh: '魔法學院', en: 'Magic Academy'}, cost: 950, ...illustratedBg('magicAcademy') },
            lavender_field: { name: {zh: '薰衣草田', en: 'Lavender Field'}, cost: 1000, ...illustratedBg('lavenderField') },
            aurora_sky: { name: {zh: '夢幻極光', en: 'Aurora Sky'}, cost: 1050, ...illustratedBg('auroraSky') },
            retro_arcade: { name: {zh: '復古街機', en: 'Retro Arcade'}, cost: 1100, ...illustratedBg('retroArcade') },
            neon_city: { name: {zh: '賽博霓虹', en: 'Cyber Neon'}, cost: 1200, ...illustratedBg('neonCity') },

            // 🌟 22 ~ 27：宇宙與奇境系列（水晶紫、銀河靛藍、綠洲金黃、遺跡棕、熔岩烈紅、浮島天藍）
            crystal_cave: { name: {zh: '水晶洞穴', en: 'Crystal Cave'}, cost: 1300, ...illustratedBg('crystalCave') },
            galaxy_space: { name: {zh: '浩瀚銀河', en: 'Galaxy Space'}, cost: 1350, ...illustratedBg('galaxySpace') },
            desert_oasis: { name: {zh: '沙漠綠洲', en: 'Desert Oasis'}, cost: 1400, ...illustratedBg('desertOasis') },
            ancient_ruins: { name: {zh: '遠古遺跡', en: 'Ancient Ruins'}, cost: 1450, ...illustratedBg('ancientRuins') },
            volcano_core: { name: {zh: '熔岩火山', en: 'Lava Volcano'}, cost: 1500, ...illustratedBg('volcanoCore') },
            floating_island: { name: {zh: '浮空島嶼', en: 'Floating Island'}, cost: 1600, ...illustratedBg('floatingIsland') },

            // 🌟 28 ~ 32：頂級殿堂系列（海神藍、母體翠綠、神域暖黃、仙境洋紅、皇家金）
            underwater_temple: { name: {zh: '亞特蘭提斯', en: 'Atlantis'}, cost: 1700, ...illustratedBg('underwaterTemple') },
            cyber_matrix: { name: {zh: '數位母體', en: 'Digital Matrix'}, cost: 1800, ...illustratedBg('cyberMatrix') },
            celestial_realm: { name: {zh: '雲端神域', en: 'Celestial Realm'}, cost: 1900, ...illustratedBg('celestialRealm') },
            dream_wonderland: { name: {zh: '夢境仙境', en: 'Dreamland'}, cost: 2000, ...illustratedBg('dreamWonderland') },
            royal_palace: { name: {zh: '皇家宮殿', en: 'Royal Palace'}, cost: 2100, ...illustratedBg('royalPalace') }
        };

        const svgLib = {
            // 🌟 鮮嫩可口的翠綠海藻
            algae: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <linearGradient id="algaeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#86efac"/>
                        <stop offset="50%" stop-color="#22c55e"/>
                        <stop offset="100%" stop-color="#14532d"/>
                    </linearGradient>
                </defs>
                <path d="M 50 90 Q 30 65 38 45 Q 45 25 28 8 Q 42 22 48 42 Q 52 65 50 90 Z" fill="url(#algaeGrad)" stroke="#14532d" stroke-width="2"/>
                <path d="M 50 92 Q 40 55 58 35 Q 70 18 52 2 Q 68 20 54 48 Q 42 70 50 92 Z" fill="url(#algaeGrad)" stroke="#14532d" stroke-width="2"/>
                <path d="M 50 90 Q 68 70 65 50 Q 62 30 78 12 Q 68 28 60 48 Q 55 72 50 90 Z" fill="url(#algaeGrad)" stroke="#14532d" stroke-width="2"/>
                <circle cx="35" cy="20" r="2.5" fill="#ffffff" opacity="0.8"/>
                <circle cx="62" cy="15" r="2" fill="#ffffff" opacity="0.8"/>
            </svg>`,
            tomato: `<svg viewBox="0 0 200 200"><defs><radialGradient id="coreGlow" cx="50%" cy="55%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="1"/><stop offset="20%" stop-color="#fef08a" stop-opacity="0.8"/><stop offset="60%" stop-color="#ef4444" stop-opacity="0.9"/><stop offset="100%" stop-color="#991b1b" stop-opacity="0"/></radialGradient><filter id="fireworkGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#fireworkGlow)"><circle cx="100" cy="120" r="75" fill="url(#coreGlow)"/><circle cx="100" cy="120" r="75" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="1, 8" stroke-linecap="round"/><circle cx="100" cy="120" r="68" fill="none" stroke="#fca5a5" stroke-width="2" stroke-dasharray="1, 6" stroke-linecap="round"/><circle cx="100" cy="120" r="60" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="1, 7" stroke-linecap="round"/><circle cx="100" cy="120" r="50" fill="none" stroke="#f87171" stroke-width="2" stroke-dasharray="1, 5" stroke-linecap="round"/><circle cx="100" cy="120" r="40" fill="none" stroke="#fef08a" stroke-width="2" stroke-dasharray="1, 6" stroke-linecap="round"/><circle cx="100" cy="120" r="30" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="1, 4" stroke-linecap="round"/><circle cx="100" cy="120" r="20" fill="none" stroke="#fef08a" stroke-width="2" stroke-dasharray="1, 5" stroke-linecap="round"/><circle cx="100" cy="120" r="10" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="1, 3" stroke-linecap="round"/><path d="M 100 120 L 100 45 M 100 120 L 100 195 M 100 120 L 25 120 M 100 120 L 175 120 M 100 120 L 47 67 M 100 120 L 153 67 M 100 120 L 47 173 M 100 120 L 153 173 M 100 120 L 70 50 M 100 120 L 130 50 M 100 120 L 70 190 M 100 120 L 130 190 M 100 120 L 30 90 M 100 120 L 170 90 M 100 120 L 30 150 M 100 120 L 170 150" stroke="#ef4444" stroke-width="2" stroke-dasharray="1, 8" stroke-linecap="round"/><path d="M 100 120 L 60 50 M 100 120 L 140 50 M 100 120 L 50 160 M 100 120 L 150 160" stroke="#fca5a5" stroke-width="1.5" stroke-dasharray="1, 6" stroke-linecap="round"/><g fill="none" stroke-linecap="round"><g stroke="#22c55e" stroke-width="6" stroke-dasharray="1, 6"><path d="M 100 80 Q 105 40 120 15"/><path d="M 100 80 Q 50 80 30 100"/><path d="M 100 80 Q 70 65 45 45"/><path d="M 100 80 Q 85 50 75 30"/><path d="M 100 80 Q 130 65 160 45"/><path d="M 100 80 Q 140 80 170 100"/><path d="M 100 80 Q 80 100 65 125"/><path d="M 100 80 Q 120 100 135 125"/></g><g stroke="#4ade80" stroke-width="3" stroke-dasharray="1, 5"><path d="M 100 80 Q 105 40 120 15"/><path d="M 100 80 Q 50 80 30 100"/><path d="M 100 80 Q 70 65 45 45"/><path d="M 100 80 Q 85 50 75 30"/><path d="M 100 80 Q 130 65 160 45"/><path d="M 100 80 Q 140 80 170 100"/><path d="M 100 80 Q 80 100 65 125"/><path d="M 100 80 Q 120 100 135 125"/></g><g stroke="#fef08a" stroke-width="1.5" stroke-dasharray="1, 4"><path d="M 100 80 Q 105 40 120 15"/><path d="M 100 80 Q 50 80 30 100"/><path d="M 100 80 Q 70 65 45 45"/><path d="M 100 80 Q 85 50 75 30"/><path d="M 100 80 Q 130 65 160 45"/><path d="M 100 80 Q 140 80 170 100"/><path d="M 100 80 Q 80 100 65 125"/><path d="M 100 80 Q 120 100 135 125"/></g><ellipse cx="122" cy="13" rx="6" ry="3" stroke="#4ade80" stroke-width="2" stroke-dasharray="1, 3" transform="rotate(-25 122 13)"/><ellipse cx="122" cy="13" rx="6" ry="3" stroke="#fef08a" stroke-width="1" stroke-dasharray="1, 2" transform="rotate(-25 122 13)"/></g></g></svg>`,
            boba: `<svg viewBox="0 0 100 100"><path d="M30 30 L35 85 Q50 95 65 85 L70 30 Z" fill="#fed7aa"/><rect x="25" y="20" width="50" height="10" rx="3" fill="#f8fafc"/><rect x="45" y="5" width="10" height="85" fill="#38bdf8"/><circle cx="45" cy="75" r="5" fill="#292524"/><circle cx="55" cy="70" r="5" fill="#292524"/><circle cx="40" cy="65" r="5" fill="#292524"/><circle cx="60" cy="80" r="5" fill="#292524"/></svg>`,
            
            pizza: `<svg viewBox="0 0 100 100"><polygon points="50 90, 15 25, 85 25" fill="#fde047"/><path d="M10 25 Q50 5 90 25 L85 30 Q50 15 15 30 Z" fill="#d97706"/><circle cx="40" cy="40" r="6" fill="#ef4444"/><circle cx="60" cy="50" r="6" fill="#ef4444"/><circle cx="45" cy="65" r="6" fill="#ef4444"/></svg>`,
           
           
            cookie: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="#d97706"/><circle cx="35" cy="40" r="4" fill="#451a03"/><circle cx="65" cy="45" r="5" fill="#451a03"/><circle cx="50" cy="65" r="4" fill="#451a03"/><circle cx="45" cy="25" r="3" fill="#451a03"/><circle cx="70" cy="60" r="3" fill="#451a03"/></svg>`,
            ghost: `<svg viewBox="0 0 100 100"><path d="M25 50 C25 15 75 15 75 50 L75 90 L62.5 80 L50 90 L37.5 80 L25 90 Z" fill="#f8fafc"/><circle cx="40" cy="45" r="5" fill="#0f172a"/><circle cx="60" cy="45" r="5" fill="#0f172a"/><ellipse cx="50" cy="55" rx="4" ry="6" fill="#0f172a"/></svg>`,
// 🌟 1. 原版大姊：經典白鴨＋頭戴小粉花＋懷抱大花花＋粉嫩腮紅
            duck: `<svg viewBox="0 0 200 200" style="width:100%; height:100%; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.12));">
    <g stroke="#18181b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <g class="duck-vibe-lines">
            <path d="M 20 148 C 12 154 14 162 18 168" stroke-width="4"/>
            <path d="M 28 156 C 24 161 26 166 30 170" stroke-width="3"/>
            <path d="M 180 144 C 188 150 188 158 182 166" stroke-width="4"/>
            <path d="M 174 152 C 178 157 178 162 174 166" stroke-width="3"/>
        </g>
        <g class="duck-foot-left"><path d="M 44 166 L 68 158 L 65 184 L 46 182 Z" fill="#f97316" stroke="#c2410c" stroke-width="4"/></g>
        <g class="duck-foot-right"><g transform="translate(48, 0)"><path d="M 48 166 L 72 158 L 69 184 L 50 182 Z" fill="#f97316" stroke="#c2410c" stroke-width="4"/></g></g>
        <path d="M 64 80 C 52 92 42 116 40 138 C 38 162 60 178 98 178 C 140 178 168 162 166 138 C 164 128 156 128 164 120 C 146 124 130 110 124 92 C 118 72 98 64 78 68 C 68 72 64 76 64 80 Z" fill="#ffffff" stroke-width="4.8"/>
        <path d="M 64 82 C 48 80 40 88 44 96 C 50 102 64 102 72 93 C 75 88 72 84 64 82 Z" fill="#f97316" stroke="#c2410c" stroke-width="4"/>
        <circle cx="86" cy="80" r="3.5" fill="#18181b" stroke="none"/>
        <!-- 🌟 害羞小腮紅 -->
        <ellipse cx="88" cy="89" rx="7" ry="4.5" fill="#fca5a5" opacity="0.85" stroke="none" transform="rotate(-5 88 89)"/>
        <!-- 🌟 貼緊頭頂的小粉花 -->
        <g transform="translate(104, 69)">
            <circle cx="-5" cy="0" r="4.5" fill="#fbcfe8" stroke="#f43f5e" stroke-width="2"/>
            <circle cx="5" cy="0" r="4.5" fill="#fbcfe8" stroke="#f43f5e" stroke-width="2"/>
            <circle cx="0" cy="-5" r="4.5" fill="#fbcfe8" stroke="#f43f5e" stroke-width="2"/>
            <circle cx="0" cy="5" r="4.5" fill="#fbcfe8" stroke="#f43f5e" stroke-width="2"/>
            <circle cx="0" cy="0" r="3.5" fill="#fde047" stroke="#ca8a04" stroke-width="1.8"/>
        </g>
        <path d="M 96 138 Q 72 124 38 112" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
        <path d="M 62 126 Q 52 114 64 118 Z" fill="#4ade80" stroke="#15803d" stroke-width="2.5"/>
        <g transform="translate(28, 106)">
            <circle cx="-10" cy="0" r="9" fill="#fda4af" stroke="#e11d48" stroke-width="3"/>
            <circle cx="10" cy="0" r="9" fill="#fda4af" stroke="#e11d48" stroke-width="3"/>
            <circle cx="0" cy="-10" r="9" fill="#fda4af" stroke="#e11d48" stroke-width="3"/>
            <circle cx="0" cy="10" r="9" fill="#fda4af" stroke="#e11d48" stroke-width="3"/>
            <circle cx="-7" cy="-7" r="8" fill="#fda4af" stroke="#e11d48" stroke-width="2.5"/>
            <circle cx="7" cy="-7" r="8" fill="#fda4af" stroke="#e11d48" stroke-width="2.5"/>
            <circle cx="-7" cy="7" r="8" fill="#fda4af" stroke="#e11d48" stroke-width="2.5"/>
            <circle cx="7" cy="7" r="8" fill="#fda4af" stroke="#e11d48" stroke-width="2.5"/>
            <circle cx="0" cy="0" r="7.5" fill="#fde047" stroke="#ca8a04" stroke-width="2.5"/>
        </g>
        <path d="M 108 126 C 98 136 86 142 76 136 C 70 132 74 122 84 122 C 96 122 104 120 108 126 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.2"/>
    </g>
</svg>`,

            // 🌟 2. 二妹：暖黃色身軀＋日系編織草帽＋手拿清爽小荷葉
            duck_hat: `<svg viewBox="0 0 200 200" style="width:100%; height:100%; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.12));">
    <g stroke="#18181b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <g class="duck-vibe-lines">
            <path d="M 20 148 C 12 154 14 162 18 168" stroke-width="4"/>
            <path d="M 180 144 C 188 150 188 158 182 166" stroke-width="4"/>
        </g>
        <g class="duck-foot-left"><path d="M 44 166 L 68 158 L 65 184 L 46 182 Z" fill="#ea580c" stroke="#9a3412" stroke-width="4"/></g>
        <g class="duck-foot-right"><g transform="translate(48, 0)"><path d="M 48 166 L 72 158 L 69 184 L 50 182 Z" fill="#ea580c" stroke="#9a3412" stroke-width="4"/></g></g>
        <!-- 暖黃色身體 -->
        <path d="M 64 80 C 52 92 42 116 40 138 C 38 162 60 178 98 178 C 140 178 168 162 166 138 C 164 128 156 128 164 120 C 146 124 130 110 124 92 C 118 72 98 64 78 68 C 68 72 64 76 64 80 Z" fill="#fef08a" stroke-width="4.8"/>
        <path d="M 64 82 C 48 80 40 88 44 96 C 50 102 64 102 72 93 C 75 88 72 84 64 82 Z" fill="#f97316" stroke="#c2410c" stroke-width="4"/>
        <!-- 呆萌圓眼與橙橘小腮紅 -->
        <circle cx="86" cy="80" r="3.5" fill="#18181b" stroke="none"/>
        <ellipse cx="88" cy="89" rx="6.5" ry="4" fill="#fb923c" opacity="0.85" stroke="none"/>
        <!-- 👒 頭戴可愛草帽 (含紅色緞帶) -->
        <g transform="translate(85, 52) rotate(-8)">
            <ellipse cx="0" cy="12" rx="34" ry="8" fill="#fde047" stroke="#ca8a04" stroke-width="3.5"/>
            <path d="M -18 10 C -18 -4 18 -4 18 10 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="3.5"/>
            <rect x="-18" y="5" width="36" height="5" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
        </g>
        <!-- 🌿 手拿夏日清爽小荷葉 -->
        <path d="M 100 136 Q 60 115 25 85" stroke="#15803d" stroke-width="4.5" stroke-linecap="round"/>
        <g transform="translate(22, 80) rotate(-15)">
            <ellipse cx="0" cy="0" rx="22" ry="15" fill="#4ade80" stroke="#16a34a" stroke-width="3"/>
            <path d="M 0 0 L 12 -8 M 0 0 L -12 -8 M 0 0 L 14 6 M 0 0 L -14 6" stroke="#15803d" stroke-width="2"/>
            <circle cx="4" cy="-2" r="2.5" fill="#ffffff" opacity="0.8"/>
        </g>
        <path d="M 108 126 C 98 136 86 142 76 136 C 70 132 74 122 84 122 C 96 122 104 120 108 126 Z" fill="#fef08a" stroke="#18181b" stroke-width="4.2"/>
    </g>
</svg>`,

           // 🌟 3. 小弟：粉嫩白鴨＋頭頂插畫風螺旋呆毛（根部別著小愛心）＋手拿愛心魔法棒
            duck_heart: `<svg viewBox="0 0 200 200" style="width:100%; height:100%; filter: drop-shadow(0 6px 10px rgba(0,0,0,0.12));">
    <g stroke="#18181b" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <g class="duck-vibe-lines">
            <path d="M 20 148 C 12 154 14 162 18 168" stroke-width="4"/>
            <path d="M 180 144 C 188 150 188 158 182 166" stroke-width="4"/>
        </g>
        <g class="duck-foot-left"><path d="M 44 166 L 68 158 L 65 184 L 46 182 Z" fill="#f43f5e" stroke="#be123c" stroke-width="4"/></g>
        <g class="duck-foot-right"><g transform="translate(48, 0)"><path d="M 48 166 L 72 158 L 69 184 L 50 182 Z" fill="#f43f5e" stroke="#be123c" stroke-width="4"/></g></g>
        <!-- 珍珠粉白身體 -->
        <path d="M 64 80 C 52 92 42 116 40 138 C 38 162 60 178 98 178 C 140 178 168 162 166 138 C 164 128 156 128 164 120 C 146 124 130 110 124 92 C 118 72 98 64 78 68 C 68 72 64 76 64 80 Z" fill="#fff1f2" stroke-width="4.8"/>
        <path d="M 64 82 C 48 80 40 88 44 96 C 50 102 64 102 72 93 C 75 88 72 84 64 82 Z" fill="#fb7185" stroke="#e11d48" stroke-width="4"/>
        <!-- 眨眼小萌樣與愛心星芒腮紅 -->
        <path d="M 82 82 Q 86 76 90 82" stroke="#18181b" stroke-width="3.5"/>
        <ellipse cx="88" cy="89" rx="6.5" ry="4" fill="#f43f5e" opacity="0.75" stroke="none"/>
    

        <!-- 💖 頭頂與呆毛連線處別著的可愛小愛心髮夾 -->
        <g transform="translate(98, 67) scale(0.55) rotate(-15)">
            <path d="M 0 0 C -12 -14 -22 4 0 20 C 22 4 12 -14 0 0 Z" fill="#f43f5e" stroke="#be123c" stroke-width="3"/>
            <circle cx="-3" cy="4" r="2" fill="#ffffff"/>
        </g>

        <!-- 🪄 手拿亮晶晶愛心魔法棒 -->
        <path d="M 100 136 L 45 75" stroke="#ca8a04" stroke-width="4.5" stroke-linecap="round"/>
        <g transform="translate(42, 70) scale(0.85) rotate(-20)">
            <path d="M 0 0 C -12 -14 -22 4 0 20 C 22 4 12 -14 0 0 Z" fill="#fde047" stroke="#eab308" stroke-width="3"/>
            <circle cx="-3" cy="4" r="2.5" fill="#ffffff"/>
        </g>
        <path d="M 108 126 C 98 136 86 142 76 136 C 70 132 74 122 84 122 C 96 122 104 120 108 126 Z" fill="#fff1f2" stroke="#18181b" stroke-width="4.2"/>
    </g>
</svg>`,
            fish: `<svg viewBox="0 0 100 100"><path d="M70 50 C70 25 30 25 30 50 C30 75 70 75 70 50 Z" fill="#0284c7"/><polygon points="35 50, 10 30, 10 70" fill="#0284c7"/><circle cx="60" cy="45" r="3" fill="#ffffff"/><circle cx="61" cy="45" r="1" fill="#0f172a"/></svg>`,
            
            // 🎵 1. 連音雙八分音符
            music_double: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;"><circle cx="28" cy="72" r="14" fill="currentColor"/><circle cx="72" cy="58" r="14" fill="currentColor"/><rect x="36" y="16" width="7" height="56" fill="currentColor"/><rect x="80" y="2" width="7" height="56" fill="currentColor"/><polygon points="36,16 87,2 87,16 36,30" fill="currentColor"/></svg>`,
            // 🎵 2. 單八分音符
            music_single: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;"><circle cx="32" cy="70" r="15" fill="currentColor"/><rect x="42" y="14" width="7.5" height="56" fill="currentColor"/><path d="M 49.5 14 Q 72 20 70 48 Q 58 34 49.5 32 Z" fill="currentColor"/></svg>`,
            // 🎵 3. 高音譜號
            music_clef: `<svg viewBox="0 0 100 120" style="width:100%; height:100%; overflow:visible;"><path d="M 52 10 C 52 10 46 28 46 45 C 46 62 68 62 68 76 C 68 88 56 96 44 94 C 32 92 26 80 30 70 C 34 60 48 62 48 70 C 48 76 42 78 38 74 C 40 84 56 86 58 76 C 60 64 42 56 42 42 C 42 30 50 18 52 10 Z M 48 8 L 48 106 C 48 114 40 118 34 114 C 28 110 32 102 38 104" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            coffee: `<svg viewBox="0 0 100 100"><path d="M25 35 L25 70 Q25 85 50 85 Q75 85 75 70 L75 35 Z" fill="#f8fafc"/><path d="M75 45 Q90 45 90 60 Q90 70 75 70" fill="none" stroke="#f8fafc" stroke-width="8"/><path d="M40 15 Q45 25 40 30 M60 10 Q65 20 60 25" fill="none" stroke="#d4d4d8" stroke-width="4"/></svg>`,
           tvStatic: `<svg viewBox="0 0 100 100" preserveAspectRatio="none">
    <!-- 移除原本的線條與圓圈，只保留一個滿版的雜訊遮罩 -->
    <rect width="100" height="100" fill="url(#noisePattern)" />
    <defs>
        <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch"/>
        </filter>
        <pattern id="noisePattern" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" filter="url(#noiseFilter)" opacity="0.2"/>
        </pattern>
    </defs>
</svg>`,
            money: `<svg viewBox="0 0 100 100"><rect x="15" y="35" width="70" height="35" fill="#86efac" stroke="#166534" stroke-width="4" rx="2"/><circle cx="50" cy="52.5" r="10" fill="#166534"/><line x1="25" y1="52.5" x2="35" y2="52.5" stroke="#166534" stroke-width="4"/><line x1="65" y1="52.5" x2="75" y2="52.5" stroke="#166534" stroke-width="4"/></svg>`,
            heart: `<svg viewBox="0 0 100 100"><path d="M50 85 C10 50 10 20 30 10 C45 0 50 15 50 15 C50 15 55 0 70 10 C90 20 90 50 50 85Z" fill="#f43f5e"/></svg>`,
            bugFree: `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="20" ry="30" fill="#65a30d"/><line x1="20" y1="20" x2="80" y2="80" stroke="#ef4444" stroke-width="10"/><line x1="80" y1="20" x2="20" y2="80" stroke="#ef4444" stroke-width="10"/></svg>`,
          heartbeat: `<svg viewBox="0 0 100 100">
    <defs>
        <!-- 晶透粉紅漸層與光影 -->
        <radialGradient id="crystalHeartGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
            <stop offset="35%" stop-color="#fbcfe8" stop-opacity="0.4"/>
            <stop offset="75%" stop-color="#f43f5e" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#be123c" stop-opacity="0.7"/>
        </radialGradient>
        <!-- 邊緣彩虹光暈 -->
        <linearGradient id="heartRainbowRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f43f5e"/>
            <stop offset="40%" stop-color="#f472b6"/>
            <stop offset="80%" stop-color="#c084fc"/>
            <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
    </defs>
    <!-- 愛心主體 -->
    <path d="M50 85 C15 55 5 35 15 20 C25 5 45 15 50 25 C55 15 75 5 85 20 C95 35 85 55 50 85 Z" 
          fill="url(#crystalHeartGrad)" stroke="url(#heartRainbowRing)" stroke-width="3" stroke-linejoin="round"/>
    <!-- 立體高光 1 (左上角大反光) -->
    <path d="M22 25 C20 16 32 10 40 15 C35 12 25 15 22 25 Z" fill="rgba(255,255,255,0.95)"/>
    <!-- 立體高光 2 (右肩小反光) -->
    <circle cx="72" cy="22" r="2.5" fill="rgba(255,255,255,0.9)"/>
</svg>`,
            drop: `<svg viewBox="0 0 100 100"><polygon points="48,0 52,0 50,100" fill="rgba(255, 255, 255, 0.3)"/><polygon points="49.5,0 50.5,0 50,80" fill="rgba(255, 255, 255, 0.9)"/></svg>`,
            star: `<svg viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,55 79,85 50,65 21,85 32,55 5,35 39,35" fill="#facc15"/></svg>`,
            sparkle: `<svg viewBox="0 0 100 100"><path d="M50 5 Q50 50 95 50 Q50 50 50 95 Q50 50 5 50 Q50 50 5 50 Z" fill="#fef08a"/></svg>`,
            // 🌟 櫸樹秋葉：雙色漸層與葉脈細節
leaf: `<svg viewBox="0 0 100 100"><g stroke="#7c2d12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 90 L 50 15 M 50 15 C 20 25, 10 50, 25 75 C 35 85, 45 88, 50 90 Z" fill="#ea580c"/><path d="M 50 15 C 80 25, 90 50, 75 75 C 65 85, 55 88, 50 90 Z" fill="#f97316"/><path d="M 50 35 Q 35 45 25 50 M 50 50 Q 30 60 22 68 M 50 65 Q 38 72 32 78"/><path d="M 50 35 Q 65 45 75 50 M 50 50 Q 70 60 78 68 M 50 65 Q 62 72 68 78"/></g></svg>`,

// 🌟 楓葉：經典鋸齒邊緣與鮮紅葉脈
leaf_maple: `<svg viewBox="0 0 100 100"><g fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5" stroke-linejoin="round"><path d="M 50 88 L 50 72 Q 40 70 30 78 L 35 60 Q 20 62 10 52 L 25 42 Q 12 28 22 25 L 38 35 Q 35 18 50 8 Q 65 18 62 35 L 78 25 Q 88 28 75 42 L 90 52 Q 80 62 65 60 L 70 78 Q 60 70 50 72 L 50 88 Z"/><path d="M 50 72 L 50 25 M 50 55 L 28 40 M 50 55 L 72 40 M 50 65 L 20 55 M 50 65 L 80 55" stroke="#7f1d1d" stroke-width="1.5" fill="none"/></g></svg>`,

// 🌟 銀杏葉：金黃扇形葉片與細緻脈紋
leaf_ginkgo: `<svg viewBox="0 0 100 100"><g stroke="#ca8a04" stroke-width="1.5" stroke-linejoin="round"><path d="M 50 90 Q 48 65 50 55 C 20 50, 10 25, 35 15 C 45 10, 48 18, 50 22 C 52 18, 55 10, 65 15 C 90 25, 80 50, 50 55 Q 52 65 50 90 Z" fill="#facc15"/><path d="M 50 55 Q 35 32 25 22 M 50 55 Q 42 30 38 18 M 50 55 Q 50 30 50 18 M 50 55 Q 58 30 62 18 M 50 55 Q 65 32 75 22" fill="none" opacity="0.6"/></g></svg>`,
            // 🌟 1. 夢幻大月亮：帶有立體漸層與銀白色柔焦光暈
moon: `<svg viewBox="0 0 160 160" style="width:100%; height:100%; filter: drop-shadow(0 0 20px rgba(224, 242, 254, 0.8));"><defs><radialGradient id="moonGlow" cx="40%" cy="40%" r="60%"><stop offset="0%" stop-color="#ffffff"/><stop offset="40%" stop-color="#e0f2fe"/><stop offset="80%" stop-color="#bae6fd"/><stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/></radialGradient></defs><circle cx="80" cy="80" r="70" fill="url(#moonGlow)"/><circle cx="65" cy="55" r="14" fill="rgba(186, 230, 253, 0.35)" filter="blur(2px)"/><circle cx="110" cy="95" r="18" fill="rgba(186, 230, 253, 0.25)" filter="blur(3px)"/><circle cx="75" cy="115" r="10" fill="rgba(186, 230, 253, 0.2)" filter="blur(2px)"/></svg>`,

// 🌟 2. 閃爍星光特效粒子
moon_star: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 6px #fef08a);"><path d="M50 5 Q50 50 95 50 Q50 50 50 95 Q50 50 5 50 Q50 50 5 50 Z" fill="#fef08a"/></svg>`,
            // 🌟 1. 8 分支發光精緻雪花
            snow: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 5px #ffffff);"><g stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none"><path d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M20 80 L80 20"/><path d="M50 22 L40 12 M50 22 L60 12 M50 78 L40 88 M50 78 L60 88 M22 50 L12 40 M22 50 L12 60 M78 50 L88 40 M78 50 L88 60"/><circle cx="50" cy="50" r="8" stroke="#bae6fd" stroke-width="2.5"/><circle cx="50" cy="50" r="3" fill="#ffffff"/></g></svg>`,
            // 🌟 2. 替換為發光小雪點
            snow_dot: `<svg viewBox="0 0 100 100" style="width:100%; height:100%; filter: drop-shadow(0 0 6px #ffffff);"><circle cx="50" cy="50" r="30" fill="#ffffff" opacity="0.95"/><circle cx="50" cy="50" r="18" fill="#ffffff"/></svg>`,
            bubble: `<svg viewBox="0 0 100 100"><defs><radialGradient id="pureCrystal" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="30%" stop-color="#bae6fd" stop-opacity="0.15"/><stop offset="70%" stop-color="#38bdf8" stop-opacity="0.05"/><stop offset="90%" stop-color="#0284c7" stop-opacity="0.3"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.8"/></radialGradient><linearGradient id="rainbowRing" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="30%" stop-color="#facc15"/><stop offset="65%" stop-color="#ec4899"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><circle cx="50" cy="50" r="45" fill="url(#pureCrystal)" stroke="url(#rainbowRing)" stroke-width="3"/><ellipse cx="33" cy="30" rx="18" ry="6" transform="rotate(-35 33 30)" fill="rgba(255,255,255,0.95)"/><circle cx="70" cy="35" r="3" fill="rgba(255,255,255,0.9)"/></svg>`,
            cross: `<svg viewBox="0 0 100 100"><path d="M20 20 L80 80 M80 20 L20 80" stroke="#ef4444" stroke-width="15" stroke-linecap="round"/></svg>`,
            lightning: `<svg viewBox="0 0 100 100"><polygon points="55,5 15,55 50,55 45,95 85,45 50,45" fill="#facc15"/></svg>`,
            book: `<svg viewBox="0 0 100 100"><path d="M10 20 L45 30 L45 90 L10 80 Z" fill="#cbd5e1"/><path d="M90 20 L55 30 L55 90 L90 80 Z" fill="#f8fafc"/></svg>`,
            // 🌟 重新繪製：層次日光漸層、燦爛光芒與核心透亮高光的夏日太陽
sun: `<svg viewBox="0 0 200 200" style="width:100%; height:100%; filter: drop-shadow(0 0 25px #fde047);"><defs><radialGradient id="sunCoreGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="1"/><stop offset="35%" stop-color="#fef08a" stop-opacity="0.95"/><stop offset="70%" stop-color="#f59e0b" stop-opacity="0.6"/><stop offset="100%" stop-color="#ea580c" stop-opacity="0"/></radialGradient><linearGradient id="sunRayBeam" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0.2"/></linearGradient></defs><circle cx="100" cy="100" r="90" fill="url(#sunCoreGlow)"/><g stroke="url(#sunRayBeam)" stroke-width="3.5" stroke-linecap="round"><line x1="100" y1="5" x2="100" y2="35"/><line x1="100" y1="165" x2="100" y2="195"/><line x1="5" y1="100" x2="35" y2="100"/><line x1="165" y1="100" x2="195" y2="100"/><line x1="33" y1="33" x2="55" y2="55"/><line x1="145" y1="145" x2="167" y2="167"/><line x1="33" y1="167" x2="55" y2="145"/><line x1="145" y1="55" x2="167" y2="33"/></g><circle cx="100" cy="100" r="35" fill="#ffffff" filter="drop-shadow(0 0 12px #ffffff)"/><circle cx="100" cy="100" r="24" fill="#fef08a"/></svg>`,
            gear: `<svg viewBox="0 0 100 100"><path d="M50 15 A 35 35 0 1 0 85 50 A 35 35 0 0 0 50 15 Z" fill="none" stroke="#94a3b8" stroke-width="12" stroke-dasharray="10 10"/><circle cx="50" cy="50" r="15" fill="none" stroke="#cbd5e1" stroke-width="8"/></svg>`,
            sweat: `<svg viewBox="0 0 100 100"><defs><linearGradient id="animeSweat" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="rgba(255,255,255,0.95)"/><stop offset="40%" stop-color="rgba(186,230,253,0.8)"/><stop offset="100%" stop-color="rgba(56,189,248,0.3)"/></linearGradient><filter id="animeSweatShadow"><feDropShadow dx="1" dy="4" stdDeviation="2" flood-color="#0284c7" flood-opacity="0.25"/></filter></defs><g filter="url(#animeSweatShadow)"><!-- 最大顆的汗滴 (右側) --><g transform="translate(45, 5) rotate(15 25 40)"><path d="M 25 0 C 40 30, 50 45, 50 60 C 50 73.8, 38.8 85, 25 85 C 11.2 85, 0 73.8, 0 60 C 0 45, 10 30, 25 0 Z" fill="url(#animeSweat)"/><path d="M 8 55 C 8 45, 13 30, 20 15" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/></g><!-- 中等汗滴 (左上) --><g transform="translate(15, 30) rotate(-10 15 25) scale(0.6)"><path d="M 25 0 C 40 30, 50 45, 50 60 C 50 73.8, 38.8 85, 25 85 C 11.2 85, 0 73.8, 0 60 C 0 45, 10 30, 25 0 Z" fill="url(#animeSweat)"/><path d="M 8 55 C 8 45, 13 30, 20 15" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/></g><!-- 小汗滴 (左下) --><g transform="translate(25, 70) rotate(-5 10 15) scale(0.4)"><path d="M 25 0 C 40 30, 50 45, 50 60 C 50 73.8, 38.8 85, 25 85 C 11.2 85, 0 73.8, 0 60 C 0 45, 10 30, 25 0 Z" fill="url(#animeSweat)"/><path d="M 8 55 C 8 45, 13 30, 20 15" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/></g></g></svg>`,
            cat: `<svg viewBox="0 0 100 100"><polygon points="15,40 10,10 40,25" fill="#f8fafc" stroke="#475569" stroke-width="4" stroke-linejoin="round"/><polygon points="85,40 90,10 60,25" fill="#f8fafc" stroke="#475569" stroke-width="4" stroke-linejoin="round"/><polygon points="18,35 15,18 32,25" fill="#fbcfe8"/><polygon points="82,35 85,18 68,25" fill="#fbcfe8"/><ellipse cx="50" cy="55" rx="40" ry="30" fill="#f8fafc" stroke="#475569" stroke-width="4"/><circle cx="35" cy="50" r="5" fill="#0f172a"/><circle cx="65" cy="50" r="5" fill="#0f172a"/><ellipse cx="25" cy="58" rx="6" ry="3" fill="#fca5a5" opacity="0.6"/><ellipse cx="75" cy="58" rx="6" ry="3" fill="#fca5a5" opacity="0.6"/><path d="M 45 62 Q 50 67 55 62" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="57" r="2" fill="#f43f5e"/><line x1="5" y1="50" x2="15" y2="52" stroke="#475569" stroke-width="3" stroke-linecap="round"/><line x1="2" y1="60" x2="13" y2="58" stroke="#475569" stroke-width="3" stroke-linecap="round"/><line x1="95" y1="50" x2="85" y2="52" stroke="#475569" stroke-width="3" stroke-linecap="round"/><line x1="98" y1="60" x2="87" y2="58" stroke="#475569" stroke-width="3" stroke-linecap="round"/></svg>`,
            zzz: `<svg viewBox="0 0 100 100"><path d="M 15 80 L 35 80 L 15 95 L 35 95" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M 40 50 L 65 50 L 40 75 L 65 75" fill="none" stroke="#64748b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M 65 15 L 95 15 L 65 45 L 95 45" fill="none" stroke="#475569" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
           cat_calico: `<svg viewBox="0 0 100 100"><g stroke="#3f2a1d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="#fffaf0"><!-- 身體 --><path d="M 16 52 C 12 28 34 18 50 18 C 66 18 88 28 84 52 C 86 76 68 82 50 82 C 32 82 14 76 16 52 Z" fill="#fffaf0"/><!-- 小貼耳 --><path d="M 28 20 Q 24 10 36 16 Z" fill="#fffaf0"/><path d="M 30 17 Q 27 12 33 15" fill="#fbcfe8"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#fffaf0"/><path d="M 70 17 Q 73 12 67 15" fill="#fbcfe8"/><!-- 三花斑塊 (左黃右棕) --><path d="M 28 26 C 26 16 44 14 50 22 C 44 32 32 34 28 26 Z" fill="#fcd34d" stroke="none"/><path d="M 58 18 C 68 20 74 30 68 38 C 62 34 56 24 58 18 Z" fill="#3f2a1d" stroke="none"/><path d="M 28 20 Q 24 10 36 16 Z" fill="#3f2a1d" stroke="none"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#3f2a1d" stroke="none"/><!-- 小腳腳 --><path d="M 38 78 L 38 82 M 62 78 L 62 82" stroke="#3f2a1d" stroke-width="3"/><circle cx="38" cy="82" r="1.8" fill="#fbcfe8"/><circle cx="62" cy="82" r="1.8" fill="#fbcfe8"/><!-- 迷因大眼 (左) --><g transform="translate(24, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#333333" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 迷因大眼 (右) --><g transform="translate(54, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#333333" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 小嘴 --><path d="M 48 53 L 50 51 L 52 53" fill="none" stroke="#333333" stroke-width="2.5"/></g></svg>`,
            cat_siamese: `<svg viewBox="0 0 100 100"><g stroke="#3f2a1d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="#f4e8d9"><!-- 身體 --><path d="M 16 52 C 12 28 34 18 50 18 C 66 18 88 28 84 52 C 86 76 68 82 50 82 C 32 82 14 76 16 52 Z" fill="#f4e8d9"/><!-- 小貼耳 --><path d="M 28 20 Q 24 10 36 16 Z" fill="#f4e8d9"/><path d="M 30 17 Q 27 12 33 15" fill="#eecdc1"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#f4e8d9"/><path d="M 70 17 Q 73 12 67 15" fill="#eecdc1"/><!-- 暹羅深色面具 --><path d="M 32 28 C 30 18 50 16 68 28 C 76 44 66 54 50 54 C 34 54 24 44 32 28 Z" fill="#7a5c53" stroke="none" opacity="0.85"/><path d="M 28 20 Q 24 10 36 16 Z" fill="#3f2a1d" stroke="none"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#3f2a1d" stroke="none"/><!-- 小腳腳 --><path d="M 38 78 L 38 82 M 62 78 L 62 82" stroke="#3f2a1d" stroke-width="3"/><circle cx="38" cy="82" r="1.8" fill="#eecdc1"/><circle cx="62" cy="82" r="1.8" fill="#eecdc1"/><!-- 迷因大眼 (左) --><g transform="translate(24, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#333333" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 迷因大眼 (右) --><g transform="translate(54, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#333333" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 小嘴 --><path d="M 48 53 L 50 51 L 52 53" fill="none" stroke="#333333" stroke-width="2.5"/></g></svg>`,
            cat_grey: `<svg viewBox="0 0 100 100"><g stroke="#3f2a1d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="#b8977a"><!-- 單色暖棕貓 --><path d="M 16 52 C 12 28 34 18 50 18 C 66 18 88 28 84 52 C 86 76 68 82 50 82 C 32 82 14 76 16 52 Z" fill="#b8977a"/><!-- 小貼耳 --><path d="M 28 20 Q 24 10 36 16 Z" fill="#b8977a"/><path d="M 30 17 Q 27 12 33 15" fill="#e6c5a8"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#b8977a"/><path d="M 70 17 Q 73 12 67 15" fill="#e6c5a8"/><!-- 右側舉起的小肉墊 --><g transform="translate(68, 50)"><ellipse cx="0" cy="0" rx="8" ry="7" fill="#b8977a"/><path d="M -5 -2 C -5 -7 5 -7 5 -2 C 5 4 0 6 -5 3 Z" fill="#e6c5a8"/><circle cx="-2.5" cy="1.5" r="1.3" fill="#d97706"/><circle cx="0.5" cy="0.3" r="1.3" fill="#d97706"/><circle cx="3.2" cy="1.6" r="1.3" fill="#d97706"/></g><!-- 小腳腳 --><path d="M 38 78 L 38 82 M 62 78 L 62 82" stroke="#3f2a1d" stroke-width="3"/><circle cx="38" cy="82" r="1.8" fill="#d97706"/><circle cx="62" cy="82" r="1.8" fill="#d97706"/><!-- 迷因大眼 (左) --><g transform="translate(24, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#3f2a1d" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 迷因大眼 (右) --><g transform="translate(54, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#3f2a1d" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 微笑嘴與腮紅 --><path d="M 47 53 Q 50 56 53 53" fill="none" stroke="#3f2a1d" stroke-width="2.5"/><ellipse cx="26" cy="53" rx="4.5" ry="2.5" fill="#d97706" opacity="0.4"/><ellipse cx="74" cy="53" rx="4.5" ry="2.5" fill="#d97706" opacity="0.4"/></g></svg>`,
            cat_white: `<svg viewBox="0 0 100 100"><g stroke="#3f2a1d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="#ffffff"><!-- 身體 --><path d="M 16 52 C 12 28 34 18 50 18 C 66 18 88 28 84 52 C 86 76 68 82 50 82 C 32 82 14 76 16 52 Z" fill="#ffffff"/><!-- 小貼耳 --><path d="M 28 20 Q 24 10 36 16 Z" fill="#ffffff"/><path d="M 30 17 Q 27 12 33 15" fill="#fbcfe8"/><path d="M 72 20 Q 76 10 64 16 Z" fill="#ffffff"/><path d="M 70 17 Q 73 12 67 15" fill="#fbcfe8"/><!-- 小腳腳 --><path d="M 38 78 L 38 82 M 62 78 L 62 82" stroke="#3f2a1d" stroke-width="3"/><circle cx="38" cy="82" r="1.8" fill="#fb7185"/><circle cx="62" cy="82" r="1.8" fill="#fb7185"/><!-- 迷因大眼 (左) --><g transform="translate(24, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#4a5568" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 迷因大眼 (右) --><g transform="translate(54, 30)"><circle cx="11" cy="11" r="10.5" fill="#fef08a" stroke="#3f2a1d" stroke-width="2.5"/><circle cx="11" cy="11" r="9" fill="#4a5568" stroke="none"/><circle cx="7" cy="6" r="2.2" fill="#ffffff"/></g><!-- 微笑嘴與腮紅 --><path d="M 47 53 Q 50 56 53 53" fill="none" stroke="#3f2a1d" stroke-width="2.5"/><ellipse cx="26" cy="53" rx="4.5" ry="2.5" fill="#fca5a5" opacity="0.6"/><ellipse cx="74" cy="53" rx="4.5" ry="2.5" fill="#fca5a5" opacity="0.6"/></g></svg>`,
          poop: `<svg viewBox="0 0 100 100"><path d="M 12 72 C 10 92, 90 92, 88 72 C 86 54, 75 52, 50 52 C 25 52, 14 54, 12 72 Z" fill="#8A5734" stroke="#5B3923" stroke-width="4" stroke-linejoin="round"/><path d="M 19 70 C 19 82, 35 84, 55 83" fill="none" stroke="#A16942" stroke-width="5" stroke-linecap="round"/><path d="M 22 52 C 18 68, 82 68, 78 52 C 75 38, 65 35, 50 35 C 35 35, 25 38, 22 52 Z" fill="#8A5734" stroke="#5B3923" stroke-width="4" stroke-linejoin="round"/><path d="M 28 50 C 28 60, 40 62, 55 60" fill="none" stroke="#A16942" stroke-width="5" stroke-linecap="round"/><path d="M 32 38 C 32 18, 48 10, 56 12 C 48 16, 68 25, 68 38 C 68 50, 32 50, 32 38 Z" fill="#8A5734" stroke="#5B3923" stroke-width="4" stroke-linejoin="round"/><path d="M 38 36 C 38 25, 43 20, 48 16" fill="none" stroke="#A16942" stroke-width="4" stroke-linecap="round"/></svg>`,
            // 🌸 1. 完整五瓣櫻花 (立體漸層花瓣 + 典雅花蕊)
            sakura_flower: `<svg viewBox="0 0 120 120" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <linearGradient id="sakuraGradFlower" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="40%" stop-color="#fce7f3"/>
                        <stop offset="85%" stop-color="#f472b6"/>
                        <stop offset="100%" stop-color="#ec4899"/>
                    </linearGradient>
                </defs>
                <g transform="translate(60,60)">
                    <!-- 五片花瓣 -->
                    <path d="M 0 0 C -16 -20, -22 -46, -10 -54 C -3 -58, -1 -52, 0 -48 C 1 -52, 3 -58, 10 -54 C 22 -46, 16 -20, 0 0 Z" fill="url(#sakuraGradFlower)" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
                    <path d="M 0 0 C -16 -20, -22 -46, -10 -54 C -3 -58, -1 -52, 0 -48 C 1 -52, 3 -58, 10 -54 C 22 -46, 16 -20, 0 0 Z" fill="url(#sakuraGradFlower)" stroke="rgba(255,255,255,0.7)" stroke-width="1" transform="rotate(72)"/>
                    <path d="M 0 0 C -16 -20, -22 -46, -10 -54 C -3 -58, -1 -52, 0 -48 C 1 -52, 3 -58, 10 -54 C 22 -46, 16 -20, 0 0 Z" fill="url(#sakuraGradFlower)" stroke="rgba(255,255,255,0.7)" stroke-width="1" transform="rotate(144)"/>
                    <path d="M 0 0 C -16 -20, -22 -46, -10 -54 C -3 -58, -1 -52, 0 -48 C 1 -52, 3 -58, 10 -54 C 22 -46, 16 -20, 0 0 Z" fill="url(#sakuraGradFlower)" stroke="rgba(255,255,255,0.7)" stroke-width="1" transform="rotate(216)"/>
                    <path d="M 0 0 C -16 -20, -22 -46, -10 -54 C -3 -58, -1 -52, 0 -48 C 1 -52, 3 -58, 10 -54 C 22 -46, 16 -20, 0 0 Z" fill="url(#sakuraGradFlower)" stroke="rgba(255,255,255,0.7)" stroke-width="1" transform="rotate(288)"/>
                    <!-- 中心粉嫩花蕊 -->
                    <circle cx="0" cy="0" r="6" fill="#f43f5e" opacity="0.85"/>
                    <circle cx="0" cy="0" r="3" fill="#fef08a"/>
                    <!-- 金黃細花絲 -->
                    <line x1="0" y1="0" x2="0" y2="-12" stroke="#f43f5e" stroke-width="1.2"/>
                    <circle cx="0" cy="-12" r="1.5" fill="#facc15"/>
                    <line x1="0" y1="0" x2="11" y2="-4" stroke="#f43f5e" stroke-width="1.2"/>
                    <circle cx="11" cy="-4" r="1.5" fill="#facc15"/>
                    <line x1="0" y1="0" x2="7" y2="10" stroke="#f43f5e" stroke-width="1.2"/>
                    <circle cx="7" cy="10" r="1.5" fill="#facc15"/>
                    <line x1="0" y1="0" x2="-7" y2="10" stroke="#f43f5e" stroke-width="1.2"/>
                    <circle cx="-7" cy="10" r="1.5" fill="#facc15"/>
                    <line x1="0" y1="0" x2="-11" y2="-4" stroke="#f43f5e" stroke-width="1.2"/>
                    <circle cx="-11" cy="-4" r="1.5" fill="#facc15"/>
                </g>
            </svg>`,
            // 🌸 2. 經典單片櫻花花瓣
            sakura_petal: `<svg viewBox="0 0 100 120" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <linearGradient id="sakuraPetalGrad" x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="35%" stop-color="#fce7f3"/>
                        <stop offset="75%" stop-color="#f472b6"/>
                        <stop offset="100%" stop-color="#db2777"/>
                    </linearGradient>
                </defs>
                <path d="M 50 115 C 32 90, 8 65, 8 38 C 8 16, 28 6, 44 14 C 47 16, 50 18, 50 20 C 50 18, 53 16, 56 14 C 72 6, 92 16, 92 38 C 92 65, 68 90, 50 115 Z" fill="url(#sakuraPetalGrad)" stroke="rgba(255,255,255,0.7)" stroke-width="1.2"/>
                <path d="M 50 105 Q 49 60 48 30" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            </svg>`,
            // 🌸 3. 翻轉側身花瓣
            sakura_petal_side: `<svg viewBox="0 0 100 120" style="width:100%; height:100%; overflow:visible;">
                <path d="M 50 115 C 38 85, 20 60, 25 35 C 28 18, 42 10, 55 18 C 50 25, 42 50, 50 115 Z" fill="url(#sakuraPetalGrad)" opacity="0.95"/>
            </svg>`
        };

const effectData = {
            none: { name: {zh: '無特效', en: 'None'}, cost: 0, preview: '#ffffff' },
            poop: { name: {zh: '便便來襲', en: 'Poop Attack'}, cost: 500, preview: '#78350f', svg: [{s: 'poop'}], dir: 'down', count: 10 },
            rain: { name: {zh: '綿綿細雨', en: 'Raindrops'}, cost: 800, preview: '#93c5fd', svg: [{s: 'drop'}], dir: 'down', count: 20 },
            zzz: { name: {zh: '睡意來襲', en: 'Sleepy'}, cost: 800, preview: '#cbd5e1', svg: [{s: 'zzz'}], dir: 'up', count: 12 },
            cat: { name: {zh: '貓貓降臨', en: 'Cat Fall'}, cost: 1000, preview: '#f8fafc', svg: [{s: 'cat_siamese'}, {s: 'cat_grey'}, {s: 'cat_white'}], dir: 'down', count: 3 },
            tvStatic: { name: {zh: '阿嬤的舊電視', en: 'Old TV'}, cost: 1000, preview: '#94a3b8', svg: [{s: 'tvStatic'}], dir: 'down', count: 12 },
            bubble: { name: {zh: '夢幻泡泡', en: 'Bubbles'}, cost: 1200, preview: '#67e8f9', svg: [{s: 'bubble'}], dir: 'up', count: 15 },
            math: { name: {zh: '數學當機', en: 'Math Error'}, cost: 1200, preview: '#0f172a', svg: [{s: 'cross'}, {s: 'book'}], dir: 'down', count: 20 },
            leaf: { name: {zh: '落葉紛飛', en: 'Falling Leaves'}, cost: 1400, preview: '#ea580c', svg: [{s: 'leaf'}, {s: 'leaf_maple'}, {s: 'leaf_ginkgo'}], dir: 'down', count: 20 },
            tomato: { name: {zh: '小番茄煙火', en: 'Tomato Fireworks'}, cost: 1500, preview: '#fca5a5', svg: [{s: 'tomato'}], dir: 'down', count: 12 },
           snow: { name: {zh: '初雪飄落', en: 'Snowfall'}, cost: 1500, preview: '#e0f2fe', svg: [{s: 'snow'}, {s: 'snow_dot'}], dir: 'down', count: 28 },
            sun: { name: {zh: '陽光普照', en: 'Sunny'}, cost: 1500, preview: '#fb923c', svg: [{s: 'sparkle'}], dir: 'up', count: 20 },
            moon: { name: {zh: '月光灑落', en: 'Moonlight'}, cost: 1500, preview: '#1e293b', svg: [{s: 'moon_star'}], dir: 'down', count: 18 },
           sheep: { name: {zh: '數羊羊', en: 'Counting Sheep'}, cost: 1600, preview: '#e2e8f0', svg: [{s: 'moon'}], dir: 'up', count: 8 },
            star: { name: {zh: '繁星閃爍', en: 'Starry'}, cost: 1800, preview: '#fef08a', svg: [{s: 'star'}, {s: 'sparkle'}], dir: 'down', count: 20 },
            duck: { name: {zh: '黃色小鴨', en: 'Rubber Ducks'}, cost: 1800, preview: '#fde047', svg: [{s: 'duck'}], dir: 'down', count: 15 },
            fish: { name: {zh: '深海魚群', en: 'School of Fish'}, cost: 1900, preview: '#0284c7', svg: [{s: 'fish'}], dir: 'up', count: 18 },
          
            paint: { name: {zh: '揮灑顏料', en: 'Paint Splash'}, cost: 2000, preview: '#f472b6', svg: [{s: 'drop'}], dir: 'down', count: 15 },
         
            butterfly: { name: {zh: '蝴蝶翩翩', en: 'Butterflies'}, cost: 2100, preview: '#c084fc', svg: [{s: 'butterfly'}], dir: 'up', count: 10 },
       
           sakura: { name: {zh: '櫻花飛舞', en: 'Sakura'}, cost: 2200, preview: '#fbcfe8' },
            lightning: { name: {zh: '閃電交加', en: 'Lightning'}, cost: 2400, preview: '#fde047' },
            disco: { name: {zh: '回程挑釁', en: 'Recall Taunt'}, cost: 2500, preview: '#c084fc', svg: [{s: 'star'}, {s: 'music'}], dir: 'up', count: 10 },
            ghost: { name: {zh: '小幽靈', en: 'Little Ghosts'}, cost: 2500, preview: '#f8fafc', svg: [{s: 'ghost'}], dir: 'up', count: 10 },
            confetti: { name: {zh: '派對拉炮', en: 'Confetti'}, cost: 2500, preview: '#f472b6', svg: [{s: 'star'}, {s: 'sparkle'}], dir: 'down', count: 20 },
            gear: { name: {zh: '齒輪運轉', en: 'Gears Turning'}, cost: 2600, preview: '#64748b', svg: [{s: 'gear'}], dir: 'down', count: 12 },
            bugFree: { name: {zh: 'Bug退散', en: 'No More Bugs'}, cost: 4800, preview: '#4ade80', svg: [{s: 'bugFree'}], dir: 'up', count: 15 },
            money: { name: {zh: '財富自由', en: 'Money Rain'}, cost: 5000, preview: '#facc15', svg: [{s: 'money'}], dir: 'down', count: 20 },
            music: { name: {zh: '跳動音符', en: 'Musical Notes'}, cost: 5200, preview: '#3b82f6' },
        };
        let currentTab = 'species';
        let trialState = { species: null, bg: null, effect: null };
        let trialTimer = null;
        let trialInterval = null;
        
       // 🌟 【遊戲啟動核心】網頁載入後第一個跑來這裡，負責讀檔、連線、把所有畫面準備好
        async function initGameData() {
            // 1. 先第一時間讀取本地存檔，讓畫面瞬間恢復！
            loadGame();
            checkDaily();
            // 2. 判斷要不要顯示抽獎畫面，並且更新全部的按鈕與圖案
            checkFirstTime();
            updateLangUI();
            renderShop();
            startCooldownTimer();
            startHungerSystem(); // 🌟 啟動飢餓度監控與更新
            startWaterPollutionSystem(); // 🌟 啟動水質自然變髒與渲染系統
            initDragAndPetSystem();
            updateNameUI();
            updateSlugScale();   // 依螢幕大小決定海兔要多大
            updateRecallButtonVisibility();

            // 🌟 3. 主動向後端拉取最新金幣數量
            await fetchUserCoins();

            // 🌟 4. 背景悄悄同步伺服器資料
            try {
                const data = await fetchAPI('/pet-games/my-pet', 'GET');
                if (data && !data.error) {
                    console.log('成功從伺服器同步海兔資料！', data);
                    
                    // ⚠️ 後端 /pet-games/my-pet 直接回傳資料庫 Pet 欄位 (snake_case)：
                    //    pet_name、is_named、coin、pet_color、background_color、background_effects、
                    //    PetInventory: [{ category, item_name }]

                    // 同步名字與金幣 (還沒取過名時，資料庫是預設的「神秘雪兔」，不覆蓋)
                    if (data.is_named && data.pet_name) gameState.petName = data.pet_name;
                    if (data.coin !== undefined) gameState.points = data.coin;

                    // 同步目前裝備：伺服器的值是有效商品才採用；
                    // 資料庫預設值 (「經典雪兔」「基礎藍」) 不在商品清單裡，代表從沒透過伺服器換過裝，保留本機的 (例如抽到的寵物)
                    if (speciesData[data.pet_color]) gameState.currentSpecies = data.pet_color;
                    if (bgData[data.background_color]) gameState.currentBg = data.background_color;
                    if (effectData[data.background_effects]) gameState.currentEffect = data.background_effects;

                    // 同步背包已解鎖清單：合併伺服器 PetInventory 與本機清單 (抽到的寵物目前只存在本機，不能被蓋掉)
                    if (Array.isArray(data.PetInventory)) {
                        const owned = (category, dataObj) => data.PetInventory
                            .filter(item => item.category === category && dataObj[item.item_name])
                            .map(item => item.item_name);
                        gameState.unlockedSpecies = [...new Set([...gameState.unlockedSpecies, ...owned('pet_color', speciesData)])];
                        gameState.unlockedBgs = [...new Set([...gameState.unlockedBgs, ...owned('background_color', bgData)])];
                        gameState.unlockedEffects = [...new Set([...gameState.unlockedEffects, ...owned('background_effects', effectData)])];
                    }
                    
                    // 防呆：確保預設的經典兔一定在背包裡
                    if (!gameState.unlockedSpecies.includes(gameState.currentSpecies)) {
                        gameState.unlockedSpecies.push(gameState.currentSpecies);
                    }
                    
                    gameState.hasAdopted = true; 
                    saveGame();
                    
                    checkFirstTime();
                    updateNameUI();
                    renderShop();
                    updateUI();
                }
            } catch(e) {
                console.log('伺服器未連線，繼續使用本地存檔');
            }

            // 啟動多人連線
            initSocketIO(); 
        }
        
        // 當網頁讀取完畢，就去呼叫上面的「遊戲啟動核心」
        window.onload = function() {
            initGameData(); 
        };
        // 🌟 1. 取得簽到狀態 (GET)
        async function checkDaily() {
            try {
                // 使用你原本寫好的 fetchAPI，它已經內建自動帶上 Token
                const data = await fetchAPI('/pet-games/sign-in-status', 'GET');
                
                if (data && !data.error) {
                    gameState.checkInData = data; 
                    
                    // ⚠️ 這裡要確認後端傳來的「今天是否已簽到」的欄位名稱是不是 todaySigned
                    const isSignedToday = data.todaySigned || false;
                    
                    const btnGift = document.getElementById('btnDailyGift');
                    if (btnGift) {
                        if (!isSignedToday) {
                            btnGift.classList.add('needs-attention'); // 沒簽到就顯示小紅點
                        } else {
                            btnGift.classList.remove('needs-attention'); // 簽到過就移除小紅點
                        }
                    }
                }
            } catch (e) {
                console.error("取得簽到狀態失敗", e);
            }
        }

        // 🌟 2. 畫出 14 天的日曆網格
        function renderCheckInGrid(data) {
            const grid = document.getElementById('checkInGrid');
            if (!grid) return;
            grid.innerHTML = '';
            
            const t = i18n[currLang] || i18n.zh;
            // ⚠️ 這裡要確認後端傳來的「目前累積天數」是不是 currentDay
            let currentDay = data.currentDay || 0; 
            let isSignedToday = data.todaySigned || false;

            for (let i = 1; i <= 14; i++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'checkin-day';
                
                // 第 7 天與 14 天獎勵是 200，其餘 100
                let reward = (i === 7 || i === 14) ? 200 : 100;
                let icon = (i === 7 || i === 14) ? '🎁' : '🪙';
                let dayText = `${t.dayPrefix || 'Day '}${i}${t.daySuffix || ''}`;
                
                dayEl.innerHTML = `
                    <div style="font-size:0.8rem;">${dayText}</div>
                    <div style="font-size:1.1rem; margin:4px 0;">${icon}</div>
                    <div style="font-size:0.75rem;">${reward}</div>
                `;
                
                // 判斷格子狀態：已領取、今天該領、未來天數
                if (i < currentDay || (i === currentDay && isSignedToday)) {
                    dayEl.classList.add('claimed');
                } else if (i === currentDay + 1 && !isSignedToday) {
                    dayEl.classList.add('today');
                    dayEl.onclick = claimCheckIn; // 點擊格子也能簽到
                } else if (i === currentDay && !isSignedToday) {
                    dayEl.classList.add('today');
                    dayEl.onclick = claimCheckIn;
                }
                
                grid.appendChild(dayEl);
            }

            const headerEl = document.getElementById('modalCheckInHeader');
            const subEl = document.getElementById('modalCheckInSub');
            const closeEl = document.getElementById('btnCloseCheckInModal');
            if (headerEl) headerEl.innerText = t.modalCheckInHeader;
            if (subEl) subEl.innerText = t.modalCheckInSub;
            if (closeEl) closeEl.innerText = t.closeCalendarBtn;
        }

        // 🌟 3. 送出簽到請求 (POST)
        async function claimCheckIn() {
            try {
                const result = await fetchAPI('/pet-games/sign-in', 'POST');
                const t = i18n[currLang] || i18n.zh;
                
                if (result && !result.error) {
                    // 簽到成功，關閉日曆
                    document.getElementById('checkInModalOverlay').style.display = 'none';
                    
                    // ⚠️ 確認後端回傳的「天數」和「獎勵金額」欄位名稱
                    let currentDay = result.currentDay || (gameState.checkInData ? (gameState.checkInData.currentDay || 0) + 1 : 1);
                    let gainedCoins = result.reward || ((currentDay === 7 || currentDay === 14) ? 200 : 100);

                    // 幫玩家加錢並存檔
                    gameState.points += gainedCoins;
                    saveGame();
                    if (typeof updateUI === 'function') updateUI();
                    
                    // 拔掉禮物盒的小紅點
                    const btnGift = document.getElementById('btnDailyGift');
                    if (btnGift) btnGift.classList.remove('needs-attention');
                    
                    // 顯示大禮包畫面
                    document.getElementById('txtStreakDays').innerText = currentDay;
                    document.getElementById('txtTodayReward').innerText = '+' + gainedCoins + ' ' + (t.points || '積分');
                    document.getElementById('streakRewardModalOverlay').style.display = 'flex';
                    
                    // 重新抓取一次最新狀態
                    checkDaily();
                } else {
                    showFloatText(result.message || result.error || (t.alreadyCheckedInToast || '今天已經簽到過囉！'));
                }
            } catch (e) {
                console.error("簽到請求失敗", e);
                const t = i18n[currLang] || i18n.zh;
                showFloatText(t.serverErrorToast || '伺服器連線異常，請稍後再試！');
            }
        }

        // 🌟 4. 點擊禮物盒的動畫與開啟日曆
        function playGiftAnimation(btn) {
            const svg = btn.querySelector('.gift-svg');
            if (svg) {
                // 播放蓋子飛走動畫
                svg.classList.add('is-opening');
                
                setTimeout(() => {
                    svg.classList.remove('is-opening');
                    document.getElementById('checkInModalOverlay').style.display = 'flex';
                    
                    // 畫出日曆內容
                    if (gameState.checkInData) {
                        renderCheckInGrid(gameState.checkInData);
                    } else {
                        fetchAPI('/pet-games/sign-in-status', 'GET').then(data => {
                            if(data && !data.error) {
                                gameState.checkInData = data;
                                renderCheckInGrid(data);
                            }
                        });
                    }
                }, 500);
            }
        }
        // 🐌 【海兔大小自適應】依舞台尺寸算出縮放比例，螢幕越大海兔越大。
        //     寫進 CSS 變數 --slug-scale，其他要改 transform 的地方都會沿用它。
        function updateSlugScale() {
            const slugEl = document.getElementById('slugContainer');
            const stage = document.getElementById('mainStage');
            if (!slugEl || !stage) return 1;

            const w = stage.clientWidth, h = stage.clientHeight;
            if (!w || !h) return 1;

            // 直式舞台（手機）以寬度為準，讓海兔固定約佔畫面一半寬；
            // 橫式舞台則寬高各算一次取較小值，避免在極寬或極扁的視窗爆版
            const raw = h > w ? w / 680 : Math.min(w / 1150, h / 470);
            const scale = Math.max(0.45, Math.min(1.4, raw));
            slugEl.style.setProperty('--slug-scale', scale.toFixed(3));
            return scale;
        }

        // 讓行內 transform 也帶上基礎縮放，否則會蓋掉 CSS 的 scale
        const slugTransform = (extra = '') => `scale(var(--slug-scale)) ${extra}`.trim();

        // 🌟 【海兔防遮擋安全範圍】回傳海兔在舞台座標系裡可以待的極限值。
        //    下緣會避開會蓋住牠的介面（電腦版是商店面板，手機版是常駐互動按鈕列），
        //    避免海兔追海藻或被拖曳後卡在選單底下看不到。
        function getSlugSafeBounds() {
            const slugEl = document.getElementById('slugContainer');
            const stage = document.getElementById('mainStage');
            if (!slugEl || !stage) return null;

            const stageRect = stage.getBoundingClientRect();
            const stageMiddle = stageRect.top + stageRect.height / 2;

            let safeTop = stageRect.top;
            let safeBottom = stageRect.bottom;

            // 電腦版與手機版共用同一份清單，實際存在且看得見的才會被算進去
            const blockers = [
                '.top-bar', '#btnOpenManual', '#btnToggleMp', '.mp-panel',
                '#btnOpenShop', '.interaction-group', '#uiPanel'
            ];

            for (const selector of blockers) {
                const el = document.querySelector(selector);
                if (!el) continue;

                const rect = el.getBoundingClientRect();
                // 隱藏的元件高度是 0；手機版的 uiPanel 是整頁透明容器，會蓋滿舞台所以要跳過
                if (rect.height <= 0 || rect.height > stageRect.height * 0.8) continue;
                // 水平方向完全沒有跟舞台重疊的就不影響海兔
                if (rect.right <= stageRect.left || rect.left >= stageRect.right) continue;

                if (rect.bottom <= stageMiddle) {
                    safeTop = Math.max(safeTop, rect.bottom);
                } else if (rect.top >= stageMiddle) {
                    safeBottom = Math.min(safeBottom, rect.top);
                }
            }

            // 海兔會依螢幕縮放，所以用實際看到的大小來算邊界；
            // 縮放以中心為軸，版面框與視覺框之間的差要補回來
            const slugRect = slugEl.getBoundingClientRect();
            const visW = slugRect.width || slugEl.offsetWidth;
            const visH = slugRect.height || slugEl.offsetHeight;
            const padX = (slugEl.offsetWidth - visW) / 2;
            const padY = (slugEl.offsetHeight - visH) / 2;

            const minY = Math.max(-padY, safeTop - stageRect.top - padY);
            const maxY = Math.max(minY, safeBottom - stageRect.top - visH - padY);

            return {
                minX: -padX,
                minY,
                maxX: Math.max(-padX, stageRect.width - visW - padX),
                maxY
            };
        }

        // 🌟 把海兔推回安全範圍內（餵食結束、視窗縮放、裝置轉向時呼叫）
        function clampSlugIntoSafeArea() {
            const slugEl = document.getElementById('slugContainer');
            const bounds = getSlugSafeBounds();
            if (!slugEl || !bounds) return;

            const curLeft = parseFloat(slugEl.style.left);
            const curTop = parseFloat(slugEl.style.top);

            if (!isNaN(curLeft)) {
                slugEl.style.left = Math.min(Math.max(curLeft, bounds.minX), bounds.maxX) + 'px';
            }
            if (!isNaN(curTop)) {
                slugEl.style.top = Math.min(Math.max(curTop, bounds.minY), bounds.maxY) + 'px';
            }
        }

        // 🌟 視窗大小改變時的「防走失與自動校正」機制
        let stageResizeTimer = null;
        window.addEventListener('resize', () => {
            updateSlugScale();
            // 如果正在餵食或運動中，先不打擾牠
            if (!isFeedingActive && !isExercisingActive) clampSlugIntoSafeArea();

            // 舞台從寬扁變直立（或反過來）時，插畫背景要換成對應版面
            clearTimeout(stageResizeTimer);
            stageResizeTimer = setTimeout(applyBg, 200);
        });

        // 手機轉向後版面高度會變，也要重新校正一次
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                updateSlugScale();
                clampSlugIntoSafeArea();
                applyBg();
            }, 300);
        });
// 🌟 洗掉前任記憶的忘情水！
        function clearTestLogin() {
            sessionStorage.removeItem('test_nudi_token');
            localStorage.removeItem('nudi_token'); 
            location.reload(); 
        }

        // 🌟 【存檔與讀取系統】
        function saveGame() {
            try {
                localStorage.setItem('nudi_game_save', JSON.stringify(gameState));
            } catch(e) {
                console.error("存檔失敗", e);
            }
        }

        function loadGame() {
            const saved = localStorage.getItem('nudi_game_save');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    gameState = { ...gameState, ...parsed };
                } catch(e) {
                    console.error("存檔讀取失敗", e);
                }
            }

            // 🌟 防刷分與時間戳記校正：依據真實時間計算剩餘冷卻秒數
            if (!gameState.cooldownUntil) {
                gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
            }
            if (!gameState.cooldowns) {
                gameState.cooldowns = { feed: 0, clean: 0, pet: 0 };
            }

            const now = Date.now();
            ['feed', 'clean', 'pet'].forEach(type => {
                const targetTime = gameState.cooldownUntil[type] || 0;
                const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
                gameState.cooldowns[type] = remaining;
            });
        }

        // 🌟 【冷卻倒數計時器：防刷分防重整版】
        function startCooldownTimer() {
            setInterval(() => {
                const now = Date.now();
                let changed = false;

                if (!gameState.cooldownUntil) {
                    gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                }

                ['feed', 'clean', 'pet'].forEach(type => {
                    const targetTime = gameState.cooldownUntil[type] || 0;
                    const remainingMs = targetTime - now;

                    if (remainingMs > 0) {
                        const remainingSec = Math.ceil(remainingMs / 1000);
                        if (gameState.cooldowns[type] !== remainingSec) {
                            gameState.cooldowns[type] = remainingSec;
                            changed = true;
                        }
                    } else {
                        if (gameState.cooldowns[type] !== 0) {
                            gameState.cooldowns[type] = 0;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    updateUI();
                }
            }, 500);
        }
    
        // 🌟 【餵食海藻：點擊召喚海藻與海兔飢餓追逐系統】
        let isFeedingActive = false;
        let foodChaseFrame = null;
        let floatingAlgae = null;
        let targetFoodPos = { x: 0, y: 0 };

      function triggerFeedInteraction(e) {
            if (e) e.stopPropagation();

            if (gameState.cooldowns.feed > 0) {
                showFloatText('海兔還在消化中喔！🌱');
                return;
            }

            // 🌟 飽足度大於等於 100% 時提示已經吃很飽
            if (gameState.hunger >= 100) {
                showFloatText('海兔肚子圓滾滾，已經吃很飽啦！🥰');
                return;
            }

            if (isFeedingActive) return;
            isFeedingActive = true;

            const btn = document.getElementById('btnFeed');
            const btnRect = btn.getBoundingClientRect();

            targetFoodPos = {
                x: e.clientX || (btnRect.left + btnRect.width / 2),
                y: e.clientY || (btnRect.top + btnRect.height / 2)
            };

            floatingAlgae = document.createElement('div');
            floatingAlgae.className = 'drag-algae-item';
            floatingAlgae.innerHTML = svgLib['algae'] || '🌱';
            floatingAlgae.style.left = targetFoodPos.x + 'px';
            floatingAlgae.style.top = targetFoodPos.y + 'px';
            document.body.appendChild(floatingAlgae);

            const slugEl = document.getElementById('slugContainer');
            slugEl.classList.add('is-chasing-food');

            window.addEventListener('pointermove', handleFoodTracking);
            window.addEventListener('touchmove', handleFoodTouchTracking, { passive: false });
            window.addEventListener('pointerup', handleFeedSuccessCheck);
            window.addEventListener('touchend', handleFeedSuccessCheck);

            runSlugChaseLoop();
        }
        // 🌟 【淨化水質：拿抹布擦拭魚缸水質系統】
        let isCleaningActive = false;
        let cleaningCloth = null;
        let cleanProgress = 0; // 擦拭次數計數器
        const TARGET_WIPES = 12; // 擦拭約 12 下即可完全擦乾淨

        function triggerCleanInteraction(e) {
            if (e) e.stopPropagation();

            if (gameState.cooldowns.clean > 0) {
                showFloatText('水質已經被擦乾淨囉！✨');
                return;
            }

            if ((gameState.dirtiness || 0) <= 5) {
                showFloatText('水質已經非常清澈，不用擦啦！💎');
                return;
            }

            if (isCleaningActive) return;
            isCleaningActive = true;
            cleanProgress = 0;

            const btn = document.getElementById('btnClean');
            const btnRect = btn.getBoundingClientRect();

            // 建立藍白格紋可愛清潔抹布
            cleaningCloth = document.createElement('div');
            cleaningCloth.className = 'cleaning-cloth-item';
            cleaningCloth.innerHTML = `
                <svg viewBox="0 0 100 100" style="width:100%; height:100%;">
                    <rect x="15" y="15" width="70" height="70" rx="15" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
                    <rect x="25" y="25" width="50" height="50" rx="8" fill="#e0f2fe" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6,4"/>
                    <path d="M 30 50 Q 50 35 70 50 Q 50 65 30 50 Z" fill="#ffffff" opacity="0.8"/>
                    <circle cx="70" cy="30" r="4" fill="#ffffff"/>
                </svg>
            `;
            cleaningCloth.style.left = (e.clientX || (btnRect.left + btnRect.width / 2)) + 'px';
            cleaningCloth.style.top = (e.clientY || (btnRect.top + btnRect.height / 2)) + 'px';
            document.body.appendChild(cleaningCloth);

            showFloatText('🧽 拖曳抹布在魚缸上擦一擦！');

            window.addEventListener('pointermove', handleClothWiping);
            window.addEventListener('touchmove', handleClothTouchWiping, { passive: false });
            window.addEventListener('pointerup', checkCleanCompleted);
            window.addEventListener('touchend', checkCleanCompleted);
            window.addEventListener('touchcancel', checkCleanCompleted);
        }

        function handleClothWiping(e) {
            if (!isCleaningActive || !cleaningCloth) return;
            cleaningCloth.style.left = e.clientX + 'px';
            cleaningCloth.style.top = e.clientY + 'px';
            performWipeAction(e.clientX, e.clientY);
        }

        function handleClothTouchWiping(e) {
            if (!isCleaningActive || !cleaningCloth || !e.touches || !e.touches[0]) return;
            // 🛑 阻止手機下拉重整與畫面跟著滑動
            if (e.cancelable) e.preventDefault();
            
            const touch = e.touches[0];
            const tx = touch.clientX;
            const ty = touch.clientY;
            
            cleaningCloth.style.left = tx + 'px';
            cleaningCloth.style.top = ty + 'px';
            performWipeAction(tx, ty);
        }

        let lastWipePos = { x: 0, y: 0 };
        const REQUIRED_WIPES = 8; // 🌟 必須在魚缸上連續滑動擦拭滿 8 下

        function performWipeAction(x, y) {
            const stage = document.getElementById('mainStage');
            const stageRect = stage.getBoundingClientRect();

            // 判斷是否在魚缸舞台範圍內擦拭
            if (x >= stageRect.left && x <= stageRect.right && y >= stageRect.top && y <= stageRect.bottom) {
                const dist = Math.hypot(x - lastWipePos.x, y - lastWipePos.y);
                
                // 只有滑動距離超過 45px 才算認真擦了一次
                if (dist > 45) {
                    lastWipePos = { x, y };
                    cleanProgress++;

                    // 產生擦拭水光漣漪
                    const trail = document.createElement('div');
                    trail.className = 'cloth-wipe-trail';
                    trail.style.left = (x - stageRect.left) + 'px';
                    trail.style.top = (y - stageRect.top) + 'px';
                    stage.appendChild(trail);
                    setTimeout(() => trail.remove(), 600);

                    // 髒污度隨著擦拭次數一層層淡化
                    const currentDirt = gameState.dirtiness || 0;
                    const cleanPercent = cleanProgress / REQUIRED_WIPES;
                    const overlay = document.getElementById('dirtOverlay');
                    if (overlay) {
                        overlay.style.opacity = Math.max(0, (currentDirt / 100) * (1 - cleanPercent));
                    }

                    // 🌟 必須確實擦滿 8 下才會完成淨化
                    if (cleanProgress >= REQUIRED_WIPES) {
                        finishCleaningAction(true);
                    }
                }
            }
        }

function checkCleanCompleted() {
            if (!isCleaningActive) return;
            
            // 🌟 放寬判定：只要有拿抹布擦拭（大於等於 2 下），放開手指/滑鼠就直接判定擦乾淨！
            if ((cleanProgress || 0) >= 2) {
                finishCleaningAction(true);
            } else {
                finishCleaningAction(false);
            }
        }

        function finishCleaningAction(isSuccess) {
            isCleaningActive = false;
            window.removeEventListener('pointermove', handleClothWiping);
            window.removeEventListener('touchmove', handleClothTouchWiping);
            window.removeEventListener('pointerup', checkCleanCompleted);
            window.removeEventListener('touchend', checkCleanCompleted);

            if (cleaningCloth && cleaningCloth.parentNode) {
                cleaningCloth.remove();
                cleaningCloth = null;
                // 🌟 核心：擦拭成功時清空髒污、加分，並通知任務系統進度 +1
            if (isSuccess) {
                gameState.dirtiness = 0;
                gameState.lastDirtTime = Date.now();
                renderWaterQuality();

                gameState.points += 100;
                gameState.cooldowns.clean = 15;
                if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                gameState.cooldownUntil.clean = Date.now() + (15 * 1000);

                // 🌟 通知任務系統「淨化水質」任務完成！
                updateTaskProgress('clean');

                saveGame();
                updateUI();
                showFloatText('✨ 魚缸擦得亮晶晶！ +100');
                fetchAPI('/pet-games/interact', 'POST', { action: 'clean' });
            } else {
                showFloatText('還有一點青苔沒擦乾淨喔！再試一次吧～');
            }
            }

          function completeFeedingAction(isSuccess) {
            isFeedingActive = false;
            if (foodChaseFrame) {
                cancelAnimationFrame(foodChaseFrame);
                foodChaseFrame = null;
            }

            window.removeEventListener('pointermove', handleFoodTracking);
            window.removeEventListener('touchmove', handleFoodTouchTracking);
            window.removeEventListener('pointerup', handleFeedSuccessCheck);
            window.removeEventListener('touchend', handleFeedSuccessCheck);

            if (floatingAlgae && floatingAlgae.parentNode) {
                floatingAlgae.remove();
                floatingAlgae = null;
            }

            const slugEl = document.getElementById('slugContainer');
            slugEl.classList.remove('is-chasing-food');

            if (isSuccess) {
                slugEl.classList.add('is-eating-munch');

                const faceGroup = slugEl.querySelector('g[transform="translate(130, 150)"]');
                const originalFaceHTML = faceGroup ? faceGroup.innerHTML : '';

                if (faceGroup) {
                    faceGroup.innerHTML = `
                        <ellipse cx="-35" cy="12" rx="18" ry="11" fill="var(--c-blush)" opacity="0.95"/>
                        <ellipse cx="35" cy="12" rx="18" ry="11" fill="var(--c-blush)" opacity="0.95"/>
                        <g stroke="#2c3e50" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                            <path d="M -26 -2 L -18 3 L -26 8" />
                            <path d="M 26 -2 L 18 3 L 26 8" />
                        </g>
                        <g id="chewingAlgaePiece" transform="translate(0, 10)">
                            <path class="algae-soft-blade-1" d="M 0 0 C -6 6, -12 12, -8 22 C -5 27, 2 22, 0 14 C -1 8, 1 3, 0 0 Z" fill="#22c55e" stroke="#14532d" stroke-width="1.1" stroke-linejoin="round"/>
                            <path class="algae-soft-blade-2" d="M -2 3 C -8 7, -14 14, -10 19 C -7 21, -3 16, -3 10 Z" fill="#4ade80" stroke="#14532d" stroke-width="0.9" stroke-linejoin="round"/>
                            <path d="M 1 2 C 4 5, 6 10, 3 13 C 1 11, 1 6, 1 2 Z" fill="#86efac" stroke="#14532d" stroke-width="0.7"/>
                        </g>
                        <path id="chewingLineMouth" d="M -6 6 Q 0 11 6 6" fill="none" stroke="#2c3e50" stroke-width="1.8" stroke-linecap="round"/>
                    `;
                }

                setTimeout(() => {
                    slugEl.classList.remove('is-eating-munch');
                    slugEl.style.transform = slugTransform('scaleX(1)');
                    if (faceGroup) faceGroup.innerHTML = originalFaceHTML;
                }, 1800);

                // 餵食加分與冷卻
                gameState.points += 80;
                gameState.cooldowns.feed = 8;
                if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                gameState.cooldownUntil.feed = Date.now() + (8 * 1000);

                // 🌟 通知任務系統「餵食」完成
                updateTaskProgress('feed');

                // 回補飽足度
                gameState.hunger = Math.min(100, (gameState.hunger !== undefined ? gameState.hunger : 0) + 35);
                gameState.lastHungerTime = Date.now();
                updateHungerUI();

                saveGame();
                updateUI();
                showFloatText('😋 嚼嚼嚼！美味海藻 +80');
                fetchAPI('/pet-games/interact', 'POST', { action: 'feed' });
            } else {
                slugEl.style.transform = slugTransform('scaleX(1)');
                showFloatText('海藻掉在路上了～再試一次吧！');
            }
        }
        function finishCleaningAction(isSuccess) {
            isCleaningActive = false;
            window.removeEventListener('pointermove', handleClothWiping);
            window.removeEventListener('touchmove', handleClothTouchWiping);
            window.removeEventListener('pointerup', checkCleanCompleted);
            window.removeEventListener('touchend', checkCleanCompleted);

            if (cleaningCloth && cleaningCloth.parentNode) {
                cleaningCloth.remove();
                cleaningCloth = null;
            }

            if (isSuccess) {
                // 清空水質髒污
                gameState.dirtiness = 0;
                gameState.lastDirtTime = Date.now();
                renderWaterQuality();

                // 淨化加分與冷卻
                gameState.points += 100;
                gameState.cooldowns.clean = 15;
                if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                gameState.cooldownUntil.clean = Date.now() + (15 * 1000);

                // 🌟 通知任務系統「淨化水質」完成
                updateTaskProgress('clean');

                saveGame();
                updateUI();
                showFloatText('✨ 魚缸擦得亮晶晶！ +100');
                fetchAPI('/pet-games/interact', 'POST', { action: 'clean' });
            } else {
                showFloatText('還有一點青苔沒擦乾淨喔！再試一次吧～');
            }
        }
        }

        function handleFoodTracking(e) {
            if (!isFeedingActive || !floatingAlgae) return;
            targetFoodPos.x = e.clientX;
            targetFoodPos.y = e.clientY;
            floatingAlgae.style.left = targetFoodPos.x + 'px';
            floatingAlgae.style.top = targetFoodPos.y + 'px';
        }

        function handleFoodTouchTracking(e) {
            if (!isFeedingActive || !floatingAlgae || !e.touches[0]) return;
            e.preventDefault();
            targetFoodPos.x = e.touches[0].clientX;
            targetFoodPos.y = e.touches[0].clientY;
            floatingAlgae.style.left = targetFoodPos.x + 'px';
            floatingAlgae.style.top = targetFoodPos.y + 'px';
        }

function runSlugChaseLoop() {
            if (!isFeedingActive) return;

            const slugEl = document.getElementById('slugContainer');
            const stage = document.getElementById('mainStage');
            const rect = slugEl.getBoundingClientRect();

            // 防呆：確保海藻座標不超出目前的舞台範圍
            targetFoodPos.x = Math.max(0, Math.min(stage.offsetWidth, targetFoodPos.x));
            targetFoodPos.y = Math.max(0, Math.min(stage.offsetHeight, targetFoodPos.y));

            const slugCenterX = rect.left + rect.width / 2;
            const slugCenterY = rect.top + rect.height / 2;

            const dx = targetFoodPos.x - slugCenterX;
            const dy = targetFoodPos.y - slugCenterY;
            const dist = Math.hypot(dx, dy);

            if (dist > 30) {
                // 判斷海兔的臉要朝向哪邊
                const direction = dx > 0 ? -1 : 1;

                if (window.innerWidth > 768) {
                    // 💻 電腦版保留原味：海兔親自衝過去把海藻吃掉
                    const stepSpeed = 5.2;
                    let curLeft = parseFloat(slugEl.style.left) || slugEl.offsetLeft;
                    let curTop = parseFloat(slugEl.style.top) || slugEl.offsetTop;

                    curLeft += (dx / dist) * stepSpeed;
                    curTop += (dy / dist) * stepSpeed;

                    // 追海藻時也不能衝出舞台或鑽進商店面板底下
                    const bounds = getSlugSafeBounds() || { minX: 0, minY: 0, maxX: stage.offsetWidth, maxY: stage.offsetHeight };

                    slugEl.style.left = Math.max(bounds.minX, Math.min(bounds.maxX, curLeft)) + 'px';
                    slugEl.style.top = Math.max(bounds.minY, Math.min(bounds.maxY, curTop)) + 'px';
                    slugEl.style.transform = slugTransform(`scaleX(${direction})`);
                } else {
                    // 📱 手機版專屬：留在原地跳躍流口水，只轉身面向海藻
                    slugEl.style.transform = slugTransform(`scaleX(${direction})`);
                }
            }

            // 當玩家把海藻拖曳到海兔嘴邊 (距離小於 70) 時，觸發張嘴吃掉！
            if (dist < 70) {
                completeFeedingAction(true);
                return;
            }

            foodChaseFrame = requestAnimationFrame(runSlugChaseLoop);
        }

        function handleFeedSuccessCheck() {
            if (!isFeedingActive) return;

            const slugEl = document.getElementById('slugContainer');
            const rect = slugEl.getBoundingClientRect();
            const slugCenterX = rect.left + rect.width / 2;
            const slugCenterY = rect.top + rect.height / 2;

            const dist = Math.hypot(targetFoodPos.x - slugCenterX, targetFoodPos.y - slugCenterY);

            if (dist < 120) {
                completeFeedingAction(true);
            } else {
                completeFeedingAction(false);
            }
        }

function completeFeedingAction(isSuccess) {
            isFeedingActive = false;
            if (foodChaseFrame) {
                cancelAnimationFrame(foodChaseFrame);
                foodChaseFrame = null;
            }

            window.removeEventListener('pointermove', handleFoodTracking);
            window.removeEventListener('touchmove', handleFoodTouchTracking);
            window.removeEventListener('pointerup', handleFeedSuccessCheck);
            window.removeEventListener('touchend', handleFeedSuccessCheck);

            if (floatingAlgae && floatingAlgae.parentNode) {
                floatingAlgae.remove();
                floatingAlgae = null;
            }

            const slugEl = document.getElementById('slugContainer');
            slugEl.classList.remove('is-chasing-food');

            if (isSuccess) {
                slugEl.classList.add('is-eating-munch');

                const faceGroup = slugEl.querySelector('g[transform="translate(130, 150)"]');
                const originalFaceHTML = faceGroup ? faceGroup.innerHTML : '';

                if (faceGroup) {
                    faceGroup.innerHTML = `
                        <ellipse cx="-35" cy="12" rx="18" ry="11" fill="var(--c-blush)" opacity="0.95"/>
                        <ellipse cx="35" cy="12" rx="18" ry="11" fill="var(--c-blush)" opacity="0.95"/>
                        <g stroke="#2c3e50" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                            <path d="M -26 -2 L -18 3 L -26 8" />
                            <path d="M 26 -2 L 18 3 L 26 8" />
                        </g>
                        <g id="chewingAlgaePiece" transform="translate(0, 10)">
                            <path class="algae-soft-blade-1" d="M 0 0 C -6 6, -12 12, -8 22 C -5 27, 2 22, 0 14 C -1 8, 1 3, 0 0 Z" fill="#22c55e" stroke="#14532d" stroke-width="1.1" stroke-linejoin="round"/>
                            <path class="algae-soft-blade-2" d="M -2 3 C -8 7, -14 14, -10 19 C -7 21, -3 16, -3 10 Z" fill="#4ade80" stroke="#14532d" stroke-width="0.9" stroke-linejoin="round"/>
                            <path d="M 1 2 C 4 5, 6 10, 3 13 C 1 11, 1 6, 1 2 Z" fill="#86efac" stroke="#14532d" stroke-width="0.7"/>
                        </g>
                        <path id="chewingLineMouth" d="M -6 6 Q 0 11 6 6" fill="none" stroke="#2c3e50" stroke-width="1.8" stroke-linecap="round"/>
                    `;
                }

                setTimeout(() => {
                    slugEl.classList.remove('is-eating-munch');
                    slugEl.style.transform = slugTransform();
                    if (faceGroup) faceGroup.innerHTML = originalFaceHTML;
                }, 1800);

                gameState.points += 80;
                gameState.cooldowns.feed = 8;
                
                // 🌟 核心：通知任務系統「餵食海藻」任務完成！
                updateTaskProgress('feed');

                // 增加飽食度
                gameState.hunger = Math.min(100, (gameState.hunger !== undefined ? gameState.hunger : 0) + 35);
                gameState.lastHungerTime = Date.now();
                updateHungerUI();

                if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                gameState.cooldownUntil.feed = Date.now() + (8 * 1000);
                saveGame();
                updateUI();
                showFloatText('😋 嚼嚼嚼！美味海藻 +80');
                fetchAPI('/pet-games/interact', 'POST', { action: 'feed' });
            } else {
             slugEl.style.transform = slugTransform();
                showFloatText('海藻掉在路上了～再試一次吧！');
            }
        
            gameState.points += 80;
                gameState.cooldowns.feed = 8;
                
                // 🌟 每次餵食增加 35% 飽足度（最多 100%）
                gameState.hunger = Math.min(100, (gameState.hunger || 0) + 35);
                gameState.lastHungerTime = Date.now();
                updateHungerUI();

                if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                gameState.cooldownUntil.feed = Date.now() + (8 * 1000);
                saveGame();
                updateUI();
                showFloatText('😋 嚼嚼嚼！美味海藻 +80');
                fetchAPI('/pet-games/interact', 'POST', { action: 'feed' });

                // 吃完後把海兔推回安全範圍，避免牠停在商店面板底下被擋住
                clampSlugIntoSafeArea();
        }
        // 🌟 【活力運動：拋接球與海兔流汗撿球收納系統】
        let isExercisingActive = false;
        let heldBall = null;
        let exerciseLandedBall = null;
        let returnBowl = null;
        let exerciseAnimFrame = null;
        let sweatInterval = null;

        const ballSVGHTML = `
            <svg viewBox="0 0 120 120" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <!-- 水晶球通透玻璃球體漸層 -->
                    <radialGradient id="glassSphereGrad" cx="35%" cy="30%" r="65%">
                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
                        <stop offset="25%" stop-color="#e0f2fe" stop-opacity="0.4"/>
                        <stop offset="65%" stop-color="#bae6fd" stop-opacity="0.15"/>
                        <stop offset="90%" stop-color="#38bdf8" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#0284c7" stop-opacity="0.6"/>
                    </radialGradient>
                    <!-- 橘色小魚立體漸層 -->
                    <linearGradient id="fishOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffedd5"/>
                        <stop offset="30%" stop-color="#fb923c"/>
                        <stop offset="75%" stop-color="#ea580c"/>
                        <stop offset="100%" stop-color="#c2410c"/>
                    </linearGradient>
                    <!-- 藍色小魚漸層 -->
                    <linearGradient id="fishBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#67e8f9"/>
                        <stop offset="50%" stop-color="#0ea5e9"/>
                        <stop offset="100%" stop-color="#1d4ed8"/>
                    </linearGradient>
                </defs>

                <!-- 1. 外部主球體底層與外框 -->
                <circle cx="60" cy="60" r="54" fill="url(#glassSphereGrad)" stroke="rgba(255, 255, 255, 0.75)" stroke-width="2.5"/>

                <!-- 2. 下半部繽紛碎星亮片層 -->
                <g opacity="0.85">
                    <!-- 亮片聚集弧形底色 -->
                    <path d="M 16 75 Q 60 50 104 75 A 54 54 0 0 1 16 75 Z" fill="rgba(244, 114, 182, 0.25)"/>
                    <!-- 各色小星星與彩色亮片點 -->
                    <polygon points="35,85 37,90 42,90 38,93 39,98 35,95 31,98 32,93 28,90 33,90" fill="#f43f5e" opacity="0.9"/>
                    <polygon points="50,78 51,82 55,82 52,85 53,89 50,86 47,89 48,85 45,82 49,82" fill="#38bdf8" opacity="0.85"/>
                    <polygon points="70,82 71,85 75,85 72,88 73,91 70,89 67,91 68,88 65,85 69,85" fill="#facc15" opacity="0.9"/>
                    <polygon points="85,88 86,91 90,91 87,93 88,96 85,94 82,96 83,93 80,91 84,91" fill="#4ade80" opacity="0.8"/>
                    <polygon points="60,94 61,97 65,97 62,99 63,102 60,100 57,102 58,99 55,97 59,97" fill="#c084fc" opacity="0.9"/>
                    <circle cx="28" cy="98" r="3" fill="#f472b6"/>
                    <circle cx="45" cy="92" r="2.5" fill="#a7f3d0"/>
                    <circle cx="78" cy="96" r="3" fill="#fef08a"/>
                    <circle cx="95" cy="80" r="2.5" fill="#c084fc"/>
                    <circle cx="40" cy="104" r="2.8" fill="#38bdf8"/>
                    <circle cx="72" cy="105" r="2.5" fill="#f43f5e"/>
                </g>

                <!-- 3. 上方游動的小藍魚 -->
                <g transform="translate(42, 28) scale(0.68) rotate(-8)">
                    <!-- 魚尾巴 -->
                    <path d="M 45 15 L 62 6 Q 58 15 62 24 Z" fill="url(#fishBlueGrad)"/>
                    <!-- 魚身 -->
                    <path d="M 5 15 C 10 3, 35 3, 46 15 C 35 27, 10 27, 5 15 Z" fill="url(#fishBlueGrad)" stroke="#1e3a8a" stroke-width="1"/>
                    <!-- 魚鰭 -->
                    <path d="M 18 17 Q 26 24 22 26 Z" fill="#0284c7"/>
                    <!-- 魚眼睛與黑色紋理 -->
                    <circle cx="12" cy="12" r="2" fill="#0f172a"/>
                    <path d="M 22 10 Q 32 10 38 12 M 20 14 Q 30 14 36 16 M 22 18 Q 28 18 34 20" stroke="#1e3a8a" stroke-width="1.2" fill="none" opacity="0.75"/>
                </g>

                <!-- 4. 主角：立體大橘魚 -->
                <g transform="translate(20, 38) scale(0.95) rotate(-4)">
                    <!-- 魚尾鰭 -->
                    <path d="M 58 22 C 72 8, 80 14, 76 22 C 80 30, 72 36, 58 22 Z" fill="url(#fishOrangeGrad)" stroke="#9a3412" stroke-width="1.2"/>
                    <!-- 魚背鰭與腹鰭 -->
                    <path d="M 25 5 Q 40 0 52 8 Z" fill="#ea580c"/>
                    <path d="M 30 35 Q 42 42 48 32 Z" fill="#ea580c"/>
                    <!-- 魚身體 -->
                    <path d="M 5 20 C 14 3, 48 3, 60 20 C 48 37, 14 37, 5 20 Z" fill="url(#fishOrangeGrad)" stroke="#7c2d12" stroke-width="1.6"/>
                    <!-- 大胸鰭 -->
                    <path d="M 22 22 Q 34 32 26 34 Z" fill="#f97316" stroke="#9a3412" stroke-width="1"/>
                    <!-- 呆萌圓眼睛 -->
                    <circle cx="14" cy="17" r="3.2" fill="#18181b"/>
                    <circle cx="15.2" cy="15.8" r="1.1" fill="#ffffff"/>
                    <!-- 橘魚身上的深色側線斑紋 -->
                    <g stroke="#7c2d12" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.85">
                        <path d="M 24 24 Q 38 24 46 22"/>
                        <path d="M 22 28 Q 36 29 44 26"/>
                        <path d="M 25 32 Q 34 33 40 30"/>
                    </g>
                </g>

                <!-- 5. 玻璃球表面真實反光條與高光點 -->
                <g pointer-events="none">
                    <!-- 左上方長條玻璃反光 -->
                    <path d="M 28 20 A 46 46 0 0 1 55 12" stroke="rgba(255, 255, 255, 0.85)" stroke-width="4.5" stroke-linecap="round" fill="none"/>
                    <!-- 中心長方形室內燈光倒影 -->
                    <rect x="44" y="38" width="5" height="12" rx="2" fill="#ffffff" opacity="0.8" transform="rotate(-15 44 38)"/>
                    <rect x="52" y="35" width="5" height="14" rx="2" fill="#ffffff" opacity="0.8" transform="rotate(-15 52 35)"/>
                    <rect x="60" y="34" width="4.5" height="13" rx="2" fill="#ffffff" opacity="0.8" transform="rotate(-15 60 34)"/>
                    <!-- 右下緣月牙弧光 -->
                    <path d="M 88 88 A 50 50 0 0 1 65 106" stroke="rgba(255, 255, 255, 0.45)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                </g>
            </svg>
        `;

        const bowlSVGHTML = `
            <svg viewBox="0 0 120 80" style="width:100%; height:100%;">
                <ellipse cx="60" cy="65" rx="48" ry="12" fill="rgba(0,0,0,0.15)"/>
                <path d="M 12 25 Q 10 65 60 65 Q 110 65 108 25 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
                <ellipse cx="60" cy="25" rx="48" ry="15" fill="#bae6fd" stroke="#0284c7" stroke-width="4"/>
                <ellipse cx="60" cy="25" rx="38" ry="10" fill="#0284c7" opacity="0.3"/>
                <path d="M 25 38 Q 60 55 95 38" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
            </svg>
        `;

function triggerExerciseInteraction(e) {
            if (e) e.stopPropagation();

            if (gameState.cooldowns.pet > 0) {
                showFloatText('海兔運動完在喘氣休息中喔！💦');
                return;
            }

            // 🌟 核心：如果飽食度歸零，海兔原地搖頭拒絕運動，不拿球出來！
            if ((gameState.hunger || 0) <= 0) {
                const slugEl = document.getElementById('slugContainer');
                if (slugEl) {
                    slugEl.classList.add('is-refusing-exercise');
                    setTimeout(() => slugEl.classList.remove('is-refusing-exercise'), 500);
                }
                showFloatText('海兔肚子咕嚕咕嚕叫，餓得走不動啦...🥺 請先餵食！');
                return;
            }

            if (isExercisingActive) return;
            isExercisingActive = true;

            const btn = document.getElementById('btnPet');
            const btnRect = btn.getBoundingClientRect();

            heldBall = document.createElement('div');
            heldBall.className = 'exercise-ball-item';
            heldBall.innerHTML = ballSVGHTML;
            heldBall.style.left = (e.clientX || (btnRect.left + btnRect.width / 2)) + 'px';
            heldBall.style.top = (e.clientY || (btnRect.top + btnRect.height / 2)) + 'px';
            document.body.appendChild(heldBall);

            const stage = document.getElementById('mainStage');
            returnBowl = document.createElement('div');
            returnBowl.className = 'ball-return-bowl';
            returnBowl.innerHTML = bowlSVGHTML;
            stage.appendChild(returnBowl);

            showFloatText('🏀 把球丟到魚缸裡讓海兔撿！');

            window.addEventListener('pointermove', handleBallTracking);
            window.addEventListener('touchmove', handleBallTouchTracking, { passive: false });
            window.addEventListener('pointerup', handleThrowBall);
            window.addEventListener('touchend', handleThrowBall);
        }

        function handleBallTracking(e) {
            if (!isExercisingActive || !heldBall) return;
            heldBall.style.left = e.clientX + 'px';
            heldBall.style.top = e.clientY + 'px';
        }

        function handleBallTouchTracking(e) {
            if (!isExercisingActive || !heldBall || !e.touches || !e.touches[0]) return;
            if (e.cancelable) e.preventDefault();
            heldBall.style.left = e.touches[0].clientX + 'px';
            heldBall.style.top = e.touches[0].clientY + 'px';
        }

function handleThrowBall(e) {
            if (!isExercisingActive || !heldBall) return;

            window.removeEventListener('pointermove', handleBallTracking);
            window.removeEventListener('touchmove', handleBallTouchTracking);
            window.removeEventListener('pointerup', handleThrowBall);
            window.removeEventListener('touchend', handleThrowBall);

            const stage = document.getElementById('mainStage');
            const stageRect = stage.getBoundingClientRect();

            // 🌟 精準相容手機觸控座標提取
            let dropX = e.clientX;
            let dropY = e.clientY;

            if ((dropX === undefined || dropY === undefined) && e.changedTouches && e.changedTouches[0]) {
                dropX = e.changedTouches[0].clientX;
                dropY = e.changedTouches[0].clientY;
            }

            // 判斷是否落在魚缸內
            if (dropX >= stageRect.left && dropX <= stageRect.right && dropY >= stageRect.top && dropY <= stageRect.bottom) {
                heldBall.remove();
                heldBall = null;

                const stage = document.getElementById('mainStage');
                const slugEl = document.getElementById('slugContainer');
                
                // 🌟 1. 計算海兔身體可以移動的極限
                const maxSlugX = Math.max(0, stage.offsetWidth - slugEl.offsetWidth);
                const maxSlugY = Math.max(0, stage.offsetHeight - slugEl.offsetHeight);

                // 🌟 2. 換算成海兔「中心點」能安全咬到球的座標範圍
                const minSafeX = slugEl.offsetWidth / 2;
                const maxSafeX = maxSlugX + (slugEl.offsetWidth / 2);
                const minSafeY = slugEl.offsetHeight / 2;
                const maxSafeY = maxSlugY + (slugEl.offsetHeight / 2);

                // 🌟 3. 取得實際落點，如果丟太旁邊，就強制用 Math.min/max 吸回邊界內！
                let rawBallX = dropX - stageRect.left;
                let rawBallY = dropY - stageRect.top;
                
                const ballStageX = Math.max(minSafeX, Math.min(maxSafeX, rawBallX));
                const ballStageY = Math.max(minSafeY, Math.min(maxSafeY, rawBallY));

                exerciseLandedBall = document.createElement('div');
                exerciseLandedBall.className = 'stage-landed-ball';
                exerciseLandedBall.innerHTML = ballSVGHTML;
                exerciseLandedBall.style.left = ballStageX + 'px';
                exerciseLandedBall.style.top = ballStageY + 'px';
                stage.appendChild(exerciseLandedBall);

                startSlugFetchMotion(ballStageX, ballStageY);
            } else {
                cleanupExercise();
                showFloatText('球掉在魚缸外面囉～再試一次吧！');
            }
        }

        function startSlugFetchMotion(targetBallX, targetBallY) {
            const slugEl = document.getElementById('slugContainer');
            const stage = document.getElementById('mainStage');
            slugEl.classList.add('is-exercising-run');

            sweatInterval = setInterval(() => {
                const sRect = slugEl.getBoundingClientRect();
                const stRect = stage.getBoundingClientRect();
                const drop = document.createElement('div');
                drop.className = 'exercise-sweat-drop';
                drop.innerHTML = svgLib['sweat'] || '💦';
                drop.style.left = (sRect.left - stRect.left + (Math.random() * 60 + 20)) + 'px';
                drop.style.top = (sRect.top - stRect.top + 20) + 'px';
                drop.style.setProperty('--sw-dx', (Math.random() * 40 - 20) + 'px');
                stage.appendChild(drop);
                setTimeout(() => drop.remove(), 600);
            }, 180);

            let fetchPhase = 'toBall';

            function fetchLoop() {
                let curLeft = parseFloat(slugEl.style.left) || slugEl.offsetLeft;
                let curTop = parseFloat(slugEl.style.top) || slugEl.offsetTop;

                let slugCenterX = curLeft + slugEl.offsetWidth / 2;
                let slugCenterY = curTop + slugEl.offsetHeight / 2;

                const maxX = stage.offsetWidth - slugEl.offsetWidth;
                const maxY = stage.offsetHeight - slugEl.offsetHeight;

                // 🌟 回碗目標：計算海兔在碗上方可抵達的真實中心位置
                let destX = fetchPhase === 'toBall' ? targetBallX : (stage.offsetWidth / 2);
                let destY = fetchPhase === 'toBall' ? targetBallY : (maxY + slugEl.offsetHeight / 2 - 10);

                const dx = destX - slugCenterX;
                const dy = destY - slugCenterY;
                const dist = Math.hypot(dx, dy);

                // 抵達判定的距離門檻（去撿球 35px，回碗放球 65px）
                const arriveThreshold = fetchPhase === 'toBall' ? 35 : 65;

                const direction = dx > 0 ? -1 : 1;
slugEl.style.transform = slugTransform(`scaleX(${direction})`);

                const runSpeed = 6.2;
                if (dist > arriveThreshold) {
                    curLeft += (dx / dist) * runSpeed;
                    curTop += (dy / dist) * runSpeed;

                    slugEl.style.left = Math.max(0, Math.min(maxX, curLeft)) + 'px';
                    slugEl.style.top = Math.max(0, Math.min(maxY, curTop)) + 'px';

                    // 咬著球跑：球球固定在海兔嘴邊
                    if (fetchPhase === 'toBowl' && exerciseLandedBall) {
                        const mouthDir = dx > 0 ? -1 : 1;
                        exerciseLandedBall.style.left = (curLeft + slugEl.offsetWidth / 2 + (mouthDir * 25)) + 'px';
                        exerciseLandedBall.style.top = (curTop + slugEl.offsetHeight / 2 + 25) + 'px';
                    }

                    exerciseAnimFrame = requestAnimationFrame(fetchLoop);
                } else {
                    if (fetchPhase === 'toBall') {
                        // 🌟 1. 咬到球球
                        fetchPhase = 'toBowl';
                        showFloatText('🐶 咬到球球了！跑回碗裡放～');
                        exerciseAnimFrame = requestAnimationFrame(fetchLoop);
                    } else {
                        // 🌟 2. 順利回到碗邊，球球進碗
                        if (exerciseLandedBall && returnBowl) {
                            const bowlRect = returnBowl.getBoundingClientRect();
                            const stageRect = stage.getBoundingClientRect();
                            exerciseLandedBall.style.transition = 'all 0.3s ease-out';
                            exerciseLandedBall.style.left = (bowlRect.left - stageRect.left + bowlRect.width / 2) + 'px';
                            exerciseLandedBall.style.top = (bowlRect.top - stageRect.top + bowlRect.height / 2 - 5) + 'px';
                        }
                        setTimeout(() => {
                            finishExerciseSuccess();
                        }, 350);
                    }
                }
            }

            exerciseAnimFrame = requestAnimationFrame(fetchLoop);
        }

        function finishExerciseSuccess() {
            cleanupExercise();

            gameState.points += 60;
            gameState.cooldowns.pet = 10;
            if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
            gameState.cooldownUntil.pet = Date.now() + (10 * 1000);
// 🌟 核心：通知任務系統「陪伴海兔運動」任務進度 +1
            updateTaskProgress('pet');

            saveGame();
            updateUI();
            showFloatText('⚽ 運動大成功！球球收進碗裡囉 +60');
            fetchAPI('/pet-games/interact', 'POST', { action: 'pet' });
        }

        function cleanupExercise() {
            isExercisingActive = false;
            if (exerciseAnimFrame) cancelAnimationFrame(exerciseAnimFrame);
            if (sweatInterval) clearInterval(sweatInterval);

            if (heldBall && heldBall.parentNode) heldBall.remove();
            if (exerciseLandedBall && exerciseLandedBall.parentNode) exerciseLandedBall.remove();
            if (returnBowl && returnBowl.parentNode) returnBowl.remove();

            heldBall = null;
            exerciseLandedBall = null;
            returnBowl = null;

            const slugEl = document.getElementById('slugContainer');
            if (slugEl) {
                slugEl.classList.remove('is-exercising-run');
                slugEl.style.transform = slugTransform();
            }
        }
        // 🌟 【水質系統：隨時間自然變髒與渲染引擎】
        function startWaterPollutionSystem() {
            // 每 10 秒檢查一次水質變化（10 分鐘增加 3%，換算每 200 秒增加 1 點髒污度）
            setInterval(() => {
                const now = Date.now();
                const lastTime = gameState.lastDirtTime || now;
                const elapsedSeconds = (now - lastTime) / 1000;
                
                // 🌟 每過 200 秒（3.33 分鐘）增加 1 點髒污（600 秒 = 10 分鐘累積 3 點）
                if (elapsedSeconds >= 200) {
                    const addDirt = Math.floor(elapsedSeconds / 200);
                    gameState.dirtiness = Math.min(100, (gameState.dirtiness || 0) + addDirt);
                    gameState.lastDirtTime = now;
                    saveGame();
                    renderWaterQuality();
                }
            }, 10000);

            // 剛進入遊戲立即渲染當前水質
            renderWaterQuality();
        }

        // 🎨 根據當前髒污度更新畫面視覺
        function renderWaterQuality() {
            const overlay = document.getElementById('dirtOverlay');
            if (!overlay) return;

            const dirt = gameState.dirtiness || 0;
            // 髒污度 0 ~ 100 轉換為遮罩透明度與模糊度
            overlay.style.opacity = (dirt / 100) * 0.96;
            overlay.style.backdropFilter = `blur(${(dirt / 100) * 12}px)`;
        }

// 🌟 【一般互動系統：淨化水質與溫柔撫摸的動作總管】
        function interact(type, points, cd) {
            // 1. 檢查是否還在冷卻中
            if (gameState.cooldowns && gameState.cooldowns[type] > 0) {
                showFloatText('海兔還在休息中喔！✨');
                return;
            }

            // 2. 淨化水質專屬邏輯：水質已經很乾淨時提示
            if (type === 'clean' && (gameState.dirtiness || 0) <= 0) {
                showFloatText('水質已經非常清澈囉！💎');
                return;
            }

            // 3. 加分與設定冷卻時間
            gameState.points += points;
            gameState.cooldowns[type] = cd;

            if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
            gameState.cooldownUntil[type] = Date.now() + (cd * 1000);

            // 4. 淨化水質：瞬間洗淨髒污並播放清澈水光動畫
            if (type === 'clean') {
                gameState.dirtiness = 0;
                gameState.lastDirtTime = Date.now();
                
                const stage = document.getElementById('mainStage');
                const flash = document.createElement('div');
                flash.className = 'water-purifying-flash';
                stage.appendChild(flash);
                setTimeout(() => flash.remove(), 1200);

                renderWaterQuality();
            }

            // 5. 溫柔撫摸：觸發海兔摸摸動畫
            if (type === 'pet') {
                const slug = document.getElementById('slugContainer');
                slug.classList.add('is-petting');
                setTimeout(() => slug.classList.remove('is-petting'), 500);
            }

            // 6. 存檔並更新畫面數字
            saveGame();
            updateUI();

            const txtMap = {
                clean: `💎 水質煥然一新！ +${points}`,
                pet: `💖 溫柔撫摸 +${points}`
            };
            showFloatText(txtMap[type] || `+${points}`);
            fetchAPI('/pet-games/interact', 'POST', { action: type });
        }

        // 🌟 【飢餓度系統：獨立外層定時器】
        function startHungerSystem() {
            // 每 2 秒檢查一次飢餓度
            setInterval(() => {
                const now = Date.now();
                const lastTime = gameState.lastHungerTime || now;
                const elapsedSeconds = (now - lastTime) / 1000;

                // 🌟 設定：每過 10 秒自然消耗 1% 飽足度（約 16 分鐘餓扁，方便測試與養成）
                if (elapsedSeconds >= 10) {
                    const dropHunger = Math.floor(elapsedSeconds / 10);
                    gameState.hunger = Math.max(0, (gameState.hunger !== undefined ? gameState.hunger : 100) - dropHunger);
                    gameState.lastHungerTime = now;
                    saveGame();
                    updateHungerUI();
                }
            }, 2000);

            updateHungerUI();
        }

// 🌟 更新餵食按鈕上的飽食進度條與海兔飢餓虛弱狀態
        function updateHungerUI() {
            const bar = document.getElementById('hungerBarFill');
            if (bar) {
                const h = gameState.hunger !== undefined ? Math.max(0, Math.min(100, gameState.hunger)) : 100;
                bar.style.width = h + '%';

                if (h <= 25) {
                    bar.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
                } else if (h <= 55) {
                    bar.style.background = 'linear-gradient(90deg, #fbbf24, #f97316)';
                } else {
                    bar.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
                }
            }

            // 🌟 檢查海兔是否陷入「飢餓虛弱（飽食度 0%）」狀態
            renderStarvingState();
        }

        function renderStarvingState() {
            const slugEl = document.getElementById('slugContainer');
            if (!slugEl) return;

            const isStarving = (gameState.hunger || 0) <= 0;
            const existingGrumble = slugEl.querySelector('.starving-belly-grumble');

            if (isStarving) {
                slugEl.classList.add('is-starving');

                // 產生肚子「咕嚕咕嚕～」提示
                if (!existingGrumble) {
                    const grumbleEl = document.createElement('div');
                    grumbleEl.className = 'starving-belly-grumble';
                    grumbleEl.innerHTML = `<span>🫧 咕嚕咕嚕...</span>`;
                    slugEl.appendChild(grumbleEl);
                }

                // 將海兔五官換成虛弱垂眼與委屈小嘴
                const faceGroup = slugEl.querySelector('g[transform="translate(130, 150)"]');
                if (faceGroup && !slugEl.classList.contains('is-eating-munch')) {
                    faceGroup.innerHTML = `
                        <!-- 淡淡的蒼白腮紅 -->
                        <ellipse cx="-35" cy="12" rx="10" ry="6" fill="var(--c-blush)" opacity="0.35"/>
                        <ellipse cx="35" cy="12" rx="10" ry="6" fill="var(--c-blush)" opacity="0.35"/>
                        
                        <!-- 沒精神的半垂垂眼 ( = = ) -->
                        <g class="normal-eye" stroke="#2c3e50" stroke-width="3.5" stroke-linecap="round" fill="none">
                            <line x1="-26" y1="-2" x2="-14" y2="4"/>
                            <line x1="14" y1="4" x2="26" y2="-2"/>
                        </g>

                        <!-- 摸摸時依舊能幸福瞇瞇笑眼 ( > < ) -->
                        <g class="happy-eye" stroke="#2c3e50" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                            <path d="M -26 -2 L -18 3 L -26 8" />
                            <path d="M 26 -2 L 18 3 L 26 8" />
                        </g>

                        <!-- 肚子餓的委屈波浪嘴 -->
                        <path d="M -8 10 Q 0 4 8 10" fill="none" stroke="#2c3e50" stroke-width="3" stroke-linecap="round"/>
                    `;
                }
            } else {
                slugEl.classList.remove('is-starving');
                if (existingGrumble) existingGrumble.remove();

                // 恢復原本水靈靈的大眼睛
                const faceGroup = slugEl.querySelector('g[transform="translate(130, 150)"]');
                if (faceGroup && !slugEl.classList.contains('is-eating-munch')) {
                    faceGroup.innerHTML = `
                        <ellipse cx="-35" cy="12" rx="14" ry="8" fill="var(--c-blush)" opacity="0.85"/>
                        <ellipse cx="35" cy="12" rx="14" ry="8" fill="var(--c-blush)" opacity="0.85"/>
                        <g class="normal-eye">
                            <circle cx="-20" cy="0" r="7" fill="#2c3e50" />
                            <circle cx="20" cy="0" r="7" fill="#2c3e50" />
                            <circle cx="-18" cy="-2" r="2.5" fill="#ffffff" />
                            <circle cx="22" cy="-2" r="2.5" fill="#ffffff" />
                        </g>
                        <g class="happy-eye" stroke="#2c3e50" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
                            <path d="M -26 -2 L -18 3 L -26 8" />
                            <path d="M 26 -2 L 18 3 L 26 8" />
                        </g>
                        <path d="M -7 5 Q 0 12 7 5" fill="none" stroke="#2c3e50" stroke-width="3.5" stroke-linecap="round"/>
                    `;
                }
            }
        }
        // 🌟 【切換語言小幫手】
        function toggleLang() {
            currLang = currLang === 'zh' ? 'en' : 'zh';
            updateLangUI();
            renderShop();
            updateUI();
            updateNameUI();
        }

function updateLangUI() {
            const t = i18n[currLang];
            document.getElementById('btnBack').innerText = t.backBtn;
            document.getElementById('btnLang').innerText = t.langBtn;
            document.getElementById('txtPts').innerText = t.points;
            document.getElementById('gachaTitle').innerText = t.gachaTitle;
            if(document.getElementById('gachaBox').innerText !== '' && !document.getElementById('gachaBox').innerHTML.includes('div')) {
                document.getElementById('gachaBox').innerText = t.gachaBox;
            }
            document.getElementById('startBtn').innerText = t.startBtn;
            
            document.getElementById('txtFeedTitle').innerText = t.feed;
            document.getElementById('txtCleanTitle').innerText = t.clean;
            document.getElementById('txtPetTitle').innerText = t.pet;
            // 🌟 更新任務按鈕文字
            const dailyTitleEl = document.getElementById('txtDailyTitle');
            const dailyDescEl = document.getElementById('txtDailyDesc');
            if (dailyTitleEl) dailyTitleEl.innerText = t.dailyTitle;
            if (dailyDescEl) dailyDescEl.innerText = t.dailyDesc;
            // 🌟 更新彈窗固定文字
            const modalHeader = document.getElementById('modalDailyHeader');
            const modalSub = document.getElementById('modalDailySub');
            const modalClose = document.getElementById('btnCloseDailyModal');
            if (modalHeader) modalHeader.innerText = t.modalDailyHeader;
            if (modalSub) modalSub.innerText = t.modalDailySub;
            if (modalClose) modalClose.innerText = t.closeBtn;

            // 🌟 14天簽到彈窗雙語文字
            const btnGift = document.getElementById('btnDailyGift');
            if (btnGift && t.dailyGiftTitle) btnGift.title = t.dailyGiftTitle;
            const checkInHeader = document.getElementById('modalCheckInHeader');
            if (checkInHeader && t.modalCheckInHeader) checkInHeader.innerText = t.modalCheckInHeader;
            const checkInSub = document.getElementById('modalCheckInSub');
            if (checkInSub && t.modalCheckInSub) checkInSub.innerText = t.modalCheckInSub;
            const closeCheckInBtn = document.getElementById('btnCloseCheckInModal');
            if (closeCheckInBtn && t.closeCalendarBtn) closeCheckInBtn.innerText = t.closeCalendarBtn;

            // 🌟 累計簽到大禮包雙語文字
            const modalStreakHeader = document.getElementById('modalStreakHeader');
            if (modalStreakHeader && t.modalStreakHeader) modalStreakHeader.innerText = t.modalStreakHeader;
            const txtStreakPrefix = document.getElementById('txtStreakPrefix');
            if (txtStreakPrefix && t.streakPrefix) txtStreakPrefix.innerText = t.streakPrefix;
            const txtStreakSuffix = document.getElementById('txtStreakSuffix');
            if (txtStreakSuffix && t.streakSuffix) txtStreakSuffix.innerText = t.streakSuffix;
            const txtTodayRewardTitle = document.getElementById('txtTodayRewardTitle');
            if (txtTodayRewardTitle && t.todayRewardTitle) txtTodayRewardTitle.innerText = t.todayRewardTitle;
            const btnClaimStreakReward = document.getElementById('btnClaimStreakReward');
            if (btnClaimStreakReward && t.claimStreakRewardBtn) btnClaimStreakReward.innerText = t.claimStreakRewardBtn;

            // 🌟 簽到按鈕文字更新
            const btnClaimCheckIn = document.getElementById('btnClaimCheckIn');
            if (btnClaimCheckIn) {
                const todayClaimed = (gameState.daily && gameState.daily.todayClaimed) || (gameState.checkInData && gameState.checkInData.todaySigned);
                btnClaimCheckIn.innerText = todayClaimed ? t.checkInClaimed : t.checkInBtn;
            }

            // 🌟 如果 14 天簽到面板正在開啟，即時刷新格子語言
            const checkInOverlay = document.getElementById('checkInModalOverlay');
            if (checkInOverlay && checkInOverlay.style.display !== 'none') {
                if (typeof openCheckInModal === 'function') {
                    openCheckInModal();
                } else if (gameState.checkInData && typeof renderCheckInGrid === 'function') {
                    renderCheckInGrid(gameState.checkInData);
                }
            }

            // 🌟 如果每日任務彈窗開著，也重新渲染任務清單以更新任務語言
            const dailyModal = document.getElementById('dailyModalOverlay');
            if (dailyModal && dailyModal.style.display !== 'none' && typeof openDailyModal === 'function') {
                openDailyModal();
            }

            // 🪪 身份證按鈕與名片彈窗（名字以外全部跟著語言切換）
            const idCardTexts = {
                txtIdCardTitle: t.idCardTitle,
                txtIdCardDesc: t.idCardDesc,
                idCardHeader: t.idCardHeader,
                idCardPhotoHint: t.idCardPhotoHint,
                idCardNameLabel: t.idCardNameLabel,
                idCardSpeciesLabel: t.idCardSpeciesLabel,
                btnCloseIdCard: t.closeIdCardBtn
            };
            for (const [id, text] of Object.entries(idCardTexts)) {
                const el = document.getElementById(id);
                if (el && text) el.innerText = text;
            }
            const btnEditPetName = document.getElementById('btnEditPetName');
            if (btnEditPetName && t.editNameTitle) btnEditPetName.title = t.editNameTitle;
            updateNameUI();

            // 🎨 調色盤文字
            const colorTexts = { txtColorTitle: t.colorTitle, txtColorCustom: t.colorCustom, btnCloseColor: t.colorDone };
            for (const [id, text] of Object.entries(colorTexts)) {
                const el = document.getElementById(id);
                if (el && text) el.innerText = text;
            }

            document.getElementById('tabSpecies').innerText = t.tabSpecies;
            document.getElementById('tabBg').innerText = t.tabBg;
            document.getElementById('tabEffect').innerText = t.tabEffect;

            // 🌟 同步更新連線按鈕與面板文字
            document.getElementById('btnToggleMp').innerText = t.mpBtn;
            if (!currentRoomId) {
                document.getElementById('roomStatusText').innerText = t.roomNotConnected;
            }
            document.getElementById('btnCreateRoom').innerText = t.createRoom;
            document.getElementById('btnJoinRoom').innerText = t.joinRoom;
            document.getElementById('btnChat').innerText = t.chat;
            document.getElementById('btnLeaveRoom').innerText = t.leaveRoom;
        }

        // 🌟 【防偷看機制】檢查是不是第一次玩，沒寵物就強迫顯示抽獎畫面
        function checkFirstTime() {
            if (!gameState.hasAdopted) {
                document.getElementById('gachaScreen').style.display = 'flex';
            } else {
                document.getElementById('gachaScreen').style.display = 'none';
                applySlugStyles();
                applyBg();
                applyEffect();
                updateUI();
            }
        }

        // 🌟 【新手隨機抽寵物】
        function rollGacha() {
            const box = document.getElementById('gachaBox');
            box.style.border = '5px solid transparent';
            box.style.animation = 'none';
            box.innerText = '...';
            
            setTimeout(() => {
                const keys = Object.keys(speciesData);
                const randomKey = keys[Math.floor(Math.random() * keys.length)]; // 隨機挑一隻
                
                gameState.unlockedSpecies = [randomKey];
                gameState.currentSpecies = randomKey;
                gameState.hasAdopted = true; // 標記為已經有寵物了
                
                document.getElementById('gachaTitle').innerText = speciesData[randomKey].name[currLang];
                box.style.border = 'none';
                box.style.boxShadow = 'none';
                box.innerHTML = `<div style="width:80px;height:80px;border-radius:25px;background:${speciesData[randomKey].body};border:4px solid ${speciesData[randomKey].outline}; box-shadow: 0 10px 20px rgba(0,0,0,0.1)"></div>`;
                
                document.getElementById('startBtn').style.display = 'block';
            }, 1000);
        }

       function startGame() {
    document.getElementById('gachaScreen').style.opacity = 0;
    setTimeout(() => {
        document.getElementById('gachaScreen').style.display = 'none';
        saveGame();
        applySlugStyles();
        renderShop();
        updateUI();
        
        // 🐣 新增這行：遊戲開始時，自動打開教學手冊讓玩家看！
        openManual(); 
        
    }, 500);
}

        const randomNames = {
            zh: ["不願意透露姓名的海兔", "代碼寫不完", "軟爛小麻糬", "霸道總裁的兔兔", "深海大鳳梨", "絕世好兔", "世界第一可愛", "拒絕 Debug", "寶寶的乖海兔", "不要吃我"],
            en: ["Bug Maker", "Mr. Squishy", "Not A Snail", "Sleepy Sluuuug", "Ocean Potato", "Error 404", "Sir Slime-a-lot", "Baby's Cutie"]
        };

        // 🌟 【打開身份證小魔法】
        function openIdCardModal() {
            document.getElementById('idCardModalOverlay').style.display = 'flex';
            updateNameUI(); // 每次打開前刷新一下最新資料
        }

        // 🌟 【名字與名片顯示小幫手】
        function updateNameUI() {
            const t = i18n[currLang] || i18n.zh;

            // 更新名片上的名字（玩家取的名字保持原樣，只有預設名字跟著語言走）
            const idCardNameDisplay = document.getElementById('idCardNameDisplay');
            if (idCardNameDisplay) {
                idCardNameDisplay.innerText = gameState.petName || t.defaultPetName;
            }

            // 同時偷偷更新一下名片上的品種，讓名片更專業
            const idCardSpeciesDisplay = document.getElementById('idCardSpeciesDisplay');
            if (idCardSpeciesDisplay) {
                const spec = speciesData[gameState.currentSpecies];
                idCardSpeciesDisplay.innerText = spec ? spec.name[currLang] : t.unknownSpecies;
            }
        }

// 🌟 全域變數：記錄現在是不是正在進行「付費改名」
        let isPaidRename = false; 

        function openNameModal() {
            // 如果已經有名字，且還沒答應付費，就跳出「付費確認窗」
            if (gameState.petName && !isPaidRename) {
                const promptModal = document.getElementById('renamePromptModal');
                if (promptModal) promptModal.style.display = 'flex';
                return; 
            }
            
            // 開啟輸入框
            const modal = document.getElementById('nameModalOverlay');
            const input = document.getElementById('petNameInput');
            
            document.getElementById('txtModalTitle').innerText = isPaidRename ? '修改名字 (扣 1000 積分)' : '給海兔寶寶取名';
            input.value = gameState.petName || ''; 
            modal.style.display = 'flex';
        }

        function proceedToRename() {
            document.getElementById('renamePromptModal').style.display = 'none';
            if (gameState.points < 1000) {
                showFloatText('積分不夠 1000 喔！快去解任務賺錢吧 😢');
                return;
            }
            isPaidRename = true; 
            openNameModal();
        }

        function closeNameModal() { 
            document.getElementById('nameModalOverlay').style.display = 'none'; 
            isPaidRename = false; 
        }

        function confirmName() {
            const newName = document.getElementById('petNameInput').value.trim();
            if (newName) {
                if (newName === gameState.petName) {
                    showFloatText('名字沒有變喔！');
                    closeNameModal();
                    return;
                }

                if (isPaidRename) {
                    if (gameState.points < 1000) {
                        showFloatText('積分不夠 1000 喔！😢');
                        return;
                    }
                    gameState.points -= 1000;
                    showFloatText('✨ 扣除 1000 積分，改名成功 ✨');
                } else {
                    showFloatText('✨ 命名成功 ✨');
                }

                gameState.petName = newName;
                updateNameUI();
                saveGame();
                if (typeof updateUI === 'function') updateUI(); 
                fetchAPI('/pet-games/rename', 'POST', { newName: newName });
            }
            closeNameModal();
        }

        function generateRandomName() {
            const pool = randomNames[currLang];
            const randomStr = pool[Math.floor(Math.random() * pool.length)];
            document.getElementById('petNameInput').value = randomStr;
        }

        // 切換商店的標籤頁 (幻獸/背景/特效)
        function switchTab(tab) {
            currentTab = tab;
            refreshAll(); 
            document.getElementById('tabSpecies').className = tab === 'species' ? 'tab active' : 'tab';
            document.getElementById('tabBg').className = tab === 'bg' ? 'tab active' : 'tab';
            document.getElementById('tabEffect').className = tab === 'effect' ? 'tab active' : 'tab';
        }

        // 🌟 把商品小方塊的底色填上。插畫型背景的 preview 是函式，回傳整個房間的縮圖，
        //    因為 data URI 不能塞進 HTML 的 style 屬性，所以改用 DOM 直接設定。
        function applyPreviewSwatch(card, item) {
            const swatch = card.querySelector('.item-color-preview');
            if (!swatch) return;
            swatch.style.background = typeof item.preview === 'function' ? item.preview() : item.preview;
        }

        // 🌟 【商店總管】幫你把商品排好，判斷你買過了沒
        function renderShop() {
            const grid = document.getElementById('shopGrid');
            grid.innerHTML = '';
            const t = i18n[currLang];
            
            const txtTry = currLang === 'zh' ? '👀 試用' : 'Try';
            const txtBuy = currLang === 'zh' ? '💰 購買' : 'Buy';
            const txtCancel = currLang === 'zh' ? '❌ 取消' : 'Cancel';

            let dataObj, unlockedArr, currentActive, typeKey, currentTrial;
            if (currentTab === 'species') { dataObj = speciesData; unlockedArr = gameState.unlockedSpecies; currentActive = gameState.currentSpecies; typeKey = 'species'; currentTrial = trialState.species; }
            else if (currentTab === 'bg') { dataObj = bgData; unlockedArr = gameState.unlockedBgs; currentActive = gameState.currentBg; typeKey = 'bg'; currentTrial = trialState.bg; }
            else { dataObj = effectData; unlockedArr = gameState.unlockedEffects; currentActive = gameState.currentEffect; typeKey = 'effect'; currentTrial = trialState.effect; }

            Object.keys(dataObj).forEach(key => {
                const item = dataObj[key];
                let isUnlocked = unlockedArr.includes(key); // 買過了沒
                let isEquipped = (currentActive === key) && !currentTrial; // 正穿著嗎
                let isTrialing = (currentTrial === key); // 正在試用嗎

                const card = document.createElement('div');
                card.className = `item-card ${isEquipped || isTrialing ? 'equipped' : ''}`;
                
                let actionHTML = '';
                if (isUnlocked) { // 買過了
                    let btnText = isEquipped ? t.equip : t.owned;
                    // 自選純色：穿上之後再點一次就打開調色盤
                    const isCustomColor = typeKey === 'bg' && key === 'none';
                    if (isCustomColor) btnText = isEquipped ? t.pickColor : t.owned;
                    actionHTML = `<div class="item-cost owned">${btnText}</div>`;
                    card.onclick = () => {
                        const wasEquipped = isEquipped;
                        equipItem(key, typeKey); // 點了直接穿上
                        if (isCustomColor && wasEquipped) openColorModal();
                    };
                } else if (isTrialing) { // 試用中
                    actionHTML = `
                        <div style="display:flex; gap:6px; justify-content:center; margin-top:5px;">
                            <div class="item-cost" style="background:#4ade80; font-size:0.8rem; padding:4px 8px; cursor:pointer;" onclick="buyItem('${key}', '${typeKey}', ${item.cost}, event)">${txtBuy}</div>
                            <div class="item-cost" style="background:#ef4444; font-size:0.8rem; padding:4px 8px; cursor:pointer;" onclick="cancelTrial('${typeKey}', event)">${txtCancel}</div>
                        </div>
                    `;
                } else { // 還沒買
                    actionHTML = `<div class="item-cost"><span style="font-size:0.7rem;margin-right:4px;">${txtTry}</span>${item.cost}</div>`;
                    card.onclick = () => tryItem(key, typeKey);
                }
                
                let previewStyle = typeKey === 'species'
                    ? `background:${item.body}; border: 3px solid ${item.outline}`
                    : `border: 3px solid #cbd5e1`;

                card.innerHTML = `
                    <div class="item-color-preview" style="${previewStyle}"></div>
                    <div class="item-name">${item.name[currLang]}</div>
                    ${actionHTML}
                `;
                if (typeKey !== 'species') applyPreviewSwatch(card, item);
                grid.appendChild(card);
            });
        }

        // 🌟 【百寶袋專屬邏輯】跟商店很像，只是過濾掉還沒買的東西
        function openCatalog() {
            document.getElementById('catalogModalOverlay').style.display = 'flex';
            renderCatalog();
        }
        function closeCatalog() { document.getElementById('catalogModalOverlay').style.display = 'none'; }
        
        function switchCatalogTab(tab) {
            currentTab = tab;
            document.getElementById('catTabSpecies').className = tab === 'species' ? 'tab active' : 'tab';
            document.getElementById('catTabBg').className = tab === 'bg' ? 'tab active' : 'tab';
            document.getElementById('catTabEffect').className = tab === 'effect' ? 'tab active' : 'tab';
            renderCatalog();
        }

        function renderCatalog() {
            const grid = document.getElementById('catalogGrid');
            grid.innerHTML = '';
            const t = i18n[currLang];
            
            let dataObj, unlockedArr, currentActive, typeKey;
            if (currentTab === 'species') { dataObj = speciesData; unlockedArr = gameState.unlockedSpecies; currentActive = gameState.currentSpecies; typeKey = 'species'; }
            else if (currentTab === 'bg') { dataObj = bgData; unlockedArr = gameState.unlockedBgs; currentActive = gameState.currentBg; typeKey = 'bg'; }
            else { dataObj = effectData; unlockedArr = gameState.unlockedEffects; currentActive = gameState.currentEffect; typeKey = 'effect'; }

            Object.keys(dataObj).forEach(key => {
                const item = dataObj[key];
                
                // 🌟 核心：如果沒擁有的直接跳過不顯示！
                if (!unlockedArr.includes(key)) return;

                let isEquipped = (currentActive === key);
                const card = document.createElement('div');
                card.className = `item-card ${isEquipped ? 'equipped' : ''}`;
                
                let btnText = isEquipped ? t.equip : t.owned;
                card.onclick = () => { 
                    equipItem(key, typeKey); 
                    renderCatalog(); // 點擊換上後馬上刷新按鈕狀態
                };

                let previewStyle = typeKey === 'species'
                    ? `background:${item.body}; border: 3px solid ${item.outline}`
                    : `border: 3px solid #cbd5e1`;

                card.innerHTML = `
                    <div class="item-color-preview" style="${previewStyle}"></div>
                    <div class="item-name">${item.name[currLang]}</div>
                    <div class="item-cost owned">${btnText}</div>
                `;
                if (typeKey !== 'species') applyPreviewSwatch(card, item);
                grid.appendChild(card);
            });
        }

        // 🌟 【穿上裝備】
        function equipItem(key, type) {
            trialState[type] = null; // 取消試用狀態
            
            if (type === 'species') gameState.currentSpecies = key;
            else if (type === 'bg') gameState.currentBg = key;
            else gameState.currentEffect = key;
            
            // 如果身上已經沒有任何試用的東西了，就把倒數計時器收起來
            if (!trialState.species && !trialState.bg && !trialState.effect) {
                if(trialInterval) clearInterval(trialInterval);
                document.getElementById('trialTimerDisplay').style.display = 'none';
            }
            
            refreshAll();
            saveGame();
        }

let trialTimeLeft = 10; // 全域記錄試用剩餘時間

function tryItem(key, type) {
            trialState[type] = key;
            refreshAll();
            
            if(trialTimer) clearTimeout(trialTimer);
            if(trialInterval) clearInterval(trialInterval);
            
            trialTimeLeft = 10;
            const timerDisplay = document.getElementById('trialTimerDisplay');
            const numDisplay = document.getElementById('trialCountdownNum');
            
            timerDisplay.style.display = 'block';
            numDisplay.innerText = trialTimeLeft;
            showFloatText('⏱️ 試用開始', 2000);
            
            startTrialCountdown();

            // 👇 新增這一段：自動把商店關起來，讓玩家馬上看效果！
            const shopPanel = document.getElementById('uiPanel');
            if (shopPanel && shopPanel.classList.contains('open')) {
                shopPanel.classList.remove('open');
            }
        }

        // 獨立出計時器啟動函式，方便暫停與恢復
        function startTrialCountdown() {
            if(trialInterval) clearInterval(trialInterval);
            const timerDisplay = document.getElementById('trialTimerDisplay');
            
            trialInterval = setInterval(() => {
                trialTimeLeft--;
                const numDisplay = document.getElementById('trialCountdownNum');
                if (numDisplay) numDisplay.innerText = trialTimeLeft;
                
                if(trialTimeLeft <= 0) {
                    clearInterval(trialInterval);
                    timerDisplay.style.display = 'none';
                    trialState = { species: null, bg: null, effect: null };
                    refreshAll();
                    showFloatText('✨ 試用結束，喜歡就帶回家吧！', 5000); 
                }
            }, 1000);
        }

// 🌟 1. 購買物品：只要負責扣錢跟解鎖就好，剩下的交給 equipItem
        function buyItem(key, type, cost, e) {
            if(e) e.stopPropagation(); 
            if (gameState.points >= cost) {
                gameState.points -= cost; // 扣錢
                
                // 記錄到本地的已解鎖清單
                if (type === 'species') gameState.unlockedSpecies.push(key); 
                else if (type === 'bg') gameState.unlockedBgs.push(key); 
                else gameState.unlockedEffects.push(key); 
                
                // 呼叫裝備函數 (裡面會統一發送 API 給伺服器)
                equipItem(key, type); 
                showFloatText('✨ 購買成功 ✨', 5000);
            } else {
                showFloatText('積分不足 😢');
            }
        }
// 🌟 【取消試用】按鈕的專屬煞車系統
        function cancelTrial(type, e) {
            // 防止點擊取消按鈕時，不小心點到背後的商品卡片
            if (e) e.stopPropagation(); 
            
            // 1. 把該部位的試用狀態清空
            trialState[type] = null; 
            
            // 2. 檢查是不是身上所有的試用都取消了？如果是，就把上面的倒數計時器關掉隱藏
            if (!trialState.species && !trialState.bg && !trialState.effect) {
                if (trialInterval) clearInterval(trialInterval);
                document.getElementById('trialTimerDisplay').style.display = 'none';
            }
            
            // 3. 重新刷新畫面，讓海兔一秒變回原本穿著的樣子
            refreshAll();
            showFloatText('✨ 已取消試用');
        }
        // 🌟 2. 裝備物品：不管你是剛買的還是早就有的，只要穿上就跟伺服器報備！
        function equipItem(key, type) {
            trialState[type] = null; 
            
            let categoryStr = '';
            if (type === 'species') {
                gameState.currentSpecies = key;
                categoryStr = 'pet_color';
            } else if (type === 'bg') {
                gameState.currentBg = key;
                categoryStr = 'background_color';
            } else {
                gameState.currentEffect = key;
                categoryStr = 'background_effects';
            }
            
            // ✨ 在這裡統一告訴伺服器：我換裝備囉！
            fetchAPI('/pet-games/buy', 'POST', { category: categoryStr, itemName: key });
            
            // 取消試用計時器
            if (!trialState.species && !trialState.bg && !trialState.effect) {
                if(trialInterval) clearInterval(trialInterval);
                document.getElementById('trialTimerDisplay').style.display = 'none';
            }
            
            refreshAll();
            saveGame();
        }

        // 🌟 【一鍵畫面重繪】每次有改變就叫他幫忙把海兔、背景、特效全部重新畫一次
        function refreshAll() {
            applySlugStyles();
            applyBg();
            applyEffect();
            renderShop();
            updateRecallButtonVisibility(); // 確保浮動挑釁按鈕顯示正確

            // 🎨 檢查目前是否為 paint 特效，來決定左下角按鈕要不要顯示
            const palettePanel = document.getElementById('paintPalettePanel');
            if (palettePanel) {
                const activeEffect = trialState.effect || gameState.currentEffect;
                if (activeEffect === 'paint') {
                    palettePanel.style.display = 'flex';
                } else {
                    palettePanel.style.display = 'none';
                }
            }
        }

        // 把海兔塗上你選的顏色
        function applySlugStyles() {
            const spec = speciesData[trialState.species || gameState.currentSpecies];
            if(!spec) return;

            const root = document.documentElement;
            root.style.setProperty('--c-body', spec.body);
            root.style.setProperty('--c-outline', spec.outline);
            root.style.setProperty('--c-ear-top', spec.earTop);
            root.style.setProperty('--c-tail', spec.tail);
            root.style.setProperty('--c-spot', spec.spot);
            root.style.setProperty('--c-blush', spec.blush);
        }

        // 幫房間鋪上你選的背景
        function applyBg() {
            const bg = bgData[trialState.bg || gameState.currentBg];
            const stage = document.getElementById('mainStage');

            // 找不到對應背景時 (例如預設的 'sky' 不在 bgData 裡)，清掉行內樣式回到 CSS 預設的淺藍底，
            // 否則試用結束後會一直卡在試用的背景
            if (!bg) {
                stage.style.background = '';
                document.getElementById('dotPattern').style.opacity = '';
                return;
            }

            // 插畫型背景的 style 是函式，依舞台是寬扁還是直立挑版面
            let styleValue = bg.style;
            if (typeof styleValue === 'function') {
                const rect = stage.getBoundingClientRect();
                const mode = rect.height > 0 && rect.width / rect.height < 1.1 ? 'portrait' : 'wide';
                styleValue = styleValue(mode);
            }

            stage.style.background = styleValue;
            document.getElementById('dotPattern').style.opacity = bg.hasDots ? '0.9' : '0';
        }

 function applyEffect() {
            const layer = document.getElementById('effectLayer');
            
            // 🧹 1. 徹底清空圖層與「隱形滑鼠點擊事件」！(解決點擊螢幕還會落雷的關鍵)
            layer.innerHTML = ''; 
            layer.onpointerdown = null; 
            layer.style.pointerEvents = 'none';

            // 🛑 2. 【全域特效切換清道夫】所有特效的定時器與工作證都在這作廢
            if (window.sheepManagerFrame) cancelAnimationFrame(window.sheepManagerFrame);
            if (window.sheepSpawnTimeout) clearTimeout(window.sheepSpawnTimeout);
            window.currentSheepSession = null; // 作廢數羊羊工作證

            if (window.catAnimFrame) cancelAnimationFrame(window.catAnimFrame);
            if (window.meowTimeout) clearTimeout(window.meowTimeout);
            if (window.paintAnimFrame) cancelAnimationFrame(window.paintAnimFrame);
            if (window.paintTimeout) clearTimeout(window.paintTimeout);
            if (window.tomatoAnimFrame) cancelAnimationFrame(window.tomatoAnimFrame);
            if (window.tomatoFwTimeout) clearTimeout(window.tomatoFwTimeout);
            if (window.bugFreeAnimFrame) cancelAnimationFrame(window.bugFreeAnimFrame);
            if (window.bugFreeInterval) clearInterval(window.bugFreeInterval);
            if (window.heartbeatAnimFrame) cancelAnimationFrame(window.heartbeatAnimFrame);
            if (window.heartbeatTimeout) clearTimeout(window.heartbeatTimeout);
            if (window.recallAnimFrame) cancelAnimationFrame(window.recallAnimFrame);
            
            // 🛑 櫻花音樂徹底停止清道夫
            if (window.sakuraMusicTimer) clearTimeout(window.sakuraMusicTimer);
            if (window.sakuraNoteTimers && window.sakuraNoteTimers.length) {
                window.sakuraNoteTimers.forEach(t => clearTimeout(t));
                window.sakuraNoteTimers = [];
            }
            window.sakuraSessionId = null; 
            window.sakuraMusicActive = false;

            // 🛑 音符樂譜小遊戲清道夫
            if (window.staffPlayInterval) clearInterval(window.staffPlayInterval);
            if (window.staffPlayTimeout) clearTimeout(window.staffPlayTimeout);
            if (window.staffSpawnerInterval) clearInterval(window.staffSpawnerInterval);
            window.staffIsLooping = false;
            window.staffSessionId = null;

            // 🛑 閃電定時器與音效清道夫 (解決雷聲殘留的關鍵)
            if (window.lightningInterval) clearTimeout(window.lightningInterval);
            if (window.lightningCloudTimeout) clearTimeout(window.lightningCloudTimeout);
            if (window.synthStormRain) {
                try { window.synthStormRain.stop(); } catch(e) {}
                window.synthStormRain = null;
            }
            window.stormSessionId = null; // 🌟 關鍵：作廢雷神的工作證！

            // 🛑 幽靈與拉炮的工作證清道夫
            if (window.ghostInterval) clearTimeout(window.ghostInterval);
            window.ghostSessionId = null;
            if (window.partyInterval) clearTimeout(window.partyInterval);
            window.partySessionId = null;
// 👻 百鬼夜行清道夫 (把幽靈聲音、動畫跟工作證殺掉)
            if (window.ghostInterval) clearTimeout(window.ghostInterval);
            window.ghostSessionId = null;
            if (window.synthGhostAmbience) {
                try { window.synthGhostAmbience.stop(); } catch(e) {}
                window.synthGhostAmbience = null;
            }

            // 🎉 歡樂派對拉炮清道夫
            if (window.partyInterval) clearTimeout(window.partyInterval);
            window.partySessionId = null;
if (window.gearClockInterval) clearInterval(window.gearClockInterval);
            window.gearSessionId = null;
            // 🧹 拔除幽靈跟拉炮的專屬背景迷霧與樣式
            ['ghostEffectStyle', 'partyEffectStyle', 'confettiEffectStyle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
            // 🧹 移除舊特效殘留的 CSS 樣式表
            ['stormLightningStyle', 'ghostEffectStyle', 'partyEffectStyle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });

            // 隱藏自定義彈幕按鈕
            const customTauntBtn = document.getElementById('customTauntBtn');
            if (customTauntBtn) customTauntBtn.style.display = 'none';

            const effectKey = trialState.effect || gameState.currentEffect;
            const effect = effectData[effectKey];
            
            // 🛑 3. 檢查是不是無特效，如果是就提早結束
            if (!effect || effectKey === 'none') return;
            
            switch (effectKey) {

                // 🐈 【貓貓降臨】巨大化主子、空中 360 度轉圈圈、落地自由漫步＋喵喵聲
                case 'cat':
                    if (window.catAnimFrame) cancelAnimationFrame(window.catAnimFrame);
                    if (window.meowTimeout) clearTimeout(window.meowTimeout);
                    
                    const catContainer = document.createElement('div');
                    catContainer.id = 'catContainer';
                    catContainer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden;';
                    layer.appendChild(catContainer);

                    let activeCats = [];
                   const types = ['cat_calico', 'cat_grey', 'cat_siamese'];
                    const catCount = effect.count || 3;

                    for (let i = 0; i < catCount; i++) {
                        let el = document.createElement('div');
                        let type = types[i % types.length];
                        el.innerHTML = svgLib[type];
                        el.style.position = 'absolute';
                        
                        // 🌟 巨大化魔法：從原本的 65px 直接變大到 100px！
                        el.style.width = '100px';
                        el.style.height = '100px';
                        
                        catContainer.appendChild(el);

                        activeCats.push({
                            el: el,
                            x: 20 + i * 30, 
                            y: -20 - Math.random() * 20, 
                            targetFloor: 60 + Math.random() * 30, 
                            rot: 0,
                            // 🌟 轉圈圈魔法：給牠一個快速旋轉的動力 (有正有負，代表順時針或逆時針)
                            spinSpeed: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 5 + 5), 
                            fallSpeed: Math.random() * 0.15 + 0.1, 
                            state: 'falling',
                            vx: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.1 + 0.05),
                            vy: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.05 + 0.02), 
                            walkTimer: Math.random() * 10,
                            changeDirTimer: Math.random() * 100 
                        });
                    }

                    function scheduleNextMeow() {
                        if (gameState.currentEffect !== 'cat' && trialState.effect !== 'cat') return;
                        playMeowSound();
                        let nextTime = 4000 + Math.random() * 3000;
                        window.meowTimeout = setTimeout(scheduleNextMeow, nextTime);
                    }

                    if (window.meowTimeout) clearTimeout(window.meowTimeout);
                    window.meowTimeout = setTimeout(scheduleNextMeow, 500);

                    function renderCats() {
                        if (gameState.currentEffect !== 'cat' && trialState.effect !== 'cat') {
                            if (catContainer.parentNode) catContainer.parentNode.removeChild(catContainer);
                            if (window.meowTimeout) clearTimeout(window.meowTimeout);
                            return;
                        }
                        window.catAnimFrame = requestAnimationFrame(renderCats);

                        activeCats.forEach(c => {
                            if (c.state === 'falling') {
                                c.y += c.fallSpeed;
                                
                                // 🌟 讓貓貓在空中持續 360 度轉圈圈
                                c.rot += c.spinSpeed; 
                                
                                c.el.style.left = c.x + '%';
                                c.el.style.top = c.y + '%';
                                c.el.style.transform = `translate(-50%, -50%) rotate(${c.rot}deg)`;
                                c.el.style.zIndex = 99; 
                                
                                if (c.y >= c.targetFloor) {
                                    c.y = c.targetFloor;
                                    c.state = 'landing';
                                    c.rot = 0; // 落地瞬間乖乖站正
                                    setTimeout(() => { c.state = 'walking'; }, 300); 
                                }
                            } else if (c.state === 'landing') {
                                c.el.style.transform = `translate(-50%, -50%) scale(1.1, 0.9)`; 
                                c.el.style.zIndex = Math.floor(c.y) < 75 ? 5 : 15; 
                            } else if (c.state === 'walking') {
                                c.changeDirTimer -= 1;
                                if (c.changeDirTimer <= 0) {
                                    let rand = Math.random();
                                    if (rand < 0.2) { 
                                        c.vx = 0; c.vy = 0; 
                                    } else {
                                        c.vx = (Math.random() - 0.5) * 0.2;
                                        c.vy = (Math.random() - 0.5) * 0.1;
                                    }
                                    c.changeDirTimer = 50 + Math.random() * 150; 
                                }

                                c.x += c.vx;
                                c.y += c.vy;

                                if (c.x <= 5) { c.x = 5; c.vx = Math.abs(c.vx); }
                                if (c.x >= 95) { c.x = 95; c.vx = -Math.abs(c.vx); }
                                if (c.y <= 45) { c.y = 45; c.vy = Math.abs(c.vy); } 
                                if (c.y >= 95) { c.y = 95; c.vy = -Math.abs(c.vy); } 

                                c.el.style.zIndex = Math.floor(c.y) < 75 ? 5 : 15;

                                c.walkTimer += 0.15;
                                let isMoving = Math.abs(c.vx) > 0.01 || Math.abs(c.vy) > 0.01;
                                let bob = isMoving ? Math.abs(Math.sin(c.walkTimer)) * 1.5 : 0; 
                                
                                let flip = 1;
                                if (c.vx < -0.01) flip = -1;
                                else if (c.vx > 0.01) flip = 1;
                                else {
                                    if (c.el.style.transform.includes('scaleX(-1)')) flip = -1;
                                }
                                
                                c.el.style.left = c.x + '%';
                                c.el.style.top = (c.y - bob) + '%';
                                c.el.style.transform = `translate(-50%, -50%) scaleX(${flip})`;
                            }
                        });
                    }
                    renderCats();
                    break;
                   // 📺 【阿嬤的舊電視】CRT 舊電視掃描線 + 噪點濾鏡 + 畫面閃爍效果
                case 'tvStatic':
                    const tvFilter = document.createElement('div');
                    tvFilter.className = 'tv-filter-overlay';
                    layer.appendChild(tvFilter);
                    break;
                   // ⚙️ 【齒輪運轉】時間漩渦 ＋ 仿舊濾鏡 ＋ 鐘錶滴答聲 ＋「自然立耳・愛麗絲水藍裙白兔」
                case 'gear':
                    if (!document.getElementById('gearEffectStyle')) {
                        const style = document.createElement('style');
                        style.id = 'gearEffectStyle';
                        style.innerHTML = `
                            .pure-vortex-stage {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                pointer-events: none; z-index: 11; overflow: hidden;
                            }

                            .vintage-sepia-overlay {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                pointer-events: none; z-index: 1;
                                background: radial-gradient(circle at 50% 50%, rgba(254, 243, 199, 0.08) 30%, rgba(180, 83, 9, 0.16) 75%, rgba(69, 26, 3, 0.38) 100%);
                                mix-blend-mode: multiply;
                                animation: vintageFilmFlicker 8s ease-in-out infinite alternate;
                            }

                            .vintage-dust-film {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                pointer-events: none; z-index: 2;
                                opacity: 0.22;
                                mix-blend-mode: overlay;
                            }

                            @keyframes vintageFilmFlicker {
                                0% { opacity: 0.85; filter: contrast(1.05) brightness(0.98); }
                                50% { opacity: 1.0; filter: contrast(1.12) brightness(1.02); }
                                100% { opacity: 0.9; filter: contrast(1.08) brightness(0.96); }
                            }

                            .vortex-pure-watermark {
                                position: absolute; top: 50%; left: 50%;
                                width: 145vmin; height: 145vmin;
                                transform: translate(-50%, -50%);
                                color: #451a03;
                                opacity: 0.22;
                                pointer-events: none;
                                z-index: 3;
                                filter: sepia(0.65) blur(0.4px);
                                -webkit-mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 25%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0) 75%);
                                mask-image: radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 25%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0) 75%);
                            }

                            .faint-corner-gear {
                                position: absolute;
                                transform-origin: center center;
                                color: #451a03;
                                opacity: 0.13;
                                pointer-events: none;
                                z-index: 3;
                                filter: sepia(0.8) blur(0.3px);
                            }

                            .vortex-spin-cw { animation: spinVortexCW linear infinite; transform-origin: 500px 500px; }
                            .vortex-spin-ccw { animation: spinVortexCCW linear infinite; transform-origin: 500px 500px; }
                            
                            .clock-hand-hour { animation: spinVortexCW 45s linear infinite; transform-origin: 500px 500px; }
                            .clock-hand-minute { animation: spinVortexCW 15s linear infinite; transform-origin: 500px 500px; }
                            .clock-hand-second { animation: spinVortexCW 6s linear infinite; transform-origin: 500px 500px; }

                            .faint-spin-cw { animation: faintGearSpinCW linear infinite; }
                            .faint-spin-ccw { animation: faintGearSpinCCW linear infinite; }

                            @keyframes spinVortexCW { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                            @keyframes spinVortexCCW { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
                            @keyframes faintGearSpinCW { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
                            @keyframes faintGearSpinCCW { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(-360deg); } }

                            .rabbit-journey-actor {
                                position: absolute;
                                pointer-events: none;
                                z-index: 25;
                                will-change: transform;
                            }

                            /* 🐇 自然流暢的小跳步 */
                            @keyframes naturalRabbitHop {
                                0% { transform: translate(0, 0) scale(0.75); opacity: 0; }
                                8% { opacity: 1; }
                                16% { transform: translate(45px, -8px) scale(0.75); }
                                32% { transform: translate(90px, 0px) scale(0.75); }
                                48% { transform: translate(135px, -8px) scale(0.75); }
                                64% { transform: translate(180px, 0px) scale(0.75); }
                                80% { transform: translate(225px, -6px) scale(0.75); opacity: 1; }
                                92% { transform: translate(255px, -8px) scale(0.4); opacity: 0.85; }
                                100% { transform: translate(265px, -10px) scale(0.05); opacity: 0; }
                            }

                            /* 懷錶微幅晃動 */
                            @keyframes softWatchSway {
                                0% { transform: rotate(-8deg); }
                                100% { transform: rotate(10deg); }
                            }
                            .watch-pendulum {
                                transform-origin: 58px 56px;
                                animation: softWatchSway 0.35s ease-in-out infinite alternate;
                            }

                            @keyframes magicDoorLife {
                                0% { transform: scale(0); opacity: 0; }
                                15% { transform: scale(1); opacity: 1; }
                                70% { transform: scale(1); opacity: 1; }
                                88% { transform: scale(1); opacity: 1; }
                                95% { transform: scale(1); opacity: 0.8; }
                                100% { transform: scale(0.2); opacity: 0; }
                            }
                            .magic-portal-door {
                                position: absolute;
                                width: 85px; height: 120px;
                                transform-origin: bottom center;
                                pointer-events: none;
                                z-index: 24;
                                filter: drop-shadow(0 0 6px rgba(253, 224, 71, 0.45)) drop-shadow(0 4px 10px rgba(0,0,0,0.35));
                                animation: magicDoorLife 3.6s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
                            }

                            @keyframes doorSwingOpen {
                                0% { transform: rotateY(0deg); }
                                35% { transform: rotateY(0deg); }
                                55% { transform: rotateY(-80deg); }
                                88% { transform: rotateY(-80deg); }
                                95% { transform: rotateY(0deg); }
                                100% { transform: rotateY(0deg); }
                            }
                            .door-panel-swing {
                                transform-origin: left center;
                                animation: doorSwingOpen 3.6s ease-in-out forwards;
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    const gearStage = document.createElement('div');
                    gearStage.className = 'pure-vortex-stage';
                    const gearSessionId = Math.random();
                    window.gearSessionId = gearSessionId;

                    function playClockTick(isTick = true) {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            const now = ctx.currentTime;
                            const snapLen = Math.floor(ctx.sampleRate * 0.025);
                            const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
                            const snapData = snapBuf.getChannelData(0);
                            for (let i = 0; i < snapLen; i++) {
                                snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.003));
                            }
                            const snapSrc = ctx.createBufferSource();
                            snapSrc.buffer = snapBuf;
                            const snapFilter = ctx.createBiquadFilter();
                            snapFilter.type = 'bandpass';
                            snapFilter.frequency.setValueAtTime(isTick ? 2400 : 1800, now);
                            snapFilter.Q.setValueAtTime(3.0, now);

                            const snapGain = ctx.createGain();
                            snapGain.gain.setValueAtTime(0.35, now);
                            snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

                            snapSrc.connect(snapFilter);
                            snapFilter.connect(snapGain);
                            snapGain.connect(ctx.destination);
                            snapSrc.start(now);

                            const toneOsc = ctx.createOscillator();
                            toneOsc.type = 'triangle';
                            const baseFreq = isTick ? 1200 : 820;
                            toneOsc.frequency.setValueAtTime(baseFreq, now);
                            toneOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.045);

                            const toneGain = ctx.createGain();
                            toneGain.gain.setValueAtTime(0.28, now);
                            toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

                            toneOsc.connect(toneGain);
                            toneGain.connect(ctx.destination);
                            toneOsc.start(now);
                            toneOsc.stop(now + 0.05);
                        } catch (e) {}
                    }

                    function playPortalSound() {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();
                            const now = ctx.currentTime;

                            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.type = 'sine';
                                osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                                gain.gain.setValueAtTime(0.12, now + idx * 0.08);
                                gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.4);
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.start(now + idx * 0.08);
                                osc.stop(now + idx * 0.08 + 0.45);
                            });
                        } catch(e) {}
                    }

                    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
                    function createCleanClockRing(radius, fontSize, duration, isCW, hasTicks) {
                        let g = `<g class="${isCW ? 'vortex-spin-cw' : 'vortex-spin-ccw'}" style="animation-duration: ${duration}s;">`;
                        g += `<circle cx="500" cy="500" r="${radius + fontSize * 0.22}" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.45"/>`;
                        g += `<circle cx="500" cy="500" r="${radius - fontSize * 0.95}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>`;
                        
                        if (hasTicks) {
                            for (let i = 0; i < 60; i++) {
                                let angle = i * 6;
                                let isMajor = i % 5 === 0;
                                let tickLen = isMajor ? fontSize * 0.35 : fontSize * 0.18;
                                let y1 = 500 - radius + fontSize * 0.22;
                                g += `<line x1="500" y1="${y1}" x2="500" y2="${y1 + tickLen}" transform="rotate(${angle} 500 500)" stroke="currentColor" stroke-width="${isMajor ? 2.5 : 1.2}" opacity="0.55"/>`;
                            }
                        }
                        
                        numerals.forEach((num, i) => {
                            let angle = i * 30;
                            g += `<text x="500" y="${500 - radius + fontSize * 0.88}" fill="currentColor" font-size="${fontSize}" font-family="Times New Roman, serif" font-weight="900" text-anchor="middle" transform="rotate(${angle} 500 500)">${num}</text>`;
                        });
                        g += `</g>`;
                        return g;
                    }

                    let rings = '';
                    rings += createCleanClockRing(440, 70, 130, true, true);
                    rings += createCleanClockRing(330, 52, 95, false, true);
                    rings += createCleanClockRing(230, 38, 70, true, true);
                    rings += createCleanClockRing(150, 26, 45, false, true);
                    rings += createCleanClockRing(90, 18, 28, true, false);
                    rings += createCleanClockRing(50, 10, 18, false, false);

                    const handsHTML = `
                        <g class="clock-hand-hour">
                            <path d="M 500 530 L 493 500 L 495 320 L 485 300 L 500 240 L 515 300 L 505 320 L 507 500 Z" fill="currentColor" opacity="0.85"/>
                            <circle cx="500" cy="300" r="8" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.9"/>
                        </g>
                        <g class="clock-hand-minute">
                            <path d="M 500 545 L 495 500 L 497 210 L 488 190 L 500 130 L 512 190 L 503 210 L 505 500 Z" fill="currentColor" opacity="0.8"/>
                            <circle cx="500" cy="190" r="7" fill="none" stroke="currentColor" stroke-width="2" opacity="0.85"/>
                        </g>
                        <g class="clock-hand-second">
                            <line x1="500" y1="570" x2="500" y2="80" stroke="currentColor" stroke-width="2.2" opacity="0.75"/>
                            <circle cx="500" cy="140" r="5" fill="currentColor" opacity="0.8"/>
                            <polygon points="500,70 496,85 504,85" fill="currentColor" opacity="0.9"/>
                        </g>
                        <circle cx="500" cy="500" r="22" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.6"/>
                        <circle cx="500" cy="500" r="12" fill="currentColor" opacity="0.9"/>
                        <circle cx="500" cy="500" r="4" fill="#ffffff" opacity="0.8"/>
                    `;

                    function getFaintGearSVG(spokes) {
                        let spokeLines = '';
                        const count = spokes || 6;
                        for (let i = 0; i < count; i++) {
                            const deg = (360 / count) * i;
                            spokeLines += `<line x1="100" y1="28" x2="100" y2="172" stroke="currentColor" stroke-width="5" transform="rotate(${deg} 100 100)"/>`;
                        }
                        return `
                            <svg viewBox="0 0 200 200" width="100%" height="100%">
                                <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" stroke-width="18" stroke-dasharray="18 12" stroke-linecap="round"/>
                                <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" stroke-width="8"/>
                                <circle cx="100" cy="100" r="28" fill="none" stroke="currentColor" stroke-width="6"/>
                                ${spokeLines}
                                <circle cx="100" cy="100" r="12" fill="currentColor"/>
                            </svg>
                        `;
                    }

                    const faintGears = [
                        { x: '-2%', y: '-2%', size: 210, spokes: 6, dir: 'cw', dur: 48 },
                        { x: '16%', y: '-4%', size: 130, spokes: 8, dir: 'ccw', dur: 32 },
                        { x: '-3%', y: '16%', size: 140, spokes: 4, dir: 'ccw', dur: 36 },
                        { x: '102%', y: '-2%', size: 230, spokes: 8, dir: 'ccw', dur: 52 },
                        { x: '84%', y: '-3%', size: 125, spokes: 6, dir: 'cw', dur: 30 },
                        { x: '103%', y: '18%', size: 135, spokes: 4, dir: 'cw', dur: 35 },
                        { x: '-3%', y: '102%', size: 220, spokes: 8, dir: 'ccw', dur: 50 },
                        { x: '15%', y: '103%', size: 130, spokes: 4, dir: 'cw', dur: 34 },
                        { x: '-4%', y: '82%', size: 135, spokes: 6, dir: 'cw', dur: 36 },
                        { x: '102%', y: '102%', size: 240, spokes: 6, dir: 'cw', dur: 55 },
                        { x: '85%', y: '103%', size: 120, spokes: 8, dir: 'ccw', dur: 30 },
                        { x: '103%', y: '83%', size: 140, spokes: 4, dir: 'ccw', dur: 38 }
                    ];

                    let faintGearsHTML = '';
                    faintGears.forEach(g => {
                        faintGearsHTML += `
                            <div class="faint-corner-gear ${g.dir === 'cw' ? 'faint-spin-cw' : 'faint-spin-ccw'}" 
                                 style="left: ${g.x}; top: ${g.y}; width: ${g.size}px; height: ${g.size}px; animation-duration: ${g.dur}s;">
                                ${getFaintGearSVG(g.spokes)}
                            </div>
                        `;
                    });

                    gearStage.innerHTML = `
                        <div class="vintage-sepia-overlay"></div>
                        <svg class="vintage-dust-film" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <filter id="vintagePaperGrain">
                                    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
                                    <feColorMatrix type="matrix" values="0 0 0 0 0.4   0 0 0 0 0.25   0 0 0 0 0.1   0 0 0 0.35 0"/>
                                </filter>
                            </defs>
                            <rect width="100%" height="100%" filter="url(#vintagePaperGrain)"/>
                        </svg>
                        ${faintGearsHTML}
                        <svg class="vortex-pure-watermark" viewBox="0 0 1000 1000">
                            ${rings}
                            ${handsHTML}
                        </svg>
                    `;

                    layer.appendChild(gearStage);

                    let isTickState = true;
                    if (window.gearClockInterval) clearInterval(window.gearClockInterval);
                    window.gearClockInterval = setInterval(() => {
                        if (window.gearSessionId !== gearSessionId) return;
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'gear') {
                            clearInterval(window.gearClockInterval);
                            return;
                        }
                        playClockTick(isTickState);
                        isTickState = !isTickState;
                    }, 1000);

                    // 🐇🚪 【自然直立長耳 ＋ 水藍愛麗絲洋裝 ＋ 豆豆眼 ＋ 金懷錶軟萌白兔】
                    function spawnPocketWatchRabbit(startX, startY) {
                        const journeyDuration = 3.5;
                        
                        const doorEl = document.createElement('div');
                        doorEl.className = 'magic-portal-door';
                        doorEl.style.left = `${startX + 275}px`;
                        doorEl.style.top = `${startY - 45}px`;
                        doorEl.innerHTML = `
                            <svg viewBox="0 0 80 120" width="100%" height="100%" style="overflow:visible;">
                                <defs>
                                    <radialGradient id="portalTransLight" cx="50%" cy="55%" r="50%">
                                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65"/>
                                        <stop offset="45%" stop-color="#fde047" stop-opacity="0.35"/>
                                        <stop offset="85%" stop-color="#ca8a04" stop-opacity="0.18"/>
                                        <stop offset="100%" stop-color="#2d1b0d" stop-opacity="0.1"/>
                                    </radialGradient>
                                </defs>
                                <path d="M 10 115 L 10 40 A 30 30 0 0 1 70 40 L 70 115 Z" fill="#2d1b0d" stroke="#b45309" stroke-width="2.5"/>
                                <path d="M 15 112 L 15 42 A 25 25 0 0 1 65 42 L 65 112 Z" fill="url(#portalTransLight)"/>
                                <circle cx="40" cy="65" r="14" fill="#ffffff" opacity="0.25"/>
                                <g class="door-panel-swing">
                                    <path d="M 15 112 L 15 42 A 25 25 0 0 1 65 42 L 65 112 Z" fill="#5c2c16" stroke="#2d1b0d" stroke-width="2"/>
                                    <line x1="40" y1="20" x2="40" y2="112" stroke="#3e1a0a" stroke-width="2"/>
                                    <line x1="16" y1="70" x2="64" y2="70" stroke="#3e1a0a" stroke-width="2"/>
                                    <circle cx="58" cy="72" r="3.5" fill="#facc15" stroke="#78350f" stroke-width="1"/>
                                </g>
                            </svg>
                        `;
                        layer.appendChild(doorEl);

                        const rabbitEl = document.createElement('div');
                        rabbitEl.className = 'rabbit-journey-actor';
                        rabbitEl.style.left = `${startX}px`;
                        rabbitEl.style.top = `${startY}px`;
                        rabbitEl.style.animation = `naturalRabbitHop ${journeyDuration}s cubic-bezier(0.25, 0.1, 0.25, 1) forwards`;

                        rabbitEl.innerHTML = `
                            <svg viewBox="0 0 80 100" width="85px" height="106px" style="overflow:visible; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.22));">
                                <defs>
                                    <linearGradient id="aliceBlueClean" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#b6d8fb"/>
                                        <stop offset="100%" stop-color="#90c3fa"/>
                                    </linearGradient>
                                    <radialGradient id="pocketWatchGoldClean" cx="35%" cy="35%" r="65%">
                                        <stop offset="0%" stop-color="#fffbeb"/>
                                        <stop offset="45%" stop-color="#fcd34d"/>
                                        <stop offset="90%" stop-color="#d97706"/>
                                    </radialGradient>
                                </defs>

                                <g stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <!-- 1. 小棉花糖尾巴 -->
                                    <circle cx="12" cy="74" r="6.5" fill="#ffffff"/>

                                    <!-- 2. 小巧圓肉腳 -->
                                    <ellipse cx="28" cy="88" rx="6.5" ry="4" fill="#ffffff"/>
                                    <line x1="26" y1="87" x2="26" y2="90" stroke="#262626" stroke-width="1.1"/>
                                    <line x1="30" y1="87" x2="30" y2="90" stroke="#262626" stroke-width="1.1"/>

                                    <ellipse cx="50" cy="88" rx="6.5" ry="4" fill="#ffffff"/>
                                    <line x1="48" y1="87" x2="48" y2="90" stroke="#262626" stroke-width="1.1"/>
                                    <line x1="52" y1="87" x2="52" y2="90" stroke="#262626" stroke-width="1.1"/>

                                    <!-- 3. 水藍色連身裙 -->
                                    <path d="M 26 52 C 24 52 16 64 14 78 C 20 84 58 84 64 78 C 62 64 54 52 52 52 Z" fill="url(#aliceBlueClean)"/>
                                    <path d="M 14 78 Q 39 84 64 78" fill="none" stroke="#60a5fa" stroke-width="1.4"/>

                                    <!-- 4. 白色小圍裙與小花邊領 -->
                                    <path d="M 28 52 L 24 77 Q 39 81 54 77 L 50 52 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>
                                    <path d="M 27 46 C 22 50 27 54 39 54 C 51 54 56 50 51 46 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>
                                    <polygon points="15,62 20,57 19,66" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
                                    <circle cx="19" cy="62" r="1.3" fill="#e2e8f0" stroke="none"/>

                                    <!-- 5. 直立自然雙耳（頂端圓潤、內耳微粉） -->
                                    <!-- 左立耳 -->
                                    <path d="M 30 24 C 25 8 16 6 13 13 C 16 20 25 22 28 26 Z" fill="#ffffff"/>
                                    <path d="M 27 22 C 24 10 18 9 16 13 C 18 18 23 20 25 23 Z" fill="#ffd1dc" stroke="none"/>
                                    <!-- 右立耳 -->
                                    <path d="M 48 24 C 53 8 62 6 65 13 C 62 20 53 22 50 26 Z" fill="#ffffff"/>
                                    <path d="M 51 22 C 54 10 60 9 62 13 C 60 18 55 20 53 23 Z" fill="#ffd1dc" stroke="none"/>

                                    <!-- 6. 圓潤軟萌大頭部 -->
                                    <ellipse cx="39" cy="36" rx="19" ry="16" fill="#ffffff"/>

                                    <!-- 7. 雙耳間小巧黑色蝴蝶結髮飾 -->
                                    <path d="M 28 25 Q 39 21 50 25" fill="none" stroke="#1f2937" stroke-width="2"/>
                                    <path d="M 39 23 C 33 17 28 19 30 25 C 32 28 37 26 39 24 Z" fill="#1f2937"/>
                                    <path d="M 39 23 C 45 17 50 19 48 25 C 46 28 41 26 39 24 Z" fill="#1f2937"/>
                                    <circle cx="39" cy="23.5" r="2" fill="#374151"/>

                                    <!-- 8. 清爽豆豆眼 ＋ 柔粉腮紅 ＋ 萌嘴 -->
                                    <circle cx="32" cy="36" r="2.2" fill="#1f2937" stroke="none"/>
                                    <circle cx="46" cy="36" r="2.2" fill="#1f2937" stroke="none"/>

                                    <ellipse cx="26" cy="40" rx="3" ry="1.8" fill="#fca5a5" opacity="0.6" stroke="none"/>
                                    <ellipse cx="52" cy="40" rx="3" ry="1.8" fill="#fca5a5" opacity="0.6" stroke="none"/>

                                    <polygon points="39,37 38,38.2 40,38.2" fill="#fb923c" stroke="none"/>
                                    <path d="M 37.8 39.8 Q 39 40.6 40.2 39.8" fill="none" stroke="#262626" stroke-width="1.1"/>

                                    <!-- 9. 兩隻小手自然抱著懷錶 -->
                                    <ellipse cx="32" cy="56" rx="3.8" ry="3" fill="#ffffff" transform="rotate(15 32 56)"/>
                                    <ellipse cx="46" cy="56" rx="3.8" ry="3" fill="#ffffff" transform="rotate(-15 46 56)"/>

                                    <!-- 10. 精巧懷錶 -->
                                    <g class="watch-pendulum">
                                        <path d="M 39 57 Q 48 60 52 66" fill="none" stroke="#d97706" stroke-width="1.3" stroke-dasharray="1.8 1.2"/>
                                        <circle cx="54" cy="69" r="8" fill="url(#pocketWatchGoldClean)" stroke="#b45309" stroke-width="1.5"/>
                                        <circle cx="54" cy="69" r="6" fill="#ffffff" stroke="#78350f" stroke-width="0.9"/>
                                        <line x1="54" y1="69" x2="54" y2="65" stroke="#1f2937" stroke-width="1.1"/>
                                        <line x1="54" y1="69" x2="57" y2="69" stroke="#dc2626" stroke-width="0.9"/>
                                        <circle cx="54" cy="61" r="1.3" fill="#d97706"/>
                                    </g>
                                </g>
                            </svg>
                        `;
                        layer.appendChild(rabbitEl);

                        setTimeout(() => {
                            if (window.gearSessionId === gearSessionId) playPortalSound();
                        }, 2100);

                        setTimeout(() => {
                            if (rabbitEl.parentNode) rabbitEl.remove();
                            if (doorEl.parentNode) doorEl.remove();
                        }, journeyDuration * 1000 + 200);
                    }

                    layer.style.pointerEvents = 'auto';
                    layer.onpointerdown = (e) => {
                        if (window.sharedAudioCtx && window.sharedAudioCtx.state === 'suspended') {
                            window.sharedAudioCtx.resume();
                        }
                        playClockTick(true);

                        const rect = layer.getBoundingClientRect();
                        const clickX = e.clientX - rect.left - 30;
                        const clickY = e.clientY - rect.top - 20;

                        spawnPocketWatchRabbit(clickX, clickY);

                        if (!trialState.effect) {
                            gameState.points += 5;
                            saveGame();
                            updateUI();
                            showFloatText('🐇 立耳愛麗絲小兔 +5');
                        }
                    };
                    break;
                    
// 📐 【數學當機】正確數學公式（帶清晰背景框） + 發光滿版叉叉
                case 'math':
                    // 確保全部都是 100% 嚴謹正確的數學公式
                    const formulas = [
                        "E = mc²", 
                        "ax² + bx + c = 0", 
                        "x = (-b ± √(b² - 4ac)) / 2a", 
                        "sin²θ + cos²θ = 1", 
                        "A = πr²", 
                        "V = (4/3)πr³", 
                        "a² + b² = c²", 
                        "log_b(xy) = log_b(x) + log_b(y)"
                    ];
                    for(let i=0; i<6; i++) { // 維持 6 個，數量適中、清晰不雜亂
                        let el = document.createElement('div');
                        el.className = 'math-formula';
                        el.innerText = formulas[Math.floor(Math.random()*formulas.length)];
                        el.style.setProperty('--start-y', (Math.random() * 40 - 20) + 'vh');
                        el.style.setProperty('--end-y', (Math.random() * 40 - 20) + 'vh');
                        el.style.top = (Math.random() * 60 + 20) + '%';
                        el.style.animationDuration = (Math.random() * 4 + 8) + 's'; // 速度放慢至 8~12 秒，保證看得一清二楚
                        el.style.animationDelay = (Math.random() * 4) + 's';
                        layer.appendChild(el);
                    }
                    // 確保發光滿版叉叉再次出現
                    const mark = document.createElement('div');
                    mark.className = 'wrong-mark';
                    mark.innerText = '✕';
                    layer.appendChild(mark);
                    break;
            // 🐑 【數羊羊】完美零殘留防護版
                case 'sheep':
                    // 🌟 1. 每次進來時，強制把整個畫面容器（layer）徹底清空，殺光所有殘留特效！
                    layer.innerHTML = '';

                    // 🌟 2. 產生這一次特效的獨家「工作證編號」
                    const effectSessionId = Math.random();
                    window.currentSheepSession = effectSessionId;

                    // 🛑 強制清理舊的動畫與定時器
                    if (window.sheepManagerFrame) cancelAnimationFrame(window.sheepManagerFrame);
                    if (window.sheepSpawnTimeout) clearTimeout(window.sheepSpawnTimeout);

                    if (!document.getElementById('sheepStyle')) {
                        const style = document.createElement('style');
                        style.id = 'sheepStyle';
                        style.innerHTML = `
                            .sheep-night-overlay {
                                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                background: linear-gradient(to bottom, rgba(15, 23, 42, 0.45) 0%, rgba(30, 41, 59, 0.35) 65%, rgba(20, 45, 35, 0.5) 100%);
                                pointer-events: none; z-index: 1;
                                backdrop-filter: blur(1px);
                                animation: nightBreathe 4s ease-in-out infinite alternate;
                            }
                            @keyframes nightBreathe { 0% { opacity: 0.8; } 100% { opacity: 1; } }
                            
                            .sheep-grass-ground {
                                position: absolute; bottom: 0; left: 0; width: 100%; height: 22%;
                                background: linear-gradient(to top, rgba(34, 197, 94, 0.22) 0%, rgba(34, 197, 94, 0.08) 60%, transparent 100%);
                                pointer-events: none; z-index: 2;
                            }

                            .sheep-fence {
                                position: absolute; bottom: 4%; left: 42%;
                                transform: translateX(-50%); width: 240px; height: 120px; z-index: 4;
                            }

                            .sheep-control-panel {
                                position: absolute; bottom: 25px; right: 25px; left: auto;
                                transform: none; z-index: 20; display: flex; flex-direction: column;
                                align-items: flex-end; pointer-events: auto;
                            }

                            .sheep-count-btn {
                                background: linear-gradient(135deg, #fffbeb 0%, #fde047 50%, #f59e0b 100%);
                                border: 3px solid #78350f; color: #451a03;
                                font-family: 'Nunito', 'Microsoft JhengHei', sans-serif;
                                font-weight: 900; font-size: 1.05rem; padding: 12px 24px;
                                border-radius: 30px; cursor: pointer;
                                box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.8);
                                transition: all 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                                white-space: nowrap; display: flex; align-items: center; gap: 6px;
                            }
                            .sheep-count-btn:hover {
                                transform: translateY(-2px) scale(1.03);
                                box-shadow: 0 8px 25px rgba(245, 158, 11, 0.6);
                            }
                            .sheep-count-btn:active {
                                transform: translateY(3px) scale(0.97);
                            }

                            .interactive-sheep {
                                position: absolute; width: 135px; height: 105px; z-index: 5;
                                filter: drop-shadow(0 6px 8px rgba(0,0,0,0.2));
                            }
                            
                            .leg-back-1 { transform-origin: 50% 0%; animation: legRun1 0.28s infinite alternate ease-in-out; }
                            .leg-back-2 { transform-origin: 50% 0%; animation: legRun2 0.28s infinite alternate ease-in-out; }
                            .leg-front-1 { transform-origin: 50% 0%; animation: legRun2 0.28s infinite alternate ease-in-out; }
                            .leg-front-2 { transform-origin: 50% 0%; animation: legRun1 0.28s infinite alternate ease-in-out; }

                            @keyframes legRun1 { 0% { transform: rotate(-22deg); } 100% { transform: rotate(22deg); } }
                            @keyframes legRun2 { 0% { transform: rotate(22deg); } 100% { transform: rotate(-22deg); } }
                        `;
                        document.head.appendChild(style);
                    }

                    // 3. 建立背景與柵欄
                    const nightOverlay = document.createElement('div');
                    nightOverlay.className = 'sheep-night-overlay';
                    layer.appendChild(nightOverlay);

                    const grassGround = document.createElement('div');
                    grassGround.className = 'sheep-grass-ground';
                    layer.appendChild(grassGround);

                    const fence = document.createElement('div');
                    fence.className = 'sheep-fence';
                    fence.innerHTML = `<svg viewBox="0 0 250 130" width="100%" height="100%">
                        <defs>
                            <linearGradient id="woodLogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#7a421b"/><stop offset="45%" stop-color="#a35f29"/><stop offset="100%" stop-color="#542c0f"/>
                            </linearGradient>
                            <linearGradient id="woodPlankGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#b0723d"/><stop offset="100%" stop-color="#6e3c17"/>
                            </linearGradient>
                        </defs>
                        <ellipse cx="212" cy="118" rx="22" ry="7" fill="rgba(0,0,0,0.22)" filter="blur(2px)"/>
                        <ellipse cx="30" cy="85" rx="18" ry="6" fill="rgba(0,0,0,0.22)" filter="blur(2px)"/>
                        <path d="M 35 85 L 215 110" stroke="rgba(0,0,0,0.15)" stroke-width="8" filter="blur(3px)"/>
                        <g stroke="#3d1e08" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
                            <polygon points="35,44 215,82 215,100 35,62" fill="url(#woodPlankGrad)"/>
                            <polygon points="35,44 215,82 215,86 35,48" fill="#e3ab71" stroke="none"/>
                            <path d="M 35 44 L 215 82" stroke="#3d1e08" stroke-width="3"/>
                            <polygon points="35,14 215,52 215,70 35,32" fill="url(#woodPlankGrad)"/>
                            <polygon points="35,14 215,52 215,56 35,18" fill="#e3ab71" stroke="none"/>
                            <path d="M 35 14 L 215 52" stroke="#3d1e08" stroke-width="3"/>
                            <path d="M 20 12 Q 18 40 22 78 Q 34 82 44 78 Q 46 40 44 12 Z" fill="url(#woodLogGrad)"/>
                            <ellipse cx="32" cy="12" rx="12" ry="7" fill="#eed297" stroke="#3d1e08" stroke-width="3.5"/>
                            <ellipse cx="32" cy="12" rx="6" ry="3.5" fill="none" stroke="#a67c43" stroke-width="2"/>
                            <path d="M 198 45 Q 196 75 200 112 Q 214 116 224 112 Q 228 75 226 45 Z" fill="url(#woodLogGrad)"/>
                            <ellipse cx="212" cy="45" rx="14" ry="8" fill="#eed297" stroke="#3d1e08" stroke-width="3.5"/>
                            <ellipse cx="212" cy="45" rx="7" ry="4" fill="none" stroke="#a67c43" stroke-width="2"/>
                        </g>
                        <path d="M 190 115 Q 195 105 200 116 Q 206 102 212 118" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
                        <path d="M 10 85 Q 16 75 20 86 Q 26 73 32 88" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
                    </svg>`;
                    layer.appendChild(fence);

                    // 4. 按鈕面板
                    let sheepJumpedCount = 0;
                    const panel = document.createElement('div');
                    panel.className = 'sheep-control-panel';
                    
                    const jumpBtn = document.createElement('button');
                    jumpBtn.className = 'sheep-count-btn';
                    jumpBtn.innerHTML = `<span>🐑</span> <span>讓羊跳躍！ (已數: 0 隻 💤)</span>`;
                    panel.appendChild(jumpBtn);
                    layer.appendChild(panel);

                    const sheepPalettes = [
                        { wool: '#ffffff', face: '#8c8585', stroke: '#4d4a4d' },
                        { wool: '#fce7f3', face: '#a89498', stroke: '#594549' },
                        { wool: '#fef08a', face: '#948a79', stroke: '#4d4436' },
                        { wool: '#e0e7ff', face: '#8089a8', stroke: '#414861' },
                        { wool: '#f3e8ff', face: '#9786ab', stroke: '#4e3f5e' }
                    ];

                    let sheepList = [];
                    let sheepIdCounter = 0;

                    function createSheepDOM(pal) {
                        const el = document.createElement('div');
                        el.className = 'interactive-sheep';
                        el.innerHTML = `<svg viewBox="0 0 180 140" width="100%" height="100%">
                            <g stroke="${pal.stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M 28 48 C 14 42 6 54 15 68 C 22 72 30 62 28 48 Z" fill="${pal.face}" />
                                <g class="leg-back-1"><rect x="52" y="96" width="20" height="26" rx="10" fill="${pal.stroke}" /></g>
                                <g class="leg-back-2"><rect x="88" y="96" width="20" height="26" rx="10" fill="${pal.stroke}" /></g>
                                <path d="M 105 88 C 118 90 120 74 118 62 C 125 50 115 36 102 34 C 94 22 78 20 66 26 C 54 18 38 22 30 32 C 18 38 14 52 20 64 C 12 76 22 90 34 92 C 44 102 62 102 70 94 C 82 102 98 98 105 88 Z" fill="${pal.wool}" />
                                <g class="leg-front-1"><rect x="40" y="96" width="22" height="26" rx="11" fill="${pal.face}" /></g>
                                <g class="leg-front-2"><rect x="80" y="96" width="22" height="26" rx="11" fill="${pal.face}" /></g>
                                <path d="M 125 32 C 132 28 138 34 133 40 Z" fill="${pal.face}" />
                                <path d="M 98 35 C 85 30 76 38 84 46 C 92 50 98 42 98 35 Z" fill="${pal.face}" />
                                <path d="M 130 46 C 142 56 142 82 122 90 C 106 98 88 88 88 70 C 88 54 98 44 110 44 C 120 44 128 44 130 46 Z" fill="${pal.face}" />
                                <path d="M 134 38 C 140 28 128 20 120 24 C 114 16 102 18 98 26 C 90 24 86 34 92 40 C 104 46 124 46 134 38 Z" fill="${pal.wool}" />
                                <g fill="${pal.stroke}" stroke="none"><ellipse cx="120" cy="65" rx="4.5" ry="7" /><ellipse cx="106" cy="64" rx="4.5" ry="7" /><ellipse cx="115" cy="78" rx="4.5" ry="2.5" /></g>
                            </g>
                        </svg>`;
                        return el;
                    }

                    function getQueueX(slotIndex) {
                        return 28 - (slotIndex * 6);
                    }

                    function spawnWaitingSheep() {
                        if (window.currentSheepSession !== effectSessionId) return;
                        
                        let queueSheep = sheepList.filter(s => s.state !== 'jumping' && s.state !== 'running_away');
                        if (queueSheep.length < 5) {
                            let id = sheepIdCounter++;
                            let pal = sheepPalettes[id % sheepPalettes.length];
                            let dom = createSheepDOM(pal);
                            layer.appendChild(dom);

                            let targetSlot = queueSheep.length;
                            
                            let sheepObj = {
                                id: id,
                                dom: dom,
                                state: 'walking', 
                                slotIndex: targetSlot,
                                currentX: -15,
                                targetX: getQueueX(targetSlot),
                                baseY: 35,
                                runX: 0,
                                bobSeed: Math.random() * Math.PI * 2
                            };
                            sheepList.push(sheepObj);
                        }

                        window.sheepSpawnTimeout = setTimeout(spawnWaitingSheep, 1000);
                    }

                    function triggerJump() {
                        let readySheep = sheepList.find(s => s.slotIndex === 0 && (s.state === 'waiting' || s.state === 'walking'));
                        if (!readySheep) return;

                        readySheep.state = 'jumping';
                        readySheep.jumpProgress = 0;
                        sheepJumpedCount++;

                        sheepList.forEach(s => {
                            if (s.state !== 'jumping' && s.state !== 'running_away' && s.id !== readySheep.id) {
                                s.slotIndex--;
                                s.targetX = getQueueX(s.slotIndex);
                                s.state = 'walking';
                            }
                        });

                        jumpBtn.innerHTML = `<span>🐑</span> <span>讓羊跳躍！ (已數: ${sheepJumpedCount} 隻 💤)</span>`;
                        showFloatText(`第 ${sheepJumpedCount} 隻羊 💤`, 1200);
                    }

                    jumpBtn.onclick = (e) => {
                        e.stopPropagation();
                        triggerJump();
                    };

                    function renderSheepEngine() {
                        if (window.currentSheepSession !== effectSessionId) {
                            sheepList.forEach(s => s.dom.remove());
                            sheepList = [];
                            return;
                        }
                        window.sheepManagerFrame = requestAnimationFrame(renderSheepEngine);

                        for (let i = sheepList.length - 1; i >= 0; i--) {
                            let s = sheepList[i];

                            if (s.state === 'walking') {
                                s.currentX += 0.35;
                                if (s.currentX >= s.targetX) {
                                    s.currentX = s.targetX;
                                    s.state = 'waiting';
                                }
                                s.dom.style.left = s.currentX + '%';
                                s.dom.style.bottom = s.baseY + 'px';
                                s.dom.style.transform = 'scale(1) rotate(0deg)';
                            } 
                            else if (s.state === 'waiting') {
                                s.bobSeed += 0.04;
                                let gentleBob = Math.sin(s.bobSeed) * 2; 
                                s.dom.style.left = s.currentX + '%';
                                s.dom.style.bottom = (s.baseY + gentleBob) + 'px';
                                s.dom.style.transform = 'scale(1) rotate(0deg)';
                            } 
                            else if (s.state === 'jumping') {
                                s.jumpProgress += 0.02;
                                
                                let startX = s.currentX;
                                let endX = 70;
                                let curX = startX + (endX - startX) * s.jumpProgress;
                                
                                let arcY = Math.sin(s.jumpProgress * Math.PI) * 140;
                                let curY = s.baseY + arcY;
                                let rot = -Math.sin(s.jumpProgress * Math.PI) * 10;

                                s.dom.style.left = curX + '%';
                                s.dom.style.bottom = curY + 'px';
                                s.dom.style.transform = `scale(1.1) rotate(${rot}deg)`;

                                if (s.jumpProgress >= 1) {
                                    s.state = 'running_away';
                                    s.runX = curX;
                                }
                            }
                            else if (s.state === 'running_away') {
                                s.runX += 0.65;
                                s.dom.style.left = s.runX + '%';
                                s.dom.style.bottom = s.baseY + 'px';
                                s.dom.style.transform = 'scale(1) rotate(0deg)';

                                if (s.runX > 115) {
                                    s.dom.remove();
                                    sheepList.splice(i, 1);
                                }
                            }
                        }
                    }

                    renderSheepEngine();
                    spawnWaitingSheep();
                    break;
            
// 🍂 【落葉紛飛】逼真 SVG 葉子飄落效果：帶有暖黃色秋日氛圍濾鏡、柔美隨風搖擺與自然翻轉
                case 'leaf':
                    if (!document.getElementById('leafStyle')) {
                        const style = document.createElement('style');
                        style.id = 'leafStyle';
                        style.innerHTML = `
                            /* 🌟 僅落葉特效專屬：全畫面淡黃色秋日暖光濾鏡圖層 */
                            .leaf-warm-yellow-overlay {
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: radial-gradient(circle at 50% 30%, rgba(254, 243, 199, 0.35) 0%, rgba(253, 224, 71, 0.2) 60%, rgba(234, 179, 8, 0.15) 100%);
                                pointer-events: none;
                                z-index: 1;
                                mix-blend-mode: multiply;
                                animation: yellowGlowBreathe 8s ease-in-out infinite alternate;
                            }
                            @keyframes yellowGlowBreathe {
                                0% { opacity: 0.8; }
                                100% { opacity: 1.0; }
                            }

                            /* 🌟 微風輕撫版落葉：加入柔和的空氣浮力、慢速擺動與靈動的微幅傾斜 */
                            .falling-leaf {
                                position: absolute;
                                top: -60px;
                                pointer-events: none;
                                z-index: 8;
                                transform-origin: center center;
                                animation: leafSwayAndFall linear infinite;
                            }
                            @keyframes leafSwayAndFall {
                                0% {
                                    transform: translateY(-5vh) translateX(0px) rotate(0deg) rotateX(0deg) rotateY(0deg);
                                    opacity: 0;
                                }
                                15% {
                                    opacity: 0.85;
                                }
                                30% {
                                    transform: translateY(28vh) translateX(var(--sway-distance)) rotate(25deg) rotateX(30deg) rotateY(120deg);
                                }
                                55% {
                                    transform: translateY(55vh) translateX(calc(var(--sway-distance) * -0.7)) rotate(-15deg) rotateX(-20deg) rotateY(240deg);
                                }
                                80% {
                                    transform: translateY(80vh) translateX(calc(var(--sway-distance) * 0.8)) rotate(30deg) rotateX(25deg) rotateY(360deg);
                                    opacity: 0.85;
                                }
                                100% {
                                    transform: translateY(108vh) translateX(calc(var(--sway-distance) * -0.3)) rotate(10deg) rotateX(0deg) rotateY(480deg);
                                    opacity: 0;
                                }
                            }`;
                        document.head.appendChild(style);
                    }

                    // 🌟 1. 建立僅落葉特效專屬的全畫面淡黃色暖光濾鏡
                    const yellowOverlay = document.createElement('div');
                    yellowOverlay.className = 'leaf-warm-yellow-overlay';
                    layer.appendChild(yellowOverlay);

                    // 🌟 2. 建立隨微風漂浮的落葉
                    const leafTypes = ['leaf', 'leaf_maple', 'leaf_ginkgo'];
                    const leafCount = 20;

                    for (let i = 0; i < leafCount; i++) {
                        let el = document.createElement('div');
                        el.className = 'falling-leaf';
                        
                        // 隨機挑選楓葉、銀杏或經典葉子 SVG
                        let typeKey = leafTypes[Math.floor(Math.random() * leafTypes.length)];
                        el.innerHTML = svgLib[typeKey] || svgLib['leaf'];

                        // 隨機尺寸與初始左右位置
                        let size = Math.random() * 26 + 24; // 24px ~ 50px
                        el.style.width = size + 'px';
                        el.style.height = size + 'px';
                        el.style.left = (Math.random() * 100) + '%';

                        // 隨機風吹左右搖擺幅度 (70px ~ 150px)
                        let swayDist = (Math.random() * 80 + 70) * (Math.random() > 0.5 ? 1 : -1);
                        el.style.setProperty('--sway-distance', swayDist + 'px');

                        // 隨機飄落速度 (8s ~ 14s) 與延遲時間
                        let duration = Math.random() * 6 + 8;
                        let delay = Math.random() * 6;
                        el.style.animationDuration = duration + 's';
                        el.style.animationDelay = delay + 's';
                        el.style.animationTimingFunction = 'ease-in-out';

                        layer.appendChild(el);
                    }
                    break;
// 🌀 【回程挑釁】背景底層流動自定義彈幕 + 藍色魔法火焰 + 滿版神祕藍色月相魔法陣 + 強力向內吸聚水流 + 半罩式清透大泡泡
                case 'disco':
                    if (!document.getElementById('recallStyle')) {
                        const style = document.createElement('style');
                        style.id = 'recallStyle';
                        style.innerHTML = `
                            /* 半罩式防護泡泡與四周霧感光暈 */
                            .recall-bubble {
                                position: absolute; width: 360px; height: 360px; transform: translate(-50%, -50%);
                                animation: bubbleBreathe 3s infinite ease-in-out, bubbleWobble 6s infinite linear;
                                background: radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.15) 8%, rgba(255, 255, 255, 0) 35%, rgba(56, 189, 248, 0.03) 65%, rgba(0, 191, 255, 0.08) 85%, rgba(255, 255, 255, 0.25) 100%);
                                box-shadow: inset 0 0 15px rgba(255, 255, 255, 0.2), inset 15px 0 30px rgba(56, 189, 248, 0.05), inset -15px 0 30px rgba(56, 189, 248, 0.05), 0 0 25px rgba(186, 230, 253, 0.6), 0 0 50px rgba(56, 189, 248, 0.3);
                                border: 1px solid rgba(255, 255, 255, 0.3); pointer-events: none; z-index: 15; border-radius: 50%;
                                -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 78%);
                                mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 52%, rgba(0,0,0,0) 78%);
                            }
                            
                            /* 泡泡四周漂浮的小氣泡粒子 */
                            .ambient-tiny-bubble { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(56,189,248,0.2)); border: 1px solid rgba(255,255,255,0.6); pointer-events: none; z-index: 14; animation: tinyBubbleFloat 3s infinite ease-out; }
                            @keyframes tinyBubbleFloat { 0% { transform: translate(0, 0) scale(0.5); opacity: 0; } 30% { opacity: 0.8; } 100% { transform: translate(var(--tx), var(--ty)) scale(1.2); opacity: 0; } }
                            
                            /* 地板外擴水波底座 */
                            .recall-ripple { position: absolute; width: 420px; height: 210px; transform: translate(-50%, -50%); pointer-events: none; z-index: 5; }
                            .wave-surge { transform-origin: center; animation: waveExpandAndFade 3.5s infinite cubic-bezier(0.1, 0.6, 0.3, 1); }
                            .ws-1 { animation-delay: 0s; } .ws-2 { animation-delay: 1.75s; }
                            @keyframes waveExpandAndFade { 0% { transform: scale(0.6); opacity: 0.9; stroke-width: 7px; } 70% { opacity: 0.4; } 100% { transform: scale(1.55); opacity: 0; stroke-width: 1.5px; } }
                            
                            @keyframes bubbleBreathe { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -52%) scale(1.02); } }
                            @keyframes bubbleWobble { 0%, 100% { border-radius: 50%; } 25% { border-radius: 51% 49% 52% 48% / 48% 52% 49% 51%; } 50% { border-radius: 49% 51% 48% 52% / 52% 48% 51% 49%; } 75% { border-radius: 52% 48% 51% 49% / 49% 51% 48% 52%; } }

                            /* 🌟 位於最底層背景的流動嘲諷彈幕層 */
                            .background-taunt-layer {
                                position: absolute;
                                width: 100%;
                                height: 100%;
                                top: 0;
                                left: 0;
                                pointer-events: none;
                                z-index: 0;
                                overflow: hidden;
                            }
                            .floating-taunt-text {
                                position: absolute;
                                font-family: 'Nunito', 'Microsoft JhengHei', sans-serif;
                                font-size: 1.4rem;
                                font-weight: 900;
                                color: rgba(186, 230, 253, 0.6);
                                text-shadow: 0 0 12px rgba(56, 189, 248, 0.8), 2px 2px 0px rgba(15, 23, 42, 0.9);
                                white-space: nowrap;
                                animation: floatLeftToRight linear infinite;
                            }
                            @keyframes floatLeftToRight {
                                0% { transform: translateX(-400px); }
                                100% { transform: translateX(calc(100vw + 400px)); }
                            }

                            /* 🌟 佔滿背景板的滿版神祕藍色月相魔法陣 */
                            .magic-circle-wrapper {
                                position: absolute;
                                width: 100%;
                                height: 100%;
                                top: 0;
                                left: 0;
                                pointer-events: none;
                                z-index: 1;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                perspective: 1000px;
                            }
                            .magic-circle-inner {
                                width: 850px;
                                height: 850px;
                                transform: rotateX(35deg) rotateZ(0deg);
                                animation: circleRotateAndGlow 40s linear infinite;
                                filter: drop-shadow(0 0 20px rgba(56, 189, 248, 0.9)) drop-shadow(0 0 45px rgba(2, 132, 199, 0.7));
                            }
                            @keyframes circleRotateAndGlow {
                                0% { transform: rotateX(35deg) rotateZ(0deg); }
                                100% { transform: rotateX(35deg) rotateZ(360deg); }
                            }

                            /* 🌟 最外圍的藍色魔法火焰外框 */
                            .magic-blue-flame-rim {
                                position: absolute;
                                width: 920px;
                                height: 920px;
                                border-radius: 50%;
                                border: 3px dashed rgba(125, 211, 252, 0.7);
                                box-shadow: 0 0 40px rgba(56, 189, 248, 0.9), inset 0 0 40px rgba(56, 189, 248, 0.6);
                                animation: flamePulse 2s ease-in-out infinite alternate, circleRotateAndGlow 25s linear reverse infinite;
                            }
                            @keyframes flamePulse {
                                0% { transform: rotateX(35deg) scale(0.98); opacity: 0.6; }
                                100% { transform: rotateX(35deg) scale(1.03); opacity: 1; }
                            }

                            /* 🌟 魔法陣上方飄動的神秘藍色魔法煙霧特效 */
                            .magic-smoke-layer {
                                position: absolute;
                                width: 100%;
                                height: 100%;
                                top: 0;
                                left: 0;
                                pointer-events: none;
                                z-index: 2;
                                background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.15) 0%, rgba(3, 105, 161, 0.3) 60%, rgba(15, 23, 42, 0.7) 100%);
                                opacity: 0.85;
                                animation: smokePulse 6s ease-in-out infinite alternate;
                            }
                            .smoke-wisp {
                                position: absolute;
                                background: radial-gradient(circle, rgba(186, 230, 253, 0.35) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 80%);
                                border-radius: 50%;
                                filter: blur(20px);
                                animation: smokeFloat linear infinite;
                            }
                            @keyframes smokeFloat {
                                0% { transform: translate(0, 0) scale(1); opacity: 0.2; }
                                50% { opacity: 0.6; transform: translate(var(--dx), var(--dy)) scale(1.4); }
                                100% { transform: translate(calc(var(--dx) * 2), calc(var(--dy) * 2)) scale(1.8); opacity: 0; }
                            }
                            @keyframes smokePulse {
                                0% { opacity: 0.7; }
                                100% { opacity: 0.95; }
                            }

                            /* 🌊 水流被強力吸過來的龍捲風特效 */
                            .suction-water-wrapper {
                                position: absolute;
                                width: 500px;
                                height: 500px;
                                transform: translate(-50%, -50%);
                                pointer-events: none;
                                z-index: 8;
                            }
                            .suction-stream {
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                width: 100%;
                                height: 100%;
                                transform: translate(-50%, -50%);
                                animation: waterPullIn 1.2s linear infinite;
                            }
                            @keyframes waterPullIn {
                                0% { transform: translate(-50%, -50%) rotate(var(--angle)) scale(1.4); opacity: 0; }
                                20% { opacity: 0.9; }
                                80% { opacity: 0.9; }
                                100% { transform: translate(-50%, -50%) rotate(var(--angle)) scale(0.2); opacity: 0; }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    if (window.recallAnimFrame) cancelAnimationFrame(window.recallAnimFrame);
                    const slugEl = document.getElementById('slugContainer');

                    // 1. 建立地板水波底座
                    const ripple = document.createElement('div');
                    ripple.className = 'recall-ripple';
                    ripple.innerHTML = `
                        <svg viewBox="0 0 420 210" width="100%" height="100%">
                            <defs>
                                <radialGradient id="seaPool" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85"/><stop offset="60%" stop-color="#0284c7" stop-opacity="0.5"/><stop offset="100%" stop-color="#0369a1" stop-opacity="0"/></radialGradient>
                                <filter id="seaDistort" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation="1.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                            </defs>
                            <g filter="url(#seaDistort)"><ellipse cx="210" cy="105" rx="160" ry="70" fill="url(#seaPool)" /></g>
                            <g filter="url(#seaDistort)"><ellipse class="wave-surge ws-1" cx="210" cy="105" rx="140" ry="60" fill="none" stroke="#ffffff" stroke-width="6" /><ellipse class="wave-surge ws-2" cx="210" cy="105" rx="120" ry="50" fill="none" stroke="#bae6fd" stroke-width="4" /></g>
                        </svg>
                    `;
                    layer.appendChild(ripple);

                    // 2. 🌟 建立背景底層的流動自定義彈幕層
                    const tauntLayer = document.createElement('div');
                    tauntLayer.className = 'background-taunt-layer';
                    
                    let userTaunts = safeJsonParse(localStorage.getItem('nudi_custom_taunts'), ["MISS! 打不到我~", "就這點傷害？我已經逃囉！", "哈哈，你抓不到我！"]);
                    
                    userTaunts.forEach((text, i) => {
                        let tEl = document.createElement('div');
                        tEl.className = 'floating-taunt-text';
                        tEl.innerText = text;
                        tEl.style.top = (15 + (i * 15)) + '%';
                        tEl.style.animationDuration = (Math.random() * 4 + 7) + 's';
                        tEl.style.animationDelay = (Math.random() * 5) + 's';
                        tauntLayer.appendChild(tEl);
                    });
                    layer.appendChild(tauntLayer);

                    // 3. 🌟 顯示外層的自定義彈幕按鈕
                    const btn = document.getElementById('customTauntBtn');
                    if (btn) btn.style.display = 'block';

                    // 4. 建立佔滿背景板的滿版神祕藍色月相魔法陣 + 藍色火焰外環
                    const magicCircle = document.createElement('div');
                    magicCircle.className = 'magic-circle-wrapper';
                    magicCircle.innerHTML = `
                        <div class="magic-blue-flame-rim"></div>
                        <div class="magic-circle-inner">
                            <svg viewBox="0 0 500 500" width="100%" height="100%">
                                <defs>
                                    <filter id="moonMagicGlow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="4" result="blur1" />
                                        <feGaussianBlur stdDeviation="1" result="blur2" />
                                        <feMerge><feMergeNode in="blur1"/><feMergeNode in="blur2"/><feMergeNode in="SourceGraphic"/></feMerge>
                                    </filter>
                                </defs>
                                <g filter="url(#moonMagicGlow)" fill="none" stroke="#bae6fd" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="250" cy="250" r="235" stroke-width="5"/>
                                    <circle cx="250" cy="250" r="220" stroke-width="2"/>
                                    <circle cx="250" cy="250" r="212" stroke-width="3" stroke-dasharray="6, 4"/>
                                    <g stroke-width="2">
                                        <circle cx="250" cy="55" r="24" fill="#0284c7"/><path d="M250,31 A24,24 0 0,1 250,79 Z" fill="#ffffff"/>
                                        <circle cx="375" cy="85" r="22" fill="#0284c7"/><path d="M375,63 A22,22 0 0,1 375,107 Z" fill="#ffffff"/>
                                        <circle cx="125" cy="85" r="22" fill="#0284c7"/><path d="M125,63 A22,22 0 0,0 125,107 Z" fill="#ffffff"/>
                                        <circle cx="435" cy="210" r="22" fill="#0284c7"/><circle cx="435" cy="210" r="22" fill="#ffffff" clip-path="inset(0 50% 0 0)"/>
                                        <circle cx="65" cy="210" r="22" fill="#0284c7"/><circle cx="65" cy="210" r="22" fill="#ffffff" clip-path="inset(0 0 0 50%)"/>
                                        <circle cx="400" cy="340" r="20" fill="#ffffff"/><path d="M400,320 A20,20 0 0,1 400,360 Z" fill="#0284c7"/>
                                        <circle cx="100" cy="340" r="20" fill="#ffffff"/><path d="M100,320 A20,20 0 0,0 100,360 Z" fill="#1e1b4b"/>
                                        <circle cx="250" cy="425" r="22" fill="#ffffff"/>
                                    </g>
                                    <circle cx="250" cy="250" r="160" stroke-width="2"/>
                                    <circle cx="250" cy="250" r="130" stroke-width="1.5" stroke-dasharray="4, 4"/>
                                    <circle cx="250" cy="250" r="95" stroke-width="2"/>
                                    <circle cx="250" cy="250" r="50" stroke-width="2"/>
                                    <circle cx="250" cy="250" r="20" stroke-width="1.5"/>
                                    <path d="M 250,90 L 330,350 L 110,200 L 390,200 L 170,350 Z" stroke-width="1.5" opacity="0.8"/>
                                    <path d="M 250,410 L 110,150 L 380,310 L 120,310 L 390,150 Z" stroke-width="1.5" opacity="0.8"/>
                                    <line x1="250" y1="15" x2="250" y2="485" stroke-width="1" opacity="0.6"/>
                                    <line x1="15" y1="250" x2="485" y2="250" stroke-width="1" opacity="0.6"/>
                                    <line x1="60" y1="60" x2="440" y2="440" stroke-width="1" opacity="0.6"/>
                                    <line x1="440" y1="60" x2="60" y2="440" stroke-width="1" opacity="0.6"/>
                                </g>
                            </svg>
                        </div>
                    `;
                    layer.appendChild(magicCircle);

                    // 5. 建立背景魔法藍色煙霧層
                    const magicSmoke = document.createElement('div');
                    magicSmoke.className = 'magic-smoke-layer';
                    for (let s = 0; s < 5; s++) {
                        let wisp = document.createElement('div');
                        wisp.className = 'smoke-wisp';
                        let size = Math.random() * 200 + 150;
                        wisp.style.width = size + 'px';
                        wisp.style.height = size + 'px';
                        wisp.style.left = (Math.random() * 80 + 10) + '%';
                        wisp.style.top = (Math.random() * 80 + 10) + '%';
                        wisp.style.setProperty('--dx', (Math.random() * 100 - 50) + 'px');
                        wisp.style.setProperty('--dy', (Math.random() * 100 - 50) + 'px');
                        wisp.style.animationDuration = (Math.random() * 4 + 4) + 's';
                        wisp.style.animationDelay = (Math.random() * 2) + 's';
                        magicSmoke.appendChild(wisp);
                    }
                    layer.appendChild(magicSmoke);

                    // 6. 建立強力向內吸聚的水流龍捲風
                    const suctionWater = document.createElement('div');
                    suctionWater.className = 'suction-water-wrapper';
                    
                    let suctionHTML = `<svg viewBox="0 0 400 400" width="100%" height="100%"><defs><linearGradient id="suctionGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0"/><stop offset="50%" stop-color="#38bdf8" stop-opacity="0.8"/><stop offset="100%" stop-color="#ffffff" stop-opacity="1"/></linearGradient><filter id="suctionGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#suctionGlow)" fill="none" stroke-linecap="round">`;
                    
                    const angles = [0, 60, 120, 180, 240, 300];
                    angles.forEach((angle, idx) => {
                        suctionHTML += `<div class="suction-stream" style="animation-delay: ${idx * 0.2}s; --angle: ${angle}deg;"><svg viewBox="0 0 400 400" width="100%" height="100%"><path d="M 350 200 C 300 200, 250 200, 200 200" stroke="url(#suctionGrad)" stroke-width="6"/></svg></div>`;
                    });
                    suctionHTML += `</g></svg>`;
                    suctionWater.innerHTML = suctionHTML;
                    layer.appendChild(suctionWater);

                    // 7. 建立半罩式防護泡泡
                    const pureBubble = document.createElement('div');
                    pureBubble.className = 'recall-bubble';
                    layer.appendChild(pureBubble);

// 即時追蹤海兔位置，讓水流與泡泡完美置中
                    function renderRecall() {
                        if (gameState.currentEffect !== 'disco' && trialState.effect !== 'disco') {
                            if (window.recallAnimFrame) cancelAnimationFrame(window.recallAnimFrame);
                            // 👻 這裡原本有兩行隱藏按鈕的「幽靈程式碼」，我們已經把它拔掉啦！
                            return;
                        }
                        window.recallAnimFrame = requestAnimationFrame(renderRecall);

                        const cx = slugEl.offsetLeft + slugEl.offsetWidth / 2;
                        const cy = slugEl.offsetTop + slugEl.offsetHeight / 2;

                        ripple.style.left = cx + 'px';
                        ripple.style.top = (cy + 90) + 'px'; 

                        suctionWater.style.left = cx + 'px';
                        suctionWater.style.top = (cy + 20) + 'px';

                        pureBubble.style.left = cx + 'px';
                        pureBubble.style.top = (cy + 45) + 'px'; 
                    }

                    renderRecall();
                    break;
// 🐥 【三隻小鴨漫步隊】點擊螢幕召喚飛奔集合＋腳踩水波「啪嗒啪嗒」踏步聲版！
case 'duck': {
    if (window.duckAnimFrame) cancelAnimationFrame(window.duckAnimFrame);
    if (window.duckPetalInterval) clearInterval(window.duckPetalInterval);
    if (window.duckStepInterval) clearInterval(window.duckStepInterval);
    if (window.duckQuackTimeout) clearTimeout(window.duckQuackTimeout);

    // 1. 池塘清透水藍背景底層
    const pondOverlay = document.createElement('div');
    pondOverlay.className = 'duck-pond-overlay';
    layer.appendChild(pondOverlay);

    // 2. 水波漣漪圖層容器
    const rippleContainer = document.createElement('div');
    rippleContainer.id = 'duckRippleLayer';
    rippleContainer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2;';
    layer.appendChild(rippleContainer);

    // 3. 建立 3 隻不同造型與個性的小鴨陣列
    const duckConfigs = [
        { type: 'duck', scale: 1.0, initX: 25, initY: 45, speed: 0.65 },       // 大姊：經典抱花鴨
        { type: 'duck_hat', scale: 0.92, initX: 60, initY: 65, speed: 0.75 },   // 二妹：草帽荷葉鴨
        { type: 'duck_heart', scale: 0.85, initX: 75, initY: 35, speed: 0.85 }  // 小弟：愛心魔法鴨
    ];

    const duckList = [];

    duckConfigs.forEach((cfg, idx) => {
        const duckEl = document.createElement('div');
        duckEl.className = 'giant-roaming-duck';
        duckEl.style.pointerEvents = 'none';
        duckEl.style.cursor = 'default';
        duckEl.style.transform = `scale(${cfg.scale})`;
        duckEl.innerHTML = `
            <div class="duck-waddle-body" style="animation-delay: ${idx * 0.2}s;">
                ${svgLib[cfg.type]}
            </div>
        `;
        layer.appendChild(duckEl);

        duckList.push({
            el: duckEl,
            scale: cfg.scale,
            x: cfg.initX,
            y: cfg.initY,
            targetX: cfg.initX,
            targetY: cfg.initY,
            state: 'roaming',
            stayTimer: 0,
            moveSpeed: cfg.speed,
            vx: 0.12,
            vy: 0.06,
            flip: 1,
            changeTimer: Math.random() * 80,
            stepFoot: 0
        });
    });

    // 🌟 4. 點擊舞台空白處觸發「全體鴨鴨集結召喚！」
    const mainStageEl = document.getElementById('mainStage');
    if (window.duckStageClickHandler) {
        mainStageEl.removeEventListener('click', window.duckStageClickHandler);
    }

    window.duckStageClickHandler = (e) => {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'duck') return;

        if (e.target.closest('#slugContainer') || e.target.closest('#floatingRecallBtn') || e.target.closest('#customTauntBtn')) {
            return;
        }

        const rect = mainStageEl.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * 100;
        const clickY = ((e.clientY - rect.top) / rect.height) * 100;

        const formationOffsets = [
            { dx: 0, dy: 0 },    // 大姊站正中心
            { dx: -12, dy: 6 },  // 二妹站左後方
            { dx: 12, dy: 8 }    // 小弟站右後方
        ];

        duckList.forEach((d, idx) => {
            d.state = 'running';
            d.targetX = Math.max(8, Math.min(92, clickX + formationOffsets[idx].dx));
            d.targetY = Math.max(22, Math.min(88, clickY + formationOffsets[idx].dy));
            d.stayTimer = 180 + Math.random() * 60;
        });

        // 召喚成功，播放清脆集合提示音
        playDingSound(2);
    };

    mainStageEl.addEventListener('click', window.duckStageClickHandler);

    // 🌟 5. 運動渲染引擎 (溫和散步不暴衝)
    function renderRoamingDucks() {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'duck') {
            if (window.duckAnimFrame) cancelAnimationFrame(window.duckAnimFrame);
            if (window.duckPetalInterval) clearInterval(window.duckPetalInterval);
            if (window.duckStepInterval) clearInterval(window.duckStepInterval);
            if (window.duckStageClickHandler) mainStageEl.removeEventListener('click', window.duckStageClickHandler);
            duckList.forEach(d => { if (d.el.parentNode) d.el.remove(); });
            return;
        }
        window.duckAnimFrame = requestAnimationFrame(renderRoamingDucks);

        duckList.forEach(d => {
            if (d.state === 'running') {
                const dx = d.targetX - d.x;
                const dy = d.targetY - d.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 1.2) {
                    d.vx = (dx / dist) * d.moveSpeed;
                    d.vy = (dy / dist) * d.moveSpeed;
                    d.x += d.vx;
                    d.y += d.vy;
                } else {
                    d.state = 'waiting';
                    d.vx = 0;
                    d.vy = 0;
                }
            } else if (d.state === 'waiting') {
                d.stayTimer--;
                if (d.stayTimer <= 0) {
                    d.state = 'roaming';
                    d.changeTimer = 30;
                }
            } else {
                d.changeTimer--;
                if (d.changeTimer <= 0) {
                    d.vx = (Math.random() - 0.5) * 0.22;
                    d.vy = (Math.random() - 0.5) * 0.16;
                    d.changeTimer = 90 + Math.random() * 90;
                }

                d.vx = Math.max(-0.18, Math.min(0.18, d.vx));
                d.vy = Math.max(-0.14, Math.min(0.14, d.vy));

                d.x += d.vx;
                d.y += d.vy;

                if (d.x <= 8) { d.x = 8; d.vx = Math.abs(d.vx); }
                if (d.x >= 92) { d.x = 92; d.vx = -Math.abs(d.vx); }
                if (d.y <= 22) { d.y = 22; d.vy = Math.abs(d.vy); }
                if (d.y >= 88) { d.y = 88; d.vy = -Math.abs(d.vy); }
            }

            if (d.flip === 1 && d.vx > 0.02) d.flip = -1;
            else if (d.flip === -1 && d.vx < -0.02) d.flip = 1;

            d.el.style.left = d.x + '%';
            d.el.style.top = d.y + '%';
            d.el.style.transform = `translate(-50%, -50%) scale(${d.scale}) scaleX(${d.flip})`;
        });
    }

    renderRoamingDucks();

    // 🌟 6. 每隻小鴨踩出水波漣漪 ＋ 同步播放「啪嗒」踏水聲！
    window.duckStepInterval = setInterval(() => {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'duck') {
            clearInterval(window.duckStepInterval);
            return;
        }

        const layerRect = layer.getBoundingClientRect();

        duckList.forEach(d => {
            const isMoving = Math.abs(d.vx) > 0.01 || Math.abs(d.vy) > 0.01;
            if (!isMoving && d.state === 'waiting') return;

            const duckRect = d.el.getBoundingClientRect();
            if (!duckRect.width || !duckRect.height) return;

            const ripple = document.createElement('div');
            ripple.className = 'duck-step-ripple';

            d.stepFoot = 1 - d.stepFoot;
            const centerX = duckRect.left - layerRect.left + (duckRect.width / 2);
            const footOffset = (d.stepFoot === 0 ? -18 : 18) * d.flip * d.scale;
            const posX = centerX + footOffset;
            const posY = duckRect.top - layerRect.top + (duckRect.height * 0.88);

            ripple.style.left = posX + 'px';
            ripple.style.top = posY + 'px';
            ripple.style.transform = `translate(-50%, -50%) scale(${d.scale})`;

            layer.appendChild(ripple);
            setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 1100);

            // 🌟 腳掌落水瞬間：同步播放超軟萌的啪嗒踏步聲！
            playDuckStepSound(d.scale);
        });
    }, 300);

    // 🌟 7. 周圍飄落花花與愛心
    const duckPetalSymbols = ['🌸', '🍃', '💖', '✨', '🌼', '🍀'];
    window.duckPetalInterval = setInterval(() => {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'duck') {
            clearInterval(window.duckPetalInterval);
            return;
        }

        const randomDuck = duckList[Math.floor(Math.random() * duckList.length)];
        const petal = document.createElement('div');
        petal.className = 'duck-flower-petal';
        petal.innerText = duckPetalSymbols[Math.floor(Math.random() * duckPetalSymbols.length)];
        
        let offsetX = randomDuck.x + (Math.random() * 16 - 8);
        let offsetY = randomDuck.y + (Math.random() * 16 - 8);
        petal.style.left = offsetX + '%';
        petal.style.top = offsetY + '%';
        petal.style.setProperty('--ndx', (Math.random() * 50 - 25) + 'px');

        layer.appendChild(petal);
        setTimeout(() => { if (petal.parentNode) petal.remove(); }, 1400);
    }, 380);

    break;
}
                // ⛩️ 【BUG 退散】超酷的賽博龐克符咒
                case 'bugFree':
                    if (!document.getElementById('talismanStyle')) {
                        const style = document.createElement('style');
                        style.id = 'talismanStyle';
                        style.innerHTML = `
                            .cyber-giant-talisman { position: absolute; width: 110px; height: 280px; background-color: #fef08a; background-image: radial-gradient(rgba(217, 119, 6, 0.25) 1px, transparent 1px); background-size: 5px 5px; border: 4px solid #dc2626; box-shadow: 0 0 35px rgba(220, 38, 38, 0.4); border-radius: 8px; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 10px 6px; box-sizing: border-box; z-index: 1; transform-origin: center center; animation: giantBreathe 6s ease-in-out infinite alternate; }
                            @keyframes giantBreathe { 0% { transform: translateX(-50%) scale(1) rotate(-2deg); opacity: 0.25; } 100% { transform: translateX(-50%) scale(1.03) rotate(2deg); opacity: 0.4; } }
                            .giant-content { display: flex; justify-content: center; gap: 10px; width: 100%; flex: 1; align-items: center; }
                            .giant-col { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 12px; font-family: "DFKai-SB", "BiauKai", "楷體", "Kaiti", serif; font-weight: 900; font-size: 26px; color: #b91c1c; text-shadow: 1px 1px 0px rgba(254, 240, 138, 0.8); text-align: center; }
                            .cyber-talisman { position: absolute; width: 65px; height: 160px; background-color: #fef08a; background-image: radial-gradient(rgba(217, 119, 6, 0.2) 1px, transparent 1px); background-size: 4px 4px; border: 3px solid #dc2626; box-shadow: 0 0 20px rgba(220, 38, 38, 0.7); border-radius: 6px; cursor: pointer; pointer-events: auto; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 6px 4px; box-sizing: border-box; perspective: 800px; transform-style: preserve-3d; transform-origin: center center; z-index: 3; }
                            .talisman-content { display: flex; justify-content: center; gap: 6px; width: 100%; flex: 1; align-items: center; }
                            .talisman-col { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 8px; font-family: "DFKai-SB", "BiauKai", "楷體", "Kaiti", serif; font-weight: 900; font-size: 18px; color: #b91c1c; text-shadow: 1px 1px 0px rgba(254, 240, 138, 0.8); text-align: center; }
                            .cyber-spark { position: absolute; width: 8px; height: 8px; background: #fbbf24; border-radius: 50%; box-shadow: 0 0 10px #ef4444; pointer-events: none; transition: transform 0.4s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.4s ease-out; z-index: 4; }
                        `;
                        document.head.appendChild(style);
                    }

                    if (window.bugFreeInterval) clearInterval(window.bugFreeInterval);
                    if (window.bugFreeAnimFrame) cancelAnimationFrame(window.bugFreeAnimFrame);

                    const spellPairs = [ { col1: "BUG退散", col2: "永不報錯" }, { col1: "順利PASS", col2: "綠燈常亮" }, { col1: "急急如律", col2: "BUG快滾" }, { col1: "神仙保佑", col2: "絕對不當" } ];
                    let activeTalismans = [];
                    const giantPairs = [ { col1: "天地玄宗", col2: "萬氣本根" }, { col1: "鎮壓百邪", col2: "永無代碼" }, { col1: "神威浩蕩", col2: "BUG退散" }, { col1: "太上老君", col2: "急急如律" } ];
                    const stageWidth = layer.offsetWidth || window.innerWidth;
                    
                    giantPairs.forEach((pair, index) => {
                        let giant = document.createElement('div');
                        giant.className = 'cyber-giant-talisman';
                        let posX = (stageWidth / 4) * (index + 0.5);
                        let posY = 20 + Math.random() * 35; 
                        giant.style.left = posX + 'px'; giant.style.top = posY + 'px'; giant.style.transform = 'translateX(-50%)'; giant.style.animationDelay = (index * 1.5) + 's';
                        giant.innerHTML = `<svg width="90" height="40" viewBox="0 0 90 40" style="opacity: 0.9;"><path d="M10,20 Q25,2 45,20 Q65,38 80,20" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/><circle cx="45" cy="10" r="4" fill="#dc2626"/><circle cx="20" cy="30" r="2.5" fill="#dc2626"/><circle cx="70" cy="30" r="2.5" fill="#dc2626"/></svg><div class="giant-content"><div class="giant-col">${pair.col1}</div><div class="giant-col">${pair.col2}</div></div><svg width="90" height="45" viewBox="0 0 90 45" style="opacity: 0.9;"><path d="M15,5 Q45,40 75,5 M22,15 Q45,42 68,15 M45,5 L45,35" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="45" cy="32" r="3.5" fill="#dc2626"/></svg>`;
                        layer.appendChild(giant);
                    });

                    class SoftTalisman {
                        constructor(containerWidth, containerHeight) {
                            this.el = document.createElement('div');
                            this.el.className = 'cyber-talisman';
                            this.w = 65; this.h = 160;
                            this.x = Math.random() * (containerWidth - this.w - 50) + 25;
                            this.y = -200; 
                            this.vy = 0.6 + Math.random() * 0.4; 
                            this.amplitude = 50 + Math.random() * 30; 
                            this.frequency = 0.006 + Math.random() * 0.004; 
                            this.angleSeed = Math.random() * Math.PI * 2; 
                            this.baseX = this.x;
                            this.markedForDeletion = false;

                            const pair = spellPairs[Math.floor(Math.random() * spellPairs.length)];
                            this.el.innerHTML = `<svg width="55" height="28" viewBox="0 0 55 28" style="opacity: 0.95;"><path d="M5,14 Q15,2 27,14 Q40,26 50,14" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/><circle cx="27" cy="6" r="3" fill="#dc2626"/><circle cx="12" cy="20" r="2" fill="#dc2626"/><circle cx="42" cy="20" r="2" fill="#dc2626"/></svg><div class="talisman-content"><div class="talisman-col">${pair.col1}</div><div class="talisman-col">${pair.col2}</div></div><svg width="55" height="32" viewBox="0 0 55 32" style="opacity: 0.95;"><path d="M10,4 Q27,28 45,4 M15,12 Q27,30 39,12 M27,4 L27,28" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="26" r="2.5" fill="#dc2626"/></svg>`;

                            // 點擊引爆符咒！
                            this.el.onclick = (e) => {
                                const rect = this.el.getBoundingClientRect();
                                const layerRect = layer.getBoundingClientRect();
                                const centerX = rect.left - layerRect.left + rect.width / 2;
                                const centerY = rect.top - layerRect.top + rect.height / 2;
                                this.markedForDeletion = true;
                                this.el.remove();

                                for(let i = 0; i < 10; i++) {
                                    let spark = document.createElement('div');
                                    spark.className = 'cyber-spark';
                                    spark.style.left = centerX + 'px'; spark.style.top = centerY + 'px';
                                    layer.appendChild(spark);
                                    requestAnimationFrame(() => {
                                        const angle = Math.random() * Math.PI * 2;
                                        const dist = Math.random() * 60 + 25;
                                        spark.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`;
                                        spark.style.opacity = '0'; 
                                    });
                                    setTimeout(() => { if (spark.parentNode) spark.remove(); }, 400);
                                }
                            };
                            layer.appendChild(this.el);
                        }
                        update(height) {
                            this.y += this.vy;
                            let progress = this.y * 0.007;
                            let swayX = Math.sin(this.angleSeed + progress) * this.amplitude;
                            let zFactor = Math.cos(this.angleSeed * 1.2 + progress * 1.5) * 25;
                            let currentX = this.baseX + swayX + zFactor;
                            let rotateX = Math.sin(progress * 2) * 18; 
                            let rotateY = Math.cos(progress * 1.5) * 25; 
                            let rotateZ = Math.sin(this.angleSeed + progress) * 15; 
                            let floatY = Math.sin(progress * 3) * 8; 
                            this.el.style.transform = `translate3d(${currentX}px, ${this.y + floatY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
                            if (this.y > height + 100) { this.markedForDeletion = true; this.el.remove(); }
                        }
                    }

                    function renderLoop() {
                        if (gameState.currentEffect !== 'bugFree' && trialState.effect !== 'bugFree') {
                            activeTalismans.forEach(t => t.el.remove()); activeTalismans = []; return;
                        }
                        window.bugFreeAnimFrame = requestAnimationFrame(renderLoop);
                        let h = layer.offsetHeight;
                        for (let i = activeTalismans.length - 1; i >= 0; i--) {
                            let t = activeTalismans[i];
                            t.update(h);
                            if (t.markedForDeletion) { activeTalismans.splice(i, 1); }
                        }
                    }

                    renderLoop();

                    function spawnTalisman() {
                        if (gameState.currentEffect !== 'bugFree' && trialState.effect !== 'bugFree') return;
                        if (activeTalismans.length < 7) { activeTalismans.push(new SoftTalisman(layer.offsetWidth, layer.offsetHeight)); }
                    }

                    spawnTalisman(); setTimeout(spawnTalisman, 1200); setTimeout(spawnTalisman, 2400);
                    window.bugFreeInterval = setInterval(spawnTalisman, 1800);
                    break;

                // 🌧️ 【綿綿細雨】極致朦朧升級版
                case 'rain':
                    for (let i = 0; i < 100; i++) { 
                        let el = document.createElement('div');
                        el.style.position = 'absolute'; el.style.left = Math.random() * 100 + '%'; el.style.top = '-60px'; 
                        el.innerHTML = svgLib['drop']; 
                        let size = Math.random() * 25 + 15; el.style.width = size + 'px'; el.style.height = size + 'px';
                        el.style.transform = 'rotate(15deg)';
                        let blurValue = Math.random() * 4; 
                        el.style.filter = `blur(${blurValue}px)`;
                        el.style.opacity = Math.random() * 0.4 + (1 - blurValue / 5) * 0.5; 
                        let duration = Math.random() * 1.5 + 0.8; 
                        el.style.animation = `rainFall ${duration}s linear infinite`;
                        el.style.animationDelay = (Math.random() * 3) + 's';
                        layer.appendChild(el);
                    }
                    break;

                // 🎆 【小番茄煙火】護眼護機流暢版：附帶黑色暗沉夜空濾鏡圖層
                case 'tomato':
                    if (!document.getElementById('tomatoStyle')) {
                        const style = document.createElement('style');
                        style.id = 'tomatoStyle';
                        style.innerHTML = `
                            /* 🌟 僅小番茄煙火特效專屬：全畫面黑色半透明夜空濾鏡圖層 */
                            .tomato-dark-overlay {
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: rgba(15, 23, 42, 0.55); /* 柔和深沉夜空黑藍色 */
                                pointer-events: none;
                                z-index: 1;
                                transition: opacity 0.5s ease;
                            }`;
                        document.head.appendChild(style);
                    }

                    // 🌟 1. 建立僅小番茄煙火特效專屬的全畫面黑色濾鏡圖層
                    const darkOverlay = document.createElement('div');
                    darkOverlay.className = 'tomato-dark-overlay';
                    layer.appendChild(darkOverlay);

                    if (window.tomatoFwInterval) clearInterval(window.tomatoFwInterval);
                    if (window.tomatoFwTimeout) clearTimeout(window.tomatoFwTimeout);
                    if (window.tomatoAnimFrame) cancelAnimationFrame(window.tomatoAnimFrame);

                    let canvas = document.getElementById('tomatoCanvas');
                    if (!canvas) {
                        canvas = document.createElement('canvas'); canvas.id = 'tomatoCanvas'; canvas.style.position = 'absolute'; canvas.style.top = '0'; canvas.style.left = '0'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '999';
                        layer.appendChild(canvas);
                    }

                    const ctx = canvas.getContext('2d');
                    let particles = [];

                    function createFirework(startX, startY, scale) {
                        let redCount = Math.floor(300 * scale);
                        let greenCount = Math.floor(100 * scale);

                        // 紅色番茄本體
                        for (let i = 0; i < redCount; i++) {
                            let angle = Math.random() * Math.PI * 2; let r = Math.random() > 0.6 ? 1.0 : Math.sqrt(Math.random()); 
                            let targetX = Math.cos(angle) * r * 85 * scale; let targetY = Math.sin(angle) * r * 75 * scale; 
                            let rand = Math.random(); let c = '#dc2626'; if (rand > 0.95) c = '#ffffff'; else if (rand > 0.4) c = '#ef4444'; 
                            particles.push({ startX: startX, startY: startY, x: startX, y: startY, tx: startX + targetX, ty: startY + targetY, color: c, alpha: 1, baseSize: Math.max(1.5, (Math.random() * 2.5 + 2) * scale), progress: 0, speed: Math.random() * 0.02 + 0.015 });
                        }
                        
                        // 綠色立體蒂頭
                        for (let i = 0; i < greenCount; i++) {
                            let branch = i % 7; let t = Math.random(); let targetX, targetY; let originY = -70 * scale; 
                            if (branch === 0) { targetX = t * 25 * scale; targetY = originY - t * 55 * scale; } else if (branch === 1) { targetX = -75 * t * scale; targetY = originY + 15 * t * scale; } else if (branch === 2) { targetX = -55 * t * scale; targetY = originY - 20 * t * scale; } else if (branch === 3) { targetX = -30 * t * scale; targetY = originY - 45 * t * scale; } else if (branch === 4) { targetX = 30 * t * scale; targetY = originY - 45 * t * scale; } else if (branch === 5) { targetX = 55 * t * scale; targetY = originY - 20 * t * scale; } else { targetX = 75 * t * scale; targetY = originY + 15 * t * scale; } 
                            targetX += (Math.random() - 0.5) * 6 * scale; targetY += (Math.random() - 0.5) * 6 * scale;
                            let rand = Math.random(); let c = '#16a34a'; if (rand > 0.95) c = '#ffffff'; else if (rand > 0.4) c = '#22c55e'; 
                            particles.push({ startX: startX, startY: startY, x: startX, y: startY, tx: startX + targetX, ty: startY + targetY, color: c, alpha: 1, baseSize: Math.max(1.5, (Math.random() * 3 + 2) * scale), progress: 0, speed: Math.random() * 0.02 + 0.015 });
                        }
                    }

                    function render() {
                        if (gameState.currentEffect !== 'tomato' && trialState.effect !== 'tomato') {
                            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
                            if (window.tomatoFwTimeout) clearTimeout(window.tomatoFwTimeout); return;
                        }
                        window.tomatoAnimFrame = requestAnimationFrame(render);
                        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 3; 

                        for (let i = particles.length - 1; i >= 0; i--) {
                            let p = particles[i];
                            p.progress += p.speed; if (p.progress >= 1) p.progress = 1;
                            let ease = 1 - Math.pow(1 - p.progress, 3);
                            p.x = p.startX + (p.tx - p.startX) * ease; p.y = p.startY + (p.ty - p.startY) * ease;
                            if (p.progress >= 1) { p.ty += 0.4; p.alpha -= 0.015; }
                            if (p.alpha <= 0) { particles.splice(i, 1); continue; }
                            let twinkleSize = p.baseSize * (0.7 + Math.random() * 0.5); let twinkleAlpha = p.alpha * (0.6 + Math.random() * 0.4);
                            ctx.beginPath(); ctx.arc(p.x, p.y, twinkleSize, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.globalAlpha = twinkleAlpha; ctx.fill();
                        }
                    }

                    render();

                    function randomLaunch() {
                        if (gameState.currentEffect !== 'tomato' && trialState.effect !== 'tomato') return;
                        if (particles.length < 1000) { // 防止卡頓，火花太多就先不射
                            canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
                            let targetX = canvas.width * (0.1 + Math.random() * 0.8); let targetY = canvas.height * (0.1 + Math.random() * 0.65);
                            let scale = 0.25 + Math.random() * 0.45;
                            createFirework(targetX, targetY, scale);
                        }
                        let nextLaunchTime = 1200 + Math.random() * 1300;
                        window.tomatoFwTimeout = setTimeout(randomLaunch, nextLaunchTime);
                    }
                    randomLaunch(); setTimeout(randomLaunch, 800); 
                    break;
                    // ❄️ 【初雪飄落】精緻 8 臂雪花與小雪點：附帶冬日冰藍冷色調濾鏡與飄逸搖擺效果
                case 'snow':
                    if (!document.getElementById('snowStyle')) {
                        const style = document.createElement('style');
                        style.id = 'snowStyle';
                        style.innerHTML = `
                            /* 🌟 僅初雪飄落特效專屬：全畫面冬日冷色調冰藍濾鏡圖層 */
                            .snow-cool-blue-overlay {
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: linear-gradient(180deg, rgba(224, 242, 254, 0.3) 0%, rgba(186, 230, 253, 0.2) 50%, rgba(147, 197, 253, 0.25) 100%);
                                backdrop-filter: contrast(1.02) brightness(1.03);
                                pointer-events: none;
                                z-index: 1;
                                animation: snowFrostBreathe 6s ease-in-out infinite alternate;
                            }
                            @keyframes snowFrostBreathe {
                                0% { opacity: 0.85; }
                                100% { opacity: 1.0; }
                            }

                            /* 🌟 精緻雪花慢速飄落與輕柔搖擺動畫 */
                            .falling-snowflake {
                                position: absolute;
                                top: -60px;
                                pointer-events: none;
                                z-index: 8;
                                transform-origin: center center;
                                animation: snowSwayAndFall linear infinite;
                            }
                            @keyframes snowSwayAndFall {
                                0% {
                                    transform: translateY(-5vh) translateX(0px) rotate(0deg) scale(0.9);
                                    opacity: 0;
                                }
                                15% { opacity: 0.95; }
                                50% { transform: translateY(50vh) translateX(var(--snow-sway)) rotate(180deg) scale(1.05); }
                                85% { opacity: 0.95; }
                                100% {
                                    transform: translateY(108vh) translateX(calc(var(--snow-sway) * -0.5)) rotate(360deg) scale(0.85);
                                    opacity: 0;
                                }
                            }`;
                        document.head.appendChild(style);
                    }

                    // 🌟 1. 建立僅初雪特效專屬的全畫面冬日冷色調濾鏡
                    const coolOverlay = document.createElement('div');
                    coolOverlay.className = 'snow-cool-blue-overlay';
                    layer.appendChild(coolOverlay);

                    // 🌟 2. 建立隨風舞動的精緻結晶雪花與小雪點
                    const snowTypes = ['snow', 'snow_dot'];
                    const snowCount = 28;

                    for (let i = 0; i < snowCount; i++) {
                        let el = document.createElement('div');
                        el.className = 'falling-snowflake';

                        let typeKey = snowTypes[Math.floor(Math.random() * snowTypes.length)];
                        el.innerHTML = svgLib[typeKey] || svgLib['snow'];

                        // 隨機大小：精緻雪花為 22px~42px，小雪點為 10px~18px
                        let size = typeKey === 'snow_dot' ? (Math.random() * 8 + 10) : (Math.random() * 20 + 22);
                        el.style.width = size + 'px';
                        el.style.height = size + 'px';
                        el.style.left = (Math.random() * 100) + '%';

                        // 隨機搖擺幅度
                        let swayDist = (Math.random() * 60 + 30) * (Math.random() > 0.5 ? 1 : -1);
                        el.style.setProperty('--snow-sway', swayDist + 'px');

                        // 隨機飄落時間 (6s ~ 11s) 與延遲
                        let duration = Math.random() * 5 + 6;
                        let delay = Math.random() * 5;
                        el.style.animationDuration = duration + 's';
                        el.style.animationDelay = delay + 's';

                        layer.appendChild(el);
                    }
                    break;
// 🦋 【蝴蝶翩翩】水彩翅脈 ＋ 滑鼠引蝶追隨 ＋ 空中浮空滑翔漫舞版！
case 'butterfly': {
    if (window.butterflyAnimFrame) cancelAnimationFrame(window.butterflyAnimFrame);

    // 1. 微光幽境柔霧圖層
    const mistOverlay = document.createElement('div');
    mistOverlay.className = 'butterfly-mist-overlay';
    layer.appendChild(mistOverlay);

    // 2. 100% 水彩暈染翅脈 SVG
    const uniqueButterflySVG = (flapDuration, flapDelay) => `
        <svg viewBox="0 0 100 100" width="100%" height="100%" style="overflow: visible; filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.85));">
            <defs>
                <linearGradient id="bfGradFore" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#2e1065"/>
                    <stop offset="35%" stop-color="#581c87"/>
                    <stop offset="70%" stop-color="#c084fc"/>
                    <stop offset="100%" stop-color="#bae6fd"/>
                </linearGradient>
                <linearGradient id="bfGradHind" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#3b0764"/>
                    <stop offset="50%" stop-color="#a855f7"/>
                    <stop offset="100%" stop-color="#e0e7ff"/>
                </linearGradient>
            </defs>
            <g class="butterfly-wing-l" style="animation-duration: ${flapDuration}s !important; animation-delay: ${flapDelay}s !important;">
                <path d="M 50 35 C 30 10, 4 18, 8 45 C 11 60, 32 58, 50 48 Z" fill="url(#bfGradFore)" stroke="#1e0847" stroke-width="1"/>
                <path d="M 50 42 C 34 32, 20 25, 12 28" stroke="#1e0847" stroke-width="0.9" fill="none" opacity="0.75"/>
                <path d="M 50 42 C 32 38, 18 36, 10 40" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <path d="M 50 42 C 35 46, 24 48, 15 54" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <ellipse cx="14" cy="22" rx="2.5" ry="1.2" transform="rotate(-30 14 22)" fill="#f5f3ff" opacity="0.85"/>
                <ellipse cx="9" cy="32" rx="2.2" ry="1" transform="rotate(-15 9 32)" fill="#f5f3ff" opacity="0.8"/>
                <ellipse cx="10" cy="44" rx="2" ry="1" transform="rotate(10 10 44)" fill="#f5f3ff" opacity="0.8"/>
                <path d="M 50 48 C 28 50, 15 68, 25 82 C 38 88, 46 70, 50 56 Z" fill="url(#bfGradHind)" stroke="#1e0847" stroke-width="1"/>
                <path d="M 50 52 C 38 60, 26 70, 24 76" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <path d="M 50 52 C 42 66, 36 78, 34 82" stroke="#1e0847" stroke-width="0.7" fill="none" opacity="0.75"/>
                <circle cx="21" cy="74" r="1.3" fill="#f5f3ff" opacity="0.8"/>
                <circle cx="28" cy="82" r="1.4" fill="#f5f3ff" opacity="0.8"/>
            </g>
            <g class="butterfly-wing-r" style="animation-duration: ${flapDuration}s !important; animation-delay: ${flapDelay}s !important;">
                <path d="M 50 35 C 70 10, 96 18, 92 45 C 89 60, 68 58, 50 48 Z" fill="url(#bfGradFore)" stroke="#1e0847" stroke-width="1"/>
                <path d="M 50 42 C 66 32, 80 25, 88 28" stroke="#1e0847" stroke-width="0.9" fill="none" opacity="0.75"/>
                <path d="M 50 42 C 68 38, 82 36, 90 40" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <path d="M 50 42 C 65 46, 76 48, 85 54" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <ellipse cx="86" cy="22" rx="2.5" ry="1.2" transform="rotate(30 86 22)" fill="#f5f3ff" opacity="0.85"/>
                <ellipse cx="91" cy="32" rx="2.2" ry="1" transform="rotate(15 91 32)" fill="#f5f3ff" opacity="0.8"/>
                <ellipse cx="90" cy="44" rx="2" ry="1" transform="rotate(-10 90 44)" fill="#f5f3ff" opacity="0.8"/>
                <path d="M 50 48 C 72 50, 85 68, 75 82 C 62 88, 54 70, 50 56 Z" fill="url(#bfGradHind)" stroke="#1e0847" stroke-width="1"/>
                <path d="M 50 52 C 62 60, 74 70, 76 76" stroke="#1e0847" stroke-width="0.8" fill="none" opacity="0.75"/>
                <path d="M 50 52 C 58 66, 64 78, 66 82" stroke="#1e0847" stroke-width="0.7" fill="none" opacity="0.75"/>
                <circle cx="79" cy="74" r="1.3" fill="#f5f3ff" opacity="0.8"/>
                <circle cx="72" cy="82" r="1.4" fill="#f5f3ff" opacity="0.8"/>
            </g>
            <path d="M 50 26 L 50 68" stroke="#1e0847" stroke-width="3" stroke-linecap="round"/>
            <path d="M 50 28 Q 36 18 32 8 M 50 28 Q 64 18 68 8" stroke="#c084fc" stroke-width="0.85" stroke-linecap="round" fill="none"/>
        </svg>
    `;

    // 🌟 3. 滑鼠追隨座標監聽器
    window.butterflyMouse = { x: 50, y: 50, active: false, idleTimer: null };
    const stageEl = document.getElementById('mainStage');

    if (window.bfMouseMoveHandler) {
        stageEl.removeEventListener('pointermove', window.bfMouseMoveHandler);
        stageEl.removeEventListener('pointerleave', window.bfMouseLeaveHandler);
    }

    window.bfMouseMoveHandler = (e) => {
        const rect = stageEl.getBoundingClientRect();
        window.butterflyMouse.x = ((e.clientX - rect.left) / rect.width) * 100;
        window.butterflyMouse.y = ((e.clientY - rect.top) / rect.height) * 100;
        window.butterflyMouse.active = true;

        clearTimeout(window.butterflyMouse.idleTimer);
        window.butterflyMouse.idleTimer = setTimeout(() => {
            window.butterflyMouse.active = false;
        }, 3500); // 滑鼠靜止 3.5 秒後恢復自由漫舞
    };

    window.bfMouseLeaveHandler = () => {
        window.butterflyMouse.active = false;
    };

    stageEl.addEventListener('pointermove', window.bfMouseMoveHandler);
    stageEl.addEventListener('pointerleave', window.bfMouseLeaveHandler);

    // 🌟 4. 建立 5 隻大蝴蝶
    const butterflyCount = 5;
    const butterflies = [];
    const spawnPositions = [
        { x: 20, y: 25 }, { x: 75, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 70 }, { x: 75, y: 70 }
    ];

    for (let i = 0; i < butterflyCount; i++) {
        const flapDur = Math.random() * 0.4 + 0.9;
        const flapDel = -(Math.random() * 1.5);

        const bEl = document.createElement('div');
        bEl.className = 'shadow-butterfly';
        bEl.innerHTML = uniqueButterflySVG(flapDur.toFixed(2), flapDel.toFixed(2));

        const size = Math.random() * 18 + 72; // 72px ~ 90px
        bEl.style.width = size + 'px';
        bEl.style.height = size + 'px';
        layer.appendChild(bEl);

        const initPos = spawnPositions[i];

        butterflies.push({
            id: i,
            el: bEl,
            x: initPos.x,
            y: initPos.y,
            vx: (Math.random() - 0.5) * 0.1,
            vy: (Math.random() - 0.5) * 0.1,
            targetX: Math.random() * 70 + 15,
            targetY: Math.random() * 60 + 20,
            angle: Math.random() * 360,
            speed: Math.random() * 0.08 + 0.12,
            flapTime: Math.random() * 100,
            flapFrequency: flapDur,
            targetChangeTimer: Math.random() * 120 + 80,
            // 每隻蝴蝶各自圍繞滑鼠的專屬角度與花圈半徑（防止大家疊在一塊）
            orbitAngle: (i / butterflyCount) * Math.PI * 2,
            orbitRadius: Math.random() * 10 + 8, // 8% ~ 18% 舞台半徑
            trailTimer: 0
        });
    }

    // 🌟 5. 滑鼠追隨 ＋ 空氣動力學浮空漫舞引擎
    function renderButterflies() {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'butterfly') {
            if (window.butterflyAnimFrame) cancelAnimationFrame(window.butterflyAnimFrame);
            if (window.bfMouseMoveHandler) {
                stageEl.removeEventListener('pointermove', window.bfMouseMoveHandler);
                stageEl.removeEventListener('pointerleave', window.bfMouseLeaveHandler);
            }
            butterflies.forEach(b => { if (b.el.parentNode) b.el.remove(); });
            return;
        }
        window.butterflyAnimFrame = requestAnimationFrame(renderButterflies);

        const stageW = layer.offsetWidth || window.innerWidth;
        const stageH = layer.offsetHeight || (window.innerHeight * 0.58);
        const mouse = window.butterflyMouse;

        butterflies.forEach(b => {
            // 🌟 判斷：若滑鼠在畫面中移動，目標自動設定為滑鼠周圍的優雅花圈點
            if (mouse && mouse.active) {
                b.orbitAngle += 0.015; // 圍繞滑鼠緩慢盤旋
                b.targetX = mouse.x + Math.cos(b.orbitAngle) * b.orbitRadius;
                b.targetY = mouse.y + Math.sin(b.orbitAngle) * (b.orbitRadius * 0.7);
            } else {
                // 自由悠哉漫遊
                b.targetChangeTimer--;
                if (b.targetChangeTimer <= 0) {
                    b.targetX = Math.random() * 72 + 14;
                    b.targetY = Math.random() * 62 + 18;
                    b.targetChangeTimer = Math.random() * 200 + 150;
                }
            }

            // 向量牽引力學
            const dx = b.targetX - b.x;
            const dy = b.targetY - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 1) {
                const curSpeed = mouse && mouse.active ? (b.speed * 1.35) : b.speed;
                const desiredVx = (dx / dist) * curSpeed;
                const desiredVy = (dy / dist) * curSpeed;
                b.vx += (desiredVx - b.vx) * 0.03;
                b.vy += (desiredVy - b.vy) * 0.03;
            }

            // 拍翅垂直浮空律動
            b.flapTime += 0.04;
            const floatLift = Math.sin(b.flapTime * (Math.PI * 2 / b.flapFrequency)) * 0.06;

            // 蝴蝶間防聚排斥避讓（只擦肩、不重疊）
            butterflies.forEach(other => {
                if (other.id === b.id) return;
                const sepX = b.x - other.x;
                const sepY = b.y - other.y;
                const d = Math.sqrt(sepX * sepX + sepY * sepY);
                if (d > 0 && d < 18) {
                    const repel = (18 - d) / 18;
                    b.vx += (sepX / d) * repel * 0.018;
                    b.vy += (sepY / d) * repel * 0.018;
                }
            });

            b.x += b.vx;
            b.y += b.vy + floatLift;

            // 邊界防護
            b.x = Math.max(8, Math.min(92, b.x));
            b.y = Math.max(12, Math.min(88, b.y));

            // 平滑朝向
            const moveAngle = Math.atan2(b.vy, b.vx) * (180 / Math.PI) + 90;
            let diff = (moveAngle - b.angle) % 360;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            b.angle += diff * 0.07;

            b.el.style.left = b.x + '%';
            b.el.style.top = b.y + '%';
            b.el.style.transform = `translate(-50%, -50%) rotate(${b.angle}deg)`;

            // 拖曳微光星塵
            b.trailTimer++;
            if (b.trailTimer % 8 === 0) {
                const spark = document.createElement('div');
                spark.className = 'butterfly-spark-trail';
                const px = (b.x / 100) * stageW;
                const py = (b.y / 100) * stageH;
                spark.style.left = (px + (Math.random() * 6 - 3)) + 'px';
                spark.style.top = (py + (Math.random() * 6 - 3)) + 'px';
                layer.appendChild(spark);
                setTimeout(() => { if (spark.parentNode) spark.remove(); }, 1200);
            }
        });
    }

    renderButterflies();
    break;
}
// 🌸 【櫻花飛舞】淡雅粉霧 ＋ 完整櫻花與花瓣混搭 ＋ 不規則 3D 飄落
                case 'sakura':
                    if (!document.getElementById('sakuraStyle')) {
                        const style = document.createElement('style');
                        style.id = 'sakuraStyle';
                        style.innerHTML = `
                            /* 🌟 1. 超清透淡粉色微光柔霧濾鏡（已調淡，不厚重） */
                            .sakura-mist-overlay {
                                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                background: radial-gradient(circle at 60% 35%, rgba(255, 241, 242, 0.18) 0%, rgba(251, 207, 232, 0.08) 60%, transparent 100%);
                                pointer-events: none; z-index: 1;
                                animation: sakuraSoftBreathe 6s ease-in-out infinite alternate;
                            }
                            @keyframes sakuraSoftBreathe {
                                0% { opacity: 0.6; }
                                100% { opacity: 0.9; }
                            }

                            /* 🌟 2. 櫻花空中微光散景（柔和淡化版） */
                            .sakura-bokeh-orb {
                                position: absolute; border-radius: 50%;
                                background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(251, 207, 232, 0.25) 50%, transparent 80%);
                                filter: blur(10px); pointer-events: none; z-index: 2;
                                animation: bokehPulse ease-in-out infinite alternate;
                            }
                            @keyframes bokehPulse {
                                0% { transform: translate(0, 0) scale(0.85); opacity: 0.2; }
                                100% { transform: translate(var(--bx), var(--by)) scale(1.15); opacity: 0.5; }
                            }

                            /* 🌟 3. 不規則 3D 翻滾與隨機氣流動畫 */
                            .falling-sakura-item {
                                position: absolute;
                                top: -80px;
                                pointer-events: none;
                                transform-origin: center center;
                                perspective: 600px;
                                animation: sakuraChaosFall linear infinite;
                            }
                            @keyframes sakuraChaosFall {
                                0% {
                                    transform: translateY(-5vh) translateX(0px) rotate(0deg) rotateX(0deg) rotateY(0deg);
                                    opacity: 0;
                                }
                                10% {
                                    opacity: var(--base-op, 0.9);
                                }
                                30% {
                                    transform: translateY(32vh) translateX(var(--drift-1)) rotate(var(--rot-1)) rotateX(var(--rx-1)) rotateY(var(--ry-1));
                                }
                                60% {
                                    transform: translateY(64vh) translateX(var(--drift-2)) rotate(var(--rot-2)) rotateX(var(--rx-2)) rotateY(var(--ry-2));
                                }
                                85% {
                                    opacity: var(--base-op, 0.9);
                                }
                                100% {
                                    transform: translateY(112vh) translateX(var(--drift-end)) rotate(var(--rot-end)) rotateX(var(--rx-end)) rotateY(var(--ry-end));
                                    opacity: 0;
                                }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // 1. 建立清透淡雅的粉色微光濾鏡
                    const sakuraOverlay = document.createElement('div');
                    sakuraOverlay.className = 'sakura-mist-overlay';
                    layer.appendChild(sakuraOverlay);

                    // 2. 建立 4 顆輕柔微光散景光斑
                    for (let b = 0; b < 4; b++) {
                        const orb = document.createElement('div');
                        orb.className = 'sakura-bokeh-orb';
                        const orbSize = Math.random() * 60 + 60;
                        orb.style.width = orbSize + 'px';
                        orb.style.height = orbSize + 'px';
                        orb.style.left = (Math.random() * 85 + 5) + '%';
                        orb.style.top = (Math.random() * 75 + 10) + '%';
                        orb.style.setProperty('--bx', (Math.random() * 30 - 15) + 'px');
                        orb.style.setProperty('--by', (Math.random() * 30 - 15) + 'px');
                        orb.style.animationDuration = (Math.random() * 3 + 4) + 's';
                        orb.style.animationDelay = (Math.random() * 2) + 's';
                        layer.appendChild(orb);
                    }

                    // 3. 混搭「完整櫻花朵」與「花瓣」的不規則飄落生成
                    const totalItems = 35;

                    for (let i = 0; i < totalItems; i++) {
                        const itemEl = document.createElement('div');
                        itemEl.className = 'falling-sakura-item';

                        // 🌸 分配圖案：每 4 片花瓣混入 1 朵完整盛開的櫻花
                        let typeKey = 'sakura_petal';
                        let isFullFlower = false;
                        if (i % 4 === 0) {
                            typeKey = 'sakura_flower';
                            isFullFlower = true;
                        } else if (i % 3 === 0) {
                            typeKey = 'sakura_petal_side';
                        }

                        itemEl.innerHTML = svgLib[typeKey] || svgLib['sakura_petal'];

                        // 景深大小分配
                        const depthTier = i % 4;
                        let pSize, blurPx, baseOp, zIdx;

                        if (depthTier === 0) {
                            // 前景（大顆、微虛化）
                            pSize = isFullFlower ? (Math.random() * 15 + 40) : (Math.random() * 15 + 32);
                            blurPx = Math.random() * 1.5 + 1.2;
                            baseOp = 0.8;
                            zIdx = 20;
                        } else if (depthTier === 1 || depthTier === 2) {
                            // 中景（清晰主要視覺）
                            pSize = isFullFlower ? (Math.random() * 10 + 26) : (Math.random() * 8 + 18);
                            blurPx = 0;
                            baseOp = 0.95;
                            zIdx = 8;
                        } else {
                            // 背景（細碎小花/花瓣）
                            pSize = isFullFlower ? (Math.random() * 6 + 18) : (Math.random() * 6 + 12);
                            blurPx = 0.6;
                            baseOp = 0.65;
                            zIdx = 3;
                        }

                        itemEl.style.width = pSize + 'px';
                        itemEl.style.height = pSize + 'px';
                        itemEl.style.left = (Math.random() * 115 - 10) + '%';
                        itemEl.style.zIndex = zIdx;
                        itemEl.style.setProperty('--base-op', baseOp);
                        if (blurPx > 0) itemEl.style.filter = `blur(${blurPx}px)`;

                        // 🌟 不規則隨機風向與多維度 3D 翻轉數值
                        const windForce = (Math.random() * 90 + 30) * (Math.random() > 0.35 ? 1 : -1);
                        const d1 = (Math.random() * 50 - 25) + (windForce * 0.4);
                        const d2 = (Math.random() * 60 - 30) + (windForce * 0.7);
                        const dEnd = (Math.random() * 70 - 35) + windForce;

                        itemEl.style.setProperty('--drift-1', d1 + 'px');
                        itemEl.style.setProperty('--drift-2', d2 + 'px');
                        itemEl.style.setProperty('--drift-end', dEnd + 'px');

                        // 隨機旋轉角度
                        itemEl.style.setProperty('--rot-1', (Math.random() * 90 - 45) + 'deg');
                        itemEl.style.setProperty('--rot-2', (Math.random() * 180 - 90) + 'deg');
                        itemEl.style.setProperty('--rot-end', (Math.random() * 360 - 180) + 'deg');

                        // 3D 翻轉角度
                        itemEl.style.setProperty('--rx-1', (Math.random() * 120) + 'deg');
                        itemEl.style.setProperty('--rx-2', (Math.random() * 240) + 'deg');
                        itemEl.style.setProperty('--rx-end', (Math.random() * 360) + 'deg');
                        itemEl.style.setProperty('--ry-1', (Math.random() * 180) + 'deg');
                        itemEl.style.setProperty('--ry-2', (Math.random() * 360) + 'deg');
                        itemEl.style.setProperty('--ry-end', (Math.random() * 540) + 'deg');

                        // 隨機飄落速度與錯開時間
                        const duration = Math.random() * 4 + 6; // 6s ~ 10s
                        const delay = Math.random() * 7;
                        itemEl.style.animationDuration = duration + 's';
                        itemEl.style.animationDelay = delay + 's';

                        layer.appendChild(itemEl);
                    }
                    // 🌸 啟動日式櫻花古箏輕音樂（平調子五聲音階，柔和循環）
                    startSakuraBGM();
                    break;
// 🌟 【繁星閃爍】四周淡金光暈 + 背景一閃一閃 + 金燦流星 + 滑鼠星塵拖尾
                case 'star': {
                    // 1. 建立四周淡金黃色呼吸光暈圖層
                    const goldenOverlay = document.createElement('div');
                    goldenOverlay.className = 'star-golden-vignette-overlay';
                    layer.appendChild(goldenOverlay);

                    // 2. 建立背景一閃一閃的定點微光星芒
                    const bgTwinkleCount = 18;
                    for (let j = 0; j < bgTwinkleCount; j++) {
                        let bgSpark = document.createElement('div');
                        bgSpark.className = 'background-twinkle-sparkle';
                        bgSpark.innerHTML = svgLib['sparkle'];

                        let spSize = Math.random() * 12 + 10;
                        bgSpark.style.width = spSize + 'px';
                        bgSpark.style.height = spSize + 'px';
                        bgSpark.style.left = (Math.random() * 92 + 4) + '%';
                        bgSpark.style.top = (Math.random() * 85 + 5) + '%';

                        const shimmerColors = ['#ffffff', '#fef08a', '#fde047', '#fffbeb'];
                        bgSpark.style.color = shimmerColors[Math.floor(Math.random() * shimmerColors.length)];

                        let blinkDuration = Math.random() * 2 + 1.5;
                        let blinkDelay = Math.random() * 3;
                        bgSpark.style.animationDuration = blinkDuration + 's';
                        bgSpark.style.animationDelay = blinkDelay + 's';

                        layer.appendChild(bgSpark);
                    }

                    // 3. 飄落的金黃與暖白流星
                    const starTypes = ['star', 'sparkle'];
                    const totalStars = 28;

                    for (let i = 0; i < totalStars; i++) {
                        let el = document.createElement('div');
                        el.className = 'twinkling-golden-star';

                        let typeKey = starTypes[Math.floor(Math.random() * starTypes.length)];
                        el.innerHTML = svgLib[typeKey];

                        let isSparkle = typeKey === 'sparkle';
                        let size = isSparkle ? (Math.random() * 14 + 14) : (Math.random() * 18 + 22);
                        el.style.width = size + 'px';
                        el.style.height = size + 'px';
                        el.style.left = (Math.random() * 100) + '%';
                        el.style.top = '-50px';

                        let drift = (Math.random() * 80 + 20) * (Math.random() > 0.5 ? 1 : -1);
                        el.style.setProperty('--star-drift', drift + 'px');

                        const goldenColors = ['#ffffff', '#fef08a', '#fde047', '#fef9c3', '#fed7aa'];
                        let pickedColor = goldenColors[Math.floor(Math.random() * goldenColors.length)];
                        el.style.color = pickedColor;
                        el.style.filter = `drop-shadow(0 0 ${Math.random() * 5 + 3}px ${pickedColor})`;

                        let duration = Math.random() * 4 + 3.5;
                        let delay = Math.random() * 4;
                        el.style.animationDuration = duration + 's';
                        el.style.animationDelay = delay + 's';

                        layer.appendChild(el);
                    }

                    // 4. 🌟 滑鼠劃過留下流星/星星殘留粒子
                    const stage = document.getElementById('mainStage');
                    if (window.starTrailHandler) {
                        stage.removeEventListener('mousemove', window.starTrailHandler);
                    }

                    let lastSpawnTime = 0;
                    window.starTrailHandler = (e) => {
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'star') {
                            stage.removeEventListener('mousemove', window.starTrailHandler);
                            return;
                        }

                        // 節流控制：每 40ms 最多產生一次，保證流暢不卡頓
                        const now = Date.now();
                        if (now - lastSpawnTime < 40) return;
                        lastSpawnTime = now;

                        const rect = stage.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        // 每次滑過生成 1~2 個微型星塵粒子
                        const count = Math.random() > 0.5 ? 2 : 1;
                        for (let k = 0; k < count; k++) {
                            const trailStar = document.createElement('div');
                            trailStar.className = 'star-cursor-trail';
                            const trailTypes = ['sparkle', 'star'];
                            const pType = trailTypes[Math.floor(Math.random() * trailTypes.length)];
                            trailStar.innerHTML = svgLib[pType];

                            const pSize = pType === 'sparkle' ? (Math.random() * 12 + 10) : (Math.random() * 14 + 12);
                            trailStar.style.width = pSize + 'px';
                            trailStar.style.height = pSize + 'px';
                            trailStar.style.left = x + 'px';
                            trailStar.style.top = y + 'px';

                            // 隨機向四周微幅擴散
                            const angle = Math.random() * Math.PI * 2;
                            const dist = Math.random() * 25 + 10;
                            trailStar.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
                            trailStar.style.setProperty('--ty', Math.sin(angle) * dist + 'px');

                            const trailColors = ['#ffffff', '#fef08a', '#fde047', '#fffbeb'];
                            trailStar.style.color = trailColors[Math.floor(Math.random() * trailColors.length)];

                            layer.appendChild(trailStar);
                            setTimeout(() => { trailStar.remove(); }, 800);
                        }
                    };

                    stage.addEventListener('mousemove', window.starTrailHandler);
                    break;
                }
// 🎨 【揮灑顏料】從後方砸上來、固定靜止帶拉絲與左下角色系切換
                case 'paint':
                    if (window.paintAnimFrame) cancelAnimationFrame(window.paintAnimFrame);
                    if (window.paintTimeout) clearTimeout(window.paintTimeout);

                    let paintCanvas = document.getElementById('paintCanvas');
                    if (!paintCanvas) {
                        paintCanvas = document.createElement('canvas');
                        paintCanvas.id = 'paintCanvas';
                        paintCanvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:99;';
                        layer.appendChild(paintCanvas);
                    }

                    // 顯示左下角按鈕面板
                    const palettePanel = document.getElementById('paintPalettePanel');
                    if (palettePanel) palettePanel.style.display = 'flex';

                    const pCtx = paintCanvas.getContext('2d');
                    let splatters = [];
                    let flyingDrops = [];

                    function resizePaintCanvas() {
                        paintCanvas.width = paintCanvas.offsetWidth;
                        paintCanvas.height = paintCanvas.offsetHeight;
                    }
                    resizePaintCanvas();

                    function shootPaint() {
                        if (gameState.currentEffect !== 'paint' && trialState.effect !== 'paint') return;
                        
                        const w = paintCanvas.width;
                        const h = paintCanvas.height;
                        const targetX = w * (0.2 + Math.random() * 0.6);
                        const targetY = h * (0.2 + Math.random() * 0.6);
                        
                        const activeColors = paintPalettes[currentPaintPalette] || paintPalettes[0];
                        const color = activeColors[Math.floor(Math.random() * activeColors.length)];
                        
                        const maxRadius = Math.random() * 35 + 40;
                        const startX = w / 2;
                        const startY = h / 2;

                        flyingDrops.push({
                            x: startX, y: startY,
                            tx: targetX, ty: targetY,
                            color: color,
                            radius: maxRadius,
                            progress: 0,
                            speed: 0.12 + Math.random() * 0.08
                        });
                    }

                    function renderPaint() {
                        if (gameState.currentEffect !== 'paint' && trialState.effect !== 'paint') {
                            if (paintCanvas.parentNode) paintCanvas.parentNode.removeChild(paintCanvas);
                            const panel = document.getElementById('paintPalettePanel');
                            if (panel) panel.style.display = 'none';
                            return;
                        }
                        window.paintAnimFrame = requestAnimationFrame(renderPaint);

                        pCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

                        pCtx.save();
                        splatters.forEach(s => {
                            drawFixedSplatter(pCtx, s);
                        });
                        pCtx.restore();

                        for (let i = flyingDrops.length - 1; i >= 0; i--) {
                            let drop = flyingDrops[i];
                            drop.progress += drop.speed;
                            if (drop.progress >= 1) {
                                splatters.push({
                                    x: drop.tx,
                                    y: drop.ty,
                                    radius: drop.radius,
                                    color: drop.color,
                                    points: generatePoints(12),
                                    splashes: generateStaticSplashes(drop.radius)
                                });
                                if (splatters.length > 25) splatters.shift();
                                flyingDrops.splice(i, 1);
                                continue;
                            }

                            let ease = Math.pow(drop.progress, 1.5);
                            let curX = drop.x + (drop.tx - drop.x) * ease;
                            let curY = drop.y + (drop.ty - drop.y) * ease;
                            let curScale = 0.15 + 0.85 * drop.progress;

                            pCtx.save();
                            pCtx.globalAlpha = 0.95;
                            pCtx.fillStyle = drop.color;
                            pCtx.beginPath();
                            let stretch = 1 + (1 - drop.progress) * 0.5;
                            pCtx.ellipse(curX, curY, drop.radius * curScale * stretch, drop.radius * curScale, 0, 0, Math.PI * 2);
                            pCtx.fill();
                            pCtx.restore();
                        }
                    }

                    function generatePoints(count) {
                        let pts = [];
                        for (let i = 0; i < count; i++) {
                            pts.push(0.6 + Math.random() * 0.5);
                        }
                        return pts;
                    }

                    function generateStaticSplashes(radius) {
                        let list = [];
                        const count = 8;
                        for (let i = 0; i < count; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const dist = radius * (1.0 + Math.random() * 0.8);
                            list.push({
                                x: Math.cos(angle) * dist,
                                y: Math.sin(angle) * dist,
                                r: radius * (0.05 + Math.random() * 0.1),
                                connected: Math.random() > 0.3
                            });
                        }
                        return list;
                    }

                    function drawFixedSplatter(ctx, s) {
                        ctx.save();
                        ctx.globalAlpha = 0.85;
                        ctx.fillStyle = s.color;
                        ctx.strokeStyle = s.color;
                        ctx.globalCompositeOperation = 'multiply';

                        ctx.lineWidth = 1.8;
                        s.splashes.forEach(sp => {
                            if (sp.connected) {
                                ctx.beginPath();
                                ctx.moveTo(0, 0);
                                ctx.quadraticCurveTo(sp.x * 0.4, sp.y * 0.4, sp.x, sp.y);
                                ctx.stroke();
                            }
                        });

                        ctx.beginPath();
                        const len = s.points.length;
                        for (let i = 0; i < len; i++) {
                            const angle = (i / len) * Math.PI * 2;
                            const r = s.radius * s.points[i];
                            const px = s.x + Math.cos(angle) * r;
                            const py = s.y + Math.sin(angle) * r;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.quadraticCurveTo(s.x + Math.cos(angle - 0.25) * (r * 1.2), s.y + Math.sin(angle - 0.25) * (r * 1.2), px, py);
                        }
                        ctx.closePath();
                        ctx.fill();

                        ctx.beginPath();
                        s.splashes.forEach(sp => {
                            const dotX = s.x + sp.x;
                            const dotY = s.y + sp.y;
                            ctx.moveTo(dotX + sp.r, dotY);
                            ctx.arc(dotX, dotY, sp.r, 0, Math.PI * 2);
                        });
                        ctx.fill();

                        ctx.restore();
                    }

                    renderPaint();

                    function scheduleNextPaint() {
                        if (gameState.currentEffect !== 'paint' && trialState.effect !== 'paint') return;
                        shootPaint();
                        let nextTime = 400 + Math.random() * 600;
                        window.paintTimeout = setTimeout(scheduleNextPaint, nextTime);
                    }

                    shootPaint();
                    setTimeout(shootPaint, 200);
                    window.paintTimeout = setTimeout(scheduleNextPaint, 500);
                    break;
                    // 🌙 【月光灑落】真實感美學：雪兔正後方超大朦朧月亮 + 圍繞在月亮四周、漸漸變白又變成透明散掉的定點雲霧 + 星光閃爍
                case 'moon':
                    if (!document.getElementById('moonStyle')) {
                        const style = document.createElement('style');
                        style.id = 'moonStyle';
                        style.innerHTML = `
                            /* 🌟 1. 夜空深邃冷藍紫色朦朧濾鏡 */
                            .moon-misty-overlay {
                                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                background: radial-gradient(circle at 50% 35%, rgba(147, 197, 253, 0.2) 0%, rgba(79, 70, 229, 0.25) 50%, rgba(15, 23, 42, 0.65) 100%);
                                backdrop-filter: blur(2px) brightness(0.9);
                                pointer-events: none; z-index: 1;
                            }

                            /* 🌟 2. 位於畫面正中央（雪兔正後方）的超大真實感月亮與環繞光暈 */
                            .moon-large-fixture {
                                position: absolute; top: 28%; left: 50%; transform: translate(-50%, -50%);
                                width: 320px; height: 320px; pointer-events: none; z-index: 2;
                                background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(224, 242, 254, 0.8) 35%, rgba(186, 230, 253, 0.4) 65%, transparent 100%);
                                border-radius: 50%;
                                box-shadow: 0 0 60px rgba(224, 242, 254, 0.6), 0 0 120px rgba(147, 197, 253, 0.3);
                                filter: blur(4px);
                                animation: moonBreathe 6s ease-in-out infinite alternate;
                            }
                            @keyframes moonBreathe { 0% { transform: translate(-50%, -50%) scale(0.98); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(1.02); opacity: 1; } }

                            /* 🌟 3. 圍繞在月亮四周、漸漸變白又變成透明散掉的夢幻雲霧 */
                            .surrounding-cloud {
                                position: absolute;
                                top: 28%; left: 50%;
                                pointer-events: none;
                                z-index: 3;
                                background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.85) 0%, rgba(224, 242, 254, 0.4) 50%, transparent 80%);
                                filter: blur(18px);
                                border-radius: 50%;
                                transform: translate(-50%, -50%);
                                animation: cloudFadeAndDissolve ease-in-out infinite;
                            }
                            @keyframes cloudFadeAndDissolve {
                                0% {
                                    transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.7);
                                    opacity: 0;
                                }
                                30% {
                                    opacity: 0.7; /* 變成白色明顯的雲霧 */
                                }
                                70% {
                                    opacity: 0.7; /* 保持質感 */
                                }
                                100% {
                                    transform: translate(-50%, -50%) translate(calc(var(--dx) * 1.5), calc(var(--dy) * 1.5)) scale(1.4);
                                    opacity: 0; /* 變成透明散掉 */
                                }
                            }

                            /* 🌟 4. 閃爍的星光粒子特效 */
                            .moon-twinkle-star {
                                position: absolute; pointer-events: none; z-index: 8;
                                animation: starTwinkle ease-in-out infinite;
                            }
                            @keyframes starTwinkle {
                                0% { transform: scale(0.4); opacity: 0.2; }
                                50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 8px #fef08a); }
                                100% { transform: scale(0.4); opacity: 0.2; }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // 1. 建立夜空冷藍紫朦朧濾鏡
                    const mistyOverlay = document.createElement('div');
                    mistyOverlay.className = 'moon-misty-overlay';
                    layer.appendChild(mistyOverlay);

                    // 2. 建立正中央超大月亮
                    const moonFixture = document.createElement('div');
                    moonFixture.className = 'moon-large-fixture';
                    layer.appendChild(moonFixture);

                    // 3. 在月亮四周產生原地呼吸、變白並漸漸透明散掉的雲霧群
                    const cloudCount = 7;
                    for (let c = 0; c < cloudCount; c++) {
                        let cloudEl = document.createElement('div');
                        cloudEl.className = 'surrounding-cloud';

                        // 隨機雲朵大小 (寬 160px ~ 260px，高 90px ~ 150px)
                        let cWidth = Math.random() * 100 + 160;
                        let cHeight = Math.random() * 60 + 90;
                        cloudEl.style.width = cWidth + 'px';
                        cloudEl.style.height = cHeight + 'px';

                        // 圍繞在月亮中心周圍的隨機偏移量
                        let angle = (c / cloudCount) * Math.PI * 2 + (Math.random() * 0.5);
                        let distance = Math.random() * 60 + 20; // 距離月亮中心不遠處
                        let dx = Math.cos(angle) * distance;
                        let dy = Math.sin(angle) * (distance * 0.6);

                        cloudEl.style.setProperty('--dx', dx + 'px');
                        cloudEl.style.setProperty('--dy', dy + 'px');

                        // 隨機循環時間 (6s ~ 10s) 與延遲
                        let duration = Math.random() * 4 + 6;
                        let delay = Math.random() * 5;
                        cloudEl.style.animationDuration = duration + 's';
                        cloudEl.style.animationDelay = delay + 's';

                        layer.appendChild(cloudEl);
                    }

                    // 4. 產生四周閃爍的星星
                    const starCount = 20;
                    for (let i = 0; i < starCount; i++) {
                        let el = document.createElement('div');
                        el.className = 'moon-twinkle-star';
                        el.innerHTML = svgLib['moon_star'];

                        let size = Math.random() * 16 + 10; // 10px ~ 26px
                        el.style.width = size + 'px'; el.style.height = size + 'px';
                        el.style.left = (Math.random() * 100) + '%';
                        el.style.top = (Math.random() * 80) + '%';

                        let duration = Math.random() * 3 + 2; // 2s ~ 5s
                        let delay = Math.random() * 3;
                        el.style.animationDuration = duration + 's';
                        el.style.animationDelay = delay + 's';

                        layer.appendChild(el);
                    }
                    break;
// ⚡ 【閃電交加】盲盒剪影試用 ＋ 完整雷神之鎚 ＋ 圓滾滾蛋形索爾版
                case 'lightning':
                    if (!document.getElementById('stormLightningStyle')) {
                        const style = document.createElement('style');
                        style.id = 'stormLightningStyle';
                        style.innerHTML = `
                            /* 🌟 1. 粒子雲畫布（極致輕透） */
                            .cloud-particle-canvas {
                                position: absolute;
                                top: 0; left: 0;
                                width: 100%; height: 100%;
                                pointer-events: none;
                                z-index: 12;
                                opacity: 0.28;
                                mix-blend-mode: normal;
                            }

                            /* 🌟 2. 索爾召喚本體 */
                            .thor-spawn {
                                position: absolute;
                                width: 84px; height: 84px;
                                transform: translate(-50%, -65%);
                                pointer-events: none;
                                z-index: 20;
                            }
                            .thor-character {
                                width: 100%; height: 100%;
                                filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
                                animation: thorEggPop 1.05s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                                position: relative;
                            }
                            
                            /* 🎭 神祕盲盒剪影模式（試用專屬魔法） */
                            .mystery-shadow svg {
                                /* 把所有顏色壓成純黑，並加上黃色發光輪廓 */
                                filter: brightness(0) drop-shadow(0 0 6px #facc15) drop-shadow(0 0 12px #fef08a);
                                transition: filter 0.3s;
                            }
                            /* ❓ 神祕跳動大問號 */
                            .mystery-question-mark {
                                position: absolute;
                                top: 40%; left: 45%;
                                transform: translate(-50%, -50%);
                                font-size: 40px;
                                font-weight: 900;
                                color: #facc15;
                                text-shadow: 0 0 10px #facc15, 0 0 20px #fef08a, 2px 2px 0px #000;
                                pointer-events: none;
                                z-index: 25;
                                animation: mysteryPulse 1s infinite alternate;
                            }
                            @keyframes mysteryPulse {
                                0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.8; }
                                100% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
                            }

                            /* 雷光爆擊光圈 */
                            .thor-energy-ring {
                                position: absolute;
                                top: 18px; left: 8px;
                                width: 10px; height: 10px;
                                border: 2px solid #00f0ff;
                                border-radius: 50%;
                                transform: translate(-50%, -50%) scale(0);
                                opacity: 0;
                                animation: shockwave 0.45s ease-out 0.2s forwards;
                            }

                            @keyframes thorEggPop {
                                0% { transform: scale(0) translateY(25px) rotate(-12deg); opacity: 0; }
                                25% { transform: scale(1.15) translateY(0) rotate(0deg); opacity: 1; }
                                35% { transform: scale(0.95, 1.05) translateY(-3px); }
                                75% { transform: scale(1) translateY(0); opacity: 1; filter: drop-shadow(0 0 10px #00d2ff); }
                                100% { transform: scale(0.4) translateY(15px); opacity: 0; filter: none; }
                            }
                            @keyframes shockwave {
                                0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
                                100% { opacity: 0; transform: translate(-50%, -50%) scale(4); box-shadow: 0 0 10px #00f0ff; }
                            }

                            /* 🌟 3. 全螢幕柔光微閃 */
                            .lightning-screen-flash {
                                position: absolute; inset: 0;
                                background: radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.15) 0%, rgba(186, 230, 253, 0.04) 60%, transparent 100%);
                                z-index: 14; pointer-events: none; opacity: 0; transition: opacity 0.04s ease-out;
                            }
                            .lightning-screen-flash.active-flash { opacity: 0.6 !important; }

                            /* 🌟 4. SVG 輕透光芒畫布 */
                            .lightning-svg-canvas {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                z-index: 16; pointer-events: none; overflow: visible;
                                mix-blend-mode: screen;
                            }

                            /* 🌟 5. 一閃而過的輕微物理震動 */
                            @keyframes epicThunderShake {
                                0% { transform: translate(0, 0) rotate(0deg); }
                                15% { transform: translate(-2px, -1px) rotate(-0.4deg); }
                                30% { transform: translate(2px, 1px) rotate(0.4deg); }
                                60% { transform: translate(-1px, 0.5px) rotate(-0.2deg); }
                                100% { transform: translate(0, 0) rotate(0deg); }
                            }
                            .active-shake { animation: epicThunderShake 0.25s ease-out forwards; }
                        `;
                        document.head.appendChild(style);
                    }

                    const stormId = Math.random();
                    window.stormSessionId = stormId;

                    // 🌧️ 【雙聲道空氣雨霧背景音】
                    function startTorrentialRainSound() {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            if (window.synthStormRain) return;

                            const sampleRate = ctx.sampleRate;
                            const bufferLen = sampleRate * 3;
                            const buffer = ctx.createBuffer(2, bufferLen, sampleRate);
                            const leftData = buffer.getChannelData(0);
                            const rightData = buffer.getChannelData(1);

                            let b0L = 0, b1L = 0, b2L = 0;
                            let b0R = 0, b1R = 0, b2R = 0;

                            for (let i = 0; i < bufferLen; i++) {
                                const whiteL = Math.random() * 2 - 1;
                                const whiteR = Math.random() * 2 - 1;

                                b0L = 0.99 * b0L + whiteL * 0.03;
                                b1L = 0.95 * b1L + whiteL * 0.08;
                                b2L = 0.85 * b2L + whiteL * 0.18;
                                const rainStreamL = (b0L + b1L + b2L) * 0.18;

                                b0R = 0.99 * b0R + whiteR * 0.03;
                                b1R = 0.95 * b1R + whiteR * 0.08;
                                b2R = 0.85 * b2R + whiteR * 0.18;
                                const rainStreamR = (b0R + b1R + b2R) * 0.18;

                                const splatterL = Math.random() > 0.96 ? (Math.random() * 0.3 - 0.15) : 0;
                                const splatterR = Math.random() > 0.96 ? (Math.random() * 0.3 - 0.15) : 0;

                                leftData[i] = rainStreamL + splatterL;
                                rightData[i] = rainStreamR + splatterR;
                            }

                            const rainSource = ctx.createBufferSource();
                            rainSource.buffer = buffer;
                            rainSource.loop = true;

                            const rainFilter = ctx.createBiquadFilter();
                            rainFilter.type = 'lowpass';
                            rainFilter.frequency.setValueAtTime(1800, ctx.currentTime);

                            const highpass = ctx.createBiquadFilter();
                            highpass.type = 'highpass';
                            highpass.frequency.setValueAtTime(280, ctx.currentTime);

                            const rainGain = ctx.createGain();
                            rainGain.gain.setValueAtTime(0.005, ctx.currentTime);
                            rainGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);

                            rainSource.connect(highpass);
                            highpass.connect(rainFilter);
                            rainFilter.connect(rainGain);
                            rainGain.connect(ctx.destination);
                            rainSource.start();

                            window.synthStormRain = {
                                stop: function() {
                                    rainGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                                    setTimeout(() => {
                                        try { rainSource.stop(); rainSource.disconnect(); } catch(e) {}
                                    }, 550);
                                }
                            };
                        } catch (e) {
                            console.error('Ambient rain sound error:', e);
                        }
                    }

                    // 🌩️ 【三階段逼真雷鳴】
                    function playApproachingThunderSound() {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            const now = ctx.currentTime;
                            const sampleRate = ctx.sampleRate;

                            const buildLen = Math.floor(sampleRate * 0.85);
                            const buildBuf = ctx.createBuffer(1, buildLen, sampleRate);
                            const bData = buildBuf.getChannelData(0);
                            let bLast = 0.0;
                            for (let i = 0; i < buildLen; i++) {
                                const white = Math.random() * 2 - 1;
                                bLast = (bLast + 0.02 * white) / 1.02;
                                const t = i / sampleRate;
                                const buildEnvelope = Math.pow(t / 0.85, 2.2) * (1 + 0.3 * Math.sin(t * 18));
                                bData[i] = bLast * 3.5 * buildEnvelope;
                            }
                            const buildSrc = ctx.createBufferSource();
                            buildSrc.buffer = buildBuf;
                            const buildFilter = ctx.createBiquadFilter();
                            buildFilter.type = 'lowpass';
                            buildFilter.frequency.setValueAtTime(90, now);
                            buildFilter.frequency.exponentialRampToValueAtTime(320, now + 0.75);

                            const buildGain = ctx.createGain();
                            buildGain.gain.setValueAtTime(0.04, now);
                            buildGain.gain.linearRampToValueAtTime(0.95, now + 0.75);

                            buildSrc.connect(buildFilter);
                            buildFilter.connect(buildGain);
                            buildGain.connect(ctx.destination);
                            buildSrc.start(now);

                            const strikeTime = now + 0.2;
                            const snapLen = Math.floor(sampleRate * 0.15);
                            const snapBuf = ctx.createBuffer(1, snapLen, sampleRate);
                            const snapData = snapBuf.getChannelData(0);
                            for (let i = 0; i < snapLen; i++) {
                                snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.025));
                            }
                            const snapSrc = ctx.createBufferSource();
                            snapSrc.buffer = snapBuf;
                            const snapFilter = ctx.createBiquadFilter();
                            snapFilter.type = 'bandpass';
                            snapFilter.frequency.setValueAtTime(1900, strikeTime);
                            snapFilter.Q.setValueAtTime(1.3, strikeTime);
                            const snapGain = ctx.createGain();
                            snapGain.gain.setValueAtTime(1.4, strikeTime);
                            snapGain.gain.exponentialRampToValueAtTime(0.01, strikeTime + 0.12);

                            snapSrc.connect(snapFilter);
                            snapFilter.connect(snapGain);
                            snapGain.connect(ctx.destination);
                            snapSrc.start(strikeTime);

                            const boomOsc = ctx.createOscillator();
                            boomOsc.type = 'triangle';
                            boomOsc.frequency.setValueAtTime(120, strikeTime);
                            boomOsc.frequency.exponentialRampToValueAtTime(22, strikeTime + 0.85);
                            const boomGain = ctx.createGain();
                            boomGain.gain.setValueAtTime(1.8, strikeTime);
                            boomGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.85);

                            boomOsc.connect(boomGain);
                            boomGain.connect(ctx.destination);
                            boomOsc.start(strikeTime);
                            boomOsc.stop(strikeTime + 0.9);

                            const rumbleLen = Math.floor(sampleRate * 3.6);
                            const rumbleBuf = ctx.createBuffer(1, rumbleLen, sampleRate);
                            const rData = rumbleBuf.getChannelData(0);
                            let rLast = 0.0;
                            for (let i = 0; i < rumbleLen; i++) {
                                const white = Math.random() * 2 - 1;
                                rLast = (rLast + 0.02 * white) / 1.02;
                                const t = i / sampleRate;
                                const envelope = Math.exp(-t * 0.72) * (1 + 0.4 * Math.sin(t * 10) + 0.25 * Math.sin(t * 6));
                                rData[i] = rLast * 4.4 * envelope;
                            }
                            const rumbleSrc = ctx.createBufferSource();
                            rumbleSrc.buffer = rumbleBuf;
                            const rumbleFilter = ctx.createBiquadFilter();
                            rumbleFilter.type = 'lowpass';
                            rumbleFilter.frequency.setValueAtTime(400, strikeTime);
                            rumbleFilter.frequency.linearRampToValueAtTime(40, strikeTime + 3.4);

                            const rumbleGain = ctx.createGain();
                            rumbleGain.gain.setValueAtTime(1.4, strikeTime);
                            rumbleGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 3.5);

                            rumbleSrc.connect(rumbleFilter);
                            rumbleFilter.connect(rumbleGain);
                            rumbleGain.connect(ctx.destination);
                            rumbleSrc.start(strikeTime + 0.02);

                        } catch (e) {
                            console.error('Approaching Thunder error:', e);
                        }
                    }

                    startTorrentialRainSound();

                    // ☁️ 【Canvas 粒子柔焦雲海系統】
                    const cloudCanvas = document.createElement('canvas');
                    cloudCanvas.className = 'cloud-particle-canvas';
                    layer.appendChild(cloudCanvas);
                    const cCtx = cloudCanvas.getContext('2d');

                    function resizeCloudCanvas() {
                        cloudCanvas.width = layer.offsetWidth || window.innerWidth;
                        cloudCanvas.height = layer.offsetHeight || window.innerHeight;
                    }
                    resizeCloudCanvas();

                    let cloudPuffs = [];
                    function initCloudParticles() {
                        cloudPuffs = [];
                        const w = cloudCanvas.width;
                        const h = cloudCanvas.height;

                        for (let i = 0; i < 28; i++) {
                            cloudPuffs.push({
                                x: Math.random() * (w * 0.45) - 30,
                                y: Math.random() * (h * 0.5) - 20,
                                r: Math.random() * 70 + 60,
                                baseAlpha: Math.random() * 0.16 + 0.1,
                                color: i % 2 === 0 ? '71, 85, 105' : '30, 41, 59',
                                litAlpha: 0
                            });
                        }

                        for (let i = 0; i < 28; i++) {
                            cloudPuffs.push({
                                x: w * 0.55 + Math.random() * (w * 0.5),
                                y: Math.random() * (h * 0.55) - 20,
                                r: Math.random() * 75 + 65,
                                baseAlpha: Math.random() * 0.16 + 0.1,
                                color: i % 2 === 0 ? '100, 116, 139' : '15, 23, 42',
                                litAlpha: 0
                            });
                        }
                    }
                    initCloudParticles();

                    function renderCloudPuffs() {
                        cCtx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);

                        cloudPuffs.forEach(p => {
                            const grad = cCtx.createRadialGradient(p.x, p.y, p.r * 0.1, p.x, p.y, p.r);
                            const currentAlpha = p.baseAlpha + p.litAlpha;

                            if (p.litAlpha > 0.05) {
                                grad.addColorStop(0, `rgba(240, 248, 255, ${currentAlpha * 1.8})`);
                                grad.addColorStop(0.4, `rgba(186, 230, 253, ${currentAlpha * 1.2})`);
                                grad.addColorStop(1, `rgba(${p.color}, 0)`);
                            } else {
                                grad.addColorStop(0, `rgba(${p.color}, ${currentAlpha})`);
                                grad.addColorStop(0.6, `rgba(${p.color}, ${currentAlpha * 0.6})`);
                                grad.addColorStop(1, `rgba(${p.color}, 0)`);
                            }

                            cCtx.fillStyle = grad;
                            cCtx.beginPath();
                            cCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                            cCtx.fill();
                        });
                    }
                    renderCloudPuffs();

                    const flashLayer = document.createElement('div');
                    flashLayer.className = 'lightning-screen-flash';
                    layer.appendChild(flashLayer);

                    const svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svgCanvas.setAttribute('class', 'lightning-svg-canvas');
                    svgCanvas.innerHTML = `
                        <defs>
                            <filter id="softPureLightGlow" x="-60%" y="-60%" width="220%" height="220%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="2.0" result="softBlur1"/>
                                <feGaussianBlur in="SourceGraphic" stdDeviation="6.0" result="softBlur2"/>
                                <feGaussianBlur in="SourceGraphic" stdDeviation="14.0" result="softBlur3"/>
                                <feMerge>
                                    <feMergeNode in="softBlur3"/>
                                    <feMergeNode in="softBlur2"/>
                                    <feMergeNode in="softBlur1"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                            <linearGradient id="pureLightBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                                <stop offset="25%" stop-color="#e0f2fe" stop-opacity="0.8"/>
                                <stop offset="70%" stop-color="#00f0ff" stop-opacity="0.75"/>
                                <stop offset="100%" stop-color="#0284c7" stop-opacity="0.6"/>
                            </linearGradient>
                            <linearGradient id="pureLightHaloGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.45"/>
                                <stop offset="50%" stop-color="#60a5fa" stop-opacity="0.3"/>
                                <stop offset="85%" stop-color="#f59e0b" stop-opacity="0.35"/>
                                <stop offset="100%" stop-color="#ea580c" stop-opacity="0.2"/>
                            </linearGradient>
                        </defs>
                    `;
                    layer.appendChild(svgCanvas);

                    // 🔨 【召喚蛋形索爾（如果是試用狀態，就會掛上神祕剪影的類別！）】
                    function spawnThor(x, y) {
                        // 🎭 判斷是否為試用狀態
                        const isTrial = (trialState.effect === 'lightning');
                        const shadowClass = isTrial ? 'mystery-shadow' : '';
                        const questionMarkHTML = isTrial ? '<div class="mystery-question-mark">?</div>' : '';

                        const thorEl = document.createElement('div');
                        thorEl.className = 'thor-spawn';
                        thorEl.style.left = `${x}px`;
                        thorEl.style.top = `${y}px`;
                        thorEl.innerHTML = `
                            <div class="thor-energy-ring"></div>
                            <div class="thor-character ${shadowClass}">
                                <svg viewBox="-25 -10 140 120" width="100%" height="100%">
                                    <g stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                                        <!-- 1. 圓萌小披風 -->
                                        <path d="M 22 56 Q 10 74 16 86 Q 50 80 84 86 Q 90 74 78 56 Z" fill="#e50914" />
                                        <!-- 2. 蛋形圓潤軀幹底色 -->
                                        <ellipse cx="50" cy="52" rx="30" ry="28" fill="#fed7aa" />
                                        <!-- 3. 下半身圓滾滾盔甲 -->
                                        <path d="M 22 55 C 21 75 32 82 50 82 C 68 82 79 75 78 55 C 68 59 32 59 22 55 Z" fill="#262626" />
                                        <!-- 4. 盔甲金屬銀釦與黃色幾何線 -->
                                        <circle cx="41" cy="64" r="2.6" fill="#cbd5e1" stroke="none" />
                                        <circle cx="59" cy="64" r="2.6" fill="#cbd5e1" stroke="none" />
                                        <circle cx="43" cy="73" r="2.2" fill="#cbd5e1" stroke="none" />
                                        <circle cx="57" cy="73" r="2.2" fill="#cbd5e1" stroke="none" />
                                        <path d="M 33 65 L 30 70 L 33 74" fill="none" stroke="#facc15" stroke-width="1.8" />
                                        <path d="M 67 65 L 70 70 L 67 74" fill="none" stroke="#facc15" stroke-width="1.8" />
                                        <!-- 5. 可愛小圓短腳 -->
                                        <ellipse cx="40" cy="83" rx="5" ry="3.5" fill="#262626" />
                                        <ellipse cx="60" cy="83" rx="5" ry="3.5" fill="#262626" />
                                        <!-- 6. 兩側金黃頭髮 -->
                                        <path d="M 19 44 Q 14 58 22 66 Q 24 53 23 44 Z" fill="#fde047" />
                                        <path d="M 81 44 Q 86 58 78 66 Q 76 53 77 44 Z" fill="#fde047" />
                                        <!-- 7. 招牌大圓眼 ＋ 腮紅 ＋ 一字嘴 -->
                                        <ellipse cx="38" cy="46" rx="3.5" ry="4.2" fill="#1a1a1a" stroke="none" />
                                        <circle cx="37" cy="44.5" r="1.2" fill="#ffffff" stroke="none" />
                                        <ellipse cx="62" cy="46" rx="3.5" ry="4.2" fill="#1a1a1a" stroke="none" />
                                        <circle cx="61" cy="44.5" r="1.2" fill="#ffffff" stroke="none" />
                                        <ellipse cx="32" cy="51" rx="3.5" ry="2" fill="#f87171" opacity="0.65" stroke="none" />
                                        <ellipse cx="68" cy="51" rx="3.5" ry="2" fill="#f87171" opacity="0.65" stroke="none" />
                                        <line x1="47" y1="52" x2="53" y2="52" stroke="#1a1a1a" stroke-width="2.2" />
                                        <!-- 8. 經典三層金屬大羽翼頭盔 -->
                                        <path d="M 22 38 L 8 18 L 18 10 L 25 32 Z" fill="#cbd5e1" />
                                        <line x1="12" y1="20" x2="22" y2="28" stroke="#94a3b8" stroke-width="1.8" />
                                        <path d="M 78 38 L 92 18 L 82 10 L 75 32 Z" fill="#cbd5e1" />
                                        <line x1="88" y1="20" x2="78" y2="28" stroke="#94a3b8" stroke-width="1.8" />
                                        <path d="M 20 42 C 20 18 80 18 80 42 Z" fill="#cbd5e1" />
                                        <path d="M 22 34 L 38 34 L 50 40 L 62 34 L 78 34 L 76 40 L 62 40 L 50 46 L 38 40 L 24 40 Z" fill="#e2e8f0" />
                                        <path d="M 24 40 L 38 40 L 50 46 L 62 40 L 76 40 L 75 44 L 62 44 L 50 50 L 38 44 L 25 44 Z" fill="#94a3b8" />
                                        <!-- 9. 左小圓手 -->
                                        <circle cx="78" cy="58" r="4.5" fill="#fed7aa" />
                                        <!-- 10. ⚡ 完整八角金屬雷神之鎚 Mjölnir -->
                                        <g transform="translate(10, 24) rotate(-35)">
                                            <line x1="0" y1="7" x2="0" y2="26" stroke="#5c3a21" stroke-width="3.6" />
                                            <line x1="-1.6" y1="12" x2="1.6" y2="14" stroke="#8d6e63" stroke-width="1.4" />
                                            <line x1="-1.6" y1="18" x2="1.6" y2="20" stroke="#8d6e63" stroke-width="1.4" />
                                            <circle cx="0" cy="26" r="2.2" fill="#94a3b8" />
                                            <path d="M 0 27 Q 4 31 2 35" stroke="#5c3a21" stroke-width="1.6" fill="none" />
                                            <path d="M -15 -14 L 15 -14 L 17 -10 L 17 0 L 15 4 L -15 4 L -17 0 L -17 -10 Z" fill="#94a3b8" />
                                            <polygon points="-12,-11 12,-11 14,-8 14,-2 12,1 -12,1 -14,-2 -14,-8" fill="#cbd5e1" stroke="none" />
                                            <rect x="-12" y="-16.5" width="24" height="2.8" rx="1" fill="#64748b" stroke="none" />
                                            <circle cx="0" cy="-5" r="2.5" fill="#64748b" stroke="none" />
                                            <line x1="-15" y1="-14" x2="-12" y2="-11" stroke="#64748b" stroke-width="1.4" />
                                            <line x1="15" y1="-14" x2="12" y2="-11" stroke="#64748b" stroke-width="1.4" />
                                            <line x1="-15" y1="4" x2="-12" y2="1" stroke="#64748b" stroke-width="1.4" />
                                            <line x1="15" y1="4" x2="12" y2="1" stroke="#64748b" stroke-width="1.4" />
                                        </g>
                                        <!-- 11. 抓著錘柄的小圓手 -->
                                        <circle cx="18" cy="40" r="4.6" fill="#fed7aa" />
                                    </g>
                                </svg>
                                ${questionMarkHTML}
                            </div>
                        `;
                        layer.appendChild(thorEl);
                        setTimeout(() => { if (thorEl.parentNode) thorEl.remove(); }, 1050);
                    }

                    // ⚡ 【自然碎形光跡生成器】
                    function generateLightBeamPoints(startX, startY, endX, endY) {
                        const mainPoints = [{ x: startX, y: startY }];
                        const steps = 18 + Math.floor(Math.random() * 6);
                        const dx = (endX - startX) / steps;
                        const dy = (endY - startY) / steps;

                        let curX = startX;
                        let curY = startY;

                        for (let i = 1; i < steps; i++) {
                            const progress = i / steps;
                            const maxJitter = 24 * Math.sin(progress * Math.PI) + 5;
                            curX += dx + (Math.random() * 2 - 1) * maxJitter;
                            curY += dy + (Math.random() * 2 - 1) * (maxJitter * 0.3);
                            mainPoints.push({ x: curX, y: curY });
                        }
                        mainPoints.push({ x: endX, y: endY });

                        let mainPath = `M ${mainPoints[0].x.toFixed(1)} ${mainPoints[0].y.toFixed(1)}`;
                        for (let i = 1; i < mainPoints.length; i++) {
                            const pt = mainPoints[i];
                            const prev = mainPoints[i - 1];
                            const midX = (prev.x + pt.x) / 2 + (Math.random() * 8 - 4);
                            const midY = (prev.y + pt.y) / 2 + (Math.random() * 6 - 3);
                            mainPath += ` L ${midX.toFixed(1)} ${midY.toFixed(1)} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
                        }
                        return mainPath;
                    }

                    // ⚡ 發動索爾引雷（精準擊中完整錘頂）
                    function triggerLightningStrike(targetX, targetY) {
                        if (window.stormSessionId !== stormId) return;

                        // 1. 召喚神祕剪影/或現出原形的蛋形索爾
                        spawnThor(targetX, targetY);

                        // 2. 0.2 秒後閃電直擊完整錘頭正上方
                        setTimeout(() => {
                            if (window.stormSessionId !== stormId) return;

                            playApproachingThunderSound();

                            const rect = layer.getBoundingClientRect();
                            const startX = rect.width * (0.47 + Math.random() * 0.06);
                            const startY = rect.height * 0.05;

                            // 依照擴展後視野精準計算錘頭座標
                            const hammerX = targetX - 34;
                            const hammerY = targetY - 40;

                            const beamPath = generateLightBeamPoints(startX, startY, hammerX, hammerY);
                            const lightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            lightGroup.setAttribute('filter', 'url(#softPureLightGlow)');

                            const sheerBeam = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            sheerBeam.setAttribute('d', beamPath);
                            sheerBeam.setAttribute('stroke', 'url(#pureLightBeamGrad)');
                            sheerBeam.setAttribute('stroke-width', '3.2');
                            sheerBeam.setAttribute('fill', 'none');

                            const thinCore = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            thinCore.setAttribute('d', beamPath);
                            thinCore.setAttribute('stroke', '#ffffff');
                            thinCore.setAttribute('stroke-width', '1.1');
                            thinCore.setAttribute('fill', 'none');

                            lightGroup.appendChild(sheerBeam);
                            lightGroup.appendChild(thinCore);
                            svgCanvas.appendChild(lightGroup);

                            // 照亮粒子雲輪廓
                            cloudPuffs.forEach(p => {
                                const dist = Math.hypot(p.x - startX, p.y - startY);
                                p.litAlpha = Math.max(0, (1 - dist / (rect.width * 0.6)) * 0.35);
                            });
                            renderCloudPuffs();

                            flashLayer.classList.add('active-flash');
                            layer.classList.remove('active-shake');
                            void layer.offsetWidth;
                            layer.classList.add('active-shake');

                            setTimeout(() => {
                                flashLayer.classList.remove('active-flash');
                                cloudPuffs.forEach(p => p.litAlpha = 0);
                                renderCloudPuffs();
                                lightGroup.remove();
                            }, 220);
                        }, 200);
                    }

                    layer.style.pointerEvents = 'auto';
                    layer.onpointerdown = (e) => {
                        if (window.sharedAudioCtx && window.sharedAudioCtx.state === 'suspended') {
                            window.sharedAudioCtx.resume();
                        }
                        startTorrentialRainSound();

                        const rect = layer.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;

                        triggerLightningStrike(clickX, clickY);

                        if (!trialState.effect) {
                            gameState.points += 5; saveGame(); updateUI(); showFloatText('⚡ 索爾引雷 +5');
                        }
                    };

                    function loopRandomStorm() {
                        if (window.stormSessionId !== stormId) return;
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'lightning') {
                            layer.classList.remove('active-shake');
                            return;
                        }

                        const rect = layer.getBoundingClientRect();
                        const randX = rect.width * (0.25 + Math.random() * 0.5);
                        const randY = rect.height * (0.6 + Math.random() * 0.25);
                        triggerLightningStrike(randX, randY);

                        window.lightningInterval = setTimeout(loopRandomStorm, Math.random() * 3200 + 4200);
                    }

                    setTimeout(loopRandomStorm, 1200);
                    break;
// 🎉 【歡樂派對拉炮】彩帶加倍加長 ＋ 真實拉線 ＋ 前端炸裂 ＋ 長線波浪氣球版
                case 'confetti':
                    if (!document.getElementById('confettiEffectStyle')) {
                        const style = document.createElement('style');
                        style.id = 'confettiEffectStyle';
                        style.innerHTML = `
                            /* 🌟 1. 派對全景舞台 */
                            .party-stage-container {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                pointer-events: none; z-index: 12; overflow: hidden;
                            }

                            .party-bunting-svg {
                                position: absolute; top: 0; left: 0; width: 100%; height: 75px;
                                filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.15));
                                animation: buntingSway 6s ease-in-out infinite alternate;
                                transform-origin: top center;
                            }
                            @keyframes buntingSway {
                                0% { transform: rotate(0deg) scaleY(1); }
                                100% { transform: rotate(0.8deg) scaleY(1.04); }
                            }

                            .party-balloon-item {
                                position: absolute;
                                will-change: transform;
                                filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
                            }
                            @keyframes balloonFloatLeft {
                                0% { transform: translate(0, 0) rotate(-3deg); }
                                50% { transform: translate(12px, -20px) rotate(4deg); }
                                100% { transform: translate(-8px, -40px) rotate(-2deg); }
                            }
                            @keyframes balloonFloatRight {
                                0% { transform: translate(0, 0) rotate(4deg); }
                                50% { transform: translate(-14px, -25px) rotate(-3deg); }
                                100% { transform: translate(10px, -45px) rotate(5deg); }
                            }

                            /* 🌟 2. 拉炮本體動畫 */
                            .party-popper-gun {
                                position: absolute;
                                width: 80px; height: 80px;
                                transform-origin: bottom center;
                                pointer-events: none;
                                z-index: 18;
                                filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
                            }
                            
                            @keyframes popperShootAction {
                                0% { transform: translate(-50%, -50%) scale(0.2) rotate(var(--angle)); opacity: 0; }
                                10% { transform: translate(-50%, -50%) scale(1.1) rotate(var(--angle)); opacity: 1; }
                                20% { transform: translate(-50%, -50%) scale(0.9, 1.1) rotate(calc(var(--angle) - 5deg)); opacity: 1; }
                                25% { transform: translate(-50%, -50%) scale(1.3, 0.8) rotate(calc(var(--angle) + 20deg)) translate(-20px, 20px); opacity: 1; } 
                                45% { transform: translate(-50%, -50%) scale(1.0) rotate(var(--angle)); opacity: 1; }
                                100% { transform: translate(-50%, -50%) scale(0.5) rotate(calc(var(--angle) - 45deg)) translateY(80px); opacity: 0; }
                            }

                            .popper-string-pull {
                                animation: stringPull 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                            }
                            @keyframes stringPull {
                                0% { transform: translateY(0); }
                                20% { transform: translateY(12px); }
                                25% { transform: translateY(-5px); }
                                100% { transform: translateY(0); }
                            }

                            .popper-cap-blast {
                                animation: capBlast 1s ease-out forwards;
                            }
                            @keyframes capBlast {
                                0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                                25% { transform: translate(15px, -30px) rotate(45deg); opacity: 1; }
                                100% { transform: translate(30px, 50px) rotate(120deg); opacity: 0; }
                            }

                            .popper-blast-flash {
                                position: absolute;
                                width: 60px; height: 60px;
                                background: radial-gradient(circle, #ffffff 0%, #fef08a 30%, #f97316 60%, transparent 100%);
                                border-radius: 50%;
                                transform: translate(-50%, -50%) scale(0);
                                pointer-events: none; z-index: 19;
                                mix-blend-mode: screen;
                                animation: blastPop 0.35s ease-out forwards;
                            }
                            @keyframes blastPop {
                                0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
                                40% { transform: translate(-50%, -50%) scale(2.5); opacity: 0.9; }
                                100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
                            }

                            /* 🌟 3. 彩帶粒子動畫 */
                            .confetti-particle {
                                position: absolute;
                                pointer-events: none;
                                z-index: 16;
                                will-change: transform, opacity;
                            }
                            @keyframes confettiExplosion {
                                0% {
                                    transform: translate3d(0, 0, 0) scale(0.2) rotate3d(0,0,0,0deg);
                                    opacity: 1;
                                }
                                15% { 
                                    transform: translate3d(var(--throw-x), var(--throw-y), 0) scale(1.2) rotate3d(1,1,1, var(--rx));
                                    opacity: 1;
                                }
                                70% {
                                    opacity: 0.9;
                                }
                                100% { 
                                    transform: translate3d(calc(var(--throw-x) + var(--drift-x)), var(--drop-y), 0) scale(0.8) rotate3d(1,1,1, var(--rz));
                                    opacity: 0;
                                }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    const partySessionId = Math.random();
                    window.partySessionId = partySessionId;

                    // 🎈 【音效】
                    function playPopperSound(pitchMult = 1.0) {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            const now = ctx.currentTime;

                            const popOsc = ctx.createOscillator();
                            popOsc.type = 'sine';
                            popOsc.frequency.setValueAtTime(320 * pitchMult, now);
                            popOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

                            const popGain = ctx.createGain();
                            popGain.gain.setValueAtTime(1.5, now);
                            popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

                            popOsc.connect(popGain);
                            popGain.connect(ctx.destination);
                            popOsc.start(now);
                            popOsc.stop(now + 0.09);

                            const snapLen = Math.floor(ctx.sampleRate * 0.15);
                            const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
                            const snapData = snapBuf.getChannelData(0);
                            for (let i = 0; i < snapLen; i++) {
                                snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
                            }
                            const snapSrc = ctx.createBufferSource();
                            snapSrc.buffer = snapBuf;
                            const snapFilter = ctx.createBiquadFilter();
                            snapFilter.type = 'highpass';
                            snapFilter.frequency.setValueAtTime(1000, now);
                            const snapGain = ctx.createGain();
                            snapGain.gain.setValueAtTime(0.8, now);
                            snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

                            snapSrc.connect(snapFilter);
                            snapFilter.connect(snapGain);
                            snapGain.connect(ctx.destination);
                            snapSrc.start(now);

                            const chimeOsc = ctx.createOscillator();
                            chimeOsc.type = 'triangle';
                            chimeOsc.frequency.setValueAtTime(880 * pitchMult, now);
                            chimeOsc.frequency.exponentialRampToValueAtTime(1320 * pitchMult, now + 0.18);
                            const chimeGain = ctx.createGain();
                            chimeGain.gain.setValueAtTime(0.2, now);
                            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                            chimeOsc.connect(chimeGain);
                            chimeGain.connect(ctx.destination);
                            chimeOsc.start(now + 0.02);
                            chimeOsc.stop(now + 0.3);

                        } catch (e) {
                            console.error('Popper pop sound error:', e);
                        }
                    }

                    // 🎪 建立背景 (加長了氣球的容器與拉長波浪線 SVG)
                    const partyStage = document.createElement('div');
                    partyStage.className = 'party-stage-container';
                    partyStage.innerHTML = `
                        <svg class="party-bunting-svg" viewBox="0 0 1000 80" preserveAspectRatio="none">
                            <defs><filter id="buntingShadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.15"/></filter></defs>
                            <path d="M 0 15 Q 250 45 500 20 Q 750 45 1000 15" stroke="#cbd5e1" stroke-width="2" fill="none"/>
                            <g filter="url(#buntingShadow)">
                                <polygon points="30,19 75,19 52,65" fill="#f43f5e" /><polygon points="90,23 135,23 112,68" fill="#38bdf8" />
                                <polygon points="150,26 195,26 172,70" fill="#facc15" /><polygon points="210,28 255,28 232,71" fill="#a855f7" />
                                <polygon points="270,28 315,28 292,69" fill="#10b981" /><polygon points="330,26 375,26 352,68" fill="#fb923c" />
                                <polygon points="390,24 435,24 412,66" fill="#f43f5e" /><polygon points="450,21 495,21 472,64" fill="#38bdf8" />
                                <polygon points="510,21 555,21 532,64" fill="#facc15" /><polygon points="570,24 615,24 592,67" fill="#a855f7" />
                                <polygon points="630,26 675,26 652,69" fill="#10b981" /><polygon points="690,28 735,28 712,71" fill="#fb923c" />
                                <polygon points="750,28 795,28 772,70" fill="#f43f5e" /><polygon points="810,26 855,26 832,68" fill="#38bdf8" />
                                <polygon points="870,23 915,23 892,67" fill="#facc15" /><polygon points="930,19 975,19 952,65" fill="#a855f7" />
                            </g>
                        </svg>

                        <!-- 🌟 延長線版本的氣球群 -->
                        <div class="party-balloon-item" style="left: 5%; top: 12%; width: 65px; height: 140px; animation: balloonFloatLeft 8s ease-in-out infinite alternate;">
                            <svg viewBox="0 0 70 150" width="100%" height="100%">
                                <path d="M 35 10 C 15 10 10 32 10 48 C 10 65 28 75 33 78 L 31 82 L 39 82 L 37 78 C 42 75 60 65 60 48 C 60 32 55 10 35 10 Z" fill="#ec4899"/>
                                <ellipse cx="25" cy="28" rx="6" ry="12" fill="#ffffff" opacity="0.4" transform="rotate(-20 25 28)"/>
                                <path d="M 35 82 C 15 100, 55 120, 35 145" stroke="#cbd5e1" stroke-width="1.8" fill="none"/>
                            </svg>
                        </div>
                        <div class="party-balloon-item" style="left: 18%; top: 32%; width: 55px; height: 125px; animation: balloonFloatRight 7.5s ease-in-out infinite alternate;">
                            <svg viewBox="0 0 70 150" width="100%" height="100%">
                                <path d="M 35 10 C 15 10 10 32 10 48 C 10 65 28 75 33 78 L 31 82 L 39 82 L 37 78 C 42 75 60 65 60 48 C 60 32 55 10 35 10 Z" fill="#0ea5e9"/>
                                <ellipse cx="25" cy="28" rx="5" ry="10" fill="#ffffff" opacity="0.4" transform="rotate(-20 25 28)"/>
                                <path d="M 35 82 C 55 100, 15 120, 35 145" stroke="#cbd5e1" stroke-width="1.8" fill="none"/>
                            </svg>
                        </div>
                        <div class="party-balloon-item" style="right: 6%; top: 15%; width: 70px; height: 150px; animation: balloonFloatRight 9s ease-in-out infinite alternate;">
                            <svg viewBox="0 0 70 150" width="100%" height="100%">
                                <path d="M 35 10 C 15 10 10 32 10 48 C 10 65 28 75 33 78 L 31 82 L 39 82 L 37 78 C 42 75 60 65 60 48 C 60 32 55 10 35 10 Z" fill="#eab308"/>
                                <ellipse cx="25" cy="28" rx="6" ry="12" fill="#ffffff" opacity="0.4" transform="rotate(-20 25 28)"/>
                                <path d="M 35 82 C 20 105, 60 125, 30 148" stroke="#cbd5e1" stroke-width="1.8" fill="none"/>
                            </svg>
                        </div>
                        <div class="party-balloon-item" style="right: 22%; top: 30%; width: 58px; height: 132px; animation: balloonFloatLeft 8.5s ease-in-out infinite alternate;">
                            <svg viewBox="0 0 70 150" width="100%" height="100%">
                                <path d="M 35 10 C 15 10 10 32 10 48 C 10 65 28 75 33 78 L 31 82 L 39 82 L 37 78 C 42 75 60 65 60 48 C 60 32 55 10 35 10 Z" fill="#8b5cf6"/>
                                <ellipse cx="25" cy="28" rx="5" ry="10" fill="#ffffff" opacity="0.4" transform="rotate(-20 25 28)"/>
                                <path d="M 35 82 C 50 100, 10 120, 40 145" stroke="#cbd5e1" stroke-width="1.8" fill="none"/>
                            </svg>
                        </div>
                    `;
                    layer.appendChild(partyStage);

                    const partyColors = ['#f43f5e', '#ec4899', '#3b82f6', '#06b6d4', '#10b981', '#facc15', '#fb923c', '#a855f7', '#ffffff'];

                    // 🎊 產生大爆發碎屑
                    function createConfettiBurst(originX, originY, baseAngleDeg) {
                        const count = 80 + Math.floor(Math.random() * 30); 

                        for (let i = 0; i < count; i++) {
                            const p = document.createElement('div');
                            p.className = 'confetti-particle';

                            const color = partyColors[Math.floor(Math.random() * partyColors.length)];
                            const isRibbon = Math.random() < 0.55; 

                            p.style.left = `${originX}px`;
                            p.style.top = `${originY}px`;

                            const spreadAngle = (baseAngleDeg + (Math.random() * 100 - 50)) * Math.PI / 180;
                            const velocity = Math.random() * 250 + 200; 
                            const throwX = Math.cos(spreadAngle) * velocity;
                            const throwY = Math.sin(spreadAngle) * velocity * 1.5; 
                            
                            const dropY = throwY + (Math.random() * 300 + 200); 
                            const driftX = (Math.random() - 0.5) * 150; 

                            p.style.setProperty('--throw-x', `${throwX}px`);
                            p.style.setProperty('--throw-y', `${throwY}px`);
                            p.style.setProperty('--drop-y', `${dropY}px`);
                            p.style.setProperty('--drift-x', `${driftX}px`);
                            
                            p.style.setProperty('--rx', `${Math.random() * 1080 - 540}deg`);
                            p.style.setProperty('--ry', `${Math.random() * 1080 - 540}deg`);
                            p.style.setProperty('--rz', `${Math.random() * 1080 - 540}deg`);

                            const animDuration = (Math.random() * 1.5 + 2.5).toFixed(2);
                            p.style.animation = `confettiExplosion ${animDuration}s cubic-bezier(0.2, 0.8, 0.3, 1) forwards`;

                            if (isRibbon) {
                                const rWidth = Math.floor(Math.random() * 8 + 10);
                                const rHeight = Math.floor(Math.random() * 40 + 40);
                                p.innerHTML = `
                                    <svg viewBox="0 0 16 40" width="${rWidth}px" height="${rHeight}px">
                                        <path d="M 2 2 Q 14 12 4 22 Q 14 32 3 40" stroke="${color}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
                                    </svg>
                                `;
                            } else {
                                const size = Math.floor(Math.random() * 8 + 7);
                                if (Math.random() > 0.5) {
                                    p.style.width = `${size}px`;
                                    p.style.height = `${size * 0.7}px`;
                                    p.style.backgroundColor = color;
                                    p.style.borderRadius = '3px';
                                } else {
                                    p.style.width = `${size}px`;
                                    p.style.height = `${size}px`;
                                    p.style.backgroundColor = color;
                                    p.style.borderRadius = '50%';
                                }
                            }

                            layer.appendChild(p);
                            setTimeout(() => { if (p.parentNode) p.remove(); }, animDuration * 1000 + 100);
                        }
                    }

                    // 🎁 執行開炮流程
                    function firePartyPopper(targetX, targetY, angleDeg = -75) {
                        if (window.partySessionId !== partySessionId) return;

                        const popper = document.createElement('div');
                        popper.className = 'party-popper-gun';
                        popper.style.left = `${targetX}px`;
                        popper.style.top = `${targetY}px`;
                        popper.style.setProperty('--angle', `${angleDeg}deg`);
                        popper.style.animation = 'popperShootAction 1.2s ease-out forwards';

                        popper.innerHTML = `
                            <svg viewBox="0 0 80 80" width="100%" height="100%">
                                <defs>
                                    <linearGradient id="popperStripeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#f43f5e"/>
                                        <stop offset="30%" stop-color="#facc15"/>
                                        <stop offset="60%" stop-color="#06b6d4"/>
                                        <stop offset="100%" stop-color="#a855f7"/>
                                    </linearGradient>
                                </defs>
                                <!-- 🧵 拉線 -->
                                <g class="popper-string-pull">
                                    <path d="M 40 68 Q 36 76 42 84" stroke="#e2e8f0" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                                    <circle cx="42" cy="84" r="3" fill="#f59e0b"/>
                                </g>
                                <!-- 圓錐拉炮本體 -->
                                <polygon points="40,68 18,22 62,22" fill="url(#popperStripeGrad)" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>
                                <!-- 💥 炸飛的前蓋 -->
                                <g class="popper-cap-blast">
                                    <ellipse cx="40" cy="22" rx="22" ry="7" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>
                                    <path d="M 20 22 Q 30 14 40 22 Q 50 14 60 22" fill="#fb923c"/>
                                </g>
                            </svg>
                        `;

                        layer.appendChild(popper);

                        setTimeout(() => {
                            if (window.partySessionId !== partySessionId) return;

                            playPopperSound(Math.random() * 0.3 + 0.9);

                            const rad = (angleDeg - 90) * Math.PI / 180;
                            const muzzleX = targetX + Math.cos(rad) * 35;
                            const muzzleY = targetY + Math.sin(rad) * 35;

                            const flash = document.createElement('div');
                            flash.className = 'popper-blast-flash';
                            flash.style.left = `${muzzleX}px`;
                            flash.style.top = `${muzzleY}px`;
                            layer.appendChild(flash);
                            setTimeout(() => { if(flash.parentNode) flash.remove(); }, 400);

                            createConfettiBurst(muzzleX, muzzleY, angleDeg);
                        }, 200);

                        setTimeout(() => {
                            if (popper.parentNode) popper.remove();
                        }, 1200);
                    }

                    // 🌟 點擊互動
                    layer.style.pointerEvents = 'auto';
                    layer.onpointerdown = (e) => {
                        if (window.sharedAudioCtx && window.sharedAudioCtx.state === 'suspended') {
                            window.sharedAudioCtx.resume();
                        }

                        const rect = layer.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;

                        const randomAngle = Math.random() * 40 - 110;
                        firePartyPopper(clickX, clickY, randomAngle);

                        if (!trialState.effect) {
                            gameState.points += 5;
                            saveGame();
                            updateUI();
                            showFloatText('🎉 歡樂派對 +5');
                        }
                    };

                    const popperSpawnSpots = [
                        { xFactor: 0.2, yFactor: 0.82, angle: -65 },
                        { xFactor: 0.8, yFactor: 0.82, angle: -115 },
                        { xFactor: 0.5, yFactor: 0.75, angle: -90 },
                        { xFactor: 0.32, yFactor: 0.85, angle: -75 },
                        { xFactor: 0.68, yFactor: 0.85, angle: -105 }
                    ];
                    let currentSpotIdx = 0;

                    function loopPartyPopperShow() {
                        if (window.partySessionId !== partySessionId) return;
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'confetti') return;

                        const rect = layer.getBoundingClientRect();
                        const spot = popperSpawnSpots[currentSpotIdx];
                        currentSpotIdx = (currentSpotIdx + 1) % popperSpawnSpots.length;

                        const posX = rect.width * spot.xFactor + (Math.random() * 40 - 20);
                        const posY = rect.height * spot.yFactor + (Math.random() * 30 - 15);

                        firePartyPopper(posX, posY, spot.angle);

                        window.partyInterval = setTimeout(loopPartyPopperShow, Math.random() * 1000 + 2600);
                    }

                    setTimeout(loopPartyPopperShow, 800);
                    break;
// 👻 【百鬼夜行】輕透淡霧 ＋ 白透長尾大幽靈 ＋ 點擊三四隻小鬼成群飄升版
                case 'ghost':
                    if (!document.getElementById('ghostEffectStyle')) {
                        const style = document.createElement('style');
                        style.id = 'ghostEffectStyle';
                        style.innerHTML = `
                            /* 🌟 1. 輕透淡灰冷霧舞台（極致輕透） */
                            .ghost-realm-stage {
                                position: absolute; inset: 0; width: 100%; height: 100%;
                                pointer-events: none; z-index: 12; overflow: hidden;
                                background: radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.08) 0%, rgba(51, 65, 85, 0.22) 100%);
                                mix-blend-mode: normal;
                                transition: opacity 0.8s ease-in-out;
                            }

                            /* 飄動的極淡白色輕煙層 */
                            .ghost-creepy-fog {
                                position: absolute; inset: -20%; width: 140%; height: 140%;
                                background: radial-gradient(ellipse at 30% 40%, rgba(241, 245, 249, 0.12) 0%, transparent 60%),
                                            radial-gradient(ellipse at 70% 60%, rgba(226, 232, 240, 0.1) 0%, transparent 60%);
                                filter: blur(35px);
                                animation: fogDrift 24s ease-in-out infinite alternate;
                                pointer-events: none;
                            }

                            @keyframes fogDrift {
                                0% { transform: translate(0, 0) scale(1); }
                                50% { transform: translate(-30px, 15px) scale(1.05); }
                                100% { transform: translate(25px, -15px) scale(1.02); }
                            }

                            /* 🌟 2. 飛掠幽靈樣式 */
                            .flying-ghost-spirit {
                                position: absolute;
                                pointer-events: none;
                                z-index: 15;
                                filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 30px rgba(224, 242, 254, 0.6));
                                will-change: transform, opacity;
                            }

                            /* 背景慢速橫向大幽靈軌跡 */
                            @keyframes ghostFlyLeftToRight {
                                0% { transform: translate3d(-180px, var(--start-y), 0) scale(var(--scale)) rotate(var(--rot-start)); opacity: 0; }
                                15% { opacity: 0.85; }
                                50% { transform: translate3d(50vw, calc(var(--start-y) + 25px), 0) scale(var(--scale)) rotate(calc(var(--rot-start) * -0.5)); }
                                85% { opacity: 0.85; }
                                100% { transform: translate3d(calc(100vw + 180px), var(--end-y), 0) scale(var(--scale)) rotate(var(--rot-end)); opacity: 0; }
                            }

                            @keyframes ghostFlyRightToLeft {
                                0% { transform: translate3d(calc(100vw + 180px), var(--start-y), 0) scale(var(--scale)) scaleX(-1) rotate(var(--rot-start)); opacity: 0; }
                                15% { opacity: 0.85; }
                                50% { transform: translate3d(50vw, calc(var(--start-y) - 25px), 0) scale(var(--scale)) scaleX(-1) rotate(calc(var(--rot-start) * -0.5)); }
                                85% { opacity: 0.85; }
                                100% { transform: translate3d(-180px, var(--end-y), 0) scale(var(--scale)) scaleX(-1) rotate(var(--rot-end)); opacity: 0; }
                            }

                            /* 🌟 3. 點擊生成的小幽靈：向左上/右上緩緩蜿蜒升空 */
                            @keyframes miniGhostFloatUp {
                                0% {
                                    transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.3) rotate(0deg);
                                    opacity: 0;
                                }
                                20% {
                                    opacity: 0.95;
                                    transform: translate(-50%, -50%) translate3d(calc(var(--drift-x) * 0.25), -60px, 0) scale(var(--target-scale)) rotate(var(--rot-mid));
                                }
                                60% {
                                    opacity: 0.85;
                                    transform: translate(-50%, -50%) translate3d(calc(var(--drift-x) * 0.75), -180px, 0) scale(calc(var(--target-scale) * 1.05)) rotate(calc(var(--rot-mid) * -0.6));
                                }
                                100% {
                                    opacity: 0;
                                    transform: translate(-50%, -50%) translate3d(var(--drift-x), -320px, 0) scale(calc(var(--target-scale) * 1.15)) rotate(var(--rot-end));
                                }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    const ghostSessionId = Math.random();
                    window.ghostSessionId = ghostSessionId;

                    // 🕯️ 【Web Audio 輕柔空靈風鳴背景音】
                    function startGhostAmbientSound() {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            if (window.synthGhostAmbience) return;

                            const bufferLen = ctx.sampleRate * 4;
                            const buffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
                            const data = buffer.getChannelData(0);
                            let last = 0;
                            for (let i = 0; i < bufferLen; i++) {
                                const white = Math.random() * 2 - 1;
                                last = (last + 0.02 * white) / 1.02;
                                data[i] = last * 2.2;
                            }
                            const windSrc = ctx.createBufferSource();
                            windSrc.buffer = buffer;
                            windSrc.loop = true;

                            const windFilter = ctx.createBiquadFilter();
                            windFilter.type = 'bandpass';
                            windFilter.frequency.setValueAtTime(320, ctx.currentTime);
                            windFilter.Q.setValueAtTime(3.0, ctx.currentTime);

                            const lfo = ctx.createOscillator();
                            lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
                            const lfoGain = ctx.createGain();
                            lfoGain.gain.setValueAtTime(100, ctx.currentTime);
                            lfo.connect(lfoGain);
                            lfoGain.connect(windFilter.frequency);
                            lfo.start();

                            const windGain = ctx.createGain();
                            windGain.gain.setValueAtTime(0.005, ctx.currentTime);
                            windGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2.5);

                            windSrc.connect(windFilter);
                            windFilter.connect(windGain);
                            windGain.connect(ctx.destination);
                            windSrc.start();

                            window.synthGhostAmbience = {
                                stop: function() {
                                    windGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                                    setTimeout(() => {
                                        try { windSrc.stop(); windSrc.disconnect(); lfo.stop(); } catch(e) {}
                                    }, 850);
                                }
                            };
                        } catch (e) {
                            console.error('Ghost ambient sound error:', e);
                        }
                    }

                    // 👻 【悠長慢速幽靈哭鳴聲】
                    function playGhostSwooshSound(pitchMultiplier = 1.0, durationMultiplier = 1.0) {
                        try {
                            if (!window.sharedAudioCtx) window.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                            const ctx = window.sharedAudioCtx;
                            if (ctx.state === 'suspended') ctx.resume();

                            const now = ctx.currentTime;
                            const dur = 3.0 * durationMultiplier;

                            const osc = ctx.createOscillator();
                            osc.type = 'sine';
                            const baseFreq = 290 * pitchMultiplier;
                            osc.frequency.setValueAtTime(baseFreq * 0.8, now);
                            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + dur * 0.45);
                            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + dur);

                            const vibrato = ctx.createOscillator();
                            vibrato.frequency.setValueAtTime(3.5, now);
                            const vibGain = ctx.createGain();
                            vibGain.gain.setValueAtTime(16, now);
                            vibrato.connect(vibGain);
                            vibGain.connect(osc.frequency);
                            vibrato.start(now);
                            vibrato.stop(now + dur);

                            const filter = ctx.createBiquadFilter();
                            filter.type = 'lowpass';
                            filter.frequency.setValueAtTime(950, now);

                            const gain = ctx.createGain();
                            gain.gain.setValueAtTime(0.001, now);
                            gain.gain.linearRampToValueAtTime(0.18, now + dur * 0.4);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

                            osc.connect(filter);
                            filter.connect(gain);
                            gain.connect(ctx.destination);

                            osc.start(now);
                            osc.stop(now + dur);
                        } catch(e) {
                            console.error('Ghost whoosh sound error:', e);
                        }
                    }

                    startGhostAmbientSound();

                    // 淡霧背景
                    const fogStage = document.createElement('div');
                    fogStage.className = 'ghost-realm-stage';
                    fogStage.innerHTML = `<div class="ghost-creepy-fog"></div>`;
                    layer.appendChild(fogStage);

                    // 👻 【白色、超長拉絲飄逸尾巴的純白 SVG 幽靈】
                    function createGhostSVG() {
                        return `
                            <svg viewBox="0 0 100 180" width="100%" height="100%">
                                <defs>
                                    <linearGradient id="pureWhiteGhostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
                                        <stop offset="45%" stop-color="#f8fafc" stop-opacity="0.85"/>
                                        <stop offset="75%" stop-color="#e2e8f0" stop-opacity="0.5"/>
                                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path d="M 50 12 C 28 12 18 36 18 64 C 18 90 28 115 36 138 C 42 155 46 175 48 180 C 50 172 56 150 62 132 C 72 108 82 86 82 64 C 82 36 72 12 50 12 Z" 
                                      fill="url(#pureWhiteGhostGrad)" />
                                <path d="M 22 56 Q 8 62 16 70 Q 24 68 26 60 Z" fill="#ffffff" opacity="0.95"/>
                                <path d="M 78 56 Q 92 62 84 70 Q 76 68 74 60 Z" fill="#ffffff" opacity="0.95"/>
                                <ellipse cx="38" cy="46" rx="5" ry="6.5" fill="#1e293b"/>
                                <ellipse cx="62" cy="46" rx="5" ry="6.5" fill="#1e293b"/>
                                <circle cx="36" cy="44" r="1.8" fill="#ffffff"/>
                                <circle cx="60" cy="44" r="1.8" fill="#ffffff"/>
                                <ellipse cx="30" cy="54" rx="4.5" ry="2.2" fill="#fca5a5" opacity="0.5"/>
                                <ellipse cx="70" cy="54" rx="4.5" ry="2.2" fill="#fca5a5" opacity="0.5"/>
                                <ellipse cx="50" cy="58" rx="3.5" ry="4.5" fill="#1e293b"/>
                            </svg>
                        `;
                    }

                    // 👻 【背景慢速飛掠大幽靈】
                    function spawnFlyingGhost() {
                        if (window.ghostSessionId !== ghostSessionId) return;

                        const ghost = document.createElement('div');
                        ghost.className = 'flying-ghost-spirit';

                        const isLeftToRight = Math.random() > 0.5;
                        const width = Math.floor(Math.random() * 40 + 90);
                        const height = Math.floor(width * 1.8);
                        const startY = Math.floor(Math.random() * 65 + 10) + 'vh';
                        const endY = Math.floor(Math.random() * 65 + 10) + 'vh';
                        const duration = (Math.random() * 2.0 + 4.5).toFixed(2);
                        const rotStart = (Math.random() * 20 - 10) + 'deg';
                        const rotEnd = (Math.random() * 24 - 12) + 'deg';

                        ghost.style.width = `${width}px`;
                        ghost.style.height = `${height}px`;
                        ghost.style.setProperty('--start-y', startY);
                        ghost.style.setProperty('--end-y', endY);
                        ghost.style.setProperty('--scale', (Math.random() * 0.3 + 0.9).toFixed(2));
                        ghost.style.setProperty('--rot-start', rotStart);
                        ghost.style.setProperty('--rot-end', rotEnd);

                        ghost.style.animation = `${isLeftToRight ? 'ghostFlyLeftToRight' : 'ghostFlyRightToLeft'} ${duration}s ease-in-out forwards`;
                        ghost.innerHTML = createGhostSVG();

                        layer.appendChild(ghost);
                        playGhostSwooshSound(Math.random() * 0.4 + 0.8, 1.0);

                        setTimeout(() => {
                            if (ghost.parentNode) ghost.remove();
                        }, duration * 1000 + 100);
                    }

                    // 🌟 點擊滑鼠：一次生成 3 ~ 4 隻小巧幽靈緩慢向上飄散
                    layer.style.pointerEvents = 'auto';
                    layer.onpointerdown = (e) => {
                        if (window.sharedAudioCtx && window.sharedAudioCtx.state === 'suspended') {
                            window.sharedAudioCtx.resume();
                        }
                        startGhostAmbientSound();

                        const rect = layer.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;

                        const ghostCount = Math.floor(Math.random() * 2) + 3; // 隨機 3 或 4 隻

                        for (let i = 0; i < ghostCount; i++) {
                            setTimeout(() => {
                                const miniGhost = document.createElement('div');
                                miniGhost.className = 'flying-ghost-spirit';

                                // 小幽靈尺寸（36px ~ 48px，修長比例）
                                const miniWidth = Math.floor(Math.random() * 12 + 36);
                                const miniHeight = Math.floor(miniWidth * 1.8);

                                // 點擊位置周圍微微錯開
                                const offsetX = (Math.random() * 36 - 18);
                                const offsetY = (Math.random() * 20 - 10);
                                miniGhost.style.left = `${clickX + offsetX}px`;
                                miniGhost.style.top = `${clickY + offsetY}px`;
                                miniGhost.style.width = `${miniWidth}px`;
                                miniGhost.style.height = `${miniHeight}px`;

                                // 每隻小幽靈各自不同的向上飄移軌跡與擺動
                                const driftX = (Math.random() * 160 - 80) + 'px'; // 左右擴散飄
                                const rotMid = (Math.random() * 24 - 12) + 'deg';
                                const rotEnd = (Math.random() * 36 - 18) + 'deg';
                                const animDur = (Math.random() * 0.6 + 1.8).toFixed(2); // 1.8s ~ 2.4s 悠長飄升

                                miniGhost.style.setProperty('--drift-x', driftX);
                                miniGhost.style.setProperty('--rot-mid', rotMid);
                                miniGhost.style.setProperty('--rot-end', rotEnd);
                                miniGhost.style.setProperty('--target-scale', (Math.random() * 0.3 + 0.85).toFixed(2));

                                miniGhost.style.animation = `miniGhostFloatUp ${animDur}s ease-out forwards`;
                                miniGhost.innerHTML = createGhostSVG();
                                layer.appendChild(miniGhost);

                                setTimeout(() => {
                                    if (miniGhost.parentNode) miniGhost.remove();
                                }, animDur * 1000 + 100);
                            }, i * 120); // 每隻小幽靈微幅錯開 120ms，呈現依序竄升感
                        }

                        // 點擊觸發空靈幽靈滑音
                        playGhostSwooshSound(1.35, 0.7);

                        // 試用期間不加積分，正式購買後才加分
                        if (!trialState.effect) {
                            gameState.points += 5;
                            saveGame();
                            updateUI();
                            showFloatText('👻 百鬼夜行 +5');
                        }
                    };

                    // 👻 背景群鬼穿梭循環
                    function loopGhostSwarm() {
                        if (window.ghostSessionId !== ghostSessionId) return;
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'ghost') return;

                        spawnFlyingGhost();
                        if (Math.random() < 0.35) {
                            setTimeout(spawnFlyingGhost, 800);
                        }

                        window.ghostInterval = setTimeout(loopGhostSwarm, Math.random() * 1700 + 1800);
                    }

                    setTimeout(loopGhostSwarm, 600);
                    break;
                    
// 💖 【心動幻境】水晶愛心由下往上飄、帶有朦朧透光感，支援滑鼠互動與左下角正方形色系切換
case 'heartbeat':
    if (window.heartbeatAnimFrame) cancelAnimationFrame(window.heartbeatAnimFrame);
    if (window.heartbeatTimeout) clearTimeout(window.heartbeatTimeout);

    let hbCanvas = document.getElementById('heartbeatCanvas');
    if (!hbCanvas) {
        hbCanvas = document.createElement('canvas');
        hbCanvas.id = 'heartbeatCanvas';
        hbCanvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:99;';
        layer.appendChild(hbCanvas);
    }

    // 💖 【心動幻境】左下角愛心色系面板（正方形純色塊切換）
    const heartPalettePanel = document.getElementById('paintPalettePanel');
    if (heartPalettePanel) {
        heartPalettePanel.style.display = 'flex';
        const paletteBtns = heartPalettePanel.querySelectorAll('.palette-btn');
        
        // 設定三個正方形色塊的顏色：粉色、紅色、橘色
        if (paletteBtns.length >= 3) {
            paletteBtns[0].style.background = '#ff85a1'; // 粉色
            paletteBtns[1].style.background = '#ff4d6d'; // 紅色
            paletteBtns[2].style.background = '#fb923c'; // 橘色
            
            paletteBtns.forEach((b, idx) => {
                b.onclick = () => {
                    currentHeartColor = ['#ff85a1', '#ff4d6d', '#fb923c'][idx];
                    paletteBtns.forEach(btn => btn.classList.remove('active'));
                    b.classList.add('active');
                    showFloatText('💖 已切換愛心色系');
                };
            });
        }
    }

    const hbCtx = hbCanvas.getContext('2d');
    let projectorHearts = [];
    let currentHeartColor = '#ff85a1'; // 預設愛心顏色為粉色

    function resizeHbCanvas() {
        hbCanvas.width = hbCanvas.offsetWidth;
        hbCanvas.height = hbCanvas.offsetHeight;
    }
    resizeHbCanvas();

    function spawnProjectorHeart() {
        if (gameState.currentEffect !== 'heartbeat' && trialState.effect !== 'heartbeat') return;

        const w = hbCanvas.width;
        const h = hbCanvas.height;
        
        projectorHearts.push({
            startX: w * (0.1 + Math.random() * 0.8),
            startY: h + 30, // 從畫面底部出發
            endY: h * (0.1 + Math.random() * 0.3), // 飄到上方
            maxScale: 0.6 + Math.random() * 0.5,
            progress: 0,
            speed: 0.006 + Math.random() * 0.006,
            color: currentHeartColor, // 使用目前選定的顏色
            alpha: 0,
            isMouseHeart: false
        });

        if (projectorHearts.length > 14) projectorHearts.shift();

        let nextTime = 400 + Math.random() * 500;
        window.heartbeatTimeout = setTimeout(spawnProjectorHeart, nextTime);
    }
    // 🦈 【深海魚群】鯊魚風暴 ＋ 滑鼠點擊冒出晶瑩上升泡泡版！
case 'fish': {
    // 1. 全域深海透光暗藍背景
    const seaBg = document.createElement('div');
    seaBg.className = 'shark-vortex-bg';
    layer.appendChild(seaBg);

    // 2. 中心發光光柱
    const glow = document.createElement('div');
    glow.className = 'shark-center-glow';
    layer.appendChild(glow);

    // 3. 真實流線魚形 SVG：大胸鰭在前、小鰭在後、月牙形流線尾巴！
    const sharkSVG = `<svg viewBox="0 0 160 70" width="100%" height="100%">
        <path d="M 155 35 C 130 18, 85 16, 45 28 C 30 31, 15 33, 5 35 C 15 37, 30 39, 45 42 C 85 54, 130 52, 155 35 Z" fill="currentColor"/>
        <path d="M 100 24 C 92 8, 80 0, 72 2 C 75 12, 78 20, 80 27 Z" fill="currentColor"/>
        <path d="M 105 32 C 96 14, 82 5, 75 8 C 78 18, 85 28, 92 34 Z" fill="currentColor"/>
        <path d="M 105 38 C 96 56, 82 65, 75 62 C 78 52, 85 42, 92 36 Z" fill="currentColor"/>
        <path d="M 40 30 C 35 24, 30 22, 26 23 C 28 27, 30 30, 32 32 Z" fill="currentColor"/>
        <path d="M 40 40 C 35 46, 30 48, 26 47 C 28 43, 30 40, 32 38 Z" fill="currentColor"/>
        <path d="M 12 35 C 6 22, 0 10, -2 8 C 2 18, 5 28, 4 35 C 5 42, 2 52, -2 62 C 0 60, 6 48, 12 35 Z" fill="currentColor"/>
    </svg>`;

    // 4. 建立 5 層密集深海同心風暴軌道（共 44 隻魚！）
    const ringLayers = [
        { radius: 85, count: 10, sharkSize: 32, color: '#7dd3fc', opacity: 0.85, blur: 0.2, duration: 14, zIndex: 3 },
        { radius: 155, count: 9, sharkSize: 50, color: '#38bdf8', opacity: 0.78, blur: 0.6, duration: 22, zIndex: 4 },
        { radius: 235, count: 9, sharkSize: 75, color: '#0284c7', opacity: 0.82, blur: 1.2, duration: 32, zIndex: 5 },
        { radius: 325, count: 8, sharkSize: 105, color: '#0f172a', opacity: 0.90, blur: 2.0, duration: 45, zIndex: 6 },
        { radius: 425, count: 8, sharkSize: 145, color: '#020617', opacity: 0.96, blur: 3.0, duration: 60, zIndex: 7 }
    ];

    ringLayers.forEach((r) => {
        const ringTrack = document.createElement('div');
        ringTrack.className = 'shark-ring-track';
        const diameter = r.radius * 2;
        ringTrack.style.width = diameter + 'px';
        ringTrack.style.height = diameter + 'px';
        ringTrack.style.zIndex = r.zIndex;
        ringTrack.style.animation = `ringSpinClockwise ${r.duration}s linear infinite`;

        for (let i = 0; i < r.count; i++) {
            const angleDeg = (i / r.count) * 360;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = r.radius + Math.cos(angleRad) * r.radius;
            const y = r.radius + Math.sin(angleRad) * r.radius;

            const sharkEl = document.createElement('div');
            sharkEl.className = 'vortex-shark';
            sharkEl.innerHTML = sharkSVG;
            sharkEl.style.color = r.color;
            sharkEl.style.width = r.sharkSize + 'px';
            sharkEl.style.height = (r.sharkSize * 0.44) + 'px';
            sharkEl.style.opacity = r.opacity;
            if (r.blur > 0) sharkEl.style.filter = `blur(${r.blur}px)`;

            const tangentDeg = angleDeg + 90;
            sharkEl.style.left = x + 'px';
            sharkEl.style.top = y + 'px';
            sharkEl.style.transform = `translate(-50%, -50%) rotate(${tangentDeg}deg)`;

            ringTrack.appendChild(sharkEl);
        }

        layer.appendChild(ringTrack);
    });

    // 🌟 5. 滑鼠點擊生成「晶瑩深海上浮泡泡串」
    const stageEl = document.getElementById('mainStage');
    if (window.fishBubbleClickHandler) {
        stageEl.removeEventListener('pointerdown', window.fishBubbleClickHandler);
    }

    window.fishBubbleClickHandler = (e) => {
        const activeEffect = trialState.effect || gameState.currentEffect;
        if (activeEffect !== 'fish') {
            stageEl.removeEventListener('pointerdown', window.fishBubbleClickHandler);
            return;
        }

        // 如果點到海兔本體或按鈕就不冒泡，保持操作乾淨
        if (e.target.closest('#slugContainer') || e.target.closest('#floatingRecallBtn') || e.target.closest('#customTauntBtn')) {
            return;
        }

        const rect = layer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // 每次點擊噴出 4 ~ 6 顆大小不一的晶瑩氣泡
        const bubbleCount = Math.floor(Math.random() * 3) + 4;
        for (let b = 0; b < bubbleCount; b++) {
            const bubble = document.createElement('div');
            bubble.className = 'deep-sea-click-bubble';

            // 隨機大小 (10px ~ 28px)
            const size = Math.random() * 18 + 10;
            bubble.style.width = size + 'px';
            bubble.style.height = size + 'px';

            // 稍微在點擊點周圍隨機擴散 (半徑 20px 內)
            const offsetX = (Math.random() * 30 - 15);
            const offsetY = (Math.random() * 20 - 10);
            bubble.style.left = (clickX + offsetX) + 'px';
            bubble.style.top = (clickY + offsetY) + 'px';

            // 左右搖擺浮動幅度 (20px ~ 50px)
            const driftX = (Math.random() * 35 + 15) * (Math.random() > 0.5 ? 1 : -1);
            bubble.style.setProperty('--drift-x', driftX + 'px');

            // 隨機慢速飄動時間 (2.2s ~ 3.2s) 與錯開微小延遲
            const duration = Math.random() * 1.0 + 2.2;
            const delay = b * 0.06;
            bubble.style.animationDuration = duration + 's';
            bubble.style.animationDelay = delay + 's';

            layer.appendChild(bubble);

            // 動畫結束後自動清除 DOM
            setTimeout(() => {
                if (bubble.parentNode) bubble.remove();
            }, (duration + delay) * 1000 + 100);
        }
    };

    stageEl.addEventListener('pointerdown', window.fishBubbleClickHandler);

    break;
}

// ☀️ 【陽光普照】電影級特效：自然發光丁達爾光束 + 柔和角落暖光暈 + 夢幻彩虹漏光與散景光斑
                case 'sun':
                    if (!document.getElementById('sunStyle')) {
                        const style = document.createElement('style');
                        style.id = 'sunStyle';
                        style.innerHTML = `
                            /* 🌟 1. 電影級暖黃色陽光濾鏡 */
                            .sun-cinematic-overlay {
                                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                background: radial-gradient(circle at 85% 15%, rgba(255, 253, 230, 0.5) 0%, rgba(251, 146, 60, 0.2) 50%, transparent 100%);
                                mix-blend-mode: color-dodge;
                                pointer-events: none; z-index: 1;
                                animation: sunBreathe 6s ease-in-out infinite alternate;
                            }
                            @keyframes sunBreathe { 0% { opacity: 0.7; } 100% { opacity: 1; } }

                            /* 🌟 2. 透亮發光的丁達爾光束 (透明漸層與強烈發光) */
                            .sun-god-rays {
                                position: absolute; top: -40%; right: -30%; width: 180%; height: 180%;
                                background: radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.9) 0%, rgba(254, 240, 138, 0.45) 25%, transparent 65%),
                                            repeating-linear-gradient(
                                                135deg,
                                                rgba(255, 255, 255, 0.35) 0%,
                                                rgba(255, 251, 235, 0.15) 10%,
                                                transparent 25%,
                                                transparent 45%
                                            );
                                filter: blur(25px) brightness(1.3);
                                mix-blend-mode: screen;
                                pointer-events: none; z-index: 2;
                                animation: rayShift 12s ease-in-out infinite alternate;
                            }
                            @keyframes rayShift { 0% { transform: rotate(-1deg) scale(1); opacity: 0.8; } 100% { transform: rotate(1.5deg) scale(1.06); opacity: 1; } }

                            /* 🌟 3. 彩虹漏光 (Prism / Aurora) */
                            .sun-prism-arc {
                                position: absolute; top: -20%; right: -10%; width: 80%; height: 120%;
                                border-radius: 50%;
                                box-shadow: -40px 40px 60px 20px rgba(96, 165, 250, 0.25),
                                            -80px 80px 80px 30px rgba(52, 211, 153, 0.2),
                                            -120px 120px 100px 40px rgba(250, 204, 21, 0.2),
                                            -160px 160px 120px 50px rgba(244, 63, 94, 0.15);
                                filter: blur(30px); pointer-events: none; z-index: 3;
                                mix-blend-mode: screen;
                                animation: auroraShift 8s ease-in-out infinite alternate;
                            }
                            @keyframes auroraShift { 0% { transform: scale(1) rotate(0deg); opacity: 0.6; } 100% { transform: scale(1.1) rotate(5deg); opacity: 0.9; } }

                            /* 🌟 4. 柔和光暈核心 (去除死板的十字線，改為自然溫暖的光暈) */
                            .sun-lens-flare { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; overflow: hidden; }
                            .sun-starburst { position: absolute; top: -10px; right: -10px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(254, 240, 138, 0.6) 30%, rgba(251, 146, 60, 0.2) 70%, transparent 100%); mix-blend-mode: screen; filter: blur(8px); animation: starburstPulse 5s ease-in-out infinite alternate; }
                            @keyframes starburstPulse { 0% { transform: scale(0.95); opacity: 0.85; } 100% { transform: scale(1.05); opacity: 1; } }

                            /* 🌟 4b. 夢幻柔焦光斑與光圈 (Bokeh & Lens Flares) */
                            .flare-ghost {
                                position: absolute;
                                border-radius: 50%;
                                mix-blend-mode: screen;
                                pointer-events: none;
                                transform: translate(-50%, -50%);
                                filter: blur(8px);
                            }
                            .ghost-1 {
                                top: 28%; left: 70%; width: 70px; height: 70px;
                                background: radial-gradient(circle, rgba(254, 240, 138, 0.35) 0%, rgba(251, 191, 36, 0.1) 60%, transparent 80%);
                            }
                            .ghost-2 {
                                top: 45%; left: 55%; width: 110px; height: 110px;
                                background: radial-gradient(circle, rgba(147, 197, 253, 0.3) 0%, rgba(56, 189, 248, 0.1) 60%, transparent 80%);
                            }
                            .ghost-3 {
                                top: 62%; left: 40%; width: 160px; height: 160px;
                                background: radial-gradient(circle, rgba(196, 181, 253, 0.25) 0%, rgba(139, 92, 246, 0.08) 60%, transparent 80%);
                            }
                            .ghost-4 {
                                top: 80%; left: 22%; width: 220px; height: 220px;
                                background: radial-gradient(circle, rgba(252, 165, 165, 0.2) 0%, transparent 70%);
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // 1. 建立夏日金黃暖光濾鏡
                    const goldenOverlay = document.createElement('div');
                    goldenOverlay.className = 'sun-cinematic-overlay';
                    layer.appendChild(goldenOverlay);

                    // 2. 建立透光、發光的丁達爾光束
                    const tyndallRays = document.createElement('div');
                    tyndallRays.className = 'sun-god-rays';
                    layer.appendChild(tyndallRays);

                    // 3. 建立彩虹漏光
                    const prismArc = document.createElement('div');
                    prismArc.className = 'sun-prism-arc';
                    layer.appendChild(prismArc);

                    // 4. 建立光暈與散景光斑
                    const flareContainer = document.createElement('div');
                    flareContainer.className = 'sun-lens-flare';
                    flareContainer.innerHTML = `
                        <div class="sun-starburst"></div>
                        <div class="flare-ghost ghost-1"></div>
                        <div class="flare-ghost ghost-2"></div>
                        <div class="flare-ghost ghost-3"></div>
                        <div class="flare-ghost ghost-4"></div>
                    `;
                    layer.appendChild(flareContainer);
                    break;
// 🎼 【跳動音符】手機版避開頂部 UI ＋ 滿版動態五線譜 ＋ 試用防刷分
                case 'music':
                    if (!document.getElementById('staffMusicStyle')) {
                        const style = document.createElement('style');
                        style.id = 'staffMusicStyle';
                        style.innerHTML = `
                            /* 🌟 1. 滿版背景大五線譜圖層 (電腦版在頂部 95px) */
                            .grand-bg-staff {
                                position: absolute;
                                top: 95px;
                                left: 0;
                                width: 100%;
                                height: 130px;
                                z-index: 30;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                                padding: 10px 0;
                                background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(250, 245, 255, 0.94) 50%, rgba(255, 255, 255, 0.88) 100%);
                                backdrop-filter: blur(5px);
                                box-shadow: 0 4px 20px rgba(168, 85, 247, 0.2);
                                pointer-events: none;
                            }

                            .grand-staff-line {
                                width: 100%;
                                height: 2px;
                                background: rgba(147, 51, 234, 0.55);
                                box-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
                            }

                            .grand-clef-symbol {
                                position: absolute;
                                left: 12px;
                                top: 50%;
                                transform: translateY(-50%);
                                font-size: 4.2rem;
                                color: rgba(147, 51, 234, 0.75);
                                font-weight: 900;
                                line-height: 1;
                                user-select: none;
                                text-shadow: 0 2px 8px rgba(255, 255, 255, 0.9);
                            }

                            .grand-notes-track {
                                position: absolute;
                                top: 0;
                                left: 70px;
                                right: 15px;
                                height: 100%;
                                display: flex;
                                align-items: center;
                                gap: 12px;
                                overflow-x: scroll !important;
                                pointer-events: auto !important;
                                touch-action: pan-x !important;
                                scroll-behavior: smooth;
                                -webkit-overflow-scrolling: touch;
                            }
                            .grand-notes-track::-webkit-scrollbar { display: none; }

                            .pinned-grand-note {
                                position: relative;
                                flex-shrink: 0;
                                width: 30px;
                                height: 30px;
                                border-radius: 50%;
                                font-weight: 900;
                                font-size: 0.85rem;
                                color: #fff;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border: 2px solid #ffffff;
                                box-shadow: 0 4px 10px rgba(0,0,0,0.22);
                                transition: transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                                animation: popIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                                cursor: pointer !important;
                                pointer-events: auto !important;
                            }
                            .pinned-grand-note:hover { transform: scale(1.15); filter: brightness(1.1); }
                            .pinned-grand-note:active { transform: scale(0.85); }
                            .pinned-grand-note.is-rest { border-radius: 10px; font-size: 1.1rem; }
                            .pinned-grand-note.playing-active {
                                transform: scale(1.4) !important;
                                filter: brightness(1.3) drop-shadow(0 0 12px #fde047);
                            }

                            /* 🌟 2. 懸浮音樂中控台 */
                            .staff-bottom-console {
                                position: absolute;
                                bottom: 46%;
                                right: 12px;
                                z-index: 65;
                                display: flex;
                                flex-direction: column;
                                gap: 6px;
                                background: rgba(255, 255, 255, 0.95);
                                border: 2.5px solid #c084fc;
                                border-radius: 20px;
                                padding: 8px 10px;
                                box-shadow: 0 8px 25px rgba(168, 85, 247, 0.35);
                                backdrop-filter: blur(6px);
                                pointer-events: auto !important;
                                width: auto;
                                max-width: 290px;
                            }

                            .console-btn {
                                background: #9333ea;
                                color: white;
                                border: none;
                                border-radius: 12px;
                                padding: 6px 10px;
                                font-weight: 900;
                                font-size: 0.82rem;
                                cursor: pointer !important;
                                transition: 0.1s;
                                box-shadow: 0 3px 0 #6b21a8;
                            }
                            .console-btn:active { transform: translateY(2px); box-shadow: none; }
                            .console-btn.btn-clear { background: #f43f5e; box-shadow: 0 3px 0 #be123c; }
                            .console-btn.active-toggle { background: #10b981; box-shadow: 0 3px 0 #059669; }

                            /* 🛒 音符商店 */
                            .note-shop-container { position: relative; }
                            .note-shop-grid {
                                display: grid;
                                grid-template-columns: repeat(5, 1fr);
                                gap: 4px;
                                background: #faf5ff;
                                border: 1.5px dashed #d8b4fe;
                                border-radius: 12px;
                                padding: 5px;
                                transition: all 0.2s ease-out;
                            }
                            .shop-note-btn {
                                border: 1.5px solid #ffffff;
                                border-radius: 10px;
                                padding: 4px 1px;
                                color: white;
                                font-weight: 900;
                                font-size: 0.75rem;
                                cursor: pointer;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                line-height: 1.1;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.12);
                                transition: transform 0.1s;
                            }
                            .shop-note-btn:active { transform: scale(0.9); }
                            .shop-price-tag {
                                font-size: 0.6rem;
                                background: rgba(0, 0, 0, 0.25);
                                border-radius: 6px;
                                padding: 1px 3px;
                                margin-top: 1px;
                            }

                            #btnToggleNoteShop {
                                display: none;
                                width: 100%;
                                background: linear-gradient(135deg, #a855f7, #ec4899);
                                color: white;
                                border: none;
                                border-radius: 12px;
                                padding: 6px 10px;
                                font-weight: 900;
                                font-size: 0.8rem;
                                cursor: pointer;
                                box-shadow: 0 2px 0 #7e22ce;
                            }

                            /* 🌟 3. 飄浮上升音符氣泡 */
                            .floating-staff-bubble {
                                position: absolute; bottom: -80px;
                                z-index: 10 !important;
                                cursor: pointer !important; pointer-events: auto !important;
                                border-radius: 50%; padding: 6px;
                                display: flex; flex-direction: column; align-items: center; justify-content: center;
                                font-weight: 900; color: white;
                                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
                                transition: transform 0.1s ease-out;
                                user-select: none; -webkit-user-select: none;
                                animation: staffNoteRise linear forwards;
                            }
                            .floating-staff-bubble:active { transform: scale(0.85) !important; }

                            @keyframes staffNoteRise {
                                0% { transform: translateY(0vh) translateX(0px) scale(0.8); opacity: 0; }
                                10% { opacity: 0.95; }
                                50% { transform: translateY(-55vh) translateX(var(--drift-x)) scale(1.05); }
                                85% { opacity: 0.95; }
                                100% { transform: translateY(-115vh) translateX(calc(var(--drift-x) * 1.5)) scale(0.8); opacity: 0; }
                            }

                            /* 📱 4. 手機版專屬響應式安全區 (完全避開頂部返回鍵、積分與提示欄) */
                            @media screen and (max-width: 768px) {
                                .grand-bg-staff {
                                    top: 115px !important; /* 往下移至 115px，完全避開頂部 UI */
                                    height: 100px !important;
                                    padding: 6px 0 !important;
                                }
                                .grand-clef-symbol {
                                    font-size: 3.2rem !important;
                                    left: 6px !important;
                                }
                                .grand-notes-track {
                                    left: 45px !important;
                                    gap: 8px !important;
                                }
                                .pinned-grand-note {
                                    width: 24px !important;
                                    height: 24px !important;
                                    font-size: 0.72rem !important;
                                }
                                .staff-bottom-console {
                                    bottom: 40% !important;
                                    right: 6px !important;
                                    max-width: 220px !important;
                                    padding: 6px 8px !important;
                                }
                                #btnToggleNoteShop {
                                    display: block !important;
                                }
                                .note-shop-grid {
                                    position: absolute;
                                    bottom: 105%;
                                    right: 0;
                                    width: 210px;
                                    background: rgba(255, 255, 255, 0.98);
                                    border: 2px solid #c084fc;
                                    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                                    display: none;
                                    z-index: 100;
                                }
                                .note-shop-grid.is-open {
                                    display: grid !important;
                                }
                                .floating-staff-bubble {
                                    width: 46px !important;
                                    height: 46px !important;
                                }
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    // 1. 初始化全域狀態
                    const currentSession = Math.random();
                    window.staffSessionId = currentSession;
                    window.collectedStaffNotes = [];
                    window.staffPlaySpeed = 300;
                    window.staffIsLooping = false;

                    // 背景大五線譜
                    const grandStaff = document.createElement('div');
                    grandStaff.className = 'grand-bg-staff';
                    grandStaff.innerHTML = `
                        <div class="grand-clef-symbol">𝄞</div>
                        <div class="grand-staff-line"></div>
                        <div class="grand-staff-line"></div>
                        <div class="grand-staff-line"></div>
                        <div class="grand-staff-line"></div>
                        <div class="grand-staff-line"></div>
                        <div class="grand-notes-track" id="staffNotesTrack"></div>
                    `;
                    layer.appendChild(grandStaff);

                    // 2. 音符音階資料庫
                    const staffScaleNotes = [
                        { name: 'Do', note: 'C5', freq: 523.25, color: '#ef4444', offsetY: 36, isRest: false },
                        { name: 'Re', note: 'D5', freq: 587.33, color: '#f97316', offsetY: 26, isRest: false },
                        { name: 'Mi', note: 'E5', freq: 659.25, color: '#eab308', offsetY: 16, isRest: false },
                        { name: 'Fa', note: 'F5', freq: 698.46, color: '#22c55e', offsetY: 6, isRest: false },
                        { name: 'Sol', note: 'G5', freq: 783.99, color: '#06b6d4', offsetY: -4, isRest: false },
                        { name: 'La', note: 'A5', freq: 880.00, color: '#3b82f6', offsetY: -14, isRest: false },
                        { name: 'Si', note: 'B5', freq: 987.77, color: '#8b5cf6', offsetY: -24, isRest: false },
                        { name: 'Dȯ', note: 'C6', freq: 1046.50, color: '#ec4899', offsetY: -34, isRest: false },
                        { name: '𝄽', label: '休止', note: 'REST', freq: 0, color: '#475569', offsetY: 0, isRest: true }
                    ];

                    // 懸浮中控台 ＆ 音符商店 DOM
                    const controlConsole = document.createElement('div');
                    controlConsole.className = 'staff-bottom-console';
                    controlConsole.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:900; font-size:0.82rem; color:#7e22ce;" id="txtStaffCount">🎼 樂譜 (0/32)</span>
                            <button class="console-btn" id="btnStaffSpeed" style="padding:2px 6px; font-size:0.75rem; background:#6366f1; box-shadow:0 2px 0 #4338ca;">⚡ 1.0x</button>
                        </div>
                        
                        <div class="note-shop-container">
                            <button id="btnToggleNoteShop">🛒 買音符 (1分/個) ▾</button>
                            <div class="note-shop-grid" id="noteShopGrid"></div>
                        </div>

                        <div style="display:flex; gap:5px; justify-content:space-between;">
                            <button class="console-btn" id="btnPlayStaff" style="flex:1;">▶️ 播放</button>
                            <button class="console-btn" id="btnLoopStaff" style="flex:1;">🔁 循環: 關</button>
                            <button class="console-btn btn-clear" id="btnClearStaff">🗑️</button>
                        </div>
                    `;
                    layer.appendChild(controlConsole);

                    // 3. 渲染小商店的 9 個音符按鈕
                    const shopGrid = controlConsole.querySelector('#noteShopGrid');
                    staffScaleNotes.forEach(item => {
                        const shopBtn = document.createElement('button');
                        shopBtn.className = 'shop-note-btn';
                        shopBtn.style.background = item.color;
                        shopBtn.innerHTML = `
                            <span>${item.name}</span>
                            <span class="shop-price-tag">1分</span>
                        `;
                        shopBtn.onclick = (e) => {
                            e.stopPropagation();
                            buyNoteDirectly(item);
                        };
                        shopGrid.appendChild(shopBtn);
                    });

                    const toggleShopBtn = controlConsole.querySelector('#btnToggleNoteShop');
                    toggleShopBtn.onclick = (e) => {
                        e.stopPropagation();
                        shopGrid.classList.toggle('is-open');
                        toggleShopBtn.innerText = shopGrid.classList.contains('is-open') ? '🛒 收起商店 ▴' : '🛒 買音符 (1分/個) ▾';
                    };

                    // 4. 重繪五線譜上的音符與單擊刪除
                    function renderStaffTrack(autoScrollToEnd = false) {
                        const track = document.getElementById('staffNotesTrack');
                        if (!track) return;
                        track.innerHTML = '';

                        // 依據螢幕寬度微調偏移比例
                        const isMobile = window.innerWidth <= 768;
                        const scaleFactor = isMobile ? 0.72 : 1;

                        window.collectedStaffNotes.forEach((noteData, index) => {
                            const pinnedNote = document.createElement('div');
                            pinnedNote.className = `pinned-grand-note ${noteData.isRest ? 'is-rest' : ''}`;
                            pinnedNote.style.background = noteData.color;
                            pinnedNote.style.top = (noteData.offsetY * scaleFactor) + 'px';
                            pinnedNote.innerText = noteData.name;
                            pinnedNote.id = `staff-note-${index}`;
                            pinnedNote.title = '點擊刪除此音符';

                            pinnedNote.onclick = (e) => {
                                e.stopPropagation();
                                removeNoteFromStaff(index);
                            };

                            track.appendChild(pinnedNote);
                        });

                        const countEl = document.getElementById('txtStaffCount');
                        if (countEl) countEl.innerText = `🎼 樂譜 (${window.collectedStaffNotes.length}/32)`;

                        if (autoScrollToEnd) {
                            setTimeout(() => {
                                track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
                            }, 50);
                        }
                    }

                    function removeNoteFromStaff(index) {
                        if (isPlayingStaff) return;
                        if (index < 0 || index >= window.collectedStaffNotes.length) return;

                        const removed = window.collectedStaffNotes.splice(index, 1)[0];
                        renderStaffTrack(false);
                        showFloatText(`🗑️ 已刪除 ${removed.label || removed.name}`);
                    }

                    // 5. 🛒 商店購買音符（試用模式不扣分）
                    function buyNoteDirectly(noteData) {
                        if (window.collectedStaffNotes.length >= 32) {
                            showFloatText('樂譜已經放滿 32 個音囉！🎶');
                            return;
                        }

                        if (!trialState.effect) {
                            if (gameState.points < 1) {
                                showFloatText('積分不足 1 分 😢');
                                return;
                            }
                            gameState.points -= 1;
                            saveGame();
                            updateUI();
                            showFloatText(`-1分 🛒 +${noteData.label || noteData.name}`);
                        } else {
                            showFloatText(`試用體驗 🛒 +${noteData.label || noteData.name}`);
                        }

                        if (noteData.isRest) {
                            playSingleStaffTone(150, 0.05);
                        } else {
                            playSingleStaffTone(noteData.freq, 0.25);
                        }

                        window.collectedStaffNotes.push(noteData);
                        renderStaffTrack(true);
                    }

                    // 6. 飄浮氣泡點擊收集（試用模式不加分）
                    function collectNoteToStaff(noteData, bubbleEl) {
                        if (window.collectedStaffNotes.length >= 32) {
                            showFloatText('樂譜已經放滿 32 個音囉！按播放欣賞吧 🎶');
                            return;
                        }

                        if (noteData.isRest) {
                            playSingleStaffTone(150, 0.05);
                        } else {
                            playSingleStaffTone(noteData.freq, 0.25);
                        }

                        window.collectedStaffNotes.push(noteData);
                        renderStaffTrack(true);

                        if (!trialState.effect) {
                            gameState.points += 15;
                            saveGame();
                            updateUI();
                            showFloatText(`+15 ${noteData.label || noteData.name} 🎵`);
                        } else {
                            showFloatText(`試用體驗 🎵 ${noteData.label || noteData.name}`);
                        }

                        bubbleEl.remove();
                    }

                    // 7. 速度切換邏輯
                    const speedBtn = document.getElementById('btnStaffSpeed');
                    const speeds = [
                        { label: '⚡ 0.5x', ms: 500 },
                        { label: '⚡ 1.0x', ms: 300 },
                        { label: '⚡ 1.5x', ms: 200 },
                        { label: '⚡ 2.0x', ms: 140 }
                    ];
                    let speedIdx = 1;

                    speedBtn.onclick = (e) => {
                        e.stopPropagation();
                        speedIdx = (speedIdx + 1) % speeds.length;
                        window.staffPlaySpeed = speeds[speedIdx].ms;
                        speedBtn.innerText = speeds[speedIdx].label;
                        showFloatText(`速度切換: ${speeds[speedIdx].label}`);
                    };

                    // 8. 循環播放開關
                    const loopBtn = document.getElementById('btnLoopStaff');
                    loopBtn.onclick = (e) => {
                        e.stopPropagation();
                        window.staffIsLooping = !window.staffIsLooping;
                        if (window.staffIsLooping) {
                            loopBtn.innerText = '🔁 循環: 開';
                            loopBtn.classList.add('active-toggle');
                        } else {
                            loopBtn.innerText = '🔁 循環: 關';
                            loopBtn.classList.remove('active-toggle');
                        }
                    };

                    // 9. 播放引擎
                    let isPlayingStaff = false;
                    const playBtn = document.getElementById('btnPlayStaff');
                    const clearBtn = document.getElementById('btnClearStaff');

                    function playScoreSequence() {
                        if (window.collectedStaffNotes.length === 0) return;
                        isPlayingStaff = true;
                        playBtn.innerText = '🎶 停止';
                        playBtn.style.background = '#10b981';

                        let step = 0;
                        const track = document.getElementById('staffNotesTrack');

                        function playStep() {
                            if (!isPlayingStaff || window.staffSessionId !== currentSession) return;

                            if (step >= window.collectedStaffNotes.length) {
                                document.querySelectorAll('.pinned-grand-note').forEach(n => n.classList.remove('playing-active'));
                                if (window.staffIsLooping) {
                                    step = 0;
                                    if (track) track.scrollTo({ left: 0, behavior: 'smooth' });
                                    window.staffPlayTimeout = setTimeout(playStep, window.staffPlaySpeed * 1.5);
                                    return;
                                } else {
                                    isPlayingStaff = false;
                                    playBtn.innerText = '▶️ 播放';
                                    playBtn.style.background = '#9333ea';
                                    return;
                                }
                            }

                            document.querySelectorAll('.pinned-grand-note').forEach(n => n.classList.remove('playing-active'));
                            const curEl = document.getElementById(`staff-note-${step}`);
                            if (curEl) {
                                curEl.classList.add('playing-active');
                                if (track) {
                                    const targetLeft = curEl.offsetLeft - (track.clientWidth / 2) + 20;
                                    track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
                                }
                            }

                            const curNote = window.collectedStaffNotes[step];
                            if (!curNote.isRest) {
                                playSingleStaffTone(curNote.freq, 0.28);
                            }

                            step++;
                            window.staffPlayTimeout = setTimeout(playStep, window.staffPlaySpeed);
                        }

                        playStep();
                    }

                    playBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (isPlayingStaff) {
                            isPlayingStaff = false;
                            if (window.staffPlayTimeout) clearTimeout(window.staffPlayTimeout);
                            playBtn.innerText = '▶️ 播放';
                            playBtn.style.background = '#9333ea';
                            document.querySelectorAll('.pinned-grand-note').forEach(n => n.classList.remove('playing-active'));
                        } else {
                            if (window.collectedStaffNotes.length === 0) {
                                showFloatText('還沒有音符喔！點擊音符或在商店購買 ✨');
                                return;
                            }
                            playScoreSequence();
                        }
                    };

                    clearBtn.onclick = (e) => {
                        e.stopPropagation();
                        isPlayingStaff = false;
                        if (window.staffPlayTimeout) clearTimeout(window.staffPlayTimeout);
                        window.collectedStaffNotes = [];
                        renderStaffTrack(false);
                        const track = document.getElementById('staffNotesTrack');
                        if (track) track.scrollTo({ left: 0, behavior: 'smooth' });
                        playBtn.innerText = '▶️ 播放';
                        playBtn.style.background = '#9333ea';
                        showFloatText('🧹 五線譜已清空');
                    };

                    // 10. 動態音符雨產生器
                    let notePool = [];
                    function getBalancedNote() {
                        if (notePool.length === 0) {
                            notePool = [...staffScaleNotes].sort(() => Math.random() - 0.5);
                        }
                        return notePool.pop();
                    }

                    function spawnSingleStaffBubble() {
                        if (window.staffSessionId !== currentSession) return;
                        const activeEffect = trialState.effect || gameState.currentEffect;
                        if (activeEffect !== 'music') return;

                        const currentBubbles = layer.querySelectorAll('.floating-staff-bubble');
                        if (currentBubbles.length >= 25) return;

                        const bubbleEl = document.createElement('div');
                        bubbleEl.className = 'floating-staff-bubble';

                        const noteData = getBalancedNote();

                        bubbleEl.style.background = noteData.color;
                        bubbleEl.style.border = '3px solid white';
                        bubbleEl.style.width = '56px';
                        bubbleEl.style.height = '56px';
                        bubbleEl.style.left = (Math.random() * 84 + 8) + '%';
                        bubbleEl.style.setProperty('--drift-x', (Math.random() * 70 - 35) + 'px');

                        bubbleEl.innerHTML = `
                            <div style="font-size:${noteData.isRest ? '1.3rem' : '1.05rem'}; line-height:1; opacity:0.95;">
                                ${noteData.isRest ? '𝄽' : '♪'}
                            </div>
                            <div style="font-size:0.95rem; font-weight:900; line-height:1.1;">
                                ${noteData.label || noteData.name}
                            </div>
                        `;

                        const duration = Math.random() * 2.0 + 4.5;
                        bubbleEl.style.animationDuration = duration + 's';

                        bubbleEl.onpointerdown = (e) => {
                            e.stopPropagation();
                            collectNoteToStaff(noteData, bubbleEl);
                        };

                        layer.appendChild(bubbleEl);

                        setTimeout(() => {
                            if (bubbleEl.parentNode) bubbleEl.remove();
                        }, duration * 1000 + 100);
                    }

                    for (let i = 0; i < 8; i++) {
                        setTimeout(spawnSingleStaffBubble, i * 150);
                    }

                    window.staffSpawnerInterval = setInterval(spawnSingleStaffBubble, 380);
                    break;
    // 💖 【心動幻境】滑鼠互動愛心監聽器：滑鼠滑過時在指標位置生成小愛心
    const mouseHeartHandler = (e) => {
        if (gameState.currentEffect !== 'heartbeat' && trialState.effect !== 'heartbeat') return;
        
        const rect = hbCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        projectorHearts.push({
            startX: x,
            startY: y,
            endY: y - 100, // 往上飄一小段距離
            maxScale: 0.35,
            progress: 0,
            speed: 0.02,
            color: currentHeartColor, // 同步使用當前選定顏色
            alpha: 0,
            isMouseHeart: true
        });
    };
    
    hbCanvas.style.pointerEvents = 'auto';
    hbCanvas.addEventListener('mousemove', mouseHeartHandler);

    function drawHeartPath(ctx, x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size, size);
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.bezierCurveTo(-25, -45, -65, -5, 0, 45);
        ctx.bezierCurveTo(65, -5, 25, -45, 0, -15);
        ctx.closePath();
        ctx.restore();
    }

    function renderHeartbeat() {
        if (gameState.currentEffect !== 'heartbeat' && trialState.effect !== 'heartbeat') {
            if (hbCanvas.parentNode) hbCanvas.parentNode.removeChild(hbCanvas);
            if (heartPalettePanel) heartPalettePanel.style.display = 'none'; // 離開時隱藏色票面板
            return;
        }
        window.heartbeatAnimFrame = requestAnimationFrame(renderHeartbeat);

        hbCtx.clearRect(0, 0, hbCanvas.width, hbCanvas.height);

        hbCtx.save();
        projectorHearts.forEach(h => {
            h.progress += h.speed;
            
            let currentY = h.startY + (h.endY - h.startY) * h.progress;
            let currentX = h.startX + (h.isMouseHeart ? Math.sin(h.progress * 10) * 15 : Math.sin(h.progress * Math.PI * 3) * 15);

            let peakAlpha = 0.35; 
            if (h.isMouseHeart) {
                peakAlpha = 0.6;
                if (h.progress > 0.7) h.alpha = ((1 - h.progress) / 0.3) * peakAlpha;
                else h.alpha = peakAlpha;
            } else {
                if (h.progress < 0.2) h.alpha = (h.progress / 0.2) * peakAlpha; 
                else if (h.progress > 0.8) h.alpha = ((1 - h.progress) / 0.2) * peakAlpha; 
                else h.alpha = peakAlpha;
            }

            if (h.progress >= 1) h.progress = 1;

            let currentScale = h.maxScale * (0.7 + 0.3 * (h.progress / 1));

            hbCtx.save();
            hbCtx.globalAlpha = h.alpha * 0.6;
            hbCtx.fillStyle = h.color;
            hbCtx.shadowColor = '#ffd1dc';
            hbCtx.shadowBlur = 10;

            drawHeartPath(hbCtx, currentX, currentY, currentScale);
            hbCtx.fill();

            hbCtx.restore();
        });
        hbCtx.restore();
    }

    renderHeartbeat();
    spawnProjectorHeart();
    setTimeout(spawnProjectorHeart, 500);
    break;
                // 🛠️ 其他通用的純 SVG 特效飄落
default:
    let count = effect.count || 15;
    for (let i = 0; i < count; i++) {
        let el = document.createElement('div');
        el.style.position = 'absolute'; el.style.left = Math.random() * 100 + '%'; el.style.opacity = Math.random() * 0.5 + 0.5;
        let svgItem = effect.svg[Math.floor(Math.random() * effect.svg.length)]; 
        let rawSVG = svgLib[svgItem.s] || svgLib['circle']; 
        el.innerHTML = rawSVG; if (svgItem.c) el.style.color = svgItem.c; 
        let size = Math.random() * 30 + 30; el.style.width = size + 'px'; el.style.height = size + 'px';
        
        if (effect.dir === 'up') {
            el.style.bottom = '-60px';
            
            // 🌟 【關鍵修改】：只有心動幻想(heartbeat)使用新的破掉動畫
            let animName = (effectKey === 'heartbeat') ? 'heartFloatAndPop' : 'bubbleRise';
            let duration = Math.random() * 2 + 3;
            el.style.animation = `${animName} ${duration}s ease-in-out infinite`;
            
        } else {
            el.style.top = '-60px'; 
            el.style.animation = `rainFall ${Math.random() * 3 + 3}s linear infinite`;
        }
        el.style.animationDelay = (Math.random() * 2) + 's';
        layer.appendChild(el);
    }
    break;
            }
        }
        
        // 🌟 處理餵食、洗澡、摸摸等賺積分的互動
        function interact(type, reward, cdSeconds) {
            if (gameState.cooldowns && gameState.cooldowns[type] > 0) return;

            gameState.points += reward;
            gameState.cooldowns[type] = cdSeconds; // 設定冷卻時間
            if (!gameState.cooldownUntil) gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
            gameState.cooldownUntil[type] = Date.now() + (cdSeconds * 1000);
            addDailyProgress(type);
            showFloatText(`+${reward}`);
            saveGame();
            updateUI();

            // 呼叫伺服器記綠動作
            const actionMap = { 'feed': 'FEED', 'clean': 'PURIFY', 'pet': 'PET' };
            if(actionMap[type]) {
                fetchAPI('/pet-games/interact', 'POST', { actionType: actionMap[type] });
            }
        }

        // 噴出獎勵數字的小動畫
        function showFloatText(text, duration = 1000) {
            const el = document.createElement('div');
            el.className = 'float-text'; el.innerText = text; el.style.left = '50%'; el.style.top = '30%';
            el.style.animation = `floatUp ${duration / 1000}s forwards cubic-bezier(0.18, 0.89, 0.32, 1.28)`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), duration);
        }

// 🌟 【冷卻倒數計時器：防刷分防重整版】
        function startCooldownTimer() {
            setInterval(() => {
                const now = Date.now();
                let changed = false;

                if (!gameState.cooldownUntil) {
                    gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
                }

                ['feed', 'clean', 'pet'].forEach(type => {
                    const targetTime = gameState.cooldownUntil[type] || 0;
                    const remainingMs = targetTime - now;

                    if (remainingMs > 0) {
                        const remainingSec = Math.ceil(remainingMs / 1000);
                        if (gameState.cooldowns[type] !== remainingSec) {
                            gameState.cooldowns[type] = remainingSec;
                            changed = true;
                        }
                    } else {
                        if (gameState.cooldowns[type] !== 0) {
                            gameState.cooldowns[type] = 0;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    updateUI();
                }
            }, 500);
        }

        // 🌟 【防撞衫專屬鑰匙】拿每個人的專屬帳號/Token 當保險箱密碼，確保大家的存檔不會混在一起
        function getSaveKey() {
            try {
                const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (currentUser && (currentUser.email || currentUser.name)) {
                    return 'nudi_save_' + (currentUser.email || currentUser.name);
                }
            } catch(e) {}
            return 'nudi_save_' + (GAME_TOKEN ? (GAME_TOKEN.length > 30 ? GAME_TOKEN.slice(-24) : GAME_TOKEN) : 'guest');
        }

        // 🌟 【記憶吐司：儲存進度】
        function saveGame() { 
            try {
                const dataString = JSON.stringify(gameState);
                const encodedData = btoa(encodeURIComponent(dataString)); 
                localStorage.setItem(getSaveKey(), encodedData); // 用專屬鑰匙上鎖！
            } catch(e) {
                console.warn("存檔失敗", e);
            }
        }
// 🌟 【記憶吐司：讀取進度】
        function loadGame() {
            const saved = localStorage.getItem(getSaveKey()); // 用專屬鑰匙開鎖！
            if (saved) { 
                try { 
                    let decodedData = saved;
                    // 如果有加密過，就幫它解碼
                    if (!saved.startsWith('{')) {
                        decodedData = decodeURIComponent(atob(saved));
                    }
                    let parsed = JSON.parse(decodedData);
                    
                    // 為了相容舊版存檔的自動修復程式
                    if(parsed.currentEnv) {
                        parsed.currentBg = 'sky'; parsed.currentEffect = 'none';
                        parsed.unlockedBgs = ['sky']; parsed.unlockedEffects = ['none'];
                        delete parsed.currentEnv; delete parsed.unlockedItems;
                    }
                    gameState = { ...gameState, ...parsed }; 
                } catch(e) {
                    console.error("存檔讀取失敗或已損毀", e);
                } 
            }

            // 🌟 防刷分與時間戳記校正：讀取存檔後依據真實時間計算剩餘秒數
            if (!gameState.cooldownUntil) {
                gameState.cooldownUntil = { feed: 0, clean: 0, pet: 0 };
            }
            if (!gameState.cooldowns) {
                gameState.cooldowns = { feed: 0, clean: 0, pet: 0 };
            }

            const now = Date.now();
            ['feed', 'clean', 'pet'].forEach(type => {
                const targetTime = gameState.cooldownUntil[type] || 0;
                const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
                gameState.cooldowns[type] = remaining;
            });
        }
        
        function updateUI() {
            const pointEl = document.getElementById('pointDisplay');
            if (pointEl) {
                pointEl.innerText = Number(gameState.points || 0).toLocaleString();
            }

            const t = i18n[currLang];
            const btnFeed = document.getElementById('btnFeed');
            const btnClean = document.getElementById('btnClean');
            const btnPet = document.getElementById('btnPet');

            if (btnFeed) {
                const desc = document.getElementById('txtFeedDesc');
                if (desc) desc.innerText = gameState.cooldowns.feed > 0 ? `${t.cooldown} ${gameState.cooldowns.feed}s` : t.ready;
            }
            if (btnClean) {
                const desc = document.getElementById('txtCleanDesc');
                if (desc) desc.innerText = gameState.cooldowns.clean > 0 ? `${t.cooldown} ${gameState.cooldowns.clean}s` : t.ready;
            }
            if (btnPet) {
                const desc = document.getElementById('txtPetDesc');
                if (desc) desc.innerText = gameState.cooldowns.pet > 0 ? `${t.cooldown} ${gameState.cooldowns.pet}s` : t.ready;
            }
        }

        // 🌟 【物理互動引擎】負責計算你怎麼抓海兔、怎麼摸牠，以及噴出愛心
        function initDragAndPetSystem() {
            const slugEl = document.getElementById('slugContainer');
            const stageEl = document.getElementById('mainStage');
            const petHand = document.getElementById('petInteractiveHand');
            
            let isDragging = false; let moved = false; let startX = 0, startY = 0; let slugStartLeft = 0, slugStartTop = 0; let petTimer = null;
            let isHovering = false;

            slugEl.oncontextmenu = (e) => { e.preventDefault(); return false; };
            slugEl.ondragstart = (e) => { e.preventDefault(); return false; };

            function getPos(e) {
                if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
                return { x: e.clientX, y: e.clientY };
            }

            function updateHandPos(x, y) {
                if (!petHand || isNaN(x) || isNaN(y)) return;
                petHand.style.left = x + 'px';
                petHand.style.top = y + 'px';
            }

            function showPetHand(x, y, mode = 'petting') {
                if (!petHand) return;
                updateHandPos(x, y);
                petHand.classList.add('is-visible');
                if (mode === 'grabbing') {
                    petHand.classList.remove('is-petting');
                    petHand.classList.add('is-grabbing');
                } else {
                    petHand.classList.remove('is-grabbing');
                    petHand.classList.add('is-petting');
                }
            }

            function hidePetHand() {
                if (!petHand) return;
                petHand.classList.remove('is-visible', 'is-grabbing', 'is-petting');
            }

            function onStart(e) {
                if (e.type === 'mousedown' && e.button !== 0) return;
                isDragging = true; moved = false; document.body.classList.add('is-dragging-global');
                const pos = getPos(e); startX = pos.x; startY = pos.y;
                const style = window.getComputedStyle(slugEl);
                slugStartLeft = parseFloat(style.left) || (stageEl.clientWidth / 2 - 170);
                slugStartTop = parseFloat(style.top) || (stageEl.clientHeight / 2 - 120);
                slugEl.classList.add('is-petting');
                
                // 🌟 抓小海兔的抓取動作！手掌瞬間合攏抓握
                showPetHand(pos.x, pos.y, 'grabbing');
                spawnMiniHeart(pos.x, pos.y);
            }

            function onMove(e) {
                if (!isDragging) return; 
                if (e.cancelable) e.preventDefault(); 
                const pos = getPos(e); const dx = pos.x - startX; const dy = pos.y - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
                if (moved && Math.random() < 0.08) spawnMiniHeart(pos.x, pos.y); // 拖著跑會狂冒愛心

                // 🌟 抓著海兔時，抓握小手緊緊跟隨游標/手指
                updateHandPos(pos.x, pos.y);

                let newLeft = slugStartLeft + dx; let newTop = slugStartTop + dy;

                // 避免被丟出畫面外，也不讓牠被拖到商店面板／互動按鈕底下
                const bounds = getSlugSafeBounds();
                if (bounds) {
                    newLeft = Math.max(bounds.minX, Math.min(newLeft, bounds.maxX));
                    newTop = Math.max(bounds.minY, Math.min(newTop, bounds.maxY));
                }

                slugEl.style.left = newLeft + 'px'; slugEl.style.top = newTop + 'px';
                updateFloatingButtonPosition(); // 讓挑釁按鈕乖乖跟著海兔一起跑
                
                // 拖曳時，隨機挑選時機同步你的座標給大家看 (避免伺服器大塞車)
                if (Math.random() < 0.2) broadcastMove(newLeft, newTop);
            }

            function onEnd(e) {
                if (!isDragging) return;
                isDragging = false; 
                document.body.classList.remove('is-dragging-global');
                const pos = getPos(e);
                const endX = pos.x || startX;
                const endY = pos.y || startY;

                if (moved) {
                    slugEl.classList.remove('is-petting');
                    // 拖曳放開後：抓取動作鬆開為撫摸手勢，稍後淡出
                    showPetHand(endX, endY, 'petting');
                    clearTimeout(petTimer);
                    petTimer = setTimeout(() => {
                        if (!isHovering) hidePetHand();
                    }, 350);
                } else {
                    // 點擊撫摸：保持瞇瞇眼與撫摸手掌 500ms，讓玩家看得清楚可愛互動
                    slugEl.classList.add('is-petting');
                    showPetHand(endX, endY, 'petting');
                    clearTimeout(petTimer);
                    petTimer = setTimeout(() => {
                        slugEl.classList.remove('is-petting');
                        if (!isHovering) hidePetHand();
                    }, 500);
                }
                // 點擊海兔僅觸發撫摸動畫，不增加積分（修復進遊戲點擊海兔刷分漏洞）
                broadcastMove(parseFloat(slugEl.style.left) || 0, parseFloat(slugEl.style.top) || 0);
            }

            function onHover(e) {
                if (!isDragging && e.type === 'mousemove') {
                    isHovering = true;
                    slugEl.classList.add('is-petting');
                    showPetHand(e.clientX, e.clientY, 'petting');
                    if (Math.random() < 0.05) spawnMiniHeart(e.clientX, e.clientY);
                }
            }

            slugEl.addEventListener('mouseenter', (e) => {
                if (!isDragging) {
                    isHovering = true;
                    showPetHand(e.clientX, e.clientY, 'petting');
                    slugEl.classList.add('is-petting');
                }
            });

            slugEl.addEventListener('mouseleave', () => {
                isHovering = false;
                if (!isDragging) {
                    hidePetHand();
                    slugEl.classList.remove('is-petting');
                }
            });

            slugEl.addEventListener('mousedown', onStart, { passive: false }); 
            slugEl.addEventListener('touchstart', onStart, { passive: false }); 
            slugEl.addEventListener('mousemove', onHover);
            document.addEventListener('mousemove', onMove, { passive: false }); 
            document.addEventListener('touchmove', onMove, { passive: false }); 
            document.addEventListener('mouseup', onEnd); 
            document.addEventListener('touchend', onEnd); 
            document.addEventListener('touchcancel', onEnd);
            
            // 愛心特效產生器
            function spawnMiniHeart(x, y) {
                const el = document.createElement('div'); el.innerHTML = svgLib.heart; el.style.width = '30px'; el.style.height = '30px'; el.style.position = 'fixed'; el.style.left = (x - 15 + Math.random() * 20) + 'px'; el.style.top = (y - 30) + 'px'; el.style.pointerEvents = 'none'; el.style.animation = 'floatUp 1s ease-out forwards'; el.style.zIndex = '1000'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
            }
        }

        // 🌟 【專屬彩蛋：挑釁按鈕顯示控制】只有裝備『回城特效』才看得到
        function updateRecallButtonVisibility() {
            const btn = document.getElementById('floatingRecallBtn');
            const activeEffect = trialState.effect || gameState.currentEffect;
            if (activeEffect === 'disco') {
                btn.style.display = 'block'; updateFloatingButtonPosition();
            } else {
                btn.style.display = 'none';
            }
        }

        // 計算挑釁按鈕要黏在海兔旁邊的哪裡
        function updateFloatingButtonPosition() {
            const btn = document.getElementById('floatingRecallBtn'); const slugEl = document.getElementById('slugContainer');
            if (!btn || !slugEl || btn.style.display === 'none') return;
            const left = parseFloat(slugEl.style.left) || (window.innerWidth / 2 - 170);
            const top = parseFloat(slugEl.style.top) || (window.innerHeight * 0.29 - 120);
            const width = slugEl.offsetWidth || 340;
            const height = slugEl.offsetHeight || 240;
            // 海兔會依螢幕縮放（縮放以中心為軸），按鈕要貼著「看得到的」右上角
            const scale = parseFloat(getComputedStyle(slugEl).getPropertyValue('--slug-scale')) || 1;
            const visRight = left + width / 2 + (width * scale) / 2;
            const visTop = top + height / 2 - (height * scale) / 2;
            btn.style.left = (visRight - 40 * scale) + 'px';
            btn.style.top = (visTop + 20 * scale) + 'px';
        }

        // 🌟 點擊挑釁按鈕觸發：海兔側翻 + 連續叮叮聲
        function triggerRecallTaunt() {
            const svgEl = document.querySelector('.slug-svg');
            if (svgEl.classList.contains('is-spinning-taunt')) return; // 防止狂按卡住
            svgEl.classList.add('is-spinning-taunt');
            setTimeout(() => { svgEl.classList.remove('is-spinning-taunt'); }, 600);
            playDingSound(3);
        }
// 🌟 【超輕柔小鴨踏水啪嗒聲】微音量柔和水波拍打版（安靜療癒不吵鬧！）
        function playDuckStepSound(scale = 1.0) {
            try {
                if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (sharedAudioCtx.state === 'suspended') {
                    sharedAudioCtx.resume();
                }

                const ctx = sharedAudioCtx;
                const now = ctx.currentTime;
                const duration = 0.045; // 縮短發聲時間，更乾淨輕巧

                // 1. 踩水波的「啪嗒」短促水音
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'triangle';
                const startFreq = (420 + Math.random() * 40) / scale;
                osc.frequency.setValueAtTime(startFreq, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + duration);

                // 柔和低通濾波器（降低尖銳高頻，讓聲音更溫潤）
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1100, now);

                // 🌟 音量下調：高峰值降至 0.025（極度溫和的環境音量）
                gain.gain.setValueAtTime(0.0005, now);
                gain.gain.linearRampToValueAtTime(0.025, now + 0.006);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + duration);
            } catch(e) {}
        }
        // 🌟 【全域共用的超強音效處理器】防當機、防卡音
        let sharedAudioCtx = null;

        function playDingSound(times) {
            let count = 0;
            try {
                if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') { sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
                if (sharedAudioCtx.state === 'suspended') { sharedAudioCtx.resume(); }
            } catch(e) { return; }

            const interval = setInterval(() => {
                if (count >= times) { clearInterval(interval); return; }
                try {
                    const osc = sharedAudioCtx.createOscillator(); const gain = sharedAudioCtx.createGain();
                    osc.type = 'sine'; osc.frequency.setValueAtTime(1200 + count * 300, sharedAudioCtx.currentTime);
                    gain.gain.setValueAtTime(0.15, sharedAudioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + 0.3);
                    osc.connect(gain); gain.connect(sharedAudioCtx.destination);
                    osc.start(); osc.stop(sharedAudioCtx.currentTime + 0.3);
                } catch(e) {}
                count++;
            }, 150); 
        }
        // 🌟 【真實喵喵叫】播放真正的貓咪音效，還會隨機變聲！
        const catMeowSources = [
            'https://assets.mixkit.co/active_storage/sfx/93/93-preview.mp3', // 甜美小貓叫聲 (Sweet kitty meow)
            'https://assets.mixkit.co/active_storage/sfx/91/91-preview.mp3', // 卡通小貓叫聲 (Cartoon little cat meow)
            'https://assets.mixkit.co/active_storage/sfx/86/86-preview.mp3'  // 撒嬌貓咪叫聲 (Little cat attention meow)
        ];

        // 確保音效播放器存在且音源正確為貓叫聲
        let primaryMeow = document.getElementById('meowAudio');
        if (!primaryMeow) {
            primaryMeow = document.createElement('audio');
            primaryMeow.id = 'meowAudio';
            primaryMeow.preload = 'auto';
            document.body.appendChild(primaryMeow);
        }
        if (!primaryMeow.src || primaryMeow.src.includes('2874')) {
            primaryMeow.src = catMeowSources[0];
        }

        let isMeowUnlocked = false;

        // 🌟 破冰魔法：只要在畫面任何地方點擊或觸控一下，就立刻發放聲音通行證！
        function unlockMeowAudio() {
            isMeowUnlocked = true;
            ['meowAudio', 'meowAudio2', 'meowAudio3'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.volume = 0.5;
            });
        }
        window.addEventListener('click', unlockMeowAudio, { passive: true });
        window.addEventListener('touchstart', unlockMeowAudio, { passive: true });

        // 🌟 【真實喵喵叫】背景穩定播放，隨機從真實貓咪叫聲中選取並微調音調！
        function playMeowSound() {
            const meowIds = ['meowAudio', 'meowAudio2', 'meowAudio3'];
            const chosenId = meowIds[Math.floor(Math.random() * meowIds.length)];
            const audioEl = document.getElementById(chosenId) || document.getElementById('meowAudio');
            
            if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.volume = 0.5;
                // 隨機變聲魔法：讓叫聲有高有低，像好幾隻不同的貓貓！
                audioEl.playbackRate = 0.88 + Math.random() * 0.25;
                audioEl.play().catch(e => {
                    console.log("主子還在睡（等待使用者互動）");
                });
            }
        }
// 🌟 【自定義彈幕設定彈窗邏輯（已加入計時暫停與恢復）】
    function openCustomTauntModal() {
        // 🌟 1. 當彈窗打開時，如果正在試用，立刻暫停倒數計時！
        if (trialInterval) {
            clearInterval(trialInterval);
            trialInterval = null;
        }
        const timerDisplay = document.getElementById('trialTimerDisplay');
        if (timerDisplay && trialState.effect === 'disco') {
            timerDisplay.innerHTML = `⏱️ 試用已暫停（輸入中...）`;
        }

        let currentTaunts = safeJsonParse(localStorage.getItem('nudi_custom_taunts'), ["MISS! 打不到我~", "就這點傷害？我已經逃囉！", "哈哈，你抓不到我！"]);
        
        let oldModal = document.getElementById('customTauntModal');
        if (oldModal) oldModal.remove();

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'customTauntModal';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px);
            z-index: 999999; display: flex; align-items: center; justify-content: center;
            pointer-events: auto !important;
        `;

        modalOverlay.innerHTML = `
            <div style="background: #fff; width: 90%; max-width: 380px; border-radius: 30px; border: 4px solid #38bdf8; padding: 25px; text-align: center; box-shadow: 0 20px 40px rgba(56, 189, 248, 0.4);">
                <h3 style="margin-top:0; color: #0284c7; font-weight: 900;">✨ 自定義嘲諷彈幕設定</h3>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 15px;">輸入你想在背景飄動的嘲諷字句！<br>（最多 4 句，每句限 15 字內）</p>
                <div id="tauntInputsContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;"></div>
                <div style="display: flex; gap: 10px;">
                    <button id="closeTauntModalBtn" style="flex: 1; padding: 12px; border: none; border-radius: 18px; background: #f1f5f9; color: #64748b; font-weight: 900; cursor: pointer;">取消</button>
                    <button id="saveTauntModalBtn" style="flex: 1; padding: 12px; border: none; border-radius: 18px; background: #0284c7; color: white; font-weight: 900; cursor: pointer;">儲存套用</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        const container = document.getElementById('tauntInputsContainer');
        let firstInput = null;
        
        for (let i = 0; i < 4; i++) {
            let input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 15;
            input.value = currentTaunts[i] || '';
            input.placeholder = `嘲諷句子 ${i + 1} (最多15字)...`;
            input.style.cssText = `
                width: 100%; padding: 10px 12px; border: 2px solid #cbd5e1; border-radius: 15px;
                font-weight: 900; color: #1e293b; outline: none; background: #f8fafc; font-size: 0.95rem;
                pointer-events: auto !important; z-index: 1000000;
            `;
            input.onclick = (e) => e.stopPropagation();
            input.onkeydown = (e) => e.stopPropagation();
            container.appendChild(input);
            if (i === 0) firstInput = input;
        }

        if (firstInput) {
            setTimeout(() => { firstInput.focus(); }, 100);
        }

        // 恢復計時器的共用小幫手
        function closeAndResumeTimer() {
            modalOverlay.remove();
            if (trialState.effect === 'disco' && trialTimeLeft > 0) {
                // 恢復顯示原本的倒數 HTML 結構
                const timerDisplay = document.getElementById('trialTimerDisplay');
                if (timerDisplay) {
                    timerDisplay.innerHTML = `⏱️ 試用中 <span id="trialCountdownNum" style="color: var(--accent-color); font-size: 1.4rem;">${trialTimeLeft}</span>s`;
                    timerDisplay.style.display = 'block';
                }
                startTrialCountdown(); // 繼續倒數
            }
        }

        document.getElementById('closeTauntModalBtn').onclick = (e) => {
            e.stopPropagation();
            closeAndResumeTimer();
        };

        document.getElementById('saveTauntModalBtn').onclick = (e) => {
            e.stopPropagation();
            const inputs = container.querySelectorAll('input');
            let newTaunts = [];
            inputs.forEach(input => {
                let val = input.value.trim();
                if (val.length > 0) newTaunts.push(val);
            });

            if (newTaunts.length === 0) {
                alert('至少要輸入一句嘲諷字句哦！');
                return;
            }

            localStorage.setItem('nudi_custom_taunts', JSON.stringify(newTaunts));
            closeAndResumeTimer();
            showFloatText('✨ 彈幕設定成功！');
            refreshAll();
        };
    }
    // 🌟 ==========================================
// 🌟 每日任務系統大腦
// 🌟 ==========================================

const DAILY_TARGETS = { pet: 3, feed: 2, clean: 1 };
const DAILY_REWARD = 500; 

// 檢查每天登入，並計算連續簽到天數
// 檢查每天登入狀態
function checkDaily() {
    const today = new Date().toLocaleDateString();
    
    if (!gameState.daily) {
        gameState.daily = {
            lastCheckInDate: '', streakDays: 0, todayClaimed: false,
            progress: { pet: 0, feed: 0, clean: 0 }, claimed: { pet: false, feed: false, clean: false }
        };
    }

    if (gameState.daily.lastCheckInDate !== today) {
        if (gameState.daily.streakDays >= 14) {
            gameState.daily.streakDays = 0; // 滿 14 天自動回到第 1 天！
        }
        gameState.daily.lastCheckInDate = today;
        gameState.daily.todayClaimed = false; 
        gameState.daily.progress = { pet: 0, feed: 0, clean: 0 };
        gameState.daily.claimed = { pet: false, feed: false, clean: false };
        saveGame();
    }

    // 如果今天還沒簽到過，打開遊戲時自動彈出日曆提醒玩家！
    if (!gameState.daily.todayClaimed) {
        // 🌟 新增：幫按鈕貼上標籤，啟動呼吸跟紅點
        document.getElementById('btnDailyGift').classList.add('needs-attention');
        
        setTimeout(() => { openCheckInModal(); }, 500); 
    }
}

// 打開日曆並把 14 天的格子畫出來
function openCheckInModal() {
    const grid = document.getElementById('checkInGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const t = i18n[currLang] || i18n.zh;
    let streak = (gameState.daily && gameState.daily.streakDays) || 0;
    let todayClaimed = (gameState.daily && gameState.daily.todayClaimed) || false;

    // 繪製 14 個格子
    for (let i = 1; i <= 14; i++) {
        let isClaimed = i <= streak;
        let isToday = (i === streak + 1) && !todayClaimed;
        let reward = (i === 7 || i === 14) ? 200 : 100;
        let icon = (i === 7 || i === 14) ? '💎' : '💰';
        
        let classes = 'checkin-day';
        if (isClaimed) classes += ' claimed'; // 已簽到的格子會發光變黃
        if (isToday) classes += ' today';     // 今天的格子會跳動

        let dayText = `${t.dayPrefix || 'Day '}${i}${t.daySuffix || ''}`;
        let innerHtml = `
            <div style="font-size:0.75rem;">${dayText}</div>
            <div style="font-size:1.4rem; margin:4px 0;">${icon}</div>
            <div style="font-size:0.9rem;">${reward}</div>
        `;
        grid.innerHTML += `<div class="${classes}">${innerHtml}</div>`;
    }
    
    const btn = document.getElementById('btnClaimCheckIn');
    if (btn) {
        if (todayClaimed) {
            btn.disabled = true;
            btn.innerText = t.checkInClaimed || '今天已簽到 (明天再來)';
            btn.style.background = '#cbd5e1';
            btn.style.boxShadow = '0 5px 0 #94a3b8';
            btn.style.cursor = 'not-allowed';
            btn.style.transform = 'none';
        } else {
            btn.disabled = false;
            btn.innerText = t.checkInBtn || '馬上簽到！';
            btn.style.background = '#eab308';
            btn.style.boxShadow = '0 5px 0 #ca8a04';
            btn.style.cursor = 'pointer';
        }
    }

    const headerEl = document.getElementById('modalCheckInHeader');
    const subEl = document.getElementById('modalCheckInSub');
    const closeEl = document.getElementById('btnCloseCheckInModal');
    if (headerEl) headerEl.innerText = t.modalCheckInHeader || '🎁 14天簽到獎勵';
    if (subEl) subEl.innerText = t.modalCheckInSub || '連續簽到拿大獎，第7與14天翻倍！';
    if (closeEl) closeEl.innerText = t.closeCalendarBtn || '關閉日曆';
    
    document.getElementById('checkInModalOverlay').style.display = 'flex';
}

// 按下簽到按鈕發錢
function claimCheckIn() {
    if (gameState.daily.todayClaimed) return; 
    
    gameState.daily.streakDays++; 
    let currentDay = gameState.daily.streakDays;
    let reward = (currentDay === 7 || currentDay === 14) ? 200 : 100;
    
    gameState.points += reward; 
    gameState.daily.todayClaimed = true; 
    
    saveGame();
    updateUI();
    
    // 🌟 新增：領完錢了，把小紅點跟呼吸燈關掉
    const btnGift = document.getElementById('btnDailyGift');
    if (btnGift) btnGift.classList.remove('needs-attention');

    // 重新繪製網格（讓剛簽到的那一格瞬間打上勾勾 ✔️）
    openCheckInModal();
    const t = i18n[currLang] || i18n.zh;
    showFloatText(`${t.checkInSuccessToast || '✨ 簽到成功 +'}${reward} ✨`);
}
// 記錄任務做了幾次
function addDailyProgress(type) {
    if (!gameState.daily) return;
    if (gameState.daily.progress[type] !== undefined) {
        gameState.daily.progress[type]++;
        saveGame();
    }
}

// 🌟 【每日任務進度資料庫】
        function getDailyTaskData() {
            const todayStr = new Date().toDateString();
            if (!gameState.dailyTaskProgress || gameState.dailyTaskProgress.date !== todayStr) {
                gameState.dailyTaskProgress = {
                    date: todayStr,
                    tasks: {
                        pet: { count: 0, target: 1, reward: 60, claimed: false },
                        feed: { count: 0, target: 1, reward: 80, claimed: false },
                        clean: { count: 0, target: 1, reward: 100, claimed: false }
                    }
                };
                saveGame();
            }
            return gameState.dailyTaskProgress.tasks;
        }

        // 🌟 動作觸發時累加任務進度 + 達成提示
function updateTaskProgress(actionType) {
            const tasks = getDailyTaskData();
            const task = tasks[actionType];
            if (task && task.count < task.target) {
                task.count++;
                saveGame();
                if (task.count >= task.target) {
                    const t = i18n[currLang];
                    showFloatText(t.taskCompletedToast || '🎉 達成每日任務！快去領取獎勵～', 3000);
                }
            }
        }

        // 🌟 打開任務面板（含進度條、狀態判定、領取獎勵按鈕與雙語切換）
        function openDailyModal() {
            const modal = document.getElementById('dailyModalOverlay');
            const list = document.getElementById('dailyTaskList');
            if (!modal || !list) return;

            list.innerHTML = ''; 
            const t = i18n[currLang];

            // 更新標題與關閉按鈕雙語
            const headerEl = document.getElementById('modalDailyHeader');
            const subEl = document.getElementById('modalDailySub');
            const closeEl = document.getElementById('btnCloseDailyModal');
            if (headerEl) headerEl.innerText = t.modalDailyHeader;
            if (subEl) subEl.innerText = t.modalDailySub;
            if (closeEl) closeEl.innerText = t.closeBtn;

            const tasks = getDailyTaskData();
            const taskKeys = [
                { key: 'pet', icon: '🏀' },
                { key: 'feed', icon: '🌿' },
                { key: 'clean', icon: '✨' }
            ];

            taskKeys.forEach(({ key, icon }) => {
                const task = tasks[key];
                const info = t.taskNames[key];
                const isDone = task.count >= task.target;
                const isClaimed = task.claimed;

                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: ${isClaimed ? '#f8fafc' : (isDone ? '#f0fdf4' : '#fff9fa')};
                    border: 2px solid ${isClaimed ? '#cbd5e1' : (isDone ? '#86efac' : '#ffd1dc')};
                    border-radius: 18px;
                    padding: 10px 14px;
                    gap: 8px;
                    transition: 0.2s;
                `;

                let btnBg = '#f1f5f9';
                let btnColor = '#94a3b8';
                let btnText = `${t.taskStatus.uncompleted} (${task.count}/${task.target})`;
                let btnCursor = 'default';
                let btnAction = '';

                if (isClaimed) {
                    btnBg = '#e2e8f0';
                    btnColor = '#94a3b8';
                    btnText = t.taskStatus.claimed;
                } else if (isDone) {
                    btnBg = 'linear-gradient(135deg, #4ade80, #22c55e)';
                    btnColor = '#ffffff';
                    btnText = `${t.taskStatus.claim}${task.reward}`;
                    btnCursor = 'pointer';
                    btnAction = `onclick="claimDailyTaskReward('${key}')"`;
                }

                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <span style="font-size: 1.5rem;">${icon}</span>
                        <div>
                            <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-dark);">${info.title}</div>
                            <div style="font-size: 0.78rem; color: var(--text-dim); font-weight: 800;">${info.desc}</div>
                        </div>
                    </div>
                    <button ${btnAction} style="background: ${btnBg}; color: ${btnColor}; border: none; padding: 7px 12px; border-radius: 14px; font-weight: 900; font-size: 0.85rem; cursor: ${btnCursor}; white-space: nowrap; box-shadow: ${isDone && !isClaimed ? '0 4px 10px rgba(34, 197, 94, 0.35)' : 'none'};">
                        ${btnText}
                    </button>
                `;
                list.appendChild(item);
            });

            modal.style.display = 'flex';
        }

        // 🌟 領取任務獎勵
        function claimDailyTaskReward(taskKey) {
            const tasks = getDailyTaskData();
            const task = tasks[taskKey];
            if (task && task.count >= task.target && !task.claimed) {
                task.claimed = true;
                gameState.points += task.reward;
                saveGame();
                updateUI();

                const t = i18n[currLang];
                showFloatText(`${t.taskClaimedToast}${task.reward} Pts！`, 2500);
                openDailyModal(); // 立即刷新介面為「已領取」
            }
        }
// 🌟 播放禮物盒開蓋動畫，再進入日曆
function playGiftAnimation(btnElement) {
    const svg = btnElement.querySelector('.gift-svg');
    if (!svg) return openCheckInModal(); // 萬一找不到圖案，當作沒事直接開
    
    // 防呆：如果正在開，就不要重複點擊
    if (svg.classList.contains('is-opening')) return;

    // 啟動開蓋動畫！
    svg.classList.add('is-opening');
    
    // 延遲 400 毫秒，等蓋子「啵！」地飛走後，再打開 14 天簽到面板
    setTimeout(() => {
        openCheckInModal();
        
        // 面板打開後，偷偷把蓋子「變回來蓋好」，為玩家明天點擊做準備
        setTimeout(() => {
            svg.classList.remove('is-opening');
        }, 300);
    }, 400); 
}
let currentPaintPalette = 0;

        const paintPalettes = [
            ['#ff3b30', '#ff9500', '#ffcc00', '#ff2d55'], // 色系 1
            ['#007aff', '#00c7be', '#38bdf8', '#818cf8'], // 色系 2
            ['#ec4899', '#c084fc', '#f472b6', '#fbcfe8']  // 色系 3
        ];

        function setPaintPalette(index) {
            currentPaintPalette = index;
            const btns = document.querySelectorAll('.palette-btn');
            btns.forEach((btn, idx) => {
                btn.className = idx === index ? 'palette-btn active' : 'palette-btn';
            });
            showFloatText(`✨ 已切換色系`);
        }
        // 🌟 開關底部商城與互動面板的魔法
        function toggleShopPanel() {
            const panel = document.getElementById('uiPanel');
            const openBtn = document.getElementById('btnOpenShop');
            
            if (panel.classList.contains('open')) {
                // 如果是打開的，就收起來，並秀出召喚按鈕
                panel.classList.remove('open');
                openBtn.style.transform = 'translateX(-50%) scale(1)';
            } else {
                // 如果是收起的，就展開它，並把召喚按鈕藏起來
                panel.classList.add('open');
                openBtn.style.transform = 'translateX(-50%) scale(0)';
            }
        }
// 🌸 【日式浪漫櫻花八音盒】(防重疊 Session 驗證版)
        function startSakuraBGM() {
            // 1. 產生本次播放的唯一工作證編號
            const currentSession = Math.random();
            window.sakuraSessionId = currentSession;
            window.sakuraMusicActive = true;
            window.sakuraNoteTimers = [];

            const harpScale = [
                261.63, 293.66, 329.63, 392.00, 440.00, 
                523.25, 587.33, 659.25, 783.99, 880.00, 1046.50
            ];

            const romanticMelody = [
                { note: 0, delay: 0 },
                { note: 2, delay: 650 },
                { note: 3, delay: 1300 },
                { note: 5, delay: 2100 },
                { note: 7, delay: 3400 },
                { note: 6, delay: 4500 },
                { note: 5, delay: 5600 },
                { note: 4, delay: 7000 },
                { note: 1, delay: 8800 },
                { note: 3, delay: 9450 },
                { note: 5, delay: 10100 },
                { note: 6, delay: 11000 },
                { note: 8, delay: 12400 },
                { note: 7, delay: 13500 },
                { note: 5, delay: 14800 },
                { note: 10, delay: 16500 }
            ];

            function playMusicBoxNote(freq, volume = 0.032) {
                // 只有持有最新工作證且特效仍為 sakura 才發聲
                if (window.sakuraSessionId !== currentSession || !window.sakuraMusicActive) return;
                try {
                    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (sharedAudioCtx.state === 'suspended') {
                        sharedAudioCtx.resume();
                    }

                    const ctx = sharedAudioCtx;
                    const now = ctx.currentTime;

                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const shimmerOsc = ctx.createOscillator();
                    const shimmerGain = ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);
                    shimmerOsc.type = 'triangle';
                    shimmerOsc.frequency.setValueAtTime(freq * 2, now);

                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

                    shimmerGain.gain.setValueAtTime(0.0001, now);
                    shimmerGain.gain.linearRampToValueAtTime(volume * 0.22, now + 0.02);
                    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    shimmerOsc.connect(shimmerGain);
                    shimmerGain.connect(ctx.destination);

                    osc.start(now);
                    shimmerOsc.start(now);
                    osc.stop(now + 3.0);
                    shimmerOsc.stop(now + 1.8);
                } catch(e) {}
            }

            function playRomanticLoop() {
                if (window.sakuraSessionId !== currentSession || !window.sakuraMusicActive) return;

                const activeEffect = trialState.effect || gameState.currentEffect;
                if (activeEffect !== 'sakura') {
                    window.sakuraMusicActive = false;
                    return;
                }

                // 將每個音符計時器存入陣列中管控
                romanticMelody.forEach(item => {
                    const t = setTimeout(() => {
                        if (window.sakuraSessionId === currentSession && window.sakuraMusicActive) {
                            const freq = harpScale[item.note];
                            playMusicBoxNote(freq, 0.035);
                        }
                    }, item.delay);
                    window.sakuraNoteTimers.push(t);
                });

                window.sakuraMusicTimer = setTimeout(playRomanticLoop, 19000);
            }

            playRomanticLoop();
        }
        // 🎵 【活潑動感 Pop 音符音樂引擎】(生動明亮、輕快律動、無版權、自動循環)
        function startMusicBGM() {
            window.musicNoteActive = true;

            // 明亮活潑的 C 大調高八度音階頻率
            const noteFreqs = {
                'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
                'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
                'C6': 1046.50
            };

            // 輕快俏皮的彈跳旋律序列
            const bounceMelody = [
                { note: 'C5', time: 0 },
                { note: 'E5', time: 160 },
                { note: 'G5', time: 320 },
                { note: 'C6', time: 480 },
                { note: 'G5', time: 700 },
                { note: 'A5', time: 920 },
                { note: 'G5', time: 1140 },
                { note: 'E5', time: 1360 },

                { note: 'D5', time: 1680 },
                { note: 'F5', time: 1840 },
                { note: 'A5', time: 2000 },
                { note: 'B5', time: 2160 },
                { note: 'C6', time: 2400 },
                { note: 'G5', time: 2650 },
                { note: 'E5', time: 2900 },
                { note: 'C5', time: 3150 }
            ];

            function playPopNote(freq, volume = 0.038) {
                if (!window.musicNoteActive) return;
                try {
                    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (sharedAudioCtx.state === 'suspended') {
                        sharedAudioCtx.resume();
                    }

                    const ctx = sharedAudioCtx;
                    const now = ctx.currentTime;

                    // 主音合成器（明亮方波 + 柔和濾波）
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();

                    osc.type = 'square';
                    osc.frequency.setValueAtTime(freq, now);

                    // 低通濾波打造圓潤俏皮的 8-bit Pop 質感
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(2200, now);
                    filter.frequency.exponentialRampToValueAtTime(600, now + 0.22);

                    // 短促彈跳音量包絡
                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now);
                    osc.stop(now + 0.25);
                } catch(e) {}
            }

            function playMusicLoop() {
                if (!window.musicNoteActive) return;
                const activeEffect = trialState.effect || gameState.currentEffect;
                if (activeEffect !== 'music') {
                    window.musicNoteActive = false;
                    return;
                }

                bounceMelody.forEach(item => {
                    setTimeout(() => {
                        if (window.musicNoteActive && (trialState.effect === 'music' || gameState.currentEffect === 'music')) {
                            playPopNote(noteFreqs[item.note], 0.035);
                        }
                    }, item.time);
                });

                // 每 4 秒循環一次活潑小樂段
                window.musicNoteTimer = setTimeout(playMusicLoop, 4000);
            }

            playMusicLoop();
        }
        // 🎵 【音符打擊即時音效】(隨連擊音調遞增)
        function playHitNoteSound(combo = 1) {
            try {
                if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (sharedAudioCtx.state === 'suspended') {
                    sharedAudioCtx.resume();
                }

                const ctx = sharedAudioCtx;
                const now = ctx.currentTime;

                // 隨連擊步進的大調音階頻率
                const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
                const freq = scale[(combo - 1) % scale.length];

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(0.065, now + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.32);
            } catch(e) {}
        }

        // 🎵 【活潑動感 Pop 背景音樂引擎】(Session 驗證防重疊版)
        function startMusicBGM() {
            const currentSession = Math.random();
            window.musicSessionId = currentSession;
            window.musicNoteActive = true;
            window.musicNoteTimers = [];

            const noteFreqs = {
                'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 
                'G5': 783.99, 'A5': 880.00, 'B5': 987.77, 'C6': 1046.50
            };

            const bounceMelody = [
                { note: 'C5', time: 0 },
                { note: 'E5', time: 160 },
                { note: 'G5', time: 320 },
                { note: 'C6', time: 480 },
                { note: 'G5', time: 700 },
                { note: 'A5', time: 920 },
                { note: 'G5', time: 1140 },
                { note: 'E5', time: 1360 },
                { note: 'D5', time: 1680 },
                { note: 'F5', time: 1840 },
                { note: 'A5', time: 2000 },
                { note: 'B5', time: 2160 },
                { note: 'C6', time: 2400 },
                { note: 'G5', time: 2650 },
                { note: 'E5', time: 2900 },
                { note: 'C5', time: 3150 }
            ];

            function playPopNote(freq, volume = 0.028) {
                if (window.musicSessionId !== currentSession || !window.musicNoteActive) return;
                try {
                    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    if (sharedAudioCtx.state === 'suspended') {
                        sharedAudioCtx.resume();
                    }

                    const ctx = sharedAudioCtx;
                    const now = ctx.currentTime;

                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();

                    osc.type = 'square';
                    osc.frequency.setValueAtTime(freq, now);

                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(2200, now);
                    filter.frequency.exponentialRampToValueAtTime(600, now + 0.22);

                    gain.gain.setValueAtTime(0.0001, now);
                    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now);
                    osc.stop(now + 0.24);
                } catch(e) {}
            }

            function playMusicLoop() {
                if (window.musicSessionId !== currentSession || !window.musicNoteActive) return;

                const activeEffect = trialState.effect || gameState.currentEffect;
                if (activeEffect !== 'music') {
                    window.musicNoteActive = false;
                    return;
                }

                bounceMelody.forEach(item => {
                    const t = setTimeout(() => {
                        if (window.musicSessionId === currentSession && window.musicNoteActive) {
                            playPopNote(noteFreqs[item.note], 0.028);
                        }
                    }, item.time);
                    window.musicNoteTimers.push(t);
                });

                window.musicNoteTimer = setTimeout(playMusicLoop, 4000);
            }

            playMusicLoop();
        }
        // 🎼 【五線譜專屬清脆單音發聲器】(高音量清亮加強版)
        function playSingleStaffTone(freq, volume = 0.22) {
            try {
                if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
                    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (sharedAudioCtx.state === 'suspended') {
                    sharedAudioCtx.resume();
                }

                const ctx = sharedAudioCtx;
                const now = ctx.currentTime;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                // 額外加入微弱泛音層，讓聲音大聲且更具穿透力
                const shimmerOsc = ctx.createOscillator();
                const shimmerGain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                shimmerOsc.type = 'triangle';
                shimmerOsc.frequency.setValueAtTime(freq * 2, now);

                // 主音量提升
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.linearRampToValueAtTime(volume, now + 0.008);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

                // 泛音層音量提升
                shimmerGain.gain.setValueAtTime(0.0001, now);
                shimmerGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.01);
                shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);
                shimmerOsc.connect(shimmerGain);
                shimmerGain.connect(ctx.destination);

                osc.start(now);
                shimmerOsc.start(now);
                osc.stop(now + 0.58);
                shimmerOsc.stop(now + 0.38);
            } catch(e) {}
        }
        // 🌟 【打開身份證小魔法：呼叫海兔跳進來！】
        function openIdCardModal() {
            document.getElementById('idCardModalOverlay').style.display = 'flex';
            updateNameUI(); // 更新名字與品種
            
            const slug = document.getElementById('slugContainer');
            
            // 🌟 關鍵：把海兔暫時移出魚缸，放到最外層，這樣牠跳起來才不會被魚缸的邊緣切斷頭！
            document.body.appendChild(slug);
            
            // 加上跳躍動畫
            slug.classList.add('is-jumping');
            
            // 稍微等 0.01 秒，確保動畫能完美觸發，然後套用「名片模式」的座標
            requestAnimationFrame(() => {
                slug.classList.add('card-mode');
            });
        }

        // 🎨 【自選純色背景的調色盤】
        const bgColorPresets = [
            '#ffffff', '#fde2e4', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff',
            '#dbeafe', '#bdb2ff', '#ffc6ff', '#f1f5f9', '#c7d2fe', '#fecaca',
            '#a7f3d0', '#fed7aa', '#e9d5ff', '#94a3b8', '#3f3f46', '#0f172a'
        ];

        function openColorModal() {
            const grid = document.getElementById('colorSwatchGrid');
            const overlay = document.getElementById('colorModalOverlay');
            if (!grid || !overlay) return;

            grid.innerHTML = '';
            bgColorPresets.forEach(color => {
                const swatch = document.createElement('button');
                const picked = color.toLowerCase() === (gameState.customBgColor || '').toLowerCase();
                // box-sizing 要設 border-box，否則 3px 外框會把六欄色票撐出容器外
                swatch.style.cssText = `box-sizing:border-box; width:100%; aspect-ratio:1; border-radius:12px; background:${color}; cursor:pointer;`
                    + `border:3px solid ${picked ? 'var(--text-dark)' : 'rgba(0,0,0,0.12)'}; box-shadow:${picked ? '0 0 0 3px var(--accent-color)' : 'none'};`;
                swatch.onclick = () => pickBgColor(color);
                grid.appendChild(swatch);
            });

            const input = document.getElementById('customColorInput');
            if (input) input.value = gameState.customBgColor || '#ffffff';
            overlay.style.display = 'flex';
        }

        function closeColorModal() {
            const overlay = document.getElementById('colorModalOverlay');
            if (overlay) overlay.style.display = 'none';
        }

        // 選色後立刻套用到舞台，並刷新商店的小方塊
        function pickBgColor(color) {
            gameState.customBgColor = color;
            if (gameState.currentBg !== 'none') equipItem('none', 'bg');
            applyBg();
            saveGame();
            renderShop();
            openColorModal();   // 重畫調色盤，讓選中的顏色有外框
        }

        // 🌟 【關閉身份證：海兔跳回舞台！】
        function closeIdCardModal() {
            document.getElementById('idCardModalOverlay').style.display = 'none';
            
            const slug = document.getElementById('slugContainer');
            const stage = document.getElementById('mainStage');
            
            // 解除名片模式，海兔就會自動循著剛剛的 Q 彈動畫飛回原本的位置
            slug.classList.remove('card-mode');
            
            // 🌟 倒數 0.5 秒（等牠飛完落地），再把牠放回魚缸裡，並解除動畫狀態
            setTimeout(() => {
                slug.classList.remove('is-jumping');
                stage.appendChild(slug); // 乖乖回魚缸
            }, 500); 
        }
        // 🌟 打開與關閉手冊的函數
function openManual() {
    document.getElementById('manualOverlay').style.display = 'flex';
}

function closeManual() {
    document.getElementById('manualOverlay').style.display = 'none';
}
