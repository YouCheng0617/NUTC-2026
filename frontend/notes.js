// 🌟 1. 翻譯字典
const i18nNotes = {
    zh: {
        title: "📝 每日便利貼", langBtn: "EN", backBtn: "回到大廳",
        placeholder: "今天想記錄點什麼呢？...", addBtn: "發佈便利貼",
        empty: "目前還沒有便利貼，趕快來寫一張吧！",
        errConn: "無法連接到秘密海域伺服器 🌊",
        warnEmpty: "請輸入便利貼內容！", warnLogin: "請先登入才能發佈便利貼！",
        duplicate: "今天已經有寫便利貼了，明天再來吧！",
        success: "發佈成功！", fail: "發送失敗，請檢查網路連線！"
    },
    en: {
        title: "📝 Daily Notes", langBtn: "中文", backBtn: "Home",
        placeholder: "What's on your mind today?...", addBtn: "Post Note",
        empty: "No notes yet. Be the first to write one! 🌊",
        errConn: "Cannot connect to the Secret Ocean server 🌊",
        warnEmpty: "Please enter note content!", warnLogin: "Please login to post a note!",
        duplicate: "You already posted today. Come back tomorrow!",
        success: "Posted successfully!", fail: "Failed to send, please check network!"
    }
};

let currLangNotes = 'zh';

// 🌟 2. 切換語言的核心魔法
window.toggleLang = function() {
    currLangNotes = currLangNotes === 'zh' ? 'en' : 'zh';
    const t = i18nNotes[currLangNotes];
    
    // 更新靜態 UI
    document.getElementById('page-title').innerText = t.title;
    document.getElementById('btn-lang').innerText = t.langBtn;
    document.getElementById('btn-back').innerText = t.backBtn;
    document.getElementById('note-text').placeholder = t.placeholder;
    document.getElementById('add-note-btn').innerText = t.addBtn;
    
    // 如果已經有抓到資料，重新渲染以更新空狀態的語言
    if (window._currentNotesData) {
        window._renderNotes(window._currentNotesData);
    }
};

// 🌟 3. 核心執行區塊
(async () => {
    const textInput = document.getElementById('note-text');
    const addBtn = document.getElementById('add-note-btn');
    const notesBoard = document.getElementById('notes-board');

    const API_BASE_URL = "https://api.drift-bottles.xyz";
    const API_URL = `${API_BASE_URL}/game/daily-note`;
    const themeColors = ['#ff9a9e', '#fecfef', '#a1c4fd', '#c2e9fb', '#e0c3fc'];

    const fetchNotes = async () => {
        try {
            const res = await fetch(API_URL);
            const rawData = await res.json();
            window._currentNotesData = rawData.data || []; 
            window._renderNotes(window._currentNotesData);
        } catch (error) {
            console.error("連線錯誤：", error);
            notesBoard.innerHTML = `<p style="text-align:center; color:#ff4d4d;">${i18nNotes[currLangNotes].errConn}</p>`;
        }
    };

    window._renderNotes = (notes) => {
        notesBoard.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesBoard.innerHTML = `<p style="text-align:center; width:100%; color:rgba(255,255,255,0.6);">${i18nNotes[currLangNotes].empty}</p>`;
            return;
        }

        notes.forEach(note => {
            const randomColor = themeColors[Math.floor(Math.random() * themeColors.length)];
            const dateObj = new Date(note.created_at);
            const timeString = dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'note-card';
            card.style.background = randomColor; 
            card.innerHTML = `
                <div class="note-text">${escapeHTML(note.content)}</div>
                <div class="note-footer"><span>🕒 ${timeString}</span></div>
            `;
            notesBoard.appendChild(card);
        });
    };

    const addNote = async () => {
        const content = textInput.value; 
        const t = i18nNotes[currLangNotes];

        if (content.trim() === '') { showToast(t.warnEmpty, 'warning'); return; }
        const token = localStorage.getItem('authToken'); 
        if (!token) { showToast(t.warnLogin, "warning"); return; }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content: content }) 
            });

            if (!res.ok) {
                let errorMessage = t.duplicate; 
                try {
                    const errData = await res.json();
                    errorMessage = errData.message || errData.error || errorMessage;
                } catch (e) {}
                showToast(errorMessage, "error");
                return; 
            }

            textInput.value = ''; 
            showToast(t.success, 'success'); 
            fetchNotes();         
        } catch (error) {
            console.error("發佈失敗：", error);
            showToast(t.fail, "error"); 
        }
    };

    const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));

    addBtn.addEventListener('click', addNote);
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
    });

    fetchNotes();
})();

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
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};