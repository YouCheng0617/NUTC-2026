// =========================================
// 🌟 1. 翻譯字典
// =========================================
const i18nNotes = {
  zh: {
    title: "📝 每日便利貼",
    langBtn: "EN",
    backBtn: "回到大廳",
    refreshBtn: "🔄 換一批",
    modalTitle: "📝 寫下今天的便利貼",
    fabBtn: "✏️ 貼上心事",
    dragHint: "🌐 自由拖曳旋轉 3D 球體，點擊任一張便利貼可居中特寫",
    placeholder: "今天想記錄點什麼呢？...",
    addBtn: "發佈便利貼",
    empty: "目前海面上還沒有便利貼，趕快來寫第一張吧！🌊",
    errConn: "無法連接到秘密海域伺服器 🌊",
    warnEmpty: "請輸入便利貼內容！",
    warnLogin: "請先登入才能發佈便利貼！",
    duplicate: "今天已經有寫便利貼了，明天再來吧！",
    success: "發佈成功！已為你貼入海域 ✨",
    fail: "發送失敗，請檢查網路連線！",
    refreshed: "已為你換上一批新便利貼 🌊",
  },
  en: {
    title: "📝 Daily Notes",
    langBtn: "中文",
    backBtn: "Home",
    refreshBtn: "🔄 Refresh",
    modalTitle: "📝 Write a Daily Note",
    fabBtn: "✏️️ Post Note",
    dragHint: "🌐 Drag to rotate 3D sphere, click any note to center",
    placeholder: "What's on your mind today?...",
    addBtn: "Post Note",
    empty: "No notes yet in the ocean. Be the first to write one! 🌊",
    errConn: "Cannot connect to the Secret Ocean server 🌊",
    warnEmpty: "Please enter note content!",
    warnLogin: "Please login to post a note!",
    duplicate: "You already posted today. Come back tomorrow!",
    success: "Posted successfully! ✨",
    fail: "Failed to send, please check network!",
    refreshed: "Loaded a new batch of notes 🌊",
  },
};

let currLangNotes = "zh";
window.allNotesPool = [];
window.activeSphereNotes = [];

window.toggleLang = function () {
  currLangNotes = currLangNotes === "zh" ? "en" : "zh";
  const t = i18nNotes[currLangNotes];

  document.getElementById("page-title").innerText = t.title;
  document.getElementById("btn-lang").innerText = t.langBtn;
  document.getElementById("btn-back").innerText = t.backBtn;
  document.getElementById("btn-refresh").innerText = t.refreshBtn;
  document.getElementById("modal-title").innerText = t.modalTitle;
  document.getElementById("fab-create-btn").innerText = t.fabBtn;
  document.getElementById("drag-hint").innerText = t.dragHint;
  document.getElementById("note-text").placeholder = t.placeholder;
  document.getElementById("add-note-btn").innerText = t.addBtn;

  if (window.activeSphereNotes.length > 0) {
    window._renderSphereNotes(window.activeSphereNotes);
  }
};

window.toggleCreatorModal = function (show) {
  const modal = document.getElementById("creator-modal");
  modal.style.display = show ? "flex" : "none";
  if (show) document.getElementById("note-text").focus();
};

// =========================================
// 🌟 2. 3D 球體互動核心 (精確矩陣導航版)
// =========================================
(async () => {
  const textInput = document.getElementById("note-text");
  const charCount = document.getElementById("char-count");
  const addBtn = document.getElementById("add-note-btn");
  const notesBoard = document.getElementById("notes-board");
  const viewport = document.getElementById("sphere-viewport");

  const updateCharCount = () => {
    if (!charCount) return;
    const len = textInput.value.length;
    charCount.innerText = `${len} / 50`;
    if (len >= 50) charCount.classList.add("limit");
    else charCount.classList.remove("limit");
  };
  textInput.addEventListener("input", updateCharCount);

  const API_BASE_URL = "https://api.drift-bottles.xyz";
  const API_URL = `${API_BASE_URL}/game/daily-note`;
  const themeColors = [
    "#ff9a9e",
    "#fecfef",
    "#a1c4fd",
    "#c2e9fb",
    "#e0c3fc",
    "#fef08a",
    "#bbf7d0",
    "#fed7aa",
  ];

  // 🌐 球體姿態參數
  let rotX = 0; // 俯仰角 (Pitch)
  let rotY = 0; // 水平偏航角 (Yaw)
  let velX = 0;
  let velY = 0;
  let isDragging = false;
  let dragDistance = 0; // 用於區分「拖曳」還是「單擊」
  let isNavigating = false;
  let targetRotX = 0,
    targetRotY = 0;
  let lastX = 0,
    lastY = 0;
  let lastInteractTime = Date.now();

  // 🌟 手機改為 165px，確保 360 度旋轉時便利貼都在直立螢幕視野內
  const getRadius = () => (window.innerWidth <= 600 ? 165 : 400);

  const fetchNotes = async () => {
    try {
      const res = await fetch(API_URL);
      const rawData = await res.json();
      const serverData = rawData.data || [];
      window.allNotesPool = Array.isArray(serverData) ? serverData : [];
      pickAndRenderBatch();
    } catch (error) {
      console.error("連線錯誤：", error);
      window.allNotesPool = [];
      pickAndRenderBatch();
    }
  };

  // 抽樣並渲染：依「純文字內容」去重
  function pickAndRenderBatch() {
    if (!window.allNotesPool || window.allNotesPool.length === 0) {
      window.activeSphereNotes = [];
      window._renderSphereNotes([]);
      return;
    }

    const uniqueNotes = [];
    const seenContent = new Set();
    for (const note of window.allNotesPool) {
      if (!note || !note.content) continue;
      const textKey = note.content.trim();
      if (textKey && !seenContent.has(textKey)) {
        seenContent.add(textKey);
        uniqueNotes.push(note);
      }
    }

    const shuffled = [...uniqueNotes].sort(() => 0.5 - Math.random());
    window.activeSphereNotes = shuffled.slice(0, 16);
    window._renderSphereNotes(window.activeSphereNotes);
  }

  window.refreshNotes = function () {
    notesBoard.classList.add("refreshing");
    setTimeout(() => {
      pickAndRenderBatch();
      rotX = 0;
      rotY = 0;
      velX = 0;
      velY = 0;
      isNavigating = false;
      notesBoard.classList.remove("refreshing");
      showToast(i18nNotes[currLangNotes].refreshed, "success");
    }, 220);
  };

  // ✨ 修正版：避開極點死角，讓所有卡片都有弧形公轉動態
  function calculateSpherePositions(total, radius) {
    if (total <= 0) return [];
    if (total === 1) return [{ x0: 0, y0: 0, z0: radius }];

    if (total <= 4) {
      const coords = [];
      const step = (Math.PI * 2) / total;
      for (let i = 0; i < total; i++) {
        const angle = i * step;
        coords.push({
          x0: Math.sin(angle) * radius,
          y0: i % 2 === 0 ? -30 : 30,
          z0: Math.cos(angle) * radius,
        });
      }
      return coords;
    }

    const coords = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // 黃金角

    for (let i = 0; i < total; i++) {
      // 🌟 核心修復：使用 (i + 0.5) / total 避免剛好落在 1 與 -1 的死點
      // 並乘上 0.76 收縮南北極，確保每張牌都至少有 60% 以上的水平旋轉半徑
      // 🌟 垂直收縮係數改為 0.65，避免最上方的牌衝撞到頂部導覽列
      const yNorm = (1 - ((i + 0.5) / total) * 2) * 0.65;
      const radiusAtY = Math.sqrt(Math.max(0.15, 1 - yNorm * yNorm));
      const theta = phi * i;

      const x0 = Math.cos(theta) * radiusAtY * radius;
      // 🌟 垂直高度乘上 0.85，給頂部和底部的 UI 留出充足空間
      const y0 = yNorm * radius * 0.85;
      const z0 = Math.sin(theta) * radiusAtY * radius;

      coords.push({ x0, y0, z0 });
    }
    return coords;
  }

  window._renderSphereNotes = (notes) => {
    notesBoard.innerHTML = "";
    if (!notes || notes.length === 0) {
      notesBoard.innerHTML = `<div style="position: absolute; width: 320px; left: -160px; text-align: center; color: rgba(255,255,255,0.7); font-size: 1.1rem;">${i18nNotes[currLangNotes].empty}</div>`;
      return;
    }

    const total = notes.length;
    const R = getRadius();
    const baseCoords = calculateSpherePositions(total, R);

    notes.forEach((note, index) => {
      const coord = baseCoords[index];
      const randomColor = themeColors[index % themeColors.length];
      const dateObj = new Date(note.created_at);
      const timeString = isNaN(dateObj.getTime())
        ? "剛剛"
        : dateObj.toLocaleTimeString("zh-TW", {
            hour: "2-digit",
            minute: "2-digit",
          });

      const card = document.createElement("div");
      card.className = "note-card";
      card.style.background = randomColor;

      card.innerHTML = `
        <div class="note-text">${escapeHTML(note.content)}</div>
        <div class="note-footer"><span>🕒 ${timeString}</span></div>
      `;

      card.dataset.x0 = coord.x0;
      card.dataset.y0 = coord.y0;
      card.dataset.z0 = coord.z0;

      // 點擊特寫（加入位移閥值判斷，避免滑動時誤觸）
      card.onclick = (e) => {
        if (dragDistance > 6) return;
        navigateToCard(coord);
      };

      notesBoard.appendChild(card);
    });

    updateSphereTransforms();
  };

  // 🌟 標準 3D 矩陣投影（先 Y 水平偏航，再 X 垂直俯仰）
  function updateSphereTransforms() {
    const cards = document.querySelectorAll(".note-card");
    const R = getRadius();
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;
    const cosX = Math.cos(radX),
      sinX = Math.sin(radX);
    const cosY = Math.cos(radY),
      sinY = Math.sin(radY);

    let closestCard = null;
    let maxDepth = -99999;

    cards.forEach((card) => {
      const x0 = parseFloat(card.dataset.x0);
      const y0 = parseFloat(card.dataset.y0);
      const z0 = parseFloat(card.dataset.z0);

      // 1. 水平偏航旋轉 (Yaw - 繞 Y 軸)
      const x1 = x0 * cosY + z0 * sinY;
      const z1 = -x0 * sinY + z0 * cosY;
      const y1 = y0;

      // 2. 垂直俯仰旋轉 (Pitch - 繞 X 軸)
      const y2 = y1 * cosX + z1 * sinX;
      const z2 = -y1 * sinX + z1 * cosX;
      const x2 = x1;

      // 3. 深度標準化 (0 ~ 1)
      const depth = (z2 + R) / (2 * R);

      const scale = 0.55 + depth * 0.55;
      const opacity = 0.22 + Math.pow(Math.max(0, depth), 1.3) * 0.78;
      const blur = (1 - depth) * 3.2;

      // 4. 曲面法向貼合
      const tiltY = (x2 / R) * 36;
      const tiltX = (-y2 / R) * 36;

      card.style.transform = `translate3d(${x2.toFixed(1)}px, ${y2.toFixed(1)}px, 0px) rotateY(${tiltY.toFixed(1)}deg) rotateX(${tiltX.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(2);
      card.style.filter = `blur(${blur.toFixed(1)}px)`;
      card.style.zIndex = Math.round(depth * 100);

      if (depth > maxDepth) {
        maxDepth = depth;
        closestCard = card;
      }
    });

    cards.forEach((c) => c.classList.remove("is-focused"));
    if (closestCard && maxDepth > 0.94) {
      closestCard.classList.add("is-focused");
    }
  }

  // ✨ 核心數學修正：100% 精準逆運算導航（目標剛好座落於 (0, 0, R)）
  function navigateToCard(coord) {
    // 1. 水平所須目標角度
    const targetYaw = -Math.atan2(coord.x0, coord.z0) * (180 / Math.PI);

    // 2. 垂直所須目標角度（取自投影後的深度 z1）
    const z1 = Math.sqrt(coord.x0 * coord.x0 + coord.z0 * coord.z0);
    const targetPitch = -Math.atan2(coord.y0, z1) * (180 / Math.PI);

    targetRotX = Math.max(-65, Math.min(65, targetPitch));

    // 取最短旋轉路徑
    const currentModY = ((rotY % 360) + 360) % 360;
    const destModY = ((targetYaw % 360) + 360) % 360;
    let deltaYaw = destModY - currentModY;
    if (deltaYaw > 180) deltaYaw -= 360;
    if (deltaYaw < -180) deltaYaw += 360;

    targetRotY = rotY + deltaYaw;
    isNavigating = true;
    velX = 0;
    velY = 0;
    lastInteractTime = Date.now();
  }

  // 拖曳控制
  viewport.addEventListener("pointerdown", (e) => {
    isDragging = true;
    isNavigating = false;
    dragDistance = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = 0;
    velY = 0;
    lastInteractTime = Date.now();
  });

  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    dragDistance += Math.abs(dx) + Math.abs(dy);

    rotY += dx * 0.22;
    rotX += dy * 0.22;
    rotX = Math.max(-70, Math.min(70, rotX));

    velY = dx * 0.22;
    velX = dy * 0.22;

    lastX = e.clientX;
    lastY = e.clientY;
    lastInteractTime = Date.now();

    updateSphereTransforms();
  });

  window.addEventListener("pointerup", () => {
    isDragging = false;
  });
  window.addEventListener("pointercancel", () => {
    isDragging = false;
  });

  // 動畫主迴圈
  function renderLoop() {
    if (isNavigating) {
      rotX += (targetRotX - rotX) * 0.09;
      rotY += (targetRotY - rotY) * 0.09;
      updateSphereTransforms();

      // 特寫到位
      if (
        Math.abs(targetRotX - rotX) < 0.15 &&
        Math.abs(targetRotY - rotY) < 0.15
      ) {
        rotX = targetRotX;
        rotY = targetRotY;
        isNavigating = false;
        lastInteractTime = Date.now(); // 重設待機計時，避免剛到位就滑走
      }
    } else if (!isDragging) {
      if (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01) {
        rotX += velX;
        rotY += velY;
        rotX = Math.max(-70, Math.min(70, rotX));

        velX *= 0.93;
        velY *= 0.93;
        updateSphereTransforms();
      } else {
        // 閒置 1.5 秒後悠閒自轉
        if (Date.now() - lastInteractTime > 1500) {
          rotY += 0.07;
          updateSphereTransforms();
        }
      }
    }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  window.addEventListener("resize", () => {
    if (window.activeSphereNotes.length > 0) {
      window._renderSphereNotes(window.activeSphereNotes);
    }
  });

  // 發布便利貼
  const addNote = async () => {
    const content = textInput.value;
    const t = i18nNotes[currLangNotes];

    if (content.trim() === "") {
      showToast(t.warnEmpty, "warning");
      return;
    }
    const token = localStorage.getItem("authToken");
    if (!token) {
      showToast(t.warnLogin, "warning");
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: content }),
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

      const newNoteObj = {
        content: content,
        created_at: new Date().toISOString(),
      };
      window.allNotesPool.unshift(newNoteObj);

      textInput.value = "";
      updateCharCount();
      toggleCreatorModal(false);
      showToast(t.success, "success");

      pickAndRenderBatch();
      rotX = 0;
      rotY = 0;
    } catch (error) {
      console.error("發佈失敗：", error);
      showToast(t.fail, "error");
    }
  };

  const escapeHTML = (str) =>
    str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[tag] || tag,
    );

  addBtn.addEventListener("click", addNote);
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  });

  fetchNotes();
})();

const showToast = (message, type = "normal") => {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, 2800);
};
