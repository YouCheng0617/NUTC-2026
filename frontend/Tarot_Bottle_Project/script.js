const tarotDeck = [
    { id: 0, name: "愚者", image: "images/m00.jpg" }, { id: 1, name: "魔術師", image: "images/m01.jpg" }, { id: 2, name: "女祭司", image: "images/m02.jpg" }, { id: 3, name: "皇后", image: "images/m03.jpg" }, { id: 4, name: "皇帝", image: "images/m04.jpg" }, { id: 5, name: "教皇", image: "images/m05.jpg" }, { id: 6, name: "戀人", image: "images/m06.jpg" }, { id: 7, name: "戰車", image: "images/m07.jpg" }, { id: 8, name: "力量", image: "images/m08.jpg" }, { id: 9, name: "隱者", image: "images/m09.jpg" }, { id: 10, name: "命運之輪", image: "images/m10.jpg" }, { id: 11, name: "正義", image: "images/m11.jpg" }, { id: 12, name: "倒吊人", image: "images/m12.jpg" }, { id: 13, name: "死神", image: "images/m13.jpg" }, { id: 14, name: "節制", image: "images/m14.jpg" }, { id: 15, name: "惡魔", image: "images/m15.jpg" }, { id: 16, name: "高塔", image: "images/m16.jpg" }, { id: 17, name: "星星", image: "images/m17.jpg" }, { id: 18, name: "月亮", image: "images/m18.jpg" }, { id: 19, name: "太陽", image: "images/m19.jpg" }, { id: 20, name: "審判", image: "images/m20.jpg" }, { id: 21, name: "世界", image: "images/m21.jpg" },
    { id: 22, name: "權杖王牌", image: "images/w01.jpg" }, { id: 23, name: "權杖二", image: "images/w02.jpg" }, { id: 24, name: "權杖三", image: "images/w03.jpg" }, { id: 25, name: "權杖四", image: "images/w04.jpg" }, { id: 26, name: "權杖五", image: "images/w05.jpg" }, { id: 27, name: "權杖六", image: "images/w06.jpg" }, { id: 28, name: "權杖七", image: "images/w07.jpg" }, { id: 29, name: "權杖八", image: "images/w08.jpg" }, { id: 30, name: "權杖九", image: "images/w09.jpg" }, { id: 31, name: "權杖十", image: "images/w10.jpg" }, { id: 32, name: "權杖侍者", image: "images/w11.jpg" }, { id: 33, name: "權杖騎士", image: "images/w12.jpg" }, { id: 34, name: "權杖王后", image: "images/w13.jpg" }, { id: 35, name: "權杖國王", image: "images/w14.jpg" },
    { id: 36, name: "聖杯王牌", image: "images/c01.jpg" }, { id: 37, name: "聖杯二", image: "images/c02.jpg" }, { id: 38, name: "聖杯三", image: "images/c03.jpg" }, { id: 39, name: "聖杯四", image: "images/c04.jpg" }, { id: 40, name: "聖杯五", image: "images/c05.jpg" }, { id: 41, name: "聖杯六", image: "images/c06.jpg" }, { id: 42, name: "聖杯七", image: "images/c07.jpg" }, { id: 43, name: "聖杯八", image: "images/c08.jpg" }, { id: 44, name: "聖杯九", image: "images/c09.jpg" }, { id: 45, name: "聖杯十", image: "images/c10.jpg" }, { id: 46, name: "聖杯侍者", image: "images/c11.jpg" }, { id: 47, name: "聖杯騎士", image: "images/c12.jpg" }, { id: 48, name: "聖杯王后", image: "images/c13.jpg" }, { id: 49, name: "聖杯國王", image: "images/c14.jpg" },
    { id: 50, name: "寶劍王牌", image: "images/s01.jpg" }, { id: 51, name: "寶劍二", image: "images/s02.jpg" }, { id: 52, name: "寶劍三", image: "images/s03.jpg" }, { id: 53, name: "寶劍四", image: "images/s04.jpg" }, { id: 54, name: "寶劍五", image: "images/s05.jpg" }, { id: 55, name: "寶劍六", image: "images/s06.jpg" }, { id: 56, name: "寶劍七", image: "images/s07.jpg" }, { id: 57, name: "寶劍八", image: "images/s08.jpg" }, { id: 58, name: "寶劍九", image: "images/s09.jpg" }, { id: 59, name: "寶劍十", image: "images/s10.jpg" }, { id: 60, name: "寶劍侍者", image: "images/s11.jpg" }, { id: 61, name: "寶劍騎士", image: "images/s12.jpg" }, { id: 62, name: "寶劍王后", image: "images/s13.jpg" }, { id: 63, name: "寶劍國王", image: "images/s14.jpg" },
    { id: 64, name: "金幣王牌", image: "images/p01.jpg" }, { id: 65, name: "金幣二", image: "images/p02.jpg" }, { id: 66, name: "金幣三", image: "images/p03.jpg" }, { id: 67, name: "金幣四", image: "images/p04.jpg" }, { id: 68, name: "金幣五", image: "images/p05.jpg" }, { id: 69, name: "金幣六", image: "images/p06.jpg" }, { id: 70, name: "金幣七", image: "images/p07.jpg" }, { id: 71, name: "金幣八", image: "images/p08.jpg" }, { id: 72, name: "金幣九", image: "images/p09.jpg" }, { id: 73, name: "金幣十", image: "images/p10.jpg" }, { id: 74, name: "金幣侍者", image: "images/p11.jpg" }, { id: 75, name: "金幣騎士", image: "images/p12.jpg" }, { id: 76, name: "金幣王后", image: "images/p13.jpg" }, { id: 77, name: "金幣國王", image: "images/p14.jpg" }
];

/* 翻譯字典 i18n */
const i18n = {
    'zh-TW': {
        langToggle: "🌐 English",
        favBtn: "📖 魔法收藏本",
        mainTitle: "🔮 今日塔羅瓶",
        subtitle: "請靜下心來，選擇你今日想探索的塔羅指引...",
        btnRel: "<span class='icon'>💕</span> 感情<br><small>Relationship</small>",
        btnCar: "<span class='icon'>💼</span> 事業<br><small>Career</small>",
        btnEdu: "<span class='icon'>🎓</span> 學業<br><small>Education</small>",
        btnGro: "<span class='icon'>🌱</span> 成長<br><small>Growth</small>",
        btnWea: "<span class='icon'>💎</span> 財運<br><small>Wealth</small>",
        btnCom: "<span class='icon'>🤝</span> 人際<br><small>Community</small>",
        topicRel: "感情",
        topicCar: "事業",
        topicEdu: "學業",
        topicGro: "成長",
        topicWea: "財運",
        topicCom: "人際",
        placeholder: "其他... 請輸入你想問的問題",
        startBtn: "開始占卜",
        instruction: "請從下方的扇形牌陣中，憑直覺抽出 <span style='color:#d4b5ff; font-size:1.3em;'>3</span> 張牌",
        past: "【過去】",
        present: "【現在】",
        future: "【未來】",
        resultTitle: "✨ 占卜結果 ✨",
        loadingInput: "✨ <i style='color:#a084ff'>命運的魔法陣正在啟動，請稍候...</i>",
        loadingAI: "✨ <i style='color:#a084ff'>星空與魔法交織，命運的解讀正在浮現...</i>",
        restartBtn: "✨ 再問一次",
        saveBtn: "💾 收藏此占卜",
        favTitle: "📖 魔法收藏本",
        emptyFav: "目前魔法筆記裡還是空空的喔！<br>趕快去進行你的第一場占卜吧🔮",
        delBtn: "刪除紀錄",
        alertInput: "魔法陣還沒有感應到你的問題... 請輸入你想問的事情喔！",
        alertSave: "✨ 已成功收錄至您的魔法筆記中！",
        confirmDel: "確定要將這條指引從筆記中抹除嗎？",
        currentTopicPrefix: "✨ 目前探索的領域：",
        aiLang: "Traditional Chinese (繁體中文)",
        apiError: "⚠️ 魔法陣的連結受到干擾，無法解讀塔羅牌。",
        devNote: "開發者提示 (錯誤原因)："
    },
    'en': {
        langToggle: "🌐 中文",
        favBtn: "📖 Spellbook",
        mainTitle: "🔮 Tarot Bottle",
        subtitle: "Calm your mind and choose a topic to explore today...",
        btnRel: "<span class='icon'>💕</span> Romance<br><small>Relationship</small>",
        btnCar: "<span class='icon'>💼</span> Career<br><small>Work</small>",
        btnEdu: "<span class='icon'>🎓</span> Education<br><small>Studies</small>",
        btnGro: "<span class='icon'>🌱</span> Growth<br><small>Personal</small>",
        btnWea: "<span class='icon'>💎</span> Wealth<br><small>Money</small>",
        btnCom: "<span class='icon'>🤝</span> Social<br><small>Community</small>",
        topicRel: "Relationship",
        topicCar: "Career",
        topicEdu: "Education",
        topicGro: "Personal Growth",
        topicWea: "Wealth",
        topicCom: "Community",
        placeholder: "Other... enter your question",
        startBtn: "Start Reading",
        instruction: "Intuitively draw <span style='color:#d4b5ff; font-size:1.3em;'>3</span> cards from the spread below",
        past: "[ Past ]",
        present: "[ Present ]",
        future: "[ Future ]",
        resultTitle: "✨ Reading Result ✨",
        loadingInput: "✨ <i style='color:#a084ff'>Activating the magic circle, please wait...</i>",
        loadingAI: "✨ <i style='color:#a084ff'>Weaving stars and magic, interpreting your destiny...</i>",
        restartBtn: "✨ Ask Again",
        saveBtn: "💾 Save Reading",
        favTitle: "📖 Spellbook (Favorites)",
        emptyFav: "Your spellbook is empty!<br>Go get your first reading 🔮",
        delBtn: "Delete",
        alertInput: "The magic circle didn't sense your question... Please enter one!",
        alertSave: "✨ Successfully saved to your spellbook!",
        confirmDel: "Are you sure you want to delete this reading?",
        currentTopicPrefix: "✨ Current Topic: ",
        aiLang: "English",
        apiError: "⚠️ The magic circle is disturbed, unable to read the cards.",
        devNote: "Developer Note (Error):"
    }
};

let drawnCards = {};
let currentSlotIndex = 0;
const slotNames = ['past', 'present', 'future'];
let availableCards = [...tarotDeck]; 
let selectedTopic = ""; 
let currentReadingData = null; 
let currentLang = 'zh-TW';

// 頁面載入時初始化 UI 語言
document.addEventListener('DOMContentLoaded', updateUI);

function toggleLanguage() {
    currentLang = currentLang === 'zh-TW' ? 'en' : 'zh-TW';
    updateUI();
}

function updateUI() {
    const t = i18n[currentLang];
    
    // 更新固定文字
    document.getElementById('lang-toggle-btn').innerHTML = t.langToggle;
    document.getElementById('view-fav-btn').innerHTML = t.favBtn;
    document.querySelector('.main-title').innerHTML = t.mainTitle;
    document.querySelector('.subtitle').innerHTML = t.subtitle;
    
    // 更新網格按鈕
    const btns = document.querySelectorAll('.topic-grid button');
    btns[0].innerHTML = t.btnRel; btns[0].setAttribute('onclick', `startGame('${t.topicRel}')`);
    btns[1].innerHTML = t.btnCar; btns[1].setAttribute('onclick', `startGame('${t.topicCar}')`);
    btns[2].innerHTML = t.btnEdu; btns[2].setAttribute('onclick', `startGame('${t.topicEdu}')`);
    btns[3].innerHTML = t.btnGro; btns[3].setAttribute('onclick', `startGame('${t.topicGro}')`);
    btns[4].innerHTML = t.btnWea; btns[4].setAttribute('onclick', `startGame('${t.topicWea}')`);
    btns[5].innerHTML = t.btnCom; btns[5].setAttribute('onclick', `startGame('${t.topicCom}')`);
    
    // 更新輸入框與開始按鈕
    document.getElementById('custom-topic-input').placeholder = t.placeholder;
    document.querySelector('.custom-topic button').innerHTML = t.startBtn;
    
    // 更新抽牌區提示
    document.querySelector('.instruction-text').innerHTML = t.instruction;
    document.querySelector('#card-past .card-title').innerText = t.past;
    document.querySelector('#card-present .card-title').innerText = t.present;
    document.querySelector('#card-future .card-title').innerText = t.future;
    
    // 更新結果區
    document.querySelector('.result-title').innerHTML = t.resultTitle;
    document.getElementById('restart-btn').innerHTML = t.restartBtn;
    document.getElementById('save-btn').innerHTML = t.saveBtn;
    
    // 更新收藏 Modal
    document.getElementById('fav-modal-title').innerHTML = t.favTitle;
    
    // 若已選擇主題，即時更新顯示的主題文字
    if (selectedTopic !== "") {
        document.getElementById('current-topic-display').innerText = `${t.currentTopicPrefix}【${selectedTopic}】`;
    }
    
    // 若目前正在顯示讀取文字，即時切換
    const resText = document.getElementById('ai-reading-result').innerHTML;
    if (resText.includes('命運的魔法陣') || resText.includes('Activating')) {
        document.getElementById('ai-reading-result').innerHTML = t.loadingInput;
    }
    
    // 若收藏庫開啟中，即時重新渲染
    if (!document.getElementById('favorites-modal').classList.contains('hidden')) {
        showFavorites();
    }
}

function startGame(topic) {
    selectedTopic = topic; 
    document.getElementById('topic-selection').classList.add('hidden');
    document.getElementById('tarot-area').classList.remove('hidden');
    document.getElementById('current-topic-display').innerText = `${i18n[currentLang].currentTopicPrefix}【${topic}】`;
    
    resetSlots();
    renderSpread(); 
}

function startCustomGame() {
    const customInput = document.getElementById('custom-topic-input').value.trim();
    if (customInput === "") {
        alert(i18n[currentLang].alertInput);
        return;
    }
    startGame(customInput);
}

document.getElementById('custom-topic-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') startCustomGame();
});

function resetSlots() {
    currentSlotIndex = 0;
    ['past', 'present', 'future'].forEach(pos => {
        const card = document.getElementById(`card-${pos}`);
        const front = document.getElementById(`front-${pos}`);
        
        card.classList.remove('flipped');
        card.classList.add('empty-slot');
        front.classList.remove('reversed');
    });
}

function resetGame() {
    document.getElementById('result-box').classList.add('hidden');
    document.getElementById('tarot-area').classList.add('hidden');
    document.getElementById('topic-selection').classList.remove('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('save-btn').classList.add('hidden');
    document.getElementById('custom-topic-input').value = "";
    document.getElementById('ai-reading-result').innerHTML = i18n[currentLang].loadingInput;

    drawnCards = {};
    availableCards = [...tarotDeck];
    currentReadingData = null;
    
    const spreadContainer = document.getElementById('deck-spread');
    spreadContainer.style.pointerEvents = 'auto';
    spreadContainer.style.opacity = '1';
    spreadContainer.classList.remove('hidden');
}

function renderSpread() {
    const spreadContainer = document.getElementById('deck-spread');
    spreadContainer.innerHTML = ''; 
    
    const total = availableCards.length;
    const startAngle = -70; 
    const angleStep = 140 / total; 

    for(let i=0; i<total; i++) {
        let card = document.createElement('div');
        card.className = 'spread-card';
        let angle = startAngle + (i * angleStep);
        card.style.setProperty('--rot', `${angle}deg`); 
        
        card.onclick = function() {
            drawFromSpread(this);
        };
        spreadContainer.appendChild(card);
    }
}

function drawFromSpread(cardElement) {
    if (currentSlotIndex >= 3) return;

    cardElement.style.opacity = '0';
    cardElement.style.pointerEvents = 'none';

    const pos = slotNames[currentSlotIndex];
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const randomCard = availableCards.splice(randomIndex, 1)[0];
    const isReversed = Math.random() > 0.5;

    drawnCards[pos] = { name: randomCard.name, isReversed: isReversed };

    const cardContainer = document.getElementById(`card-${pos}`);
    const imgElement = document.getElementById(`img-${pos}`);
    const textElement = document.getElementById(`text-${pos}`);

    cardContainer.classList.remove('empty-slot');

    imgElement.src = randomCard.image;
    imgElement.alt = randomCard.name;
    textElement.innerText = randomCard.name;
    
    // ★ 關鍵修復：現在改為對 img 元素添加倒轉 class，讓標籤始終維持正向！
    if (isReversed) { imgElement.classList.add('reversed-img'); }

    setTimeout(() => {
        cardContainer.classList.add('flipped');
    }, 200);

    currentSlotIndex++;

    if (currentSlotIndex === 3) {
        const spreadContainer = document.getElementById('deck-spread');
        spreadContainer.style.pointerEvents = 'none';
        spreadContainer.style.opacity = '0'; 
        
        setTimeout(() => {
            spreadContainer.classList.add('hidden');
            generateReading();
        }, 1200);
    }
}

async function generateReading() {
    const resultBox = document.getElementById('result-box');
    const resultText = document.getElementById('ai-reading-result');
    const restartBtn = document.getElementById('restart-btn');
    const saveBtn = document.getElementById('save-btn');
    const t = i18n[currentLang];
    
    resultBox.classList.remove('hidden');
    restartBtn.classList.add('hidden'); 
    saveBtn.classList.add('hidden');
    
    resultText.innerHTML = t.loadingAI;

    const cardsInfo = `
        左邊第一張（過去）：${drawnCards['past'].name} (${drawnCards['past'].isReversed ? '逆位' : '正位'})
        中間第二張（現在）：${drawnCards['present'].name} (${drawnCards['present'].isReversed ? '逆位' : '正位'})
        右邊第三張（未來）：${drawnCards['future'].name} (${drawnCards['future'].isReversed ? '逆位' : '正位'})
    `;

    const prompt = `你現在是一位溫柔、充滿智慧的星空魔法塔羅占卜師。玩家想問的問題是關於【${selectedTopic}】。玩家抽到了一個三牌陣：\n\n${cardsInfo}\n\n請根據牌面與正逆位，給出一份語氣溫柔、帶有魔法與星空隱喻的解牌報告。請務必包含以下四個段落，並且【請直接使用括號內的文字作為標題，絕對不要在標題前面加上 1. 2. 3. 4. 等數字標號】：\n- 【過去的指引】\n- 【現在的狀態】\n- 【未來的展現】\n- 【整體建議】\n\n排版要清晰，字數請控制在 400 字以內。\nIMPORTANT: You MUST write your ENTIRE response in ${t.aiLang}. If replying in English, please translate the Tarot card names and sections (Past, Present, Future, Overall Advice) into English in your response, and DO NOT use numbers for the section titles.`;

    const API_KEY = '請把這串中文字替換成你的_API_KEY'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `HTTP 錯誤碼: ${response.status}`);
        }
        
        const data = await response.json();
        const aiReply = data.candidates[0].content.parts[0].text;
        
        const now = new Date();
        const timeStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        currentReadingData = {
            topic: selectedTopic,
            time: timeStr,
            cards: cardsInfo.trim(),
            reading: aiReply
        };
        
        const formattedReply = aiReply.replace(/\n/g, '<br>');
        
        resultText.innerHTML = `<div class="reading-time">占卜時間：${timeStr}</div>${formattedReply}`;
        
        restartBtn.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        
    } catch (error) {
        console.error("API 錯誤:", error);
        resultText.innerHTML = `${t.apiError}<br><br><span style="color:#e74c3c; font-size: 0.9em;"><b>${t.devNote}</b><br>${error.message}</span>`;
        restartBtn.classList.remove('hidden');
    }
}

function saveCurrentReading() {
    if(!currentReadingData) return;
    let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');
    favs.push(currentReadingData);
    localStorage.setItem('tarotFavorites', JSON.stringify(favs));
    alert(i18n[currentLang].alertSave);
    document.getElementById('save-btn').classList.add('hidden'); 
}

function showFavorites() {
    const modal = document.getElementById('favorites-modal');
    const list = document.getElementById('favorites-list');
    const t = i18n[currentLang];
    let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');

    if(favs.length === 0) {
        list.innerHTML = `<p style='text-align:center; color:#a084ff;'>${t.emptyFav}</p>`;
    } else {
        list.innerHTML = favs.reverse().map((fav, index) => `
            <div class="fav-item">
                <h4>🔮 ${fav.topic} <span class="fav-time">${fav.time}</span></h4>
                <p class="fav-cards">${fav.cards.replace(/\n/g, '<br>')}</p>
                <p class="fav-reading">${fav.reading.replace(/\n/g, '<br>')}</p>
                <button class="delete-btn" onclick="deleteFavorite(${index})">${t.delBtn}</button>
            </div>
        `).join('');
    }
    modal.classList.remove('hidden');
}

function hideFavorites() {
    document.getElementById('favorites-modal').classList.add('hidden');
}

function deleteFavorite(reverseIndex) {
    if(confirm(i18n[currentLang].confirmDel)) {
        let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');
        const actualIndex = favs.length - 1 - reverseIndex;
        favs.splice(actualIndex, 1);
        localStorage.setItem('tarotFavorites', JSON.stringify(favs));
        showFavorites(); 
    }
}
