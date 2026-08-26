document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const actionBtn = document.getElementById('action-btn');
    const sendIcon = actionBtn.querySelector('.send-icon');
    const stopIcon = actionBtn.querySelector('.stop-icon');
    const welcomeScreen = document.getElementById('welcome-screen');

    const themeToggle = document.getElementById('theme-toggle');
    const fontToggle = document.getElementById('font-toggle');
    const langToggle = document.getElementById('lang-toggle');
    const langMenu = document.getElementById('lang-menu');
    const langOptions = langMenu.querySelectorAll('li');

    let isGenerating = false;
    let typingInterval = null;

    // --- UI 互動邏輯 ---
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim().length > 0 && !isGenerating) {
            actionBtn.disabled = false;
        } else if (!isGenerating) {
            actionBtn.disabled = true;
        }
    });

    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!actionBtn.disabled && !isGenerating) {
                handleSend();
            }
        }
    });

    actionBtn.addEventListener('click', () => {
        if (isGenerating) stopGeneration();
        else handleSend();
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            messageInput.value = chip.innerText;
            handleSend();
        });
    });

    // --- 核心連線功能 ---
    function handleSend(forcePrompt = null) {
        const text = forcePrompt || messageInput.value.trim();
        if (!text) return;

        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (!forcePrompt) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }

        appendUserMessage(text);
        setButtonState('stop');
        simulateAIResponse(text);
    }

    function appendUserMessage(text) {
        const row = document.createElement('div');
        row.className = 'message-row user-row';
        row.innerHTML = `<div class="bubble user-bubble">${escapeHTML(text)}</div>`;
        chatArea.appendChild(row);
        scrollToBottom();
    }

    function simulateAIResponse(userText) {
        isGenerating = true;
        const row = document.createElement('div');
        row.className = 'message-row ai-row';
        row.innerHTML = `
            <div class="ai-avatar-small">🤖</div>
            <div class="bubble ai-bubble">
                <div class="content">
                    <div class="typing-indicator"><span></span><span></span><span></span></div>
                </div>
            </div>
        `;
        chatArea.appendChild(row);
        scrollToBottom();
        const contentDiv = row.querySelector('.content');

        // ✨ 真實連線：呼叫 Python 後端 API
        async function fetchRealAIResponse() {
            try {
                const response = await fetch('https://api.drift-bottles.xyz/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userText, language: currentLang })
                });

                if (!response.ok) throw new Error('API 連線失敗');
                const data = await response.json();
                
                const realResponse = data.reply || "抱歉，系統目前有些忙碌... 🤖";

                contentDiv.innerHTML = '';
                let index = 0;
                typingInterval = setInterval(() => {
                    // 處理換行符號
                    if (realResponse.charAt(index) === '\n') {
                        contentDiv.innerHTML += '<br>';
                    } else {
                        contentDiv.innerHTML += realResponse.charAt(index);
                    }
                    scrollToBottom();
                    index++;
                    if (index >= realResponse.length) {
                        finishGeneration();
                    }
                }, 30);

            } catch (error) {
                console.error("連線錯誤:", error);
                contentDiv.innerHTML = "連線到 AI 大腦時發生了點小問題，請稍後再試喔！🤖";
                finishGeneration();
            }
        }
        fetchRealAIResponse();
    }

    function stopGeneration() {
        isGenerating = false;
        clearInterval(typingInterval);
        setButtonState('send');
    }

    function finishGeneration() {
        isGenerating = false;
        clearInterval(typingInterval);
        setButtonState('send');
    }

    function setButtonState(state) {
        if (state === 'stop') {
            actionBtn.classList.remove('send-mode');
            actionBtn.classList.add('stop-mode');
            sendIcon.style.display = 'none';
            stopIcon.style.display = 'inline-block';
            actionBtn.disabled = false;
        } else {
            actionBtn.classList.remove('stop-mode');
            actionBtn.classList.add('send-mode');
            sendIcon.style.display = 'inline-block';
            stopIcon.style.display = 'none';
            actionBtn.disabled = messageInput.value.trim().length === 0;
        }
    }

    function scrollToBottom() { chatArea.scrollTop = chatArea.scrollHeight; }
    function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])); }
    function showToast(message) {
        let toast = document.getElementById("custom-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "custom-toast";
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.classList.add("show");
        setTimeout(() => { toast.classList.remove("show"); }, 2500);
    }

    // --- 主題、字體與語言 (加上 localStorage 記憶功能) ---

    // 1. 深淺色記憶
    const savedTheme = localStorage.getItem('chat_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('chat_theme', newTheme); // 寫入記憶
        themeToggle.innerHTML = newTheme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    });

    // 2. 字體大小切換 (改用 clamp 支援 RWD)
    let isLargeFont = false;
    fontToggle.addEventListener('click', () => {
        isLargeFont = !isLargeFont;
        const newSize = isLargeFont ? 'clamp(18px, 2vw, 26px)' : 'clamp(14px, 1.5vw, 22px)';
        document.documentElement.style.setProperty('--base-font-size', newSize);
    });

    // 3. 語言記憶與字典
    const uiTranslations = {
        "zh-TW": {
            appTitle: "✨ AI 特助",
            welcomeH2: "嗨！我是您的 AI 特助",
            welcomeP: "今天有什麼我可以幫忙的呢？",
            chip1: "幫我寫一封請假信",
            chip2: "推薦我好聽的白噪音",
            chip3: "我想聽個笑話",
            placeholder: "問問我任何事...",
            footer: "AI 生成的內容可能會有誤，請自行核實。",
            toastPrefix: "已切換至："
        },
        "zh-CN": {
            appTitle: "✨ AI 特助",
            welcomeH2: "嗨！我是您的 AI 特助",
            welcomeP: "今天有什么我可以帮忙的呢？",
            chip1: "帮我写一封请假信",
            chip2: "推荐我好听的白噪音",
            chip3: "我想听个笑话",
            placeholder: "问问我任何事...",
            footer: "AI 生成的内容可能会有误，请自行核实。",
            toastPrefix: "已切换至："
        },
        "en": {
            appTitle: "✨ AI Assistant",
            welcomeH2: "Hi! I'm your AI Assistant",
            welcomeP: "How can I help you today?",
            chip1: "Write a leave letter",
            chip2: "Recommend white noise",
            chip3: "Tell me a joke",
            placeholder: "Ask me anything...",
            footer: "AI-generated content may be incorrect, please verify.",
            toastPrefix: "Switched to: "
        },
        "ja": {
            appTitle: "✨ AI アシスタント",
            welcomeH2: "こんにちは！AI アシスタントです",
            welcomeP: "今日は何かお手伝いしましょうか？",
            chip1: "休暇届を書いて",
            chip2: "おすすめの環境音",
            chip3: "冗談を言って",
            placeholder: "何でも聞いてください...",
            footer: "AI生成コンテンツは誤っている可能性があります。ご自身で確認してください。",
            toastPrefix: "言語を変更しました: "
        }
    };

    // ✨ 讀取記憶中的語言，如果沒有則預設繁體中文
    let currentLang = localStorage.getItem('chat_lang') || "zh-TW";

    // 建立一個更新 UI 語言的函式
    function updateLanguageUI(langCode, langName = null) {
        currentLang = langCode;
        localStorage.setItem('chat_lang', langCode); // 寫入記憶
        const t = uiTranslations[langCode];
        
        document.querySelector('.chat-header .title').innerHTML = t.appTitle;
        const welcomeH2 = document.querySelector('#welcome-screen h2');
        if (welcomeH2) welcomeH2.innerText = t.welcomeH2;
        const welcomeP = document.querySelector('#welcome-screen p');
        if (welcomeP) welcomeP.innerText = t.welcomeP;
        
        const chips = document.querySelectorAll('.suggestion-chips .chip');
        if (chips.length === 3) {
            chips[0].innerText = t.chip1;
            chips[1].innerText = t.chip2;
            chips[2].innerText = t.chip3;
        }
        document.getElementById('message-input').placeholder = t.placeholder;
        document.querySelector('.input-footer-text').innerText = t.footer;
        
        if (langName) {
            showToast(`${t.toastPrefix}${langName}`);
        }
    }

    // 網頁剛載入時，直接套用記憶裡的語言
    updateLanguageUI(currentLang);

    // 下拉選單控制
    langToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
        if (!langMenu.contains(e.target) && e.target !== langToggle) langMenu.classList.remove('show');
    });

    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const langName = option.innerText;
            const langCode = option.getAttribute('data-lang');
            updateLanguageUI(langCode, langName);
            langMenu.classList.remove('show');
        });
    });
});