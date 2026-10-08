// 🃏 【記憶翻牌對決】連線房間裡的小遊戲
//
// 牌的位置只有伺服器知道（backend/src/socket/memoryGame.ts），這裡只負責畫面：
// 點牌 → 送 memory_flip → 伺服器告訴大家翻到什麼、有沒有配對、輪到誰。
// 會用到 slug_game.js 的 socket、currentRoomId、isRoomHost、speciesData、GAME_TOKEN、showFloatText、fetchAPI。
(function () {
    const PAIR_OPTIONS = [12, 20, 30, 44, 58];
    const JOKER = 'joker';

    let boundSocket = null;
    let state = null;          // 目前盤面（伺服器給的公開狀態）
    let timerTick = null;
    let turnDeadline = 0;

    // ---------- 文字（跟著遊戲右上角的中／英切換） ----------
    const TEXT = {
        zh: {
            title: '🃏 記憶翻牌對決',
            closeTip: '收起（對決會繼續進行）',
            heroTitle: '記憶翻牌對決', heroSub: '翻出兩隻一樣的海兔，比比看誰的記性最好！',
            rulesBtn: '玩法教學', rulesTitle: '📖 遊戲規則',
            rulesFull: '📖 看完整規則', rulesBack: '回到對局', rulesClose: '我知道了',
            rulesLiveNote: '對局照常進行中，看規則不會暫停喔',
            // 🏆 勝場獎勵
            rewardsTitle: '🏆 勝場獎勵', winsNow: (w) => `目前 ${w} 勝`, winsUnknown: '登入後才會記錄勝場喔',
            nextGoal: (n, name) => `再贏 ${n} 場解鎖「${name}」`, allDone: '全部獎勵都到手了，你就是翻牌之王！',
            winsNeed: (n) => `${n} 勝`, lockedLeft: (n) => `還差 ${n} 場`,
            reward_cardBack: '卡背自選箱', rewardSub_cardBack: '所有卡背隨你換',
            reward_joker: '小丑海兔', rewardSub_joker: '專屬皮膚',
            reward_outfit: '披風皇冠', rewardSub_outfit: '國王裝或皇后裝',
            reward_throne: '登上王座', rewardSub_throne: '神秘動畫',
            act_cardBack: '選卡背', act_joker: '選配色', act_jokerOn: '換配色', act_outfit: '換裝', act_throne: '重播',
            cardBackTitle: '🎴 選擇卡背', cardBackHint: '隨時都能換，只有你自己的畫面會變成這個卡背',
            outfitTitle: '👑 選擇服裝', outfitNone: '不穿', outfitHint: '穿在魚缸裡的海兔身上，連線時其他人也看得到',
            outfitRoomNote: '你現在在房間裡：其他人要等你下次進房，才會看到新服裝',
            using: '使用中', pickDone: '完成',
            unlockTitle: '🎉 解鎖新獎勵！',
            unlock_cardBack: '贏滿 3 場！所有卡背都能隨你換囉', unlock_joker: '贏滿 10 場！小丑海兔送進背包了，四種配色任你挑',
            unlock_outfit: '贏滿 30 場！國王裝和皇后裝任你挑', unlockLater: '等等再說',
            jokerWorn: '🤡 換上小丑海兔了！', jokerTitle: '🤡 小丑海兔配色', jokerHint: '選一種配色馬上穿上，隨時都能換；連線時其他人也看得到',
            throneTitle: '👑 登上王座！', throneSub: '翻牌對決 100 勝，你就是記憶之王！', throneBtn: '太棒了！', throneSkip: '點一下跳過',
            albumOpen: '📖 卡牌圖鑑', albumOpenSub: '先看看有哪些牌',
            pickPairs: '選擇對決組數', start: '開始對決！', wait: '等房主選好組數開始對決…',
            pairs: (n) => `${n} 組`,
            back: '← 返回', albumTitle: '📖 卡牌圖鑑', prev: '上一頁', next: '下一頁',
            albumHint: '左右滑動或按方向鍵翻頁',
            albumCount: (n) => `共 ${n} 張`,
            albumPageNo: (p, t) => `第 ${p} / ${t} 頁`,
            joker: '小丑', jokerRibbon: '小丑牌', jokerMark: '丑',
            jokerSlot: '小丑牌，翻到就把沒配對的牌重新洗過',
            notYourTurn: '還沒輪到你喔！',
            me: (name) => `${name}（我）`,
            streak: (a, b) => `・已連續翻對 ${a} / ${b} 組`,
            myTurn: (streak, secs) => `輪到你翻牌！${streak}（${secs} 秒）`,
            otherTurn: (name, streak, secs) => `輪到 ${name} 翻牌${streak}（${secs} 秒）`,
            draw: '🤝 平手！', over: '對決結束！', youWin: '🎉 你贏了！',
            score: (n) => `${n} 組`, drawNote: '平手不計入勝場喔！',
            again: '再來一局', backToLobby: '回到等待畫面',
            error: '翻牌對決發生錯誤',
            started: (n) => `🃏 翻牌對決開始！共 ${n} 組`,
            jokerGot: (v) => `🃏 小丑牌！一次拿下 ${v} 組！`,
            matched: (name) => `配對成功！${name} ✨`,
            yourTurnToast: '輪到你翻牌囉！🃏',
            skinUnlocked: (n) => `🃏 恭喜贏滿 ${n} 場，獲得小丑皮膚！`,
            winPlus: (w) => `🏆 勝場 +1（目前 ${w} 場）`,
            inviteTitle: (host) => `${host} 開了翻牌對決！`,
            inviteHostTitle: '等大家回覆要不要加入…',
            inviteSub: (pairs, secs) => `共 ${pairs} 組・${secs} 秒後開局`,
            inviteJoined: (names) => `已加入：${names}`,
            inviteWaiting: (n) => `還有 ${n} 人沒回覆`,
            inviteJoin: '加入對決', inviteWatch: '觀戰就好',
            inviteJoinedMe: '✅ 你已加入，等開局…', inviteWatchMe: '👀 你選擇觀戰',
            inviteCancelled: '翻牌對決取消了',
            inviteBusy: '正在等大家回覆…',
            watchingTag: '👀 觀戰中',
            watchingNoFlip: '觀戰中不能翻牌喔，下一局開局時記得按「加入」！',
            startedWatching: '🃏 翻牌對決開始了！你在觀戰，點「翻牌對決」就能看',
            endedWatching: '🃏 翻牌對決結束了！'
        },
        en: {
            title: '🃏 Memory Match',
            closeTip: 'Minimize (the match keeps going)',
            heroTitle: 'Memory Match', heroSub: 'Find two matching sea bunnies — who has the best memory?',
            rulesBtn: 'How to play', rulesTitle: '📖 Game Rules',
            rulesFull: '📖 Full rules', rulesBack: 'Back to the match', rulesClose: 'Got it',
            rulesLiveNote: "The match keeps going — reading the rules doesn't pause it",
            // 🏆 Win rewards
            rewardsTitle: '🏆 Win Rewards', winsNow: (w) => `${w} wins`, winsUnknown: 'Log in to keep track of your wins',
            nextGoal: (n, name) => `${n} more ${n === 1 ? 'win' : 'wins'} to unlock "${name}"`, allDone: "You've got every reward — you're the Memory Master!",
            winsNeed: (n) => `${n} wins`, lockedLeft: (n) => `${n} to go`,
            reward_cardBack: 'Card Back Box', rewardSub_cardBack: 'Switch card backs anytime',
            reward_joker: 'Joker Bunny', rewardSub_joker: 'Exclusive skin',
            reward_outfit: 'Cape & Crown', rewardSub_outfit: 'King or Queen outfit',
            reward_throne: 'The Throne', rewardSub_throne: 'Secret animation',
            act_cardBack: 'Pick', act_joker: 'Pick colors', act_jokerOn: 'Change colors', act_outfit: 'Dress up', act_throne: 'Replay',
            cardBackTitle: '🎴 Card Backs', cardBackHint: 'Switch anytime — only your own screen shows it',
            outfitTitle: '👑 Outfit', outfitNone: 'None', outfitHint: 'Your sea bunny wears it in the tank, and other players see it online',
            outfitRoomNote: "You're in a room — others will see the new outfit the next time you join",
            using: 'In use', pickDone: 'Done',
            unlockTitle: '🎉 New reward unlocked!',
            unlock_cardBack: '3 wins! Every card back is yours to switch', unlock_joker: '10 wins! The Joker Bunny is in your bag — pick one of four color sets',
            unlock_outfit: '30 wins! Pick the King or Queen outfit', unlockLater: 'Later',
            jokerWorn: '🤡 Joker Bunny on!', jokerTitle: '🤡 Joker Bunny Colors', jokerHint: 'Pick a color set to wear it right away — switch anytime. Other players see it online too',
            throneTitle: '👑 To the Throne!', throneSub: '100 Memory Match wins — you are the Memory Master!', throneBtn: 'Awesome!', throneSkip: 'Tap to skip',
            albumOpen: '📖 Card Album', albumOpenSub: 'See all the cards first',
            pickPairs: 'How many pairs?', start: 'Start!', wait: 'Waiting for the host to start…',
            pairs: (n) => `${n} pairs`,
            back: '← Back', albumTitle: '📖 Card Album', prev: 'Previous page', next: 'Next page',
            albumHint: 'Swipe or use the arrow keys to turn pages',
            albumCount: (n) => `${n} cards`,
            albumPageNo: (p, t) => `Page ${p} / ${t}`,
            joker: 'Joker', jokerRibbon: 'Joker', jokerMark: 'J',
            jokerSlot: 'Joker: reshuffles the unmatched cards',
            notYourTurn: "It's not your turn yet!",
            me: (name) => `${name} (me)`,
            streak: (a, b) => ` · ${a} / ${b} in a row`,
            myTurn: (streak, secs) => `Your turn!${streak} (${secs}s)`,
            otherTurn: (name, streak, secs) => `${name}'s turn${streak} (${secs}s)`,
            draw: "🤝 It's a draw!", over: 'Match over!', youWin: '🎉 You win!',
            score: (n) => `${n} pairs`, drawNote: "Draws don't count as wins.",
            again: 'Play again', backToLobby: 'Back to lobby',
            error: 'Something went wrong with the match',
            started: (n) => `🃏 Memory Match started! ${n} pairs`,
            jokerGot: (v) => `🃏 Joker! You take ${v} pairs at once!`,
            matched: (name) => `Match! ${name} ✨`,
            yourTurnToast: 'Your turn! 🃏',
            skinUnlocked: (n) => `🃏 You won ${n} matches — Joker skin unlocked!`,
            winPlus: (w) => `🏆 +1 win (${w} total)`,
            inviteTitle: (host) => `${host} started a Memory Match!`,
            inviteHostTitle: 'Waiting for everyone to answer…',
            inviteSub: (pairs, secs) => `${pairs} pairs · starts in ${secs}s`,
            inviteJoined: (names) => `Playing: ${names}`,
            inviteWaiting: (n) => `${n} still deciding`,
            inviteJoin: 'Join', inviteWatch: 'Just watch',
            inviteJoinedMe: "✅ You're in — waiting to start…", inviteWatchMe: "👀 You're watching",
            inviteCancelled: 'The match was cancelled',
            inviteBusy: 'Waiting for everyone to answer…',
            watchingTag: '👀 Watching',
            watchingNoFlip: "You're watching this one — press Join next time!",
            startedWatching: '🃏 A Memory Match started! Open it to watch',
            endedWatching: '🃏 The Memory Match is over!'
        }
    };
    // 📖 遊戲規則：數字跟 backend/src/socket/gameConfig.ts 的 memoryGame 一致，改規則記得兩邊一起改
    // lobby: true 的會直接顯示在等待畫面，全部的放在「玩法教學」面板
    const RULES = [
        { icon: '🎮', color: '#3b82f6', lobby: true,
          zh: ['怎麼開局', '房主選好組數按「開始對決」，房間裡每個人有 <b>15 秒</b>決定要<b>加入</b>還是<b>觀戰</b>。至少要 <b>2 個人</b>才能開局，人越多組數會自動加多。'],
          en: ['Starting', 'The host picks the number of pairs and presses Start. Everyone has <b>15 seconds</b> to <b>join</b> or <b>watch</b>. You need at least <b>2 players</b>; more players means more pairs.'] },
        { icon: '🃏', color: '#ec4899', lobby: true,
          zh: ['怎麼翻牌', '輪到你時<b>一次翻兩張</b>，兩張是<b>同一種海兔</b>就拿下這組，還能<b>繼續翻</b>！同一回合最多連續翻對 <b>3 組</b>就換下一位。'],
          en: ['Flipping', 'On your turn, <b>flip two cards</b>. If they show the <b>same sea bunny</b>, you win the pair and <b>keep going</b>! After <b>3 pairs</b> in a row, it\'s the next player\'s turn.'] },
        { icon: '⏱️', color: '#f59e0b', lobby: true,
          zh: ['限時 30 秒', '每回合只有 <b>30 秒</b>，時間到自動換人。輪到你卻整回合沒翻牌會被警告，<b>2 次</b>就會被請出對決。'],
          en: ['30-second turns', 'Each turn is <b>30 seconds</b>, then it passes on. Skip a whole turn and you get a warning — <b>2 warnings</b> and you\'re out.'] },
        { icon: '🏆', color: '#16a34a', lobby: true,
          zh: ['誰會贏', '牌全部翻完，<b>拿最多組的人獲勝</b>！平手不算勝場，<b>贏滿 10 場</b>送小丑皮膚。其他人都離開只剩你的話，牌要翻完 <b>8 成</b>才算贏。'],
          en: ['Winning', 'When every card is matched, <b>the most pairs wins</b>! Draws don\'t count. <b>Win 10 matches</b> for the Joker skin. If everyone else leaves, you need <b>80%</b> of the cards matched to win.'] },
        { icon: '👀', color: '#7c3aed',
          zh: ['觀戰', '觀戰可以看完整局，但<b>不能翻牌</b>。想一起玩的話，下一局開局時按「<b>加入</b>」。'],
          en: ['Watching', 'Spectators can watch the whole match but <b>can\'t flip cards</b>. Want to play? Press <b>Join</b> when the next match starts.'] },
        { icon: '🚪', color: '#ef4444',
          zh: ['中途離開會被處罰', '對決中離開房間、或掛機被請出，會<b>扣積分</b>而且<b>一段時間不能進房</b>。同一天離開越多次越重：第 1 次扣 <b>50 分</b>、<b>3 分鐘</b>不能進房。'],
          en: ['Leaving early', 'Leaving mid-match (or being removed for idling) <b>costs coins</b> and <b>locks you out of rooms</b> for a while. It gets worse each time that day: the first time is <b>−50 coins</b> and <b>3 minutes</b>.'] }
    ];

    // 🏆 勝場獎勵：勝場數是後端記的（只有一位贏家、至少 2 個不同帳號才算），這裡依勝場數解鎖
    // 小丑海兔由後端在 10 勝時放進背包；卡背、服裝的選擇存在 gameState（這台裝置）
    const REWARDS = [
        { id: 'cardBack', wins: 3, icon: '🎴' },
        { id: 'joker', wins: 10, icon: '🤡' },
        { id: 'outfit', wins: 30, icon: '👑' },
        { id: 'throne', wins: 100, icon: '🏰' }
    ];
    const CARD_BACK_WINS = 3;
    // 🎴 卡背：照「心情漂流瓶」的主題（大海、漂流瓶、瓶中信、五個心情海域、海兔），樣式在 memory_game.css 的 [data-back="..."]
    // 存檔裡是舊卡背（已拿掉的）會自動回到 classic
    const CARD_BACKS = [
        { id: 'classic', zh: '海底泡泡', en: 'Sea Bubbles' },
        { id: 'bottle', zh: '漂流瓶', en: 'Drift Bottle' },
        { id: 'letter', zh: '瓶中信', en: 'Message in a Bottle' },
        { id: 'ocean', zh: '浪花朵朵', en: 'Waves' },
        { id: 'stars', zh: '夜海星光', en: 'Night Sea' },
        { id: 'sand', zh: '沙灘貝殼', en: 'Seashell Beach' },
        { id: 'mood', zh: '心情彩虹', en: 'Mood Rainbow' },
        { id: 'bunny', zh: '海兔家族', en: 'Sea Bunny Family' }
    ];

    function hasGame() { return typeof gameState !== 'undefined' && gameState; }
    function myWins() { return hasGame() ? (gameState.memoryWins || 0) : 0; }
    function myCardBack() {
        const id = hasGame() ? gameState.cardBack : 'classic';
        return myWins() >= CARD_BACK_WINS && CARD_BACKS.some((b) => b.id === id) ? id : 'classic';
    }
    function saveState() { if (typeof saveGame === 'function') saveGame(); }
    // 卡背、服裝存到伺服器，換裝置也還在（存不成功就先留在這台，下次打開會再同步）
    function saveLookToServer(kind, value) {
        if (typeof fetchAPI !== 'function' || typeof GAME_TOKEN === 'undefined' || !GAME_TOKEN) return;
        if (kind === 'cardBack') fetchAPI('/pet-games/memory-rewards/card-back', 'PUT', { cardBack: value });
        else fetchAPI('/pet-games/memory-rewards/royal-outfit', 'PUT', { outfit: value });
    }
    // 伺服器 my-pet 回來的卡背、服裝套到遊戲裡（伺服器沒存過就保留這台的）
    function applyLookFromServer(pet) {
        if (!pet || !hasGame()) return;
        if (pet.memory_card_back) gameState.cardBack = pet.memory_card_back;
        if (pet.memory_royal_outfit) gameState.outfit = pet.memory_royal_outfit;
    }

    function isEn() {
        try { return typeof currLang !== 'undefined' && currLang === 'en'; } catch (e) { return false; }
    }
    function T(key, ...args) {
        const v = (isEn() ? TEXT.en : TEXT.zh)[key];
        return typeof v === 'function' ? v(...args) : v;
    }

    // ---------- 小工具 ----------
    const $ = (id) => document.getElementById(id);

    function myId() { return boundSocket ? boundSocket.id : null; }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // 牌面：用寵物顏色畫一隻小海兔（簡化版，100 張同時畫也不會卡）
    // outfit：king / queen 會加上 slug_game.js 的 OUTFITS 披風皇冠（換裝預覽、王座動畫用）
    // jokerStyle：小丑海兔的配色 a～d（slug_game.js 的 JOKER_STYLES），會加上紅鼻子等配件
    function petSVG(colorKey, outfit, jokerStyle) {
        const isJokerSkin = colorKey === 'joker' && typeof speciesSpec === 'function';
        const spec = isJokerSkin ? speciesSpec('joker', jokerStyle)
            : ((typeof speciesData !== 'undefined' && speciesData[colorKey]) || speciesData.snow);
        const wear = outfit && typeof OUTFITS !== 'undefined' ? OUTFITS[outfit] : null;
        const skinExtra = isJokerSkin && typeof jokerExtraSVG === 'function' ? jokerExtraSVG(jokerStyle) : '';
        // 有披風、皇冠或小丑帽時畫面要大一點，才不會切到耳朵尖端和身體左邊
        const viewBox = wear || skinExtra ? '12 0 316 230' : '40 15 270 210';
        return `
            <svg viewBox="${viewBox}" aria-hidden="true">
                ${wear ? wear.back : ''}
                <g stroke="${spec.outline}" stroke-width="5" stroke-linejoin="round">
                    <path d="M 250 170 C 270 180, 300 190, 290 140 C 280 100, 250 140, 240 170 Z" fill="${spec.tail}"/>
                    <path d="M 260 150 C 290 160, 320 120, 280 80 C 260 60, 230 110, 250 150 Z" fill="${spec.tail}"/>
                    <path d="M 70 190 C 20 180, 30 120, 90 110 C 160 100, 220 105, 260 130 C 290 150, 280 200, 200 210 C 130 220, 90 200, 70 190 Z" fill="${spec.body}"/>
                    <path d="M 100 105 C 80 50, 95 20, 110 25 C 125 30, 120 90, 115 105 Z" fill="${spec.earTop}"/>
                    <path d="M 145 100 C 135 45, 160 15, 175 25 C 190 35, 165 85, 160 100 Z" fill="${spec.earTop}"/>
                </g>
                <g fill="${spec.spot}">
                    <circle cx="125" cy="125" r="5"/><circle cx="210" cy="140" r="5.5"/><circle cx="145" cy="180" r="5.5"/><circle cx="230" cy="175" r="4.5"/>
                </g>
                <g transform="translate(130, 150)">
                    <ellipse cx="-35" cy="12" rx="14" ry="8" fill="${spec.blush}" opacity="0.85"/>
                    <ellipse cx="35" cy="12" rx="14" ry="8" fill="${spec.blush}" opacity="0.85"/>
                    ${skinExtra ? '' : `<circle cx="-20" cy="0" r="8" fill="#2c3e50"/><circle cx="20" cy="0" r="8" fill="#2c3e50"/>
                    <circle cx="-17" cy="-3" r="3" fill="#fff"/><circle cx="23" cy="-3" r="3" fill="#fff"/>`}
                    <path d="M -7 5 Q 0 12 7 5" fill="none" stroke="#2c3e50" stroke-width="4" stroke-linecap="round"/>
                </g>
                ${skinExtra}
                ${wear ? wear.front : ''}
            </svg>`;
    }

    function speciesName(colorKey) {
        if (colorKey === JOKER) return T('joker');
        const spec = typeof speciesData !== 'undefined' && speciesData[colorKey];
        return spec ? (spec.name && (isEn() ? spec.name.en : spec.name.zh)) || colorKey : colorKey;
    }

    // 每種海兔專屬的「點數字＋花色符號」，像撲克牌一樣看角落就認得出來（顏色很接近的也分得開）
    const CARD_MARK = {
        snow: ['雪', '❄️'], ocean: ['海', '🌊'], matcha: ['抹', '🍡'], berry: ['草', '🍓'], choco: ['布', '🍮'],
        grape: ['薰', '🍇'], lemon: ['檸', '🍋'], sesame: ['芝', '🍘'], sakura: ['櫻', '🌸'], peachSlug: ['桃', '🍑'],
        banana: ['蕉', '🍌'], blueberry: ['莓', '🫐'], avocado: ['酪', '🥑'], mint: ['薄', '🌿'], springBlossom: ['春', '🌷'],
        summerBreeze: ['風', '🎐'], autumnMaple: ['楓', '🍁'], winterSnow: ['冬', '⛄'], taro: ['芋', '🍠'], papaya: ['木', '🧡'],
        watermelon: ['西', '🍉'], kiwi: ['奇', '🥝'], dragonfruit: ['果', '🌺'], mango: ['芒', '🥭'], ruby: ['紅', '❤️'],
        sapphire: ['藍', '🔷'], emeraldSlug: ['翠', '🍀'], amethyst: ['紫', '🔮'], topaz: ['托', '🔶'], coconut: ['椰', '🥥'],
        galaxy: ['宇', '🌌'], jade: ['玉', '🍃'], macaron: ['馬', '🍬'], cottonCandy: ['棉', '☁️'], puddingCaramel: ['燒', '🧁'],
        matchaLatte: ['拿', '🍵'], obsidian: ['曜', '🖤'], sunset: ['霞', '🌅'], pearl: ['珠', '🦪'], halloweenBat: ['蝠', '🦇'],
        christmasTree: ['誕', '🎄'], valentineRose: ['玫', '🌹'], newYearTiger: ['虎', '🐯'], amber: ['琥', '🍂'], coffee: ['啡', '☕'],
        coralSlug: ['珊', '🐚'], ghost: ['靈', '👻'], unicorn: ['獨', '🦄'], frost: ['冰', '🧊'], storm: ['雷', '⚡'],
        phoenix: ['羽', '🔥'], magma: ['熔', '🌋'], dragonSlug: ['龍', '🐉'], starlight: ['星', '🌠'], nebula: ['雲', '✨'],
        eclipse: ['蝕', '🌑'], gold: ['金', '💰'], abyssSlug: ['淵', '🦑']
    };

    // 牌的主色：耳朵是白色系的話太淡，改用描邊色
    function cardMainColor(spec) {
        const n = parseInt(String(spec.earTop).slice(1), 16);
        const lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
        return lum > 0.8 ? spec.outline : spec.earTop;
    }

    // 牌面：主色外框＋雙框＋圓形徽章＋底部名牌，左上角是點數字和符號
    function cardFaceHTML(face) {
        if (face === JOKER) {
            const value = (state && state.jokerValue) || 3;
            return '<div class="mg-face is-joker" style="--c:#7c3aed;--o:#3b0764;--bg:#faf5ff">'
                + '<div class="mg-idx"><b>' + T('jokerMark') + '</b><i>🃏</i></div>'
                + '<div class="mg-medal"><span class="mg-joker-icon">🃏</span></div>'
                + '<div class="mg-ribbon">' + T('jokerRibbon', value) + '</div></div>';
        }
        const spec = (typeof speciesData !== 'undefined' && speciesData[face]) || speciesData.snow;
        const mark = CARD_MARK[face] || [speciesName(face).slice(0, 1), '⭐'];
        const wrap = document.createElement('div');
        wrap.className = 'mg-face';
        wrap.style.cssText = '--c:' + cardMainColor(spec) + ';--o:' + spec.outline + ';--bg:' + spec.body;
        wrap.innerHTML = '<div class="mg-idx"><b></b><i></i></div><div class="mg-medal">' + petSVG(face) + '</div><div class="mg-ribbon"></div>';
        // 英文模式牌角只放符號（中文字看不懂；58 個符號都不一樣，一樣認得出來）
        wrap.querySelector('.mg-idx b').textContent = isEn() ? mark[1] : mark[0];
        wrap.querySelector('.mg-idx i').textContent = isEn() ? '' : mark[1];
        wrap.querySelector('.mg-ribbon').textContent = speciesName(face);
        return wrap.outerHTML;
    }

    // 把一張牌翻成正面（face = 寵物顏色 key 或 joker）
    function showFace(index, face) {
        const card = document.querySelector(`.mg-card[data-index="${index}"]`);
        if (!card) return;
        const front = card.querySelector('.mg-front');
        if (card.dataset.face !== face) {
            card.dataset.face = face;
            front.innerHTML = cardFaceHTML(face);
            front.title = speciesName(face);
        }
        card.classList.add('is-flipped');
    }

    function hideFace(index) {
        const card = document.querySelector(`.mg-card[data-index="${index}"]`);
        if (card && !card.classList.contains('is-matched')) card.classList.remove('is-flipped');
    }

    function markMatched(index, by) {
        const card = document.querySelector(`.mg-card[data-index="${index}"]`);
        if (!card) return;
        card.classList.add('is-matched', 'is-flipped');
        card.classList.toggle('is-mine', by === myId());
    }

    // ---------- 畫面 ----------
    function ensureOverlay() {
        let overlay = $('memoryGameOverlay');
        if (overlay) return overlay;

        overlay = el('div', 'mg-overlay');
        overlay.id = 'memoryGameOverlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="mg-panel" role="dialog" data-t-aria="title">
                <div class="mg-header">
                    <div class="mg-title" data-t="title"></div>
                    <div class="mg-header-btns">
                        <!-- 📖 玩法教學：等待、對局、觀戰、結算都按得到，打開不會暫停對局 -->
                        <button type="button" class="mg-rules-btn" id="mgRulesBtn" aria-haspopup="dialog"><span aria-hidden="true">📖</span><span data-t="rulesBtn"></span></button>
                        <button type="button" class="mg-close" id="mgClose" data-t-title="closeTip">✕</button>
                    </div>
                </div>

                <div class="mg-lobby" id="mgLobby">
                    <div class="mg-hero">
                        <div class="mg-hero-cards" aria-hidden="true"><i>🫧</i><i>🃏</i><i>🫧</i></div>
                        <h2 class="mg-hero-title" data-t="heroTitle"></h2>
                        <p class="mg-hero-sub" data-t="heroSub"></p>
                    </div>
                    <!-- 🏆 勝場獎勵：3／10／30／100 勝，解鎖了就有按鈕可以用 -->
                    <section class="mg-rewards" id="mgRewards" aria-labelledby="mgRewardsTitle">
                        <div class="mg-rewards-head">
                            <span class="mg-rewards-title" id="mgRewardsTitle" data-t="rewardsTitle"></span>
                            <span class="mg-wins" id="mgWins"></span>
                        </div>
                        <div class="mg-rewards-bar"><i id="mgRewardsBar"></i></div>
                        <div class="mg-rewards-next" id="mgRewardsNext"></div>
                        <div class="mg-reward-list" id="mgRewardList"></div>
                    </section>
                    <div class="mg-rule-cards" id="mgLobbyRules"></div>
                    <div class="mg-lobby-links">
                        <button type="button" class="mg-album-open" id="mgAlbumOpen"><span data-t="albumOpen"></span><small data-t="albumOpenSub"></small></button>
                        <button type="button" class="mg-rules-more" id="mgRulesMore" data-t="rulesFull"></button>
                    </div>
                    <div class="mg-host-only" id="mgHostControls">
                        <div class="mg-label" data-t="pickPairs"></div>
                        <div class="mg-pairs" id="mgPairs"></div>
                        <button type="button" class="mg-start" id="mgStart" data-t="start"></button>
                    </div>
                    <p class="mg-wait" id="mgWait" data-t="wait"></p>
                </div>

                <div class="mg-game" id="mgGame" hidden>
                    <div class="mg-scores" id="mgScores"></div>
                    <div class="mg-status" id="mgStatus"></div>
                    <div class="mg-board-wrap" id="mgBoardWrap"><div class="mg-board" id="mgBoard"></div></div>
                </div>

                <div class="mg-result" id="mgResult" hidden></div>

                <!-- 📖 卡牌圖鑑：活頁小卡冊，一頁四張，可以翻頁 -->
                <div class="mg-album" id="mgAlbum" hidden>
                    <div class="mg-album-bar">
                        <button type="button" class="mg-album-back" id="mgAlbumBack" data-t="back"></button>
                        <span class="mg-album-title" data-t="albumTitle"></span>
                        <span class="mg-album-count" id="mgAlbumCount"></span>
                    </div>
                    <div class="mg-album-stage">
                        <button type="button" class="mg-album-nav prev" id="mgAlbumPrev" data-t-aria="prev">‹</button>
                        <div class="mg-book" id="mgBook">
                            <div class="mg-rings" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                            <div class="mg-page" id="mgPage"></div>
                        </div>
                        <button type="button" class="mg-album-nav next" id="mgAlbumNext" data-t-aria="next">›</button>
                    </div>
                    <div class="mg-album-foot"><span id="mgAlbumPageNo"></span><span class="mg-album-hint" data-t="albumHint"></span></div>
                </div>

                <!-- 📖 玩法教學面板：蓋在牌桌上（電腦在右邊、手機從下面滑上來），對局照常進行 -->
                <div class="mg-rules-sheet" id="mgRulesSheet" hidden>
                    <div class="mg-rules-card" role="dialog" aria-labelledby="mgRulesTitle">
                        <div class="mg-rules-head">
                            <span class="mg-rules-title" id="mgRulesTitle" data-t="rulesTitle"></span>
                            <button type="button" class="mg-close" id="mgRulesX" data-t-aria="rulesClose">✕</button>
                        </div>
                        <div class="mg-rules-live" id="mgRulesLive" hidden>
                            <div class="mg-rules-live-status" id="mgRulesLiveStatus"></div>
                            <div class="mg-rules-live-note" data-t="rulesLiveNote"></div>
                        </div>
                        <div class="mg-rules-list" id="mgRulesList"></div>
                        <button type="button" class="mg-start mg-rules-done" id="mgRulesDone"></button>
                    </div>
                </div>

                <!-- 🎴 選卡背／👑 換裝／🎉 解鎖獎勵：跟玩法教學面板同一種樣子 -->
                <div class="mg-rules-sheet mg-pick-sheet" id="mgPickSheet" hidden>
                    <div class="mg-rules-card mg-pick-card" role="dialog" aria-labelledby="mgPickTitle">
                        <div class="mg-rules-head">
                            <span class="mg-rules-title" id="mgPickTitle"></span>
                            <button type="button" class="mg-close" id="mgPickX" aria-label="✕">✕</button>
                        </div>
                        <div class="mg-pick-body" id="mgPickBody"></div>
                        <button type="button" class="mg-start mg-rules-done" id="mgPickDone"></button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        applyStaticText();

        $('mgClose').addEventListener('click', closeOverlay);
        bindAlbum();
        bindRules();
        bindPick();

        let selectedPairs = 20;
        const pairsBox = $('mgPairs');
        PAIR_OPTIONS.forEach((n) => {
            const btn = el('button', 'mg-pair-btn' + (n === selectedPairs ? ' is-active' : ''), T('pairs', n));
            btn.type = 'button';
            btn.dataset.pairs = n;
            btn.addEventListener('click', () => {
                selectedPairs = n;
                pairsBox.querySelectorAll('.mg-pair-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
            });
            pairsBox.appendChild(btn);
        });
        $('mgStart').addEventListener('click', () => {
            if (!boundSocket) return;
            boundSocket.emit('memory_start', { pairs: selectedPairs });
        });

        // 點牌：用事件委派，100 張牌也只掛一個監聽
        $('mgBoard').addEventListener('click', (e) => {
            const card = e.target.closest('.mg-card');
            if (!card || !state || !boundSocket) return;
            if (isSpectator()) { showFloatText(T('watchingNoFlip')); return; }
            if (state.turn !== myId()) { showFloatText(T('notYourTurn')); return; }
            if (card.classList.contains('is-flipped')) return;
            boundSocket.emit('memory_flip', { index: Number(card.dataset.index) });
        });

        window.addEventListener('resize', layoutBoard);
        return overlay;
    }

    // ---------- 📖 玩法教學（規則面板） ----------
    // 只是蓋在牌桌上的一層，不碰 state、不送任何東西給伺服器，所以打開也不會影響對局
    function renderRuleCards(box, rules) {
        box.innerHTML = '';
        rules.forEach((r) => {
            const [title, html] = isEn() ? r.en : r.zh;
            const card = el('div', 'mg-rule');
            card.style.setProperty('--rc', r.color);
            const icon = el('span', 'mg-rule-icon', r.icon);
            icon.setAttribute('aria-hidden', 'true');
            const body = el('div', 'mg-rule-body');
            body.appendChild(el('div', 'mg-rule-title', title));
            const text = el('p', 'mg-rule-text');
            text.innerHTML = html;   // 內容是上面寫死的規則，不是玩家輸入
            body.appendChild(text);
            card.appendChild(icon);
            card.appendChild(body);
            box.appendChild(card);
        });
    }

    function isRulesOpen() {
        const sheet = $('mgRulesSheet');
        return !!(sheet && !sheet.hidden);
    }

    function openRules() {
        renderRuleCards($('mgRulesList'), RULES);
        renderRulesLive();
        $('mgRulesSheet').hidden = false;
        $('mgRulesList').scrollTop = 0;
        $('mgRulesBtn').classList.add('is-open');
        $('mgRulesDone').focus({ preventScroll: true });
    }

    function closeRules() {
        const sheet = $('mgRulesSheet');
        if (!sheet || sheet.hidden) return;
        sheet.hidden = true;
        $('mgRulesBtn').classList.remove('is-open');
    }

    // 對局中打開規則：上面顯示現在輪到誰、剩幾秒，輪到自己一眼就看得到
    function renderRulesLive() {
        const live = $('mgRulesLive');
        if (!live) return;
        $('mgRulesDone').textContent = state ? T('rulesBack') : T('rulesClose');
        live.hidden = !state;
        if (!state) return;
        const status = $('mgStatus');
        $('mgRulesLiveStatus').textContent = status ? status.textContent : '';
        live.classList.toggle('is-mine', state.turn === myId() && !isSpectator());
    }

    function bindRules() {
        $('mgRulesBtn').addEventListener('click', () => (isRulesOpen() ? closeRules() : openRules()));
        $('mgRulesMore').addEventListener('click', openRules);
        $('mgRulesX').addEventListener('click', closeRules);
        $('mgRulesDone').addEventListener('click', closeRules);
        // 點面板外面（半透明的地方）也能關
        $('mgRulesSheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRules(); });
        // Esc 先關規則面板（用 capture 搶在圖鑑的 Esc 前面）
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !isRulesOpen()) return;
            const overlay = $('memoryGameOverlay');
            if (!overlay || overlay.hidden) return;
            e.stopImmediatePropagation();
            closeRules();
        }, true);
    }

    // ---------- 🏆 勝場獎勵 ----------
    function applyCardBack() {
        const board = $('mgBoard');
        if (board) board.dataset.back = myCardBack();
    }

    // 勝場數：已經跟伺服器拿過就用那個，不然用遊戲啟動時同步的 gameState.memoryWins
    function knownWins() {
        if (typeof lastWins === 'number') return lastWins;
        return hasGame() && (typeof GAME_TOKEN === 'undefined' || GAME_TOKEN) ? myWins() : null;
    }

    function rewardName(id) { return T('reward_' + id); }

    function renderRewards() {
        const list = $('mgRewardList');
        if (!list) return;
        const w = knownWins();
        $('mgWins').textContent = w === null ? T('winsUnknown') : T('winsNow', w);

        // 進度條：從上一個里程碑到下一個里程碑
        const next = REWARDS.find((r) => (w || 0) < r.wins);
        const prevWins = [...REWARDS].reverse().find((r) => (w || 0) >= r.wins)?.wins || 0;
        const pct = next ? (((w || 0) - prevWins) / (next.wins - prevWins)) * 100 : 100;
        $('mgRewardsBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
        $('mgRewardsNext').textContent = next ? T('nextGoal', next.wins - (w || 0), rewardName(next.id)) : T('allDone');

        list.innerHTML = '';
        REWARDS.forEach((r) => {
            const unlocked = (w || 0) >= r.wins;
            const tile = el('div', 'mg-reward ' + (unlocked ? 'is-unlocked' : 'is-locked'));
            tile.dataset.reward = r.id;
            const icon = el('span', 'mg-reward-icon', unlocked ? r.icon : '🔒');
            icon.setAttribute('aria-hidden', 'true');
            tile.appendChild(icon);
            tile.appendChild(el('span', 'mg-reward-need', T('winsNeed', r.wins)));
            tile.appendChild(el('span', 'mg-reward-name', rewardName(r.id)));
            tile.appendChild(el('span', 'mg-reward-sub', T('rewardSub_' + r.id)));
            if (!unlocked) {
                tile.appendChild(el('span', 'mg-reward-lock', T('lockedLeft', r.wins - (w || 0))));
            } else {
                const wearing = r.id === 'joker' && hasGame() && gameState.currentSpecies === 'joker';
                const btn = el('button', 'mg-reward-btn', wearing ? T('act_jokerOn') : T('act_' + r.id));
                btn.type = 'button';
                btn.addEventListener('click', () => rewardAction(r.id));
                tile.appendChild(btn);
            }
            list.appendChild(tile);
        });
    }

    function rewardAction(id) {
        if (id === 'cardBack') openPick('cardBack');
        else if (id === 'outfit') openPick('outfit');
        else if (id === 'joker') openPick('joker');
        else if (id === 'throne') playThrone();
    }

    // 小丑海兔：後端 10 勝時已經放進背包，這裡確保本機清單也有，然後直接穿上（equipItem 會通知伺服器）
    function ensureJokerOwned() {
        if (!hasGame() || myWins() < 10 || typeof speciesData === 'undefined' || !speciesData.joker) return;
        if (!gameState.unlockedSpecies.includes('joker')) {
            gameState.unlockedSpecies.push('joker');
            saveState();
            if (typeof renderShop === 'function') renderShop();
        }
    }
    // 選一種配色並穿上（還沒穿小丑海兔的話順便換上，equipItem 會通知伺服器）
    function wearJoker(style) {
        ensureJokerOwned();
        if (hasGame()) { gameState.jokerStyle = style; saveState(); }
        const already = hasGame() && gameState.currentSpecies === 'joker';
        if (!already && typeof equipItem === 'function') equipItem('joker', 'species');
        else if (typeof refreshAll === 'function') refreshAll();
        if (!already) showFloatText(T('jokerWorn'));
        renderRewards();
    }
    // 記分板上每個人的小丑配色：自己看 gameState，別人看進房時帶來的 playerData
    function jokerStyleOfPlayer(socketId) {
        if (socketId === myId()) return hasGame() ? gameState.jokerStyle : null;
        const p = typeof otherPlayersData !== 'undefined' ? otherPlayersData[socketId] : null;
        return p ? p.jokerStyle : null;
    }

    // ---------- 🎴 選卡背／👑 換裝／🎉 解鎖通知（同一個面板） ----------
    let pickMode = null;   // 'cardBack' | 'outfit' | 'unlock:cardBack' ...

    function isPickOpen() {
        const sheet = $('mgPickSheet');
        return !!(sheet && !sheet.hidden);
    }
    function openPick(mode) {
        ensureOverlay().hidden = false;
        closeRules();
        pickMode = mode;
        renderPick();
        $('mgPickSheet').hidden = false;
        $('mgPickBody').scrollTop = 0;
        $('mgPickDone').focus({ preventScroll: true });
    }
    function closePick() {
        const sheet = $('mgPickSheet');
        if (sheet) sheet.hidden = true;
        pickMode = null;
    }

    function renderPick() {
        const body = $('mgPickBody');
        if (!body || !pickMode) return;
        body.innerHTML = '';
        const done = $('mgPickDone');
        $('mgPickX').setAttribute('aria-label', T('rulesClose'));

        if (pickMode === 'cardBack') {
            $('mgPickTitle').textContent = T('cardBackTitle');
            body.appendChild(el('p', 'mg-pick-hint', T('cardBackHint')));
            const grid = el('div', 'mg-pick-grid is-backs');
            const current = myCardBack();
            CARD_BACKS.forEach((b) => {
                const opt = el('button', 'mg-pick-opt' + (b.id === current ? ' is-active' : ''));
                opt.type = 'button';
                opt.setAttribute('aria-pressed', b.id === current);
                const sample = el('div', 'mg-back-sample');
                sample.dataset.back = b.id;
                sample.appendChild(el('div', 'mg-back'));
                opt.appendChild(sample);
                opt.appendChild(el('span', 'mg-pick-name', isEn() ? b.en : b.zh));
                if (b.id === current) opt.appendChild(el('span', 'mg-pick-using', T('using')));
                opt.addEventListener('click', () => {
                    gameState.cardBack = b.id;
                    saveState();
                    saveLookToServer('cardBack', b.id);
                    applyCardBack();
                    renderPick();
                });
                grid.appendChild(opt);
            });
            body.appendChild(grid);
            done.textContent = T('pickDone');
            return;
        }

        if (pickMode === 'joker') {
            $('mgPickTitle').textContent = T('jokerTitle');
            body.appendChild(el('p', 'mg-pick-hint', T('jokerHint')));
            if (typeof currentRoomId !== 'undefined' && currentRoomId) body.appendChild(el('p', 'mg-pick-note', T('outfitRoomNote')));
            const grid = el('div', 'mg-pick-grid is-jokers');
            const wearing = hasGame() && gameState.currentSpecies === 'joker';
            const current = wearing && typeof jokerStyleOf === 'function' ? jokerStyleOf(gameState.jokerStyle) : null;
            const outfit = typeof activeOutfit === 'function' && activeOutfit() !== 'none' ? activeOutfit() : null;
            Object.keys(typeof JOKER_STYLES !== 'undefined' ? JOKER_STYLES : {}).forEach((style) => {
                const opt = el('button', 'mg-pick-opt' + (style === current ? ' is-active' : ''));
                opt.type = 'button';
                opt.setAttribute('aria-pressed', style === current);
                const pic = el('div', 'mg-outfit-sample');
                pic.innerHTML = petSVG('joker', outfit, style);
                opt.appendChild(pic);
                opt.appendChild(el('span', 'mg-pick-name', JOKER_STYLES[style].name[isEn() ? 'en' : 'zh']));
                if (style === current) opt.appendChild(el('span', 'mg-pick-using', T('using')));
                opt.addEventListener('click', () => { wearJoker(style); renderPick(); });
                grid.appendChild(opt);
            });
            body.appendChild(grid);
            done.textContent = T('pickDone');
            return;
        }

        if (pickMode === 'outfit') {
            $('mgPickTitle').textContent = T('outfitTitle');
            body.appendChild(el('p', 'mg-pick-hint', T('outfitHint')));
            if (typeof currentRoomId !== 'undefined' && currentRoomId) body.appendChild(el('p', 'mg-pick-note', T('outfitRoomNote')));
            const grid = el('div', 'mg-pick-grid is-outfits');
            const current = typeof activeOutfit === 'function' ? activeOutfit() : 'none';
            const species = hasGame() ? gameState.currentSpecies : 'snow';
            ['king', 'queen', 'none'].forEach((kind) => {
                const opt = el('button', 'mg-pick-opt' + (kind === current ? ' is-active' : ''));
                opt.type = 'button';
                opt.setAttribute('aria-pressed', kind === current);
                const pic = el('div', 'mg-outfit-sample');
                pic.innerHTML = petSVG(species, kind === 'none' ? null : kind, gameState.jokerStyle);
                opt.appendChild(pic);
                const name = kind === 'none' ? T('outfitNone') : (OUTFITS[kind].name[isEn() ? 'en' : 'zh']);
                opt.appendChild(el('span', 'mg-pick-name', name));
                if (kind === current) opt.appendChild(el('span', 'mg-pick-using', T('using')));
                opt.addEventListener('click', () => {
                    gameState.outfit = kind;
                    saveState();
                    saveLookToServer('outfit', kind);
                    if (typeof applyOutfit === 'function') applyOutfit();
                    renderPick();
                });
                grid.appendChild(opt);
            });
            body.appendChild(grid);
            done.textContent = T('pickDone');
            return;
        }

        // 🎉 剛解鎖：大圖示＋一句話，按鈕直接去用
        const id = pickMode.split(':')[1];
        const r = REWARDS.find((x) => x.id === id);
        $('mgPickTitle').textContent = T('unlockTitle');
        const hero = el('div', 'mg-unlock');
        hero.appendChild(el('div', 'mg-unlock-icon', r ? r.icon : '🎉'));
        hero.appendChild(el('div', 'mg-unlock-name', rewardName(id)));
        hero.appendChild(el('p', 'mg-unlock-text', T('unlock_' + id)));
        const later = el('button', 'mg-unlock-later', T('unlockLater'));
        later.type = 'button';
        later.addEventListener('click', closePick);
        hero.appendChild(later);
        body.appendChild(hero);
        done.textContent = T('act_' + id);
    }

    function bindPick() {
        $('mgPickX').addEventListener('click', closePick);
        $('mgPickSheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) closePick(); });
        $('mgPickDone').addEventListener('click', () => {
            if (pickMode && pickMode.startsWith('unlock:')) {
                const id = pickMode.split(':')[1];
                closePick();
                rewardAction(id);
            } else {
                closePick();
            }
            renderRewards();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !isPickOpen()) return;
            e.stopImmediatePropagation();
            closePick();
        }, true);
    }

    // 後端記好勝場後通知（只有贏家收得到）：更新勝場、剛好到里程碑就跳解鎖通知，100 勝播王座動畫
    function onWinRecorded(wins) {
        if (typeof wins !== 'number') return;
        lastWins = wins;
        if (hasGame()) { gameState.memoryWins = wins; saveState(); }
        ensureJokerOwned();
        if (typeof applyOutfit === 'function') applyOutfit();
        renderRewards();
        const hit = REWARDS.find((r) => r.wins === wins);
        if (!hit) return;
        // 結算畫面先出來，等一下再跳
        setTimeout(() => {
            if (hit.id === 'throne') playThrone();
            else openPick('unlock:' + hit.id);
        }, 1200);
    }

    // ---------- 🏰 100 勝：登上王座 ----------
    function playThrone() {
        const old = $('mgThrone');
        if (old) old.remove();
        const species = hasGame() ? gameState.currentSpecies : 'snow';
        const outfit = typeof activeOutfit === 'function' && activeOutfit() !== 'none' ? activeOutfit() : 'king';

        const box = el('div', 'mg-throne');
        box.id = 'mgThrone';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-labelledby', 'mgThroneTitle');
        box.innerHTML = `
            <div class="mg-throne-rays" aria-hidden="true"></div>
            <div class="mg-throne-stage" aria-hidden="true">
                <div class="mg-throne-carpet"></div>
                <svg class="mg-throne-chair" viewBox="0 0 200 220">
                    <path d="M40 34 Q100 -6 160 34 L160 150 L40 150 Z" fill="#facc15" stroke="#a16207" stroke-width="6" stroke-linejoin="round"/>
                    <path d="M58 48 Q100 20 142 48 L142 140 L58 140 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="4" stroke-linejoin="round"/>
                    <circle cx="100" cy="24" r="10" fill="#ef4444" stroke="#a16207" stroke-width="4"/>
                    <rect x="40" y="168" width="18" height="44" rx="6" fill="#facc15" stroke="#a16207" stroke-width="5"/>
                    <rect x="142" y="168" width="18" height="44" rx="6" fill="#facc15" stroke="#a16207" stroke-width="5"/>
                    <rect x="12" y="100" width="32" height="64" rx="10" fill="#fbbf24" stroke="#a16207" stroke-width="5"/>
                    <rect x="156" y="100" width="32" height="64" rx="10" fill="#fbbf24" stroke="#a16207" stroke-width="5"/>
                    <rect x="24" y="142" width="152" height="30" rx="12" fill="#facc15" stroke="#a16207" stroke-width="6"/>
                    <rect x="40" y="132" width="120" height="16" rx="8" fill="#ef4444" stroke="#7f1d1d" stroke-width="4"/>
                </svg>
                <div class="mg-throne-pet">${petSVG(species, outfit, hasGame() ? gameState.jokerStyle : null)}</div>
                <div class="mg-throne-flash"></div>
                <div class="mg-throne-confetti"></div>
            </div>
            <div class="mg-throne-text">
                <h2 class="mg-throne-title" id="mgThroneTitle"></h2>
                <p class="mg-throne-sub"></p>
                <button type="button" class="mg-start mg-throne-btn"></button>
            </div>
            <div class="mg-throne-skip"></div>`;
        box.querySelector('.mg-throne-title').textContent = T('throneTitle');
        box.querySelector('.mg-throne-sub').textContent = T('throneSub');
        box.querySelector('.mg-throne-btn').textContent = T('throneBtn');
        box.querySelector('.mg-throne-skip').textContent = T('throneSkip');

        // 彩帶：位置、顏色、轉速都隨機
        const confetti = box.querySelector('.mg-throne-confetti');
        const colors = ['#f472b6', '#facc15', '#60a5fa', '#34d399', '#c084fc', '#fb923c'];
        for (let i = 0; i < 32; i++) {
            const bit = el('i');
            bit.style.setProperty('--x', (Math.random() * 220 - 110).toFixed(0) + '%');
            bit.style.setProperty('--y', (Math.random() * -160 - 40).toFixed(0) + '%');
            bit.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
            bit.style.setProperty('--d', (Math.random() * 0.3).toFixed(2) + 's');
            bit.style.background = colors[i % colors.length];
            confetti.appendChild(bit);
        }

        let finished = false;
        const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
        const finish = () => { finished = true; box.classList.add('is-done'); box.querySelector('.mg-throne-btn').focus({ preventScroll: true }); };
        const timer = setTimeout(finish, 4400);
        // 播放中點一下：直接跳到最後（坐上王座＋文字）
        box.addEventListener('click', (e) => {
            if (finished) return;
            if (e.target.closest('.mg-throne-btn')) return;
            clearTimeout(timer);
            box.classList.add('is-skip');
            finish();
        });
        box.querySelector('.mg-throne-btn').addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(box);
        if (typeof playDingSound === 'function') playDingSound(3);
    }

    // ---------- 📖 卡牌圖鑑（活頁小卡冊） ----------
    const ALBUM_PER_PAGE = 4;
    const ALBUM_VIEWS = ['mgLobby', 'mgGame', 'mgResult'];
    let albumPage = 0;
    let albumTurning = false;
    let albumQueued = 0;             // 翻頁動畫中又按了幾下，翻完接著翻
    let albumReturnTo = 'mgLobby';   // 關掉圖鑑後回到哪個畫面

    function albumFaces() {
        // 勝場獎勵的皮膚（小丑海兔，key 剛好也叫 joker）不是牌，不放進圖鑑
        const keys = typeof speciesData !== 'undefined' ? Object.keys(speciesData).filter((k) => !speciesData[k].rewardWins) : [];
        return keys.concat([JOKER]);
    }
    function albumPageCount() { return Math.ceil(albumFaces().length / ALBUM_PER_PAGE); }

    function openAlbum() {
        albumReturnTo = ALBUM_VIEWS.find((id) => !$(id).hidden) || 'mgLobby';
        ALBUM_VIEWS.forEach((id) => { $(id).hidden = true; });
        $('mgAlbum').hidden = false;
        $('mgAlbumCount').textContent = T('albumCount', albumFaces().length);
        renderAlbumPage();
    }

    function closeAlbum() {
        const album = $('mgAlbum');
        if (!album || album.hidden) return;
        album.hidden = true;
        albumQueued = 0;
        $(albumReturnTo).hidden = false;
        if (albumReturnTo === 'mgGame') layoutBoard();
    }

    function isAlbumOpen() {
        const album = $('mgAlbum');
        const overlay = $('memoryGameOverlay');
        return !!(album && !album.hidden && overlay && !overlay.hidden);
    }

    function renderAlbumPage() {
        const page = $('mgPage');
        const faces = albumFaces();
        const total = albumPageCount();
        albumPage = Math.max(0, Math.min(total - 1, albumPage));
        page.innerHTML = '';
        faces.slice(albumPage * ALBUM_PER_PAGE, (albumPage + 1) * ALBUM_PER_PAGE).forEach((face, i) => {
            const slot = el('div', 'mg-slot');
            const sleeve = el('div', 'mg-sleeve');
            sleeve.innerHTML = cardFaceHTML(face);
            slot.appendChild(sleeve);
            const mark = face === JOKER ? [T('jokerMark'), '🃏'] : (CARD_MARK[face] || ['', '']);
            const label = el('div', 'mg-slot-label');
            label.appendChild(el('span', 'mg-slot-no', 'No.' + String(albumPage * ALBUM_PER_PAGE + i + 1).padStart(2, '0')));
            label.appendChild(el('span', 'mg-slot-name', face === JOKER ? T('jokerSlot', (state && state.jokerValue) || 3) : speciesName(face)));
            label.appendChild(el('span', 'mg-slot-mark', isEn() && face !== JOKER ? mark[1] : mark[0] + mark[1]));
            slot.appendChild(label);
            page.appendChild(slot);
        });
        // 最後一頁不滿四張：補空卡套，版面才不會跳
        for (let k = page.children.length; k < ALBUM_PER_PAGE; k++) {
            const slot = el('div', 'mg-slot is-empty');
            slot.appendChild(el('div', 'mg-sleeve'));
            slot.appendChild(el('div', 'mg-slot-label'));
            page.appendChild(slot);
        }
        $('mgAlbumPageNo').textContent = T('albumPageNo', albumPage + 1, total);
        $('mgAlbumPrev').disabled = albumPage === 0;
        $('mgAlbumNext').disabled = albumPage >= total - 1;
        layoutAlbum();
    }

    // 卡套大小跟著畫面算：兩欄兩列，牌是 4:5，下面留名字的位置
    function layoutAlbum() {
        const page = $('mgPage');
        if (!page || $('mgAlbum').hidden) return;
        const cs = getComputedStyle(page);
        const W = page.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const H = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const LABEL = 40, GAP_X = 16, GAP_Y = 12;
        // 一頁四張：直的畫面排 2×2，寬扁的畫面（橫向手機）排 4×1，挑牌比較大的那種
        const grid = Math.min((W - GAP_X) / 2, ((H - GAP_Y) / 2 - LABEL) * 0.8);
        const row = Math.min((W - GAP_X * 3) / 4, (H - LABEL) * 0.8);
        const cols = row > grid ? 4 : 2;
        const w = Math.floor(Math.max(40, Math.max(grid, row)));
        page.style.setProperty('--album-cols', cols);
        page.style.setProperty('--mg-w', w);
        page.style.setProperty('--slot-w', w + 'px');
    }

    // 翻頁：整頁像書頁一樣翻過去，翻到一半換內容，再翻回來
    function turnAlbum(dir) {
        const next = albumPage + dir;
        if (albumTurning) { albumQueued += dir; return; }
        if (next < 0 || next >= albumPageCount()) return;
        const page = $('mgPage');
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            albumPage = next;
            renderAlbumPage();
            return;
        }
        albumTurning = true;
        page.classList.add(dir > 0 ? 'turn-out-next' : 'turn-out-prev');
        setTimeout(() => {
            albumPage = next;
            renderAlbumPage();
            page.classList.remove('turn-out-next', 'turn-out-prev');
            page.classList.add(dir > 0 ? 'turn-in-next' : 'turn-in-prev');
            setTimeout(() => {
                page.classList.remove('turn-in-next', 'turn-in-prev');
                albumTurning = false;
                if (albumQueued) {
                    const step = albumQueued > 0 ? 1 : -1;
                    albumQueued -= step;
                    turnAlbum(step);
                }
            }, 220);
        }, 220);
    }

    function bindAlbum() {
        $('mgAlbumOpen').addEventListener('click', openAlbum);
        $('mgAlbumBack').addEventListener('click', closeAlbum);
        $('mgAlbumPrev').addEventListener('click', () => turnAlbum(-1));
        $('mgAlbumNext').addEventListener('click', () => turnAlbum(1));
        // 手機：左右滑動翻頁
        const book = $('mgBook');
        let startX = null;
        let startY = 0;
        book.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
        book.addEventListener('pointerup', (e) => {
            if (startX === null) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            startX = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) turnAlbum(dx < 0 ? 1 : -1);
        });
        book.addEventListener('pointercancel', () => { startX = null; });
        // 電腦：方向鍵翻頁，Esc 回去
        document.addEventListener('keydown', (e) => {
            if (!isAlbumOpen()) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); turnAlbum(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); turnAlbum(-1); }
            else if (e.key === 'Escape') closeAlbum();
        });
        window.addEventListener('resize', layoutAlbum);
    }

    function openOverlay() {
        ensureOverlay().hidden = false;
        if (state) { showGame(); layoutBoard(); return; }
        showLobby();
        // 中途進房的人：問伺服器有沒有對決正在進行，有的話會收到 memory_state 直接切到盤面
        if (boundSocket) boundSocket.emit('memory_sync');
    }

    function closeOverlay() {
        const overlay = $('memoryGameOverlay');
        if (overlay) overlay.hidden = true;
    }

    async function showLobby() {
        $('mgLobby').hidden = false;
        $('mgGame').hidden = true;
        $('mgResult').hidden = true;
        $('mgAlbum').hidden = true;   // 對決開始、結束時圖鑑自動收起來
        $('mgHostControls').hidden = !isRoomHost;
        $('mgWait').hidden = !!isRoomHost;
        renderRuleCards($('mgLobbyRules'), RULES.filter((r) => r.lobby));
        $('mgLobby').scrollTop = 0;
        if (isRulesOpen()) renderRulesLive();

        // 先用遊戲啟動時同步的勝場畫出來，再跟伺服器拿最新的
        lastWins = null;
        ensureJokerOwned();
        renderRewards();
        if (typeof fetchAPI === 'function' && GAME_TOKEN) {
            const pet = await fetchAPI('/pet-games/my-pet', 'GET');
            const wins = pet && (pet.memory_wins ?? (pet.data && pet.data.memory_wins));
            if (typeof wins === 'number') {
                lastWins = wins;
                applyLookFromServer(pet.memory_wins !== undefined ? pet : pet.data);
                if (hasGame()) { gameState.memoryWins = wins; saveState(); }
                ensureJokerOwned();
                if (typeof applyOutfit === 'function') applyOutfit();
                renderRewards();
            }
        }
    }

    function showGame() {
        $('mgLobby').hidden = true;
        $('mgResult').hidden = true;
        $('mgAlbum').hidden = true;
        $('mgGame').hidden = false;
    }

    // 依畫面大小決定幾欄，讓牌盡量大又不用捲動
    function layoutBoard() {
        const wrap = $('mgBoardWrap');
        const board = $('mgBoard');
        if (!wrap || !board || !state) return;
        const n = state.cardCount;
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        const GAP = 6, RATIO = 0.8; // 牌的寬 / 高
        let best = { cols: 1, size: 0 };
        for (let cols = 1; cols <= n; cols++) {
            const rows = Math.ceil(n / cols);
            const w = Math.min((W - GAP * (cols - 1)) / cols, ((H - GAP * (rows - 1)) / rows) * RATIO);
            if (w > best.size) best = { cols, size: w };
        }
        board.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(best.size)}px)`;
        // 牌面裡的字和框都照牌寬等比例縮放；牌太小就不放名字，只留色條
        board.style.setProperty('--mg-w', Math.floor(best.size));
        board.classList.toggle('is-tiny', best.size < 72);
    }

    function buildBoard() {
        const board = $('mgBoard');
        board.innerHTML = '';
        applyCardBack();
        for (let i = 0; i < state.cardCount; i++) {
            const card = el('button', 'mg-card');
            card.type = 'button';
            card.dataset.index = i;
            card.innerHTML = `<div class="mg-inner"><div class="mg-back"></div><div class="mg-front"></div></div>`;
            board.appendChild(card);
        }
        state.matched.forEach((m) => { showFace(m.index, m.face); markMatched(m.index, m.by); });
        state.revealed.forEach((r) => showFace(r.index, r.face));
        requestAnimationFrame(layoutBoard);
    }

    function renderScores() {
        const box = $('mgScores');
        box.innerHTML = '';
        state.players.forEach((p) => {
            const chip = el('div', 'mg-score');
            if (p.socketId === state.turn) chip.classList.add('is-turn');
            if (p.socketId === myId()) chip.classList.add('is-me');
            const icon = el('span', 'mg-score-icon');
            icon.innerHTML = petSVG(p.petColor, null, jokerStyleOfPlayer(p.socketId));
            chip.appendChild(icon);
            chip.appendChild(el('span', 'mg-score-name', p.socketId === myId() ? T('me', p.petName) : p.petName));
            chip.appendChild(el('span', 'mg-score-num', String(p.score)));
            box.appendChild(chip);
        });
    }

    function renderStatus(notice) {
        const status = $('mgStatus');
        const player = state.players.find((p) => p.socketId === state.turn);
        const mine = state.turn === myId();
        const secs = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
        const streak = state.streak ? T('streak', state.streak, state.maxStreak) : '';
        // 伺服器送來的提示是中文，英文模式下翻成英文（slug_social.js 的 trText）
        const text = (notice && typeof trText === 'function' ? trText(notice) : notice)
            || (mine ? T('myTurn', streak, secs) : T('otherTurn', player ? player.petName : '…', streak, secs));
        const watching = isSpectator();
        status.textContent = watching ? `${T('watchingTag')}｜${text}` : text;
        status.classList.toggle('is-mine', mine);
        $('mgGame').classList.toggle('is-spectating', watching);
        if (isRulesOpen()) renderRulesLive();
    }

    function setTurn(turn, msLeft, streak, notice) {
        state.turn = turn;
        state.streak = streak || 0;
        turnDeadline = Date.now() + (msLeft || 0);
        renderScores();
        renderStatus(notice);
        clearInterval(timerTick);
        timerTick = setInterval(() => { if (state) renderStatus(); }, 1000);
        if (notice) setTimeout(() => { if (state) renderStatus(); }, 2000);
    }

    function endGame(data) {
        clearInterval(timerTick);
        lastResult = data;
        const overlay = $('memoryGameOverlay');
        const wasPlayer = data.players.some((p) => p.socketId === myId());
        if (!wasPlayer && (!overlay || overlay.hidden)) {
            state = null;
            showFloatText(T('endedWatching'));
            notifyStatus();
            return;
        }
        renderResult(data);

        state = null;
        ensureOverlay().hidden = false;
        $('mgLobby').hidden = true;
        $('mgGame').hidden = true;
        $('mgResult').hidden = false;
        $('mgAlbum').hidden = true;
        if (isRulesOpen()) renderRulesLive();
        notifyStatus();
    }

    function renderResult(data) {
        const result = $('mgResult');
        result.innerHTML = '';
        const ranking = [...data.players].sort((a, b) => b.score - a.score);
        const iWon = data.winners.includes(myId());

        result.appendChild(el('div', 'mg-result-title',
            data.draw ? (iWon ? T('draw') : T('over')) : (iWon ? T('youWin') : T('over'))));
        const list = el('ol', 'mg-ranking');
        ranking.forEach((p) => {
            const li = el('li', data.winners.includes(p.socketId) ? 'is-winner' : '');
            li.appendChild(el('span', '', p.socketId === myId() ? T('me', p.petName) : p.petName));
            li.appendChild(el('b', '', T('score', p.score)));
            list.appendChild(li);
        });
        result.appendChild(list);
        if (data.draw) result.appendChild(el('p', 'mg-note', T('drawNote')));

        const again = el('button', 'mg-start', isRoomHost ? T('again') : T('backToLobby'));
        again.type = 'button';
        again.addEventListener('click', showLobby);
        result.appendChild(again);
    }

    function resetLocal(message) {
        clearInterval(timerTick);
        state = null;
        hideInvite();
        notifyStatus();
        if (isRulesOpen()) renderRulesLive();
        const overlay = $('memoryGameOverlay');
        if (overlay && !overlay.hidden) showLobby();
        if (message) showFloatText(message, 4000);
    }

    // ---------- 跟伺服器溝通 ----------
    function identify() {
        if (boundSocket && GAME_TOKEN) boundSocket.emit('memory_identify', { token: GAME_TOKEN });
    }

    function bindSocket(socket) {
        if (!socket || boundSocket === socket) return;
        boundSocket = socket;

        socket.on('connect', () => { identify(); if (currentRoomId) socket.emit('memory_sync'); });
        if (socket.connected) identify();

        socket.on('memory_error', ({ message }) => showFloatText(message || T('error')));

        socket.on('memory_started', (s) => {
            state = s;
            hideInvite();
            turnDeadline = Date.now() + (s.turnMsLeft || 0);
            const overlay = ensureOverlay();
            if (isSpectator() && overlay.hidden) {
                // 觀眾：不要突然跳出牌桌，提示一下就好，想看再打開
                showGame();
                buildBoard();
                setTurn(s.turn, s.turnMsLeft, s.streak, s.notice);
                showFloatText(T('startedWatching'), 4000);
            } else {
                overlay.hidden = false;
                // 自己有參加：開局了就把規則面板收起來，讓他看得到牌桌
                if (!isSpectator()) closeRules();
                showGame();
                buildBoard();
                setTurn(s.turn, s.turnMsLeft, s.streak, s.notice);
                showFloatText(isSpectator() ? T('startedWatching') : T('started', s.pairs));
            }
            notifyStatus();
        });

        // 房主開局：問大家要不要加入
        socket.on('memory_invite', (data) => showInvite(data));
        socket.on('memory_invite_update', (data) => { if (invite) showInvite(data); });
        socket.on('memory_invite_cancelled', ({ message }) => {
            hideInvite();
            notifyStatus();
            showFloatText(message || T('inviteCancelled'), 4000);
        });
        // 剛進房：問伺服器有沒有對決或邀請正在進行
        socket.on('room_joined', () => socket.emit('memory_sync'));

        // 中途加入或重連：直接畫出目前盤面
        socket.on('memory_state', (s) => {
            state = s;
            ensureOverlay();
            showGame();
            buildBoard();
            setTurn(s.turn, s.turnMsLeft, s.streak);
            notifyStatus();
        });

        socket.on('memory_revealed', ({ index, face }) => { if (state) showFace(index, face); });

        socket.on('memory_matched', ({ indices, face, by, players, streak }) => {
            if (!state) return;
            indices.forEach((i) => { showFace(i, face); markMatched(i, by); });
            state.players = players;
            state.streak = streak;
            renderScores();
            if (by === myId() && face !== JOKER) showFloatText(T('matched', speciesName(face)));
        });

        socket.on('memory_mismatch', ({ indices, showMs }) => {
            if (!state) return;
            indices.forEach((i) => {
                const card = document.querySelector(`.mg-card[data-index="${i}"]`);
                if (card) card.classList.add('is-wrong');
            });
            setTimeout(() => indices.forEach((i) => {
                hideFace(i);
                const card = document.querySelector(`.mg-card[data-index="${i}"]`);
                if (card) card.classList.remove('is-wrong');
            }), showMs || 1200);
        });

        socket.on('memory_turn', ({ turn, turnMsLeft, revealed, notice, streak }) => {
            if (!state) return;
            // 時間到換人時，翻開一半的牌要蓋回去
            document.querySelectorAll('.mg-card.is-flipped:not(.is-matched):not(.is-wrong)').forEach((c) => hideFace(Number(c.dataset.index)));
            (revealed || []).forEach((r) => showFace(r.index, r.face));
            setTurn(turn, turnMsLeft, streak, notice);
            if (turn === myId() && !streak) showFloatText(T('yourTurnToast'));
        });

        socket.on('memory_players', ({ players, notice }) => {
            if (!state) return;
            state.players = players;
            renderScores();
            if (notice) { renderStatus(notice); setTimeout(() => { if (state) renderStatus(); }, 2500); }
            notifyStatus();
        });

        socket.on('memory_ended', endGame);

        socket.on('memory_aborted', ({ message }) => resetLocal(message));

        socket.on('memory_win_recorded', ({ wins, jokerSkinUnlocked, winsRequired }) => {
            if (jokerSkinUnlocked) showFloatText(T('skinUnlocked', winsRequired), 5000);
            else showFloatText(T('winPlus', wins), 4000);
            onWinRecorded(wins);
        });
    }

    let lastWins = null;
    let lastResult = null;

    // ---------- 🃏 開局邀請：房間裡每個人都會跳出來，選加入或觀戰 ----------
    let invite = null;        // 伺服器給的邀請狀態
    let inviteDeadline = 0;
    let inviteTick = null;
    let myInviteChoice = null; // 'join' | 'watch'
    let inviteTotal = 15000;   // 倒數條的總長度（第一次收到邀請時的剩餘時間）

    function isSpectator() {
        return !!state && !state.players.some((p) => p.socketId === myId());
    }

    function ensureInvite() {
        let box = $('mgInvite');
        if (box) return box;
        box = el('div', 'mg-invite');
        box.id = 'mgInvite';
        box.hidden = true;
        box.setAttribute('role', 'dialog');
        box.innerHTML = `
            <div class="mg-invite-card">
                <div class="mg-invite-icon" aria-hidden="true">🃏</div>
                <div class="mg-invite-body">
                    <div class="mg-invite-title" id="mgInviteTitle"></div>
                    <div class="mg-invite-sub" id="mgInviteSub"></div>
                    <div class="mg-invite-joined" id="mgInviteJoined"></div>
                </div>
                <div class="mg-invite-actions" id="mgInviteActions">
                    <button type="button" class="mg-invite-join" id="mgInviteJoin"></button>
                    <button type="button" class="mg-invite-watch" id="mgInviteWatch"></button>
                </div>
            </div>
            <div class="mg-invite-bar"><i id="mgInviteBar"></i></div>`;
        document.body.appendChild(box);
        const reply = (join) => {
            if (!boundSocket || !invite) return;
            myInviteChoice = join ? 'join' : 'watch';
            boundSocket.emit('memory_invite_reply', { join });
            renderInvite();
        };
        $('mgInviteJoin').addEventListener('click', () => reply(true));
        $('mgInviteWatch').addEventListener('click', () => reply(false));
        return box;
    }

    function showInvite(data) {
        const isNew = !invite;
        invite = data;
        inviteDeadline = Date.now() + (data.msLeft || 0);
        if (isNew) { myInviteChoice = null; inviteTotal = data.msLeft || 15000; }
        // 伺服器那邊記得我選了什麼（例如重新整理後），以伺服器為準
        if (data.joined.some((p) => p.socketId === myId())) myInviteChoice = 'join';
        else if ((data.watching || []).includes(myId())) myInviteChoice = 'watch';
        ensureInvite().hidden = false;
        renderInvite();
        clearInterval(inviteTick);
        inviteTick = setInterval(renderInvite, 250);
        notifyStatus();
    }

    function hideInvite() {
        invite = null;
        myInviteChoice = null;
        clearInterval(inviteTick);
        const box = $('mgInvite');
        if (box) box.hidden = true;
    }

    function renderInvite() {
        if (!invite) return;
        const isHost = invite.hostId === myId();
        const secs = Math.max(0, Math.ceil((inviteDeadline - Date.now()) / 1000));
        $('mgInviteTitle').textContent = isHost ? T('inviteHostTitle') : T('inviteTitle', invite.hostName);
        $('mgInviteSub').textContent = T('inviteSub', invite.pairs, secs);
        const names = invite.joined.map((p) => (p.socketId === myId() ? T('me', p.petName) : p.petName)).join('、');
        $('mgInviteJoined').textContent = T('inviteJoined', names) + (invite.waiting ? `｜${T('inviteWaiting', invite.waiting)}` : '');
        $('mgInviteActions').hidden = isHost;
        const join = $('mgInviteJoin');
        const watch = $('mgInviteWatch');
        join.textContent = myInviteChoice === 'join' ? T('inviteJoinedMe') : T('inviteJoin');
        watch.textContent = myInviteChoice === 'watch' ? T('inviteWatchMe') : T('inviteWatch');
        join.classList.toggle('is-chosen', myInviteChoice === 'join');
        watch.classList.toggle('is-chosen', myInviteChoice === 'watch');
        $('mgInviteBar').style.width = Math.max(0, Math.min(100, ((inviteDeadline - Date.now()) / inviteTotal) * 100)) + '%';
    }

    // 連線面板上的「翻牌對決」按鈕要跟著換字（開局、觀戰中、邀請中）
    function getStatus() {
        if (state) return isSpectator() ? 'watching' : 'playing';
        if (invite) return 'inviting';
        return 'idle';
    }
    function notifyStatus() {
        if (typeof updateMpGamesUI === 'function') updateMpGamesUI();
    }

    function renderWins() {
        renderRewards();
        if (isPickOpen()) renderPick();
        const throne = $('mgThrone');
        if (throne) {
            throne.querySelector('.mg-throne-title').textContent = T('throneTitle');
            throne.querySelector('.mg-throne-sub').textContent = T('throneSub');
            throne.querySelector('.mg-throne-btn').textContent = T('throneBtn');
            throne.querySelector('.mg-throne-skip').textContent = T('throneSkip');
        }
    }

    function applyStaticText() {
        const overlay = $('memoryGameOverlay');
        if (!overlay) return;
        overlay.querySelectorAll('[data-t]').forEach((n) => { n.textContent = T(n.dataset.t); });
        overlay.querySelectorAll('[data-t-html]').forEach((n) => { n.innerHTML = T(n.dataset.tHtml); });
        overlay.querySelectorAll('[data-t-aria]').forEach((n) => { n.setAttribute('aria-label', T(n.dataset.tAria)); });
        overlay.querySelectorAll('[data-t-title]').forEach((n) => { n.title = T(n.dataset.tTitle); });
        overlay.querySelectorAll('.mg-pair-btn').forEach((b) => { b.textContent = T('pairs', Number(b.dataset.pairs)); });
        renderRuleCards($('mgLobbyRules'), RULES.filter((r) => r.lobby));
        if (isRulesOpen()) { renderRuleCards($('mgRulesList'), RULES); renderRulesLive(); }
        else $('mgRulesDone').textContent = state ? T('rulesBack') : T('rulesClose');
    }

    // 遊戲右上角切中／英時呼叫：畫面上看得到的字全部換掉
    function refreshLang() {
        renderInvite();
        if (!$('memoryGameOverlay')) return;
        applyStaticText();
        renderWins();
        if (!$('mgAlbum').hidden) {
            $('mgAlbumCount').textContent = T('albumCount', albumFaces().length);
            renderAlbumPage();
        }
        // 牌面上的名字也要換：已經翻開的牌重畫一次
        document.querySelectorAll('.mg-card[data-face]').forEach((card) => {
            const front = card.querySelector('.mg-front');
            front.innerHTML = cardFaceHTML(card.dataset.face);
            front.title = speciesName(card.dataset.face);
        });
        if (state) { renderScores(); renderStatus(); }
        if (!$('mgResult').hidden && lastResult) renderResult(lastResult);
        renderInvite();
    }

    // 離開房間時收起來
    function leaveRoom() {
        resetLocal();
        hideInvite();
        closeOverlay();
    }

    window.MemoryGame = { bindSocket, open: openOverlay, leaveRoom, refreshLang, status: getStatus };
})();
