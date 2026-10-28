// 🧱 【海兔疊疊樂】連線房間裡的小遊戲
//
// 每個人疊自己的塔、同時開始，時間到或大家都倒了就比誰疊得高（backend/src/socket/stackGame.ts）。
// 積木的位置與會不會倒都是伺服器算的：按下去只送「這塊出現後過了幾毫秒」，
// 這裡用伺服器開局時給的同一套規則先算出結果畫出來，伺服器的結果回來再對一次。
// 積木是九種豆腐海兔，各有不同手感（寬度、重量、會不會滑），每層哪一種由伺服器決定、大家順序一樣。
// 放得剛好在正中間算「完美」，有連擊、音效、震動；個人最高紀錄存在瀏覽器。
// 會用到 slug_game.js 的 socket、currentRoomId、isRoomHost、showFloatText、currLang。
(function () {
    let boundSocket = null;
    let state = null;          // 對局狀態：rules、phases、players（每人的 blocks）
    let endsAtLocal = 0;
    let viewId = null;         // 主畫面正在看誰的塔（自己有參加就是自己）
    let rafId = 0;
    let lastResult = null;
    let unlocked = false;      // 🤫 隱藏小遊戲：這個房間有人打過暗號才會出現（伺服器說了算）

    // 自己的塔：先照自己算的畫（myView），伺服器的結果回來再對齊
    let myView = null;
    let mySpawnLocal = 0;      // 自己這塊積木開始移動的時間（performance.now）
    let myOut = null;
    let dropAnim = null;       // { level, x, start }：剛放下的積木從上面落下來
    let falling = null;        // { blocks, fromLevel, dir, start, ownerId }：倒下去的那一截
    let camBottom = 0;
    let combo = 0;             // 連續完美幾次
    let effects = [];          // 畫面上的特效：{ kind, x, y, start, text }
    let stinkTimer = null;
    let lastTick = 0;          // 開局倒數上次響的秒數

    const BLOCK_H = 36;                  // 積木高度（跟後端 blockWidth 同一套座標）
    const DROP_MS = 160;
    const FALL_MS = 1300;

    // ---------- 文字（跟著遊戲右上角的中／英切換） ----------
    const TEXT = {
        zh: {
            title: '🧱 海兔疊疊樂', closeTip: '收起（對局會繼續進行）',
            heroTitle: '海兔疊疊樂', heroSub: '豆腐海兔在上面左右跑，抓準時機放下去，看誰疊得最高！',
            rules: [
                ['🎯', '按一下放下', '積木在塔頂上方左右移動，點畫面、按「放下！」或空白鍵就會掉下去。'],
                ['⚖️', '歪太多會倒', '放歪沒關係，但上面那一截的重心超出下面那塊的邊緣，就會整截倒下來，這局結束。'],
                ['⚡', '越疊越快', '每疊高一層，積木就跑得更快一點。'],
                ['🏆', '比誰最高', '大家同時開始，時間到或都倒了就結算，塔最高的人贏，一樣高算平手。一個人也能玩，挑戰自己的紀錄！'],
                ['✨', '完美放置', '放得剛好在下面那塊的正中間就是「完美」，會自動對齊，連續完美還有連擊！'],
                ['🧈', '九種豆腐海兔', '每一層隨機出現一種，大家的順序都一樣。每種豆腐的寬度、重量、滑不滑都不一樣，看下面的豆腐圖鑑。'],
            ],
            start: '開始疊疊樂！', wait: '等房主開局…',
            drop: '放下！', timeLeft: (s) => `剩 ${s} 秒`, nowTofu: (n) => `這塊：${n}`,
            height: (h) => `${h} 層`, me: (n) => `${n}（我）`,
            countdown: (s) => `${s}`, go: '開始！',
            myTurn: '抓準時機，按一下放下積木！', fell: '你的塔倒了！等其他人疊完…', left: '離開了',
            watching: (n) => `觀戰中：正在看 ${n} 的塔（點右邊的名字換人看）`,
            outFell: '倒了', outLeft: '離開了', offline: '斷線中',
            notPlaying: '你這局在觀戰，不能放積木喔',
            soloResult: (h) => `🧱 你疊了 ${h} 層！`, youWin: '🏆 你疊得最高！', draw: '🤝 平手！', over: '🧱 結束了！', drawNote: '最高的人一樣高，這局平手。',
            again: '再來一局', backToLobby: '回到等待畫面',
            started: '疊疊樂開始了！', startedWatching: '疊疊樂開始了，可以打開來觀戰',
            endedWatching: '疊疊樂結束了',
            inviteTitle: (n) => `${n} 開了一局疊疊樂！`, inviteHostTitle: '等大家回覆要不要加入…',
            inviteSub: (s) => `${s} 秒後開局，沒加入的人可以觀戰`,
            inviteJoined: (names) => `已加入：${names}`, inviteWaiting: (n) => `還有 ${n} 人沒回覆`,
            inviteJoin: '加入', inviteJoinedMe: '✓ 已加入', inviteWatch: '觀戰', inviteWatchMe: '✓ 觀戰',
            inviteCancelled: '疊疊樂取消了', error: '出了點問題，再試一次',
            unlocked: '🤫 隱藏小遊戲「海兔疊疊樂」解鎖了！在連線小遊戲裡找找看',
            perfect: '完美！', combo: (n) => `完美 ×${n}`,
            best: (n) => `🏅 我的最高紀錄：${n} 層`, bestNone: '🏅 還沒有紀錄，來挑戰看看！', newBest: (n) => `🎉 新紀錄！${n} 層`,
            guideTitle: '🧈 豆腐圖鑑', plusOne: '+1', fellPop: '倒了！', stink: '💨 好臭！',
            soundOn: '🔊', soundOff: '🔇', soundTip: '音效開關',
        },
        en: {
            title: '🧱 Bunny Stack', closeTip: 'Minimize (the game keeps going)',
            heroTitle: 'Bunny Stack', heroSub: 'Tofu bunnies slide left and right — drop them at the right moment and build the tallest tower!',
            rules: [
                ['🎯', 'Tap to drop', 'The block slides above your tower. Tap the stage, press "Drop!" or hit Space.'],
                ['⚖️', 'Too wobbly = topple', 'Off-center is fine, but if the blocks above lean past the edge of the block below, that part falls and your game is over.'],
                ['⚡', 'Faster and faster', 'Every level makes the block slide a bit faster.'],
                ['🏆', 'Tallest wins', 'Everyone starts together. When time runs out or all towers fall, the tallest tower wins. Same height is a draw. You can also play solo and beat your own record!'],
                ['✨', 'Perfect drop', 'Land right on the center of the block below for a "Perfect" — it snaps into place, and perfects in a row build a combo!'],
                ['🧈', 'Nine tofu bunnies', 'A random one each level, in the same order for everyone. Each tofu has its own width, weight and slipperiness — see the Tofu Guide below.'],
            ],
            start: 'Start Bunny Stack!', wait: 'Waiting for the host to start…',
            drop: 'Drop!', timeLeft: (s) => `${s}s left`, nowTofu: (n) => `Now: ${n}`,
            height: (h) => `${h} lvl`, me: (n) => `${n} (me)`,
            countdown: (s) => `${s}`, go: 'Go!',
            myTurn: 'Time it right and tap to drop the block!', fell: 'Your tower fell! Waiting for the others…', left: 'Left',
            watching: (n) => `Watching ${n}'s tower (tap a name on the right to switch)`,
            outFell: 'Fell', outLeft: 'Left', offline: 'Offline',
            notPlaying: "You're watching this round — you can't drop blocks",
            soloResult: (h) => `🧱 You stacked ${h} levels!`, youWin: '🏆 Tallest tower!', draw: '🤝 Draw!', over: '🧱 Game over!', drawNote: 'The tallest towers are the same height — it\'s a draw.',
            again: 'Play again', backToLobby: 'Back to lobby',
            started: 'Bunny Stack started!', startedWatching: 'Bunny Stack started — open it to watch',
            endedWatching: 'Bunny Stack ended',
            inviteTitle: (n) => `${n} started Bunny Stack!`, inviteHostTitle: 'Waiting for everyone to answer…',
            inviteSub: (s) => `Starts in ${s}s — you can watch if you don't join`,
            inviteJoined: (names) => `Joined: ${names}`, inviteWaiting: (n) => `${n} haven't answered`,
            inviteJoin: 'Join', inviteJoinedMe: '✓ Joined', inviteWatch: 'Watch', inviteWatchMe: '✓ Watching',
            inviteCancelled: 'Bunny Stack was cancelled', error: 'Something went wrong, try again',
            unlocked: '🤫 Secret game "Bunny Stack" unlocked! Find it in Party games',
            perfect: 'Perfect!', combo: (n) => `Perfect ×${n}`,
            best: (n) => `🏅 My best: ${n} levels`, bestNone: '🏅 No record yet — give it a try!', newBest: (n) => `🎉 New record! ${n} levels`,
            guideTitle: '🧈 Tofu Guide', plusOne: '+1', fellPop: 'Fell!', stink: '💨 So stinky!',
            soundOn: '🔊', soundOff: '🔇', soundTip: 'Sound on/off',
        },
    };

    function isEn() { return typeof currLang !== 'undefined' && currLang === 'en'; }
    function T(key, ...args) {
        const v = (isEn() ? TEXT.en : TEXT.zh)[key];
        return typeof v === 'function' ? v(...args) : v;
    }
    const $ = (id) => document.getElementById(id);
    function el(tag, className, text) {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function myId() { return boundSocket ? boundSocket.id : null; }
    function me() { return state ? state.players.find((p) => p.socketId === myId()) : null; }
    function isSpectator() { return !!state && !me(); }
    function serverNotice(text) { return text && typeof trText === 'function' ? trText(text) : text; }

    // ---------- 規則（跟後端 stackGame.ts 同一套公式） ----------
    function blockX(level, elapsed) {
        const r = state.rules;
        const period = Math.max(r.periodMinMs, r.periodStartMs - (level - 1) * r.periodStepMs);
        const u = elapsed / period + (state.phases[level - 1] || 0);
        const f = u - Math.floor(u);
        return r.swingRange * (4 * Math.abs(f - 0.5) - 1);
    }
    function blockDir(level, elapsed) {
        const r = state.rules;
        const period = Math.max(r.periodMinMs, r.periodStartMs - (level - 1) * r.periodStepMs);
        const u = elapsed / period + (state.phases[level - 1] || 0);
        return u - Math.floor(u) < 0.5 ? -1 : 1;
    }
    // 重心照豆腐重量加權，邊緣看下面那塊的寬度
    function collapseLevel(blocks) {
        const n = blocks.length;
        let sumX = 0, sumW = 0, lowest = -1;
        for (let k = n - 1; k >= 1; k--) {
            const w = kindOf(k).weight;
            sumX += blocks[k] * w;
            sumW += w;
            if (Math.abs(sumX / sumW - blocks[k - 1]) > widthOf(k - 1) / 2) lowest = k;
        }
        return lowest;
    }
    // 落點：完美就對齊下面那塊；雞蛋豆腐往移動方向多滑一段
    function landing(blocks, level, elapsed) {
        let x = blockX(level, elapsed);
        const below = blocks[level - 1];
        const perfect = Math.abs(x - below) <= state.rules.perfectRange;
        if (perfect) x = below;
        else x += kindOf(level).slide * blockDir(level, elapsed);
        return { x, perfect };
    }

    // ---------- 畫面 ----------
    function ensureOverlay() {
        let overlay = $('stackGameOverlay');
        if (overlay) return overlay;
        overlay = el('div', 'mg-overlay st-overlay');
        overlay.id = 'stackGameOverlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="mg-panel st-panel" role="dialog" data-t-aria="title">
                <div class="mg-header">
                    <div class="mg-title" data-t="title"></div>
                    <div class="mg-header-btns">
                        <button type="button" class="st-sound" id="stSound" data-t-title="soundTip"></button>
                        <button type="button" class="mg-close" id="stClose" data-t-title="closeTip">✕</button>
                    </div>
                </div>
                <div class="mg-lobby" id="stLobby">
                    <div class="mg-hero">
                        <div class="st-hero-art" aria-hidden="true"><i></i><i></i><i></i></div>
                        <h2 class="mg-hero-title" data-t="heroTitle"></h2>
                        <p class="mg-hero-sub" data-t="heroSub"></p>
                    </div>
                    <div class="st-best" id="stBest"></div>
                    <div class="mg-host-only" id="stHostControls">
                        <button type="button" class="mg-start" id="stStart" data-t="start"></button>
                    </div>
                    <p class="mg-wait" id="stWait" data-t="wait"></p>
                    <div class="st-rules" id="stRules"></div>
                    <section class="st-guide">
                        <div class="st-guide-title" data-t="guideTitle"></div>
                        <div class="st-guide-list" id="stGuide"></div>
                    </section>
                </div>
                <div class="st-game" id="stGame" hidden>
                    <div class="st-bar">
                        <div class="st-status" id="stStatus"></div>
                        <div class="st-timer" id="stTimer"></div>
                    </div>
                    <div class="st-main">
                        <div class="st-stage" id="stStage"><canvas id="stCanvas"></canvas><div class="st-stink" id="stStink" hidden><span></span></div></div>
                        <div class="st-side" id="stSide"></div>
                    </div>
                    <button type="button" class="mg-start st-drop" id="stDrop" data-t="drop"></button>
                </div>
                <div class="mg-result" id="stResult" hidden></div>
            </div>`;
        document.body.appendChild(overlay);
        applyStaticText();

        $('stClose').addEventListener('click', closeOverlay);
        $('stSound').addEventListener('click', () => { setSound(!soundOn()); renderSoundBtn(); if (soundOn()) sfx.tick(); });
        $('stStart').addEventListener('click', () => { if (boundSocket) boundSocket.emit('stack_start'); });
        $('stDrop').addEventListener('click', drop);
        $('stStage').addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
        $('stSide').addEventListener('click', (e) => {
            const card = e.target.closest('.st-player');
            if (!card || !state || !isSpectator()) return;
            viewId = card.dataset.id;
            falling = null;
            camBottom = -1;
            renderSide();
            renderStatus();
        });
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' && e.code !== 'Enter') return;
            if (overlay.hidden || $('stGame').hidden) return;
            if (e.target.closest && e.target.closest('input, textarea, button')) return;
            e.preventDefault();
            drop();
        });
        window.addEventListener('resize', () => { if (state) sizeCanvas(); });
        return overlay;
    }

    function applyStaticText() {
        const overlay = $('stackGameOverlay');
        if (!overlay) return;
        overlay.querySelectorAll('[data-t]').forEach((n) => { n.textContent = T(n.dataset.t); });
        overlay.querySelectorAll('[data-t-aria]').forEach((n) => { n.setAttribute('aria-label', T(n.dataset.tAria)); });
        overlay.querySelectorAll('[data-t-title]').forEach((n) => { n.title = T(n.dataset.tTitle); });
        const box = $('stRules');
        box.innerHTML = '';
        T('rules').forEach(([icon, title, body]) => {
            const card = el('div', 'st-rule');
            card.appendChild(el('span', 'st-rule-icon', icon));
            const text = el('div', 'st-rule-text');
            text.appendChild(el('b', '', title));
            text.appendChild(el('span', '', body));
            card.appendChild(text);
            box.appendChild(card);
        });
        renderGuide();
        renderBest();
        renderSoundBtn();
    }

    function renderSoundBtn() {
        const btn = $('stSound');
        if (btn) { btn.textContent = soundOn() ? T('soundOn') : T('soundOff'); btn.classList.toggle('is-off', !soundOn()); }
    }
    function renderBest() {
        const box = $('stBest');
        if (box) box.textContent = bestHeight() ? T('best', bestHeight()) : T('bestNone');
    }

    // 豆腐圖鑑：九種豆腐的樣子、名字、手感
    function renderGuide() {
        const box = $('stGuide');
        if (!box) return;
        box.innerHTML = '';
        TOFU.forEach((tofu, i) => {
            const card = el('div', 'st-guide-card');
            const cv = el('canvas', 'st-guide-art');
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            cv.width = 96 * dpr; cv.height = 64 * dpr;
            const ctx = cv.getContext('2d');
            const sc = 0.62 * dpr;
            drawTofu(ctx, tofu, cv.width / 2, cv.height - 6 * dpr, 100 * tofu.width * sc, BLOCK_H * sc, sc, i + 3, true, 1);
            card.appendChild(cv);
            const text = el('div', 'st-guide-text');
            text.appendChild(el('b', '', tofuName(tofu)));
            text.appendChild(el('span', '', isEn() ? tofu.trait.en : tofu.trait.zh));
            card.appendChild(text);
            box.appendChild(card);
        });
    }

    function openOverlay() {
        ensureOverlay().hidden = false;
        if (state) { showGame(); return; }
        showLobby();
        if (boundSocket) boundSocket.emit('stack_sync');
    }
    function closeOverlay() {
        const overlay = $('stackGameOverlay');
        if (overlay) overlay.hidden = true;
    }
    function showLobby() {
        $('stLobby').hidden = false;
        $('stGame').hidden = true;
        $('stResult').hidden = true;
        $('stHostControls').hidden = !isRoomHost;
        $('stWait').hidden = !!isRoomHost;
        renderBest();
    }
    function showGame() {
        $('stLobby').hidden = true;
        $('stResult').hidden = true;
        $('stGame').hidden = false;
        $('stGame').classList.toggle('is-spectating', isSpectator());
        sizeCanvas();
        renderSide();
        renderStatus();
        startLoop();
    }

    function sizeCanvas() {
        const stage = $('stStage');
        const canvas = $('stCanvas');
        if (!stage || !canvas) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
    }

    // 右邊的玩家列表：名字、高度、狀態，還有一座小小的塔
    function renderSide() {
        const side = $('stSide');
        if (!side || !state) return;
        side.innerHTML = '';
        [...state.players].sort((a, b) => b.height - a.height).forEach((p) => {
            const card = el(isSpectator() ? 'button' : 'div', 'st-player' + (p.socketId === viewId ? ' is-viewing' : '') + (p.out ? ' is-out' : ''));
            if (card.tagName === 'BUTTON') card.type = 'button';
            card.dataset.id = p.socketId;
            const mini = el('canvas', 'st-mini');
            mini.width = 44; mini.height = 64;
            drawMini(mini, p);
            card.appendChild(mini);
            const info = el('div', 'st-player-info');
            info.appendChild(el('span', 'st-player-name', p.socketId === myId() ? T('me', p.petName) : p.petName));
            const tag = p.out === 'fell' ? T('outFell') : p.out === 'left' ? T('outLeft') : (!p.connected ? T('offline') : '');
            const line = el('span', 'st-player-height', T('height', p.socketId === myId() && myView ? myView.length - 1 : p.height));
            if (tag) line.appendChild(el('em', '', tag));
            info.appendChild(line);
            card.appendChild(info);
            side.appendChild(card);
        });
    }

    function drawMini(canvas, p) {
        const ctx = canvas.getContext('2d');
        const blocks = p.socketId === myId() && myView ? myView : p.blocks;
        const unit = 6;   // 一層 6px 高
        const from = Math.max(0, blocks.length - 10);
        const show = blocks.slice(from);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        show.forEach((x, i) => {
            const y = canvas.height - (i + 1) * unit - 2;
            const lv = from + i;
            const tofu = lv === 0 ? { body: '#d6a46a', outline: '#8a5a32' } : tofuOf(lv);   // 第 0 層是砧板
            const w = widthOf(lv) * unit / 36;
            ctx.fillStyle = tofu.body;
            ctx.strokeStyle = tofu.outline;
            ctx.lineWidth = 1;
            ctx.fillRect(canvas.width / 2 + (x * unit / 36) - w / 2, y, w, unit - 1);
            ctx.strokeRect(canvas.width / 2 + (x * unit / 36) - w / 2 + 0.5, y + 0.5, w - 1, unit - 2);
        });
    }

    // 玩家卡跳一下，冒出「+1」或「倒了！」
    function bumpCard(socketId, text, bad) {
        const card = document.querySelector(`#stSide .st-player[data-id="${CSS.escape(socketId)}"]`);
        if (!card) return;
        card.classList.remove('is-bump', 'is-bad');
        void card.offsetWidth;   // 重新觸發動畫
        card.classList.add('is-bump');
        if (bad) card.classList.add('is-bad');
        const pop = el('span', 'st-pop' + (bad ? ' is-bad' : ''), text);
        card.appendChild(pop);
        setTimeout(() => pop.remove(), 900);
    }

    // 別人放了臭豆腐：自己的畫面飄過一陣綠色臭氣（擋一下視線，2 秒）
    function showStink(name) {
        const box = $('stStink');
        if (!box) return;
        box.querySelector('span').textContent = `${T('stink')} ${name}`;
        box.hidden = false;
        box.classList.remove('is-on');
        void box.offsetWidth;
        box.classList.add('is-on');
        sfx.stink();
        clearTimeout(stinkTimer);
        stinkTimer = setTimeout(() => { box.hidden = true; }, 2000);
    }

    function viewed() { return state ? state.players.find((p) => p.socketId === viewId) : null; }
    function viewedBlocks() {
        const p = viewed();
        if (!p) return [0];
        return p.socketId === myId() && myView ? myView : p.blocks;
    }

    function renderStatus(notice) {
        if (!state) return;
        const status = $('stStatus');
        const mine = me();
        let text;
        if (notice) text = serverNotice(notice);
        else if (!mine) text = T('watching', viewed() ? viewed().petName : '…');
        else if (myOut === 'fell') text = T('fell');
        else text = T('myTurn');
        status.textContent = text;
        if (notice) setTimeout(() => { if (state) renderStatus(); }, 2500);
        $('stDrop').hidden = !mine || !!myOut;
    }

    // ---------- 放下積木 ----------
    function drop() {
        if (!state || !boundSocket) return;
        if (isSpectator()) { showFloatText(T('notPlaying')); return; }
        if (myOut || falling) return;
        const now = performance.now();
        const elapsed = now - mySpawnLocal;
        if (elapsed < 0) return;   // 下一塊還沒出現
        const level = myView.length;
        const { x, perfect } = landing(myView, level, elapsed);
        boundSocket.emit('stack_drop', { level, elapsed: Math.round(elapsed) });

        myView.push(x);
        dropAnim = { level, x, start: now };
        const fallFrom = collapseLevel(myView);
        if (fallFrom !== -1) {
            startFalling(myView, fallFrom, myId());
            myView = myView.slice(0, fallFrom);
            myOut = 'fell';
            combo = 0;
            sfx.fall();
            renderStatus();
        } else {
            mySpawnLocal = now + state.rules.dropGapMs;
            if (perfect) {
                combo++;
                effects.push({ kind: 'perfect', x, level, start: now, text: combo > 1 ? T('combo', combo) : T('perfect') });
                sfx.perfect(combo);
            } else {
                combo = 0;
                sfx.drop(tofuOf(level));
            }
        }
        renderSide();
    }

    function startFalling(blocks, fromLevel, ownerId) {
        const part = blocks.slice(fromLevel);
        const center = part.reduce((a, b) => a + b, 0) / part.length;
        falling = {
            blocks: part, fromLevel, dir: center >= blocks[fromLevel - 1] ? 1 : -1,
            pivot: blocks[fromLevel - 1], pivotHalf: widthOf(fromLevel - 1) / 2, start: performance.now(), ownerId,
        };
    }

    // ---------- 畫主畫面 ----------
    function startLoop() {
        if (rafId) return;
        const tick = () => {
            rafId = 0;
            const overlay = $('stackGameOverlay');
            if (!state || !overlay || overlay.hidden || $('stGame').hidden) return;
            draw();
            const left = Math.max(0, Math.ceil((endsAtLocal - Date.now()) / 1000));
            const timer = $('stTimer');
            const txt = T('timeLeft', left);
            if (timer.textContent !== txt) timer.textContent = txt;
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ---------- 🧈 豆腐海兔：長相（這裡）＋手感（伺服器開局給的 rules.tofuKinds，跟 gameConfig.ts 一致） ----------
    // width 只在大廳的豆腐圖鑑用（還沒開局拿不到伺服器的數值），要跟 gameConfig.ts 的 tofuKinds 一致
    const TOFU = [
        { id: 'firm', zh: '板豆腐海兔', en: 'Firm Tofu Bunny', body: '#f8f3e6', shade: '#ebe1c8', outline: '#7a6a4f', ear: '#dccfb2', radius: 0.14, width: 1,
            trait: { zh: '標準款，最好放', en: 'The standard one — easy to stack' } },
        { id: 'stinky', zh: '臭豆腐海兔', en: 'Stinky Tofu Bunny', body: '#dc923b', shade: '#b96f22', outline: '#6b3a12', ear: '#a85f1d', radius: 0.24, width: 1,
            trait: { zh: '放下時臭氣會飄到別人的畫面', en: 'Its stink drifts onto everyone else\'s screen' } },
        { id: 'frozen', zh: '凍豆腐海兔', en: 'Frozen Tofu Bunny', body: '#efe2bf', shade: '#ddcb9b', outline: '#7c6b45', ear: '#cdbb8e', radius: 0.12, width: 1,
            trait: { zh: '很輕，放歪一點也不太會壓垮下面', en: 'Light — a little off-center won\'t topple much' } },
        { id: 'egg', zh: '雞蛋豆腐海兔', en: 'Egg Tofu Bunny', body: '#ffe27a', shade: '#f5c544', outline: '#8a6412', ear: '#f0b532', radius: 0.32, width: 1,
            trait: { zh: '很滑，放下後會往移動方向多滑一段', en: 'Slippery — slides a bit further after landing' } },
        { id: 'layered', zh: '百頁豆腐海兔', en: 'Layered Tofu Bunny', body: '#fff3d6', shade: '#f0dcae', outline: '#86714a', ear: '#e6cf9e', radius: 0.18, width: 1,
            trait: { zh: '很重，放歪了特別容易壓垮下面', en: 'Heavy — off-center drops topple easily' } },
        { id: 'dried', zh: '豆干海兔', en: 'Dried Tofu Bunny', body: '#8d5b33', shade: '#6e4423', outline: '#3b2412', ear: '#5e391c', radius: 0.08, width: 1.25,
            trait: { zh: '很寬，好放也好接下一塊', en: 'Wide — easy to land on and to build on' } },
        { id: 'fried', zh: '油豆腐海兔', en: 'Fried Tofu Bunny', body: '#e7a645', shade: '#c9822a', outline: '#7a4510', ear: '#c27a26', radius: 0.36, width: 1,
            trait: { zh: '輕飄飄，落下會彈一下', en: 'Feather-light and bouncy' } },
        { id: 'silken', zh: '嫩豆腐海兔', en: 'Silken Tofu Bunny', body: '#fffdf8', shade: '#f1ece0', outline: '#9a8f78', ear: '#ece4d2', radius: 0.26, width: 0.88,
            trait: { zh: '比較窄，又軟又抖', en: 'Narrow, soft and wobbly' } },
        { id: 'fish', zh: '魚豆腐海兔', en: 'Fish Tofu Bunny', body: '#f2c58a', shade: '#dba15c', outline: '#7a4a1c', ear: '#d99a52', radius: 0.42, width: 0.8,
            trait: { zh: '小小一塊，最難放', en: 'Tiny — the hardest to land' } },
    ];
    const TOFU_BY_ID = Object.fromEntries(TOFU.map((t) => [t.id, t]));
    // 第 level 層的手感（伺服器給的）與長相
    function kindOf(level) {
        const kinds = state.rules.tofuKinds;
        return kinds[state.tofus[level - 1] ?? 0] || kinds[0];
    }
    function tofuOf(level) { return TOFU_BY_ID[kindOf(level).id] || TOFU[0]; }
    function widthOf(level) { return level === 0 ? state.rules.baseWidth : state.rules.blockWidth * kindOf(level).width; }
    function tofuName(tofu) { return isEn() ? tofu.en : tofu.zh; }

    // 固定的亂數：同一層每次畫都長一樣（孔洞、氣泡位置不會閃）
    function seeded(seed) {
        let s = (seed * 9301 + 49297) % 233280 || 1;
        return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    }

    // 各種豆腐的表面特徵：畫在已經 clip 成積木形狀的範圍裡
    function drawTofuTexture(ctx, tofu, x, y, w, h, scale, seed) {
        const rnd = seeded(seed * 131 + 7);
        const u = Math.max(0.6, scale);
        if (tofu.id === 'firm') {
            // 包布壓出來的細格紋
            ctx.strokeStyle = 'rgba(122, 106, 79, 0.16)';
            ctx.lineWidth = Math.max(0.8, 1.1 * u);
            for (let i = -h; i < w; i += 7 * u) {
                ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
            }
        } else if (tofu.id === 'stinky') {
            // 炸得酥酥的坑洞＋亮亮的油光
            for (let i = 0; i < 16; i++) {
                ctx.fillStyle = i % 3 ? 'rgba(140, 70, 15, 0.45)' : 'rgba(255, 214, 140, 0.55)';
                ctx.beginPath();
                ctx.ellipse(x + rnd() * w, y + rnd() * h, (1.2 + rnd() * 2.6) * u, (1 + rnd() * 1.8) * u, rnd() * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (tofu.id === 'frozen') {
            // 海綿一樣的孔洞＋上緣結霜
            for (let i = 0; i < 22; i++) {
                ctx.fillStyle = 'rgba(150, 118, 60, 0.32)';
                ctx.beginPath();
                ctx.ellipse(x + rnd() * w, y + rnd() * h, (1.4 + rnd() * 3) * u, (1 + rnd() * 2) * u, rnd() * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            const frost = ctx.createLinearGradient(0, y, 0, y + h * 0.45);
            frost.addColorStop(0, 'rgba(214, 238, 255, 0.85)');
            frost.addColorStop(1, 'rgba(214, 238, 255, 0)');
            ctx.fillStyle = frost;
            ctx.fillRect(x, y, w, h * 0.45);
        } else if (tofu.id === 'egg') {
            // 滑嫩的光澤
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h * 0.26, w * 0.2, h * 0.12, -0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + w * 0.56, y + h * 0.24, 2.2 * u, 0, Math.PI * 2); ctx.fill();
        } else if (tofu.id === 'layered') {
            // 一層一層的橫紋＋小氣泡
            ctx.strokeStyle = 'rgba(134, 113, 74, 0.3)';
            ctx.lineWidth = Math.max(0.8, 1.2 * u);
            for (let k = 1; k <= 4; k++) {
                const ly = y + (h * k) / 5;
                ctx.beginPath();
                ctx.moveTo(x, ly);
                for (let i = 0; i <= 8; i++) ctx.lineTo(x + (w * i) / 8, ly + Math.sin(i * 1.7 + k) * 1.2 * u);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + rnd() * w, y + rnd() * h, (0.8 + rnd()) * u, 0, Math.PI * 2); ctx.fill(); }
        } else if (tofu.id === 'dried') {
            // 滷汁的光澤＋蓋印的「干」字
            ctx.strokeStyle = 'rgba(255, 220, 170, 0.35)';
            ctx.lineWidth = 2 * u;
            ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h * 0.22); ctx.lineTo(x + w * 0.4, y + h * 0.22); ctx.stroke();
            const sx0 = x + w * 0.82, sy0 = y + h * 0.5, sz = h * 0.5;
            ctx.strokeStyle = 'rgba(40, 20, 8, 0.55)';
            ctx.lineWidth = Math.max(1, 1.4 * u);
            ctx.strokeRect(sx0 - sz / 2, sy0 - sz / 2, sz, sz);
            ctx.fillStyle = 'rgba(40, 20, 8, 0.6)';
            ctx.font = `900 ${Math.round(sz * 0.72)}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('干', sx0, sy0 + sz * 0.04);
            ctx.textBaseline = 'alphabetic';
        } else if (tofu.id === 'fried') {
            // 炸得膨膨的：表皮皺褶＋大塊油亮反光
            ctx.strokeStyle = 'rgba(122, 69, 16, 0.35)';
            ctx.lineWidth = Math.max(0.8, 1.3 * u);
            for (let i = 0; i < 7; i++) {
                const cx0 = x + rnd() * w, cy0 = y + h * (0.3 + rnd() * 0.5);
                ctx.beginPath(); ctx.arc(cx0, cy0, (3 + rnd() * 4) * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(255, 240, 200, 0.6)';
            ctx.beginPath(); ctx.ellipse(x + w * 0.28, y + h * 0.28, w * 0.16, h * 0.14, -0.2, 0, Math.PI * 2); ctx.fill();
        } else if (tofu.id === 'silken') {
            // 白嫩嫩：水亮的反光＋一滴水珠
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h * 0.3, w * 0.22, h * 0.1, -0.08, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(147, 197, 253, 0.55)';
            ctx.beginPath(); ctx.ellipse(x + w * 0.78, y + h * 0.66, 2.4 * u, 3.2 * u, 0, 0, Math.PI * 2); ctx.fill();
        } else if (tofu.id === 'fish') {
            // 烤得焦焦的格紋＋中間比較白
            const mid = ctx.createLinearGradient(0, y, 0, y + h);
            mid.addColorStop(0, 'rgba(255, 236, 200, 0)');
            mid.addColorStop(0.5, 'rgba(255, 236, 200, 0.55)');
            mid.addColorStop(1, 'rgba(255, 236, 200, 0)');
            ctx.fillStyle = mid;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(110, 55, 15, 0.45)';
            ctx.lineWidth = Math.max(1.2, 2.4 * u);
            ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
                const gx = x + w * (0.2 + i * 0.28);
                ctx.beginPath(); ctx.moveTo(gx, y + h * 0.15); ctx.lineTo(gx + w * 0.1, y + h * 0.85); ctx.stroke();
            }
        }
    }

    // 畫一塊豆腐海兔（長方形身體＋海兔耳朵）；top = 最上面那塊（畫耳朵和臉）
    // w、h 是畫面上的寬高；squash 是落下時壓扁的比例（1 = 不壓）
    function drawTofu(ctx, tofu, cx, bottom, w, h, scale, seed, top, alpha, squash) {
        const sq = squash || 1;
        // 嫩豆腐一直軟軟地抖
        const wobble = tofu.id === 'silken' ? 1 + Math.sin(performance.now() / 120 + seed) * 0.035 : 1;
        w = w * wobble / Math.sqrt(sq);
        h = h * sq;
        const x = cx - w / 2, y = bottom - h;
        const lw = Math.max(1.5, 3 * scale);
        ctx.save();
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        if (top) {
            ctx.fillStyle = tofu.ear;
            ctx.strokeStyle = tofu.outline;
            ctx.lineWidth = Math.max(1.5, 2.5 * scale);
            const ew = Math.min(w, 100 * scale);
            [[-0.22, -0.32], [0.02, 0.05]].forEach(([dx, tilt]) => {
                ctx.beginPath();
                ctx.ellipse(cx + dx * ew, y - h * 0.28, ew * 0.07, h * 0.42, tilt, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
            });
            // 臭豆腐飄出綠色臭氣
            if (tofu.id === 'stinky') {
                ctx.strokeStyle = 'rgba(101, 163, 13, 0.75)';
                ctx.lineWidth = Math.max(1.2, 2.4 * scale);
                ctx.lineCap = 'round';
                [[0.3, 0], [0.42, 0.6]].forEach(([fx, ph]) => {
                    const t = performance.now() / 400 + ph;
                    ctx.beginPath();
                    for (let i = 0; i <= 10; i++) {
                        const yy = y - h * 0.1 - i * 2.2 * scale;
                        const xx = x + w * (fx + 0.32) + Math.sin(i * 0.9 + t) * 3 * scale;
                        if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
                    }
                    ctx.stroke();
                });
            }
        }
        roundRect(ctx, x, y, w, h, h * tofu.radius);
        ctx.fillStyle = tofu.body;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = tofu.shade;                 // 下緣深一點，看起來有厚度
        ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
        drawTofuTexture(ctx, tofu, x, y, w, h, scale, seed);
        ctx.restore();
        roundRect(ctx, x, y, w, h, h * tofu.radius);
        ctx.lineWidth = lw;
        ctx.strokeStyle = tofu.outline;
        ctx.stroke();
        if (tofu.id === 'frozen' && top) {
            // 凍豆腐的小冰晶
            ctx.strokeStyle = '#7cc4f0';
            ctx.lineWidth = Math.max(1, 1.6 * scale);
            const fx = x + w * 0.88, fy = y + h * 0.04, r = 4.5 * scale;
            for (let k = 0; k < 3; k++) {
                const a = (k * Math.PI) / 3;
                ctx.beginPath(); ctx.moveTo(fx - Math.cos(a) * r, fy - Math.sin(a) * r); ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r); ctx.stroke();
            }
        }
        if (top) {
            const eye = tofu.id === 'dried' ? '#140a03' : '#2c3e50';
            const fw = Math.min(w, 100 * scale);   // 臉的大小不跟著寬窄變
            [-0.12, 0.12].forEach((dx) => {
                ctx.fillStyle = eye;
                ctx.beginPath(); ctx.arc(cx + dx * fw, y + h * 0.46, Math.max(1.4, 3.6 * scale), 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(cx + dx * fw + 1.2 * scale, y + h * 0.46 - 1.2 * scale, Math.max(0.6, 1.3 * scale), 0, Math.PI * 2); ctx.fill();
            });
            ctx.strokeStyle = eye;
            ctx.lineWidth = Math.max(1, 1.8 * scale);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(cx, y + h * 0.56, 2.6 * scale, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
            ctx.fillStyle = '#fb7185';
            ctx.globalAlpha *= tofu.id === 'dried' ? 0.6 : 0.75;
            [-0.26, 0.26].forEach((dx) => { ctx.beginPath(); ctx.ellipse(cx + dx * fw, y + h * 0.64, 6 * scale, 3.4 * scale, 0, 0, Math.PI * 2); ctx.fill(); });
        }
        ctx.restore();
    }

    // 對局裡第 level 層的積木
    function drawBlock(ctx, level, cx, bottom, scale, top, alpha, squash) {
        drawTofu(ctx, tofuOf(level), cx, bottom, widthOf(level) * scale, BLOCK_H * scale, scale, level, top, alpha, squash);
    }

    // ---------- 🔊 音效（用 Web Audio 合成，不用另外放音檔）與📳 震動 ----------
    let audioCtx = null;
    function soundOn() { try { return localStorage.getItem('stackSound') !== 'off'; } catch (e) { return true; } }
    function setSound(on) { try { localStorage.setItem('stackSound', on ? 'on' : 'off'); } catch (e) { /* 私密模式存不了就算了 */ } }
    function tone(freq, dur, type, vol, slideTo, delay) {
        if (!soundOn()) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const t0 = audioCtx.currentTime + (delay || 0);
            const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, t0);
            if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
            gain.gain.setValueAtTime(vol || 0.15, t0);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t0);
            osc.stop(t0 + dur + 0.02);
        } catch (e) { /* 瀏覽器不支援就安靜 */ }
    }
    function noise(dur, vol) {
        if (!soundOn()) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const len = Math.floor(audioCtx.sampleRate * dur);
            const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = audioCtx.createBufferSource(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 900;
            gain.gain.value = vol || 0.25;
            src.buffer = buf;
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start();
        } catch (e) { /* 瀏覽器不支援就安靜 */ }
    }
    function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 不支援就算了 */ } }
    const sfx = {
        drop(tofu) { tone(tofu && tofu.id === 'fried' ? 520 : 300, 0.12, 'sine', 0.18, 140); buzz(12); },
        perfect(n) {
            const base = 660 * Math.pow(1.06, Math.min(n - 1, 10));   // 連擊越多越高音
            tone(base, 0.16, 'triangle', 0.16); tone(base * 1.5, 0.22, 'triangle', 0.12, null, 0.08);
            buzz([15, 30, 15]);
        },
        fall() { noise(0.6, 0.3); tone(220, 0.5, 'sawtooth', 0.06, 70); buzz([60, 40, 90]); },
        tick() { tone(880, 0.08, 'square', 0.06); },
        go() { tone(1175, 0.18, 'square', 0.07); },
        win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, null, i * 0.11)); },
        stink() { tone(140, 0.35, 'sawtooth', 0.05, 90); },
    };

    // ---------- 🏅 個人最高紀錄（存在這台裝置的瀏覽器） ----------
    function bestHeight() { try { return Number(localStorage.getItem('stackBest')) || 0; } catch (e) { return 0; } }
    function saveBest(h) { try { localStorage.setItem('stackBest', String(h)); } catch (e) { /* 存不了就算了 */ } }

    function draw() {
        const canvas = $('stCanvas');
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const r = state.rules;
        const worldW = (r.swingRange + r.blockWidth / 2) * 2 + 40;
        const scale = Math.min(W / worldW, H / (BLOCK_H * 9));
        const p = viewed();
        const blocks = viewedBlocks();
        const now = performance.now();
        const isMe = p && p.socketId === myId();
        const groundH = 26 * scale;

        // 鏡頭跟著塔頂走：塔頂上方留空間給移動中的積木（含耳朵）；剛打開或換人看時直接跳過去
        const topY = blocks.length * BLOCK_H;
        const visible = (H - groundH) / scale;
        const target = Math.max(0, topY + BLOCK_H * 3.8 - visible);
        camBottom = camBottom < 0 ? target : camBottom + (target - camBottom) * 0.12;
        const sy = (wy) => H - groundH - (wy - camBottom) * scale;
        const sx = (wx) => W / 2 + wx * scale;

        // 背景：海水漸層＋泡泡
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#bfe9ff');
        bg.addColorStop(1, '#e8f7ff');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 9; i++) {
            const bx = ((i * 137) % 100) / 100 * W;
            const by = (H - ((now / 30 + i * 90) % (H + 40))) ;
            ctx.beginPath(); ctx.arc(bx, by, (3 + (i % 3) * 2) * scale, 0, Math.PI * 2); ctx.fill();
        }
        // 層數刻度
        ctx.font = `900 ${Math.max(10, 12 * scale)}px Nunito, sans-serif`;
        ctx.fillStyle = 'rgba(30, 58, 138, 0.35)';
        ctx.textAlign = 'left';
        for (let lv = 5; lv * BLOCK_H < camBottom + visible + BLOCK_H; lv += 5) {
            const y = sy(lv * BLOCK_H);
            if (y < 0 || y > H) continue;
            ctx.fillRect(0, y, 14 * scale, 2);
            ctx.fillText(String(lv), 18 * scale, y + 4 * scale);
        }
        // 沙地
        const gy = sy(0);
        if (gy < H) {
            ctx.fillStyle = '#fde7b0';
            ctx.fillRect(0, gy, W, H - gy);
            ctx.fillStyle = '#f5d48a';
            ctx.fillRect(0, gy, W, 4 * scale);
        }

        // 塔：第 0 層是地基（畫成木頭砧板）
        blocks.forEach((x, lv) => {
            const bottom = sy(lv * BLOCK_H);
            if (bottom < -BLOCK_H * scale || bottom - BLOCK_H * scale > H) return;
            if (lv === 0) {
                const bw = r.baseWidth * scale, bh = BLOCK_H * scale, bx = sx(x) - bw / 2, by = bottom - bh;
                ctx.save();
                roundRect(ctx, bx, by, bw, bh, 8 * scale);
                ctx.fillStyle = '#d6a46a'; ctx.fill();
                ctx.strokeStyle = 'rgba(138, 90, 50, 0.45)'; ctx.lineWidth = Math.max(1, 1.5 * scale);
                [0.3, 0.55, 0.78].forEach((f, i) => {
                    ctx.beginPath(); ctx.moveTo(bx + bw * 0.06, by + bh * f);
                    ctx.bezierCurveTo(bx + bw * 0.35, by + bh * (f - 0.08), bx + bw * 0.6, by + bh * (f + 0.08), bx + bw * (0.9 - i * 0.05), by + bh * f);
                    ctx.stroke();
                });
                ctx.fillStyle = '#8a5a32';
                ctx.beginPath(); ctx.arc(bx + bw * 0.92, by + bh * 0.3, 3 * scale, 0, Math.PI * 2); ctx.fill();   // 掛繩的洞
                roundRect(ctx, bx, by, bw, bh, 8 * scale);
                ctx.lineWidth = Math.max(1.5, 3 * scale); ctx.strokeStyle = '#8a5a32'; ctx.stroke();
                ctx.restore();
                return;
            }
            let b = bottom, squash = 1;
            if (isMe && dropAnim && dropAnim.level === lv) {
                // 先掉下來，落地時壓扁一下再彈回來；油豆腐會多彈一次
                const t = (now - dropAnim.start) / DROP_MS;
                const bouncy = tofuOf(lv).id === 'fried';
                if (t < 1) b = bottom - (1 - t * t) * BLOCK_H * 1.2 * scale;
                else if (t < 2.2) squash = 1 - 0.14 * Math.sin(((t - 1) / 1.2) * Math.PI);
                else if (bouncy && t < 3.6) b = bottom - Math.sin(((t - 2.2) / 1.4) * Math.PI) * BLOCK_H * 0.35 * scale;
                else dropAnim = null;
            }
            // 還在疊的時候臉畫在移動中的積木上；倒了或離開才畫在塔頂
            const done = p && (p.out || (isMe && myOut));
            drawBlock(ctx, lv, sx(x), b, scale, lv === blocks.length - 1 && !falling && done, 1, squash);
        });

        // 倒下去的那一截：以下面那塊的邊緣為支點轉下去，再往下掉
        if (falling && p && falling.ownerId === p.socketId) {
            const t = (now - falling.start) / FALL_MS;
            if (t >= 1) {
                falling = null;
            } else {
                const pivotX = sx(falling.pivot + falling.dir * falling.pivotHalf);
                const pivotY = sy(falling.fromLevel * BLOCK_H);
                ctx.save();
                ctx.translate(pivotX, pivotY + t * t * H * 0.9);
                ctx.rotate(falling.dir * Math.min(Math.PI / 2, t * 2.4));
                falling.blocks.forEach((x, i) => {
                    drawBlock(ctx, falling.fromLevel + i, sx(x) - pivotX, -i * BLOCK_H * scale, scale, i === falling.blocks.length - 1, 1 - t * 0.5);
                });
                ctx.restore();
            }
        }

        // 移動中的積木（自己的才精準；看別人的塔時照收到消息的時間推估）
        if (p && !p.out && !(isMe && myOut)) {
            const spawn = isMe ? mySpawnLocal : (p._spawnLocal || 0);
            const elapsed = now - spawn;
            const level = blocks.length;
            if (elapsed >= 0 && level <= state.phases.length) {
                if (isMe && level === 1 && lastTick) { lastTick = 0; sfx.go(); }
                const x = blockX(level, elapsed);
                const bottom = sy(level * BLOCK_H + BLOCK_H * 1.4);
                ctx.save();
                ctx.setLineDash([4 * scale, 5 * scale]);
                ctx.strokeStyle = 'rgba(30, 58, 138, 0.25)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(sx(x), bottom); ctx.lineTo(sx(x), sy(level * BLOCK_H)); ctx.stroke();
                ctx.restore();
                drawBlock(ctx, level, sx(x), bottom, scale, true, 0.95);
                // 左上角寫這塊是什麼豆腐
                const label = T('nowTofu', tofuName(tofuOf(level)));
                ctx.font = `900 ${Math.max(12, Math.round(15 * scale))}px Nunito, Huninn, sans-serif`;
                ctx.textAlign = 'left';
                const lw = ctx.measureText(label).width, pad = 8 * scale, lh = 26 * scale;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                roundRect(ctx, 12 * scale, 14 * scale, lw + pad * 2, lh, lh / 2);
                ctx.fill();
                ctx.fillStyle = '#7a4a12';
                ctx.fillText(label, 12 * scale + pad, 14 * scale + lh * 0.7);
            } else if (elapsed < 0 && level === 1) {
                // 開局倒數（每秒嗶一聲）
                const secs = Math.ceil(-elapsed / 1000);
                if (isMe && secs !== lastTick) { lastTick = secs; sfx.tick(); }
                ctx.fillStyle = 'rgba(30, 58, 138, 0.85)';
                ctx.font = `900 ${Math.round(70 * scale)}px Nunito, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(T('countdown', secs), W / 2, H * 0.42);
            }
        }

        // ✨ 完美：落點冒出一圈光＋往上飄的字
        effects = effects.filter((fx) => now - fx.start < 900);
        if (isMe) effects.forEach((fx) => {
            const t = (now - fx.start) / 900;
            const cx = sx(fx.x), cy = sy(fx.level * BLOCK_H + BLOCK_H * 0.5);
            ctx.save();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 4 * scale * (1 - t) + 1;
            ctx.beginPath(); ctx.ellipse(cx, cy, (40 + t * 70) * scale, (14 + t * 26) * scale, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.font = `900 ${Math.round(26 * scale)}px Nunito, Huninn, sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 5 * scale;
            ctx.strokeStyle = '#fff';
            ctx.strokeText(fx.text, cx, cy - (30 + t * 40) * scale);
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(fx.text, cx, cy - (30 + t * 40) * scale);
            ctx.restore();
        });

        // 高度大字
        ctx.textAlign = 'right';
        ctx.font = `900 ${Math.round(30 * scale)}px Nunito, sans-serif`;
        ctx.fillStyle = '#1e3a8a';
        ctx.fillText(T('height', blocks.length - 1), W - 14 * scale, 40 * scale);
    }

    // ---------- 收到伺服器的狀態 ----------
    function loadState(s) {
        state = { rules: s.rules, phases: s.phases, tofus: s.tofus, players: s.players };
        combo = 0;
        effects = [];
        lastTick = 0;
        endsAtLocal = Date.now() + (s.endsInMs || 0);
        const now = performance.now();
        const mine = me();
        myView = mine ? [...mine.blocks] : null;
        myOut = mine ? mine.out : null;
        mySpawnLocal = mine && s.mySpawnInMs != null ? now + s.mySpawnInMs : 0;
        // 別人的積木出現時間不知道，先用自己的估：開局時大家一樣
        state.players.forEach((p) => { p._spawnLocal = now + (s.mySpawnInMs != null ? s.mySpawnInMs : 0); });
        if (!viewId || !state.players.some((p) => p.socketId === viewId)) {
            viewId = mine ? mine.socketId : [...state.players].sort((a, b) => b.height - a.height)[0].socketId;
        }
        if (mine) viewId = mine.socketId;
        dropAnim = null;
        falling = null;
        camBottom = -1;
    }

    function onDropped({ socketId, level, x, perfect, fallFrom, height, out }) {
        if (!state) return;
        const p = state.players.find((q) => q.socketId === socketId);
        if (!p) return;
        const before = [...p.blocks];
        p.blocks.length = level;
        p.blocks.push(x);
        if (fallFrom !== -1) p.blocks = p.blocks.slice(0, fallFrom);
        p.height = height;
        p.out = out;
        p._spawnLocal = performance.now() + state.rules.dropGapMs;

        if (socketId === myId()) {
            // 自己算的跟伺服器不一樣（例如網路延遲被拉回範圍）：以伺服器為準
            const same = myView.length === p.blocks.length && myView.every((v, i) => Math.abs(v - p.blocks[i]) < 0.01) && myOut === out;
            if (!same) {
                if (out === 'fell' && !myOut) startFalling([...before, x], fallFrom, socketId);
                myView = [...p.blocks];
                myOut = out;
                renderStatus();
            }
        } else if (socketId === viewId && fallFrom !== -1) {
            startFalling([...before.slice(0, level), x], fallFrom, socketId);
        }
        renderSide();
        if (socketId !== myId()) {
            bumpCard(socketId, fallFrom !== -1 ? T('fellPop') : (perfect ? '✨+1' : T('plusOne')), fallFrom !== -1);
            // 別人放了臭豆腐，還在疊的人畫面會被臭到
            if (fallFrom === -1 && tofuOf(level).id === 'stinky' && me() && !myOut) showStink(p.petName);
        }
    }

    function endGame(data) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        lastResult = data;
        const wasPlayer = data.players.some((p) => p.socketId === myId());
        const overlay = $('stackGameOverlay');
        // 自己有參加：比一下最高紀錄
        data._newBest = false;
        const mine = data.players.find((p) => p.socketId === myId());
        if (mine && mine.height > bestHeight()) { saveBest(mine.height); data._newBest = true; }
        if (mine && (data._newBest || data.winners.includes(myId()))) sfx.win();
        state = null;
        myView = null;
        if (!wasPlayer && (!overlay || overlay.hidden)) {
            showFloatText(T('endedWatching'));
            notifyStatus();
            return;
        }
        ensureOverlay().hidden = false;
        renderResult(data);
        $('stLobby').hidden = true;
        $('stGame').hidden = true;
        $('stResult').hidden = false;
        notifyStatus();
    }

    function renderResult(data) {
        const result = $('stResult');
        result.innerHTML = '';
        const iWon = data.winners.includes(myId());
        const solo = data.players.length === 1;   // 一個人玩：不說誰贏，只說疊了幾層
        result.appendChild(el('div', 'mg-result-title', solo ? T('soloResult', data.players[0].height)
            : data.draw ? (iWon ? T('draw') : T('over')) : (iWon ? T('youWin') : T('over'))));
        const list = el('ol', 'mg-ranking');
        [...data.players].sort((a, b) => (a.out === 'left') - (b.out === 'left') || b.height - a.height).forEach((p) => {
            const li = el('li', data.winners.includes(p.socketId) ? 'is-winner' : '');
            li.appendChild(el('span', '', p.socketId === myId() ? T('me', p.petName) : p.petName));
            li.appendChild(el('b', '', p.out === 'left' ? T('outLeft') : T('height', p.height)));
            list.appendChild(li);
        });
        result.appendChild(list);
        if (data.draw) result.appendChild(el('p', 'mg-note', T('drawNote')));
        const mine = data.players.find((p) => p.socketId === myId());
        if (mine) result.appendChild(el('p', 'st-result-best' + (data._newBest ? ' is-new' : ''), data._newBest ? T('newBest', mine.height) : T('best', bestHeight())));
        const again = el('button', 'mg-start', isRoomHost ? T('again') : T('backToLobby'));
        again.type = 'button';
        again.addEventListener('click', showLobby);
        result.appendChild(again);
    }

    function resetLocal(message) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        state = null;
        myView = null;
        hideInvite();
        notifyStatus();
        const overlay = $('stackGameOverlay');
        if (overlay && !overlay.hidden) showLobby();
        if (message) showFloatText(message, 4000);
    }

    // ---------- 開局邀請（跟翻牌對決同一種樣子） ----------
    let invite = null, inviteDeadline = 0, inviteTick = null, myInviteChoice = null, inviteTotal = 15000;

    function ensureInvite() {
        let box = $('stInvite');
        if (box) return box;
        box = el('div', 'mg-invite');
        box.id = 'stInvite';
        box.hidden = true;
        box.setAttribute('role', 'dialog');
        box.innerHTML = `
            <div class="mg-invite-card">
                <div class="mg-invite-icon" aria-hidden="true">🧱</div>
                <div class="mg-invite-body">
                    <div class="mg-invite-title" id="stInviteTitle"></div>
                    <div class="mg-invite-sub" id="stInviteSub"></div>
                    <div class="mg-invite-joined" id="stInviteJoined"></div>
                </div>
                <div class="mg-invite-actions" id="stInviteActions">
                    <button type="button" class="mg-invite-join" id="stInviteJoin"></button>
                    <button type="button" class="mg-invite-watch" id="stInviteWatch"></button>
                </div>
            </div>
            <div class="mg-invite-bar"><i id="stInviteBar"></i></div>`;
        document.body.appendChild(box);
        const reply = (join) => {
            if (!boundSocket || !invite) return;
            myInviteChoice = join ? 'join' : 'watch';
            boundSocket.emit('stack_invite_reply', { join });
            renderInvite();
        };
        $('stInviteJoin').addEventListener('click', () => reply(true));
        $('stInviteWatch').addEventListener('click', () => reply(false));
        return box;
    }
    function showInvite(data) {
        const isNew = !invite;
        invite = data;
        inviteDeadline = Date.now() + (data.msLeft || 0);
        if (isNew) { myInviteChoice = null; inviteTotal = data.msLeft || 15000; }
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
        const box = $('stInvite');
        if (box) box.hidden = true;
    }
    function renderInvite() {
        if (!invite) return;
        const isHost = invite.hostId === myId();
        const secs = Math.max(0, Math.ceil((inviteDeadline - Date.now()) / 1000));
        $('stInviteTitle').textContent = isHost ? T('inviteHostTitle') : T('inviteTitle', invite.hostName);
        $('stInviteSub').textContent = T('inviteSub', secs);
        const names = invite.joined.map((p) => (p.socketId === myId() ? T('me', p.petName) : p.petName)).join(isEn() ? ', ' : '、');
        $('stInviteJoined').textContent = T('inviteJoined', names) + (invite.waiting ? `｜${T('inviteWaiting', invite.waiting)}` : '');
        $('stInviteActions').hidden = isHost;
        const join = $('stInviteJoin'), watch = $('stInviteWatch');
        join.textContent = myInviteChoice === 'join' ? T('inviteJoinedMe') : T('inviteJoin');
        watch.textContent = myInviteChoice === 'watch' ? T('inviteWatchMe') : T('inviteWatch');
        join.classList.toggle('is-chosen', myInviteChoice === 'join');
        watch.classList.toggle('is-chosen', myInviteChoice === 'watch');
        $('stInviteBar').style.width = Math.max(0, Math.min(100, ((inviteDeadline - Date.now()) / inviteTotal) * 100)) + '%';
    }

    // 連線面板上的「疊疊樂」按鈕跟著換字
    function getStatus() {
        if (state) return isSpectator() ? 'watching' : 'playing';
        if (invite) return 'inviting';
        return 'idle';
    }
    function notifyStatus() { if (typeof updateMpGamesUI === 'function') updateMpGamesUI(); }

    // ---------- 跟伺服器溝通 ----------
    function bindSocket(socket) {
        if (!socket || boundSocket === socket) return;
        boundSocket = socket;
        socket.on('connect', () => { if (currentRoomId) socket.emit('stack_sync'); });
        socket.on('room_joined', () => socket.emit('stack_sync'));
        socket.on('stack_error', ({ message }) => showFloatText(serverNotice(message) || T('error')));
        socket.on('stack_unlocked', () => {
            if (unlocked) return;
            unlocked = true;
            showFloatText(T('unlocked'), 4000);
            notifyStatus();
        });
        socket.on('stack_invite', showInvite);
        socket.on('stack_invite_update', (data) => { if (invite) showInvite(data); });
        socket.on('stack_invite_cancelled', ({ message }) => {
            hideInvite();
            notifyStatus();
            showFloatText(serverNotice(message) || T('inviteCancelled'), 4000);
        });
        socket.on('stack_started', (s) => {
            unlocked = true;
            hideInvite();
            loadState(s);
            const overlay = ensureOverlay();
            if (isSpectator() && overlay.hidden) {
                showFloatText(T('startedWatching'), 4000);
            } else {
                overlay.hidden = false;
                showGame();
                showFloatText(T('started'));
            }
            notifyStatus();
        });
        socket.on('stack_state', (s) => {
            unlocked = true;
            hideInvite();
            loadState(s);
            const overlay = $('stackGameOverlay');
            if (overlay && !overlay.hidden) showGame();
            notifyStatus();
        });
        socket.on('stack_dropped', onDropped);
        socket.on('stack_players', ({ players, notice }) => {
            if (!state) return;
            // 伺服器的玩家順序整局不變，斷線回來的人換了 socketId，照順序對回去
            players.forEach((np, i) => {
                const p = state.players[i];
                if (!p) return;
                if (viewId === p.socketId) viewId = np.socketId;
                Object.assign(p, np);
            });
            renderSide();
            renderStatus(notice);
        });
        socket.on('stack_ended', endGame);
    }

    function refreshLang() {
        renderInvite();
        if (!$('stackGameOverlay')) return;
        applyStaticText();
        if (state) { renderSide(); renderStatus(); }
        if (!$('stResult').hidden && lastResult) renderResult(lastResult);
    }

    function leaveRoom() {
        unlocked = false;
        resetLocal();
        closeOverlay();
    }

    window.StackGame = { bindSocket, open: openOverlay, leaveRoom, refreshLang, status: getStatus, isUnlocked: () => unlocked };
})();
