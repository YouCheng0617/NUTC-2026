(async () => {
    const textInput = document.getElementById('note-text');
    const addBtn = document.getElementById('add-note-btn');
    const notesBoard = document.getElementById('notes-board');

    // 設定伺服器 IP 與正確的 API 路由 (請將 /game/sticky-note 替換為後端真實路徑)
    const API_BASE = 'https://163.17.135.120'; 
    const API_URL = `${API_BASE}/game/sticky-note`; 

    // 用來產生隨機深海配色的陣列
    const themeColors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#e0c3fc'];

    // 抓取當日所有便利貼 (GET)
    const fetchNotes = async () => {
        try {
            const res = await fetch(API_URL);
            const notes = await res.json();
            renderNotes(notes);
        } catch (error) {
            console.error("連線錯誤，無法讀取便利貼：", error);
            notesBoard.innerHTML = '<p style="text-align:center; color:#ff4d4d;">無法連接到秘密海域伺服器 🌊</p>';
        }
    };

    // 渲染便利貼畫面
    const renderNotes = (notes) => {
        notesBoard.innerHTML = '';
        
        if (!notes || notes.length === 0) {
            notesBoard.innerHTML = '<p style="text-align:center; width:100%; color:rgba(255,255,255,0.6);">目前還沒有便利貼，趕快來寫一張吧！</p>';
            return;
        }

        notes.forEach(note => {
            // 隨機選一個顏色
            const randomColor = themeColors[Math.floor(Math.random() * themeColors.length)];
            
            // 格式化後端傳來的 ISO 時間
            const dateObj = new Date(note.created_at);
            const timeString = dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.background = randomColor; // 套用隨機顏色
            
            card.innerHTML = `
                <div class="note-text">${escapeHTML(note.content)}</div>
                <div class="note-footer">
                    <span>🕒 ${timeString}</span>
                </div>
            `;
            notesBoard.appendChild(card);
        });
    };

    // 發佈新便利貼 (POST)
    const addNote = async () => {
        const text = textInput.value.trim();
        if (!text) return alert("請輸入便利貼內容喔！");

        // 統一改為使用 'authToken'，確保能順利抓到登入憑證
        const token = localStorage.getItem('authToken'); 
        if (!token) return alert("請先登入才能發佈便利貼！");

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 把憑證塞進標頭，後端才知道發送者是哪個 member_id
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ content: text })
            });

            const result = await res.json();

            // 攔截你在 Service 寫的 "今天已經有寫便利貼了"
            if (!res.ok) {
                // 如果後端有傳遞錯誤訊息就顯示，否則顯示預設文字
                alert(result.message || result.error || "今天已經有寫便利貼了，明天再來吧！");
                return; 
            }

            // 成功發佈後
            textInput.value = ''; // 清空輸入框
            fetchNotes();         // 重新向後端要一次最新資料，重繪畫面
            
        } catch (error) {
            console.error("發佈失敗：", error);
            alert("發送失敗，請檢查網路連線！");
        }
    };

    // 防 XSS 攻擊
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    };

    // 綁定發佈按鈕
    addBtn.addEventListener('click', addNote);

    // 進入網頁時立刻向伺服器要資料
    fetchNotes();
})();