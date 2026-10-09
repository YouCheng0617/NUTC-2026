// ✨ 統一設定後端網址
const API_BASE_URL = "https://api.drift-bottles.xyz";

// 🌟 全域追蹤名單 ID 集合（記憶已追蹤的作者 ID）
window._myFollowingIdSet = new Set();

// 載入當前使用者的追蹤名單 ID 集合
async function syncMyFollowingList() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/following`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      const backendData = await response.json();
      const list = backendData.data || backendData || [];
      window._myFollowingIdSet = new Set(
        list.map((u) =>
          String(u.id || u.followed_id || u.followedId || u.member_id),
        ),
      );
    }
  } catch (e) {
    console.error("同步追蹤名單失敗:", e);
  }
}

// 🌟 自動登出與 JWT 解析檢查
function checkTokenExpired() {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      handleAutoLogout("登入憑證已過期，請重新登入！");
    }
  } catch (e) {
    handleAutoLogout("憑證格式無效，請重新登入！");
  }
}

function handleAutoLogout(message) {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  alert(message || "登入已逾時，請重新登入！");
  window.location.href = "login.html";
}

// 頁面載入時先主動檢查一次 Token 是否逾時
checkTokenExpired();

// 🌟 全域單向攔截 fetch 401 逾時回應
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  if (response.status === 401) {
    handleAutoLogout("登入憑證已過期，請重新登入！");
  }
  return response;
};

let posts = [];
let currentKeyword = "";
let currentAuthorId = null; // 🌟 記住目前正在看哪位作者的文章

// 👇 分頁設定與狀態紀錄
let currentPage = 1;
// 一頁幾個瓶子：電腦版 6 個（3 欄 × 2 排）；手機版瓶子排在 3D 球上（home_mobile.js），放 10 個比較像一顆球
const POSTS_PER_PAGE = window.matchMedia("(max-width: 768px)").matches ? 10 : 6;

// 🌟 一進來就看到全海域！
let currentBoard = sessionStorage.getItem("savedBoard") || "全海域";
let savedCatId = sessionStorage.getItem("savedCategoryId");
let currentCategoryId =
  savedCatId !== null && savedCatId !== "null" ? Number(savedCatId) : null;

let currentView = "all";

const BOARD_CATEGORY_MAP = {
  "🌊 全海域": null,
  "😡 極度憤怒中": 1,
  "🤫 沒人懂的秘密": 2,
  "💔 破碎的碎片": 3,
  "😑 極度厭世/躺平": 4,
  "😁 開心的事": 5,
};

// =========================================
// 🚀 魔法：防抖與高亮函數
// =========================================
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function highlightText(text, keyword) {
  if (!keyword) return text;
  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safeKeyword})`, "gi");
  return String(text).replace(regex, '<span class="highlight">$1</span>');
}

function calculateZodiac(month, day) {
  if ((month == 1 && day >= 20) || (month == 2 && day <= 18)) return "水瓶座";
  if ((month == 2 && day >= 19) || (month == 3 && day <= 20)) return "雙魚座";
  if ((month == 3 && day >= 21) || (month == 4 && day <= 19)) return "牡羊座";
  if ((month == 4 && day >= 20) || (month == 5 && day <= 20)) return "金牛座";
  if ((month == 5 && day >= 21) || (month == 6 && day <= 20)) return "雙子座";
  if ((month == 6 && day >= 21) || (month == 7 && day <= 22)) return "巨蟹座";
  if ((month == 7 && day >= 23) || (month == 8 && day <= 22)) return "獅子座";
  if ((month == 8 && day >= 23) || (month == 9 && day <= 22)) return "處女座";
  if ((month == 9 && day >= 23) || (month == 10 && day <= 22)) return "天秤座";
  if ((month == 10 && day >= 23) || (month == 11 && day <= 21)) return "天蠍座";
  if ((month == 11 && day >= 22) || (month == 12 && day <= 21)) return "射手座";
  if ((month == 12 && day >= 22) || (month == 1 && day <= 19)) return "摩羯座";
  return "未填寫";
}

// 🌊 向後端抓取文章 API
// 🌊 把後端回傳的瓶子資料整理成前端畫面在用的格式。
// 抽成獨立函式，讓貼文列表跟「點通知跳到該篇貼文」共用同一套轉換，不會有兩份對不起來
function normalizeBottle(rawItem, likedBottleIds = [], savedBottleIds = []) {
      const item = rawItem.bottle || rawItem.Bottle || rawItem;
      const safeId = String(
        item.bottle_id ||
          item.id ||
          item.bottleId ||
          rawItem.bottle_id ||
          `temp_${Math.random().toString(36).substr(2, 9)}`,
      );

      let isActuallyLiked =
        likedBottleIds.includes(safeId) ||
        Boolean(item.is_liked || item.isLiked || rawItem.is_liked);
      let isActuallySaved =
        savedBottleIds.includes(safeId) ||
        Boolean(item.is_saved || item.isSaved || rawItem.is_saved);

      if (currentView === "saved") isActuallySaved = true;

      let totalLikes = parseInt(
        item.like_count ||
          item.likeCount ||
          item.likes ||
          item.view_count ||
          rawItem.like_count ||
          0,
        10,
      );
      if (isActuallyLiked && totalLikes === 0) totalLikes = 1;

      let authorName = "用戶";
      if (typeof item.author === "string") authorName = item.author;
      else if (item.author?.name) authorName = item.author.name;
      else if (item.author_name) authorName = item.author_name;
      else if (item.user?.name) authorName = item.user.name;
      else if (item.username) authorName = item.username;
      else if (item.User?.name) authorName = item.User.name;
      else if (typeof rawItem.author === "string")
        authorName = rawItem.author;
      else if (rawItem.author?.name) authorName = rawItem.author.name;
      else if (rawItem.user?.name) authorName = rawItem.user.name;
      else if (rawItem.User?.name) authorName = rawItem.User.name;
      else if (rawItem.member?.name) authorName = rawItem.member.name;
      else if (item.member?.name) authorName = item.member.name;
      else if (item.member_name) authorName = item.member_name;
      else if (rawItem.member_name) authorName = rawItem.member_name;

      if (authorName === "用戶" && currentView === "mine") {
        const currentUser = JSON.parse(
          localStorage.getItem("currentUser") || "{}",
        );
        authorName = currentUser.name || "用戶";
      }

      let rawBoard = item.category_name || item.board || null;

      if (
        !rawBoard &&
        item.category_list &&
        Array.isArray(item.category_list) &&
        item.category_list.length > 0
      ) {
        rawBoard = item.category_list[0];
      }

      if (!rawBoard && item.categories && item.categories.length > 0) {
        rawBoard = item.categories[0].category?.name;
      } else if (
        !rawBoard &&
        rawItem.categories &&
        rawItem.categories.length > 0
      ) {
        rawBoard = rawItem.categories[0].category?.name;
      }

      let finalBoard = "😑 極度厭世/躺平";
      let cId = item.category_id || rawItem.category_id || item.categoryId;

      if (!rawBoard && item.categories && item.categories.length > 0) {
        cId = item.categories[0].category_id;
      }

      if (rawBoard) {
        if (rawBoard.includes("憤怒")) finalBoard = "😡 極度憤怒中";
        else if (rawBoard.includes("秘密")) finalBoard = "🤫 沒人懂的秘密";
        else if (rawBoard.includes("破碎")) finalBoard = "💔 破碎的碎片";
        else if (rawBoard.includes("厭世") || rawBoard.includes("躺平"))
          finalBoard = "😑 極度厭世/躺平";
        else if (rawBoard.includes("開心")) finalBoard = "😁 開心的事";
        else finalBoard = rawBoard;
      } else if (cId !== undefined && cId !== null) {
        const idToBoard = {
          1: "😡 極度憤怒中",
          2: "🤫 沒人懂的秘密",
          3: "💔 破碎的碎片",
          4: "😑 極度厭世/躺平",
          5: "😁 開心的事",
        };
        if (Array.isArray(cId) && cId.length > 0) {
          finalBoard = idToBoard[cId[0]] || finalBoard;
        } else if (!Array.isArray(cId)) {
          finalBoard = idToBoard[cId] || finalBoard;
        }
      }

      let realAuthorId =
        item.author_id ||
        item.user_id ||
        item.member_id ||
        rawItem.author_id ||
        rawItem.user_id;

      if (!realAuthorId && item.author?.id) realAuthorId = item.author.id;
      if (!realAuthorId && item.user?.id) realAuthorId = item.user.id;
      if (!realAuthorId && item.User?.id) realAuthorId = item.User.id;
      if (!realAuthorId && item.member?.id) realAuthorId = item.member.id;
      if (!realAuthorId && rawItem.author?.id)
        realAuthorId = rawItem.author.id;

      const itemPoll = parsePoll(item, rawItem);
      const itemContent = stripLegacyPollTag(
        item.content || rawItem.content || "",
      );

      return {
        id: safeId,
        board: finalBoard,
        author: item.is_anonymous || item.isAnonymous ? "匿名" : authorName,
        authorId: realAuthorId || null,
        title: item.title || rawItem.title,
        desc: itemContent, // 🌟 換成乾淨無標籤的內文
        poll: itemPoll, // 🌟 掛上投票物件
        likes: totalLikes,
        msgs: item.comment_count || item.comments?.length || 0,
        liked: isActuallyLiked,
        saved: isActuallySaved,
        createdAt:
          item.createdAt ||
          item.created_at ||
          rawItem.createdAt ||
          rawItem.created_at,
        editedAt: item.edited_at || rawItem.edited_at || null,
        // 「我的瓶子」裡的一定是自己的（匿名瓶子也算）；其他地方比對作者 id
        isMine:
          currentView === "mine" ||
          Boolean(realAuthorId && String(realAuthorId) === String(getMyMemberId())),
      };
}

// 🌫️ 每個請求最多等 10 秒：伺服器沒回應時，瀏覽器自己的逾時要很久，畫面會一直空著
const BOTTLE_FETCH_TIMEOUT = 10000;
function fetchWithTimeout(url, options = {}, ms = BOTTLE_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// 🌫️ 連不上伺服器（或伺服器回錯誤）：顯示提示和重新連線按鈕，不要讓畫面空空的像壞掉一樣
function renderBottlesOffline() {
  if (window.__ttLoading) window.__ttLoading.postsDone();
  const container = document.getElementById("post-container");
  const pageContainer = document.getElementById("pagination-container");
  if (!container) return;
  container.innerHTML = `
    <div class="bottles-offline" style="text-align:center; color:#ffffff; margin-top:90px; padding:0 16px;">
      <h3 style="margin:0 0 10px; font-size:1.4rem; text-shadow:0 0 10px rgba(77, 166, 255, 0.8);">🌊 海面暫時起霧了，連不上伺服器</h3>
      <p style="margin:0 0 18px; font-size:0.95rem; opacity:0.9; text-shadow:0 0 8px rgba(0, 60, 120, 0.6);">漂流瓶都還在，只是現在撈不到，請稍後再試一次</p>
      <button type="button" id="bottles-retry-btn" style="padding:10px 22px; border:none; border-radius:999px; background:#ffffff; color:#0055a5; font-size:1rem; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(0, 85, 165, 0.3);">🔄 重新連線</button>
    </div>`;
  if (pageContainer) pageContainer.innerHTML = "";
  const btn = document.getElementById("bottles-retry-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "重新連線中…";
      fetchBottles();
    });
  }
}

async function fetchBottles() {
  const token = localStorage.getItem("authToken");

  try {
    let endpointUrl = `${API_BASE_URL}/bottles/random`;

    if (currentView === "mine") {
      if (!token) {
        renderPosts([]);
        return;
      }
      endpointUrl = `${API_BASE_URL}/bottles/mybottles`;
    } else if (currentView === "saved") {
      if (!token) {
        renderPosts([]);
        return;
      }
      endpointUrl = `${API_BASE_URL}/bottles/saved`;
    } else if (currentKeyword) {
      endpointUrl = `${API_BASE_URL}/bottles/search?keyword=${encodeURIComponent(currentKeyword)}`;
    } else if (currentCategoryId !== null) {
      endpointUrl = `${API_BASE_URL}/bottles/random?categoryId=${currentCategoryId}`;
    }
    let likedBottleIds = [];
    let savedBottleIds = [];

    if (token) {
      try {
        const likedRes = await fetchWithTimeout(`${API_BASE_URL}/bottles/liked`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });
        if (likedRes.ok) {
          const likedData = await likedRes.json();
          let arr = likedData.bottles || likedData.data || likedData;
          if (Array.isArray(arr))
            likedBottleIds = arr.map((i) =>
              String(i.bottle_id || i.id || i.bottleId),
            );
        }
      } catch (e) {}

      try {
        const savedRes = await fetchWithTimeout(`${API_BASE_URL}/bottles/saved`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });
        if (savedRes.ok) {
          const savedData = await savedRes.json();
          let arr = savedData.bottles || savedData.data || savedData;
          if (Array.isArray(arr))
            savedBottleIds = arr.map((i) =>
              String(i.bottle_id || i.id || i.bottleId),
            );
        }
      } catch (e) {}
    }

    const headers = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetchWithTimeout(endpointUrl, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const backendData = await response.json();

      let postsArray = [];
      if (backendData.bottles && Array.isArray(backendData.bottles)) {
        postsArray = backendData.bottles;
      } else if (Array.isArray(backendData)) {
        postsArray = backendData;
      } else if (backendData.data && Array.isArray(backendData.data)) {
        postsArray = backendData.data;
      } else if (
        backendData.data?.result &&
        Array.isArray(backendData.data.result)
      ) {
        postsArray = backendData.data.result;
      } else if (
        backendData.mybottles &&
        Array.isArray(backendData.mybottles)
      ) {
        postsArray = backendData.mybottles;
      } else if (backendData.result && Array.isArray(backendData.result)) {
        postsArray = backendData.result;
      }

      posts = postsArray.map((rawItem) =>
        normalizeBottle(rawItem, likedBottleIds, savedBottleIds),
      );

      applyFilters();
    } else if (response.status === 404) {
      // 真的沒有瓶子：照舊顯示「海域空空的」
      posts = [];
      applyFilters();
    } else {
      // 伺服器有回應但出錯（例如 500、502）：不是真的沒瓶子，顯示連不上的提示
      console.error("伺服器錯誤:", response.status);
      renderBottlesOffline();
    }
  } catch (error) {
    // 連不上、逾時（超過 10 秒）
    console.error("連線錯誤:", error);
    renderBottlesOffline();
  } finally {
    // 🌊 撈不到瓶子（例如後端連不上）也要收掉載入畫面，
    //    不然使用者會對著載入畫面乾等到保險絲跳掉
    if (window.__ttLoading) window.__ttLoading.postsDone();
  }
}

// 🌟 把後端的 poll_options 轉成前端投票物件（沒有投票回傳 null）
function parsePoll(item, rawItem = {}) {
  const rawOptions = item.poll_options || rawItem.poll_options;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) return null;
  const options = rawOptions.map((opt) => ({
    id: opt.option_id,
    text: opt.text,
    votes: opt.vote_count || 0,
  }));
  return {
    options,
    totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
    userVotedOptionId:
      item.user_voted_option_id ?? rawItem.user_voted_option_id ?? null,
  };
}

// 相容舊資料：移除內文裡殘留的投票標籤
function stripLegacyPollTag(content) {
  return content.replace(/<!--POLL_JSON:(.*?):POLL_JSON-->/, "").trim();
}

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag],
  );
}

function renderPosts(data = posts) {
  // 🌊 貼文一畫出來就通知載入畫面：到這裡代表資料流程已經跑完，可以放人進來了
  if (window.__ttLoading) window.__ttLoading.postsDone();

  const container = document.getElementById("post-container");
  const pageContainer = document.getElementById("pagination-container");
  if (!container) return;

  if (!data || data.length === 0) {
    if (currentKeyword) {
      container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">喵嗚...翻遍了整片海域，就是找不到包含「${escapeHTML(currentKeyword)}」的瓶子喔！😿</h3>`;
    } else {
      container.innerHTML = `<h3 style="text-align:center; color:#ffffff; text-shadow: 0 0 10px rgba(77, 166, 255, 0.8); margin-top:100px; font-size: 1.4rem;">目前這個海域空空的，快來拋出你的第一個漂流瓶吧！🌊</h3>`;
    }
    if (pageContainer) pageContainer.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(data.length / POSTS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages || 1;

  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const pageData = data.slice(startIndex, endIndex);

  container.innerHTML = pageData
    .map(
      (p) => `
        <div class="post-card" onclick="openPostDetail('${escapeHTML(String(p.id))}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#0055a5; font-weight:bold;">${highlightText(escapeHTML(p.board), currentKeyword)}${p.poll ? ' <span class="post-poll-badge">📊 投票</span>' : ""}</div>
                <div style="font-size:0.8rem; color:#888; background:#f0f4f8; padding:3px 10px; border-radius:12px;">${highlightText(escapeHTML(p.author), currentKeyword)}</div>
            </div>
            <h2 style="margin:12px 0; color:#333; font-size: 1.4rem;">${highlightText(escapeHTML(p.title), currentKeyword)}</h2>
            <p style="color:#666; line-height: 1.5; font-size: 0.95rem;">${highlightText(escapeHTML(markdownToPlainText(p.desc)), currentKeyword)}</p>
            <div class="action-bar">
                <span class="action-btn ${p.liked ? "like-active" : ""}" onclick="toggleAction('${escapeHTML(String(p.id))}', 'like', event)">${p.liked ? "❤️" : "🤍"} ${p.likes}</span>
                <span class="action-btn">💬 ${p.msgs}</span>
                
                <div style="margin-left: auto; display: flex; gap: 15px;">
                    <span class="action-btn ${p.saved ? "save-active" : ""}" onclick="toggleAction('${escapeHTML(String(p.id))}', 'save', event)">${p.saved ? "⭐ 已收藏" : "☆ 收藏"}</span>
                    
                    ${canEditBottle(p) ? `<span class="action-btn" style="color: #2f80ed;" onclick="openEditBottleModal('${escapeHTML(String(p.id))}', event)">✏️ 修改</span>` : ""}
                    ${currentView === "mine" ? `<span class="action-btn" style="color: #ff4d4d;" onclick="deleteMyBottle('${escapeHTML(String(p.id))}', event)">🗑️ 刪除</span>` : ""}
                </div>
            </div>
        </div>
    `,
    )
    .join("");

  renderPagination(totalPages, data);
}

function applyFilters() {
  let res = posts;

  if (currentView === "saved") {
    res = res.filter((p) => p.saved === true);
  } else if (currentView === "mine") {
  } else if (!currentKeyword && currentBoard !== "全海域") {
    res = res.filter((p) => p.board.includes(currentBoard));
  }

  if (currentKeyword) {
    res = res.filter(
      (p) =>
        (p.title && p.title.toLowerCase().includes(currentKeyword)) ||
        (p.desc && p.desc.toLowerCase().includes(currentKeyword)) ||
        (p.board && p.board.toLowerCase().includes(currentKeyword)) ||
        (p.author && p.author.toLowerCase().includes(currentKeyword)),
    );
  }

  renderPosts(res);
}

function getSearchHistory() {
  return JSON.parse(localStorage.getItem("searchHistory") || "[]");
}

function saveSearchHistory(keyword) {
  if (!keyword.trim()) return;
  let history = getSearchHistory();
  history = history.filter((item) => item !== keyword);
  history.unshift(keyword);
  if (history.length > 5) history.pop();
  localStorage.setItem("searchHistory", JSON.stringify(history));
}

function renderSearchHistory() {
  const historyBox = document.getElementById("search-history-dropdown");
  const searchInput = document.getElementById("main-search-input");
  if (!historyBox || !searchInput) return;

  let history = getSearchHistory();
  const currentText = searchInput.value.trim().toLowerCase();

  if (currentText !== "") {
    history = history.filter((item) =>
      item.toLowerCase().includes(currentText),
    );
  }

  if (history.length === 0) {
    historyBox.style.display = "none";
    return;
  }

  let html = "";
  history.forEach((item) => {
    html += `
            <div class="history-item" data-keyword="${escapeHTML(item)}" onmousedown="applyHistorySearch(event, this.dataset.keyword)">
                <span>${escapeHTML(item)}</span>
                <span class="delete-history-btn" onmousedown="removeSingleHistory(event, this.parentElement.dataset.keyword)">&times;</span>
            </div>
        `;
  });

  historyBox.innerHTML = html;
  historyBox.style.display = "block";
}

window.applyHistorySearch = function (e, keyword) {
  if (e) e.preventDefault();
  const searchInput = document.getElementById("main-search-input");
  if (searchInput) searchInput.value = keyword;
  currentKeyword = keyword.toLowerCase();

  const clearBtn = document.getElementById("clear-search-btn");
  if (clearBtn) clearBtn.style.display = keyword ? "block" : "none";

  applyFilters();
  document.getElementById("search-history-dropdown").style.display = "none";
};

window.removeSingleHistory = function (e, keyword) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  let history = getSearchHistory();
  history = history.filter((item) => item !== keyword);
  localStorage.setItem("searchHistory", JSON.stringify(history));
  renderSearchHistory();
};

let currentOpenPostId = null;

// =========================================
// 🚀 留言功能完整對接後端 API
// =========================================

window.renderComments = async function (postId) {
  const lists = document.querySelectorAll("#detail-comments-list");
  const counts = document.querySelectorAll("#detail-comment-count");

  lists.forEach((listContainer) => {
    if (listContainer)
      listContainer.innerHTML =
        '<div style="text-align:center; color:#888; padding: 30px 0;">潛入海底撈取留言中...🌊</div>';
  });

  try {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/comments/bottles/${postId}`, {
      method: "GET",
      headers: headers,
    });

    let comments = [];
    if (response.ok) {
      const data = await response.json();
      comments = data.comments || data.data || data || [];
    }

    lists.forEach((listContainer) => {
      if (!listContainer) return;
      if (comments.length === 0) {
        listContainer.innerHTML =
          '<div style="text-align:center; color:#888; padding: 30px 0;">目前還沒有留言喔，來搶頭香吧！🐟</div>';
        return;
      }

      let html = "";
      comments.forEach((c, index) => {
        const authorName = c.member_name || "未知使用者";
        const likesCount = c.likeCount || c.like_count || c.likes || 0;
        const isLiked = c.isLiked || c.is_liked || c.liked || false;
        const commentId = c.id || c.comment_id || c.commentId || c._id;
        const content = c.content || c.text || "";
        const avatar = c.avatar || "images/fish_logo.webp";
        commentRawContent.set(String(commentId), content);

        const replies = c.replies || c.children || c.subComments || [];
        let repliesHtml = "";

        if (replies.length > 0) {
          replies.forEach((reply) => {
            const rAuthor = reply.member_name || "未知使用者";
            const rContent = reply.content || reply.text || "";
            const rAvatar = reply.avatar || "images/fish_logo.webp";
            // 雙擊／長按回覆者可以封鎖（匿名的 member_id 是 null，會提示無法封鎖）
            const rBlockAttrs = `data-block-id="${escapeHTML(String(reply.member_id ?? ""))}" data-block-name="${escapeHTML(rAuthor)}"`;
            commentRawContent.set(String(reply.id), rContent);

            repliesHtml += `
                            <div class="ocean-reply-item">
                                <div class="reply-header">
                                    <img src="${rAvatar}" class="reply-avatar" ${rBlockAttrs}>
                                    <span class="reply-author" ${rBlockAttrs}>${escapeHTML(rAuthor)}</span>
                                    ${renderCommentFollowBtn(reply.member_id, rAuthor)}
                                    ${reply.edited_at ? '<span class="comment-edited-tag">已編輯</span>' : ""}
                                </div>
                                <div class="reply-body md-content" data-comment-body="${escapeHTML(String(reply.id))}">${renderMarkdown(rContent)}</div>
                                ${renderOwnCommentActions(reply)}
                            </div>
                        `;
          });
        }

        const showCommentTime =
          localStorage.getItem("setting_show_comment_time") !== "false";

        const rawTime = c.createdAt || c.created_at || c.time;
        let formattedTime = "";
        if (rawTime) {
          const dateObj = new Date(rawTime);
          formattedTime = !isNaN(dateObj)
            ? dateObj.toLocaleString("zh-TW", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : String(rawTime);
        }
        const timeHtml =
          showCommentTime && formattedTime
            ? `<span class="comment-time-text">${formattedTime}</span>`
            : "";

        // 🗑️ 作者刪掉、但底下還有回覆的留言：只留位置，讓回覆照常顯示
        if (c.is_deleted) {
          html += `
                    <div class="ocean-comment-card is-deleted">
                        <div class="comment-header">
                            <span class="comment-deleted-text">🗑️ 這則留言已刪除</span>
                            <span class="comment-floor">B${index + 1}</span>
                        </div>
                        <div class="reply-container">
                            ${repliesHtml}
                        </div>
                    </div>
                `;
          return;
        }

        html += `
                    <div class="ocean-comment-card">
                        <div class="comment-header">
                          <div class="comment-author-wrap">
                            <span class="comment-author" data-block-id="${escapeHTML(String(c.member_id ?? ""))}" data-block-name="${escapeHTML(authorName)}">
                                <img src="${avatar}" class="comment-avatar">
                                ${escapeHTML(authorName)}
                                ${timeHtml}
                            </span>
                            ${c.edited_at ? '<span class="comment-edited-tag">已編輯</span>' : ""}
                            ${renderCommentFollowBtn(c.member_id, authorName)}
                          </div>
                            <span class="comment-floor">B${index + 1}</span>
                        </div>
                        <div class="comment-body md-content" data-comment-body="${escapeHTML(String(commentId))}">${renderMarkdown(content)}</div>

                        <div class="reply-container" style="${repliesHtml ? "" : "display: none;"}">
                            ${repliesHtml}
                        </div>

                        <div class="comment-actions">
                            <span class="action-btn reply-trigger" onclick="toggleReplyBox('${commentId}')">
                                💬 回覆
                            </span>
                            <span id="comment-like-btn-${commentId}" class="action-btn like-trigger" style="color: ${isLiked ? "#e74c3c" : "#999"};" onclick="toggleCommentLike('${postId}', '${commentId}')">
                                ${isLiked ? "❤️" : "🤍"} ${likesCount}
                            </span>
                            ${renderOwnCommentActions(c, true)}
                        </div>

                        <div id="reply-box-${commentId}" class="reply-input-box" style="display: none;">
                            ${mdMiniHelperHtml()}
                            <div class="reply-input-wrapper">
                                <textarea id="reply-input-${commentId}" rows="1" placeholder="${withNewlineHint("偷偷回覆他一點溫暖...")}" class="custom-reply-input" autocomplete="off" enterkeyhint="enter"></textarea>
                                <label class="anon-label">
                                    <input type="checkbox" id="reply-anon-${commentId}"> 🎭 匿名
                                </label>
                                <button onclick="submitReply('${postId}', '${commentId}')" class="send-btn mini-send-btn">送出</button>
                            </div>
                        </div>
                    </div>
                `;
      });
      listContainer.innerHTML = html;
    });

    counts.forEach((countSpan) => {
      if (countSpan) countSpan.innerText = comments.length;
    });

    const p = posts.find((x) => String(x.id) === String(postId));
    if (p) {
      p.msgs = comments.length;
      applyFilters();
    }
  } catch (error) {
    console.error("無法獲取留言:", error);
    lists.forEach((listContainer) => {
      listContainer.innerHTML =
        '<div style="text-align:center; color:#ef4444; padding: 30px 0;">哎呀，讀取留言失敗了，請稍後再試！😿</div>';
    });
  }
};

window.submitComment = async function () {
  const inputs = document.querySelectorAll("#new-comment-input");
  let targetInput = null;

  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].offsetParent !== null) {
      targetInput = inputs[i];
      break;
    }
  }

  if (!targetInput) return;
  const text = targetInput.value.trim();

  if (!text) {
    alert("請輸入溫暖的留言內容喔！");
    return;
  }

  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("寶寶，要先登入才能留言喔！");
    return;
  }

  const mainAnonCheckbox = document.getElementById("main-comment-anon");
  const isAnon = mainAnonCheckbox ? mainAnonCheckbox.checked : false;

  try {
    const response = await fetch(
      `${API_BASE_URL}/comments/bottles/${currentOpenPostId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          content: text,
          isAnonymous: isAnon,
        }),
      },
    );

    if (response.ok) {
      targetInput.value = "";
      autoGrowTextarea(targetInput);
      refreshMiniPreview(targetInput);
      if (mainAnonCheckbox) mainAnonCheckbox.checked = false;

      alert(isAnon ? "✨ 匿名留言已悄悄送出！" : "✨ 留言成功傳達囉！");

      await renderComments(currentOpenPostId);
      const detailView = document.getElementById("detail-view");
      if (detailView && detailView.offsetParent !== null) {
        const scrollBody = document.querySelector(".detail-scroll-body");
if (scrollBody) {
  scrollBody.scrollTo({
    top: scrollBody.scrollHeight,
    behavior: "smooth",
  });
}
      }
    } else {
      const err = await response.json();
      alert(`留言失敗：${err.message || "伺服器錯誤"}`);
    }
  } catch (error) {
    console.error("發送留言失敗:", error);
    alert("伺服器連線失敗，請稍後再試 😢");
  }
};

window.toggleReplyBox = function (commentId) {
  const box = document.getElementById(`reply-box-${commentId}`);
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
    if (box.style.display === "block") {
      const input = document.getElementById(`reply-input-${commentId}`);
      if (input) input.focus();
    }
  }
};

window.submitReply = async function (bottleId, parentId) {
  const replyInput = document.getElementById(`reply-input-${parentId}`);
  if (!replyInput) return;

  const text = replyInput.value.trim();
  if (!text) {
    alert("寶寶，要先打點字才能回覆別人喔！📝");
    return;
  }

  const isAnon =
    document.getElementById(`reply-anon-${parentId}`)?.checked || false;
  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("哎呀！要先登入才能回覆喔！");
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/comments/bottles/${bottleId}/comments/${parentId}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ content: text, isAnonymous: isAnon }),
      },
    );

    if (response.ok) {
      replyInput.value = "";
      alert(isAnon ? "✨ 匿名回覆已悄悄送出！" : "✨ 回覆成功傳達囉！");
      await renderComments(bottleId);
    } else {
      const err = await response.json();
      alert(`回覆失敗：${err.message || "深海電波干擾中，請稍後再試"}`);
    }
  } catch (error) {
    console.error("發送子留言失敗:", error);
    alert("伺服器開小差了，回覆失敗請稍後再試 😢");
  }
};

window.toggleCommentLike = async function (postId, commentId) {
  const token = localStorage.getItem("authToken");

  if (!token) {
    alert("寶寶，要先登入才能幫留言按讚喔！");
    window.location.href = "login.html";
    return;
  }

  if (!commentId || commentId === "undefined" || commentId === "null") {
    alert("找不到這則留言的 ID，可能是後端沒有回傳正確的欄位名稱唷 😢");
    return;
  }

  const likeBtn = document.getElementById(`comment-like-btn-${commentId}`);
  let currentLikes = 0;
  let isCurrentlyLiked = false;

  if (likeBtn) {
    const text = likeBtn.innerText;
    isCurrentlyLiked = text.includes("❤️");
    currentLikes = parseInt(text.replace(/[^0-9]/g, "")) || 0;

    if (isCurrentlyLiked) {
      likeBtn.innerHTML = `🤍 ${Math.max(0, currentLikes - 1)}`;
      likeBtn.style.color = "#999";
    } else {
      likeBtn.innerHTML = `❤️ ${currentLikes + 1}`;
      likeBtn.style.color = "#e74c3c";
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/comments/${commentId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      const err = await response.json();
      alert(`按讚失敗：${err.message || "伺服器錯誤"}`);
      if (likeBtn) {
        likeBtn.innerHTML = isCurrentlyLiked
          ? `❤️ ${currentLikes}`
          : `🤍 ${currentLikes}`;
        likeBtn.style.color = isCurrentlyLiked ? "#e74c3c" : "#999";
      }
    }
  } catch (error) {
    console.error("留言按讚處理失敗:", error);
    alert("伺服器開小差了，按讚失敗請稍後再試 😢");
    if (likeBtn) {
      likeBtn.innerHTML = isCurrentlyLiked
        ? `❤️ ${currentLikes}`
        : `🤍 ${currentLikes}`;
      likeBtn.style.color = isCurrentlyLiked ? "#e74c3c" : "#999";
    }
  }
};
// =========================================

window.openPostDetail = function (id) {
  const p = posts.find((x) => String(x.id) === String(id));
  if (!p) return;

  currentOpenPostId = id;
  currentAuthorId = p.authorId; // 儲存作者 ID 供追蹤功能使用

  document
    .querySelectorAll("#detail-board-tag")
    .forEach((el) => (el.innerText = p.board));
  document
    .querySelectorAll("#detail-author-tag")
    .forEach((el) => (el.innerText = p.author || "匿名"));
  document
    .querySelectorAll("#detail-post-title")
    .forEach(
      (el) =>
        (el.innerHTML = highlightText(escapeHTML(p.title), currentKeyword)),
    );
  document
    .querySelectorAll("#detail-post-content")
    .forEach(
      (el) => {
        el.classList.add("md-content");
        el.innerHTML = renderMarkdown(p.desc, currentKeyword);
      },
    );

  // 判斷是否顯示追蹤按鈕與即時同步「已追蹤/未追蹤」狀態
  const followBtn = document.getElementById("follow-author-btn");
  const isAnonymous = p.author === "匿名" || !p.authorId;

  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const isSelf =
    p.authorId &&
    String(p.authorId) === String(currentUser.id || currentUser.userId);
  const allowFollowSetting =
    localStorage.getItem("setting_allow_follow") !== "false";
  const isFollowAllowed =
    p.allow_follow !== undefined
      ? p.allow_follow
      : isSelf
        ? allowFollowSetting
        : true;

  if (followBtn) {
    if (isAnonymous || !isFollowAllowed || isSelf) {
      followBtn.style.display = "none";
    } else {
      followBtn.style.display = "inline-block";

      // 🌟 自動根據全域名單檢查此作者是否已被追蹤
      const isAlreadyFollowed = window._myFollowingIdSet.has(
        String(currentAuthorId),
      );
      if (isAlreadyFollowed) {
        followBtn.classList.add("following");
        followBtn.innerHTML = "<span>已追蹤</span>";
      } else {
        followBtn.classList.remove("following");
        followBtn.innerHTML = "+ 追蹤";
      }
    }
  }

  document.querySelectorAll(".detail-post-time").forEach((el) => {
    if (p.createdAt) {
      const date = new Date(p.createdAt);
      el.innerText = date.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      el.innerText = "剛剛發布";
    }
  });

  // 🌟 渲染此文章的投票卡片
  renderPollWidget(p);

  renderComments(id);document.body.classList.add("in-detail-view");


  const saveBtn = document.getElementById("save-bottle-btn");
  if (saveBtn) {
    if (p.saved) {
      saveBtn.classList.add("active");
    } else {
      saveBtn.classList.remove("active");
    }
    saveBtn.onclick = (e) => {
      saveBtn.classList.toggle("active");
      toggleAction(id, "save", e);
    };
  }

  const feedView = document.getElementById("feed-view");
  const detailView = document.getElementById("detail-view");
  const sidebar = document.querySelector(".sidebar");
  const oceanBtn = document.querySelector(".ocean-refresh-btn");

  if (feedView && detailView) {
    feedView.style.display = "none";
    detailView.style.display = "block";
    if (sidebar) sidebar.style.setProperty("display", "none", "important");
    if (oceanBtn) oceanBtn.style.setProperty("display", "none", "important");
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.classList.add("in-detail-view");
  }

  afterOpenPostDetail(p);
};

window.closePostDetail = function () {
  const feedView = document.getElementById("feed-view");
  const detailView = document.getElementById("detail-view");
  const sidebar = document.querySelector(".sidebar");
  const oceanBtn = document.querySelector(".ocean-refresh-btn");

  if (feedView && detailView) {
    detailView.style.display = "none";
    feedView.style.display = "block";
    if (sidebar) sidebar.style.setProperty("display", "block", "important");
    if (oceanBtn) oceanBtn.style.setProperty("display", "block", "important");
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.classList.remove("in-detail-view");
  }
};

window.openReportModal = function () {
  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("寶寶，要先登入才能檢舉喔！");
    window.location.href = "login.html";
    return;
  }
  document.getElementById("report-reason").value = "";
  document.getElementById("report-modal").style.display = "block";
};

window.closeReportModal = function () {
  document.getElementById("report-modal").style.display = "none";
};

window.submitReport = async function () {
  const reason = document.getElementById("report-reason").value.trim();
  if (!reason) {
    alert("請告訴我們檢舉的原因唷！");
    return;
  }

  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/bottles/${currentOpenPostId}/report`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ reason: reason }),
      },
    );

    if (response.ok) {
      alert("🚨 檢舉已成功送出，我們會盡快處理！謝謝你的回報！");
      closeReportModal();
    } else {
      const err = await response.json();
      alert(`檢舉失敗：${err.message || "伺服器錯誤"}`);
    }
  } catch (error) {
    console.error("檢舉發生錯誤", error);
    alert("伺服器連線失敗，請稍後再試 😢");
  }
};

window.toggleAction = async function (id, actionType, e) {
  e.stopPropagation();
  const token = localStorage.getItem("authToken");

  if (!token) {
    alert("請先登入才能操作喔！");
    window.location.href = "login.html";
    return;
  }

  const p = posts.find((x) => String(x.id) === String(id));
  if (!p) return;

  if (actionType === "like") {
    if (p.liked) {
      p.likes = Math.max(0, p.likes - 1);
      p.liked = false;
    } else {
      p.likes++;
      p.liked = true;
    }
  } else if (actionType === "save") {
    p.saved = !p.saved;
  }

  applyFilters();

  try {
    const endpoint =
      actionType === "like" ? `/bottles/${id}/like` : `/bottles/${id}/save`;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) throw new Error(`後端回傳錯誤碼: ${response.status}`);
  } catch (error) {
    console.error(`${actionType} 動作失敗:`, error);
    if (actionType === "like") {
      if (p.liked) {
        p.likes = Math.max(0, p.likes - 1);
        p.liked = false;
      } else {
        p.likes++;
        p.liked = true;
      }
    } else if (actionType === "save") {
      p.saved = !p.saved;
    }
    applyFilters();
    alert("伺服器開小差了，操作失敗請稍後再試 😢");
  }
};

window.deleteMyBottle = async function (id, e) {
  e.stopPropagation();
  if (!confirm("⚠️ 確定要刪除這個漂流瓶嗎？刪除後無法恢復喔！")) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    alert("請先登入！");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bottles/${id}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      alert("✅ 漂流瓶已成功刪除！");
      fetchBottles();
    } else {
      const err = await response.json();
      alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤"));
    }
  } catch (error) {
    console.error("刪除失敗:", error);
    alert("伺服器連線失敗，請稍後再試 😢");
  }
};

function setupAuth() {
  const loginTrigger = document.getElementById("login-trigger");
  const openHubBtn = document.getElementById("open-hub-btn");
  const identitySelect = document.getElementById("post-identity");
  const userDropdown = document.getElementById("user-dropdown");

  function updateUI() {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const token = localStorage.getItem("authToken");

    // 🌟 管理員不能發文：加上 is-admin 讓 CSS 隱藏所有發文入口
    document.body.classList.toggle(
      "is-admin",
      Boolean(token && user && user.role === "ADMIN"),
    );

    if (user && Object.keys(user).length > 0 && token) {
      if (loginTrigger) loginTrigger.style.display = "none";
      if (openHubBtn) openHubBtn.style.display = "inline-flex";

      fetchNotificationCount();
      syncMyFollowingList();

      const displayName =
        user.name || (user.email ? user.email.split("@")[0] : "用戶");

      // 同步探索中心彈窗內的大頭貼與名字
      const userNameEl = document.getElementById("user-name");
      if (userNameEl) userNameEl.innerText = displayName;

      const userAvatarEl = document.getElementById("user-avatar");
      if (user && user.avatar && userAvatarEl) userAvatarEl.src = user.avatar;

      if (identitySelect) {
        identitySelect.options[0].text = `實名 (${displayName})`;
        identitySelect.options[0].value = displayName;
      }

      if (user.role === "ADMIN" && userDropdown) {
        if (!document.getElementById("admin-link-item")) {
          const adminLink = document.createElement("div");
          adminLink.id = "admin-link-item";
          adminLink.className = "menu-item";
          adminLink.style.color = "#e74c3c";
          adminLink.style.fontWeight = "bold";
          adminLink.style.borderTop = "1px solid #eee";
          adminLink.innerHTML = "🛠️ 進入後台";
          adminLink.onclick = (e) => {
            e.stopPropagation();
            window.location.href = "admin.html";
          };
          userDropdown.insertBefore(adminLink, userDropdown.lastElementChild);
        }

        // 📱 手機版「更多」選單也要有後台入口（放在分隔線上面）
        const hubDropdown = document.getElementById("hub-user-dropdown");
        if (hubDropdown && !document.getElementById("hub-admin-link-item")) {
          const hubLogout = hubDropdown.querySelector(".logout-item");
          const hubAdminLink = document.createElement("div");
          hubAdminLink.id = "hub-admin-link-item";
          hubAdminLink.className = "menu-item";
          hubAdminLink.style.cssText =
            "padding: 10px 18px; color: #e74c3c !important; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;";
          hubAdminLink.innerHTML =
            '🛠️ <span style="color: #e74c3c !important">進入後台</span>';
          hubAdminLink.onclick = (e) => {
            e.stopPropagation();
            window.location.href = "admin.html";
          };
          // 登出前面有一條分隔線，後台入口插在分隔線之前
          const anchor = hubLogout ? hubLogout.previousElementSibling : null;
          if (anchor && anchor.parentElement === hubDropdown) {
            hubDropdown.insertBefore(hubAdminLink, anchor);
          } else {
            hubDropdown.appendChild(hubAdminLink);
          }
        }
      }
    } else {
      if (loginTrigger) loginTrigger.style.display = "block";
      const userNameEl = document.getElementById("user-name");
      if (userNameEl) userNameEl.innerText = "請先登入";
    }
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("authToken");
      window._myFollowingIdSet.clear();
      updateUI();
      window.location.href = "login.html";
    };
  }
  updateUI();
}

function isAdminUser() {
  const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
  return user.role === "ADMIN";
}
window.isAdminUser = isAdminUser;

function setupNewPost() {
  const form = document.getElementById("new-post-form");
  const btnNewPost = document.getElementById("btn-new-post");
  const closePostModal = document.getElementById("close-post-modal");
  const postModal = document.getElementById("post-modal");

  if (btnNewPost) {
    btnNewPost.onclick = () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        alert("請先登入才能發文喔！");
        window.location.href = "login.html";
        return;
      }
      if (isAdminUser()) {
        alert("管理員帳號無法發文，請切換至一般帳號發文");
        return;
      }
      if (postModal) {
        postModal.style.setProperty("display", "flex", "important");
      }
    };
  }

  if (closePostModal && postModal) {
    closePostModal.onclick = () => {
      postModal.style.setProperty("display", "none", "important");
    };
  }

  if (postModal) {
    postModal.onclick = (e) => {
      if (e.target === postModal) {
        postModal.style.setProperty("display", "none", "important");
      }
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const token = localStorage.getItem("authToken");
      if (!token) {
        alert("請先登入才能拋出漂流瓶！");
        return;
      }

      const title = document.getElementById("post-title-input").value;
      const content = document.getElementById("post-content-input").value;
      const identity = document.getElementById("post-identity").value;
      const isAnonymous = identity === "匿名";

      // 🌟 讀取投票設定
      const pollContainer = document.getElementById("poll-inputs-container");
      let pollData = null;
      if (pollContainer && pollContainer.style.display !== "none") {
        const inputs = pollContainer.querySelectorAll(".poll-opt-input");
        const validOptions = Array.from(inputs)
          .map((i) => i.value.trim())
          .filter((t) => t.length > 0);

        if (validOptions.length < 2) {
          alert("建立投票至少需要填寫 2 個選項喔！");
          return;
        }

        pollData = validOptions;
      }

      const boardSelect = form.querySelector("#post-board");
      const boardValue = boardSelect ? boardSelect.value : "";
      const selectedCategoryId = Number(boardValue);
      const categoryPayload =
        boardValue !== "" && !isNaN(selectedCategoryId)
          ? [selectedCategoryId]
          : [];

      if (categoryPayload.length === 0) {
        alert("發文失敗：請確實選擇一個海域 (分類)！");
        return;
      }

      const postData = {
        title: title,
        content: content,
        isAnonymous: isAnonymous,
        category_id: categoryPayload,
        ...(pollData && { pollOptions: pollData }),
      };

      try {
        const response = await fetch(`${API_BASE_URL}/bottles`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify(postData),
        });

        if (response.ok) {
          alert("漂流瓶拋出成功！🎉");
          form.reset();
          document.getElementById("post-modal").style.display = "none";
          fetchBottles();
        } else {
          const err = await response.json();
          alert(
            `發文失敗 (狀態碼: ${response.status})：\n${err.message || "未知錯誤"}`,
          );
        }
      } catch (error) {
        console.error("連線錯誤:", error);
        alert("無法連線至伺服器，請檢查網路或後端是否啟動。");
      }
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const mascotHome = document.createElement("div");
  mascotHome.id = "mascot-home";
  mascotHome.title = "把小助理拖進來休息，點擊再叫牠起床喔！";
  document.body.appendChild(mascotHome);

  syncMyFollowingList(); // 🌟 頁面啟動時自動拉取追蹤名單

  let isSleeping = false;
  if (window.location.pathname.includes("saved.html")) {
    currentView = "saved";
    currentPage = 1;
  } else if (window.location.pathname.includes("post.html")) {
    currentView = "mine";
    currentPage = 1;
  } else {
    currentView = "all";
  }

  document.querySelectorAll(".sidebar li").forEach((li) => {
    li.classList.remove("active");
    const liText = li.innerText.trim();
    if (liText.includes(currentBoard)) {
      li.classList.add("active");
    }
  });

  setupAuth();
  setupNewPost();
  fetchBottles();

  setInterval(() => {
    const detailView = document.getElementById("detail-view");
    if (detailView && detailView.style.display !== "block" && !window.isIdleScreenOn) {
      callOceanCurrent();
    }
  }, 60000);

  const searchInput = document.getElementById("main-search-input");
  const historyBox = document.getElementById("search-history-dropdown");
  const clearBtn = document.getElementById("clear-search-btn");

  const debouncedSearch = debounce(() => {
    fetchBottles();
  }, 300);

  if (searchInput && historyBox) {
    searchInput.oninput = (e) => {
      currentKeyword = e.target.value.toLowerCase().trim();
      currentPage = 1;
      if (clearBtn) clearBtn.style.display = currentKeyword ? "block" : "none";
      debouncedSearch();
      renderSearchHistory();
      historyBox.style.width = searchInput.offsetWidth + "px";
      historyBox.style.left = searchInput.offsetLeft + "px";
    };
    searchInput.onfocus = () => {
      renderSearchHistory();
      historyBox.style.width = searchInput.offsetWidth + "px";
      historyBox.style.left = searchInput.offsetLeft + "px";
    };
    searchInput.onblur = () => {
      setTimeout(() => {
        historyBox.style.display = "none";
      }, 200);
    };
    searchInput.onkeydown = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") {
        saveSearchHistory(searchInput.value.trim());
        historyBox.style.display = "none";
        searchInput.blur();
      }
    };
  }

  if (clearBtn && searchInput) {
    clearBtn.onclick = () => {
      searchInput.value = "";
      currentKeyword = "";
      clearBtn.style.display = "none";
      currentPage = 1;
      fetchBottles();
      searchInput.focus();
    };
  }

  const commentInputs = document.querySelectorAll("#new-comment-input");
  commentInputs.forEach((input) => {
    input.setAttribute("name", "user_comment_history");
    input.setAttribute("autocomplete", "off");
    const wrapper = input.parentElement;

    if (
      wrapper &&
      wrapper.tagName.toLowerCase() === "div" &&
      wrapper.classList.contains("comment-action-bar")
    ) {
      const form = document.createElement("form");
      form.style.cssText = wrapper.style.cssText;
      form.className = wrapper.className;
      form.onsubmit = (e) => {
        e.preventDefault();
        submitComment();
      };
      while (wrapper.firstChild) {
        form.appendChild(wrapper.firstChild);
      }
      wrapper.parentNode.replaceChild(form, wrapper);

      const btn = form.querySelector(".send-btn");
      if (btn) {
        btn.type = "submit";
        btn.removeAttribute("onclick");
      }
    }
  });

  document.querySelectorAll(".sidebar li").forEach(
    (li) =>
      (li.onclick = (e) => {
        document
          .querySelectorAll(".sidebar li")
          .forEach((el) => el.classList.remove("active"));
        e.target.classList.add("active");

        const liText = e.target.innerText.trim();
        currentBoard = liText.substring(2).trim();

        currentCategoryId =
          BOARD_CATEGORY_MAP[liText] !== undefined
            ? BOARD_CATEGORY_MAP[liText]
            : 1;
        currentPage = 1;

        sessionStorage.setItem("savedCategoryId", currentCategoryId);
        sessionStorage.setItem("savedBoard", currentBoard);

        closePostDetail();
        fetchBottles();
      }),
  );

  const loginTrigger = document.getElementById("login-trigger");
  if (loginTrigger)
    loginTrigger.onclick = () => {
      window.location.href = "login.html";
    };

  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");
  if (userMenuBtn && userDropdown) {
    userMenuBtn.onclick = (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("show-dropdown");
    };
  }

  window.onclick = (event) => {
    if (userDropdown) userDropdown.classList.remove("show-dropdown");
    const reportModal = document.getElementById("report-modal");
    if (reportModal && event.target == reportModal)
      reportModal.style.display = "none";
    const postModal = document.getElementById("post-modal");
    const profileModal = document.getElementById("profile-modal");
    const followingModal = document.getElementById("following-modal");
    const settingsModal = document.getElementById("settings-modal");
    if (profileModal && event.target == profileModal)
      profileModal.style.display = "none";
    if (postModal && event.target == postModal)
      postModal.style.display = "none";
    // 走 closeFollowingModal，從動態消息進來的才會退回動態消息
    if (followingModal && event.target == followingModal) closeFollowingModal();
    if (settingsModal && event.target == settingsModal)
      settingsModal.style.display = "none";
  };

  const profileModal = document.getElementById("profile-modal");
  const profileMenuItem = document.getElementById("open-profile");

  if (profileMenuItem) {
    profileMenuItem.onclick = (e) => {
      e.stopPropagation();
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (user) {
        document.getElementById("detail-name").innerText =
          user.name || "未設定姓名";
        document.getElementById("detail-email").innerText = user.email;
        document.getElementById("detail-birthday").innerText = user.birthday
          ? user.birthday.split("T")[0]
          : "未填寫";
        document.getElementById("detail-gender").innerText =
          user.gender || "未填寫";
        document.getElementById("detail-zodiac").innerText =
          user.zodiac || user.constellation || "未填寫";
        renderBio(document.getElementById("detail-bio"), user.bio);
        document.getElementById("profile-view-mode").style.display = "block";
        document.getElementById("profile-edit-mode").style.display = "none";
        profileModal.style.display = "block";
      } else {
        alert("請先登入！");
      }
    };
  }

  const btnEditProfile = document.getElementById("btn-edit-profile");
  const btnCancelEdit = document.getElementById("btn-cancel-edit");
  const btnSaveProfile = document.getElementById("btn-save-profile");
  const editBirthdayInput = document.getElementById("edit-birthday");
  const editZodiacSelect = document.getElementById("edit-zodiac");

  if (editBirthdayInput && editZodiacSelect) {
    editBirthdayInput.addEventListener("change", (e) => {
      const dateStr = e.target.value;
      if (dateStr) {
        const dateObj = new Date(dateStr);
        editZodiacSelect.value = calculateZodiac(
          dateObj.getMonth() + 1,
          dateObj.getDate(),
        );
      }
    });
  }

  if (btnEditProfile) {
    btnEditProfile.onclick = () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user) return;
      document.getElementById("edit-name").value = user.name || "";
      document.getElementById("edit-email").value = user.email || "";
      document.getElementById("edit-birthday").value = user.birthday
        ? user.birthday.split("T")[0]
        : "";
      document.getElementById("edit-gender").value = user.gender || "未填寫";
      document.getElementById("edit-zodiac").value =
        user.zodiac || user.constellation || "未填寫";
      document.getElementById("edit-bio").value = user.bio || "";
      document.getElementById("profile-view-mode").style.display = "none";
      document.getElementById("profile-edit-mode").style.display = "block";
    };
  }

  if (btnCancelEdit) {
    btnCancelEdit.onclick = () => {
      document.getElementById("profile-edit-mode").style.display = "none";
      document.getElementById("profile-view-mode").style.display = "block";
    };
  }

  if (btnSaveProfile) {
    btnSaveProfile.onclick = async () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user) return;

      const newName = document.getElementById("edit-name").value.trim();
      if (!newName) {
        alert("寶寶，姓名不能空白唷！");
        return;
      }

      user.name = newName;
      user.birthday = document.getElementById("edit-birthday").value;
      user.gender = document.getElementById("edit-gender").value;
      user.zodiac = document.getElementById("edit-zodiac").value;
      user.constellation = user.zodiac;
      user.bio = document.getElementById("edit-bio").value.trim();

      const token = localStorage.getItem("authToken");

      try {
        fetch(`${API_BASE_URL}/auth/update-data`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            name: user.name,
            birthday: user.birthday,
            constellation: user.zodiac,
            bio: user.bio,
          }),
        }).catch((e) => console.log("API 更新稍有延遲", e));

        localStorage.setItem("currentUser", JSON.stringify(user));

        document.getElementById("detail-name").innerText = user.name;
        document.getElementById("detail-birthday").innerText =
          user.birthday || "未填寫";
        document.getElementById("detail-gender").innerText =
          user.gender || "未填寫";
        document.getElementById("detail-zodiac").innerText =
          user.zodiac || "未填寫";
        renderBio(document.getElementById("detail-bio"), user.bio);
        const userNameEl = document.getElementById("user-name");
        if (userNameEl) userNameEl.innerText = user.name;

        document.getElementById("profile-edit-mode").style.display = "none";
        document.getElementById("profile-view-mode").style.display = "block";
        alert("🎉 資料修改成功！");
      } catch (error) {
        console.error("更新發生錯誤", error);
        alert("哎呀，好像出了一點小錯，請再試一次喔！");
      }
    };
  }

  const closeProfileBtn = document.getElementById("close-profile-modal");
  if (closeProfileBtn)
    closeProfileBtn.onclick = () => (profileModal.style.display = "none");
});

window.callOceanCurrent = function () {
  const bottles = document.querySelectorAll(".post-card");
  bottles.forEach((bottle, index) => {
    setTimeout(() => {
      bottle.classList.add("swept-away");
    }, index * 100);
  });
  setTimeout(() => {
    fetchBottles();
  }, 1000);
};

function renderPagination(totalPages, dataArray) {
  const pageContainer = document.getElementById("pagination-container");
  if (!pageContainer) return;
  pageContainer.innerHTML = "";
  if (totalPages <= 1) return;

  const prevBtn = document.createElement("button");
  prevBtn.className = "page-btn";
  prevBtn.innerText = "◀";
  prevBtn.title = "上一頁";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    renderPosts(dataArray);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  pageContainer.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = `page-btn ${i === currentPage ? "active" : ""}`;
    pageBtn.innerText = i;
    pageBtn.title = `第 ${i} 頁`;
    pageBtn.onclick = () => {
      currentPage = i;
      renderPosts(dataArray);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    pageContainer.appendChild(pageBtn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "page-btn";
  nextBtn.innerText = "▶";
  nextBtn.title = "下一頁";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderPosts(dataArray);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  pageContainer.appendChild(nextBtn);

  const jumpContainer = document.createElement("div");
  jumpContainer.style.display = "inline-flex";
  jumpContainer.style.alignItems = "center";
  jumpContainer.style.marginLeft = "4px";

  const jumpBtn = document.createElement("button");
  jumpBtn.className = "page-btn ocean-jump-btn";
  jumpBtn.innerText = "🔢";
  jumpBtn.title = `點擊手動輸入頁碼跳頁 (共 ${totalPages} 頁)`;
  jumpBtn.style.fontSize = "1.05rem";

  jumpBtn.onclick = () => {
    jumpContainer.innerHTML = `
            <input type="text" id="ocean-jump-input" value="${currentPage}" placeholder="1~${totalPages}" title="請輸入 1 ~ ${totalPages} 頁碼"
                style="width: 44px; height: 35px; text-align: center; border: 2px solid #4da6ff; border-radius: 18px; font-weight: bold; color: #0055a5; background: rgba(255,255,255,0.95); outline: none; font-size: 0.95rem; box-shadow: 0 0 12px rgba(77, 166, 255, 0.6); box-sizing: border-box;" />
        `;
    const input = document.getElementById("ocean-jump-input");
    if (!input) return;
    input.focus();
    input.select();

    let isSubmitted = false;
    let isAlerting = false;

    const handleJumpSubmit = () => {
      if (isSubmitted) return;
      const val = input.value.trim();
      const pageNum = Number(val);

      if (
        !val ||
        !/^\d+$/.test(val) ||
        isNaN(pageNum) ||
        pageNum < 1 ||
        pageNum > totalPages
      ) {
        isAlerting = true;
        alert(`請輸入正確的頁碼（範圍 1 ~ ${totalPages}）`);
        isAlerting = false;
        input.focus();
        input.select();
        return;
      }

      isSubmitted = true;
      currentPage = pageNum;
      renderPosts(dataArray);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleJumpSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        renderPagination(totalPages, dataArray);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (isSubmitted || isAlerting) return;
        const val = input.value.trim();
        const pageNum = Number(val);
        if (
          val &&
          /^\d+$/.test(val) &&
          !isNaN(pageNum) &&
          pageNum >= 1 &&
          pageNum <= totalPages
        ) {
          if (pageNum !== currentPage) {
            isSubmitted = true;
            currentPage = pageNum;
            renderPosts(dataArray);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
        }
        renderPagination(totalPages, dataArray);
      }, 150);
    });
  };

  jumpContainer.appendChild(jumpBtn);
  pageContainer.appendChild(jumpContainer);
}

document.addEventListener("DOMContentLoaded", () => {
  const mascotContainer = document.createElement("div");
  mascotContainer.id = "svg-mermecat-mascot";
  mascotContainer.title = "點擊我去找 AI 小助理聊天！";

  mascotContainer.innerHTML = `
        <div class="svg-mermecat-wrapper">
            <!-- 🌟 1. 醒著游泳的吉祥物 -->
            <svg id="awake-mascot" width="130" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .line { stroke: #1a4c6d; stroke-width: 3.5; stroke-linejoin: round; stroke-linecap: round; }
                    .tail { fill: #7ac2c4; }
                    .fin { fill: #50b4ba; }
                    .cat { fill: #fcfdfe; }
                    .red-line { stroke: #b83e33; stroke-width: 3.5; stroke-linecap: round; fill: none; }
                    .blush { fill: #ffbaba; }
                    .bubble { fill: #e0f2f5; stroke: #1a4c6d; stroke-width: 2.5; }
                    .dolphin-body { fill: #9bcbf1; } 
                    .cat-paw { fill: #fcfdfe; }     
                    @keyframes paw-wave {
                        0% { transform: rotate(0deg); }
                        20% { transform: rotate(-12deg); }
                        40% { transform: rotate(8deg); }
                        60% { transform: rotate(-10deg); }
                        80% { transform: rotate(6deg); }
                        100% { transform: rotate(0deg); }
                    }
                    .wave-animation {
                        animation: paw-wave 1.8s infinite ease-in-out;
                        transform-origin: 75px 48px; 
                    }
                </style>
                <circle cx="15" cy="25" r="4.5" class="bubble"><animate attributeName="cy" values="25;20;25" dur="3s" repeatCount="indefinite"/></circle>
                <circle cx="22" cy="40" r="2.5" class="bubble"><animate attributeName="cy" values="40;36;40" dur="2s" repeatCount="indefinite"/></circle>
                <circle cx="85" cy="80" r="3.5" class="bubble"><animate attributeName="cy" values="80;75;80" dur="4s" repeatCount="indefinite"/></circle>
                <path d="M 25 75 C 5 70 5 95 18 95 C 15 105 35 100 35 85 Z" class="fin line">
                     <animateTransform attributeName="transform" type="rotate" values="-3 25 85; 3 25 85; -3 25 85" dur="3s" repeatCount="indefinite"/>
                </path>
                <path d="M 20 50 C 15 95 85 95 80 50 Z" class="tail line"/>
                <path d="M 32 65 Q 40 72 48 65 M 52 65 Q 60 72 68 65 M 42 75 Q 50 82 58 75" fill="none" stroke="#1a4c6d" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                <path d="M 22 55 C 20 28 25 25 35 25 L 38 12 L 46 22 L 54 22 L 62 12 L 65 25 C 75 25 80 28 78 55 Z" class="cat line"/>
                <circle cx="38" cy="40" r="4.5" fill="#1a4c6d"/>
                <circle cx="62" cy="40" r="4.5" fill="#1a4c6d"/>
                <ellipse cx="28" cy="44" rx="4.5" ry="3" class="blush"/>
                <ellipse cx="72" cy="44" rx="4.5" ry="3" class="blush"/>
                <path d="M 46 43 Q 50 47 54 43" class="red-line"/>
                <g id="cute-dolphin" transform="translate(33, 46) scale(1.1)">
                    <path d="M 28 16 C 27 12, 25 9, 21 9 C 17 9, 14 5, 13 3 C 12 6, 13 8, 10 10 C 6 12, 3 16, 2 20 C 1 23, 0 26, 1 26 C 3 25, 4 23, 5 22 C 6 24, 8 26, 9 25 C 8 22, 10 20, 11 19 C 16 21, 23 20, 28 16 Z" class="dolphin-body line"/>
                    <path d="M 27.5 16.5 C 22 20, 15 20, 11.5 18.5 C 15 16, 22 15, 27.5 15 Z" fill="#ffffff" stroke="none"/>
                    <path d="M 18 18 C 16 23, 14 25, 16 26 C 18 25, 19 22, 20 18 Z" class="dolphin-body line"/>
                    <circle cx="23" cy="14" r="1.3" fill="#1a4c6d" stroke="none" />
                </g>
                <path d="M 26 63 C 30 67, 36 69, 41 67 C 43 66, 42 62, 39 62 C 35 62, 30 62, 26 62 Z" class="cat-paw line"/>
                <g class="wave-animation">
                    <path d="M 76 48 C 82 45, 85 38, 85 32 C 85 27, 78 27, 76 34 C 75 38, 75 42, 76 48 Z" class="cat-paw line"/>
                    <path d="M 88 28 Q 91 31 89 34" fill="none" stroke="#1a4c6d" stroke-width="2" stroke-linecap="round"/>
                    <path d="M 91 24 Q 95 28 92 32" fill="none" stroke="#1a4c6d" stroke-width="2" stroke-linecap="round"/>
                </g>
            </svg>

            <!-- 💤 2. 睡著的吉祥物 (預設隱藏) -->
            <svg id="sleeping-mascot" width="130" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                <style>
                    @keyframes zzz-float { 0% { transform: translateY(0) scale(0.8); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(-20px) scale(1.2); opacity: 0; } }
                    .zzz { fill: #1a4c6d; font-family: sans-serif; font-weight: bold; font-size: 14px; animation: zzz-float 3s infinite linear; }
                    .zzz-2 { animation-delay: 1.5s; font-size: 10px; }
                </style>
                <circle cx="15" cy="25" r="4.5" class="bubble"><animate attributeName="cy" values="25;22;25" dur="4s" repeatCount="indefinite"/></circle>
                <circle cx="85" cy="80" r="3.5" class="bubble"><animate attributeName="cy" values="80;78;80" dur="5s" repeatCount="indefinite"/></circle>
                
                <path d="M 25 75 C 5 70 5 95 18 95 C 15 105 35 100 35 85 Z" class="fin line" />
                <path d="M 20 50 C 15 95 85 95 80 50 Z" class="tail line"/>
                <path d="M 32 65 Q 40 72 48 65 M 52 65 Q 60 72 68 65 M 42 75 Q 50 82 58 75" fill="none" stroke="#1a4c6d" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                <path d="M 22 55 C 20 28 25 25 35 25 L 38 12 L 46 22 L 54 22 L 62 12 L 65 25 C 75 25 80 28 78 55 Z" class="cat line"/>
                
                <path d="M 32 42 Q 38 46 44 42" fill="none" stroke="#1a4c6d" stroke-width="3" stroke-linecap="round"/>
                <path d="M 56 42 Q 62 46 68 42" fill="none" stroke="#1a4c6d" stroke-width="3" stroke-linecap="round"/>
                
                <ellipse cx="28" cy="46" rx="4.5" ry="3" class="blush"/>
                <ellipse cx="72" cy="46" rx="4.5" ry="3" class="blush"/>

                <g id="cute-dolphin-sleep" transform="translate(33, 46) scale(1.1)">
                    <path d="M 28 16 C 27 12, 25 9, 21 9 C 17 9, 14 5, 13 3 C 12 6, 13 8, 10 10 C 6 12, 3 16, 2 20 C 1 23, 0 26, 1 26 C 3 25, 4 23, 5 22 C 6 24, 8 26, 9 25 C 8 22, 10 20, 11 19 C 16 21, 23 20, 28 16 Z" class="dolphin-body line"/>
                    <path d="M 27.5 16.5 C 22 20, 15 20, 11.5 18.5 C 15 16, 22 15, 27.5 15 Z" fill="#ffffff" stroke="none"/>
                    <path d="M 18 18 C 16 23, 14 25, 16 26 C 18 25, 19 22, 20 18 Z" class="dolphin-body line"/>
                    <path d="M 21 14 Q 23 15.5 25 14" fill="none" stroke="#1a4c6d" stroke-width="1.5" stroke-linecap="round"/>
                </g>
                
                <path d="M 26 63 C 30 67, 36 69, 41 67 C 43 66, 42 62, 39 62 C 35 62, 30 62, 26 62 Z" class="cat-paw line"/>
                <path d="M 74 63 C 70 67, 64 69, 59 67 C 57 66, 58 62, 61 62 C 65 62, 70 62, 74 62 Z" class="cat-paw line"/>

                <text x="75" y="30" class="zzz">Z</text>
                <text x="88" y="18" class="zzz zzz-2">z</text>
            </svg>

            <div class="cute-dialogue" id="mermecat-dialogue"></div>
        </div>
    `;

  document.body.appendChild(mascotContainer);

  const mascotStyle = document.createElement("style");
  mascotStyle.innerHTML = `
        #svg-mermecat-mascot {
            position: fixed; z-index: 99998; width: 130px; height: 140px; cursor: pointer; user-select: none; pointer-events: auto;
            transform: none;
            filter: drop-shadow(0 6px 15px rgba(0, 30, 60, 0.25)); transition: top 8s ease-in-out, left 8s ease-in-out;
        }
        .svg-mermecat-wrapper { position: relative; width: 100%; height: 100%; animation: svg-float 4s infinite alternate ease-in-out; }
        @keyframes svg-float { 0% { transform: translateY(0px) rotate(-1deg); } 100% { transform: translateY(-8px) rotate(1deg); } }
        .cute-dialogue {
            position: absolute; bottom: calc(100% - 5px); left: 50%; transform: translateX(-50%) scale(0.8);
            width: max-content; max-width: 180px; background: #fff; color: #1a4c6d; padding: 10px 16px;
            border: 3.5px solid #1a4c6d; border-radius: 18px; font-size: 0.95rem; font-weight: bold;
            opacity: 0; visibility: hidden; pointer-events: none; transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            z-index: 10000; box-shadow: 2px 4px 0px rgba(26, 76, 109, 0.15); 
        }
        .cute-dialogue.show-dialogue { opacity: 1; visibility: visible; transform: translateX(-50%) scale(1); }
    `;
  document.head.appendChild(mascotStyle);

  const mascot = document.getElementById("svg-mermecat-mascot");
  const AI_ASSISTANT_URL = "./chat_ui/chat.html";
  let currentZone = 0;
  let swimTimer;
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function swimLikeLazyMermaid() {
    if (window.isMascotSleeping) return;

    const padding = 20;
    const currentCatW = mascot.offsetWidth || 80;
    const currentCatH = mascot.offsetHeight || 80;

    const minY = window.innerWidth <= 768 ? 100 : 120;
    const maxY = Math.max(minY + 50, window.innerHeight - currentCatH - 120);
    const minX = padding;
    const maxX = Math.max(
      padding + 50,
      window.innerWidth - currentCatW - padding,
    );

    const borderThickness = window.innerWidth <= 768 ? 60 : 100;

    let targetX, targetY;
    if (currentZone === 0) {
      targetX = minX + Math.random() * (maxX - minX);
      targetY = minY + Math.random() * borderThickness;
    } else if (currentZone === 1) {
      targetX = Math.max(minX, maxX - Math.random() * borderThickness);
      targetY = minY + Math.random() * (maxY - minY);
    } else if (currentZone === 2) {
      targetX = minX + Math.random() * (maxX - minX);
      targetY = Math.max(minY, maxY - Math.random() * borderThickness);
    } else {
      targetX = minX + Math.random() * borderThickness;
      targetY = minY + Math.random() * (maxY - minY);
    }

    targetX = Math.max(minX, Math.min(targetX, maxX));
    targetY = Math.max(minY, Math.min(targetY, maxY));

    // 🌟 轉向翻轉
    const curLeft = parseFloat(mascot.style.left) || 0;
    const mascotSvg = mascot.querySelector("svg");
    if (mascotSvg) {
      mascotSvg.style.transform = targetX < curLeft ? "scaleX(-1)" : "scaleX(1)";
    }

    // 🌟 關鍵修復：先設定慢速平滑過渡（6.5 ~ 9.5 秒），再更新座標
    const duration = 6500 + Math.random() * 3000;
    mascot.style.transition = `top ${duration}ms cubic-bezier(0.35, 0.1, 0.25, 1), left ${duration}ms cubic-bezier(0.35, 0.1, 0.25, 1)`;

    mascot.style.left = `${targetX}px`;
    mascot.style.top = `${targetY}px`;

    if (Math.random() > 0.1) currentZone = (currentZone + 1) % 4;

    swimTimer = setTimeout(swimLikeLazyMermaid, duration + 1000);
  }
  swimTimer = setTimeout(swimLikeLazyMermaid, 100);

  const randomPhrases = [
    "🌊 咕嚕咕嚕... 今天的水溫好舒服喵！",
    "🤫 有什麼秘密想跟我說嗎？",
    "✏️ 把不開心的事丟進瓶子裡吧！",
    "🎵 好像有很多有趣的瓶子呢！",
    "💖 今天過得好嗎？",
    "❔開發者團隊們都不知道我是什麼物種呢!",
    "今天心情像冒泡泡一樣開心！",
    "耶！水溫剛剛好，心情也剛剛好！",
    "看到你就覺得好溫暖喵～",
    "今天的海流超順，運氣一定很好！",
    "呼嚕呼嚕...這是我開心的聲音。",
    "快樂到想在水裡翻三個跟斗！",
  ];
  const dialogueBox = document.getElementById("mermecat-dialogue");
  let dialogueTimer;

  function showRandomDialogue() {
    if (window.isMascotSleeping) return;
    if (dialogueBox.classList.contains("show-dialogue")) return;

    dialogueBox.innerText =
      randomPhrases[Math.floor(Math.random() * randomPhrases.length)];

    // 🌟 智慧邊界計算：動態偵測貓咪相對於螢幕的即時座標
    const rect = mascot.getBoundingClientRect();

    // 1. 上下方向判定：若離頂部小於 125px，對話框改朝貓咪肚子下方冒出，避免被天花板切斷
    if (rect.top < 125) {
      dialogueBox.style.bottom = "auto";
      dialogueBox.style.top = "calc(100% + 8px)";
    } else {
      dialogueBox.style.top = "auto";
      dialogueBox.style.bottom = "calc(100% - 5px)";
    }

    // 2. 左右方向判定：若靠近左右邊界，自動對齊邊緣不破版
    dialogueBox.style.whiteSpace = "normal";
    dialogueBox.style.maxWidth = window.innerWidth <= 768 ? "140px" : "180px";

    if (rect.left < 90) {
      dialogueBox.style.left = "0px";
      dialogueBox.style.right = "auto";
      dialogueBox.style.transform = "scale(1)";
    } else if (window.innerWidth - rect.right < 90) {
      dialogueBox.style.left = "auto";
      dialogueBox.style.right = "0px";
      dialogueBox.style.transform = "scale(1)";
    } else {
      dialogueBox.style.left = "50%";
      dialogueBox.style.right = "auto";
      dialogueBox.style.transform = "translateX(-50%) scale(1)";
    }

    dialogueBox.classList.add("show-dialogue");
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => {
      dialogueBox.classList.remove("show-dialogue");
    }, 4000);
  }
  setTimeout(showRandomDialogue, 2000);
  setInterval(
    () => {
      if (Math.random() > 0.2) showRandomDialogue();
    },
    8000 + Math.random() * 6000,
  );

  const startDrag = (clientX, clientY) => {
    if (window.isMascotSleeping) return;
    isDragging = true;
    hasMoved = false;

    const currentPosition = mascot.getBoundingClientRect();
    clearTimeout(swimTimer);
    mascot.style.transition = "none";
    mascot.style.left = `${currentPosition.left}px`;
    mascot.style.top = `${currentPosition.top}px`;

    startX = clientX;
    startY = clientY;
    initialLeft = currentPosition.left;
    initialTop = currentPosition.top;
  };

  const onDrag = (clientX, clientY) => {
    if (!isDragging) return;
    hasMoved = true;

    const dx = clientX - startX;
    const dy = clientY - startY;

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    newLeft = Math.max(
      0,
      Math.min(newLeft, window.innerWidth - mascot.offsetWidth),
    );
    newTop = Math.max(
      0,
      Math.min(newTop, window.innerHeight - mascot.offsetHeight),
    );

    mascot.style.left = `${newLeft}px`;
    mascot.style.top = `${newTop}px`;

    const mascotImage = mascot.querySelector("svg");
    if (mascotImage && dx !== 0) {
      mascotImage.style.transform = dx < 0 ? "scaleX(-1)" : "scaleX(1)";
    }
  };

  // 🏠 把睡覺的小助理放到小窩正中間
  //    睡覺時 CSS 有 transform: translate(-50%, -50%) !important，left/top 指的是貓咪的「中心點」，直接放小窩中心即可
  const placeMascotAtHome = (animate) => {
    const home = document.getElementById("mascot-home");
    if (!home || !mascot) return;
    const homeRect = home.getBoundingClientRect();
    mascot.style.transition = animate ? "all 0.5s ease-out" : "none";
    mascot.style.left = `${homeRect.left + homeRect.width / 2}px`;
    mascot.style.top = `${homeRect.top + homeRect.height / 2}px`;
  };

  // 睡覺時跟著小窩：小窩會因為打開面板、切換畫面、手機版尺寸而移動或縮放，
  // 以前只在視窗 resize 時重新對齊，貓咪就會留在原地「離家出走」
  let followHomeFrame = 0;
  let lastHomeKey = "";
  const followHome = () => {
    if (!window.isMascotSleeping) {
      followHomeFrame = 0;
      lastHomeKey = "";
      return;
    }
    const home = document.getElementById("mascot-home");
    if (home && home.getClientRects().length) {
      const r = home.getBoundingClientRect();
      const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${mascot.offsetWidth}`;
      if (key !== lastHomeKey) {
        // 第一次（剛放進去）有動畫，之後跟著小窩移動就直接到位
        placeMascotAtHome(lastHomeKey === "");
        lastHomeKey = key;
      }
    }
    followHomeFrame = requestAnimationFrame(followHome);
  };
  const startFollowingHome = () => {
    if (!followHomeFrame) followHomeFrame = requestAnimationFrame(followHome);
  };

  const stopDrag = () => {
    if (isDragging) {
      isDragging = false;

      try {
        const mascotHome = document.getElementById("mascot-home");
        if (mascotHome && !window.isMascotSleeping) {
          const homeRect = mascotHome.getBoundingClientRect();
          const mascotRect = mascot.getBoundingClientRect();

          const mascotCenterX = mascotRect.left + mascotRect.width / 2;
          const mascotCenterY = mascotRect.top + mascotRect.height / 2;

          if (
            mascotCenterX > homeRect.left &&
            mascotCenterX < homeRect.right &&
            mascotCenterY > homeRect.top &&
            mascotCenterY < homeRect.bottom
          ) {
            window.isMascotSleeping = true;
            mascot.classList.add("mascot-sleeping");
            clearTimeout(swimTimer);

            const awakeMascot = document.getElementById("awake-mascot");
            const sleepingMascot = document.getElementById("sleeping-mascot");
            if (awakeMascot) awakeMascot.style.display = "none";
            if (sleepingMascot) sleepingMascot.style.display = "block";

            // 🌟 放到小窩正中間，之後小窩移動也會跟著過去
            startFollowingHome();

            const dialogueBox = document.getElementById("mermecat-dialogue");
            if (dialogueBox) {
              dialogueBox.innerText = "呼嚕呼嚕... 進來休息喵 ✨🐚";
              dialogueBox.classList.add("show-dialogue");
              setTimeout(() => {
                dialogueBox.classList.remove("show-dialogue");
              }, 3000);
            }
            return;
          }
        }
      } catch (e) {
        console.log("小窩魔法打結了:", e);
      }

      if (!window.isMascotSleeping) {
        swimLikeLazyMermaid();
      }
    }
  };

  window.addEventListener("resize", () => {
    if (window.isMascotSleeping) {
      placeMascotAtHome(false);
      return;
    }

    // 🌟 核心防護：視窗縮小時，若游動座標大於目前視窗寬高，立刻中斷過渡並拉回視窗內
    if (mascot) {
      clearTimeout(swimTimer);
      const currentCatW = mascot.offsetWidth || 80;
      const currentCatH = mascot.offsetHeight || 80;
      const maxLeft = Math.max(10, window.innerWidth - currentCatW - 15);
      const maxTop = Math.max(10, window.innerHeight - currentCatH - 15);

      let curLeft = parseFloat(mascot.style.left) || 0;
      let curTop = parseFloat(mascot.style.top) || 0;

      if (curLeft > maxLeft || curTop > maxTop || curLeft < 10 || curTop < 10) {
        mascot.style.transition = "none";
        mascot.style.left = `${Math.max(10, Math.min(curLeft, maxLeft))}px`;
        mascot.style.top = `${Math.max(10, Math.min(curTop, maxTop))}px`;
      }

      swimTimer = setTimeout(swimLikeLazyMermaid, 200);
    }
  });

  let mascotHome = document.getElementById("mascot-home");
  if (!mascotHome) {
    mascotHome = document.createElement("div");
    mascotHome.id = "mascot-home";
    mascotHome.title = "把小助理拖進來休息，點擊再叫牠起床喔！";
    document.body.appendChild(mascotHome);
  }

  mascotHome.addEventListener("click", () => {
    if (window.isMascotSleeping) {
      window.isMascotSleeping = false;
      mascot.classList.remove("mascot-sleeping");

      const awakeMascot = document.getElementById("awake-mascot");
      const sleepingMascot = document.getElementById("sleeping-mascot");
      if (awakeMascot) awakeMascot.style.display = "block";
      if (sleepingMascot) sleepingMascot.style.display = "none";

      const homeRect = mascotHome.getBoundingClientRect();
      mascot.style.transition = "none";

      mascot.style.removeProperty("transform");
      mascot.style.transform = `scale(1)`;

      mascot.style.left = homeRect.right + 15 + "px";
      mascot.style.top = homeRect.top - 30 + "px";
      mascot.offsetHeight;

      mascot.style.transition = "top 8s ease-in-out, left 8s ease-in-out";

      const dialogueBox = document.getElementById("mermecat-dialogue");
      if (dialogueBox) {
        dialogueBox.innerText = "喵嗚！謝謝寶寶叫我起床✨🐬";
        dialogueBox.classList.add("show-dialogue");
        setTimeout(() => {
          dialogueBox.classList.remove("show-dialogue");
        }, 3500);
      }
    }
  });

  mascot.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });
  document.addEventListener("mousemove", (e) => onDrag(e.clientX, e.clientY));
  document.addEventListener("mouseup", stopDrag);

  mascot.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 0) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (isDragging && e.touches.length > 0) {
        e.preventDefault();
        onDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false },
  );
  document.addEventListener("touchend", stopDrag);

  // 🌟 點兩下召喚貓咪游過來（支援手機觸控雙擊與電腦雙擊）
  let lastTapTime = 0;

  function summonMascot(clientX, clientY, targetEl) {
    if (window.isMascotSleeping) return;
    if (
      targetEl instanceof Element &&
      targetEl.closest(
        'a, button, input, textarea, select, label, [role="button"], #svg-mermecat-mascot, #mascot-home, .ocean-popular-board, .ocean-rules-board'
      )
    ) {
      return;
    }

    clearTimeout(swimTimer);

    const currentCatW = mascot.offsetWidth || 80;
    const currentCatH = mascot.offsetHeight || 80;

    const targetLeft = Math.max(
      10,
      Math.min(clientX - currentCatW / 2, window.innerWidth - currentCatW - 10)
    );
    const targetTop = Math.max(
      10,
      Math.min(clientY - currentCatH / 2, window.innerHeight - currentCatH - 10)
    );

    const curLeft = parseFloat(mascot.style.left) || 0;
    const mascotSvg = mascot.querySelector("svg");
    if (mascotSvg) {
      mascotSvg.style.transform = targetLeft < curLeft ? "scaleX(-1)" : "scaleX(1)";
    }

    mascot.style.transition = "top 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), left 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)";
    mascot.style.left = `${targetLeft}px`;
    mascot.style.top = `${targetTop}px`;

    const dialogueBox = document.getElementById("mermecat-dialogue");
    if (dialogueBox) {
      dialogueBox.innerText = "喵！來了來了～找我有什麼事嗎？🐬✨";
      dialogueBox.classList.add("show-dialogue");
      setTimeout(() => dialogueBox.classList.remove("show-dialogue"), 2500);
    }

    swimTimer = setTimeout(swimLikeLazyMermaid, 1000);
  }

  // 電腦端雙擊
  window.addEventListener("dblclick", (e) => {
    summonMascot(e.clientX, e.clientY, e.target);
  });

  // 手機觸控雙擊
  window.addEventListener(
    "touchend",
    (e) => {
      const currentTime = Date.now();
      const tapGap = currentTime - lastTapTime;
      if (tapGap < 350 && tapGap > 0) {
        if (e.changedTouches && e.changedTouches[0]) {
          const t = e.changedTouches[0];
          summonMascot(t.clientX, t.clientY, e.target);
        }
      }
      lastTapTime = currentTime;
    },
    { passive: true }
  );

  mascot.addEventListener("click", (e) => {
    if (hasMoved) {
      e.preventDefault();
      hasMoved = false;
      return;
    }

    if (window.isMascotSleeping) {
      e.preventDefault();
      const mascotHome = document.getElementById("mascot-home");
      if (mascotHome) {
        mascotHome.click();
      }
      return;
    }

    window.location.href = AI_ASSISTANT_URL;
  });

  fetchPopularBottles();
});

// =========================================
// 📜 深海公約與熱門看板控制器
// =========================================
window.toggleRulesBoard = function () {
  const board = document.getElementById("ocean-rules-board");
  if (!board) return;
  board.classList.toggle("collapsed");
  const isCollapsed = board.classList.contains("collapsed");
  localStorage.setItem("rulesBoardCollapsed", isCollapsed);
};

document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("ocean-rules-board");
  const isCollapsed = localStorage.getItem("rulesBoardCollapsed") === "true";
  if (board && isCollapsed) {
    board.classList.add("collapsed");
  }
});

async function fetchPopularBottles() {
  const listContainer = document.getElementById("popular-posts-list");
  if (!listContainer) return;
  try {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let likedBottleIds = [];
    let savedBottleIds = [];

    if (token) {
      try {
        const likedRes = await fetch(`${API_BASE_URL}/bottles/liked`, {
          method: "GET",
          headers,
        });
        if (likedRes.ok) {
          const likedData = await likedRes.json();
          let arr = likedData.bottles || likedData.data || likedData;
          if (Array.isArray(arr))
            likedBottleIds = arr.map((i) =>
              String(i.bottle_id || i.id || i.bottleId),
            );
        }
      } catch (e) {}

      try {
        const savedRes = await fetch(`${API_BASE_URL}/bottles/saved`, {
          method: "GET",
          headers,
        });
        if (savedRes.ok) {
          const savedData = await savedRes.json();
          let arr = savedData.bottles || savedData.data || savedData;
          if (Array.isArray(arr))
            savedBottleIds = arr.map((i) =>
              String(i.bottle_id || i.id || i.bottleId),
            );
        }
      } catch (e) {}
    }

    const response = await fetch(`${API_BASE_URL}/bottles/popular`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const data = await response.json();
      let popularArray = [];
      if (Array.isArray(data)) popularArray = data;
      else if (data && Array.isArray(data.bottles)) popularArray = data.bottles;
      else if (data && Array.isArray(data.data)) popularArray = data.data;
      else if (data && Array.isArray(data.result)) popularArray = data.result;

      if (!popularArray || popularArray.length === 0) {
        listContainer.innerHTML =
          '<div style="text-align: center; color: #ccc; padding: 20px 0;">目前海面上還沒有熱門貼文喔！🌊</div>';
        return;
      }

      if (!window.popularCache) window.popularCache = [];

      if (!window.hasPatchedOpenDetail) {
        const originalOpen = window.openPostDetail;
        window.openPostDetail = function (id) {
          if (!posts.some((p) => String(p.id) === String(id))) {
            const cachedPost = window.popularCache.find(
              (p) => String(p.id) === String(id),
            );
            if (cachedPost) posts.push(cachedPost);
          }
          originalOpen(id);
        };
        window.hasPatchedOpenDetail = true;
      }

      listContainer.innerHTML = popularArray
        .slice(0, 6)
        .map((rawItem, index) => {
          const item = rawItem.bottle || rawItem.Bottle || rawItem;
          const safeId = String(
            item.bottle_id ||
              item.id ||
              item.bottleId ||
              rawItem.id ||
              rawItem.bottle_id ||
              "temp",
          );
          const title = item.title || rawItem.title || "無標題貼文";

          let author = "用戶";
          if (item.is_anonymous || item.isAnonymous) {
            author = "匿名";
          } else {
            if (typeof item.author === "string") author = item.author;
            else if (item.author?.name) author = item.author.name;
            else if (item.author_name) author = item.author_name;
            else if (item.user?.name) author = item.user.name;
            else if (item.username) author = item.username;
            else if (item.User?.name) author = item.User.name;
            else if (typeof rawItem.author === "string")
              author = rawItem.author;
            else if (rawItem.author?.name) author = rawItem.author.name;
            else if (rawItem.user?.name) author = rawItem.user.name;
            else if (rawItem.User?.name) author = rawItem.User.name;
            else if (rawItem.member?.name) author = rawItem.member.name;
            else if (item.member?.name) author = item.member.name;
            else if (item.member_name) author = item.member_name;
            else if (rawItem.member_name) author = rawItem.member_name;
          }

          let rawBoard = item.category_name || item.board || null;
          if (
            !rawBoard &&
            item.category_list &&
            Array.isArray(item.category_list) &&
            item.category_list.length > 0
          ) {
            rawBoard = item.category_list[0];
          }
          if (!rawBoard && item.categories && item.categories.length > 0) {
            rawBoard = item.categories[0].category?.name;
          } else if (
            !rawBoard &&
            rawItem.categories &&
            rawItem.categories.length > 0
          ) {
            rawBoard = rawItem.categories[0].category?.name;
          }

          let boardName = "😑 極度厭世/躺平";
          let cId = item.category_id || rawItem.category_id || item.categoryId;
          if (!rawBoard && item.categories && item.categories.length > 0)
            cId = item.categories[0].category_id;

          const idToBoard = {
            1: "😡 極度憤怒中",
            2: "🤫 沒人懂的秘密",
            3: "💔 破碎的碎片",
            4: "😑 極度厭世/躺平",
            5: "😁 開心的事",
          };

          if (rawBoard) {
            if (rawBoard.includes("憤怒")) boardName = "😡 極度憤怒中";
            else if (rawBoard.includes("秘密")) boardName = "🤫 沒人懂的秘密";
            else if (rawBoard.includes("破碎")) boardName = "💔 破碎的碎片";
            else if (rawBoard.includes("厭世") || rawBoard.includes("躺平"))
              boardName = "😑 極度厭世/躺平";
            else if (rawBoard.includes("開心")) boardName = "😁 開心的事";
            else boardName = rawBoard;
          } else if (cId !== undefined && cId !== null) {
            if (Array.isArray(cId) && cId.length > 0)
              boardName = idToBoard[cId[0]] || boardName;
            else if (!Array.isArray(cId))
              boardName = idToBoard[cId] || boardName;
          }

          const savesCount = parseInt(
            item.save_count || item.saveCount || item.saves || 0,
            10,
          );

          let isActuallyLiked =
            likedBottleIds.includes(safeId) ||
            Boolean(item.is_liked || item.isLiked);
          let isActuallySaved =
            savedBottleIds.includes(safeId) ||
            Boolean(item.is_saved || item.isSaved);

          const postObj = {
            id: safeId,
            board: boardName,
            author: author,
            authorId: item.author_id || item.user_id || item.member_id || null,
            title: title,
            desc: stripLegacyPollTag(item.content || rawItem.content || ""),
            poll: parsePoll(item, rawItem),
            likes: parseInt(
              item.like_count || item.likeCount || item.likes || 0,
              10,
            ),
            msgs: item.comment_count || item.comments?.length || 0,
            liked: isActuallyLiked,
            saved: isActuallySaved,
            createdAt:
              item.createdAt ||
              item.created_at ||
              rawItem.createdAt ||
              rawItem.created_at,
          };

          if (!window.popularCache.some((p) => String(p.id) === safeId))
            window.popularCache.push(postObj);
          if (!posts.some((p) => String(p.id) === safeId)) posts.push(postObj);

          return `
          <div class="popular-item-card" onclick="openPostDetail('${safeId}')">
            <div class="popular-item-title">👑 TOP ${index + 1}: ${escapeHTML(title)}</div>
            <div class="popular-item-meta" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
              <span style="color: #4da6ff; flex-shrink: 0;">[${escapeHTML(boardName)}]</span>
              <span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">👤 ${escapeHTML(author)}</span>
              <span style="flex-shrink: 0; margin-left: auto;">⭐ ${savesCount}</span>
            </div>
          </div>
          `;
        })
        .join("");
    } else {
      listContainer.innerHTML =
        '<div style="text-align: center; color: #ff6b6b; padding: 20px 0;">打撈失敗，海象不佳 😢</div>';
    }
  } catch (error) {
    listContainer.innerHTML =
      '<div style="text-align: center; color: #ff6b6b; padding: 20px 0;">伺服器連線失敗 😢</div>';
  }
}

// =========================================
// 🫂 追蹤與我的追蹤功能邏輯 (含狀態同步記憶)
// =========================================

// 1. 切換追蹤 / 取消追蹤作者
window.toggleFollow = async function () {
  const token = localStorage.getItem("authToken");
  const btn = document.getElementById("follow-author-btn");
  const authorTag = document.getElementById("detail-author-tag");
  const authorName = authorTag ? authorTag.innerText.trim() : "作者";

  if (!token) {
    if (typeof showOceanToast === "function") {
      showOceanToast("請先登入才能追蹤作者喔！🔒");
    } else {
      alert("請先登入才能追蹤作者喔！");
    }
    return;
  }

  if (authorName === "匿名" || !currentAuthorId) {
    if (typeof showOceanToast === "function") {
      showOceanToast("這位作者使用了匿名，無法追蹤喔！👻");
    } else {
      alert("這位作者使用了匿名，無法追蹤喔！👻");
    }
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const myId = currentUser.id || currentUser.userId || currentUser.user_id;
  if (myId && String(currentAuthorId) === String(myId)) {
    if (typeof showOceanToast === "function") {
      showOceanToast("不能追蹤自己喔！🐾");
    } else {
      alert("不能追蹤自己喔！");
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        followedId: currentAuthorId,
        followed_id: currentAuthorId,
      }),
    });

    if (response.ok) {
      if (btn) {
        btn.classList.toggle("following");
        const isNowFollowing = btn.classList.contains("following");

        if (isNowFollowing) {
          btn.innerHTML = "<span>已追蹤</span>";
          if (currentAuthorId)
            window._myFollowingIdSet.add(String(currentAuthorId));
          if (typeof showOceanToast === "function") {
            showOceanToast(`成功把 ${authorName} 加入追蹤名單啦！🎉`);
          }
        } else {
          btn.innerHTML = "+ 追蹤";
          if (currentAuthorId)
            window._myFollowingIdSet.delete(String(currentAuthorId));
          if (typeof showOceanToast === "function") {
            showOceanToast(`已取消追蹤 ${authorName} 💔`);
          }
        }
        // 作者在底下也有留言的話，留言旁的追蹤按鈕一起同步
        if (currentAuthorId) syncFollowButtons(currentAuthorId, isNowFollowing);
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || "伺服器拒絕了追蹤請求";
      if (typeof showOceanToast === "function") {
        showOceanToast(`追蹤失敗：${msg}`);
      } else {
        alert(`追蹤失敗：${msg}`);
      }
    }
  } catch (error) {
    console.error("追蹤 API 連線錯誤:", error);
    if (typeof showOceanToast === "function") {
      showOceanToast("伺服器連線異常，請稍後再試 🌊");
    }
  }
};

// 2. 開啟並載入「我的追蹤列表」
window.openFollowingModal = async function () {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.remove("show-dropdown");

  const modal = document.getElementById("following-modal");
  const container = document.getElementById("following-list-container");

  if (!modal || !container) return;

  // 🌟 以 flex 置中顯示彈窗
  modal.style.setProperty("display", "flex", "important");
  container.innerHTML =
    '<div style="text-align: center; color: #888; padding: 30px 0;">潛入海底撈取你的追蹤名單中...🌊</div>';

  const token = localStorage.getItem("authToken");
  if (!token) {
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">寶寶，請先登入才能查看追蹤列表喔！</div>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/following`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      const backendData = await response.json();
      const followingList = backendData.data || backendData || [];

      window._myFollowingIdSet = new Set(
        followingList.map((user) =>
          String(
            user.id || user.followed_id || user.followedId || user.member_id,
          ),
        ),
      );

      if (followingList.length === 0) {
        container.innerHTML =
          '<div style="text-align: center; color: #888; padding: 40px 0; font-size: 0.95rem;">目前還沒有追蹤任何人喔，快去海域逛逛吧！🐟</div>';
        return;
      }

      // 🌟 渲染名單並加上「已追蹤 / 取消追蹤」膠囊按鈕
      container.innerHTML = followingList
        .map((user) => {
          const uId = String(
            user.id || user.followed_id || user.followedId || user.member_id,
          );
          const uName = user.name || user.username || "神秘海友";
          const uAvatar = user.avatar || "images/fish_logo.webp";

          return `
            <div class="following-item" id="following-user-${uId}">
                <div class="following-info" data-block-id="${escapeHTML(uId)}" data-block-name="${escapeHTML(uName)}">
                    <img src="${uAvatar}" class="following-avatar" />
                    <span class="following-name" title="${escapeHTML(uName)}">${escapeHTML(uName)}</span>
                </div>
                <button
                  type="button"
                  class="btn-unfollow-modal"
                  onmouseenter="this.innerText='取消追蹤'"
                  onmouseleave="this.innerText='已追蹤'"
                  onclick="unfollowFromModal('${uId}', ${escapeHTML(JSON.stringify(String(uName)))}, event)"
                >
                  已追蹤
                </button>
            </div>
          `;
        })
        .join("");
    } else {
      container.innerHTML =
        '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">資料讀取失敗，海象不佳 😢</div>';
    }
  } catch (error) {
    console.error("取得追蹤列表連線錯誤:", error);
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">伺服器連線失敗！</div>';
  }
};

// 3. 關閉追蹤列表彈窗
window.closeFollowingModal = function () {
  const modal = document.getElementById("following-modal");
  if (modal) modal.style.setProperty("display", "none", "important");
};

// 🌟 4. 在彈窗內直接取消追蹤某位作者
window.unfollowFromModal = async function (targetId, targetName, e) {
  if (e) e.stopPropagation();
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        followedId: targetId,
        followed_id: targetId,
      }),
    });

    if (response.ok) {
      window._myFollowingIdSet.delete(String(targetId));

      const row = document.getElementById(`following-user-${targetId}`);
      if (row) {
        row.style.opacity = "0";
        row.style.transform = "translateX(10px)";
        row.style.transition = "all 0.3s ease";
        setTimeout(() => {
          row.remove();
          const list = document.getElementById("following-list-container");
          if (list && list.children.length === 0) {
            list.innerHTML =
              '<div style="text-align: center; color: #888; padding: 40px 0;">已無追蹤名單囉！🐟</div>';
          }
        }, 300);
      }

      if (typeof showOceanToast === "function") {
        showOceanToast(`已取消追蹤 ${targetName} 💔`);
      }
    }
  } catch (err) {
    console.error("取消追蹤失敗:", err);
  }
};

// =========================================
// 🔔 抓取未讀通知數量與發光效果
// =========================================
async function fetchNotificationCount() {
  const token = localStorage.getItem("authToken");
  const bellBtn = document.getElementById("notification-bell-btn");
  const badge = document.getElementById("notification-badge");

  if (!token) {
    if (badge) badge.style.display = "none";
    if (bellBtn) bellBtn.classList.remove("has-unread");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      const data = await response.json();

      let unreadCount = 0;
      if (typeof data.count === "number") {
        unreadCount = data.count;
      } else if (typeof data.unreadCount === "number") {
        unreadCount = data.unreadCount;
      } else if (typeof data.unread_count === "number") {
        unreadCount = data.unread_count;
      } else {
        let notifList = Array.isArray(data)
          ? data
          : data.data || data.notifications || data.result || [];
        if (Array.isArray(notifList)) {
          unreadCount = notifList.filter(
            (item) => !(item.is_read ?? item.isRead),
          ).length;
        }
      }

      if (badge && bellBtn) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount > 99 ? "99+" : unreadCount;
          badge.style.display = "block";
          bellBtn.classList.add("has-unread");
        } else {
          badge.style.display = "none";
          bellBtn.classList.remove("has-unread");
        }
      }
    }
  } catch (error) {
    console.error("撈取通知數量失敗:", error);
  }
}

setInterval(() => {
  fetchNotificationCount();
}, 30000);

/* =========================================
   🚀 手機版海域選單 (Bottom Sheet) 專屬邏輯
   ========================================= */
window.toggleBoardSheet = function () {
  const sidebar = document.querySelector(".sidebar.light-sidebar");
  const overlay = document.getElementById("board-sheet-overlay");
  const btn = document.getElementById("mobile-board-btn");

  if (sidebar && overlay && btn) {
    sidebar.classList.toggle("sheet-open");
    overlay.classList.toggle("sheet-open");
    btn.classList.toggle("sheet-open");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const mobileNameDisplay = document.getElementById("mobile-board-name");

  if (mobileNameDisplay) {
    const activeLi = document.querySelector(".sidebar li.active");
    if (activeLi) mobileNameDisplay.innerText = activeLi.innerText.trim();
  }

  document.querySelectorAll(".sidebar li").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (mobileNameDisplay) {
        mobileNameDisplay.innerText = e.target.innerText.trim();
      }

      if (window.innerWidth <= 768) {
        const sidebar = document.querySelector(".sidebar.light-sidebar");
        if (sidebar && sidebar.classList.contains("sheet-open")) {
          window.toggleBoardSheet();
        }
      }
    });
  });
});

// =========================================
// 🔔 通知小視窗專屬邏輯
// =========================================

// 🔔 1. 開關通知小視窗 (精準定位在鈴鐺正下方)
window.toggleNotificationPopup = async function (e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById("notif-popup");
  if (!popup) return;

  const userDropdown = document.getElementById("user-dropdown");
  if (userDropdown) userDropdown.classList.remove("show-dropdown");

  const isHidden = popup.style.display === "none" || popup.style.display === "";

  if (isHidden) {
    // 🎯 取得當前被點擊的鈴鐺元素
    const bell =
      (e && e.currentTarget) ||
      document.getElementById("notification-bell-btn") ||
      document.querySelector(".notification-bell");

    if (bell) {
      const rect = bell.getBoundingClientRect();
      const popupWidth = Math.min(340, window.innerWidth - 24);

      popup.style.position = "fixed";
      popup.style.top = `${rect.bottom + 10}px`;

      // 水平置中於鈴鐺正下方
      let left = rect.left + rect.width / 2 - popupWidth / 2;

      // 避免超出螢幕左右邊界
      if (left + popupWidth > window.innerWidth - 15) {
        left = window.innerWidth - popupWidth - 15;
      }
      if (left < 15) {
        left = 15;
      }

      popup.style.left = `${left}px`;
      popup.style.right = "auto";
      popup.style.width = `${popupWidth}px`;
    }

    popup.style.display = "flex";
    await fetchAndRenderNotifications();
  } else {
    popup.style.display = "none";
  }
};

window.addEventListener("click", (event) => {
  const popup = document.getElementById("notif-popup");
  if (
    popup &&
    popup.style.display === "flex" &&
    !event.target.closest("#notif-popup") &&
    !event.target.closest("#notification-bell-btn")
  ) {
    popup.style.display = "none";
  }
});

// 2. 抓取並渲染通知
async function fetchAndRenderNotifications() {
  const token = localStorage.getItem("authToken");
  const container = document.getElementById("notif-list-container");

  if (!token) {
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 20px 0;">寶寶，請先登入才能看通知喔！</div>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) throw new Error("伺服器抓不到資料");

    const data = await response.json();

    let notifArray = [];
    if (Array.isArray(data)) notifArray = data;
    else if (data && Array.isArray(data.data)) notifArray = data.data;
    else if (data && Array.isArray(data.notifications))
      notifArray = data.notifications;
    else if (data && Array.isArray(data.result)) notifArray = data.result;

    if (!notifArray || notifArray.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; color: #88bbff; padding: 30px 0;">目前還沒有收到任何通知喔！🌊</div>';
      return;
    }

    container.innerHTML = notifArray
      .map((notif) => {
        let iconClass = "system";
        let iconEmoji = "⚠️";
        const typeUpper = (notif.type || "").toUpperCase();

        if (typeUpper.includes("LIKE")) {
          iconClass = "heart";
          iconEmoji = "❤️";
        } else if (
          typeUpper.includes("REPLY") ||
          typeUpper.includes("COMMENT")
        ) {
          iconClass = "reply";
          iconEmoji = "💬";
        } else if (
          typeUpper.includes("SAVE") ||
          typeUpper.includes("BOOKMARK")
        ) {
          iconClass = "system";
          iconEmoji = "⭐";
        } else if (
          typeUpper.includes("WELCOME") ||
          typeUpper.includes("USER")
        ) {
          iconClass = "user";
          iconEmoji = "🎉";
        } else {
          iconClass = "system";
          iconEmoji = "🌊";
        }

        const isRead = notif.is_read ?? notif.isRead;
        const unreadClass = isRead ? "" : "unread";
        const dotHtml = isRead ? "" : '<div class="notif-unread-dot"></div>';
        const timeStr = notif.created_at
          ? new Date(notif.created_at).toLocaleString()
          : notif.time || "";
        const notificationText = notif.content || notif.message || "";
        // target_id 依通知類型代表不同東西：瓶子類是漂流瓶 id，
        // 追蹤通知是會員 id，客服通知是客服單 id，所以類型也要一起傳過去
        const targetId = notif.target_id ?? notif.targetId ?? "";
        const safeType = String(notif.type || "").replace(/[^A-Z_]/gi, "");

        return `
                <div class="notif-mini-card ${unreadClass}" style="cursor: pointer"
                     onclick="openNotificationTarget('${notif.id}', '${targetId}', ${isRead ? "true" : "false"}, this, '${safeType}')">
                    <div class="notif-icon ${iconClass}">${iconEmoji}</div>
                    <div class="notif-text-box">
                        <p>${escapeHTML(notificationText)}</p>
                        <span class="time">${timeStr}</span>
                    </div>
                    ${dotHtml}
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("抓取通知失敗：", error);
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 20px 0;">連線失敗，請稍後再試 😢</div>';
  }
}

// 🔔 點通知就跳到對應的地方
// 這幾種通知的 target_id 是漂流瓶 id，可以點進貼文
const NOTIF_BOTTLE_TYPES = [
  "BOTTLE_LIKE", "BOTTLE_SAVE", "COMMENT_LIKE", "COMMENT_REPLY", "SYSTEM_ALERT", "SYSTEM",
];

window.openNotificationTarget = async function (notifId, targetId, isRead, cardElement, type = "") {
  // 1. 順手標成已讀（維持原本的行為）
  if (!isRead && cardElement) {
    markSingleAsReadAPI(notifId, cardElement);
  }

  const kind = String(type).toUpperCase();

  // 2. 客服通知的 target_id 是客服單 id，帶去客服頁
  if (kind.startsWith("CUSTOMER_SERVICE")) {
    window.location.href = "customer-service.html";
    return;
  }

  // 3. 追蹤通知的 target_id 是會員 id，不是瓶子 —— 目前還沒有個人頁面可以去
  if (kind === "NEW_FOLLOWER") {
    showOceanToast("有新朋友追蹤你了！目前還沒有個人頁面可以看喔 🌊");
    return;
  }

  // 4. 不認得的類型、或系統公告這種沒有對應貼文的
  if (
    (kind && !NOTIF_BOTTLE_TYPES.includes(kind)) ||
    !targetId || targetId === "null" || targetId === "undefined"
  ) {
    showOceanToast("這則通知沒有對應的漂流瓶喔！🌊");
    return;
  }

  const popup = document.getElementById("notif-popup");
  const closePopup = () => {
    if (popup) popup.style.display = "none";
  };

  await openBottleById(targetId, closePopup);
};

// 🔎 用瓶子 ID 打開詳情：已經在清單裡就直接開，不在就跟後端單獨要這一篇
//    通知、首頁「我的海域」共用；beforeOpen 是打開前要做的事（例如收起通知視窗）
window.openBottleById = async function (targetId, beforeOpen = () => {}) {
  // 這篇就在目前的清單裡，直接開
  if (posts.find((p) => String(p.id) === String(targetId))) {
    beforeOpen();
    openPostDetail(targetId);
    return;
  }

  // 4. 不在清單裡，就跟後端單獨要這一篇
  const token = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}/bottles/${targetId}`, {
      method: "GET",
      headers,
    });

    if (res.status === 404) {
      // 後端的「取得單篇漂流瓶」API 還沒上線時，打這個網址也是 404，
      // 但回的是 Express 預設的 HTML 頁，不是 JSON。用這點分辨，不然會把每篇都誤報成已刪除
      const body = await res.json().catch(() => null);
      if (body && body.message) {
        showOceanToast("這篇漂流瓶已經被刪除了 😢");
      } else {
        showOceanToast("這篇漂流瓶暫時打不開，請稍後再試 🌊");
      }
      return;
    }
    if (!res.ok) throw new Error("伺服器抓不到這篇漂流瓶");

    const data = await res.json();
    const rawBottle = data.bottle || data;

    // 順便補上按讚／收藏狀態，點進去的愛心才不會是錯的
    let likedIds = [];
    let savedIds = [];
    if (token) {
      const pull = async (path, pick) => {
        try {
          const r = await fetch(`${API_BASE_URL}${path}`, { method: "GET", headers });
          if (!r.ok) return [];
          const d = await r.json();
          const arr = d.bottles || d.data || d;
          return Array.isArray(arr) ? arr.map(pick).filter(Boolean) : [];
        } catch (e) {
          return [];
        }
      };
      const idOf = (i) => String((i.bottle || i).bottle_id || (i.bottle || i).id || "");
      [likedIds, savedIds] = await Promise.all([
        pull("/bottles/liked", idOf),
        pull("/bottles/saved", idOf),
      ]);
    }

    // 用跟貼文列表同一套轉換，欄位才不會對不起來
    const post = normalizeBottle(rawBottle, likedIds, savedIds);

    // 放進 posts：按讚、留言、投票那些功能都是查這個陣列，不放進去會通通失效
    if (!posts.find((p) => String(p.id) === String(post.id))) {
      posts.push(post);
    }

    beforeOpen();
    openPostDetail(post.id);
  } catch (error) {
    console.error("打開漂流瓶失敗：", error);
    showOceanToast("連線失敗，等一下再試試看 😢");
  }
};

// 3. 單筆已讀
window.markSingleAsReadAPI = async function (id, cardElement) {
  const token = localStorage.getItem("authToken");
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      cardElement.classList.remove("unread");
      const dot = cardElement.querySelector(".notif-unread-dot");
      if (dot) dot.style.display = "none";
      // 這裡以前會把 onclick 清掉，導致已讀的通知再也點不進貼文，所以不再清除

      if (typeof fetchNotificationCount === "function") {
        fetchNotificationCount();
      }
    }
  } catch (error) {
    console.error(`標記通知 ${id} 失敗：`, error);
  }
};

// 4. 全部已讀
window.markAllAsReadAPI = async function (e) {
  if (e) e.stopPropagation();

  const unreadCards = document.querySelectorAll(".notif-mini-card.unread");
  if (unreadCards.length === 0) {
    showOceanToast("目前沒有未讀通知喔！🌊");
    return;
  }

  const token = localStorage.getItem("authToken");
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (response.ok) {
      unreadCards.forEach((card) => {
        card.classList.remove("unread");
        const dot = card.querySelector(".notif-unread-dot");
        if (dot) dot.style.display = "none";
        card.onclick = null;
      });

      if (typeof fetchNotificationCount === "function") {
        fetchNotificationCount();
      }
      showOceanToast("全部都看過囉，寶寶真棒！✨");
    }
  } catch (error) {
    console.error("全部標記已讀失敗：", error);
  }
};

// =========================================
// 🫧 深海泡泡提示功能 (取代原生 alert)
// =========================================
window.showOceanToast = function (message) {
  const oldToast = document.getElementById("ocean-toast");
  if (oldToast) {
    oldToast.remove();
  }

  const toast = document.createElement("div");
  toast.id = "ocean-toast";
  toast.className = "ocean-toast";
  // 訊息可能含有使用者名稱，一律當純文字顯示
  toast.innerHTML = `<span style="font-size: 1.2rem;">🫧</span> <span></span>`;
  toast.lastElementChild.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3000);
};

// =========================================
// ⚙️ 網站設定彈窗邏輯
// =========================================
window.openSettingsModal = function () {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.remove("show-dropdown");

  const modal = document.getElementById("settings-modal");
  const timeToggle = document.getElementById("setting-show-comment-time");
  const followToggle = document.getElementById("setting-allow-follow");

  const isShowTime =
    localStorage.getItem("setting_show_comment_time") !== "false";
  if (timeToggle) timeToggle.checked = isShowTime;

  const isAllowFollow =
    localStorage.getItem("setting_allow_follow") !== "false";
  if (followToggle) followToggle.checked = isAllowFollow;

  if (modal) modal.style.display = "block";
};

window.toggleAllowFollowSetting = async function (isChecked) {
  localStorage.setItem("setting_allow_follow", isChecked ? "true" : "false");
  showOceanToast(
    isChecked ? "已開啟允許他人追蹤 🫂" : "已關閉追蹤功能，他人無法追蹤你 🔒",
  );

  const token = localStorage.getItem("authToken");
  if (token) {
    try {
      fetch(`${API_BASE_URL}/auth/update-data`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ allow_follow: isChecked }),
      }).catch((e) => console.log("設定已暫存於本地", e));
    } catch (e) {}
  }
};

window.closeSettingsModal = function () {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.style.display = "none";
};

window.toggleCommentTimeSetting = function (isChecked) {
  localStorage.setItem(
    "setting_show_comment_time",
    isChecked ? "true" : "false",
  );
  showOceanToast(isChecked ? "已開啟留言時間顯示 🕒" : "已隱藏留言時間顯示 🙈");

  if (currentOpenPostId) {
    renderComments(currentOpenPostId);
  }
};
// =========================================
// 📊 Threads 投票功能控制邏輯
// =========================================

// 1. 開關彈窗內的投票設定欄
window.togglePollCreator = function (show) {
  const container = document.getElementById("poll-inputs-container");
  const toggleBtn = document.getElementById("btn-toggle-poll");
  if (!container) return;

  const isVisible =
    show !== undefined ? show : container.style.display === "none";
  container.style.display = isVisible ? "block" : "none";
  if (toggleBtn) toggleBtn.style.display = isVisible ? "none" : "block";

  if (!isVisible) {
    const list = document.getElementById("poll-options-list");
    if (list) {
      list.innerHTML = `
                <input type="text" class="ocean-input poll-opt-input" placeholder="選項 1" maxlength="30" />
                <input type="text" class="ocean-input poll-opt-input" placeholder="選項 2" maxlength="30" />
            `;
    }
  }
};

// 2. 增加選項按鈕 (最多 4 項)
window.addPollOption = function () {
  const list = document.getElementById("poll-options-list");
  if (!list) return;
  const currentInputs = list.querySelectorAll(".poll-opt-input");
  if (currentInputs.length >= 4) {
    alert("投票選項最多 4 個喔！");
    return;
  }
  const nextIndex = currentInputs.length + 1;
  const newInput = document.createElement("input");
  newInput.type = "text";
  newInput.className = "ocean-input poll-opt-input";
  newInput.placeholder = `選項 ${nextIndex}`;
  newInput.maxLength = 30;
  list.appendChild(newInput);
};

// 3. 渲染投票卡片到文章詳細頁
function renderPollWidget(post) {
  const pollBox = document.getElementById("detail-post-poll");
  if (!pollBox) return;

  if (!post.poll || !post.poll.options || post.poll.options.length === 0) {
    pollBox.style.display = "none";
    pollBox.innerHTML = "";
    return;
  }

  pollBox.style.display = "block";
  const poll = post.poll;
  const totalVotes = poll.totalVotes || 0;
  const votedId = poll.userVotedOptionId;
  const hasVoted = votedId !== null && votedId !== undefined;

  let optionsHtml = poll.options
    .map((opt) => {
      const votes = opt.votes || 0;
      const percentage =
        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const isChoice = hasVoted && String(votedId) === String(opt.id);

      return `
            <button type="button" class="poll-option-row ${hasVoted ? "has-voted" : ""} ${isChoice ? "voted-choice" : ""}"
                 onclick="handlePollVote('${post.id}', ${Number(opt.id)})">
                <div class="poll-progress-bar" style="width: ${hasVoted ? percentage : 0}%;"></div>
                <span class="poll-radio">${isChoice ? "✓" : ""}</span>
                <span class="poll-opt-text">${escapeHTML(opt.text)}</span>
                ${hasVoted ? `<span class="poll-opt-percentage">${percentage}%</span>` : ""}
            </button>
        `;
    })
    .join("");

  pollBox.innerHTML = `
        <div class="poll-title-line">
            <span class="poll-title">📊 投票</span>
            <span class="poll-hint">${hasVoted ? "點其他選項可改票" : "選一個你的答案"}</span>
        </div>
        ${optionsHtml}
        <div class="poll-meta-footer">
            <span>共 ${totalVotes} 票</span>
            ${hasVoted ? "<span>✅ 你已投票</span>" : ""}
        </div>
    `;
}

// 4. 點擊選項觸發投票（呼叫後端，可改票）
window.handlePollVote = async function (postId, optionId) {
  const toast = (msg) =>
    typeof showOceanToast === "function" ? showOceanToast(msg) : alert(msg);

  const token = localStorage.getItem("authToken");
  if (!token) {
    toast("請先登入才能投票喔！");
    return;
  }

  const post = posts.find((p) => String(p.id) === String(postId));
  if (!post || !post.poll) return;
  const poll = post.poll;
  const prevId = poll.userVotedOptionId;
  if (String(prevId) === String(optionId)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/bottles/${postId}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ optionId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast(err.message || "投票失敗，請稍後再試");
      return;
    }

    // 依後端結果更新本地票數
    const hadVoted = prevId !== null && prevId !== undefined;
    if (hadVoted) {
      const prevOpt = poll.options.find((o) => String(o.id) === String(prevId));
      if (prevOpt) prevOpt.votes = Math.max(0, prevOpt.votes - 1);
    } else {
      poll.totalVotes = (poll.totalVotes || 0) + 1;
    }
    const newOpt = poll.options.find((o) => String(o.id) === String(optionId));
    if (newOpt) newOpt.votes = (newOpt.votes || 0) + 1;
    poll.userVotedOptionId = optionId;

    renderPollWidget(post);
    toast(hadVoted ? "已改票！📊" : "投票成功！📊");
  } catch (error) {
    console.error("投票連線錯誤:", error);
    toast("無法連線至伺服器，投票失敗");
  }
};

// 綁定發文彈窗的「附帶投票活動」按鈕
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("btn-toggle-poll");
  if (toggleBtn) {
    toggleBtn.onclick = () => window.togglePollCreator(true);
  }
});

// =========================================
// 😴 待機畫面：5 分鐘沒操作，或離開分頁超過 5 分鐘回來時顯示，點一下恢復
// =========================================
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_QUOTES = [
  "慢慢來，海浪也是一波一波的。",
  "累了就休息一下，瓶子會替你漂著。",
  "今天也辛苦了，喝口水再回來吧。",
  "有些心事，放進海裡就輕了。",
];
const IDLE_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// 遠處漂浮的瓶子只放在四周邊緣：[left%, top%, 大小cqmin, 透明度, 秒數, 是否更遠]
const IDLE_BOTTLES = [
  [6, 10, 11, 0.55, 7, false],
  [80, 16, 8, 0.4, 9, true],
  [4, 52, 7, 0.35, 8, true],
  [84, 48, 12, 0.55, 6.5, false],
  [10, 80, 9, 0.45, 10, true],
  [76, 82, 10, 0.5, 7.5, false],
];
const IDLE_BUBBLES = [
  [14, 2.4, 9],
  [28, 1.4, 7],
  [46, 1.8, 12],
  [66, 1.2, 8],
  [88, 2, 11],
  [56, 1, 6],
];

// 與吉祥物相同的睡覺人魚貓造型
const IDLE_CAT_SVG = `
  <svg class="drift-idle-cat" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g stroke="#1a4c6d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M 25 75 C 5 70 5 95 18 95 C 15 105 35 100 35 85 Z" fill="#50b4ba"/>
      <path d="M 20 50 C 15 95 85 95 80 50 Z" fill="#7ac2c4"/>
    </g>
    <path d="M 32 65 Q 40 72 48 65 M 52 65 Q 60 72 68 65 M 42 75 Q 50 82 58 75" fill="none" stroke="#1a4c6d" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M 22 55 C 20 28 25 25 35 25 L 38 12 L 46 22 L 54 22 L 62 12 L 65 25 C 75 25 80 28 78 55 Z" fill="#fcfdfe" stroke="#1a4c6d" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M 32 42 Q 38 46 44 42" fill="none" stroke="#1a4c6d" stroke-width="3" stroke-linecap="round"/>
    <path d="M 56 42 Q 62 46 68 42" fill="none" stroke="#1a4c6d" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="28" cy="46" rx="4.5" ry="3" fill="#ffbaba"/>
    <ellipse cx="72" cy="46" rx="4.5" ry="3" fill="#ffbaba"/>
    <g transform="translate(33, 46) scale(1.1)" stroke="#1a4c6d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M 28 16 C 27 12, 25 9, 21 9 C 17 9, 14 5, 13 3 C 12 6, 13 8, 10 10 C 6 12, 3 16, 2 20 C 1 23, 0 26, 1 26 C 3 25, 4 23, 5 22 C 6 24, 8 26, 9 25 C 8 22, 10 20, 11 19 C 16 21, 23 20, 28 16 Z" fill="#9bcbf1"/>
      <path d="M 27.5 16.5 C 22 20, 15 20, 11.5 18.5 C 15 16, 22 15, 27.5 15 Z" fill="#ffffff" stroke="none"/>
      <path d="M 18 18 C 16 23, 14 25, 16 26 C 18 25, 19 22, 20 18 Z" fill="#9bcbf1"/>
      <path d="M 21 14 Q 23 15.5 25 14" fill="none" stroke-width="1.5"/>
    </g>
    <g stroke="#1a4c6d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M 26 63 C 30 67, 36 69, 41 67 C 43 66, 42 62, 39 62 C 35 62, 30 62, 26 62 Z" fill="#fcfdfe"/>
      <path d="M 74 63 C 70 67, 64 69, 59 67 C 57 66, 58 62, 61 62 C 65 62, 70 62, 74 62 Z" fill="#fcfdfe"/>
    </g>
    <text x="78" y="26" class="drift-idle-zzz" font-size="13">Z</text>
    <text x="89" y="15" class="drift-idle-zzz drift-idle-zzz-2" font-size="9">z</text>
  </svg>`;

window.isIdleScreenOn = false;
let idleTimer = null;
let idleClockTimer = null;
let idleHiddenAt = null;
let idleLeaving = false;

function updateIdleClock(screen) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  screen.querySelector(".drift-idle-time").textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  screen.querySelector(".drift-idle-date").textContent =
    `${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${IDLE_WEEKDAYS[now.getDay()]}`;
}

function showIdleScreen() {
  if (window.isIdleScreenOn) return;
  window.isIdleScreenOn = true;
  idleLeaving = false;
  clearTimeout(idleTimer);

  // 收起手機鍵盤；已輸入的文字會保留
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  const screen = document.createElement("div");
  screen.id = "drift-idle-screen";
  screen.className = "drift-idle";
  screen.tabIndex = 0;
  screen.setAttribute("role", "button");
  screen.setAttribute("aria-label", "待機中，點一下回到原本的頁面");

  const bottles = IDLE_BOTTLES.map(
    ([left, top, size, opacity, dur, far], i) =>
      `<span class="drift-idle-bottle${far ? " far" : ""}" style="left:${left}%;top:${top}%;font-size:${size}cqmin;opacity:${opacity};animation-duration:${dur}s;animation-delay:-${i * 1.7}s"></span>`,
  ).join("");
  const bubbles = IDLE_BUBBLES.map(
    ([left, size, dur], i) =>
      `<span class="drift-idle-bubble" style="left:${left}%;width:${size}cqmin;height:${size}cqmin;animation-duration:${dur}s;animation-delay:-${i * 2.1}s"></span>`,
  ).join("");

  screen.innerHTML = `
    ${bottles}${bubbles}
    <div class="drift-idle-center">
      <div class="drift-idle-time"></div>
      <div class="drift-idle-date"></div>
      ${IDLE_CAT_SVG}
      <div class="drift-idle-title">小助理睡著了…</div>
      <div class="drift-idle-quote"></div>
    </div>
    <div class="drift-idle-hint">點一下叫醒牠</div>`;
  screen.querySelector(".drift-idle-quote").textContent =
    IDLE_QUOTES[Math.floor(Math.random() * IDLE_QUOTES.length)];
  updateIdleClock(screen);
  idleClockTimer = setInterval(() => updateIdleClock(screen), 10000);

  // 點擊與觸控只屬於待機畫面，不傳到底下的頁面（避免誤開瓶子或召喚貓咪）
  ["pointerdown", "mousedown", "touchstart", "touchend", "dblclick"].forEach((type) =>
    screen.addEventListener(type, (e) => e.stopPropagation()),
  );
  screen.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideIdleScreen();
  });

  document.body.appendChild(screen);
  screen.focus({ preventScroll: true });
}

function hideIdleScreen() {
  const screen = document.getElementById("drift-idle-screen");
  if (!screen || idleLeaving) return;
  idleLeaving = true;
  clearInterval(idleClockTimer);
  screen.classList.add("leaving");
  setTimeout(() => {
    screen.remove();
    window.isIdleScreenOn = false;
    idleLeaving = false;
    resetIdleTimer();
  }, 350);
}

function resetIdleTimer() {
  if (window.isIdleScreenOn) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleScreen, IDLE_TIMEOUT_MS);
}

["pointerdown", "pointermove", "touchstart", "wheel", "keydown"].forEach((type) =>
  document.addEventListener(type, resetIdleTimer, { passive: true, capture: true }),
);
// 捲動事件不會冒泡，用 capture 才收得到 .main-feed 等內層的捲動
document.addEventListener("scroll", resetIdleTimer, { passive: true, capture: true });

// 待機中按鍵盤：不讓按鍵打進底下的輸入框，Enter / 空白 / Esc 可以叫醒
document.addEventListener(
  "keydown",
  (e) => {
    if (!window.isIdleScreenOn) return;
    e.preventDefault();
    e.stopPropagation();
    if (["Enter", " ", "Escape"].includes(e.key)) hideIdleScreen();
  },
  true,
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    idleHiddenAt = Date.now();
    return;
  }
  if (idleHiddenAt && Date.now() - idleHiddenAt >= IDLE_TIMEOUT_MS) {
    showIdleScreen();
  } else {
    resetIdleTimer();
  }
  idleHiddenAt = null;
});

resetIdleTimer();

// =========================================
// 🚫 封鎖使用者：雙擊（電腦）／長按（手機）→ 確認視窗
//   觸發點：瓶子作者、留言與回覆的留言者、我的追蹤名單
//   瓶子作者從目前開著的瓶子拿 id；其他地方在元素上標 data-block-id / data-block-name
//   （匿名留言的 data-block-id 是空的，點了會提示無法封鎖）
// =========================================
const BLOCK_TRIGGER_SELECTOR =
  "#detail-author-tag, .detail-author-box .detail-avatar, [data-block-id]";
const LONG_PRESS_MS = 550;
let pendingBlockTarget = null;

function blockToast(message) {
  if (typeof showOceanToast === "function") showOceanToast(message);
  else alert(message);
}

// 共用檢查：登入、匿名、自己
function openBlockModalFor(targetId, targetName) {
  if (!localStorage.getItem("authToken")) {
    blockToast("請先登入才能封鎖喔！🔒");
    return;
  }
  if (!targetId) {
    blockToast("這位使用者是匿名的，無法封鎖喔！👻");
    return;
  }
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const myId = currentUser.id || currentUser.userId || currentUser.user_id;
  if (myId && String(targetId) === String(myId)) {
    blockToast("不能封鎖自己喔！🐾");
    return;
  }

  pendingBlockTarget = { id: String(targetId), name: targetName || "這位使用者" };
  document.getElementById("block-target-name").textContent = pendingBlockTarget.name;
  document.getElementById("block-modal").style.display = "block";
}

// 瓶子作者
window.openBlockModal = function () {
  const p = posts.find((x) => String(x.id) === String(currentOpenPostId));
  if (!p) return;
  const isAnonymous = p.author === "匿名" || !p.authorId;
  openBlockModalFor(isAnonymous ? null : p.authorId, p.author);
};

function openBlockFromElement(el) {
  const tagged = el.closest("[data-block-id]");
  if (tagged) {
    openBlockModalFor(tagged.dataset.blockId, tagged.dataset.blockName);
  } else {
    openBlockModal();
  }
}

window.closeBlockModal = function () {
  document.getElementById("block-modal").style.display = "none";
  pendingBlockTarget = null;
};

window.confirmBlockAuthor = async function () {
  if (!pendingBlockTarget) return;
  const token = localStorage.getItem("authToken");
  if (!token) return;

  const { id, name } = pendingBlockTarget;
  const confirmBtn = document.getElementById("block-confirm-btn");
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/block/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      blockToast(`封鎖失敗：${err.message || "伺服器錯誤"}`);
      return;
    }

    closeBlockModal();

    // 正在看的瓶子是不是對方的（要在下面濾掉 posts 之前判斷）
    const inDetail = document.body.classList.contains("in-detail-view");
    const openPost = posts.find((x) => String(x.id) === String(currentOpenPostId));
    const viewingBlockedAuthor = inDetail && openPost && String(openPost.authorId) === id;

    // 把對方的瓶子從畫面上拿掉（後端之後也不會再給），追蹤關係後端已一併解除
    posts = posts.filter((x) => String(x.authorId) !== id);
    if (window.popularCache) {
      window.popularCache = window.popularCache.filter((x) => String(x.authorId) !== id);
    }
    window._myFollowingIdSet.delete(id);

    // 我的追蹤、我的粉絲名單裡如果有對方，也一起拿掉（封鎖時雙方追蹤都會解除）
    const followingRow = document.getElementById(`following-user-${id}`);
    if (followingRow) {
      followingRow.remove();
      const list = document.getElementById("following-list-container");
      if (list && list.children.length === 0) {
        list.innerHTML =
          '<div style="text-align: center; color: #888; padding: 40px 0;">已無追蹤名單囉！🐟</div>';
      }
    }
    const followerRow = document.getElementById(`follower-user-${id}`);
    if (followerRow) {
      followerRow.remove();
      const list = document.getElementById("followers-list-container");
      if (list && list.children.length === 0) {
        list.innerHTML =
          '<div style="text-align: center; color: #888; padding: 40px 0;">已經沒有粉絲名單囉！🐟</div>';
      }
    }

    if (viewingBlockedAuthor) {
      closePostDetail();
    } else if (inDetail && currentOpenPostId) {
      // 封鎖的是留言者：重新撈留言，對方的留言就會消失
      renderComments(currentOpenPostId);
    }
    applyFilters();
    fetchPopularBottles();
    blockToast(`已封鎖「${name}」，你們不會再看到彼此的漂流瓶和留言了。`);
  } catch (error) {
    console.error("封鎖發生錯誤", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
};

// 電腦：雙擊作者。在 document 攔下來，才不會同時觸發 window 上「雙擊召喚貓咪」
document.addEventListener("dblclick", (e) => {
  if (!(e.target instanceof Element)) return;
  const el = e.target.closest(BLOCK_TRIGGER_SELECTOR);
  if (!el) return;
  e.stopPropagation();
  openBlockFromElement(el);
});

// 手機：長按作者
let blockPressTimer = null;
let blockPressStart = null;
let blockPressFired = false;

function cancelBlockPress() {
  clearTimeout(blockPressTimer);
  blockPressTimer = null;
}

document.addEventListener(
  "touchstart",
  (e) => {
    blockPressFired = false;
    if (!(e.target instanceof Element)) return;
    const el = e.target.closest(BLOCK_TRIGGER_SELECTOR);
    if (!el) return;
    const t = e.touches[0];
    blockPressStart = { x: t.clientX, y: t.clientY };
    cancelBlockPress();
    blockPressTimer = setTimeout(() => {
      blockPressTimer = null;
      blockPressFired = true;
      if (navigator.vibrate) navigator.vibrate(30);
      openBlockFromElement(el);
    }, LONG_PRESS_MS);
  },
  { passive: true },
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (!blockPressTimer || !blockPressStart) return;
    const t = e.touches[0];
    // 手指滑動超過 10px 就當作是在捲動，不是長按
    if (Math.hypot(t.clientX - blockPressStart.x, t.clientY - blockPressStart.y) > 10) {
      cancelBlockPress();
    }
  },
  { passive: true },
);

document.addEventListener(
  "touchend",
  (e) => {
    cancelBlockPress();
    // 長按已經叫出視窗，就吃掉這次放開手指，避免又觸發點擊或「雙擊召喚貓咪」
    if (blockPressFired) {
      e.preventDefault();
      e.stopPropagation();
      blockPressFired = false;
    }
  },
  { passive: false },
);

document.addEventListener("touchcancel", cancelBlockPress, { passive: true });

// Android 長按會跳出系統選單，作者名字上關掉它
document.addEventListener("contextmenu", (e) => {
  if (e.target instanceof Element && e.target.closest(BLOCK_TRIGGER_SELECTOR)) {
    e.preventDefault();
  }
});

// =========================================
// 🚫 封鎖名單：列出我封鎖的人，可以解除封鎖
// =========================================
window.openBlockedModal = async function () {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.remove("show-dropdown");

  const modal = document.getElementById("blocked-modal");
  const container = document.getElementById("blocked-list-container");
  if (!modal || !container) return;

  modal.style.setProperty("display", "flex", "important");
  container.innerHTML =
    '<div style="text-align: center; color: #888; padding: 30px 0;">正在讀取封鎖名單...🌊</div>';

  const token = localStorage.getItem("authToken");
  if (!token) {
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">寶寶，請先登入才能查看封鎖名單喔！</div>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/block`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      container.innerHTML =
        '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">資料讀取失敗，海象不佳 😢</div>';
      return;
    }

    const backendData = await response.json();
    const blockedList = backendData.data || [];

    if (blockedList.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; color: #888; padding: 40px 0; font-size: 0.95rem;">目前沒有封鎖任何人，海面一片平靜 🐟</div>';
      return;
    }

    container.innerHTML = blockedList
      .map((user) => {
        const uId = String(user.member_id);
        const uName = user.name || "神秘海友";
        return `
          <div class="following-item" id="blocked-user-${escapeHTML(uId)}">
              <div class="following-info">
                  <img src="images/fish_logo.webp" class="following-avatar" />
                  <span class="following-name" title="${escapeHTML(uName)}">${escapeHTML(uName)}</span>
              </div>
              <button
                type="button"
                class="btn-unfollow-modal"
                onclick="unblockFromModal('${escapeHTML(uId)}', ${escapeHTML(JSON.stringify(String(uName)))}, this)"
              >
                解除封鎖
              </button>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error("取得封鎖名單連線錯誤:", error);
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">伺服器連線失敗！</div>';
  }
};

window.closeBlockedModal = function () {
  const modal = document.getElementById("blocked-modal");
  if (modal) modal.style.setProperty("display", "none", "important");
};

window.unblockFromModal = async function (targetId, targetName, btn) {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/block/${targetId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      blockToast(`解除封鎖失敗：${err.message || "伺服器錯誤"}`);
      if (btn) btn.disabled = false;
      return;
    }

    const row = document.getElementById(`blocked-user-${targetId}`);
    if (row) {
      row.style.transition = "all 0.3s ease";
      row.style.opacity = "0";
      row.style.transform = "translateX(10px)";
      setTimeout(() => {
        row.remove();
        const list = document.getElementById("blocked-list-container");
        if (list && list.children.length === 0) {
          list.innerHTML =
            '<div style="text-align: center; color: #888; padding: 40px 0;">已經沒有封鎖的人囉！🐟</div>';
        }
      }, 300);
    }

    // 追蹤關係在封鎖時已經解除，解除封鎖不會自動恢復
    blockToast(`已解除封鎖「${targetName}」，之後撈瓶子就能再看到對方的漂流瓶了。`);
  } catch (error) {
    console.error("解除封鎖失敗:", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
    if (btn) btn.disabled = false;
  }
};

// =========================================
// 👥 粉絲名單：誰在追蹤我，可以直接回追蹤／取消追蹤
//   名字與頭像一樣可以雙擊（電腦）／長按（手機）封鎖
// =========================================
function renderFollowBackButton(uId, uName) {
  const isFollowing = window._myFollowingIdSet.has(String(uId));
  const nameArg = escapeHTML(JSON.stringify(String(uName)));
  if (isFollowing) {
    return `
      <button
        type="button"
        class="btn-unfollow-modal"
        onmouseenter="this.innerText='取消追蹤'"
        onmouseleave="this.innerText='已追蹤'"
        onclick="toggleFollowFromFollowers('${escapeHTML(uId)}', ${nameArg}, this)"
      >
        已追蹤
      </button>`;
  }
  return `
      <button
        type="button"
        class="btn-unfollow-modal btn-follow-back"
        onclick="toggleFollowFromFollowers('${escapeHTML(uId)}', ${nameArg}, this)"
      >
        + 回追蹤
      </button>`;
}

window.openFollowersModal = async function () {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.remove("show-dropdown");

  const modal = document.getElementById("followers-modal");
  const container = document.getElementById("followers-list-container");
  if (!modal || !container) return;

  modal.style.setProperty("display", "flex", "important");
  container.innerHTML =
    '<div style="text-align: center; color: #888; padding: 30px 0;">正在打撈你的粉絲名單...🌊</div>';

  const token = localStorage.getItem("authToken");
  if (!token) {
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">寶寶，請先登入才能查看粉絲名單喔！</div>';
    return;
  }

  try {
    // 先同步我追蹤了誰，才知道每位粉絲要顯示「已追蹤」還是「回追蹤」
    const [response] = await Promise.all([
      fetch(`${API_BASE_URL}/auth/followers`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      }),
      syncMyFollowingList(),
    ]);

    if (!response.ok) {
      container.innerHTML =
        '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">資料讀取失敗，海象不佳 😢</div>';
      return;
    }

    const backendData = await response.json();
    const followerList = backendData.data || [];

    if (followerList.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; color: #888; padding: 40px 0; font-size: 0.95rem;">還沒有人追蹤你，多丟幾個漂流瓶吧！🐟</div>';
      return;
    }

    container.innerHTML = followerList
      .map((user) => {
        const uId = String(user.member_id);
        const uName = user.name || "神秘海友";
        return `
          <div class="following-item" id="follower-user-${escapeHTML(uId)}">
              <div class="following-info" data-block-id="${escapeHTML(uId)}" data-block-name="${escapeHTML(uName)}">
                  <img src="images/fish_logo.webp" class="following-avatar" />
                  <span class="following-name" title="${escapeHTML(uName)}">${escapeHTML(uName)}</span>
              </div>
              ${renderFollowBackButton(uId, uName)}
          </div>
        `;
      })
      .join("");
  } catch (error) {
    console.error("取得粉絲名單連線錯誤:", error);
    container.innerHTML =
      '<div style="text-align: center; color: #ff4d4d; padding: 30px 0;">伺服器連線失敗！</div>';
  }
};

window.closeFollowersModal = function () {
  const modal = document.getElementById("followers-modal");
  if (modal) modal.style.setProperty("display", "none", "important");
};

window.toggleFollowFromFollowers = async function (targetId, targetName, btn) {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ followedId: targetId, followed_id: targetId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      blockToast(`操作失敗：${err.message || "伺服器錯誤"}`);
      if (btn) btn.disabled = false;
      return;
    }

    const result = await response.json().catch(() => ({}));
    const isFollowing =
      result.data?.isFollowing ?? !window._myFollowingIdSet.has(String(targetId));

    if (isFollowing) {
      window._myFollowingIdSet.add(String(targetId));
      blockToast(`已回追蹤 ${targetName} 💙`);
    } else {
      window._myFollowingIdSet.delete(String(targetId));
      blockToast(`已取消追蹤 ${targetName} 💔`);
    }

    // 只換掉按鈕，名單其他列不動
    if (btn) btn.outerHTML = renderFollowBackButton(String(targetId), targetName);
  } catch (error) {
    console.error("回追蹤失敗:", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
    if (btn) btn.disabled = false;
  }
};

// =========================================
// ➕ 留言旁的「+ 追蹤」按鈕
//   匿名（member_id 是 null）與自己的留言不顯示；同一個人可能留好幾則，按一次全部同步
// =========================================
function getMyMemberId() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  return currentUser.id || currentUser.userId || currentUser.user_id || null;
}

function renderCommentFollowBtn(memberId, name) {
  if (memberId === null || memberId === undefined || memberId === "") return "";
  const myId = getMyMemberId();
  if (myId && String(memberId) === String(myId)) return "";

  const id = escapeHTML(String(memberId));
  const isFollowing = window._myFollowingIdSet.has(String(memberId));
  return `<button type="button" class="comment-follow-btn${isFollowing ? " is-following" : ""}" data-follow-id="${id}" title="${isFollowing ? "已追蹤（再按一次取消）" : "追蹤"}" aria-label="${isFollowing ? "已追蹤" : "追蹤"}" onclick="toggleFollowFromComment('${id}', ${escapeHTML(JSON.stringify(String(name || "這位使用者")))}, this)">${isFollowing ? "✓" : "+"}</button>`;
}

function syncFollowButtons(targetId, isFollowing) {
  document
    .querySelectorAll(`.comment-follow-btn[data-follow-id="${CSS.escape(String(targetId))}"]`)
    .forEach((b) => {
      b.classList.toggle("is-following", isFollowing);
      b.textContent = isFollowing ? "✓" : "+";
      b.title = isFollowing ? "已追蹤（再按一次取消）" : "追蹤";
      b.setAttribute("aria-label", isFollowing ? "已追蹤" : "追蹤");
    });

  // 留言者剛好是瓶子作者時，上面的追蹤按鈕也一起變
  const followBtn = document.getElementById("follow-author-btn");
  if (followBtn && String(currentAuthorId) === String(targetId)) {
    followBtn.classList.toggle("following", isFollowing);
    followBtn.innerHTML = isFollowing ? "<span>已追蹤</span>" : "+ 追蹤";
  }
}

window.toggleFollowFromComment = async function (targetId, targetName, btn) {
  const token = localStorage.getItem("authToken");
  if (!token) {
    blockToast("請先登入才能追蹤喔！🔒");
    return;
  }
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/follow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ followedId: targetId, followed_id: targetId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      blockToast(`追蹤失敗：${err.message || "伺服器錯誤"}`);
      return;
    }

    const result = await response.json().catch(() => ({}));
    const isFollowing =
      result.data?.isFollowing ?? !window._myFollowingIdSet.has(String(targetId));

    if (isFollowing) window._myFollowingIdSet.add(String(targetId));
    else window._myFollowingIdSet.delete(String(targetId));

    syncFollowButtons(targetId, isFollowing);
    blockToast(isFollowing ? `已追蹤 ${targetName} 💙` : `已取消追蹤 ${targetName} 💔`);
  } catch (error) {
    console.error("追蹤留言者失敗:", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
  } finally {
    if (btn) btn.disabled = false;
  }
};

// =========================================
// 📰 動態消息：我的追蹤、我的粉絲、封鎖名單、收藏瓶子、我的瓶子 收在同一個視窗
// =========================================
window.openActivityModal = function () {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.remove("show-dropdown");
  const modal = document.getElementById("activity-modal");
  if (modal) modal.style.setProperty("display", "flex", "important");
};

window.closeActivityModal = function () {
  const modal = document.getElementById("activity-modal");
  if (modal) modal.style.setProperty("display", "none", "important");
};

// 從動態消息點進去的名單，關掉時要退回動態消息，不然得從選單重新點一次
let returnToActivity = false;

["closeFollowingModal", "closeFollowersModal", "closeBlockedModal"].forEach((name) => {
  const originalClose = window[name];
  window[name] = function (...args) {
    originalClose.apply(this, args);
    if (returnToActivity) {
      returnToActivity = false;
      openActivityModal();
    }
  };
});

window.openActivityItem = function (key) {
  closeActivityModal();
  switch (key) {
    case "following":
      returnToActivity = true;
      openFollowingModal();
      break;
    case "followers":
      returnToActivity = true;
      openFollowersModal();
      break;
    case "blocked":
      returnToActivity = true;
      openBlockedModal();
      break;
    case "saved":
      window.location.href = "saved.html";
      break;
    case "mine":
      window.location.href = "post.html";
      break;
  }
};

// =========================================
// ✍️ Markdown：發文、留言、回覆都支援
//   marked 負責轉換、DOMPurify 負責把危險的東西清掉（兩支都從 cdnjs 載入）
//   ・不允許圖片：![說明](網址) 會變成連結，外部圖片不會經過 AI 審核
//   ・不允許直接寫 HTML：原樣顯示成文字
//   ・CDN 載不到時退回純文字顯示，不會整頁壞掉
// =========================================
const MD_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "del", "s", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
];
let markdownReady = null; // null：還沒初始化；true / false：能不能用

function ensureMarkdown() {
  if (markdownReady !== null) return markdownReady;
  if (!window.marked || !window.DOMPurify) {
    // 函式庫還沒載到（或 CDN 掛了），先不要記住結果，下次再試
    return false;
  }

  window.marked.use({
    gfm: true,
    breaks: true, // 單純換行就換行，跟大家平常打字的習慣一樣
    renderer: {
      // 直接寫的 HTML 一律當成文字顯示
      html(token) {
        const raw = typeof token === "object" ? token.text : token;
        return escapeHTML(raw);
      },
      // 圖片改成連結
      image(token, title, text) {
        const href = typeof token === "object" ? token.href : token;
        const alt = typeof token === "object" ? token.text : text;
        return `<a href="${escapeHTML(href || "")}">🖼️ ${escapeHTML(alt || "圖片連結")}</a>`;
      },
    },
  });

  // 連結一律開新分頁，並且不帶來源資訊
  window.DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow ugc");
    }
  });

  markdownReady = true;
  return true;
}

function sanitizeMarkdownHtml(html) {
  return window.DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MD_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "title", "start", "align"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i, // 只允許一般網址與信箱
  });
}

// 在已經轉好的 HTML 裡標出搜尋關鍵字（只動文字，不會弄壞標籤）
function highlightInHtml(html, keyword) {
  if (!keyword) return html;
  const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(safeKeyword, "gi");
  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const text = node.nodeValue;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0] === "") break;
      frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      const mark = document.createElement("span");
      mark.className = "highlight";
      mark.textContent = match[0];
      frag.appendChild(mark);
      last = match.index + match[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });

  return tpl.innerHTML;
}

// 文章內容、留言 → 排版好的安全 HTML
function renderMarkdown(text, keyword = "") {
  const source = String(text || "");
  if (!ensureMarkdown()) {
    // 退回純文字：跳脫後保留換行
    return highlightText(escapeHTML(source), keyword).replace(/\n/g, "<br>");
  }
  const html = sanitizeMarkdownHtml(window.marked.parse(source));
  return highlightInHtml(html, keyword);
}

// 列表卡片用：把語法符號拿掉，只留文字
function markdownToPlainText(text) {
  const source = String(text || "");
  if (!ensureMarkdown()) return source;
  const html = sanitizeMarkdownHtml(window.marked.parse(source))
    // 區塊結尾補空白，不然兩段文字會黏在一起
    .replace(/<\/(p|li|h[1-6]|blockquote|pre|tr|th|td)>|<br\s*\/?>/gi, "$& ");
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return tpl.content.textContent.replace(/\s+/g, " ").trim();
}

// ---------- 留言輸入框：改成可換行、會自動長高 ----------
const COMMENT_TEXTAREA_MAX = 120;
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

function autoGrowTextarea(ta) {
  if (!ta || ta.tagName !== "TEXTAREA") return;
  ta.style.removeProperty("height");
  const next = Math.min(ta.scrollHeight + 2, COMMENT_TEXTAREA_MAX);
  // 樣式表的高度是 !important，這裡也要用 !important 才蓋得過
  ta.style.setProperty("height", `${next}px`, "important");
}

// placeholder 後面補上換行方式（手機 Enter 本來就是換行，不用提示）
function withNewlineHint(placeholder) {
  return isTouchDevice ? placeholder : `${placeholder}（Shift+Enter 換行）`;
}

// 輸入框上方那一行：按鍵提示＋預覽按鈕，打開預覽時下面會出現排版結果
function mdMiniHelperHtml() {
  const hint = isTouchDevice
    ? "按鍵盤的 ↵ 換行，按「送出」發佈・支援 Markdown"
    : "<kbd>Enter</kbd> 送出・<kbd>Shift</kbd>+<kbd>Enter</kbd> 換行・支援 Markdown";
  return `
    <div class="md-mini-helper">
      <div class="md-mini-bar">
        <span class="md-mini-hint">${hint}</span>
        <button type="button" class="md-mini-preview-btn" onclick="toggleMiniPreview(this)">👀 預覽</button>
      </div>
      <div class="md-mini-preview md-content" style="display: none"></div>
    </div>`;
}

const MINI_HOST_SELECTOR = ".comment-action-bar, .reply-input-box";

function refreshMiniPreview(ta) {
  const preview = ta?.closest(MINI_HOST_SELECTOR)?.querySelector(".md-mini-preview");
  if (!preview || preview.style.display === "none") return;
  const text = ta.value.trim();
  preview.innerHTML = text
    ? renderMarkdown(text)
    : '<p class="md-preview-empty">還沒有內容可以預覽喔～</p>';
}

window.toggleMiniPreview = function (btn) {
  const host = btn.closest(MINI_HOST_SELECTOR);
  const preview = host?.querySelector(".md-mini-preview");
  const ta = host?.querySelector("textarea");
  if (!preview || !ta) return;

  const opening = preview.style.display === "none";
  preview.style.display = opening ? "block" : "none";
  btn.textContent = opening ? "✕ 關閉預覽" : "👀 預覽";
  btn.classList.toggle("active", opening);
  if (opening) refreshMiniPreview(ta);
  ta.focus();
};

// 各頁的留言框原本是單行 <input>，統一換成 <textarea>，並在上方加提示與預覽
function upgradeCommentInputs() {
  document.querySelectorAll("input#new-comment-input").forEach((input) => {
    const ta = document.createElement("textarea");
    ta.id = input.id;
    ta.className = input.className;
    ta.placeholder = withNewlineHint(input.placeholder);
    ta.rows = 1;
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("enterkeyhint", "enter"); // 手機鍵盤顯示「換行」，不要顯示成「前往／送出」
    if (input.name) ta.name = input.name;
    input.replaceWith(ta);
  });

  document.querySelectorAll(".comment-action-bar").forEach((bar) => {
    if (!bar.querySelector("textarea.comment-input") || bar.querySelector(".md-mini-helper")) return;
    bar.classList.add("has-md-helper");
    bar.insertAdjacentHTML("afterbegin", mdMiniHelperHtml());
  });
}
upgradeCommentInputs();
document.addEventListener("DOMContentLoaded", upgradeCommentInputs);

document.addEventListener("input", (e) => {
  if (e.target.matches?.("textarea.comment-input, textarea.custom-reply-input")) {
    autoGrowTextarea(e.target);
    refreshMiniPreview(e.target);
  }
});

// 電腦：Enter 送出、Shift+Enter 換行；手機：Enter 換行，用送出按鈕送
document.addEventListener("keydown", (e) => {
  const ta = e.target;
  if (!ta.matches?.("textarea.comment-input, textarea.custom-reply-input")) return;
  if (e.key !== "Enter" || e.shiftKey || isTouchDevice) return;
  if (e.isComposing || e.keyCode === 229) return; // 注音、拼音選字中的 Enter 不算

  e.preventDefault();
  if (ta.classList.contains("comment-input")) {
    submitComment();
  } else {
    const sendBtn = ta.closest(".reply-input-wrapper")?.querySelector(".send-btn");
    if (sendBtn) sendBtn.click();
  }
});

// ---------- 發文視窗：預覽切換 ----------
function setPostPreview(on) {
  const textarea = document.getElementById("post-content-input");
  const preview = document.getElementById("post-content-preview");
  const toggle = document.getElementById("post-preview-toggle");
  if (!textarea || !preview || !toggle) return;

  if (on) {
    const text = textarea.value.trim();
    preview.innerHTML = text
      ? renderMarkdown(text)
      : '<p class="md-preview-empty">還沒有內容可以預覽喔～</p>';
    preview.style.height = `${textarea.offsetHeight}px`;
    textarea.style.display = "none";
    preview.style.display = "block";
    toggle.textContent = "✏️ 繼續編輯";
    toggle.classList.add("active");
  } else {
    preview.style.display = "none";
    textarea.style.display = "";
    toggle.textContent = "👀 預覽";
    toggle.classList.remove("active");
  }
}

window.togglePostPreview = function () {
  const preview = document.getElementById("post-content-preview");
  setPostPreview(!(preview && preview.style.display === "block"));
};

(function setupPostPreview() {
  const form = document.getElementById("new-post-form");
  const textarea = document.getElementById("post-content-input");
  if (!form || !textarea) return;
  // 發文成功後表單會 reset，順便回到編輯模式
  form.addEventListener("reset", () => setPostPreview(false));
  // 內容沒填就按送出時，瀏覽器要把游標帶回輸入框，所以先切回編輯
  textarea.addEventListener("invalid", () => setPostPreview(false));
})();

// =========================================
// ✏️ 修改與刪除：留言（本人隨時可刪、20 分鐘內可改）、瓶子（本人 20 分鐘內可改）
//   20 分鐘以伺服器為準，這裡只用來決定要不要顯示按鈕
// =========================================
const EDIT_WINDOW_MS = 20 * 60 * 1000;
const commentRawContent = new Map(); // 留言 id → 原始文字（編輯框要放原文，不是排版後的 HTML）

function editMinutesLeft(createdAt) {
  const created = new Date(createdAt).getTime();
  if (!createdAt || isNaN(created)) return 0;
  return Math.max(0, Math.ceil((created + EDIT_WINDOW_MS - Date.now()) / 60000));
}

function authJsonHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("authToken")}`,
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
}

// 自己的留言／回覆才有的「編輯」「刪除」；主留言放在動作列裡，回覆自己一行
function renderOwnCommentActions(comment, inline = false) {
  if (!comment.is_mine || comment.is_deleted) return "";
  const id = escapeHTML(String(comment.id));
  const canEdit = editMinutesLeft(comment.createdAt) > 0;
  const buttons = `
    ${canEdit ? `<span class="action-btn own-action" onclick="startEditComment('${id}', this)">✏️ 編輯</span>` : ""}
    <span class="action-btn own-action own-action-danger" onclick="deleteOwnComment('${id}')">🗑️ 刪除</span>`;
  return inline ? buttons : `<div class="reply-own-actions">${buttons}</div>`;
}

window.startEditComment = function (commentId, btn) {
  const card = btn.closest(".ocean-reply-item") || btn.closest(".ocean-comment-card");
  const body = card?.querySelector(`[data-comment-body="${CSS.escape(String(commentId))}"]`);
  if (!body || body.querySelector(".comment-edit-box")) return;

  const raw = commentRawContent.get(String(commentId)) ?? "";
  body.innerHTML = `
    <div class="comment-edit-box">
      <textarea class="comment-edit-input" rows="3"></textarea>
      <div class="comment-edit-bar">
        <span class="comment-edit-hint">支援 Markdown・Esc 取消</span>
        <button type="button" class="comment-edit-cancel">取消</button>
        <button type="button" class="comment-edit-save">儲存</button>
      </div>
    </div>`;
  const ta = body.querySelector(".comment-edit-input");
  ta.value = raw; // 用 value 放原文，不經過 HTML，避免被當成標籤
  ta.focus();
  ta.setSelectionRange(raw.length, raw.length);

  const restore = () => {
    body.innerHTML = renderMarkdown(raw);
  };
  body.querySelector(".comment-edit-cancel").onclick = restore;
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") restore();
  });

  const saveBtn = body.querySelector(".comment-edit-save");
  saveBtn.onclick = async () => {
    const text = ta.value.trim();
    if (!text) {
      blockToast("留言內容不能是空的喔！");
      return;
    }
    if (text === raw.trim()) {
      restore();
      return;
    }
    saveBtn.disabled = true;
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: "PATCH",
        headers: authJsonHeaders(),
        body: JSON.stringify({ content: text }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        blockToast(result.message || "修改失敗，請稍後再試");
        saveBtn.disabled = false;
        return;
      }
      blockToast("✏️ 留言已修改");
      renderComments(currentOpenPostId);
    } catch (error) {
      console.error("修改留言失敗:", error);
      blockToast("伺服器連線失敗，請稍後再試 😢");
      saveBtn.disabled = false;
    }
  };
};

window.deleteOwnComment = async function (commentId) {
  if (!confirm("確定要刪除這則留言嗎？刪除後就救不回來了。")) return;
  try {
    const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
      method: "DELETE",
      headers: authJsonHeaders(),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      blockToast(result.message || "刪除失敗，請稍後再試");
      return;
    }
    blockToast("🗑️ 留言已刪除");
    renderComments(currentOpenPostId);
  } catch (error) {
    console.error("刪除留言失敗:", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
  }
};

// ---------- 瓶子：20 分鐘內可以修改 ----------
function canEditBottle(p) {
  return Boolean(p && p.isMine && editMinutesLeft(p.createdAt) > 0);
}

// 文章畫面：作者區塊旁的「修改」按鈕、時間後面的「已編輯」
function afterOpenPostDetail(p) {
  document.querySelectorAll(".detail-author-text").forEach((box) => {
    let btn = box.querySelector(".detail-edit-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "detail-edit-btn";
      btn.textContent = "✏️ 修改";
      box.appendChild(btn);
    }
    btn.onclick = () => openEditBottleModal(p.id);
    btn.style.display = canEditBottle(p) ? "" : "none";
  });

  if (p.editedAt) {
    document.querySelectorAll(".detail-post-time").forEach((el) => {
      el.insertAdjacentHTML("beforeend", ' <span class="comment-edited-tag">已編輯</span>');
    });
  }
}

function ensureEditBottleModal() {
  let modal = document.getElementById("edit-bottle-modal");
  if (modal) return modal;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="edit-bottle-modal" class="modal" onclick="if (event.target === this) closeEditBottleModal()">
      <div class="modal-content light-modal">
        <span class="close-btn" onclick="closeEditBottleModal()">&times;</span>
        <h3 class="edit-bottle-title">✏️ 修改漂流瓶</h3>
        <p class="edit-bottle-left" id="edit-bottle-left"></p>
        <input type="text" id="edit-bottle-title-input" class="light-input" placeholder="標題" autocomplete="off" />
        <textarea id="edit-bottle-content-input" class="light-input" rows="8" placeholder="內容（支援 Markdown）"></textarea>
        <p class="edit-bottle-note">修改後會重新審核，審核通過前其他人暫時看不到這個瓶子。</p>
        <div class="edit-bottle-actions">
          <button type="button" class="btn-submit edit-bottle-cancel" onclick="closeEditBottleModal()">取消</button>
          <button type="button" class="btn-submit edit-bottle-save" id="edit-bottle-save" onclick="saveEditBottle()">儲存修改</button>
        </div>
      </div>
    </div>`,
  );
  return document.getElementById("edit-bottle-modal");
}

let editingBottleId = null;

window.openEditBottleModal = function (bottleId, e) {
  if (e) e.stopPropagation(); // 從列表卡片按的話，不要順便打開文章
  const p = posts.find((x) => String(x.id) === String(bottleId));
  if (!p) return;
  const left = editMinutesLeft(p.createdAt);
  if (!p.isMine || left <= 0) {
    blockToast("發文超過 20 分鐘就不能修改了");
    return;
  }

  const modal = ensureEditBottleModal();
  editingBottleId = p.id;
  document.getElementById("edit-bottle-left").textContent = `還可以修改約 ${left} 分鐘`;
  document.getElementById("edit-bottle-title-input").value = p.title || "";
  document.getElementById("edit-bottle-content-input").value = p.desc || "";
  modal.style.display = "block";
};

window.closeEditBottleModal = function () {
  const modal = document.getElementById("edit-bottle-modal");
  if (modal) modal.style.display = "none";
  editingBottleId = null;
};

window.saveEditBottle = async function () {
  if (!editingBottleId) return;
  const title = document.getElementById("edit-bottle-title-input").value.trim();
  const content = document.getElementById("edit-bottle-content-input").value.trim();
  if (!title || !content) {
    blockToast("標題和內容都不能是空的喔！");
    return;
  }

  const saveBtn = document.getElementById("edit-bottle-save");
  saveBtn.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/bottles/${editingBottleId}`, {
      method: "PATCH",
      headers: authJsonHeaders(),
      body: JSON.stringify({ title, content }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      blockToast(result.message || "修改失敗，請稍後再試");
      return;
    }

    const p = posts.find((x) => String(x.id) === String(editingBottleId));
    if (p && result.data?.changed) {
      p.title = title;
      p.desc = content;
      p.editedAt = result.data.edited_at;
    }
    closeEditBottleModal();
    blockToast(result.message || "瓶子已修改");

    if (p && document.body.classList.contains("in-detail-view")) openPostDetail(p.id);
    applyFilters();
  } catch (error) {
    console.error("修改瓶子失敗:", error);
    blockToast("伺服器連線失敗，請稍後再試 😢");
  } finally {
    saveBtn.disabled = false;
  }
};

// =========================================
// 📝 個人檔案的自我介紹也支援 Markdown（主頁、我的瓶子頁共用）
// =========================================
function renderBio(el, bio) {
  if (!el) return;
  const text = String(bio || "").trim();
  el.classList.add("md-content", "bio-md");
  el.innerHTML = text
    ? renderMarkdown(text)
    : '<span class="bio-empty">這瓶子裡目前空空的...</span>';
}
window.renderBio = renderBio;

// =========================================
// 📐 量標題列的實際高度，給文章畫面接在它正下方（手機版標題列比較高，會蓋住文章上方）
// =========================================
(function trackHeaderHeight() {
  const header = document.querySelector(".light-header");
  if (!header) return;
  const update = () => {
    const h = Math.ceil(header.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty("--site-header-h", `${h}px`);
  };
  update();
  if (window.ResizeObserver) new ResizeObserver(update).observe(header);
  window.addEventListener("resize", update);
})();
