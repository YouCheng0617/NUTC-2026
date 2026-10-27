// ==========================================
// 📨 發送通知（以前叫全服通知）：發給所有人，或指定的人
// 後端：GET/POST /admin/broadcasts、PUT /admin/broadcasts/:id、PUT /admin/broadcasts/:id/active、DELETE /admin/broadcasts/:id
//       body 的 target_ids：空陣列＝所有人；找人用 GET /admin/members
// 發送後會出現在收件人的通知列表（前台 🔔），停用或過期就不再顯示
// 用到 admin.js 的 API_BASE_URL、escapeHTML、jsArg
// ==========================================
(function () {
    const STATE_BADGE = {
        active: { text: '🟢 發送中', bg: '#dcfce7', color: '#15803d' },
        disabled: { text: '⏸️ 已停用', bg: '#f1f5f9', color: '#475569' },
        expired: { text: '⌛ 已過期', bg: '#fef3c7', color: '#92400e' },
    };
    const MAX_RESULTS = 8; // 找人時最多列幾個

    let broadcasts = [];
    let memberCount = 0;
    let editing = null; // 正在編輯的通知 id（null = 發送新的）
    let members = null; // 找人用的會員名單，第一次用到才抓
    let targets = []; // 已選的收件人 [{ member_id, name }]

    const $ = (id) => document.getElementById(id);
    const token = () => localStorage.getItem('authToken');
    const authHeaders = () => ({
        'Authorization': `Bearer ${token()}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
    });

    function toLocalInput(iso) {
        const d = new Date(iso);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // datetime-local 要本地時間
        return d.toISOString().slice(0, 16);
    }

    window.bcUpdateCount = function () {
        $('bc-count').textContent = $('bc-content').value.length;
    };

    window.bcSetExpiry = function (days) {
        $('bc-expires').value = days ? toLocalInput(Date.now() + days * 86400000) : '';
    };

    // ---------- 收件人 ----------

    const audience = () => document.querySelector('input[name="bc-audience"]:checked')?.value || 'all';

    function setAudience(value) {
        const radio = document.querySelector(`input[name="bc-audience"][value="${value}"]`);
        if (radio) radio.checked = true;
        bcAudienceChanged();
    }

    window.bcAudienceChanged = function () {
        $('bc-target-box').style.display = audience() === 'some' ? '' : 'none';
        updateSubmitText();
        if (audience() === 'some') loadMembers();
    };

    function updateSubmitText() {
        if (editing) return;
        $('bc-submit-btn').textContent = audience() === 'some'
            ? `📨 發送給 ${targets.length} 個人`
            : '📨 發送給所有人';
    }

    async function loadMembers() {
        if (members) return members;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/members`, { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const data = await res.json();
            members = (data.data || data || []).filter(m => m.status !== 'DELETED');
        } catch (e) {
            members = null;
        }
        return members;
    }

    function renderChips() {
        $('bc-target-chips').innerHTML = targets.length === 0
            ? '<span class="rd-hint">還沒選人，用上面的搜尋框加入收件人</span>'
            : targets.map(t => `
                <span class="rd-chip">${escapeHTML(t.name || '未命名')} <small style="color:#94a3b8;">#${escapeHTML(t.member_id)}</small>
                    <button type="button" aria-label="移除" onclick="bcRemoveTarget(${Number(t.member_id)})">×</button>
                </span>`).join('');
        updateSubmitText();
    }

    window.bcSearchMembers = async function () {
        const box = $('bc-target-results');
        const keyword = $('bc-target-input').value.trim().toLowerCase();
        if (!keyword) { box.style.display = 'none'; return; }

        const list = await loadMembers();
        if (!list) {
            box.innerHTML = '<div class="bc-target-empty">會員名單載入失敗，請重新整理</div>';
            box.style.display = '';
            return;
        }
        const picked = new Set(targets.map(t => Number(t.member_id)));
        const matches = list.filter(m =>
            String(m.member_id) === keyword
            || String(m.name || '').toLowerCase().includes(keyword)
            || String(m.email || '').toLowerCase().includes(keyword)
        ).slice(0, MAX_RESULTS);

        box.innerHTML = matches.length === 0
            ? '<div class="bc-target-empty">找不到符合的使用者</div>'
            : matches.map(m => {
                const isPicked = picked.has(Number(m.member_id));
                return `<button type="button" class="bc-target-option${isPicked ? ' is-picked' : ''}" ${isPicked ? 'disabled' : `onclick="bcAddTarget(${Number(m.member_id)})"`}>
                    <span>${escapeHTML(m.name || '未命名')} <small>#${escapeHTML(m.member_id)}</small>${isPicked ? ' <small>（已加入）</small>' : ''}</span>
                    <small>${escapeHTML(m.email || '')}</small>
                </button>`;
            }).join('');
        box.style.display = '';
    };

    // Enter 直接加入第一個結果、Esc 收起
    window.bcSearchKeydown = function (e) {
        if (e.key === 'Escape') { $('bc-target-results').style.display = 'none'; return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        $('bc-target-results').querySelector('.bc-target-option:not(.is-picked)')?.click();
    };

    window.bcAddTarget = function (memberId) {
        const m = (members || []).find(x => Number(x.member_id) === Number(memberId));
        if (!m || targets.some(t => Number(t.member_id) === Number(memberId))) return;
        targets.push({ member_id: m.member_id, name: m.name });
        $('bc-target-input').value = '';
        $('bc-target-results').style.display = 'none';
        renderChips();
        $('bc-target-input').focus();
    };

    window.bcRemoveTarget = function (memberId) {
        targets = targets.filter(t => Number(t.member_id) !== Number(memberId));
        renderChips();
    };

    // 點搜尋框以外的地方就收起結果
    document.addEventListener('click', (e) => {
        if (!e.target.closest?.('.bc-target-search')) {
            const box = $('bc-target-results');
            if (box) box.style.display = 'none';
        }
    });

    // ---------- 表單 ----------

    function resetForm() {
        editing = null;
        targets = [];
        $('bc-content').value = '';
        $('bc-expires').value = '';
        $('bc-target-input').value = '';
        bcUpdateCount();
        renderChips();
        setAudience('all');
        $('bc-form-title').textContent = '📨 發送通知';
        $('bc-cancel-btn').style.display = 'none';
        $('bc-edit-note').style.display = 'none';
        updateSubmitText();
    }

    window.bcCancelEdit = resetForm;

    window.bcEdit = function (id) {
        const b = broadcasts.find(x => String(x.id) === String(id));
        if (!b) return;
        editing = b.id;
        targets = (b.targets || []).map(t => ({ member_id: t.member_id, name: t.name }));
        $('bc-content').value = b.content;
        $('bc-expires').value = b.expires_at ? toLocalInput(b.expires_at) : '';
        bcUpdateCount();
        renderChips();
        setAudience(targets.length > 0 ? 'some' : 'all');
        $('bc-form-title').textContent = `✏️ 修改通知 #${b.id}`;
        $('bc-submit-btn').textContent = '💾 儲存修改';
        $('bc-cancel-btn').style.display = '';
        $('bc-edit-note').style.display = '';
        $('bc-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.bcSubmit = async function () {
        const content = $('bc-content').value.trim();
        const expiresRaw = $('bc-expires').value;
        if (!content) return alert('請輸入通知內容');
        const toSome = audience() === 'some';
        if (toSome && targets.length === 0) return alert('請至少加入一位收件人，或改成發給所有人');

        const expires_at = expiresRaw ? new Date(expiresRaw).toISOString() : null;
        if (expires_at && new Date(expires_at) <= new Date()) return alert('到期時間必須是未來的時間');
        const who = toSome ? `${targets.map(t => t.name || `#${t.member_id}`).join('、')}（${targets.length} 人）` : '所有會員';
        if (!editing && !await oceanConfirm(`確定要發送給 ${who} 嗎？\n\n${content}`)) return;

        const btn = $('bc-submit-btn');
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts${editing ? `/${editing}` : ''}`, {
                method: editing ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    content,
                    expires_at,
                    target_ids: toSome ? targets.map(t => Number(t.member_id)) : [],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`${editing ? '儲存' : '發送'}失敗：${data.message || '請確認權限或網路狀態'}`);
            alert(`✅ ${data.message}`);
            resetForm();
            loadBroadcasts();
        } catch (e) {
            alert('伺服器連線失敗');
        } finally {
            btn.disabled = false;
        }
    };

    window.bcToggleActive = async function (id, isActive) {
        if (!isActive && !await oceanConfirm('停用後，收件人的通知列表都不會再顯示這則通知，確定嗎？')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts/${encodeURIComponent(id)}/active`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ is_active: isActive }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`操作失敗：${data.message || ''}`);
            loadBroadcasts();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    window.bcDelete = async function (id) {
        if (!await oceanConfirm('確定要刪除這則通知嗎？刪除後無法復原，已讀紀錄也會一起刪除。')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts/${encodeURIComponent(id)}`, {
                method: 'DELETE', headers: authHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`刪除失敗：${data.message || ''}`);
            if (String(editing) === String(id)) resetForm();
            loadBroadcasts();
        } catch (e) { alert('伺服器連線失敗'); }
    };

    // 收件人欄：所有人，或列出名字（超過 3 個就寫「等 N 人」）
    function targetCell(b) {
        const list = b.targets || [];
        if (list.length === 0) return '👥 所有人';
        const names = list.slice(0, 3).map(t => escapeHTML(t.name || `#${t.member_id}`)).join('、');
        return `👤 ${names}${list.length > 3 ? ` 等 ${list.length} 人` : ''}`;
    }

    function render() {
        const tbody = $('admin-broadcast-body');
        if (broadcasts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">還沒有發送過通知</td></tr>`;
            return;
        }
        tbody.innerHTML = broadcasts.map(b => {
            const badge = STATE_BADGE[b.state] || STATE_BADGE.disabled;
            const audienceSize = (b.targets || []).length || memberCount; // 指定的人就用收件人數算比例
            const percent = audienceSize > 0 ? Math.min(100, Math.round(b.read_count / audienceSize * 100)) : 0;
            const toggleBtn = b.is_active
                ? `<button class="btn-action btn-secondary" onclick="bcToggleActive(${jsArg(b.id)}, false)">⏸️ 停用</button>`
                : `<button class="btn-action btn-secondary" onclick="bcToggleActive(${jsArg(b.id)}, true)">▶️ 啟用</button>`;
            return `
            <tr style="${b.state === 'active' ? '' : 'opacity:0.7;'}">
                <td data-label="內容"><div class="bc-content-cell">${escapeHTML(b.content)}</div></td>
                <td data-label="收件人"><div class="bc-target-cell">${targetCell(b)}</div></td>
                <td data-label="發送時間">${escapeHTML(new Date(b.created_at).toLocaleString())}</td>
                <td data-label="到期時間">${b.expires_at ? escapeHTML(new Date(b.expires_at).toLocaleString()) : '不會過期'}</td>
                <td data-label="已讀人數">${b.read_count} 人<small style="color:#94a3b8;">（約 ${percent}%）</small></td>
                <td data-label="狀態"><span class="badge" style="background:${badge.bg}; color:${badge.color}; padding:4px 10px;">${badge.text}</span></td>
                <td data-label="操作">
                    <button class="btn-action btn-primary" onclick="bcEdit(${jsArg(b.id)})">✏️ 修改</button>
                    ${toggleBtn}
                    <button class="btn-action btn-danger" onclick="bcDelete(${jsArg(b.id)})">🗑️ 刪除</button>
                </td>
            </tr>`;
        }).join('');
    }

    window.loadBroadcasts = async function () {
        const tbody = $('admin-broadcast-body');
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">讀取中...</td></tr>`;
        renderChips();
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts`, { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const data = (await res.json()).data;
            broadcasts = data.broadcasts || [];
            memberCount = data.memberCount || 0;
            render();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">無法載入</td></tr>`;
        }
    };
})();
