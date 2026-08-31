// ==========================================
// 🌊 客服中心 (Customer Service) 前端邏輯
// ==========================================

const API_BASE_URL = "https://api.drift-bottles.xyz";

let allUserTickets = [];
let currentFilterStatus = "all";

// 🌟 HTML 跳脫防 XSS
function escapeHTML(str) {
  if (typeof str !== "string") str = String(str || "");
  return str.replace(/[&<>'"]/g, tag => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[tag]));
}

// 🌟 顯示吐司訊息 Toast
function showToast(message, duration = 3000) {
  const toast = document.getElementById("cs-toast");
  if (!toast) return;
  toast.innerText = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
}

// ==========================================
// 1. 初始化與登入狀態檢查
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initUserProfile();
  loadUserTickets(); // 預載客服紀錄
});

function initUserProfile() {
  const token = localStorage.getItem("authToken");
  const userStr = localStorage.getItem("currentUser");
  const loginTrigger = document.getElementById("login-trigger");
  const userProfile = document.getElementById("user-profile");
  const userNameEl = document.getElementById("user-name");
  const userAvatarEl = document.getElementById("user-avatar");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");
  const logoutBtn = document.getElementById("logout-btn");

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      if (loginTrigger) loginTrigger.style.display = "none";
      if (userProfile) userProfile.style.display = "flex";
      if (userNameEl) userNameEl.innerText = user.name || user.email || "會員";
      if (userAvatarEl && user.avatar) userAvatarEl.src = user.avatar;

      // 點擊大頭貼展開/收合下拉選單
      if (userMenuBtn && userDropdown) {
        userMenuBtn.onclick = (e) => {
          e.stopPropagation();
          userDropdown.style.display = userDropdown.style.display === "block" ? "none" : "block";
        };

        // 點擊其他地方關閉選單
        document.addEventListener("click", () => {
          userDropdown.style.display = "none";
        });
      }

      // 登出按鈕
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          if (confirm("確定要退出登入嗎？")) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("currentUser");
            window.location.href = "login.html";
          }
        };
      }
    } catch (e) {
      console.error("解析使用者資料失敗", e);
    }
  } else {
    if (loginTrigger) loginTrigger.style.display = "block";
    if (userProfile) userProfile.style.display = "none";
  }
}

// ==========================================
// 2. 頁籤切換
// ==========================================
window.switchCsTab = function (tabName) {
  const formSection = document.getElementById("cs-section-form");
  const historySection = document.getElementById("cs-section-history");
  const tabBtnForm = document.getElementById("tab-btn-form");
  const tabBtnHistory = document.getElementById("tab-btn-history");

  if (tabName === "form") {
    formSection.style.display = "block";
    historySection.style.display = "none";
    tabBtnForm.classList.add("active");
    tabBtnHistory.classList.remove("active");
  } else if (tabName === "history") {
    formSection.style.display = "none";
    historySection.style.display = "block";
    tabBtnForm.classList.remove("active");
    tabBtnHistory.classList.add("active");
    loadUserTickets(); // 切換時自動重抓
  }
};

// ==========================================
// 3. 表單輔助功能
// ==========================================
window.setQuickTitle = function (titlePrefix) {
  const titleInput = document.getElementById("cs-title");
  if (!titleInput) return;
  titleInput.value = titlePrefix + " ";
  titleInput.focus();
  updateCharCount("cs-title", "title-counter", 80);
};

window.updateCharCount = function (inputId, counterId, maxLength) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (input && counter) {
    const len = input.value.length;
    counter.innerText = `${len} / ${maxLength}`;
    if (len >= maxLength) {
      counter.style.color = "#ef4444";
    } else {
      counter.style.color = "#94a3b8";
    }
  }
};

window.resetCsForm = function () {
  const form = document.getElementById("cs-form");
  if (form) form.reset();
  updateCharCount("cs-title", "title-counter", 80);
  updateCharCount("cs-message", "message-counter", 1000);
};

// ==========================================
// 4. 送出客服表單 (POST /customer-service)
// ==========================================
window.handleFormSubmit = async function (event) {
  event.preventDefault();

  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("⚠️ 請先登入會員後，再發送客服提問！");
    window.location.href = "login.html";
    return;
  }

  const title = document.getElementById("cs-title").value.trim();
  const message = document.getElementById("cs-message").value.trim();

  if (!title) {
    alert("請填寫問題主旨！");
    document.getElementById("cs-title").focus();
    return;
  }
  if (!message) {
    alert("請填寫詳細問題描述！");
    document.getElementById("cs-message").focus();
    return;
  }

  const submitBtn = document.getElementById("btn-submit-cs");
  const submitText = document.getElementById("btn-submit-text");
  const submitSpinner = document.getElementById("btn-submit-spinner");

  // 進入 Loading 狀態
  submitBtn.disabled = true;
  submitText.innerText = "正在傳送中...";
  submitSpinner.style.display = "inline-block";

  try {
    const response = await fetch(`${API_BASE_URL}/customer-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({ title, message })
    });

    const result = await response.json();

    if (response.ok) {
      showToast("🎉 客服表單已成功送出！系統已同步發送確認通知。");
      resetCsForm();
      // 切換至歷史紀錄並重新整理
      switchCsTab("history");
    } else {
      alert("❌ 送出失敗：" + (result.message || "伺服器忙線中，請稍後再試！"));
    }
  } catch (error) {
    console.error("發送客服問題失敗", error);
    alert("連線伺服器失敗，請確認網路連線或稍後再試！");
  } finally {
    submitBtn.disabled = false;
    submitText.innerText = "🚀 確認送出客服表單";
    submitSpinner.style.display = "none";
  }
};

// ==========================================
// 5. 載入並渲染歷史紀錄 (GET /customer-service/my)
// ==========================================
window.loadUserTickets = async function () {
  const container = document.getElementById("cs-tickets-container");
  const countTag = document.getElementById("cs-history-count");
  const token = localStorage.getItem("authToken");

  if (!token) {
    if (container) {
      container.innerHTML = `
        <div class="cs-empty-state">
          <span class="empty-icon">🔒</span>
          <h3>尚未登入會員</h3>
          <p>登入後即可查看您與客服的歷史對話與回覆進度。</p>
          <button class="btn-submit" style="margin: 0 auto;" onclick="window.location.href='login.html'">前往登入</button>
        </div>
      `;
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/customer-service/my`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true"
      }
    });

    if (!response.ok) throw new Error();

    const data = await response.json();
    allUserTickets = data.data || data || [];

    // 更新角標數字
    if (countTag) {
      if (allUserTickets.length > 0) {
        countTag.innerText = allUserTickets.length;
        countTag.style.display = "inline-block";
      } else {
        countTag.style.display = "none";
      }
    }

    renderTickets();
  } catch (error) {
    console.error("載入客服紀錄失敗", error);
    if (container) {
      container.innerHTML = `
        <div class="cs-empty-state">
          <span class="empty-icon">⚠️</span>
          <h3>無法載入客服紀錄</h3>
          <p>請檢查您的網路連線或登入憑證是否有效。</p>
          <button class="btn-refresh" onclick="loadUserTickets()">🔄 點此重試</button>
        </div>
      `;
    }
  }
};

window.filterHistoryByStatus = function (status, btnEl) {
  currentFilterStatus = status;

  // 更新按鈕樣式
  document.querySelectorAll(".history-filter-bar .filter-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  if (btnEl) btnEl.classList.add("active");

  renderTickets();
};

function renderTickets() {
  const container = document.getElementById("cs-tickets-container");
  if (!container) return;

  const filteredTickets = allUserTickets.filter(t => {
    if (currentFilterStatus === "all") return true;
    return Number(t.status) === Number(currentFilterStatus);
  });

  if (filteredTickets.length === 0) {
    container.innerHTML = `
      <div class="cs-empty-state">
        <span class="empty-icon">☕</span>
        <h3>目前沒有相關的客服紀錄</h3>
        <p>${allUserTickets.length === 0 ? "您尚未提交過任何問題，如果有需要協助的地方歡迎隨時發問！" : "此篩選條件下沒有符合的案件。"}</p>
        ${allUserTickets.length === 0 ? `<button class="btn-submit" style="margin: 0 auto;" onclick="switchCsTab('form')">✍️ 馬上提問</button>` : ""}
      </div>
    `;
    return;
  }

  container.innerHTML = filteredTickets.map(ticket => {
    const statusNum = Number(ticket.status || 0);
    let statusBadge = "";
    if (statusNum === 0) {
      statusBadge = `<span class="ticket-status status-pending">⏳ 待處理</span>`;
    } else if (statusNum === 1) {
      statusBadge = `<span class="ticket-status status-processing">⚙️ 處理中</span>`;
    } else {
      statusBadge = `<span class="ticket-status status-resolved">✅ 已回覆</span>`;
    }

    const createdDate = ticket.created_at ? new Date(ticket.created_at).toLocaleString("zh-TW") : "未知時間";
    const updatedDate = ticket.updated_at ? new Date(ticket.updated_at).toLocaleString("zh-TW") : "";

    // 管理員回覆區塊
    let replyHtml = "";
    if (ticket.reply && ticket.reply.trim()) {
      replyHtml = `
        <div class="admin-reply-box">
          <div class="admin-reply-header">
            <span class="admin-reply-title">🐟 客服小幫手 回覆：</span>
            <span class="admin-reply-time">${updatedDate}</span>
          </div>
          <div class="admin-reply-content">${escapeHTML(ticket.reply)}</div>
        </div>
      `;
    } else {
      replyHtml = `
        <div class="admin-reply-empty">
          <span>⏳ 客服小幫手正在查看您的問題，請耐心等候回覆...</span>
        </div>
      `;
    }

    return `
      <div class="ticket-card">
        <div class="ticket-header">
          <div class="ticket-title-wrap">
            <span class="ticket-id">#${ticket.id}</span>
            <h3 class="ticket-title">${escapeHTML(ticket.title)}</h3>
          </div>
          ${statusBadge}
        </div>

        <div class="ticket-meta">
          <span>📅 提交時間：${createdDate}</span>
        </div>

        <div class="ticket-message">${escapeHTML(ticket.message)}</div>

        ${replyHtml}
      </div>
    `;
  }).join("");
}
