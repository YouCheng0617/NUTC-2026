(async () => {
    const textInput = document.getElementById('note-text');
    const addBtn = document.getElementById('add-note-btn');
    const notesBoard = document.getElementById('notes-board');

    // 設定伺服器 IP 與正確的 API 路由 (請將 /game/sticky-note 替換為後端真實路徑)
    const API_BASE = 'https://163.17.135.120'; 
    const API_URL = `${API_BASE}/game/daily-note`;

    // 用來產生隨機深海配色的陣列
    const themeColors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#e0c3fc'];

   // 抓取當日所有便利貼 (GET)
const fetchNotes = async () => {
    try {
        const res = await fetch(API_URL);
        const rawData = await res.json();
        
        // 🚨 這裡進行拆包裝：真正的陣列放在 rawData.data 裡面
        // 加上 || [] 是防呆機制，萬一後端沒傳 data 過來，就當作空陣列處理
        const notes = rawData.data || []; 
        
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

// 🚀 這是你遺失的發佈功能函式
    const addNote = async () => {
        // 取得輸入框的文字內容
        const content = textInput.value; 

        if (content.trim() === '') {
            showToast('請輸入便利貼內容！', 'warning');
            return;
        }

        // 統一改為使用 'authToken'，確保能順利抓到登入憑證
        const token = localStorage.getItem('authToken'); 
        if (!token) {
            showToast("請先登入才能發佈便利貼！", "warning"); // 升級成吐司
            return;
        }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ content: content }) // 統一變數名稱為 content
            });

            const result = await res.json();

            if (!res.ok) {
                // 如果失敗，顯示紅色的錯誤吐司
                showToast(result.message || result.error || "今天已經有寫便利貼了，明天再來吧！", "error");
                return; 
            }

            // 成功發佈後
            textInput.value = ''; 
            showToast('發佈成功！', 'success'); // 升級成綠色的成功吐司
            fetchNotes();         
            
        } catch (error) {
            console.error("發佈失敗：", error);
            showToast("發送失敗，請檢查網路連線！", "error"); // 升級成紅色的錯誤吐司
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

    textInput.addEventListener('keydown', (e) => {
        // 如果按下的是 Enter 鍵，且「沒有」同時按住 Shift 鍵
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 阻止瀏覽器預設的換行行為
            addNote();          // 呼叫發佈功能
        }
    });
    // 進入網頁時立刻向伺服器要資料
    fetchNotes();
})();
// 顯示吐司提示框的函式
const showToast = (message, type = 'normal') => {
    // 檢查畫面上有沒有容器，沒有的話就動態建一個
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 建立提示小卡
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // 把小卡塞進容器裡
    container.appendChild(toast);

    // 設定 3 秒後自動加上 fade-out 類別，並在動畫結束後把自己刪掉
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
};