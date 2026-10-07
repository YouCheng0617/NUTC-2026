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
            rules: '房主開局時，房間裡每個人可以選擇加入或觀戰。<br>輪流翻兩張牌，翻到一樣的寵物就拿下這組，還可以繼續翻（每回合最多連續翻對 3 組）。<br>全部翻完，拿最多組的人獲勝！每回合限時 30 秒，人多的話組數會自動加多。',
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
            winsDone: (w) => `🏆 已贏 ${w} 場，小丑皮膚已解鎖！`,
            winsSoFar: (w) => `🏆 目前勝場 ${w} / 10（贏滿 10 場送小丑皮膚）`,
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
            rules: 'When the host starts, everyone in the room can choose to play or watch.<br>Take turns flipping two cards. Find the same sea bunny to win the pair and keep going (up to 3 pairs in a row).<br>When all cards are gone, whoever has the most pairs wins! 30 seconds per turn; more players means more pairs.',
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
            winsDone: (w) => `🏆 ${w} wins — Joker skin unlocked!`,
            winsSoFar: (w) => `🏆 Wins: ${w} / 10 (win 10 to get the Joker skin)`,
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
    function petSVG(colorKey) {
        const spec = (typeof speciesData !== 'undefined' && speciesData[colorKey]) || speciesData.snow;
        return `
            <svg viewBox="40 15 270 210" aria-hidden="true">
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
                    <circle cx="-20" cy="0" r="8" fill="#2c3e50"/><circle cx="20" cy="0" r="8" fill="#2c3e50"/>
                    <circle cx="-17" cy="-3" r="3" fill="#fff"/><circle cx="23" cy="-3" r="3" fill="#fff"/>
                    <path d="M -7 5 Q 0 12 7 5" fill="none" stroke="#2c3e50" stroke-width="4" stroke-linecap="round"/>
                </g>
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
                    <button type="button" class="mg-close" id="mgClose" data-t-title="closeTip">✕</button>
                </div>

                <div class="mg-lobby" id="mgLobby">
                    <p class="mg-rules" data-t-html="rules"></p>
                    <p class="mg-wins" id="mgWins"></p>
                    <button type="button" class="mg-album-open" id="mgAlbumOpen"><span data-t="albumOpen"></span><small data-t="albumOpenSub"></small></button>
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
            </div>`;
        document.body.appendChild(overlay);
        applyStaticText();

        $('mgClose').addEventListener('click', closeOverlay);
        bindAlbum();

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

    // ---------- 📖 卡牌圖鑑（活頁小卡冊） ----------
    const ALBUM_PER_PAGE = 4;
    const ALBUM_VIEWS = ['mgLobby', 'mgGame', 'mgResult'];
    let albumPage = 0;
    let albumTurning = false;
    let albumQueued = 0;             // 翻頁動畫中又按了幾下，翻完接著翻
    let albumReturnTo = 'mgLobby';   // 關掉圖鑑後回到哪個畫面

    function albumFaces() {
        const keys = typeof speciesData !== 'undefined' ? Object.keys(speciesData) : [];
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

        const winsEl = $('mgWins');
        winsEl.textContent = '';
        lastWins = null;
        if (typeof fetchAPI === 'function' && GAME_TOKEN) {
            const pet = await fetchAPI('/pet-games/my-pet', 'GET');
            const wins = pet && (pet.memory_wins ?? (pet.data && pet.data.memory_wins));
            if (typeof wins === 'number') {
                lastWins = wins;
                renderWins();
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
        for (let i = 0; i < state.cardCount; i++) {
            const card = el('button', 'mg-card');
            card.type = 'button';
            card.dataset.index = i;
            card.innerHTML = `<div class="mg-inner"><div class="mg-back">🫧</div><div class="mg-front"></div></div>`;
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
            icon.innerHTML = petSVG(p.petColor);
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
        const winsEl = $('mgWins');
        if (!winsEl || typeof lastWins !== 'number') return;
        winsEl.textContent = lastWins >= 10 ? T('winsDone', lastWins) : T('winsSoFar', lastWins);
    }

    function applyStaticText() {
        const overlay = $('memoryGameOverlay');
        if (!overlay) return;
        overlay.querySelectorAll('[data-t]').forEach((n) => { n.textContent = T(n.dataset.t); });
        overlay.querySelectorAll('[data-t-html]').forEach((n) => { n.innerHTML = T(n.dataset.tHtml); });
        overlay.querySelectorAll('[data-t-aria]').forEach((n) => { n.setAttribute('aria-label', T(n.dataset.tAria)); });
        overlay.querySelectorAll('[data-t-title]').forEach((n) => { n.title = T(n.dataset.tTitle); });
        overlay.querySelectorAll('.mg-pair-btn').forEach((b) => { b.textContent = T('pairs', Number(b.dataset.pairs)); });
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
