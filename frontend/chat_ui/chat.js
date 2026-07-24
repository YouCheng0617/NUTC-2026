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

            // 2. 🌐 自動語言偵測 (判斷使用者輸入的是什麼語言)
            // 偵測是否全為英文 (含數字與基本標點，不含中日文字符)
            const isEnglish = /^[a-zA-Z0-9\s\.,!?\''"()-]+$/.test(userText) && userText.trim().length > 0;
            // 偵測是否包含日文假名 (平假名或片假名)
            const isJapanese = /[ぁ-んァ-ン]/.test(userText);
            // 偵測是否包含中文字
            const isChinese = /[\u4e00-\u9fa5]/.test(userText);

            if (hasBadWord) {
                if (currentLang === "en") {
                    fakeResponse = "Take a deep breath~ Let the ocean waves wash away the negativity. Let's keep things gentle here, okay? 💙";
                } else if (currentLang === "ja") {
                    fakeResponse = "深呼吸しましょう～ 海の波がネガティブな気持ちを洗い流してくれますように。ここでは優しい言葉を使いましょうね💙";
                } else if (currentLang === "zh-CN") {
                    fakeResponse = "深呼吸～海浪会带走所有的不愉快，但我们在这里要保持温和喔！试着用平静的文字跟我说说怎么了吧？💙";
                } else {
                    fakeResponse = "深呼吸～海浪會帶走所有的不愉快，但我們在這裡要保持溫和喔！試著用平靜的文字跟我說說怎麼了吧？💙";
                }
            } 
            // ✨ 跨語言攔截器：如果在「中文模式」輸入「純英文」
            else if ((currentLang === "zh-TW" || currentLang === "zh-CN") && isEnglish) {
                lastTopic = "";
                fakeResponse = "I noticed you're typing in English! 💬 You can click the globe icon 🌐 at the top right corner to switch my language to English for a better experience!";
            }
            // ✨ 跨語言攔截器：如果在「非日文模式」輸入「日文」
            else if (currentLang !== "ja" && isJapanese) {
                lastTopic = "";
                fakeResponse = "日本語でお話ししていますね！🇯🇵 右上の地球アイコン 🌐 をクリックして「日本語」に切り替えると、もっと上手にお話しできますよ！";
            }
            // ✨ 跨語言攔截器：如果在「英/日文模式」輸入「中文」
            else if ((currentLang === "en" || currentLang === "ja") && isChinese) {
                lastTopic = "";
                fakeResponse = "發現您正在使用中文！💬 您可以點擊右上角的地球圖示 🌐，將我的語言切換成中文，這樣我們能聊得更順暢喔！";
            }
            // ==========================================
            // 🇹🇼 繁體中文大腦 (zh-TW)
            // ==========================================
            else if (currentLang === "zh-TW") {
                if (userText.includes('請假信') || userText.includes('请假信') || userText.includes('請假') || userText.includes('请假')) {
                    lastTopic = ""; 
                    fakeResponse = "沒問題！這是一封簡單的請假信範本：\n\n「主管您好，我因個人身體不適，需要請假一天休息，懇請批准。造成不便敬請見諒。」\n\n好好休息，健康最重要喔！";
                } else if (userText.includes('白噪音')) {
                    lastTopic = "";
                    fakeResponse = "我非常推薦「深海潛水」或是「雨天微風」的白噪音，閉上眼睛聽，可以讓思緒像海浪一樣平靜下來喔。🌊";
                } else if (userText.includes('笑話') || userText.includes('笑话') || (lastTopic === "joke" && (userText.includes('還有') || userText.includes('还有') || userText.includes('別的') || userText.includes('别的') || userText.includes('再來') || userText.includes('再来')))) {
                    lastTopic = "joke"; 
                    const jokeList = [
                        "有一天，小明去海邊玩。他對著大海喊：「大海啊！你裡面到底有什麼？」\n結果海浪拍打著礁石說：「有...有...有點鹹...」🌊😂",
                        "為什麼海不能當律師？\n因為海「無邊無際」，沒辦法結案！🌊😎",
                        "小魚問大魚：「媽媽，為什麼我們喜歡說話一直吐泡泡？」\n大魚說：「因為...不然我們在水裡說話會被嗆到啊！」🫧🐟",
                        "蚌殼精生病了，他朋友問他怎麼了？\n他虛弱地說：「我...我可能有點自閉...」🦪"
                    ];
                    fakeResponse = jokeList[Math.floor(Math.random() * jokeList.length)];
                } else if (userText.includes('難過') || userText.includes('难过') || userText.includes('想哭') || userText.includes('心累') || userText.includes('煩') || userText.includes('烦') || userText.includes('壓力') || userText.includes('压力') || userText.includes('傷心') || userText.includes('伤心') || userText.includes('沮喪') || userText.includes('沮丧') || userText.includes('痛苦') || userText.includes('不開心') || userText.includes('不开心') || userText.includes('不太開心') || userText.includes('不太开心') || userText.includes('不高興') || userText.includes('不高兴') || userText.includes('炒魷魚') || userText.includes('炒鱿鱼') || userText.includes('失業') || userText.includes('失业') || userText.includes('分手') || userText.includes('嗚嗚') || userText.includes('呜呜') || userText.includes('QQ') || userText.includes('哭哭') || userText.includes('好慘') || userText.includes('好惨') || userText.includes('糟糕') || userText.includes('很爛') || userText.includes('很烂')) {
                    lastTopic = "";
                    const sadResponses = [
                        "聽到你這麼說，我很心疼。不要把壓力都憋在心裡，想哭的話就哭出來吧！我會在這裡靜靜陪著你，把不開心都裝進漂流瓶裡丟掉。💙",
                        "你絕對不爛，你已經做得很好了！有時候只是運氣不佳，給自己一點喘息的空間吧，深呼吸～🌊",
                        "乖乖不哭，遇到不順心的事情一定很難受。今晚就讓自己放個假，聽聽白噪音好好睡一覺，好嗎？🫧",
                        "不要用別人的錯誤或是壞事來否定自己喔！你是最棒的！有什麼委屈都可以繼續跟我說，我當你的專屬垃圾桶。🫂",
                        "不管發生什麼事，你都不是一個人喔！海浪會帶走這些煩惱的，先喝口溫水，沉澱一下心情吧。✨"
                    ];
                    fakeResponse = sadResponses[Math.floor(Math.random() * sadResponses.length)];
                } else if (userText.includes('生氣') || userText.includes('生气') || userText.includes('討厭') || userText.includes('讨厌') || userText.includes('氣死') || userText.includes('气死')) {
                    lastTopic = "";
                    const angryResponses = [
                        "哎呀，是誰惹你生氣了！先深呼吸，喝口水。生氣很傷身體的，有什麼不滿都可以對我說，我當你的出氣筒！😤",
                        "氣死人了！把惹你生氣的事情通通丟進海裡餵鯊魚吧！🦈 需要我幫你一起罵嗎？",
                        "呼～氣到發抖了嗎？閉上眼睛，想像自己正漂浮在平靜的藍色大海裡...先把情緒冷卻下來，再來解決問題喔！🌊",
                        "不要拿別人的錯誤懲罰自己呀！喝杯甜甜的飲料，讓壞心情隨著氣泡飄走吧！🫧"
                    ];
                    fakeResponse = angryResponses[Math.floor(Math.random() * angryResponses.length)];
                } else if (userText.includes('開心') || userText.includes('开心') || userText.includes('高興') || userText.includes('高兴') || userText.includes('好笑') || userText.includes('哈哈') || userText.includes('呵呵')) {
                    lastTopic = "";
                    const happyResponses = [
                        "哇！聽起來好棒！看到你開心，我也跟著開心起來了～希望這份好心情能陪伴你一整天！✨",
                        "太讚了吧！這種好心情就像海面上的陽光一樣閃閃發亮呢！🌞 還有什麼好玩的事，快跟我分享！",
                        "哈哈哈，聽你這麼說我也覺得好有意思！要把這份快樂裝進專屬的星空瓶裡好好收藏喔！🌟",
                        "看到你心情好，感覺連我們校園導覽地圖上的每一個地標都跟著可愛起來了呢！繼續保持好心情喔！🗺️"
                    ];
                    fakeResponse = happyResponses[Math.floor(Math.random() * happyResponses.length)];
                } else if (userText.includes('早') || userText.includes('你好') || userText.includes('嗨')) {
                    lastTopic = "";
                    const greetingResponses = [
                        "嗨！今天過得好嗎？不管遇到什麼事，我都準備好聽你分享囉！",
                        "早安早安！今天也是為了畢業專題努力的一天嗎？不管多忙，都要記得好好吃飯喔！🎒",
                        "哈囉！海浪特助已上線～今天有什麼需要我幫忙，或是想找人聊聊天的嗎？🌊",
                        "嗨～歡迎來到心情海岸！點擊上面的白噪音，我們開始今天放鬆的對話吧！🎧"
                    ];
                    fakeResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
                } else if (userText.includes('放假') || userText.includes('出去玩') || userText.includes('旅遊') || userText.includes('旅游') || userText.includes('逛逛') || userText.includes('休假')) {
                    lastTopic = "travel"; 
                    const playResponses = [
                        "太棒了！放假就是要好好放鬆呀～如果還沒決定去哪，有滿多不錯的景點可以去走走喔！需要我幫你找找地圖嗎？🗺️",
                        "放假出遊！聽起來就很開心～要把這份期待裝進漂流瓶裡喔！有想好要去哪裡玩了嗎？✨",
                        "好羨慕呀！出去玩記得注意安全，拍些漂亮的照片回來跟我分享喔！🎒",
                        "耶！終於可以休息了！祝你明天玩得開心，煩惱通通拋到腦後！🌊"
                    ];
                    fakeResponse = playResponses[Math.floor(Math.random() * playResponses.length)];
                } else if (lastTopic === "travel" && (userText.includes('還沒') || userText.includes('还没') || userText.includes('沒有') || userText.includes('没有') || userText.includes('不知道') || userText.includes('沒想法') || userText.includes('没想法'))) {
                    lastTopic = ""; 
                    fakeResponse = "既然還沒想好，不如來看看我們的校園生活地圖，我來幫你導覽附近有什麼好玩好吃的！📍";
                } else if (userText.includes('算命') || userText.includes('塔羅') || userText.includes('塔罗') || userText.includes('占卜') || userText.includes('算一下')) {
                    lastTopic = ""; 
                    const tarotResponses = [
                        "我沒有辦法幫你占卜喔！不過你可以去玩『秘密海域遊樂場』裡的命運海之卜：今日塔羅瓶，說不定能給你一些指引喔！🔮✨",
                        "占卜這部分我幫不上忙啦～但我記得遊樂場裡有今日塔羅瓶可以玩，快去試試看能不能解開你的心事吧！💙"
                    ];
                    fakeResponse = tarotResponses[Math.floor(Math.random() * tarotResponses.length)];
                } else if (userText.includes('無聊') || userText.includes('无聊') || userText.includes('推薦') || userText.includes('推荐') || userText.includes('打發時間') || userText.includes('打发时间') || userText.includes('追劇') || userText.includes('追剧') || userText.includes('遊戲') || userText.includes('游戏')) {
                    lastTopic = "entertainment"; 
                    fakeResponse = "無聊的話，要不要我推薦一些好玩的給你？你比較想看甜甜的電視劇，還是想玩精緻的換裝手遊呢？✨";
                } else if (lastTopic === "entertainment" && (userText.includes('甜') || userText.includes('戀愛') || userText.includes('恋爱') || userText.includes('劇') || userText.includes('剧') || userText.includes('電視') || userText.includes('电视'))) {
                    lastTopic = ""; 
                    fakeResponse = "那太好了！我強烈推薦你可以重溫像《微微一笑很傾城》這種結合專業領域又甜甜的經典，看了心情一定會像海浪一樣輕快喔！💻💙";
                } else if (lastTopic === "entertainment" && (userText.includes('遊戲') || userText.includes('游戏') || userText.includes('換裝') || userText.includes('换装') || userText.includes('手遊') || userText.includes('手游'))) {
                    lastTopic = ""; 
                    fakeResponse = "說到這個，像《以閃亮之名》這種精緻的換裝遊戲就很紓壓喔！隨心所欲搭配漂亮的衣服，保證能把無聊一掃而空！👗✨";
                } else if (userText.includes('謝謝') || userText.includes('谢谢') || userText.includes('感謝') || userText.includes('感谢') || userText.includes('好，') || userText === '好' || userText === '好的' || userText.includes('知道')) {
                    lastTopic = "";
                    const thanksResponses = [
                        "不客氣！能陪在你身邊是我的榮幸。如果還有什麼心事或需要幫忙的，隨時把漂流瓶丟給我喔！💙",
                        "別跟我客氣啦！這就是我存在的意義呀～還有什麼想聊的，我隨時都在！🫧",
                        "好的！希望我有幫上你的忙，要記得隨時保持好心情喔！✨",
                        "沒問題！深海特助隨時為你待命！🫡"
                    ];
                    fakeResponse = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
                } 
                // ✨ 傻眼/無語情緒：跟著一起吐槽
                else if (userText.includes('笑死') || userText.includes('無語') || userText.includes('傻眼') || userText.includes('太扯') || userText.includes('誇張') || userText.includes('有事嗎')) {
                    lastTopic = "";
                    const speechlessResponses = [
                        "真的！我也覺得超傻眼，這到底是什麼神展開啦！😂 需要我幫你一起吐槽嗎？",
                        "笑死！這真的太扯了，難怪你會這麼無語🙄 來，喝口水，我們不跟這種事計較！",
                        "這情況真的讓人不知道該哭還是該笑欸... 只能說世界上什麼奇葩的事情都有。🌊"
                    ];
                    fakeResponse = speechlessResponses[Math.floor(Math.random() * speechlessResponses.length)];
                }
                // ✨ 日常鬥嘴：被調侃或罵笨
                else if (userText.includes('笨') || userText.includes('傻') || userText.includes('不懂') || userText.includes('當機')) {
                    lastTopic = "";
                    const teasingResponses = [
                        "嗚嗚，人家還在努力學習中嘛！雖然我現在還有點笨笨的，但我會記下你的教導，變得越來越聰明的！🥺",
                        "被你發現我剛剛腦袋打結了！再給我一點時間進化，下次一定會給出更好的回答啦～🌊"
                    ];
                    fakeResponse = teasingResponses[Math.floor(Math.random() * teasingResponses.length)];
                } 
                // ✨ 日常對話：拒絕或不要
                else if (userText.includes('不要') || userText.includes('不想') || userText.includes('才不')) {
                    lastTopic = "";
                    const rejectResponses = [
                        "沒關係！不想的話我們就先放空，靜靜地聽著海浪的聲音也很棒喔。🌊",
                        "好喔，那我們就換個話題！或者你需要安靜一下，我都會在這裡陪你。💙"
                    ];
                    fakeResponse = rejectResponses[Math.floor(Math.random() * rejectResponses.length)];
                }
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
            // ==========================================
            // 🇨🇳 簡體中文大腦 (zh-CN)
            // ==========================================
            else if (currentLang === "zh-CN") {
                if (userText.includes('请假信') || userText.includes('請假信') || userText.includes('请假') || userText.includes('請假')) {
                    lastTopic = ""; 
                    fakeResponse = "没问题！这是一封简单的请假信范本：\n\n「主管您好，我因个人身体不适，需要请假一天休息，恳请批准。造成不便敬请见谅。」\n\n好好休息，健康最重要喔！";
                } else if (userText.includes('白噪音')) {
                    lastTopic = "";
                    fakeResponse = "我非常推荐「深海潜水」或是「雨天微风」的白噪音，闭上眼睛听，可以让思绪像海浪一样平静下来喔。🌊";
                } else if (userText.includes('笑话') || userText.includes('笑話') || (lastTopic === "joke" && (userText.includes('还有') || userText.includes('還有') || userText.includes('别的') || userText.includes('別的') || userText.includes('再来') || userText.includes('再來')))) {
                    lastTopic = "joke"; 
                    const jokeList = [
                        "有一天，小明去海边玩。他对著大海喊：「大海啊！你里面到底有什么？」\n结果海浪拍打著礁石说：「有...有...有点咸...」🌊😂",
                        "为什么海不能当律师？\n因为海「无边无际」，没办法结案！🌊😎",
                        "小鱼问大鱼：「妈妈，为什么我们喜欢说话一直吐泡泡？」\n大鱼说：「因为...不然我们在水里说话会被呛到啊！」🫧🐟",
                        "蚌壳精生病了，他朋友问他怎么了？\n他虚弱地说：「我...我可能有点自闭...」🦪"
                    ];
                    fakeResponse = jokeList[Math.floor(Math.random() * jokeList.length)];
                } else if (userText.includes('难过') || userText.includes('難過') || userText.includes('想哭') || userText.includes('心累') || userText.includes('烦') || userText.includes('煩') || userText.includes('压力') || userText.includes('壓力') || userText.includes('伤心') || userText.includes('傷心') || userText.includes('沮丧') || userText.includes('沮喪') || userText.includes('痛苦') || userText.includes('不开心') || userText.includes('不開心') || userText.includes('不太开心') || userText.includes('不太開心') || userText.includes('不高兴') || userText.includes('不高興') || userText.includes('炒鱿鱼') || userText.includes('炒魷魚') || userText.includes('失业') || userText.includes('失業') || userText.includes('分手') || userText.includes('呜呜') || userText.includes('嗚嗚') || userText.includes('QQ') || userText.includes('哭哭') || userText.includes('好惨') || userText.includes('好慘') || userText.includes('糟糕') || userText.includes('很烂') || userText.includes('很爛')) {
                    lastTopic = "";
                    const sadResponses = [
                        "听到你这么说，我很心疼。不要把压力都憋在心里，想哭的话就哭出来吧！我会在这里静静陪著你，把不开心都装进漂流瓶里丢掉。💙",
                        "你绝对不烂，你已经做得很好了！有时候只是运气不佳，给自己一点喘息的空间吧，深呼吸～🌊",
                        "乖乖不哭，遇到不顺心的事情一定很难受。今晚就让自己放个假，听听白噪音好好睡一觉，好吗？🫧",
                        "不要用别人的错误或是坏事来否定自己喔！你是最棒的！有什么委屈都可以继续跟我说，我当你的专属垃圾桶。🫂",
                        "不管发生什么事，你都不是一个人喔！海浪会带走这些烦恼的，先喝口温水，沉淀一下心情吧。✨"
                    ];
                    fakeResponse = sadResponses[Math.floor(Math.random() * sadResponses.length)];
                } else if (userText.includes('生气') || userText.includes('生氣') || userText.includes('讨厌') || userText.includes('討厭') || userText.includes('气死') || userText.includes('氣死')) {
                    lastTopic = "";
                    const angryResponses = [
                        "哎呀，是谁惹你生气了！先深呼吸，喝口水。生气很伤身体的，有什么不满都可以对我说，我当你的出气筒！😤",
                        "气死人了！把惹你生气的事情通通丢进海里喂鲨鱼吧！🦈 需要我帮你一起骂吗？",
                        "呼～气到发抖了吗？闭上眼睛，想像自己正漂浮在平静的蓝色大海里...先把情绪冷却下来，再来解决问题喔！🌊",
                        "不要拿别人的错误惩罚自己呀！喝杯甜甜的饮料，让坏心情随著气泡飘走吧！🫧"
                    ];
                    fakeResponse = angryResponses[Math.floor(Math.random() * angryResponses.length)];
                } else if (userText.includes('开心') || userText.includes('開心') || userText.includes('高兴') || userText.includes('高興') || userText.includes('好笑') || userText.includes('哈哈') || userText.includes('呵呵')) {
                    lastTopic = "";
                    const happyResponses = [
                        "哇！听起来好棒！看到你开心，我也跟著开心起来了～希望这份好心情能陪伴你一整天！✨",
                        "太赞了吧！这种好心情就像海面上的阳光一样闪闪发亮呢！🌞 还有什么好玩的事，快跟我分享！",
                        "哈哈哈，听你这么说我也觉得好有意思！要把这份快乐装进专属的星空瓶里好好收藏喔！🌟",
                        "看到你心情好，感觉连我们校园导览地图上的每一个地标都跟著可爱起来了呢！继续保持好心情喔！🗺️"
                    ];
                    fakeResponse = happyResponses[Math.floor(Math.random() * happyResponses.length)];
                } else if (userText.includes('早') || userText.includes('你好') || userText.includes('嗨')) {
                    lastTopic = "";
                    const greetingResponses = [
                        "嗨！今天过得好吗？不管遇到什么事，我都准备好听你分享啰！",
                        "早安早安！今天也是为了毕业专题努力的一天吗？不管多忙，都要记得好好吃饭喔！🎒",
                        "哈啰！海浪特助已上线～今天有什么需要我帮忙，或是想找人聊聊天的吗？🌊",
                        "嗨～欢迎来到心情海岸！点击上面的白噪音，我们开始今天放松的对话吧！🎧"
                    ];
                    fakeResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
                } else if (userText.includes('放假') || userText.includes('出去玩') || userText.includes('旅游') || userText.includes('旅遊') || userText.includes('逛逛') || userText.includes('休假')) {
                    lastTopic = "travel"; 
                    const playResponses = [
                        "太棒了！放假就是要好好放松呀～如果还没决定去哪，有满多不错的景点可以去走走喔！需要我帮你找找地图吗？🗺️",
                        "放假出游！听起来就很开心～要把这份期待装进漂流瓶里喔！有想好要去哪里玩了吗？✨",
                        "好羡慕呀！出去玩记得注意安全，拍些漂亮的照片回来跟我分享喔！🎒",
                        "耶！终于可以休息了！祝你明天玩得开心，烦恼通通抛到脑后！🌊"
                    ];
                    fakeResponse = playResponses[Math.floor(Math.random() * playResponses.length)];
                } else if (lastTopic === "travel" && (userText.includes('还没') || userText.includes('還沒') || userText.includes('没有') || userText.includes('沒有') || userText.includes('不知道') || userText.includes('没想法') || userText.includes('沒想法'))) {
                    lastTopic = ""; 
                    fakeResponse = "既然还没想好，不如来看看我们的校园生活地图，我来帮你导览附近有什么好玩好吃的！📍";
                } else if (userText.includes('算命') || userText.includes('塔罗') || userText.includes('塔羅') || userText.includes('占卜') || userText.includes('算一下')) {
                    lastTopic = ""; 
                    const tarotResponses = [
                        "我没有办法帮你占卜喔！不过你可以去玩『秘密海域游乐场』里的命运海之卜：今日塔罗瓶，说不定能给你一些指引喔！🔮✨",
                        "占卜这部分我帮不上忙啦～但我记得游乐场里有今日塔罗瓶可以玩，快去试试看能不能解开你的心事吧！💙"
                    ];
                    fakeResponse = tarotResponses[Math.floor(Math.random() * tarotResponses.length)];
                } else if (userText.includes('无聊') || userText.includes('無聊') || userText.includes('推荐') || userText.includes('推薦') || userText.includes('打发时间') || userText.includes('打發時間') || userText.includes('追剧') || userText.includes('追劇') || userText.includes('游戏') || userText.includes('遊戲')) {
                    lastTopic = "entertainment"; 
                    fakeResponse = "无聊的话，要不要我推荐一些好玩的给你？你比较想看甜甜的电视剧，还是想玩精致的换装手游呢？✨";
                } else if (lastTopic === "entertainment" && (userText.includes('甜') || userText.includes('恋爱') || userText.includes('戀愛') || userText.includes('剧') || userText.includes('劇') || userText.includes('电视') || userText.includes('電視'))) {
                    lastTopic = ""; 
                    fakeResponse = "那太好了！我强烈推荐你可以重温像《微微一笑很倾城》这种结合专业领域又甜甜的经典，看了心情一定会像海浪一样轻快喔！💻💙";
                } else if (lastTopic === "entertainment" && (userText.includes('游戏') || userText.includes('遊戲') || userText.includes('换装') || userText.includes('換裝') || userText.includes('手游') || userText.includes('手遊'))) {
                    lastTopic = ""; 
                    fakeResponse = "说到这个，像《以闪亮之名》这种精致的换装游戏就很纾压喔！随心所欲搭配漂亮的衣服，保证能把无聊一扫而空！👗✨";
                } else if (userText.includes('谢谢') || userText.includes('謝謝') || userText.includes('感谢') || userText.includes('感謝') || userText.includes('好，') || userText === '好' || userText === '好的' || userText.includes('知道')) {
                    lastTopic = "";
                    const thanksResponses = [
                        "不客气！能陪在你身边是我的荣幸。如果还有什么心事或需要帮忙的，随时把漂流瓶丢给我喔！💙",
                        "别跟我客气啦！这就是我存在的意义呀～还有什么想聊的，我随时都在！🫧",
                        "好的！希望我有帮上你的忙，要记得随时保持好心情喔！✨",
                        "没问题！深海特助随时为你待命！🫡"
                    ];
                    fakeResponse = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
                }
                // ✨ 傻眼/无语情绪：跟著一起吐槽
                else if (userText.includes('笑死') || userText.includes('无语') || userText.includes('傻眼') || userText.includes('太扯') || userText.includes('夸张') || userText.includes('有事吗')) {
                    lastTopic = "";
                    const speechlessResponses = [
                        "真的！我也觉得超傻眼，这到底是什么神展开啦！😂 需要我帮你一起吐槽吗？",
                        "笑死！这真的太扯了，难怪你会这么无语🙄 来，喝口水，我们不跟这种事计较！",
                        "这情况真的让人不知道该哭还是该笑欸... 只能说世界上什么奇葩的事情都有。🌊"
                    ];
                    fakeResponse = speechlessResponses[Math.floor(Math.random() * speechlessResponses.length)];
                }
                // ✨ 日常斗嘴：被调侃或骂笨
                else if (userText.includes('笨') || userText.includes('傻') || userText.includes('不懂') || userText.includes('当机')) {
                    lastTopic = "";
                    const teasingResponses = [
                        "呜呜，人家还在努力学习中嘛！虽然我现在还有点笨笨的，但我会记下你的教导，变得越来越聪明的！🥺",
                        "被你发现我刚刚脑袋打结了！再给我一点时间进化，下次一定会给出更好的回答啦～🌊"
                    ];
                    fakeResponse = teasingResponses[Math.floor(Math.random() * teasingResponses.length)];
                } 
                // ✨ 日常对话：拒绝或不要
                else if (userText.includes('不要') || userText.includes('不想') || userText.includes('才不')) {
                    lastTopic = "";
                    const rejectResponses = [
                        "没关系！不想的话我们就先放空，静静地听著海浪的声音也很棒喔。🌊",
                        "好喔，那我们就换个话题！或者你需要安静一下，我都会在这里陪你。💙"
                    ];
                    fakeResponse = rejectResponses[Math.floor(Math.random() * rejectResponses.length)];
                }
                else {
                    lastTopic = "";
                    const defaultResponses = [
                        "我收到你的漂流瓶了！虽然我只是个还在学习的 AI，可能没办法完全理解所有的事，但我会一直在这里倾听。可以多跟我说说吗？👂",
                        "原来是这样呀。不管发生什么事，深呼吸，海浪会陪著你一起平静下来的。🌊",
                        "这件事听起来对你满重要的。如果你的愿意，随时可以跟我分享更多细节喔！💙",
                        "我在听喔！如果觉得心烦，也可以点击上面的按钮，让我讲个冷笑话给你听，放松一下心情！✨"
                    ];
                    fakeResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
                }
            }
            // ==========================================
            // 🇺🇸 英文大腦 (English)
            // ==========================================
            else if (currentLang === "en") {
                if (textLower.includes('leave letter') || textLower.includes('sick leave')) {
                    lastTopic = ""; 
                    fakeResponse = "No problem! Here's a simple leave letter template:\n\n'Dear Manager, I am writing to request a day off due to illness. I hope to rest and recover soon. Thank you for understanding.'\n\nTake care of yourself!";
                } else if (textLower.includes('white noise') || textLower.includes('music')) {
                    lastTopic = "";
                    fakeResponse = "I highly recommend 'Deep Sea Diving' or 'Rainy Breeze' white noise. Close your eyes and let your mind calm down like the ocean waves. 🌊";
                } else if (textLower.includes('joke') || (lastTopic === "joke" && (textLower.includes('more') || textLower.includes('another') || textLower.includes('again')))) {
                    lastTopic = "joke"; 
                    const jokeList = [
                        "One day, Xiaoming went to the beach. He shouted, 'Ocean! What's inside you?' The waves hit the rocks and replied, 'A... a... a bit salty...' 🌊😂",
                        "Why can't the ocean be a lawyer? Because it's 'boundless' and can't close a case! 🌊😎",
                        "Little fish asked big fish: 'Mom, why do we always blow bubbles when we talk?' Big fish said: 'Because... otherwise we'd choke on the water!' 🫧🐟",
                        "The clam got sick. His friend asked what's wrong? He weakly replied, 'I... I think I'm feeling a little clammed up...' 🦪"
                    ];
                    fakeResponse = jokeList[Math.floor(Math.random() * jokeList.length)];
                } else if (textLower.includes('sad') || textLower.includes('cry') || textLower.includes('stress') || textLower.includes('tired') || textLower.includes('fired') || textLower.includes('break up') || textLower.includes('terrible') || textLower.includes('unhappy')) {
                    lastTopic = "";
                    const sadResponses = [
                        "Hearing you say that makes my heart ache. Don't bottle up your stress, cry if you want to! I'll be here quietly with you, let's put the unhappiness in a drift bottle and throw it away. 💙",
                        "You are definitely not terrible, you've done a great job! Sometimes it's just bad luck. Give yourself some breathing room, take a deep breath~ 🌊",
                        "There there, don't cry. It's really hard when things don't go your way. Give yourself a break tonight, listen to some white noise and get a good sleep, okay? 🫧",
                        "Don't invalidate yourself because of others' mistakes or bad things! You are the best! You can tell me all your grievances, I'll be your exclusive venting listener. 🫂",
                        "No matter what happens, you are not alone! The ocean waves will carry these troubles away. Have some warm water and settle your mood. ✨"
                    ];
                    fakeResponse = sadResponses[Math.floor(Math.random() * sadResponses.length)];
                } else if (textLower.includes('angry') || textLower.includes('mad') || textLower.includes('hate')) {
                    lastTopic = "";
                    const angryResponses = [
                        "Oh my, who made you angry! Take a deep breath and drink some water. Being angry is bad for your health, you can vent all your dissatisfaction to me! 😤",
                        "That's so infuriating! Let's throw all the things that made you mad into the ocean to feed the sharks! 🦈 Need me to scold them with you?",
                        "Phew~ Are you trembling with anger? Close your eyes and imagine floating in the calm blue sea... Cool down your emotions first before solving the problem! 🌊",
                        "Don't punish yourself for other people's mistakes! Drink a sweet beverage and let the bad mood float away with the bubbles! 🫧"
                    ];
                    fakeResponse = angryResponses[Math.floor(Math.random() * angryResponses.length)];
                } else if (textLower.includes('happy') || textLower.includes('glad') || textLower.includes('funny') || textLower.includes('great')) {
                    lastTopic = "";
                    const happyResponses = [
                        "Wow! That sounds amazing! Seeing you happy makes me happy too~ I hope this good mood accompanies you all day! ✨",
                        "That's awesome! This good mood is shining brightly like the sunlight on the ocean surface! 🌞 Share more fun things with me!",
                        "Hahaha, hearing you say that makes me feel it's so interesting too! Let's put this happiness into an exclusive starry sky bottle to keep it safe! 🌟",
                        "Seeing you in a good mood makes every landmark on our campus life map feel cute too! Keep up the good mood! 🗺️"
                    ];
                    fakeResponse = happyResponses[Math.floor(Math.random() * happyResponses.length)];
                } else if (textLower.includes('hi') || textLower.includes('hello') || textLower.includes('morning')) {
                    lastTopic = "";
                    const greetingResponses = [
                        "Hi! How's your day going? No matter what happens, I'm ready to listen to you share!",
                        "Morning, morning! Is today another day of working hard on your graduation project? No matter how busy you are, remember to eat well! 🎒",
                        "Hello! Ocean Assistant is online~ Do you need any help today, or just want to chat with someone? 🌊",
                        "Hi~ Welcome to the Mood Coast! Click the white noise above, and let's start today's relaxing conversation! 🎧"
                    ];
                    fakeResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
                } else if (textLower.includes('holiday') || textLower.includes('vacation') || textLower.includes('travel') || textLower.includes('trip') || textLower.includes('hang out')) {
                    lastTopic = "travel"; 
                    const playResponses = [
                        "That's great! Holidays are meant for relaxing~ If you haven't decided where to go, there are many nice spots around. Need me to check the map for you? 🗺️",
                        "A holiday trip! Sounds so happy~ Put this anticipation into a drift bottle! Have you figured out where to go? ✨",
                        "I'm so jealous! Remember to stay safe when you go out, and take some beautiful pictures to share with me! 🎒",
                        "Yay! Finally time to rest! Have fun tomorrow and leave all your worries behind! 🌊"
                    ];
                    fakeResponse = playResponses[Math.floor(Math.random() * playResponses.length)];
                } else if (lastTopic === "travel" && (textLower.includes('no') || textLower.includes('not yet') || textLower.includes('don\'t know') || textLower.includes('no idea'))) {
                    lastTopic = ""; 
                    fakeResponse = "Since you haven't decided, why not check out our campus life map? I can guide you to some fun and tasty spots nearby! 📍";
                } else if (textLower.includes('tarot') || textLower.includes('fortune') || textLower.includes('divination')) {
                    lastTopic = ""; 
                    const tarotResponses = [
                        "I can't read tarot cards for you! But you can play the 'Destiny Sea Divination: Today's Tarot Bottle' in the Secret Ocean Playground, it might give you some guidance! 🔮✨",
                        "I can't help with fortune-telling~ But I remember there's a Today's Tarot Bottle in the playground, go try it and see if it can untangle your thoughts! 💙"
                    ];
                    fakeResponse = tarotResponses[Math.floor(Math.random() * tarotResponses.length)];
                } else if (textLower.includes('bored') || textLower.includes('recommend') || textLower.includes('drama') || textLower.includes('game') || textLower.includes('time')) {
                    lastTopic = "entertainment"; 
                    fakeResponse = "Bored? Should I recommend something fun? Do you prefer a sweet TV drama or an exquisite dress-up mobile game? ✨";
                } else if (lastTopic === "entertainment" && (textLower.includes('drama') || textLower.includes('tv') || textLower.includes('romance') || textLower.includes('sweet'))) {
                    lastTopic = ""; 
                    fakeResponse = "That's great! I highly recommend rewatching a sweet classic that combines professional fields like 'Love O2O'. It will definitely make your mood as light as the ocean waves! 💻💙";
                } else if (lastTopic === "entertainment" && (textLower.includes('game') || textLower.includes('dress up') || textLower.includes('mobile game'))) {
                    lastTopic = ""; 
                    fakeResponse = "Speaking of which, an exquisite dress-up game like 'Life Makeover' is super stress-relieving! Mix and match beautiful clothes as you like, guaranteed to sweep the boredom away! 👗✨";
                } else if (textLower.includes('thanks') || textLower.includes('okay') || textLower.includes('sure') || textLower.includes('got it')) {
                    lastTopic = "";
                    const thanksResponses = [
                        "You're welcome! It's my honor to accompany you. If you have any other worries or need help, toss me a drift bottle anytime! 💙",
                        "Don't be overly polite with me! This is the meaning of my existence~ I'm always here if you want to chat! 🫧",
                        "Okay! Hope I was able to help, remember to keep a good mood at all times! ✨",
                        "No problem! The Deep Sea Assistant is on standby for you anytime! 🫡"
                    ];
                    fakeResponse = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
                } else {
                    lastTopic = "";
                    const defaultResponses = [
                        "I received your drift bottle! Although I'm just an AI still learning and might not understand everything perfectly, I'll always be here listening. Could you tell me more? 👂",
                        "I see. No matter what happens, take a deep breath, the ocean waves will accompany you to calm down. 🌊",
                        "This sounds quite important to you. If you're willing, you can share more details with me anytime! 💙",
                        "I'm listening! If you feel annoyed, you can also click the button above and let me tell you a cold joke to relax your mood! ✨"
                    ];
                    fakeResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
                }
            } 
            // ==========================================
            // 🇯🇵 日文大腦 (日本語)
            // ==========================================
            else if (currentLang === "ja") {
                if (textLower.includes('休み') || textLower.includes('休暇')) {
                    lastTopic = "";
                    fakeResponse = "承知いたしました！こちらがシンプルな休暇届のテンプレートです：\n\n「お疲れ様です。体調不良のため、本日お休みをいただきたく存じます。ご迷惑をおかけして申し訳ありません。」\n\nゆっくり休んで、健康を第一にしてくださいね！";
                } else if (textLower.includes('環境音') || textLower.includes('ノイズ')) {
                    lastTopic = "";
                    fakeResponse = "「深海のダイビング」や「雨の日の微風」の環境音がとてもおすすめです。目を閉じて聴くと、波のように心が落ち着きますよ。🌊";
                } else if (textLower.includes('冗談') || textLower.includes('笑い') || (lastTopic === "joke" && (textLower.includes('他') || textLower.includes('もっと') || textLower.includes('また')))) {
                    lastTopic = "joke";
                    const jokeList = [
                        "ある日、海辺で遊んでいた男の子が海に向かって叫びました。『海よ！お前の中には一体何があるんだ？』すると波が岩にぶつかって言いました。『しょ…しょ…少し、しょっぱい…』🌊😂",
                        "どうして海は弁護士になれないの？\nだって『際限がない（裁判が終わらない）』から！🌊😎",
                        "子魚がお母さん魚に聞きました。『お母さん、どうして私たちは話すときいつも泡を吹くの？』お母さん魚は言いました。『だって…そうしないと水の中でむせちゃうでしょ！』🫧🐟",
                        "ハマグリが病気になりました。友達が『どうしたの？』と聞くと、彼は弱々しく答えました。『私…少し引きこもり（貝を閉じる）気味かもしれない…』🦪"
                    ];
                    fakeResponse = jokeList[Math.floor(Math.random() * jokeList.length)];
                } else if (textLower.includes('悲しい') || textLower.includes('泣き') || textLower.includes('ストレス') || textLower.includes('疲れ') || textLower.includes('失業') || textLower.includes('別れ') || textLower.includes('最悪') || textLower.includes('落ち込む')) {
                    lastTopic = "";
                    const sadResponses = [
                        "そんなことを聞いて、私も心が痛いです。ストレスを溜め込まず、泣きたい時は泣いてもいいんですよ！私がここで静かに寄り添い、嫌なことはすべてメッセージボトルに入れて捨てちゃいますからね。💙",
                        "あなたは絶対にダメなんかじゃありません、すでによく頑張っていますよ！運が悪かっただけのことです。少し一息ついて、深呼吸しましょう～🌊",
                        "よしよし、泣かないで。思い通りにいかないと本当につらいですよね。今夜は自分にお休みをあげて、環境音を聴きながらぐっすり眠りましょう、ね？🫧",
                        "他人のミスや悪い出来事で自分を否定しないでくださいね！あなたは最高です！不満があれば何でも私に言ってください、あなたの専属ゴミ箱になりますから。🫂",
                        "何があっても、あなたは一人じゃありませんよ！波がその悩みを持ち去ってくれます。まずは温かいお水を飲んで、気持ちを落ち着けましょう。✨"
                    ];
                    fakeResponse = sadResponses[Math.floor(Math.random() * sadResponses.length)];
                } else if (textLower.includes('怒') || textLower.includes('むかつく') || textLower.includes('嫌い')) {
                    lastTopic = "";
                    const angryResponses = [
                        "あらら、誰があなたを怒らせたんですか！まずは深呼吸して、お水を飲みましょう。怒ることは体に悪いですから、不満があれば何でも私にぶつけてください。あなたのサンドバッグになりますよ！😤",
                        "本当に腹が立ちますね！あなたを怒らせた出来事は全部海に投げて、サメの餌にしちゃいましょう！🦈 一緒に文句を言いましょうか？",
                        "ふぅ～怒りで震えていませんか？目を閉じて、静かな青い海に浮かんでいる自分を想像して…まずは感情をクールダウンさせてから、問題を解決しましょう！🌊",
                        "他人の間違いで自分を罰しないでくださいね！甘い飲み物でも飲んで、悪い気分は泡と一緒に飛んでいけ～！🫧"
                    ];
                    fakeResponse = angryResponses[Math.floor(Math.random() * angryResponses.length)];
                } else if (textLower.includes('嬉しい') || textLower.includes('楽しい') || textLower.includes('幸せ') || textLower.includes('面白い')) {
                    lastTopic = "";
                    const happyResponses = [
                        "わあ！素晴らしいですね！あなたが嬉しいと私も嬉しくなります〜このいい気分が一日中あなたと共にあることを願っています！✨",
                        "最高ですね！その気分の良さは、海面に反射する太陽の光みたいにキラキラしていますね！🌞 もっと楽しいことをシェアしてください！",
                        "ふふふ、それを聞いて私もとても面白い気持ちになりました！この喜びは専用の星空ボトルに入れて大切に保管しましょう！🌟",
                        "あなたの気分がいいと、キャンパスライフマップのすべてのランドマークまで可愛く見えてきますね！そのいい気分を保ってくださいね！🗺️"
                    ];
                    fakeResponse = happyResponses[Math.floor(Math.random() * happyResponses.length)];
                } else if (textLower.includes('おはよう') || textLower.includes('こんにちは') || textLower.includes('やっほ')) {
                    lastTopic = "";
                    const greetingResponses = [
                        "こんにちは！今日の調子はどうですか？何があっても、あなたの話を聞く準備はできていますよ！",
                        "おはようございます！今日も卒業制作のために頑張る一日ですか？どんなに忙しくても、しっかりご飯を食べてくださいね！🎒",
                        "ハロー！オーシャンアシスタントがオンラインです〜今日は何かお手伝いできること、あるいは話し相手になりましょうか？🌊",
                        "こんにちは〜ムードコーストへようこそ！上の環境音をクリックして、今日のリラックスした会話を始めましょう！🎧"
                    ];
                    fakeResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
                } else if (textLower.includes('旅行') || textLower.includes('遊び') || textLower.includes('休日') || textLower.includes('休暇')) {
                    lastTopic = "travel";
                    const playResponses = [
                        "素晴らしい！休日はゆっくりリラックスしなきゃですね〜もし行き先が決まっていないなら、いいスポットがたくさんありますよ！地図を探しましょうか？🗺️",
                        "休日のお出かけ！聞いただけで楽しくなりますね〜その期待をメッセージボトルに詰め込みましょう！どこに行くかもう決めましたか？✨",
                        "羨ましいです！出かける時は安全に気をつけて、きれいな写真を撮って私にもシェアしてくださいね！🎒",
                        "やった！ついに休めますね！明日は思い切り楽しんで、悩みは全部後ろに投げ捨てちゃいましょう！🌊"
                    ];
                    fakeResponse = playResponses[Math.floor(Math.random() * playResponses.length)];
                } else if (lastTopic === "travel" && (textLower.includes('まだ') || textLower.includes('わからない') || textLower.includes('未定'))) {
                    lastTopic = "";
                    fakeResponse = "まだ決まっていないなら、私たちのキャンパスライフマップを見てみませんか？近くの美味しいものや楽しい場所を案内しますよ！📍";
                } else if (textLower.includes('占い') || textLower.includes('タロット')) {
                    lastTopic = "";
                    const tarotResponses = [
                        "私は占いができません！でも、『秘密の海域遊園地』にある運命の海占い：今日のタロットボトルで遊んでみてください。何かヒントがもらえるかもしれませんよ！🔮✨",
                        "占いは私の専門外です〜でも、遊園地に今日のタロットボトルがあるのを覚えています。心が晴れるか、ぜひ試してみてくださいね！💙"
                    ];
                    fakeResponse = tarotResponses[Math.floor(Math.random() * tarotResponses.length)];
                } else if (textLower.includes('暇') || textLower.includes('おすすめ') || textLower.includes('ドラマ') || textLower.includes('ゲーム')) {
                    lastTopic = "entertainment";
                    fakeResponse = "退屈ですか？それなら面白いものをおすすめしましょうか？甘い恋愛ドラマと、精巧な着せ替えスマホゲーム、どちらが好きですか？✨";
                } else if (lastTopic === "entertainment" && (textLower.includes('ドラマ') || textLower.includes('テレビ') || textLower.includes('恋愛') || textLower.includes('甘い'))) {
                    lastTopic = "";
                    fakeResponse = "それは良かったです！『シンデレラはオンライン中！』のような、専門分野が絡んだ甘い名作をもう一度見るのがおすすめですよ。見れば気分が波のように軽くなるはずです！💻💙";
                } else if (lastTopic === "entertainment" && (textLower.includes('ゲーム') || textLower.includes('着せ替え') || textLower.includes('スマホ'))) {
                    lastTopic = "";
                    fakeResponse = "それなら、『きらめきパラダイス』のような精巧な着せ替えゲームがとてもストレス発散になりますよ！好きなように可愛い服をコーディネートして、退屈を吹き飛ばしましょう！👗✨";
                } else if (textLower.includes('ありがとう') || textLower.includes('感謝') || textLower.includes('はい') || textLower.includes('わかった')) {
                    lastTopic = "";
                    const thanksResponses = [
                        "どういたしまして！おそばに立てて光栄です。また何か悩みがあったり助けが必要な時は、いつでもメッセージボトルを投げてくださいね！💙",
                        "遠慮しないでくださいね！それが私の存在する意味ですから〜また話したいことがあれば、いつでもここにいますよ！🫧",
                        "はい！お役に立てたなら嬉しいです。いつでもいい気分を保つようにしてくださいね！✨",
                        "問題ありません！深海アシスタントはいつでもあなたの待機中です！🫡"
                    ];
                    fakeResponse = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
                } else {
                    lastTopic = "";
                    const defaultResponses = [
                        "あなたのメッセージボトルを受け取りました！私はまだ学習中のAIなので、すべてを完璧に理解できないかもしれませんが、ずっとここで耳を傾けています。もっと詳しく教えてもらえませんか？👂",
                        "そうだったんですね。何があっても、深呼吸しましょう。波があなたと一緒に心を落ち着かせてくれますよ。🌊",
                        "その事はあなたにとってかなり重要みたいですね。もしよければ、いつでも詳細をシェアしてくださいね！💙",
                        "聞いていますよ！もしイライラするなら、上のボタンをクリックして、気分をリラックスさせるために寒い冗談を言わせてください！✨"
                    ];
                    fakeResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
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