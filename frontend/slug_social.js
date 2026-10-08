// 🛡️ 【連線房間的社交功能＋文字翻譯】
//
// 1. 點別人的海兔 → 玩家小卡：聊天、封鎖、檢舉（後端 petServer.ts 的 game_block_player / game_report_player）
// 2. 封鎖名單：GET /pet-games/blocks、DELETE /pet-games/blocks/:id
// 3. 右上角「兌換碼」按鈕 → 跳出視窗：POST /pet-games/redeem
// 4. trText()：把後端送來的中文訊息、遊戲裡寫死中文的提示，在英文模式下換成英文
//
// 會用到 slug_game.js 的 socket、currLang、currentRoomId、otherPlayersData、speciesData、bgData、effectData、
// gameState、fetchAPI、GAME_TOKEN、showFloatText、openChatBar、saveGame、updateUI、isMockMode。
(function () {
    const $ = (id) => document.getElementById(id);
    const isEn = () => { try { return typeof currLang !== 'undefined' && currLang === 'en'; } catch (e) { return false; } };
    const L = (zh, en) => (isEn() ? en : zh);

    // =====================================================================
    // 🌐 中文訊息 → 英文（後端送來的訊息、舊程式寫死的中文提示）
    // =====================================================================
    const EXACT = {
        // ---- 連線房間（petServer.ts）----
        '找不到該房間！請確認邀請碼是否正確。': 'Room not found! Please check the invite code.',
        '無法加入這個房間。': "Can't join this room.",
        '請先登入帳號才能開房間！': 'Please log in to open a room!',
        '請先登入帳號才能加入房間！': 'Please log in to join a room!',
        '這個帳號已經在其他裝置或分頁的房間裡了，請先在那邊離開房間！': 'This account is already in a room on another device or tab. Leave that room first!',
        '您已經在另一個房間中了，請先退出再加入！': "You're already in another room. Leave it first!",
        '您已經在另一個房間中了，請先退出再開新房間！': "You're already in another room. Leave it first!",
        '發生錯誤': 'Something went wrong',
        '加入失敗，請再試一次': "Couldn't join. Please try again.",
        '原本的房間已經解散了，請重新開房或加入其他房間': 'Your room was closed. Open a new one or join another room.',
        // ---- 封鎖、檢舉（gameSafety.ts）----
        '找不到這位玩家，他可能已經離開房間了。': "Can't find that player — they may have left the room.",
        '封鎖失敗，請稍後再試。': "Couldn't block. Please try again later.",
        '檢舉失敗，請稍後再試。': "Couldn't send the report. Please try again later.",
        '不能封鎖自己喔！': "You can't block yourself!",
        '不能檢舉自己喔！': "You can't report yourself!",
        '請選擇檢舉理由！': 'Please choose a reason!',
        '你已經檢舉過這位玩家了，管理員會盡快處理！': "You've already reported this player — our admins will handle it soon!",
        '檢舉次數太多了，請稍後再試。': 'Too many reports. Please try again later.',
        '找不到這筆封鎖紀錄': 'That block no longer exists.',
        '已解除封鎖': 'Unblocked.',
        '解除封鎖失敗': "Couldn't unblock.",
        '封鎖紀錄編號錯誤': 'Invalid block entry.',
        '尚未登入': 'Not logged in',
        '請先登入': 'Please log in first',
        '伺服器發生錯誤，請稍後再試': 'Server error. Please try again later.',
        '伺服器內部錯誤': 'Server error. Please try again later.',
        '操作太頻繁了，請稍後再試。': 'Too many requests. Please try again later.',
        // ---- 兌換碼（redeemCode.ts）----
        '請輸入兌換碼': 'Please enter a code',
        '兌換碼無效，請確認有沒有打錯': 'Invalid code — please check for typos.',
        '這個兌換碼已經過期了': 'This code has expired.',
        '你已經兌換過這個兌換碼了': "You've already redeemed this code.",
        '這個兌換碼的名額已經用完了': 'This code has been used up.',
        '兌換太頻繁了，請 10 分鐘後再試。': 'Too many tries. Please wait 10 minutes.',
        '兌換失敗，請稍後再試': "Couldn't redeem. Please try again later.",
        // ---- 登入驗證（auth.middleware.ts）：兌換碼這類要登入的 API 會回這些 ----
        '無此授權或格式錯誤': 'Please log in first',
        '此憑證已被封鎖，請重新登入': 'Your login has expired. Please log in again.',
        '憑證無效或過期，請重新登入': 'Your login has expired. Please log in again.',
        '找不到使用者': 'Account not found',
        '帳號已被封鎖，若有疑問請聯繫客服': 'This account has been banned. Contact support if you have questions.',
        '帳號未啟用，請先驗證帳號': 'This account is not activated yet. Please verify it first.',
        // ---- 公告板（announcement）----
        '房號格式不對，是 6 碼英文或數字喔': 'The room code should be 6 letters or numbers.',
        '找不到這個房間，請確認房間還開著': "Can't find that room — is it still open?",
        '揪團彈幕發太頻繁了，請過幾分鐘再試。': "You're posting too often. Please wait a few minutes.",
        '揪團彈幕已發出，會在首頁跑 3 分鐘': 'Invite posted! It shows for 3 minutes.',
        '找不到該名會員': 'Member not found',
        // ---- 翻牌對決（memoryGame.ts）----
        '請先進入房間！': 'Join a room first!',
        '只有房主可以開始翻牌對決喔！': 'Only the host can start the match!',
        '翻牌對決已經在進行中了！': 'A match is already in progress!',
        '正在等大家回覆要不要加入，請稍等！': 'Waiting for everyone to answer the invite!',
        '請選擇正確的組數！': 'Please choose a valid number of pairs!',
        '還沒輪到你喔！': "It's not your turn yet!",
        '房主離開了，這局翻牌對決取消。': 'The host left, so the match was cancelled.',
        // ---- 遊戲裡的提示（slug_game.js）----
        '連線中斷了，正在幫你重新連回房間…': 'Connection lost — reconnecting you to the room…',
        '創立房間成功！': 'Room created!',
        '重新連回房間了！': 'Back in the room!',
        '加入房間成功！': 'Joined the room!',
        '正在連線伺服器，請稍等一下…': 'Connecting to the server…',
        '📋 代碼複製成功！': '📋 Code copied!',
        '進入模擬連線模式！': 'Demo mode on!',
        '伺服器未連線！要先開啟「單機模擬展示」看看連線後的樣子嗎？': "Can't reach the server. Try the offline demo to see what online play looks like?",
        '請先登入帳號才能看見您的海兔喔！': 'Please log in to see your sea bunny!',
        '海兔還在消化中喔！🌱': 'Your sea bunny is still digesting! 🌱',
        '海兔肚子圓滾滾，已經吃很飽啦！🥰': "Your sea bunny's tummy is full! 🥰",
        '水質已經被擦乾淨囉！✨': 'The water is already clean! ✨',
        '水質已經非常清澈，不用擦啦！💎': 'The water is crystal clear — no need to wipe! 💎',
        '🧽 拖曳抹布在魚缸上擦一擦！': '🧽 Drag the cloth across the tank!',
        '✨ 魚缸擦得亮晶晶！ +100': '✨ Sparkling clean tank! +100',
        '還有一點青苔沒擦乾淨喔！再試一次吧～': 'A bit of algae is left — try again!',
        '😋 嚼嚼嚼！美味海藻 +80': '😋 Munch munch! Tasty seaweed +80',
        '海藻掉在路上了～再試一次吧！': 'The seaweed fell — try again!',
        '海兔運動完在喘氣休息中喔！💦': 'Your sea bunny is catching its breath! 💦',
        '海兔肚子咕嚕咕嚕叫，餓得走不動啦...🥺 請先餵食！': 'Your sea bunny is too hungry to play… 🥺 Feed it first!',
        '🏀 把球丟到魚缸裡讓海兔撿！': '🏀 Throw the ball into the tank for your sea bunny!',
        '球掉在魚缸外面囉～再試一次吧！': 'The ball landed outside the tank — try again!',
        '🐶 咬到球球了！跑回碗裡放～': '🐶 Got the ball! Bringing it back to the bowl~',
        '⚽ 運動大成功！球球收進碗裡囉 +60': '⚽ Great workout! Ball back in the bowl +60',
        '海兔還在休息中喔！✨': 'Your sea bunny is still resting! ✨',
        '水質已經非常清澈囉！💎': 'The water is crystal clear! 💎',
        '積分不夠 1000 喔！快去解任務賺錢吧 😢': 'You need 1000 coins! Do some tasks to earn more 😢',
        '名字沒有變喔！': "That's the same name!",
        '積分不夠 1000 喔！😢': 'You need 1000 coins! 😢',
        '✨ 扣除 1000 積分，改名成功 ✨': '✨ Renamed for 1000 coins ✨',
        '✨ 命名成功 ✨': '✨ Named! ✨',
        '⏱️ 試用開始': '⏱️ Trial started',
        '✨ 試用結束，喜歡就帶回家吧！': '✨ Trial over — buy it if you like it!',
        '✨ 購買成功 ✨': '✨ Purchased! ✨',
        '積分不足 😢': 'Not enough coins 😢',
        '✨ 已取消試用': '✨ Trial cancelled',
        '💖 已切換愛心色系': '💖 Heart colors switched',
        '樂譜已經放滿 32 個音囉！🎶': 'The score is full (32 notes)! 🎶',
        '樂譜已經放滿 32 個音囉！按播放欣賞吧 🎶': 'The score is full (32 notes)! Press play 🎶',
        '還沒有音符喔！點擊音符或在商店購買 ✨': 'No notes yet! Tap notes or buy them in the shop ✨',
        '🧹 五線譜已清空': '🧹 Score cleared',
        '✨ 彈幕設定成功！': '✨ Danmaku set!',
        '✨ 已切換色系': '✨ Colors switched',
        '至少要輸入一句嘲諷字句哦！': 'Type at least one taunt!',
        '🔁 循環: 開': '🔁 Loop: on',
        '🔁 循環: 關': '🔁 Loop: off',
        '🎶 停止': '🎶 Stop',
        '▶️ 播放': '▶️ Play',
        '正在建立房間...': 'Creating room...',
        '正在進入房間...': 'Joining room...',
        '給海兔寶寶取名': 'Name your sea bunny',
        '修改名字 (扣 1000 積分)': 'Rename (costs 1000 coins)'
    };

    // 有變數的句子：用正規表示式比對，再組出英文
    const PATTERNS = [
        // 連線房間
        [/^房間已滿！\(此房間上限為 (\d+) 人\)$/, (n) => `The room is full! (max ${n} players)`],
        [/^你中途離開翻牌對決，還要 (\d+) 分鐘才能進連線房間喔！$/, (m) => `You left a Memory Match early — you can join rooms again in ${m} min.`],
        [/^你今天第 (\d+) 次中途離開翻牌對決，扣 (\d+) 積分，(\d+) 分鐘內不能進連線房間。$/,
            (n, c, m) => `Early exit #${n} from Memory Match today: -${c} coins, and no online rooms for ${m} min.`],
        [/^(.+) 蹦蹦跳跳地進入了房間！$/, (name) => `${name} hopped into the room!`],
        [/^(.+) 離開了房間。$/, (name) => `${name} left the room.`],
        [/^(.+) 來串門子了！$/, (name) => `${name} dropped by!`],
        // 封鎖、檢舉
        [/^已封鎖 (.+)，你們之後互相看不到對方說話，他也進不了你當房主的房間。$/,
            (name) => `Blocked ${name}. You won't see each other's messages, and they can't join rooms you host.`],
        [/^已送出對 (.+) 的檢舉，管理員會盡快處理，謝謝你！$/, (name) => `Report on ${name} sent. Our admins will look into it — thank you!`],
        // 兌換碼
        [/^🎁 兌換成功！「(.+)」的獎勵已經送到你的帳號$/, (title) => `🎁 Redeemed! Rewards from "${title}" are in your account`],
        // 公告板
        [/^想說的話最多 (\d+) 個字$/, (n) => `Keep it under ${n} characters`],
        // 翻牌對決
        [/^至少要 (\d+) 個人才能開始對決！$/, (n) => `You need at least ${n} players to start!`],
        [/^至少要選 (\d+) 組才能開始喔！$/, (n) => `Pick at least ${n} pairs to start!`],
        [/^最多只能選 (\d+) 組喔！$/, (n) => `You can pick up to ${n} pairs!`],
        [/^加入的人不到 (\d+) 位，這局先取消了。$/, (n) => `Fewer than ${n} players joined, so the match was cancelled.`],
        [/^有 (\d+) 個人參加，組數自動加到 (\d+) 組！$/, (n, p) => `${n} players joined — raised to ${p} pairs!`],
        [/^(.+) 想太久了，換下一位！$/, (name) => `${name} took too long — next player!`],
        [/^(.+) 輪到時 (\d+) 次都沒翻牌，被請出對決了！$/, (name, n) => `${name} skipped ${n} turns and was removed from the match!`],
        [/^(.+) 這回合沒有翻牌（警告 (\d+)\/(\d+)），再一次就會被請出對決！$/,
            (name, a, b) => `${name} didn't flip this turn (warning ${a}/${b}) — once more and they're out!`],
        [/^🃏 (.*) 翻到鬼牌！還沒配對的牌全部重新洗過，換下一位！$/, (name) => `🃏 ${name} found the Joker! All unmatched cards were reshuffled — next player!`],
        [/^(.+) 連續翻對 (\d+) 組，換下一位！$/, (name, n) => `${name} matched ${n} in a row — next player!`],
        [/^(.+) 只剩一個人，牌還沒翻到 (\d+)%，這局不算。$/, (before, pct) => `${trText(before)} Only one player is left and less than ${pct}% of the cards were matched, so this match doesn't count.`],
        [/^(.+) 斷線了，位置先幫他保留。$/, (name) => `${name} disconnected — their seat is saved.`],
        [/^(.+) 離開了對決。$/, (name) => `${name} left the match.`],
        [/^(.+) 回來了！$/, (name) => `${name} is back!`],
        // 遊戲裡的提示
        [/^第 (\d+) 隻羊 💤$/, (n) => `Sheep #${n} 💤`],
        [/^🗑️ 已刪除 (.+)$/, (x) => `🗑️ Removed ${x}`],
        [/^試用體驗 🛒 \+(.+)$/, (x) => `Trial 🛒 +${x}`],
        [/^-1分 🛒 \+(.+)$/, (x) => `-1 coin 🛒 +${x}`],
        [/^試用體驗 🎵 (.+)$/, (x) => `Trial 🎵 ${x}`],
        [/^速度切換: (.+)$/, (x) => `Speed: ${x}`],
        [/^🎼 樂譜 \((\d+)\/(\d+)\)$/, (a, b) => `🎼 Score (${a}/${b})`]
    ];

    // 英文模式才翻；找不到對應的就原樣顯示（例如玩家自己打的字）
    function trText(msg) {
        if (typeof msg !== 'string' || !isEn()) return msg;
        const s = msg.trim();
        if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
        for (const [re, fn] of PATTERNS) {
            const m = s.match(re);
            if (m) return fn(...m.slice(1));
        }
        return msg;
    }
    window.trText = trText;

    // =====================================================================
    // 🐰 小海兔頭像（玩家小卡用，跟翻牌牌面同一套畫法）
    // =====================================================================
    function miniSlug(colorKey) {
        const s = (typeof speciesData !== 'undefined' && speciesData[colorKey]) || speciesData.snow;
        return `<svg viewBox="40 15 270 210" aria-hidden="true">
            <g stroke="${s.outline}" stroke-width="6" stroke-linejoin="round">
                <path d="M 250 170 C 270 180, 300 190, 290 140 C 280 100, 250 140, 240 170 Z" fill="${s.tail}"/>
                <path d="M 260 150 C 290 160, 320 120, 280 80 C 260 60, 230 110, 250 150 Z" fill="${s.tail}"/>
                <path d="M 70 190 C 20 180, 30 120, 90 110 C 160 100, 220 105, 260 130 C 290 150, 280 200, 200 210 C 130 220, 90 200, 70 190 Z" fill="${s.body}"/>
                <path d="M 100 105 C 80 50, 95 20, 110 25 C 125 30, 120 90, 115 105 Z" fill="${s.earTop}"/>
                <path d="M 145 100 C 135 45, 160 15, 175 25 C 190 35, 165 85, 160 100 Z" fill="${s.earTop}"/>
            </g>
            <g fill="${s.spot}"><circle cx="125" cy="125" r="6"/><circle cx="210" cy="140" r="6.5"/><circle cx="145" cy="180" r="6.5"/></g>
            <g transform="translate(130, 150)">
                <ellipse cx="-35" cy="12" rx="14" ry="8" fill="${s.blush}" opacity="0.85"/><ellipse cx="35" cy="12" rx="14" ry="8" fill="${s.blush}" opacity="0.85"/>
                <circle cx="-20" cy="0" r="8" fill="#2c3e50"/><circle cx="20" cy="0" r="8" fill="#2c3e50"/>
                <circle cx="-17" cy="-3" r="3" fill="#fff"/><circle cx="23" cy="-3" r="3" fill="#fff"/>
                <path d="M -7 5 Q 0 12 7 5" fill="none" stroke="#2c3e50" stroke-width="4" stroke-linecap="round"/>
            </g></svg>`;
    }

    const itemName = (dataObj, key) => {
        const item = dataObj && dataObj[key];
        if (!item) return key;
        const n = item.name;
        return typeof n === 'string' ? n : (isEn() ? n.en : n.zh) || key;
    };

    // 跟伺服器要結果：socket.io 的 ack，8 秒沒回就當失敗
    function emitWithAck(event, data) {
        return new Promise((resolve) => {
            if (typeof socket === 'undefined' || !socket || !socket.connected) {
                resolve({ ok: false, message: L('還沒連上伺服器，請稍後再試', 'Not connected to the server. Please try again.') });
                return;
            }
            socket.timeout(8000).emit(event, data, (err, res) => {
                if (err) resolve({ ok: false, message: L('伺服器沒有回應，請再試一次', 'The server did not respond. Please try again.') });
                else resolve(res && typeof res === 'object' ? res : { ok: false, message: '' });
            });
        });
    }

    // 通用的視窗開關（沿用遊戲裡 name-modal 的樣子）
    const show = (id) => { const o = $(id); if (o) o.style.display = 'flex'; };
    const hide = (id) => { const o = $(id); if (o) o.style.display = 'none'; };
    const isShown = (id) => { const o = $(id); return !!o && o.style.display === 'flex'; };

    // =====================================================================
    // 🪪 玩家小卡：點別人的海兔 → 聊天／封鎖／檢舉
    // =====================================================================
    const REASONS = [
        { key: 'harassment', zh: '騷擾或不當言論', en: 'Harassment or offensive chat' },
        { key: 'bad_name', zh: '不當的寵物名稱', en: 'Inappropriate pet name' },
        { key: 'trolling', zh: '掛機或故意搗亂', en: 'Idling or trolling' },
        { key: 'other', zh: '其他', en: 'Other' }
    ];
    const DETAIL_MAX = 200;
    let cardTarget = null;      // { socketId, petName, petColor }
    let cardView = 'menu';      // menu／block／report
    let cardBusy = false;
    let cardNotice = null;      // { ok, text }（切語言時重畫用，存原文）

    function ensurePlayerCard() {
        if ($('playerCardOverlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'name-modal-overlay';
        overlay.id = 'playerCardOverlay';
        overlay.style.zIndex = '10048';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePlayerCard(); });
        overlay.innerHTML = `
            <div class="name-modal pc-modal" role="dialog" aria-labelledby="pcName">
                <button type="button" class="board-close pc-close" id="pcClose">✕</button>
                <div class="pc-head">
                    <div class="pc-avatar" id="pcAvatar"></div>
                    <div class="pc-who">
                        <h2 class="pc-name" id="pcName"></h2>
                        <p class="pc-species" id="pcSpecies"></p>
                    </div>
                </div>
                <div class="pc-view" id="pcMenu">
                    <button type="button" class="pc-action chat" id="pcChat"></button>
                    <button type="button" class="pc-action block" id="pcBlock"></button>
                    <button type="button" class="pc-action report" id="pcReport"></button>
                </div>
                <div class="pc-view" id="pcBlockView" hidden>
                    <p class="pc-text" id="pcBlockText"></p>
                    <div class="pc-row">
                        <button type="button" class="board-btn" id="pcBlockCancel"></button>
                        <button type="button" class="board-btn danger" id="pcBlockConfirm"></button>
                    </div>
                </div>
                <div class="pc-view" id="pcReportView" hidden>
                    <p class="pc-text" id="pcReportText"></p>
                    <div class="pc-reasons" id="pcReasons" role="radiogroup"></div>
                    <textarea id="pcDetail" rows="2" maxlength="${DETAIL_MAX}"></textarea>
                    <div class="pc-count" id="pcDetailCount"></div>
                    <div class="pc-row">
                        <button type="button" class="board-btn" id="pcReportCancel"></button>
                        <button type="button" class="board-btn danger" id="pcReportSend" disabled></button>
                    </div>
                </div>
                <div class="pc-notice" id="pcNotice" role="status"></div>
            </div>`;
        document.body.appendChild(overlay);

        $('pcClose').addEventListener('click', closePlayerCard);
        $('pcChat').addEventListener('click', () => { closePlayerCard(); if (typeof openChatBar === 'function') openChatBar(); });
        $('pcBlock').addEventListener('click', () => setCardView('block'));
        $('pcReport').addEventListener('click', () => setCardView('report'));
        $('pcBlockCancel').addEventListener('click', () => setCardView('menu'));
        $('pcReportCancel').addEventListener('click', () => setCardView('menu'));
        $('pcBlockConfirm').addEventListener('click', doBlock);
        $('pcReportSend').addEventListener('click', doReport);
        $('pcDetail').addEventListener('input', renderPlayerCard);
        REASONS.forEach((r) => {
            const label = document.createElement('label');
            label.className = 'pc-reason';
            label.innerHTML = `<input type="radio" name="pcReason" value="${r.key}"><span></span>`;
            label.querySelector('input').addEventListener('change', renderPlayerCard);
            $('pcReasons').appendChild(label);
        });
    }

    function openPlayerCard(socketId) {
        const p = typeof otherPlayersData !== 'undefined' && otherPlayersData[socketId];
        if (!p) return;
        ensurePlayerCard();
        cardTarget = { socketId, petName: p.petName || '', petColor: p.petColor };
        cardNotice = null;
        cardBusy = false;
        $('pcDetail').value = '';
        document.querySelectorAll('#pcReasons input').forEach((i) => { i.checked = false; });
        setCardView('menu');
        show('playerCardOverlay');
    }

    function closePlayerCard() {
        hide('playerCardOverlay');
        cardTarget = null;
    }

    function setCardView(view) {
        cardView = view;
        cardNotice = null;
        renderPlayerCard();
    }

    function renderPlayerCard() {
        if (!cardTarget || !$('playerCardOverlay')) return;
        const name = cardTarget.petName;
        $('pcAvatar').innerHTML = miniSlug(cardTarget.petColor);
        $('pcName').textContent = name;
        $('pcSpecies').textContent = itemName(typeof speciesData !== 'undefined' ? speciesData : null, cardTarget.petColor);
        $('pcClose').setAttribute('aria-label', L('關閉', 'Close'));

        $('pcMenu').hidden = cardView !== 'menu';
        $('pcBlockView').hidden = cardView !== 'block';
        $('pcReportView').hidden = cardView !== 'report';

        $('pcChat').textContent = L('💬 跟大家聊天', '💬 Chat');
        $('pcBlock').textContent = L('🚫 封鎖', '🚫 Block');
        $('pcReport').textContent = L('🚩 檢舉', '🚩 Report');

        $('pcBlockText').textContent = L(
            `確定要封鎖「${name}」嗎？之後你們在房間裡互相看不到對方說話，他也進不了你當房主的房間。之後可以在連線選單的「封鎖名單」解除。`,
            `Block "${name}"? You won't see each other's messages in rooms, and they can't join rooms you host. You can unblock them later from the Blocklist in the online menu.`);
        $('pcBlockCancel').textContent = L('取消', 'Cancel');
        $('pcBlockConfirm').textContent = cardBusy ? L('封鎖中…', 'Blocking…') : L('確定封鎖', 'Block');
        $('pcBlockConfirm').disabled = cardBusy;

        $('pcReportText').textContent = L(
            `檢舉「${name}」：選一個理由，房間最近的聊天會一起送給管理員看。`,
            `Report "${name}": pick a reason. Recent chat from this room will be sent to the admins.`);
        document.querySelectorAll('#pcReasons .pc-reason').forEach((label, i) => {
            label.querySelector('span').textContent = isEn() ? REASONS[i].en : REASONS[i].zh;
            label.classList.toggle('is-checked', label.querySelector('input').checked);
        });
        const detail = $('pcDetail');
        detail.placeholder = L('想補充的話（可以不填）', 'Anything else to add? (optional)');
        detail.setAttribute('aria-label', L('補充說明', 'Details'));
        $('pcDetailCount').textContent = `${[...detail.value].length}/${DETAIL_MAX}`;
        const reason = document.querySelector('#pcReasons input:checked');
        $('pcReportCancel').textContent = L('取消', 'Cancel');
        $('pcReportSend').textContent = cardBusy ? L('送出中…', 'Sending…') : L('送出檢舉', 'Send report');
        $('pcReportSend').disabled = cardBusy || !reason;

        const notice = $('pcNotice');
        notice.textContent = cardNotice ? trText(cardNotice.text) : '';
        notice.classList.toggle('ok', !!(cardNotice && cardNotice.ok));
    }

    async function doBlock() {
        if (!cardTarget || cardBusy) return;
        if (typeof isMockMode !== 'undefined' && isMockMode) {
            cardNotice = { ok: false, text: L('模擬模式裡的玩家不能封鎖喔', "You can't block players in demo mode") };
            renderPlayerCard();
            return;
        }
        cardBusy = true;
        renderPlayerCard();
        const target = cardTarget;
        const res = await emitWithAck('game_block_player', { socketId: target.socketId });
        cardBusy = false;
        if (res.ok) {
            markBlocked(target.socketId, true);
            closePlayerCard();
            showFloatText(res.message || L('已封鎖', 'Blocked'), 5000);
            return;
        }
        cardNotice = { ok: false, text: res.message || L('封鎖失敗，請稍後再試。', "Couldn't block. Please try again later.") };
        renderPlayerCard();
    }

    async function doReport() {
        if (!cardTarget || cardBusy) return;
        const reason = document.querySelector('#pcReasons input:checked');
        if (!reason) return;
        if (typeof isMockMode !== 'undefined' && isMockMode) {
            cardNotice = { ok: false, text: L('模擬模式裡的玩家不能檢舉喔', "You can't report players in demo mode") };
            renderPlayerCard();
            return;
        }
        cardBusy = true;
        renderPlayerCard();
        const res = await emitWithAck('game_report_player', {
            socketId: cardTarget.socketId, reason: reason.value, detail: [...$('pcDetail').value.trim()].slice(0, DETAIL_MAX).join('')
        });
        cardBusy = false;
        if (res.ok) {
            closePlayerCard();
            showFloatText(res.message || L('檢舉已送出', 'Report sent'), 5000);
            return;
        }
        cardNotice = { ok: false, text: res.message || L('檢舉失敗，請稍後再試。', "Couldn't send the report. Please try again later.") };
        renderPlayerCard();
    }

    // 封鎖了就在名字前面加個 🚫，自己知道這個人的話看不到
    function markBlocked(socketId, blocked) {
        const p = typeof otherPlayersData !== 'undefined' && otherPlayersData[socketId];
        if (p) p.blockedByMe = blocked;
        const el = $(`player-${socketId}`);
        if (el) el.classList.toggle('is-blocked', blocked);
    }

    // 點別人的海兔就打開小卡（用事件委派，玩家進進出出不用重新綁）
    function bindPlayerTaps() {
        const layer = $('otherPlayersLayer');
        if (!layer || layer.dataset.socialBound) return;
        layer.dataset.socialBound = '1';
        layer.addEventListener('click', (e) => {
            const el = e.target.closest('.other-player');
            if (!el) return;
            e.stopPropagation();
            openPlayerCard(el.id.replace(/^player-/, ''));
        });
    }

    // =====================================================================
    // 🚫 封鎖名單
    // =====================================================================
    let blocks = [];
    let blocksState = 'idle';   // idle／loading／ok／failed／login
    let blocksError = '';
    const unblocking = new Set();

    function ensureBlockList() {
        if ($('blockListOverlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'name-modal-overlay';
        overlay.id = 'blockListOverlay';
        overlay.style.zIndex = '10048';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeBlockList(); });
        overlay.innerHTML = `
            <div class="name-modal bl-modal" role="dialog" aria-labelledby="blTitle">
                <div class="board-head">
                    <div>
                        <h2 class="board-title" id="blTitle"></h2>
                        <p class="board-sub" id="blSub"></p>
                    </div>
                    <button type="button" class="board-close" id="blClose">✕</button>
                </div>
                <div class="bl-list" id="blList"></div>
                <div class="board-error" id="blError" role="alert"></div>
            </div>`;
        document.body.appendChild(overlay);
        $('blClose').addEventListener('click', closeBlockList);
    }

    async function openBlockList() {
        ensureBlockList();
        blocksError = '';
        show('blockListOverlay');
        if (!GAME_TOKEN) { blocksState = 'login'; renderBlockList(); return; }
        blocksState = 'loading';
        renderBlockList();
        const res = await fetchAPI('/pet-games/blocks', 'GET');
        if (res && Array.isArray(res.data)) { blocks = res.data; blocksState = 'ok'; }
        else { blocksState = 'failed'; blocksError = (res && (res.error || res.message)) || ''; }
        renderBlockList();
    }

    function closeBlockList() { hide('blockListOverlay'); }

    function formatDate(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(isEn() ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function renderBlockList() {
        if (!$('blockListOverlay')) return;
        $('blTitle').textContent = L('🚫 封鎖名單', '🚫 Blocklist');
        $('blSub').textContent = L('被你封鎖的玩家進不了你當房主的房間，在別的房間你們也互相看不到對方說話。',
            "Players you block can't join rooms you host, and you won't see each other's messages in other rooms.");
        $('blClose').setAttribute('aria-label', L('關閉', 'Close'));
        $('blError').textContent = trText(blocksError);
        const list = $('blList');
        list.innerHTML = '';
        const empty = (text) => { const d = document.createElement('div'); d.className = 'board-empty'; d.textContent = text; list.appendChild(d); };
        if (blocksState === 'login') return empty(L('登入之後才能看封鎖名單喔', 'Log in to see your blocklist'));
        if (blocksState === 'loading') return empty(L('正在讀取…', 'Loading…'));
        if (blocksState === 'failed') return empty(L('封鎖名單暫時讀不到，晚點再試試看', "Couldn't load your blocklist. Please try again later."));
        if (!blocks.length) return empty(L('你還沒有封鎖任何人。在房間裡點別人的海兔就能封鎖或檢舉。', "You haven't blocked anyone. Tap another player's sea bunny in a room to block or report them."));
        blocks.forEach((b) => {
            const row = document.createElement('div');
            row.className = 'bl-row';
            const who = document.createElement('div');
            who.className = 'bl-who';
            const name = document.createElement('div');
            name.className = 'bl-name';
            name.textContent = b.blocked_pet_name || L('（沒有名字）', '(no name)');
            const when = document.createElement('div');
            when.className = 'bl-when';
            when.textContent = L(`封鎖於 ${formatDate(b.created_at)}`, `Blocked on ${formatDate(b.created_at)}`);
            who.appendChild(name);
            who.appendChild(when);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'board-btn';
            btn.disabled = unblocking.has(b.id);
            btn.textContent = unblocking.has(b.id) ? L('解除中…', 'Unblocking…') : L('解除封鎖', 'Unblock');
            btn.addEventListener('click', () => doUnblock(b));
            row.appendChild(who);
            row.appendChild(btn);
            list.appendChild(row);
        });
    }

    async function doUnblock(b) {
        if (unblocking.has(b.id)) return;
        unblocking.add(b.id);
        blocksError = '';
        renderBlockList();
        const res = await fetchAPI(`/pet-games/blocks/${encodeURIComponent(b.id)}`, 'DELETE');
        unblocking.delete(b.id);
        if (res && !res.error) {
            blocks = blocks.filter((x) => x.id !== b.id);
            // 房間裡同名的海兔把 🚫 拿掉（名單只給寵物名字，用名字對）
            if (typeof otherPlayersData !== 'undefined') {
                Object.keys(otherPlayersData).forEach((id) => {
                    if (otherPlayersData[id].petName === b.blocked_pet_name) markBlocked(id, false);
                });
            }
            showFloatText(res.message || L('已解除封鎖', 'Unblocked.'));
        } else {
            blocksError = (res && res.error) || L('解除封鎖失敗', "Couldn't unblock.");
        }
        renderBlockList();
    }

    // =====================================================================
    // 🎁 兌換碼（右上角按鈕 → 跳出視窗）
    // =====================================================================
    const CATEGORY = {
        pet_color: { data: () => speciesData, list: () => gameState.unlockedSpecies, zh: '海兔', en: 'Sea bunny' },
        background_color: { data: () => bgData, list: () => gameState.unlockedBgs, zh: '背景', en: 'Background' },
        background_effects: { data: () => effectData, list: () => gameState.unlockedEffects, zh: '特效', en: 'Effect' }
    };
    let redeemBusy = false;
    let redeemResult = null;   // 成功：{ data }；失敗：{ error }
    let redeemDraft = '';

    function renderRedeem(grid) {
        const box = document.createElement('div');
        box.className = 'redeem-box';
        box.innerHTML = `
            <div class="redeem-icon" aria-hidden="true">🎁</div>
            <h3 class="redeem-title"></h3>
            <p class="redeem-sub"></p>
            <div class="redeem-form">
                <input type="text" class="redeem-input" id="redeemInput" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false">
                <button type="button" class="redeem-btn" id="redeemBtn"></button>
            </div>
            <div class="redeem-result" id="redeemResult" role="status"></div>`;
        grid.appendChild(box);
        box.querySelector('.redeem-title').textContent = L('輸入兌換碼', 'Redeem a code');
        box.querySelector('.redeem-sub').textContent = L('活動送的兌換碼輸入在這裡，積分和道具會直接送到你的帳號。', 'Enter a code from an event — coins and items go straight to your account.');
        const input = $('redeemInput');
        input.placeholder = L('例如：SEABUNNY2026', 'e.g. SEABUNNY2026');
        input.setAttribute('aria-label', L('兌換碼', 'Code'));
        input.value = redeemDraft;
        input.addEventListener('input', () => {
            // 只留英文、數字、- 和 _，自動轉大寫
            const clean = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20);
            if (clean !== input.value) input.value = clean;
            redeemDraft = clean;
            renderRedeemButton();
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) doRedeem(); });
        $('redeemBtn').addEventListener('click', doRedeem);
        renderRedeemButton();
        renderRedeemResult();
    }

    function ensureRedeemModal() {
        if ($('redeemOverlay')) return;
        const overlay = document.createElement('div');
        overlay.className = 'name-modal-overlay';
        overlay.id = 'redeemOverlay';
        overlay.style.zIndex = '10048';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeRedeem(); });
        overlay.innerHTML = `
            <div class="name-modal redeem-modal" role="dialog" aria-labelledby="redeemModalTitle">
                <button type="button" class="board-close redeem-close" id="redeemClose">✕</button>
                <div id="redeemBody"></div>
            </div>`;
        document.body.appendChild(overlay);
        $('redeemClose').addEventListener('click', closeRedeem);
    }

    function openRedeem() {
        ensureRedeemModal();
        renderRedeemModal();
        show('redeemOverlay');
        // 電腦直接可以打字；手機不要自動跳鍵盤
        const isPhone = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const input = $('redeemInput');
        if (input && !isPhone) input.focus();
    }

    function closeRedeem() {
        hide('redeemOverlay');
        // 上次的結果不要一直留著，下次打開是乾淨的
        if (!redeemBusy) redeemResult = null;
    }

    function renderRedeemModal() {
        const body = $('redeemBody');
        if (!body) return;
        body.innerHTML = '';
        renderRedeem(body);
        const title = body.querySelector('.redeem-title');
        if (title) title.id = 'redeemModalTitle';
        $('redeemClose').setAttribute('aria-label', L('關閉', 'Close'));
    }

    function renderRedeemButton() {
        const btn = $('redeemBtn');
        if (!btn) return;
        btn.textContent = redeemBusy ? L('兌換中…', 'Redeeming…') : L('兌換', 'Redeem');
        btn.disabled = redeemBusy || redeemDraft.length < 4;
    }

    function renderRedeemResult() {
        const box = $('redeemResult');
        if (!box) return;
        box.innerHTML = '';
        box.className = 'redeem-result';
        if (!redeemResult) return;
        if (redeemResult.error) {
            box.classList.add('is-error');
            box.textContent = trText(redeemResult.error);
            return;
        }
        const d = redeemResult.data;
        box.classList.add('is-ok');
        const head = document.createElement('div');
        head.className = 'redeem-ok-title';
        head.textContent = L(`🎉 兌換成功！「${d.title}」`, `🎉 Redeemed! "${d.title}"`);
        box.appendChild(head);
        // 東西很多時先告訴玩家總共幾樣，清單可以往下捲
        const total = (d.coin > 0 ? 1 : 0) + (d.items || []).length;
        if (total > 1) {
            const count = document.createElement('div');
            count.className = 'redeem-ok-count';
            count.textContent = L(`共 ${total} 樣獎勵`, `${total} rewards in total`);
            box.appendChild(count);
        }
        const list = document.createElement('ul');
        list.className = 'redeem-rewards';
        if (d.coin > 0) {
            const li = document.createElement('li');
            li.className = 'is-coin';
            li.textContent = L(`💰 ${d.coin} 積分`, `💰 ${d.coin} coins`);
            list.appendChild(li);
        }
        (d.items || []).forEach((x) => {
            const cat = CATEGORY[x.category];
            const li = document.createElement('li');
            li.textContent = cat ? (isEn() ? `${cat.en}: ` : `${cat.zh}：`) + itemName(cat.data(), x.item) : x.item;
            if (x.alreadyOwned) {
                const tag = document.createElement('span');
                tag.className = 'redeem-owned';
                tag.textContent = L('已經有了', 'Already owned');
                li.appendChild(tag);
            }
            list.appendChild(li);
        });
        box.appendChild(list);
    }

    async function doRedeem() {
        if (redeemBusy || redeemDraft.length < 4) return;
        if (!GAME_TOKEN) {
            redeemResult = { error: L('請先登入才能兌換喔', 'Please log in to redeem') };
            renderRedeemResult();
            return;
        }
        redeemBusy = true;
        renderRedeemButton();
        const res = await fetchAPI('/pet-games/redeem', 'POST', { code: redeemDraft });
        redeemBusy = false;
        if (res && res.data && !res.error) {
            const d = res.data;
            redeemResult = { data: d };
            redeemDraft = '';
            // 積分和道具馬上更新到畫面上，不用重新整理
            if (typeof d.totalCoin === 'number') gameState.points = d.totalCoin;
            (d.items || []).forEach((x) => {
                const cat = CATEGORY[x.category];
                if (!cat) return;
                const list = cat.list();
                if (cat.data()[x.item] && !list.includes(x.item)) list.push(x.item);
            });
            saveGame();
            updateUI();
            // 商店、百寶袋的卡片要重畫，才會從「🏆 翻牌 10 勝」這類鎖住的樣子變成可以穿的「已擁有」
            if (typeof renderShop === 'function') renderShop();
            const catalogOverlay = document.getElementById('catalogModalOverlay');
            if (catalogOverlay && catalogOverlay.style.display === 'flex' && typeof renderCatalog === 'function') renderCatalog();
            if (typeof playDingSound === 'function') playDingSound(2);
            showFloatText(res.message || L('🎁 兌換成功！', '🎁 Redeemed!'), 4000);
            const input = $('redeemInput');
            if (input) input.value = '';
        } else {
            redeemResult = { error: (res && (res.error || res.message)) || L('兌換失敗，請稍後再試', "Couldn't redeem. Please try again later.") };
        }
        renderRedeemButton();
        renderRedeemResult();
    }

    // =====================================================================
    // 🌐 切語言
    // =====================================================================
    // HTML 裡寫死中文的地方：有 data-en 就在英文模式換掉（第一次先把中文存起來，切回來用）
    const ATTRS = [['enTitle', 'title'], ['enAria', 'aria-label'], ['enPlaceholder', 'placeholder']];
    function applyStaticText() {
        const en = isEn();
        document.querySelectorAll('[data-en]').forEach((el) => {
            if (el.dataset.zh === undefined) el.dataset.zh = el.textContent;
            el.textContent = en ? el.dataset.en : el.dataset.zh;
        });
        ATTRS.forEach(([key, attr]) => {
            const zhKey = 'zh' + key.slice(2);
            document.querySelectorAll('[data-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + ']').forEach((el) => {
                if (el.dataset[zhKey] === undefined) el.dataset[zhKey] = el.getAttribute(attr) || '';
                el.setAttribute(attr, en ? el.dataset[key] : el.dataset[zhKey]);
            });
        });
    }

    function refreshLang() {
        applyStaticText();
        const redeemBtn = $('txtRedeemBtn');
        if (redeemBtn) redeemBtn.textContent = L('兌換碼', 'Redeem');
        $('btnRedeem') && $('btnRedeem').setAttribute('aria-label', L('兌換碼', 'Redeem a code'));
        if (isShown('redeemOverlay')) renderRedeemModal();
        const boardBtn = $('btnRoomBoard');
        if (boardBtn) boardBtn.textContent = L('📋 房間公告板', '📋 Room Board');
        const blBtn = $('btnBlockList');
        if (blBtn) blBtn.textContent = L('🚫 封鎖名單', '🚫 Blocklist');
        if (isShown('playerCardOverlay')) renderPlayerCard();
        if (isShown('blockListOverlay')) renderBlockList();
        // 聊天紀錄裡的系統訊息（誰進來、誰離開）也跟著換
        document.querySelectorAll('.chat-msg.system .chat-msg-text[data-raw]').forEach((el) => {
            el.textContent = trText(el.dataset.raw);
        });
    }

    // 關掉視窗：Esc
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (isShown('playerCardOverlay')) closePlayerCard();
        else if (isShown('blockListOverlay')) closeBlockList();
        else if (isShown('redeemOverlay')) closeRedeem();
    });

    function init() {
        bindPlayerTaps();
        refreshLang();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.SlugSocial = {
        openPlayerCard, closePlayerCard, openBlockList, closeBlockList, openRedeem, closeRedeem, refreshLang,
        isBlocked: (socketId) => !!(typeof otherPlayersData !== 'undefined' && otherPlayersData[socketId] && otherPlayersData[socketId].blockedByMe)
    };
})();
