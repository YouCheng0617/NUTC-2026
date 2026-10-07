// 🃏 【記憶翻牌對決】連線房間裡的小遊戲
//
// 牌的位置只有伺服器知道（backend/src/socket/memoryGame.ts），這裡只負責畫面：
// 點牌 → 送 memory_flip → 伺服器告訴大家翻到什麼、有沒有配對、輪到誰。
// 會用到 slug_game.js 的 socket、currentRoomId、isRoomHost、speciesData、GAME_TOKEN、showFloatText、fetchAPI。
(function () {
    const PAIR_OPTIONS = [10, 20, 30, 50];
    const JOKER = 'joker';

    let boundSocket = null;
    let state = null;          // 目前盤面（伺服器給的公開狀態）
    let timerTick = null;
    let turnDeadline = 0;

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
        if (colorKey === JOKER) return '小丑';
        const spec = typeof speciesData !== 'undefined' && speciesData[colorKey];
        return spec ? (spec.name && spec.name.zh) || colorKey : colorKey;
    }

    // 把一張牌翻成正面（face = 寵物顏色 key 或 joker）
    function showFace(index, face) {
        const card = document.querySelector(`.mg-card[data-index="${index}"]`);
        if (!card) return;
        const front = card.querySelector('.mg-front');
        if (card.dataset.face !== face) {
            card.dataset.face = face;
            if (face === JOKER) {
                // 🃏 設計師還沒畫好小丑牌，先用暫代牌面
                front.innerHTML = `<div class="mg-joker">🃏<small>×${(state && state.jokerValue) || 3}</small></div>`;
            } else {
                front.innerHTML = petSVG(face);
            }
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
            <div class="mg-panel" role="dialog" aria-label="記憶翻牌對決">
                <div class="mg-header">
                    <div class="mg-title">🃏 記憶翻牌對決</div>
                    <button type="button" class="mg-close" id="mgClose" title="收起（對決會繼續進行）">✕</button>
                </div>

                <div class="mg-lobby" id="mgLobby">
                    <p class="mg-rules">
                        輪流翻兩張牌，翻到一樣的寵物就拿下這組，還可以繼續翻（每回合最多連續翻對 3 組）。<br>
                        全部翻完，拿最多組的人獲勝！每回合限時 30 秒。
                    </p>
                    <p class="mg-wins" id="mgWins"></p>
                    <div class="mg-host-only" id="mgHostControls">
                        <div class="mg-label">選擇對決組數</div>
                        <div class="mg-pairs" id="mgPairs"></div>
                        <button type="button" class="mg-start" id="mgStart">開始對決！</button>
                    </div>
                    <p class="mg-wait" id="mgWait">等房主選好組數開始對決…</p>
                </div>

                <div class="mg-game" id="mgGame" hidden>
                    <div class="mg-scores" id="mgScores"></div>
                    <div class="mg-status" id="mgStatus"></div>
                    <div class="mg-board-wrap" id="mgBoardWrap"><div class="mg-board" id="mgBoard"></div></div>
                </div>

                <div class="mg-result" id="mgResult" hidden></div>
            </div>`;
        document.body.appendChild(overlay);

        $('mgClose').addEventListener('click', closeOverlay);

        let selectedPairs = 20;
        const pairsBox = $('mgPairs');
        PAIR_OPTIONS.forEach((n) => {
            const btn = el('button', 'mg-pair-btn' + (n === selectedPairs ? ' is-active' : ''), `${n} 組`);
            btn.type = 'button';
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
            if (state.turn !== myId()) { showFloatText('還沒輪到你喔！'); return; }
            if (card.classList.contains('is-flipped')) return;
            boundSocket.emit('memory_flip', { index: Number(card.dataset.index) });
        });

        window.addEventListener('resize', layoutBoard);
        return overlay;
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
        $('mgHostControls').hidden = !isRoomHost;
        $('mgWait').hidden = !!isRoomHost;

        const winsEl = $('mgWins');
        winsEl.textContent = '';
        if (typeof fetchAPI === 'function' && GAME_TOKEN) {
            const pet = await fetchAPI('/pet-games/my-pet', 'GET');
            const wins = pet && (pet.memory_wins ?? (pet.data && pet.data.memory_wins));
            if (typeof wins === 'number') {
                winsEl.textContent = wins >= 10
                    ? `🏆 已贏 ${wins} 場，小丑皮膚已解鎖！`
                    : `🏆 目前勝場 ${wins} / 10（贏滿 10 場送小丑皮膚）`;
            }
        }
    }

    function showGame() {
        $('mgLobby').hidden = true;
        $('mgResult').hidden = true;
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
            chip.appendChild(el('span', 'mg-score-name', p.socketId === myId() ? `${p.petName}（我）` : p.petName));
            chip.appendChild(el('span', 'mg-score-num', String(p.score)));
            box.appendChild(chip);
        });
    }

    function renderStatus(notice) {
        const status = $('mgStatus');
        const player = state.players.find((p) => p.socketId === state.turn);
        const mine = state.turn === myId();
        const secs = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
        const streak = state.streak ? `・已連續翻對 ${state.streak} / ${state.maxStreak} 組` : '';
        status.textContent = notice
            || (mine ? `輪到你翻牌！${streak}（${secs} 秒）` : `輪到 ${player ? player.petName : '…'} 翻牌${streak}（${secs} 秒）`);
        status.classList.toggle('is-mine', mine);
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
        const result = $('mgResult');
        result.innerHTML = '';
        const ranking = [...data.players].sort((a, b) => b.score - a.score);
        const iWon = data.winners.includes(myId());

        result.appendChild(el('div', 'mg-result-title',
            data.draw ? (iWon ? '🤝 平手！' : '對決結束！') : (iWon ? '🎉 你贏了！' : '對決結束！')));
        const list = el('ol', 'mg-ranking');
        ranking.forEach((p) => {
            const li = el('li', data.winners.includes(p.socketId) ? 'is-winner' : '');
            li.appendChild(el('span', '', p.socketId === myId() ? `${p.petName}（我）` : p.petName));
            li.appendChild(el('b', '', `${p.score} 組`));
            list.appendChild(li);
        });
        result.appendChild(list);
        if (data.draw) result.appendChild(el('p', 'mg-note', '平手不計入勝場喔！'));

        const again = el('button', 'mg-start', isRoomHost ? '再來一局' : '回到等待畫面');
        again.type = 'button';
        again.addEventListener('click', showLobby);
        result.appendChild(again);

        state = null;
        ensureOverlay().hidden = false;
        $('mgLobby').hidden = true;
        $('mgGame').hidden = true;
        result.hidden = false;
    }

    function resetLocal(message) {
        clearInterval(timerTick);
        state = null;
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

        socket.on('memory_error', ({ message }) => showFloatText(message || '翻牌對決發生錯誤'));

        socket.on('memory_started', (s) => {
            state = s;
            turnDeadline = Date.now() + (s.turnMsLeft || 0);
            ensureOverlay().hidden = false;
            showGame();
            buildBoard();
            setTurn(s.turn, s.turnMsLeft, s.streak);
            showFloatText(`🃏 翻牌對決開始！共 ${s.pairs} 組`);
        });

        // 中途加入或重連：直接畫出目前盤面
        socket.on('memory_state', (s) => {
            state = s;
            ensureOverlay();
            showGame();
            buildBoard();
            setTurn(s.turn, s.turnMsLeft, s.streak);
        });

        socket.on('memory_revealed', ({ index, face }) => { if (state) showFace(index, face); });

        socket.on('memory_matched', ({ indices, face, by, players, streak }) => {
            if (!state) return;
            indices.forEach((i) => { showFace(i, face); markMatched(i, by); });
            state.players = players;
            state.streak = streak;
            renderScores();
            if (by === myId()) showFloatText(face === JOKER ? '🃏 小丑牌！一次拿下 3 組！' : `配對成功！${speciesName(face)} ✨`);
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
            if (turn === myId() && !streak) showFloatText('輪到你翻牌囉！🃏');
        });

        socket.on('memory_players', ({ players }) => { if (state) { state.players = players; renderScores(); } });

        socket.on('memory_ended', endGame);

        socket.on('memory_aborted', ({ message }) => resetLocal(message));

        socket.on('memory_win_recorded', ({ wins, jokerSkinUnlocked, winsRequired }) => {
            if (jokerSkinUnlocked) showFloatText(`🃏 恭喜贏滿 ${winsRequired} 場，獲得小丑皮膚！`, 5000);
            else showFloatText(`🏆 勝場 +1（目前 ${wins} 場）`, 4000);
        });
    }

    // 離開房間時收起來
    function leaveRoom() {
        resetLocal();
        closeOverlay();
    }

    window.MemoryGame = { bindSocket, open: openOverlay, leaveRoom };
})();
