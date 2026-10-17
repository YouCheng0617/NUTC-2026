// ==========================================
// 📢 全服通知
// 後端：GET/POST /admin/broadcasts、PUT /admin/broadcasts/:id、PUT /admin/broadcasts/:id/active、DELETE /admin/broadcasts/:id
// 發佈後會出現在每個人的通知列表（前台 🔔），停用或過期就不再顯示
// 用到 admin.js 的 API_BASE_URL、escapeHTML、jsArg
// ==========================================
(function () {
    const STATE_BADGE = {
        active: { text: '🟢 發佈中', bg: '#dcfce7', color: '#15803d' },
        disabled: { text: '⏸️ 已停用', bg: '#f1f5f9', color: '#475569' },
        expired: { text: '⌛ 已過期', bg: '#fef3c7', color: '#92400e' },
    };

    let broadcasts = [];
    let memberCount = 0;
    let editing = null; // 正在編輯的通知 id（null = 發佈新的）

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

    function resetForm() {
        editing = null;
        $('bc-content').value = '';
        $('bc-expires').value = '';
        bcUpdateCount();
        $('bc-form-title').textContent = '📢 發佈全服通知';
        $('bc-submit-btn').textContent = '📢 發佈給所有人';
        $('bc-cancel-btn').style.display = 'none';
        $('bc-edit-note').style.display = 'none';
    }

    window.bcCancelEdit = resetForm;

    window.bcEdit = function (id) {
        const b = broadcasts.find(x => String(x.id) === String(id));
        if (!b) return;
        editing = b.id;
        $('bc-content').value = b.content;
        $('bc-expires').value = b.expires_at ? toLocalInput(b.expires_at) : '';
        bcUpdateCount();
        $('bc-form-title').textContent = `✏️ 修改全服通知 #${b.id}`;
        $('bc-submit-btn').textContent = '💾 儲存修改';
        $('bc-cancel-btn').style.display = '';
        $('bc-edit-note').style.display = '';
        $('bc-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.bcSubmit = async function () {
        const content = $('bc-content').value.trim();
        const expiresRaw = $('bc-expires').value;
        if (!content) return alert('請輸入通知內容');

        const expires_at = expiresRaw ? new Date(expiresRaw).toISOString() : null;
        if (expires_at && new Date(expires_at) <= new Date()) return alert('到期時間必須是未來的時間');
        if (!editing && !await oceanConfirm(`確定要發佈給所有會員嗎？\n\n${content}`)) return;

        const btn = $('bc-submit-btn');
        btn.disabled = true;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts${editing ? `/${editing}` : ''}`, {
                method: editing ? 'PUT' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ content, expires_at }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return alert(`${editing ? '儲存' : '發佈'}失敗：${data.message || '請確認權限或網路狀態'}`);
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
        if (!isActive && !await oceanConfirm('停用後，所有人的通知列表都不會再顯示這則通知，確定嗎？')) return;
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
        if (!await oceanConfirm('確定要刪除這則全服通知嗎？刪除後無法復原，已讀紀錄也會一起刪除。')) return;
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

    function render() {
        const tbody = $('admin-broadcast-body');
        if (broadcasts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">還沒有發佈過全服通知</td></tr>`;
            return;
        }
        tbody.innerHTML = broadcasts.map(b => {
            const badge = STATE_BADGE[b.state] || STATE_BADGE.disabled;
            const percent = memberCount > 0 ? Math.min(100, Math.round(b.read_count / memberCount * 100)) : 0;
            const toggleBtn = b.is_active
                ? `<button class="btn-action btn-secondary" onclick="bcToggleActive(${jsArg(b.id)}, false)">⏸️ 停用</button>`
                : `<button class="btn-action btn-secondary" onclick="bcToggleActive(${jsArg(b.id)}, true)">▶️ 啟用</button>`;
            return `
            <tr style="${b.state === 'active' ? '' : 'opacity:0.7;'}">
                <td data-label="內容"><div class="bc-content-cell">${escapeHTML(b.content)}</div></td>
                <td data-label="發佈時間">${escapeHTML(new Date(b.created_at).toLocaleString())}</td>
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/broadcasts`, { headers: authHeaders() });
            if (!res.ok) throw new Error();
            const data = (await res.json()).data;
            broadcasts = data.broadcasts || [];
            memberCount = data.memberCount || 0;
            render();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入</td></tr>`;
        }
    };
})();
