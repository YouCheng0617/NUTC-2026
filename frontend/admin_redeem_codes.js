// ==========================================
// 🎁 寵物遊戲兌換碼（後台建立、管理）
// 後端：GET/POST /admin/redeem-codes、PUT /admin/redeem-codes/:id/active、
//       DELETE /admin/redeem-codes/:id、GET /admin/redeem-codes/:id/uses
// 玩家兌換：POST /pet-games/redeem { code }
//
// 商品的名字與小圖直接讀寵物遊戲的 slug_game.js（speciesData / bgData / effectData），
// 遊戲商店新增商品，這裡就會自動出現，不用另外維護一份清單。
// 用到 admin.js 的 API_BASE_URL、PAGE_SIZE、escapeHTML、jsArg、renderPagination
// ==========================================
(function () {
    const TABS = [
        { key: 'species', category: 'pet_color', label: '🐌 寵物皮膚' },
        { key: 'bg', category: 'background_color', label: '🖼️ 背景' },
        { key: 'effect', category: 'background_effects', label: '✨ 特效' },
    ];
    const CATEGORY_LABEL = { pet_color: '皮膚', background_color: '背景', background_effects: '特效' };
    const STATE_BADGE = {
        active: { text: '🟢 可使用', bg: '#dcfce7', color: '#15803d' },
        disabled: { text: '⏸️ 已停用', bg: '#f1f5f9', color: '#64748b' },
        expired: { text: '⌛ 已過期', bg: '#fef3c7', color: '#b45309' },
        used_up: { text: '🈵 已額滿', bg: '#fee2e2', color: '#b91c1c' },
    };

    let catalog = null;          // { pet_color: { key: { name, thumb } }, ... }
    let catalogError = '';
    let currentTab = 'species';
    const selected = new Map();  // "category:item" -> { category, item }
    let allCodes = [];
    let page = 1;

    const token = () => localStorage.getItem('authToken');
    const $ = (id) => document.getElementById(id);

    // ---------- 讀遊戲商品資料 ----------
    function objectEnd(text, from) {
        let i = text.indexOf('{', from), depth = 0, quote = null;
        for (; i < text.length; i++) {
            const c = text[i];
            if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
            if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
            if (c === '{') depth++;
            else if (c === '}' && --depth === 0) return i + 1;
        }
        return -1;
    }
    function literal(src, name) {
        const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\{`));
        if (!m) throw new Error(`找不到 ${name}`);
        return src.slice(m.index, objectEnd(src, m.index));
    }

    function petThumb(spec) {
        return `<svg viewBox="40 15 270 210" aria-hidden="true">
            <g stroke="${spec.outline}" stroke-width="6" stroke-linejoin="round">
                <path d="M 260 150 C 290 160, 320 120, 280 80 C 260 60, 230 110, 250 150 Z" fill="${spec.tail}"/>
                <path d="M 70 190 C 20 180, 30 120, 90 110 C 160 100, 220 105, 260 130 C 290 150, 280 200, 200 210 C 130 220, 90 200, 70 190 Z" fill="${spec.body}"/>
                <path d="M 100 105 C 80 50, 95 20, 110 25 C 125 30, 120 90, 115 105 Z" fill="${spec.earTop}"/>
                <path d="M 145 100 C 135 45, 160 15, 175 25 C 190 35, 165 85, 160 100 Z" fill="${spec.earTop}"/>
            </g>
            <g fill="${spec.spot}"><circle cx="125" cy="125" r="6"/><circle cx="210" cy="140" r="6"/><circle cx="160" cy="185" r="6"/></g>
            <g transform="translate(130, 150)">
                <circle cx="-20" cy="0" r="9" fill="#2c3e50"/><circle cx="20" cy="0" r="9" fill="#2c3e50"/>
                <ellipse cx="-36" cy="13" rx="13" ry="7" fill="${spec.blush}" opacity="0.85"/>
                <ellipse cx="36" cy="13" rx="13" ry="7" fill="${spec.blush}" opacity="0.85"/>
            </g>
        </svg>`;
    }

    async function loadCatalog() {
        if (catalog) return catalog;
        try {
            const res = await fetch(`slug_game.js?catalog=${Date.now()}`);
            if (!res.ok) throw new Error('讀不到 slug_game.js');
            const src = await res.text();

            const species = new Function(`${literal(src, 'speciesData')}; return speciesData;`)();
            const effects = new Function(`${literal(src, 'effectData')}; return effectData;`)();
            // 背景小圖是程式畫的：從背景插畫零件一路取到 bgData 結尾（只有定義，沒有畫面副作用）
            const artStart = src.indexOf('const roomParts');
            const bgStart = src.search(/const bgData\s*=\s*\{/);
            if (artStart < 0 || bgStart < 0) throw new Error('找不到背景資料');
            const bgs = new Function('gameState', `${src.slice(artStart, objectEnd(src, bgStart))}; return bgData;`)({ customBgColor: '#e2e8f0' });

            const css = (v) => (typeof v === 'function' ? v() : v) || '#e2e8f0';
            const build = (data, thumbOf) => Object.fromEntries(
                Object.entries(data)
                    .filter(([key, v]) => key !== 'none' && (v.cost || 0) > 0) // 一開始就有的免費項目不用發
                    .sort((a, b) => (a[1].cost || 0) - (b[1].cost || 0))
                    .map(([key, v]) => [key, { name: (v.name && v.name.zh) || key, cost: v.cost || 0, thumb: thumbOf(v) }])
            );
            catalog = {
                pet_color: build(species, (v) => ({ type: 'svg', html: petThumb(v) })),
                background_color: build(bgs, (v) => ({ type: 'bg', css: css(v.preview) })),
                background_effects: build(effects, (v) => ({ type: 'bg', css: css(v.preview) })),
            };
        } catch (e) {
            console.error('[兌換碼] 讀取商品資料失敗', e);
            catalogError = '讀不到寵物遊戲的商品資料，小圖無法顯示（請確認 slug_game.js 有沒有改名）';
            catalog = { pet_color: {}, background_color: {}, background_effects: {} };
        }
        return catalog;
    }

    function itemInfo(category, item) {
        return (catalog && catalog[category] && catalog[category][item]) || { name: item, thumb: null };
    }

    function thumbHTML(info, size) {
        const box = `width:${size}px; height:${size}px;`;
        if (!info.thumb) return `<span class="rd-thumb" style="${box}">❔</span>`;
        if (info.thumb.type === 'svg') return `<span class="rd-thumb" style="${box}">${info.thumb.html}</span>`;
        return `<span class="rd-thumb" style="${box}"></span>`;
    }
    // 背景類的縮圖是很長的 CSS（內嵌 SVG），不放進 HTML 字串，畫完再一個個套上去
    function applyBgThumbs(root) {
        root.querySelectorAll('[data-rd-thumb]').forEach((wrap) => {
            const [category, item] = wrap.dataset.rdThumb.split('|');
            const info = itemInfo(category, item);
            const box = wrap.querySelector('.rd-thumb');
            if (box && info.thumb && info.thumb.type === 'bg') box.style.background = info.thumb.css;
        });
    }

    // ---------- 建立表單 ----------
    function renderTabs() {
        $('rd-tabs').innerHTML = TABS.map(t => {
            const count = [...selected.values()].filter(s => s.category === t.category).length;
            return `<button type="button" class="rd-tab ${t.key === currentTab ? 'is-active' : ''}" onclick="rdSwitchTab('${t.key}')">${t.label}${count ? ` <b>${count}</b>` : ''}</button>`;
        }).join('');
    }

    function renderItemGrid() {
        const tab = TABS.find(t => t.key === currentTab);
        const keyword = ($('rd-item-search').value || '').trim().toLowerCase();
        const items = Object.entries(catalog[tab.category])
            .filter(([key, v]) => !keyword || v.name.toLowerCase().includes(keyword) || key.toLowerCase().includes(keyword));
        const grid = $('rd-item-grid');
        if (catalogError) { grid.innerHTML = `<p class="rd-hint" style="color:#b91c1c;">${escapeHTML(catalogError)}</p>`; return; }
        if (!items.length) { grid.innerHTML = '<p class="rd-hint">找不到符合的商品</p>'; return; }

        grid.innerHTML = items.map(([key, v]) => {
            const on = selected.has(`${tab.category}:${key}`);
            return `<button type="button" class="rd-item ${on ? 'is-selected' : ''}" data-rd-thumb="${tab.category}|${escapeHTML(key)}"
                        onclick="rdToggleItem(${jsArg(tab.category)}, ${jsArg(key)})" title="${escapeHTML(key)}">
                ${thumbHTML(v, 54)}
                <span class="rd-item-name">${escapeHTML(v.name)}</span>
                <span class="rd-item-cost">商店價 ${v.cost}</span>
                ${on ? '<span class="rd-check">✓</span>' : ''}
            </button>`;
        }).join('');
        applyBgThumbs(grid);
    }

    function renderSelected() {
        const box = $('rd-selected');
        if (!selected.size) { box.innerHTML = '<span class="rd-hint">還沒選道具（只發積分也可以）</span>'; return; }
        box.innerHTML = [...selected.values()].map(s => {
            const info = itemInfo(s.category, s.item);
            return `<span class="rd-chip" data-rd-thumb="${s.category}|${escapeHTML(s.item)}">
                ${thumbHTML(info, 24)} ${CATEGORY_LABEL[s.category]}・${escapeHTML(info.name)}
                <button type="button" onclick="rdToggleItem(${jsArg(s.category)}, ${jsArg(s.item)})" title="移除">×</button>
            </span>`;
        }).join('');
        applyBgThumbs(box);
    }

    window.rdSwitchTab = function (key) {
        currentTab = key;
        renderTabs();
        renderItemGrid();
    };

    window.rdFilterItems = function () {
        renderItemGrid();
    };

    window.rdToggleItem = function (category, item) {
        const id = `${category}:${item}`;
        if (selected.has(id)) selected.delete(id); else selected.set(id, { category, item });
        renderTabs();
        renderItemGrid();
        renderSelected();
    };

    window.rdRandomCode = function () {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $('rd-code').value = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    // 到期時間快捷鍵：幾天後的同一時間；0 = 永久
    window.rdSetExpiry = function (days) {
        const input = $('rd-expires');
        if (!days) { input.value = ''; return; }
        const d = new Date(Date.now() + days * 86400000);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // datetime-local 要本地時間
        input.value = d.toISOString().slice(0, 16);
    };

    // ---------- 編輯模式：沿用上面的建立表單 ----------
    let editing = null; // 正在編輯的兌換碼（null = 建立新的）

    function toLocalInput(iso) {
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    }

    function clearForm() {
        ['rd-title', 'rd-code', 'rd-coin', 'rd-max-uses', 'rd-expires'].forEach(id => { $(id).value = ''; });
        selected.clear();
        renderTabs(); renderItemGrid(); renderSelected();
    }

    function setEditMode(c) {
        editing = c;
        const used = c ? c.used_count : 0;
        $('rd-form-title').textContent = c ? `✏️ 編輯兌換碼 ${c.code}` : '🎁 建立兌換碼';
        $('rd-create-btn').textContent = c ? '💾 儲存修改' : '🎁 建立兌換碼';
        $('rd-cancel-btn').style.display = c ? '' : 'none';
        // 有人兌換過就不能改碼本身
        $('rd-code').disabled = !!(c && used > 0);
        $('rd-random-btn').disabled = !!(c && used > 0);
        const note = $('rd-edit-note');
        note.style.display = c && used > 0 ? '' : 'none';
        note.textContent = c && used > 0
            ? `⚠️ 已經有 ${used} 人兌換過：兌換碼本身不能改；改獎勵的話，已兌換的人不會補發也不會收回；人數上限不能低於 ${used}。`
            : '';
    }

    window.rdEdit = function (id) {
        const c = allCodes.find(x => Number(x.id) === Number(id));
        if (!c) return;
        clearForm();
        $('rd-title').value = c.title;
        $('rd-code').value = c.code;
        $('rd-coin').value = c.reward_coin || '';
        $('rd-max-uses').value = c.max_uses ?? '';
        $('rd-expires').value = c.expires_at ? toLocalInput(c.expires_at) : '';
        (Array.isArray(c.reward_items) ? c.reward_items : []).forEach(s => selected.set(`${s.category}:${s.item}`, { category: s.category, item: s.item }));
        renderTabs(); renderItemGrid(); renderSelected();
        $('rd-result').innerHTML = '';
        setEditMode(c);
        $('rd-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.rdCancelEdit = function () {
        clearForm();
        setEditMode(null);
    };

    window.rdCreateCode = async function () {
        const body = {
            title: $('rd-title').value.trim(),
            code: $('rd-code').value.trim(),
            coin: Number($('rd-coin').value || 0),
            maxUses: $('rd-max-uses').value.trim() === '' ? null : Number($('rd-max-uses').value),
            expiresAt: $('rd-expires').value ? new Date($('rd-expires').value).toISOString() : null,
            items: [...selected.values()],
        };
        if (!body.title) return alert('請輸入活動名稱');
        if (!body.coin && !body.items.length) return alert('至少要給積分或選一樣道具');

        const isEdit = !!editing;
        if (isEdit && editing.used_count > 0 && !confirm(`這個兌換碼已經有 ${editing.used_count} 人兌換過，修改後已兌換的人不會補發也不會收回，確定要儲存嗎？`)) return;

        const btn = $('rd-create-btn');
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/redeem-codes${isEdit ? `/${Number(editing.id)}` : ''}`, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { alert(`${isEdit ? '儲存' : '建立'}失敗：${data.message || '請確認權限或網路狀態'}`); return; }

            $('rd-result').innerHTML = `✅ ${isEdit ? '已更新' : '已建立'}兌換碼 <code class="rd-code-big">${escapeHTML(data.data.code)}</code>
                <button type="button" class="btn-action btn-secondary" onclick="rdCopy(${jsArg(data.data.code)})">📋 複製</button>`;
            clearForm();
            setEditMode(null);
            loadCodes();
        } catch (e) {
            alert('伺服器連線失敗');
        } finally {
            btn.disabled = false;
        }
    };

    window.rdCopy = async function (code) {
        try { await navigator.clipboard.writeText(code); alert(`已複製：${code}`); }
        catch { prompt('請手動複製兌換碼', code); }
    };

    // ---------- 兌換碼列表 ----------
    async function loadCodes() {
        const tbody = $('admin-redeem-body');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">讀取中...</td></tr>`;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/redeem-codes`, { headers: { 'Authorization': `Bearer ${token()}`, 'ngrok-skip-browser-warning': 'true' } });
            if (!res.ok) throw new Error();
            allCodes = (await res.json()).data || [];
            page = 1;
            renderCodes();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">無法載入</td></tr>`;
        }
    }

    window.rdChangePage = function (p) { page = p; renderCodes(); };

    const REWARD_FOLD_OVER = 5; // 獎勵超過 5 樣就收起來，點開才看得到全部

    function rewardHTML(c) {
        const parts = [];
        if (c.reward_coin > 0) parts.push(`<span class="rd-chip rd-chip-coin">🪙 ${c.reward_coin} 積分</span>`);
        const items = Array.isArray(c.reward_items) ? c.reward_items : [];
        items.forEach(s => {
            const info = itemInfo(s.category, s.item);
            parts.push(`<span class="rd-chip" data-rd-thumb="${s.category}|${escapeHTML(s.item)}">${thumbHTML(info, 22)} ${CATEGORY_LABEL[s.category] || ''}・${escapeHTML(info.name)}</span>`);
        });
        if (parts.length <= REWARD_FOLD_OVER) return parts.join(' ');

        const summary = [
            c.reward_coin > 0 ? `🪙 ${c.reward_coin} 積分` : '',
            items.length ? `${items.length} 樣道具` : '',
        ].filter(Boolean).join('＋');
        return `<details class="rd-reward-fold">
            <summary>🎁 ${summary}<span class="rd-fold-hint">（共 ${parts.length} 樣，點開看）</span></summary>
            <div class="rd-reward-list">${parts.join(' ')}</div>
        </details>`;
    }

    function renderCodes() {
        const tbody = $('admin-redeem-body');
        const list = allCodes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        renderPagination(allCodes.length, page, 'redeem-pagination', 'rdChangePage');
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🎁</span><p>還沒有兌換碼，從上面建立一個吧！</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(c => {
            const badge = STATE_BADGE[c.state] || STATE_BADGE.active;
            const expires = c.expires_at ? new Date(c.expires_at).toLocaleString() : '永久有效';
            const actions = [
                `<button class="btn-action" style="background:#fdf2f8; color:#be185d; border:1px solid #f9a8d4;" onclick="rdEdit(${Number(c.id)})">✏️ 編輯</button>`,
                c.is_active
                    ? `<button class="btn-action btn-secondary" onclick="rdSetActive(${Number(c.id)}, false)">⏸️ 停用</button>`
                    : `<button class="btn-action btn-primary" onclick="rdSetActive(${Number(c.id)}, true)">▶️ 啟用</button>`,
                `<button class="btn-action" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;" onclick="rdShowUses(${Number(c.id)})">👥 紀錄</button>`,
                c.used_count === 0 ? `<button class="btn-action btn-danger" onclick="rdDelete(${Number(c.id)})">🗑️</button>` : '',
            ].join(' ');
            return `
            <tr>
                <td data-label="兌換碼"><code class="rd-code">${escapeHTML(c.code)}</code>
                    <button class="rd-mini-btn" onclick="rdCopy(${jsArg(c.code)})" title="複製">📋</button></td>
                <td data-label="活動名稱">${escapeHTML(c.title)}</td>
                <td data-label="獎勵">${rewardHTML(c)}</td>
                <td data-label="使用人數">${c.used_count} / ${c.max_uses ?? '不限'}</td>
                <td data-label="到期時間" style="color:#64748b;">${escapeHTML(expires)}</td>
                <td data-label="狀態"><span class="badge" style="background:${badge.bg}; color:${badge.color}; padding:4px 10px;">${badge.text}</span></td>
                <td data-label="操作">${actions}</td>
            </tr>`;
        }).join('');
        applyBgThumbs(tbody);
    }

    window.rdSetActive = async function (id, isActive) {
        if (!isActive && !confirm('確定要停用這個兌換碼嗎？停用後玩家就不能再兌換（已兌換的不受影響）。')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/redeem-codes/${id}/active`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { alert(`更新失敗：${data.message || ''}`); return; }
            loadCodes();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    window.rdDelete = async function (id) {
        if (!confirm('確定要刪除這個兌換碼嗎？（只有還沒人兌換過的才能刪）')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/redeem-codes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token()}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { alert(`刪除失敗：${data.message || ''}`); return; }
            if (editing && Number(editing.id) === Number(id)) rdCancelEdit(); // 正在編輯的被刪掉了
            loadCodes();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    window.rdShowUses = async function (id) {
        const c = allCodes.find(x => Number(x.id) === Number(id));
        $('modal-title').textContent = `👥 兌換紀錄：${c ? c.code : ''}`;
        $('modal-body').innerHTML = '讀取中...';
        $('modal-actions').innerHTML = '';
        $('admin-modal').style.display = 'flex';
        try {
            const res = await fetch(`${API_BASE_URL}/admin/redeem-codes/${id}/uses`, { headers: { 'Authorization': `Bearer ${token()}` } });
            if (!res.ok) throw new Error();
            const uses = (await res.json()).data || [];
            $('modal-body').innerHTML = uses.length
                ? `<p style="color:#64748b;">共 ${uses.length} 人兌換</p>` + uses.map(u => `
                    <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #e5e7eb;">
                        <span>${escapeHTML(u.member?.name || '未命名')} <span style="color:#94a3b8;">(ID ${escapeHTML(u.member_id)})</span></span>
                        <span style="color:#64748b;">${escapeHTML(new Date(u.created_at).toLocaleString())}</span>
                    </div>`).join('')
                : '<p style="color:#94a3b8;">還沒有人兌換。</p>';
        } catch (e) {
            $('modal-body').innerHTML = '<p style="color:red;">無法載入</p>';
        }
    };

    // ---------- 進入頁面 ----------
    window.loadRedeemCodes = async function () {
        await loadCatalog();
        renderTabs();
        renderItemGrid();
        renderSelected();
        loadCodes();
    };
})();
