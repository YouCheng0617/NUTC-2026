// 😴 【待機畫面】跟論壇主頁一樣：5 分鐘沒操作，或離開分頁超過 5 分鐘回來時顯示，點一下叫醒
//    中間睡覺的是玩家自己的海兔（用目前的品種顏色畫），文字跟著遊戲的中／英切換
(function () {
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
    const QUOTES = {
        zh: [
            '慢慢來，海浪也是一波一波的。',
            '累了就休息一下，海兔會乖乖等你。',
            '今天也辛苦了，喝口水再回來吧。',
            '水草輕輕搖，海兔睡得好香。'
        ],
        en: [
            'Take it slow — even waves come one at a time.',
            "Tired? Take a break. Your sea bunny will wait for you.",
            'You did great today. Grab some water and come back.',
            'The seaweed sways, and your sea bunny sleeps soundly.'
        ]
    };
    // 遠處漂浮的瓶子只放在四周邊緣：[left%, top%, 大小cqmin, 透明度, 秒數, 是否更遠]（跟主頁同一組）
    const BOTTLES = [
        [6, 10, 11, 0.55, 7, false], [80, 16, 8, 0.4, 9, true], [4, 52, 7, 0.35, 8, true],
        [84, 48, 12, 0.55, 6.5, false], [10, 80, 9, 0.45, 10, true], [76, 82, 10, 0.5, 7.5, false]
    ];
    const BUBBLES = [[14, 2.4, 9], [28, 1.4, 7], [46, 1.8, 12], [66, 1.2, 8], [88, 2, 11], [56, 1, 6]];

    const isEn = () => { try { return typeof currLang !== 'undefined' && currLang === 'en'; } catch (e) { return false; } };

    // 睡覺的海兔：眼睛閉起來、頭上冒 Zz
    function sleepingSlug() {
        const sd = typeof speciesData !== 'undefined' ? speciesData : null;
        const key = typeof gameState !== 'undefined' && gameState.currentSpecies;
        // 小丑海兔照玩家選的配色（slug_game.js 的 speciesSpec）
        const spec = sd && typeof speciesSpec === 'function' && sd[key] ? speciesSpec(key, gameState.jokerStyle) : null;
        const s = spec || (sd && (sd[key] || sd.snow)) || { body: '#fff', outline: '#3f2a2a', earTop: '#3f2a2a', tail: '#3f2a2a', spot: '#3f2a2a', blush: '#fca5a5' };
        return `
            <svg class="slug-idle-pet" viewBox="20 0 320 240" aria-hidden="true">
                <g stroke="${s.outline}" stroke-width="6" stroke-linejoin="round">
                    <path d="M 250 170 C 270 180, 300 190, 290 140 C 280 100, 250 140, 240 170 Z" fill="${s.tail}"/>
                    <path d="M 260 150 C 290 160, 320 120, 280 80 C 260 60, 230 110, 250 150 Z" fill="${s.tail}"/>
                    <path d="M 70 190 C 20 180, 30 120, 90 110 C 160 100, 220 105, 260 130 C 290 150, 280 200, 200 210 C 130 220, 90 200, 70 190 Z" fill="${s.body}"/>
                    <path d="M 100 105 C 80 50, 95 20, 110 25 C 125 30, 120 90, 115 105 Z" fill="${s.earTop}"/>
                    <path d="M 145 100 C 135 45, 160 15, 175 25 C 190 35, 165 85, 160 100 Z" fill="${s.earTop}"/>
                </g>
                <g fill="${s.spot}"><circle cx="125" cy="125" r="6"/><circle cx="210" cy="140" r="6.5"/><circle cx="145" cy="180" r="6.5"/><circle cx="230" cy="175" r="5.5"/></g>
                <!-- 閉著的眼睛用描邊色，深色的海兔（星空、黑曜石）才看得到 -->
                <g transform="translate(130, 150)">
                    <ellipse cx="-35" cy="12" rx="14" ry="8" fill="${s.blush}" opacity="0.85"/>
                    <ellipse cx="35" cy="12" rx="14" ry="8" fill="${s.blush}" opacity="0.85"/>
                    <path d="M -28 0 Q -20 7 -12 0 M 12 0 Q 20 7 28 0" fill="none" stroke="${s.outline}" stroke-width="4" stroke-linecap="round"/>
                    <path d="M -5 12 Q 0 15 5 12" fill="none" stroke="${s.outline}" stroke-width="3" stroke-linecap="round"/>
                </g>
                <text x="250" y="60" class="slug-idle-zzz" font-size="34">Z</text>
                <text x="285" y="30" class="slug-idle-zzz slug-idle-zzz-2" font-size="24">z</text>
            </svg>`;
    }

    window.isSlugIdleOn = false;
    let idleTimer = null;
    let clockTimer = null;
    let hiddenAt = null;
    let leaving = false;

    function updateClock(screen) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        screen.querySelector('.slug-idle-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        screen.querySelector('.slug-idle-date').textContent = isEn()
            ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : `${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${'日一二三四五六'[now.getDay()]}`;
    }

    function showIdleScreen() {
        if (window.isSlugIdleOn) return;
        window.isSlugIdleOn = true;
        leaving = false;
        clearTimeout(idleTimer);

        // 收起手機鍵盤；已輸入的文字會保留
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();

        const en = isEn();
        const name = (typeof gameState !== 'undefined' && gameState.petName) || (en ? 'Your sea bunny' : '海兔');
        const screen = document.createElement('div');
        screen.id = 'slugIdleScreen';
        screen.className = 'slug-idle';
        screen.tabIndex = 0;
        screen.setAttribute('role', 'button');
        screen.setAttribute('aria-label', en ? 'Idle — tap to go back to the game' : '待機中，點一下回到遊戲');
        const bottles = BOTTLES.map(([left, top, size, opacity, dur, far], i) =>
            `<span class="slug-idle-bottle${far ? ' far' : ''}" style="left:${left}%;top:${top}%;font-size:${size}cqmin;opacity:${opacity};animation-duration:${dur}s;animation-delay:-${i * 1.7}s"></span>`).join('');
        const bubbles = BUBBLES.map(([left, size, dur], i) =>
            `<span class="slug-idle-bubble" style="left:${left}%;width:${size}cqmin;height:${size}cqmin;animation-duration:${dur}s;animation-delay:-${i * 2.1}s"></span>`).join('');
        screen.innerHTML = `
            ${bottles}${bubbles}
            <div class="slug-idle-center">
                <div class="slug-idle-time"></div>
                <div class="slug-idle-date"></div>
                ${sleepingSlug()}
                <div class="slug-idle-title"></div>
                <div class="slug-idle-quote"></div>
            </div>
            <div class="slug-idle-hint"></div>`;
        // 名字是玩家取的，一律當純文字
        screen.querySelector('.slug-idle-title').textContent = en ? `${name} fell asleep…` : `${name} 睡著了…`;
        const list = QUOTES[en ? 'en' : 'zh'];
        screen.querySelector('.slug-idle-quote').textContent = list[Math.floor(Math.random() * list.length)];
        screen.querySelector('.slug-idle-hint').textContent = en ? 'Tap to wake it up' : '點一下叫醒牠';
        updateClock(screen);
        clockTimer = setInterval(() => updateClock(screen), 10000);

        // 點擊與觸控只屬於待機畫面，不傳到底下的遊戲（避免誤召喚海兔、誤點按鈕）
        ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'dblclick'].forEach((type) =>
            screen.addEventListener(type, (e) => e.stopPropagation()));
        screen.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideIdleScreen();
        });
        document.body.appendChild(screen);
        screen.focus({ preventScroll: true });
    }

    function hideIdleScreen() {
        const screen = document.getElementById('slugIdleScreen');
        if (!screen || leaving) return;
        leaving = true;
        clearInterval(clockTimer);
        screen.classList.add('leaving');
        setTimeout(() => {
            screen.remove();
            window.isSlugIdleOn = false;
            leaving = false;
            resetIdleTimer();
        }, 350);
    }

    function resetIdleTimer() {
        if (window.isSlugIdleOn) return;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(showIdleScreen, IDLE_TIMEOUT_MS);
    }

    ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'keydown'].forEach((type) =>
        document.addEventListener(type, resetIdleTimer, { passive: true, capture: true }));
    document.addEventListener('scroll', resetIdleTimer, { passive: true, capture: true });

    // 待機中按鍵盤：不讓按鍵打進底下的輸入框，Enter / 空白 / Esc 可以叫醒
    document.addEventListener('keydown', (e) => {
        if (!window.isSlugIdleOn) return;
        e.preventDefault();
        e.stopPropagation();
        if (['Enter', ' ', 'Escape'].includes(e.key)) hideIdleScreen();
    }, true);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
        if (hiddenAt && Date.now() - hiddenAt >= IDLE_TIMEOUT_MS) showIdleScreen();
        else resetIdleTimer();
        hiddenAt = null;
    });

    resetIdleTimer();
    window.SlugIdle = { show: showIdleScreen, hide: hideIdleScreen };
})();
