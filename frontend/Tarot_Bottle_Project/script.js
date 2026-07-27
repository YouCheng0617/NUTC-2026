const tarotDeck = [
    { id: 0, name: "愚者", image: "images/m00.jpg" }, { id: 1, name: "魔術師", image: "images/m01.jpg" }, { id: 2, name: "女祭司", image: "images/m02.jpg" }, { id: 3, name: "皇后", image: "images/m03.jpg" }, { id: 4, name: "皇帝", image: "images/m04.jpg" }, { id: 5, name: "教皇", image: "images/m05.jpg" }, { id: 6, name: "戀人", image: "images/m06.jpg" }, { id: 7, name: "戰車", image: "images/m07.jpg" }, { id: 8, name: "力量", image: "images/m08.jpg" }, { id: 9, name: "隱者", image: "images/m09.jpg" }, { id: 10, name: "命運之輪", image: "images/m10.jpg" }, { id: 11, name: "正義", image: "images/m11.jpg" }, { id: 12, name: "倒吊人", image: "images/m12.jpg" }, { id: 13, name: "死神", image: "images/m13.jpg" }, { id: 14, name: "節制", image: "images/m14.jpg" }, { id: 15, name: "惡魔", image: "images/m15.jpg" }, { id: 16, name: "高塔", image: "images/m16.jpg" }, { id: 17, name: "星星", image: "images/m17.jpg" }, { id: 18, name: "月亮", image: "images/m18.jpg" }, { id: 19, name: "太陽", image: "images/m19.jpg" }, { id: 20, name: "審判", image: "images/m20.jpg" }, { id: 21, name: "世界", image: "images/m21.jpg" },
    { id: 22, name: "權杖王牌", image: "images/w01.jpg" }, { id: 23, name: "權杖二", image: "images/w02.jpg" }, { id: 24, name: "權杖三", image: "images/w03.jpg" }, { id: 25, name: "權杖四", image: "images/w04.jpg" }, { id: 26, name: "權杖五", image: "images/w05.jpg" }, { id: 27, name: "權杖六", image: "images/w06.jpg" }, { id: 28, name: "權杖七", image: "images/w07.jpg" }, { id: 29, name: "權杖八", image: "images/w08.jpg" }, { id: 30, name: "權杖九", image: "images/w09.jpg" }, { id: 31, name: "權杖十", image: "images/w10.jpg" }, { id: 32, name: "權杖侍者", image: "images/w11.jpg" }, { id: 33, name: "權杖騎士", image: "images/w12.jpg" }, { id: 34, name: "權杖王后", image: "images/w13.jpg" }, { id: 35, name: "權杖國王", image: "images/w14.jpg" },
    { id: 36, name: "聖杯王牌", image: "images/c01.jpg" }, { id: 37, name: "聖杯二", image: "images/c02.jpg" }, { id: 38, name: "聖杯三", image: "images/c03.jpg" }, { id: 39, name: "聖杯四", image: "images/c04.jpg" }, { id: 40, name: "聖杯五", image: "images/c05.jpg" }, { id: 41, name: "聖杯六", image: "images/c06.jpg" }, { id: 42, name: "聖杯七", image: "images/c07.jpg" }, { id: 43, name: "聖杯八", image: "images/c08.jpg" }, { id: 44, name: "聖杯九", image: "images/c09.jpg" }, { id: 45, name: "聖杯十", image: "images/c10.jpg" }, { id: 46, name: "聖杯侍者", image: "images/c11.jpg" }, { id: 47, name: "聖杯騎士", image: "images/c12.jpg" }, { id: 48, name: "聖杯王后", image: "images/c13.jpg" }, { id: 49, name: "聖杯國王", image: "images/c14.jpg" },
    { id: 50, name: "寶劍王牌", image: "images/s01.jpg" }, { id: 51, name: "寶劍二", image: "images/s02.jpg" }, { id: 52, name: "寶劍三", image: "images/s03.jpg" }, { id: 53, name: "寶劍四", image: "images/s04.jpg" }, { id: 54, name: "寶劍五", image: "images/s05.jpg" }, { id: 55, name: "寶劍六", image: "images/s06.jpg" }, { id: 56, name: "寶劍七", image: "images/s07.jpg" }, { id: 57, name: "寶劍八", image: "images/s08.jpg" }, { id: 58, name: "寶劍九", image: "images/s09.jpg" }, { id: 59, name: "寶劍十", image: "images/s10.jpg" }, { id: 60, name: "寶劍侍者", image: "images/s11.jpg" }, { id: 61, name: "寶劍騎士", image: "images/s12.jpg" }, { id: 62, name: "寶劍王后", image: "images/s13.jpg" }, { id: 63, name: "寶劍國王", image: "images/s14.jpg" },
    { id: 64, name: "金幣王牌", image: "images/p01.jpg" }, { id: 65, name: "金幣二", image: "images/p02.jpg" }, { id: 66, name: "金幣三", image: "images/p03.jpg" }, { id: 67, name: "金幣四", image: "images/p04.jpg" }, { id: 68, name: "金幣五", image: "images/p05.jpg" }, { id: 69, name: "金幣六", image: "images/p06.jpg" }, { id: 70, name: "金幣七", image: "images/p07.jpg" }, { id: 71, name: "金幣八", image: "images/p08.jpg" }, { id: 72, name: "金幣九", image: "images/p09.jpg" }, { id: 73, name: "金幣十", image: "images/p10.jpg" }, { id: 74, name: "金幣侍者", image: "images/p11.jpg" }, { id: 75, name: "金幣騎士", image: "images/p12.jpg" }, { id: 76, name: "金幣王后", image: "images/p13.jpg" }, { id: 77, name: "金幣國王", image: "images/p14.jpg" }
];

let drawnCards = {};
let currentSlotIndex = 0;
const slotNames = ['past', 'present', 'future'];
let availableCards = [...tarotDeck]; 
let selectedTopic = ""; 
let currentReadingData = null; 

function startGame(topic) {
    selectedTopic = topic; 
    document.getElementById('topic-selection').classList.add('hidden');
    document.getElementById('tarot-area').classList.remove('hidden');
    document.getElementById('current-topic-display').innerText = `✨ 目前探索的領域：【${topic}】`;
    
    resetSlots();
    renderSpread(); 
}

function startCustomGame() {
    const customInput = document.getElementById('custom-topic-input').value.trim();
    if (customInput === "") {
        alert("魔法陣還沒有感應到你的問題... 請輸入你想問的事情喔！");
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
    document.getElementById('ai-reading-result').innerHTML = "✨ <i style='color:#a084ff'>命運的魔法陣正在啟動，請稍候...</i>";

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
    const startAngle = -75; // 展開幅度變大，讓牌不要太擠
    const angleStep = 150 / total; 

    for(let i=0; i<total; i++) {
        let card = document.createElement('div');
        card.className = 'spread-card';
        let angle = startAngle + (i * angleStep);
        card.style.setProperty('--rot', `${angle}deg`); 
        card.style.zIndex = i;
        
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
    const frontElement = document.getElementById(`front-${pos}`);

    cardContainer.classList.remove('empty-slot');

    imgElement.src = randomCard.image;
    imgElement.alt = randomCard.name;
    textElement.innerText = randomCard.name;
    
    if (isReversed) { frontElement.classList.add('reversed'); }

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
    
    resultBox.classList.remove('hidden');
    restartBtn.classList.add('hidden'); 
    saveBtn.classList.add('hidden');
    
    // 正確的等待文字
    resultText.innerHTML = "✨ <i style='color:#a084ff'>星空與魔法交織，命運的解讀正在浮現...</i>";

    const cardsInfo = `
        左邊第一張（過去）：${drawnCards['past'].name} (${drawnCards['past'].isReversed ? '逆位' : '正位'})
        中間第二張（現在）：${drawnCards['present'].name} (${drawnCards['present'].isReversed ? '逆位' : '正位'})
        右邊第三張（未來）：${drawnCards['future'].name} (${drawnCards['future'].isReversed ? '逆位' : '正位'})
    `;

    const prompt = `你現在是一位溫柔、充滿智慧的星空魔法塔羅占卜師。玩家想問的問題是關於【${selectedTopic}】。玩家抽到了一個三牌陣，請務必依照「由左至右」的順序（過去、現在、未來）進行解讀：\n${cardsInfo}\n請根據牌面與正逆位，針對玩家詢問的「${selectedTopic}」給出一份語氣溫柔、帶有魔法與星空隱喻且具有啟發性的解牌報告。請不要給出絕對的預言，而是給予引導。排版要清晰，字數請控制在 300 字以內。`;

    // ⚠️ 記得替換成你的真實 API Key
    const API_KEY = '請填寫你的_API_KEY';
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
        
        // 正確的字串替換寫法
        resultText.innerHTML = `<div class="reading-time">占卜時間：${timeStr}</div>` + aiReply.replace(/\n/g, '<br>');
        
        restartBtn.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        
    } catch (error) {
        console.error("API 錯誤:", error);
        resultText.innerHTML = `⚠️ 魔法陣的連結受到干擾，無法解讀塔羅牌。<br><br>
        <span style="color:#e74c3c; font-size: 0.9em;"><b>開發者提示 (錯誤原因)：</b><br>${error.message}</span>`;
        restartBtn.classList.remove('hidden');
    }
}

function saveCurrentReading() {
    if(!currentReadingData) return;
    let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');
    favs.push(currentReadingData);
    localStorage.setItem('tarotFavorites', JSON.stringify(favs));
    alert('✨ 已成功收錄至您的魔法筆記中！');
    document.getElementById('save-btn').classList.add('hidden'); 
}

function showFavorites() {
    const modal = document.getElementById('favorites-modal');
    const list = document.getElementById('favorites-list');
    let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');

    if(favs.length === 0) {
        list.innerHTML = "<p style='text-align:center; color:#a084ff;'>目前魔法筆記裡還是空空的喔！<br>趕快去進行你的第一場占卜吧🔮</p>";
    } else {
        // 正確的字串替換寫法
        list.innerHTML = favs.reverse().map((fav, index) => `
            <div class="fav-item">
                <h4>🔮 ${fav.topic} <span class="fav-time">${fav.time}</span></h4>
                <p class="fav-cards">${fav.cards.replace(/\n/g, '<br>')}</p>
                <p class="fav-reading">${fav.reading.replace(/\n/g, '<br>')}</p>
                <button class="delete-btn" onclick="deleteFavorite(${index})">刪除紀錄</button>
            </div>
        `).join('');
    }
    modal.classList.remove('hidden');
}

function hideFavorites() {
    document.getElementById('favorites-modal').classList.add('hidden');
}

function deleteFavorite(reverseIndex) {
    if(confirm("確定要將這條指引從筆記中抹除嗎？")) {
        let favs = JSON.parse(localStorage.getItem('tarotFavorites') || '[]');
        const actualIndex = favs.length - 1 - reverseIndex;
        favs.splice(actualIndex, 1);
        localStorage.setItem('tarotFavorites', JSON.stringify(favs));
        showFavorites(); 
    }
}