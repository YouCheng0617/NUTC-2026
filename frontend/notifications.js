// 🌟 替換成你真實的後端 API 網址
const API_BASE_URL = 'https://api.drift-bottles.xyz';

// 幫 API 請求建立一個通用設定，節省程式碼
const getFetchOptions = (method = 'GET') => {
  // 🌟 動態從 localStorage 抓取使用者真正的登入 Token
  const token = localStorage.getItem("authToken");

  return {
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true' // 加上這行確保不會被 ngrok 畫面阻擋
    }
  };
};

// 當網頁載入完成後，馬上跟後端要通知資料！
document.addEventListener('DOMContentLoaded', fetchNotifications);

// === 1. 取得當前登入使用者的通知列表 ===
async function fetchNotifications() {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, getFetchOptions('GET'));
    if (!response.ok) throw new Error('伺服器傲嬌了，抓不到資料');

    const data = await response.json();

    // 🌟 防呆拆包機制：確保抓出真正的「陣列」
    let notifArray = [];
    if (Array.isArray(data)) {
      notifArray = data; // 直接就是陣列
    } else if (data && Array.isArray(data.data)) {
      notifArray = data.data; // 包在 data 裡面
    } else if (data && Array.isArray(data.notifications)) {
      notifArray = data.notifications; // 包在 notifications 裡面
    } else if (data && Array.isArray(data.result)) {
      notifArray = data.result; // 包在 result 裡面
    }

    renderNotifications(notifArray); // 把確定的陣列交給渲染函數
  } catch (error) {
    console.error("抓取通知失敗：", error);
  }
}

// === 渲染畫面邏輯 ===
function renderNotifications(notifications) {
  const container = document.getElementById('notif-list-container');
  container.innerHTML = ''; // 清空原本的載入中狀態

  // 🌟 貼心小設計：如果完全沒有通知，顯示個溫馨提示
  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #88bbff; padding: 40px 0;">目前還沒有收到任何通知喔！🌊</div>';
    return;
  }

  notifications.forEach(notif => {
    // 判斷通知類型來決定 icon 的樣式與 Emoji (匹配後端傳回的 type)
    let iconClass = 'system';
    let iconEmoji = '🌊';
    const typeUpper = (notif.type || '').toUpperCase();

    if (typeUpper.includes('LIKE')) {
      iconClass = 'heart';
      iconEmoji = '❤️';
    } else if (typeUpper.includes('REPLY') || typeUpper.includes('COMMENT')) {
      iconClass = 'reply';
      iconEmoji = '💬';
    } else if (typeUpper.includes('SAVE') || typeUpper.includes('BOOKMARK')) {
      iconClass = 'save';
      iconEmoji = '⭐';
    } else if (typeUpper.includes('SYSTEM') || typeUpper.includes('ALERT') || typeUpper.includes('NOTICE')) {
      iconClass = 'system';
      iconEmoji = '⚠️';
    } else if (typeUpper.includes('WELCOME') || typeUpper.includes('USER') || typeUpper.includes('BONUS')) {
      iconClass = 'user';
      iconEmoji = '🎉';
    }

    // 判斷是否未讀，決定有沒有亮藍色的 class 和藍點
    // ... 下方的程式碼維持不變，繼續你的卡片生成邏輯 ...

    // 判斷是否未讀，決定有沒有亮藍色的 class 和藍點
    const isRead = notif.is_read ?? notif.isRead;
    const unreadClass = isRead ? '' : 'unread';
    const dotHtml = isRead ? '' : '<div class="unread-dot"></div>';

    // 格式化時間與內容 (後端傳回的欄位為 created_at 與 content)
    const timeStr = notif.created_at 
      ? new Date(notif.created_at).toLocaleString() 
      : (notif.time || '');
    const notificationText = notif.content || notif.message || '';

    // 產生專屬卡片 HTML
    const card = document.createElement('div');
    card.className = `notif-card ${unreadClass}`;
    // 如果是未讀，點擊時就呼叫單筆已讀 API
    if (!isRead) {
      card.onclick = () => markSingleAsReadAPI(notif.id, card);
    }

    card.innerHTML = `
      <div class="icon-box ${iconClass}">${iconEmoji}</div>
      <div class="text-box">
        <p>${notificationText}</p>
        <span class="time">${timeStr}</span>
      </div>
      ${dotHtml}
    `;

    container.appendChild(card);
  });
}

// === 2. 將單筆通知標記為已讀 ===
async function markSingleAsReadAPI(id, cardElement) {
  try {
    // 呼叫 PATCH /notifications/:id/read
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, getFetchOptions('PATCH'));

    if (response.ok) {
      // 成功後，在畫面上拔掉未讀狀態
      cardElement.classList.remove('unread');
      const dot = cardElement.querySelector('.unread-dot');
      if (dot) dot.style.display = 'none';
      // 移除點擊事件，避免重複發送請求
      cardElement.onclick = null;
    }
  } catch (error) {
    console.error(`標記通知 ${id} 失敗：`, error);
  }
}

// === 3. 一鍵全部標記為已讀 ===
async function markAllAsReadAPI() {
  // 先選取所有帶有 'unread' 類別的卡片[cite: 3]
  const unreadCards = document.querySelectorAll('.notif-card.unread'); //[cite: 3]

  // 如果長度等於 0，跳出提醒[cite: 3]
  if (unreadCards.length === 0) { //[cite: 3]
    alert("目前沒有未讀通知喔！🌊"); //[cite: 3]
    return; //[cite: 3]
  }

  try {
    // 呼叫 PATCH /notifications/read-all
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, getFetchOptions('PATCH'));

    if (response.ok) {
      // 成功後，將每一張卡片的未讀狀態移除[cite: 3]
      unreadCards.forEach(card => { //[cite: 3]
        card.classList.remove('unread'); //[cite: 3]
        // 把卡片裡面的小藍點隱藏起來[cite: 3]
        const dot = card.querySelector('.unread-dot'); //[cite: 3]
        if (dot) { //[cite: 3]
          dot.style.display = 'none'; //[cite: 3]
        }
        card.onclick = null; // 清除點擊事件
      });
      alert("全部都看過囉，寶寶真棒！✨");
    }
  } catch (error) {
    console.error("全部標記已讀失敗：", error);
  }
}