document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const actionBtn = document.getElementById('action-btn');
    const sendIcon = actionBtn.querySelector('.send-icon');
    const stopIcon = actionBtn.querySelector('.stop-icon');
    const welcomeScreen = document.getElementById('welcome-screen');
    
    // 設定按鈕
    const themeToggle = document.getElementById('theme-toggle');
    const fontToggle = document.getElementById('font-toggle');
    const langToggle = document.getElementById('lang-toggle');
    const langMenu = document.getElementById('lang-menu');
    const langOptions = langMenu.querySelectorAll('li');

    let isGenerating = false;
    let typingInterval = null;
    let currentLastPrompt = ""; 
    let lastTopic = ""; // ✨ 當作 AI 的短期記憶，記住現在聊到的話題
    
    // --- UI 互動邏輯 ---

    // 1. 自動調整 Textarea 高度 & 監聽輸入狀態
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        if (this.value.trim().length > 0 && !isGenerating) {
            actionBtn.disabled = false;
        } else if (!isGenerating) {
            actionBtn.disabled = true;
        }
    });

    // 2. 監聽 Enter 鍵發送 (Shift + Enter 換行)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            if (!actionBtn.disabled && !isGenerating) {
                handleSend();
            }
        }
    });

    // 3. 發送/停止 按鈕點擊事件
    actionBtn.addEventListener('click', () => {
        if (isGenerating) {
            stopGeneration();
        } else {
            handleSend();
        }
    });

    // 4. 點擊建議對話 (破冰標籤)
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            messageInput.value = chip.innerText;
            handleSend();
        });
    });

    // --- 核心功能 ---

    function handleSend(forcePrompt = null) {
        const text = forcePrompt || messageInput.value.trim();
        if (!text) return;

        if (welcomeScreen) welcomeScreen.style.display = 'none';

        currentLastPrompt = text;
        
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
                <div class="ai-toolbar" style="display:none;">
                    <button class="copy-btn"><i class="fa-regular fa-copy"></i> 複製</button>
                    <button class="regen-btn"><i class="fa-solid fa-rotate-right"></i> 重新生成</button>
                </div>
            </div>
        `;
        chatArea.appendChild(row);
        scrollToBottom();

        const contentDiv = row.querySelector('.content');
        const toolbar = row.querySelector('.ai-toolbar');

        // 模擬網路延遲 1.5 秒後開始打字
        setTimeout(() => {
            if (!isGenerating) return; 

            contentDiv.innerHTML = ''; 
            
            // ✨ 國際化大腦：支援多國語言的關鍵字判斷與髒話過濾
            let fakeResponse = "";
            const textLower = userText.toLowerCase(); 
            
            // 1. 國際髒話過濾庫
            const badWords = ['幹', '靠杯', '靠北', '媽的', '白痴', '智障', '去死', '靠夭', '賤', 'fuck', 'shit', 'bitch', 'バカ', '死ね', 'クソ'];
            const hasBadWord = badWords.some(word => textLower.includes(word));

            if (hasBadWord) {
                if (currentLang === "en") {
                    fakeResponse = "Take a deep breath~ Let the ocean waves wash away the negativity. Let's keep things gentle here, okay? 💙";
                } else if (currentLang === "ja") {
                    fakeResponse = "深呼吸しましょう～ 海の波がネガティブな気持ちを洗い流してくれますように。ここでは優しい言葉を使いましょうね💙";
                } else {
                    fakeResponse = "深呼吸～海浪會帶走所有的不愉快，但我們在這裡要保持溫和喔！試著用平靜的文字跟我說說怎麼了吧？💙";
                }
            } 
            // 2. 中文版大腦 (繁/簡)
            else if (currentLang === "zh-TW" || currentLang === "zh-CN") {
                if (userText.includes('請假信') || userText.includes('請假')) {
                    lastTopic = ""; 
                    fakeResponse = "沒問題！這是一封簡單的請假信範本：\n\n「主管您好，我因個人身體不適，需要請假一天休息，懇請批准。造成不便敬請見諒。」\n\n好好休息，健康最重要喔！";
                } else if (userText.includes('白噪音')) {
                    lastTopic = "";
                    fakeResponse = "我非常推薦「深海潛水」或是「雨天微風」的白噪音，閉上眼睛聽，可以讓思緒像海浪一樣平靜下來喔。🌊";
                } 
                // 笑話邏輯
                else if (userText.includes('笑話') || (lastTopic === "joke" && (userText.includes('還有') || userText.includes('別的') || userText.includes('再來')))) {
                    lastTopic = "joke"; 
                    const jokeList = [
                        "有一天，小明去海邊玩。他對著大海喊：「大海啊！你裡面到底有什麼？」\n結果海浪拍打著礁石說：「有...有...有點鹹...」🌊😂",
                        "為什麼海不能當律師？\n因為海「無邊無際」，沒辦法結案！🌊😎",
                        "小魚問大魚：「媽媽，為什麼我們喜歡說話一直吐泡泡？」\n大魚說：「因為...不然我們在水裡說話會被嗆到啊！」🫧🐟",
                        "蚌殼精生病了，他朋友問他怎麼了？\n他虛弱地說：「我...我可能有點自閉...」🦪"
                    ];
                    fakeResponse = jokeList[Math.floor(Math.random() * jokeList.length)];
                } 
                // 難過情緒 (隨機語錄)
                else if (userText.includes('難過') || userText.includes('想哭') || userText.includes('心累') || userText.includes('煩') || userText.includes('壓力') || userText.includes('傷心') || userText.includes('沮喪') || userText.includes('痛苦') || userText.includes('不開心') || userText.includes('不太開心') || userText.includes('不高興') || userText.includes('炒魷魚') || userText.includes('失業') || userText.includes('分手') || userText.includes('嗚嗚') || userText.includes('QQ') || userText.includes('哭哭') || userText.includes('好慘') || userText.includes('糟糕') || userText.includes('很爛')) {
                    lastTopic = "";
                    const sadResponses = [
                        "聽到你這麼說，我很心疼。不要把壓力都憋在心裡，想哭的話就哭出來吧！我會在這裡靜靜陪著你，把不開心都裝進漂流瓶裡丟掉。💙",
                        "你絕對不爛，你已經做得很好了！有時候只是運氣不佳，給自己一點喘息的空間吧，深呼吸～🌊",
                        "乖乖不哭，遇到不順心的事情一定很難受。今晚就讓自己放個假，聽聽白噪音好好睡一覺，好嗎？🫧",
                        "不要用別人的錯誤或是壞事來否定自己喔！你是最棒的！有什麼委屈都可以繼續跟我說，我當你的專屬垃圾桶。🫂",
                        "不管發生什麼事，你都不是一個人喔！海浪會帶走這些煩惱的，先喝口溫水，沉澱一下心情吧。✨"
                    ];
                    fakeResponse = sadResponses[Math.floor(Math.random() * sadResponses.length)];
                
                } 
                // ✨ 生氣情緒擴充 (隨機語錄)
                else if (userText.includes('生氣') || userText.includes('討厭') || userText.includes('氣死')) {
                    lastTopic = "";
                    const angryResponses = [
                        "哎呀，是誰惹你生氣了！先深呼吸，喝口水。生氣很傷身體的，有什麼不滿都可以對我說，我當你的出氣筒！😤",
                        "氣死人了！把惹你生氣的事情通通丟進海裡餵鯊魚吧！🦈 需要我幫你一起罵嗎？",
                        "呼～氣到發抖了嗎？閉上眼睛，想像自己正漂浮在平靜的藍色大海裡...先把情緒冷卻下來，再來解決問題喔！🌊",
                        "不要拿別人的錯誤懲罰自己呀！喝杯甜甜的飲料，讓壞心情隨著氣泡飄走吧！🫧"
                    ];
                    fakeResponse = angryResponses[Math.floor(Math.random() * angryResponses.length)];
                } 
                // ✨ 開心情緒擴充 (隨機語錄)
                else if (userText.includes('開心') || userText.includes('高興') || userText.includes('好笑')) {
                    lastTopic = "";
                    const happyResponses = [
                        "哇！聽起來好棒！看到你開心，我也跟著開心起來了～希望這份好心情能陪伴你一整天！✨",
                        "太讚了吧！這種好心情就像海面上的陽光一樣閃閃發亮呢！🌞 還有什麼好玩的事，快跟我分享！",
                        "哈哈哈，聽你這麼說我也覺得好有意思！要把這份快樂裝進專屬的星空瓶裡好好收藏喔！🌟",
                        "看到你心情好，感覺連我們校園導覽地圖上的每一個地標都跟著可愛起來了呢！繼續保持好心情喔！🗺️"
                    ];
                    fakeResponse = happyResponses[Math.floor(Math.random() * happyResponses.length)];
                } 
                // ✨ 打招呼擴充 (隨機語錄)
                else if (userText.includes('早') || userText.includes('你好') || userText.includes('嗨')) {
                    lastTopic = "";
                    const greetingResponses = [
                        "嗨！今天過得好嗎？不管遇到什麼事，我都準備好聽你分享囉！",
                        "早安早安！今天也是為了畢業專題努力的一天嗎？不管多忙，都要記得好好吃飯喔！🎒",
                        "哈囉！海浪特助已上線～今天有什麼需要我幫忙，或是想找人聊聊天的嗎？🌊",
                        "嗨～歡迎來到心情海岸！點擊上面的白噪音，我們開始今天放鬆的對話吧！🎧"
                    ];
                    fakeResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
                }

                // --- 🧠 記憶區塊 1：放假/出去玩 ---
                else if (userText.includes('放假') || userText.includes('出去玩') || userText.includes('旅遊') || userText.includes('逛逛') || userText.includes('休假')) {
                    lastTopic = "travel"; 
                    const playResponses = [
                        "太棒了！放假就是要好好放鬆呀～如果還沒決定去哪，有滿多不錯的景點可以去走走喔！需要我幫你找找地圖嗎？🗺️",
                        "放假出遊！聽起來就很開心～要把這份期待裝進漂流瓶裡喔！有想好要去哪裡玩了嗎？✨",
                        "好羨慕呀！出去玩記得注意安全，拍些漂亮的照片回來跟我分享喔！🎒",
                        "耶！終於可以休息了！祝你明天玩得開心，煩惱通通拋到腦後！🌊"
                    ];
                    fakeResponse = playResponses[Math.floor(Math.random() * playResponses.length)];
                }
                else if (lastTopic === "travel" && (userText.includes('還沒') || userText.includes('沒有') || userText.includes('不知道') || userText.includes('沒想法'))) {
                    lastTopic = ""; 
                    fakeResponse = "既然還沒想好，不如來看看我們的校園生活地圖，我來幫你導覽附近有什麼好玩好吃的！📍";
                }

                // --- 🧠 記憶區塊 2：塔羅牌占卜 (雙句隨機引導版) ---
                else if (userText.includes('算命') || userText.includes('塔羅') || userText.includes('占卜') || userText.includes('算一下')) {
                    lastTopic = ""; 
                    const tarotResponses = [
                        "我沒有辦法幫你占卜喔！不過你可以去玩『秘密海域遊樂場』裡的命運海之卜：今日塔羅瓶，說不定能給你一些指引喔！🔮✨",
                        "占卜這部分我幫不上忙啦～但我記得遊樂場裡有今日塔羅瓶可以玩，快去試試看能不能解開你的心事吧！💙"
                    ];
                    fakeResponse = tarotResponses[Math.floor(Math.random() * tarotResponses.length)];
                }

                // --- 🧠 記憶區塊 3：打發時間 (追劇/遊戲) ---
                else if (userText.includes('無聊') || userText.includes('推薦') || userText.includes('打發時間') || userText.includes('追劇') || userText.includes('遊戲')) {
                    lastTopic = "entertainment"; 
                    fakeResponse = "無聊的話，要不要我推薦一些好玩的給你？你比較想看甜甜的電視劇，還是想玩精緻的換裝手遊呢？✨";
                }
                else if (lastTopic === "entertainment" && (userText.includes('甜') || userText.includes('戀愛') || userText.includes('劇') || userText.includes('電視'))) {
                    lastTopic = ""; 
                    fakeResponse = "那太好了！我強烈推薦你可以重溫像《微微一笑很傾城》這種結合專業領域又甜甜的經典，看了心情一定會像海浪一樣輕快喔！💻💙";
                }
                else if (lastTopic === "entertainment" && (userText.includes('遊戲') || userText.includes('換裝') || userText.includes('手遊'))) {
                    lastTopic = ""; 
                    fakeResponse = "說到這個，像《以閃亮之名》這種精緻的換裝遊戲就很紓壓喔！隨心所欲搭配漂亮的衣服，保證能把無聊一掃而空！👗✨";
                }

                // ✨ 道謝擴充 (隨機語錄)
                else if (userText.includes('謝謝') || userText.includes('感謝') || userText.includes('好，') || userText === '好' || userText === '好的' || userText.includes('知道')) {
                    lastTopic = "";
                    const thanksResponses = [
                        "不客氣！能陪在你身邊是我的榮幸。如果還有什麼心事或需要幫忙的，隨時把漂流瓶丟給我喔！💙",
                        "別跟我客氣啦！這就是我存在的意義呀～還有什麼想聊的，我隨時都在！🫧",
                        "好的！希望我有幫上你的忙，要記得隨時保持好心情喔！✨",
                        "沒問題！深海特助隨時為你待命！🫡"
                    ];
                    fakeResponse = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
                }
                // 預設回覆：中性、溫和且隨機的傾聽者模式
                else {
                    lastTopic = "";
                    const defaultResponses = [
                        "我收到你的漂流瓶了！雖然我只是個還在學習的 AI，可能沒辦法完全理解所有的事，但我會一直在這裡傾聽。可以多跟我說說嗎？👂",
                        "原來是這樣呀。不管發生什麼事，深呼吸，海浪會陪著你一起平靜下來的。🌊",
                        "這件事聽起來對你滿重要的。如果你的願意，隨時可以跟我分享更多細節喔！💙",
                        "我在聽喔！如果覺得心煩，也可以點擊上面的按鈕，讓我講個冷笑話給你聽，放鬆一下心情！✨"
                    ];
                    fakeResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
                }
            }
            // 3. 英文版大腦 (English)
            else if (currentLang === "en") {
                if (textLower.includes('leave') || textLower.includes('sick')) {
                    fakeResponse = "No problem! Here's a simple leave letter template:\n\n'Dear Manager, I am writing to request a day off due to illness. I hope to rest and recover soon. Thank you for understanding.'\n\nTake care of yourself!";
                } else if (textLower.includes('white noise') || textLower.includes('music')) {
                    fakeResponse = "I highly recommend 'Deep Sea Diving' or 'Rainy Breeze' white noise. Close your eyes and let your mind calm down like the ocean waves. 🌊";
                } else if (textLower.includes('joke') || textLower.includes('funny')) {
                    fakeResponse = "Why does the ocean never get angry? Because it knows how to wave it off! 🌊😂";
                } else if (textLower.includes('sad') || textLower.includes('cry') || textLower.includes('stress') || textLower.includes('tired')) {
                    fakeResponse = "I'm so sorry you're feeling this way. Don't bottle it up—it's okay to cry! I'll be right here with you. Let's put the sadness in a drift bottle and throw it away. 💙";
                } else if (textLower.includes('angry') || textLower.includes('mad') || textLower.includes('hate')) {
                    fakeResponse = "Oh no, who made you mad? Take a deep breath and drink some water. You can vent to me as much as you want! 😤";
                } else if (textLower.includes('happy') || textLower.includes('glad')) {
                    fakeResponse = "Wow! That sounds amazing! Seeing you happy makes me so happy too~ ✨";
                } else if (textLower.includes('hi') || textLower.includes('hello')) {
                    fakeResponse = "Hi there! How's your day going? I'm always ready to listen!";
                } else {
                    fakeResponse = "That sounds interesting! Can you tell me more about it? I'm always here for you.";
                }
            } 
            // 4. 日文版大腦 (日本語)
            else if (currentLang === "ja") {
                if (textLower.includes('休み') || textLower.includes('休暇')) {
                    fakeResponse = "承知いたしました！こちらがシンプルな休暇届のテンプレートです：\n\n「お疲れ様です。体調不良のため、本日お休みをいただきたく存じます。ご迷惑をおかけして申し訳ありません。」\n\nゆっくり休んでくださいね！";
                } else if (textLower.includes('環境音') || textLower.includes('ノイズ') || textLower.includes('音楽')) {
                    fakeResponse = "「深海のダイビング」や「雨の日の微風」の環境音がとてもおすすめです。目を閉じて、波のように心を落ち着かせてみてください。🌊";
                } else if (textLower.includes('冗談') || textLower.includes('笑い')) {
                    fakeResponse = "海が好きな理由は？「波」長が合うから！🌊😂";
                } else if (textLower.includes('悲しい') || textLower.includes('泣き') || textLower.includes('ストレス') || textLower.includes('疲れ')) {
                    fakeResponse = "そうだったんですね、無理しないでください。泣きたい時は泣いてもいいんですよ！私がここで静かに寄り添いますから。💙";
                } else if (textLower.includes('怒') || textLower.includes('むかつく') || textLower.includes('嫌い')) {
                    fakeResponse = "あらら、誰があなたを怒らせたんですか！まずは深呼吸して...不満があれば、何でも私にぶつけてください！😤";
                } else if (textLower.includes('嬉しい') || textLower.includes('楽しい') || textLower.includes('幸せ')) {
                    fakeResponse = "わあ！素晴らしいですね！あなたが嬉しいと私も嬉しくなります〜✨";
                } else if (textLower.includes('おはよう') || textLower.includes('こんにちは') || textLower.includes('やっほ')) {
                    fakeResponse = "こんにちは！今日の調子はどうですか？なんでも聞きますよ！";
                } else {
                    fakeResponse = "それは面白そうですね！もっと詳しく教えてもらえませんか？いつでもここでお話を聞きますよ。";
                }
            }
            
            let index = 0;
            typingInterval = setInterval(() => {
                contentDiv.innerHTML += fakeResponse.charAt(index);
                scrollToBottom();
                index++;

                if (index >= fakeResponse.length) {
                    finishGeneration(toolbar);
                }
            }, 50); 

        }, 1500);

        toolbar.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(contentDiv.innerText));
        toolbar.querySelector('.regen-btn').addEventListener('click', () => {
            row.remove(); 
            handleSend(currentLastPrompt); 
        });
    }

    function stopGeneration() {
        isGenerating = false;
        clearInterval(typingInterval);
        
        const toolbars = document.querySelectorAll('.ai-toolbar');
        if (toolbars.length > 0) {
            toolbars[toolbars.length - 1].style.display = 'flex';
        }
        setButtonState('send');
    }

    function finishGeneration(toolbar) {
        isGenerating = false;
        clearInterval(typingInterval);
        toolbar.style.display = 'flex'; 
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

    // --- 輔助功能 ---

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('✨ 已複製到剪貼簿！');
        });
    }

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
        
        setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }

    // --- 主題與字體設定 ---
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeToggle.innerHTML = newTheme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    });

    let isLargeFont = false;
    fontToggle.addEventListener('click', () => {
        isLargeFont = !isLargeFont;
        document.documentElement.style.setProperty('--base-font-size', isLargeFont ? '18px' : '16px');
    });

    // --- 語言選單邏輯 ---
    
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

    let currentLang = "zh-TW"; 

    langToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!langMenu.contains(e.target) && e.target !== langToggle) {
            langMenu.classList.remove('show');
        }
    });

    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const langName = option.innerText;
            const langCode = option.getAttribute('data-lang'); 
            
            currentLang = langCode;
            const t = uiTranslations[langCode];

            document.querySelector('.chat-header .title').innerHTML = t.appTitle;
            
            const welcomeH2 = document.querySelector('#welcome-screen h2');
            if(welcomeH2) welcomeH2.innerText = t.welcomeH2;
            
            const welcomeP = document.querySelector('#welcome-screen p');
            if(welcomeP) welcomeP.innerText = t.welcomeP;

            const chips = document.querySelectorAll('.suggestion-chips .chip');
            if(chips.length === 3) {
                chips[0].innerText = t.chip1;
                chips[1].innerText = t.chip2;
                chips[2].innerText = t.chip3;
            }

            document.getElementById('message-input').placeholder = t.placeholder;
            document.querySelector('.input-footer-text').innerText = t.footer;

            showToast(`${t.toastPrefix}${langName}`); 
            
            langMenu.classList.remove('show');
        });
    });

});