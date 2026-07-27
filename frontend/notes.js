(async () => {
    const textInput = document.getElementById('note-text');
    const addBtn = document.getElementById('add-note-btn');
    const notesBoard = document.getElementById('notes-board');

    // ✨ 已經幫你把變數名稱對齊，並把結尾的斜線拿掉了！
    const API_BASE_URL = "https://api.drift-bottles.xyz";
    const API_URL = `${API_BASE_URL}/game/daily-note`;

    // 用來產生隨機深海配色的陣列
    const themeColors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#e0c3fc'];

    // 抓取當日所有便利貼 (GET)
    const fetchNotes = async () => {
        try {
            const res = await fetch(API_URL);
            const rawData = await res.json();
            
            // 🚨 這裡進行拆包裝：真正的陣列放在 rawData.data 裡面
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
            card.style.background = randomColor; 
            
            card.innerHTML = `
                <div class="note-text">${escapeHTML(note.content)}</div>
                <div class="note-footer">
                    <span>🕒 ${timeString}</span>
                </div>
            `;
            notesBoard.appendChild(card);
        });
    };

    // 🚀 發佈功能函式
    const addNote = async () => {
        const content = textInput.value; 

        if (content.trim() === '') {
            showToast('請輸入便利貼內容！', 'warning');
            return;
        }

        const token = localStorage.getItem('authToken'); 
        if (!token) {
            showToast("請先登入才能發佈便利貼！", "warning"); 
            return;
        }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ content: content }) 
            });

            // 先確認後端有沒有點頭答應
            if (!res.ok) {
                let errorMessage = "今天已經有寫便利貼了，明天再來吧！"; 
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errData.error || errorMessage;
                } catch (e) {
                    // 解析錯誤就用預設提示
                }
                showToast(errorMessage, "error");
                return; 
            }

            // 成功發佈後
            textInput.value = ''; 
            showToast('發佈成功！', 'success'); 
            fetchNotes();         
            
        } catch (error) {
            console.error("發佈失敗：", error);
            showToast("發送失敗，請檢查網路連線！", "error"); 
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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            addNote();          
        }
    });

    // 進入網頁時立刻向伺服器要資料
    fetchNotes();
})();

// 顯示吐司提示框的函式
const showToast = (message, type = 'normal') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
};