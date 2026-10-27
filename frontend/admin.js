// ==========================================
// 1. 設定基礎參數與共用工具
// ==========================================
const PAGE_SIZE = 10; // 🌟 每一頁顯示的資料筆數

function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// 把值轉成可以安全放進 onclick="fn(...)" 的 JS 字串參數
// (escapeHTML 的 &#39; 會被瀏覽器解回單引號，不能單靠它放進 '...' 裡)
function jsArg(value) {
    return escapeHTML(JSON.stringify(String(value)));
}

// 📊 投票瓶子的選項（後台列表、文章內容、檢舉列表共用）
function pollOptionsOf(b) {
    return Array.isArray(b?.poll_options) ? b.poll_options : [];
}

// 打開文章時顯示的投票區塊：每個選項的文字、票數與比例
function renderPollBlock(options) {
    if (options.length === 0) return '';
    const total = options.reduce((sum, o) => sum + (Number(o.votes) || 0), 0);
    const rows = options.map((o, i) => {
        const votes = Number(o.votes) || 0;
        const pct = total ? Math.round(votes / total * 100) : 0;
        return `
            <div style="position: relative; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff;">
                <div style="position: absolute; inset: 0 auto 0 0; width: ${pct}%; background: #eef2ff;"></div>
                <div style="position: relative; display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
                    <span style="color: #1e293b; word-break: break-word;"><b style="color:#64748b; margin-right:6px;">${i + 1}.</b>${escapeHTML(o.text)}</span>
                    <span style="color: #64748b; font-size: 0.9rem; white-space: nowrap;">${votes} 票（${pct}%）</span>
                </div>
            </div>`;
    }).join('');
    return `
        <div style="margin-top: 18px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-weight: 700; color: #4338ca; margin-bottom: 10px;">📊 投票選項（共 ${total} 票）</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">${rows}</div>
        </div>`;
}

// 🌟 解析時間戳記以供排序
function getItemTimestamp(item, idField) {
    if (item.created_at) {
        const t = new Date(item.created_at).getTime();
        if (!isNaN(t)) return t;
    }
    return Number(item[idField] || item.id) || 0;
}

// 🌟 點擊兩下開啟行內頁碼輸入框
window.enableInlinePageInput = function (el, totalItems, currentPage, totalPages, containerId, changePageFuncName) {
    el.removeAttribute('ondblclick');
    el.innerHTML = `第 <input type="text" id="inline-page-input" value="${currentiPage}" style="width: 48px; padding: 2px 4px; text-align: center; border: 1.5px solid #3b82f6; border-radius: 6px; font-weight: bold; color: #1e293b; outline: none; font-size: 0.9rem; margin: 0 4px;" /> / ${totalPages} 頁 (共 ${totalItems} 筆)`;

    const input = document.getElementById('inline-page-input');
    if (!input) return;

    input.focus();
    input.select();

    let isSubmitted = false;
    let isAlerting = false;

    const handleSubmit = () => {
        if (isSubmitted) return;
        const val = input.value.trim();
        const pageNum = Number(val);

        if (!val || !/^\d+$/.test(val) || isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
            isAlerting = true;
            alert("請輸入正確的頁碼");
            isAlerting = false;
            input.focus();
            input.select();
            return;
        }

        isSubmitted = true;
        if (typeof window[changePageFuncName] === 'function') {
            window[changePageFuncName](pageNum);
        }
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            renderPagination(totalItems, currentPage, containerId, changePageFuncName);
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (isSubmitted || isAlerting) return;
            const val = input.value.trim();
            const pageNum = Number(val);
            if (val && /^\d+$/.test(val) && !isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                if (pageNum !== currentPage) {
                    isSubmitted = true;
                    if (typeof window[changePageFuncName] === 'function') {
                        window[changePageFuncName](pageNum);
                        return;
                    }
                }
            }
            renderPagination(totalItems, currentPage, containerId, changePageFuncName);
        }, 150);
    });
};

// 🌟 共用分頁渲染產生器
function renderPagination(totalItems, currentPage, containerId, changePageFuncName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    
    container.innerHTML = `
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${changePageFuncName}(${currentPage - 1})">⬅️ 上一頁</button>
        <span class="pagination-info" title="點擊兩下直接輸入頁碼跳頁" style="cursor: pointer; user-select: none;" ondblclick="enableInlinePageInput(this, ${totalItems}, ${currentPage}, ${totalPages}, '${containerId}', '${changePageFuncName}')">第 ${currentPage} / ${totalPages} 頁 (共 ${totalItems} 筆)</span>
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${changePageFuncName}(${currentPage + 1})">下一頁 ➡️</button>
    `;
}

// ==========================================
// 2. 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("authToken");
    const userStr = localStorage.getItem("currentUser");
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || !user) {
        window.location.href = "login.html";
        return;
    }

    const nameEl = document.getElementById("admin-name");
    if (nameEl) nameEl.innerText = user.name + " (管理員)";

    const lastTab = localStorage.getItem('adminLastTab') || 'dashboard';
    switchAdminTab(lastTab);
});

// ==========================================
// 3. 頁面切換與記憶功能
// ==========================================
window.switchAdminTab = function (tabName) {
    localStorage.setItem('adminLastTab', tabName);

    document.querySelectorAll('.admin-menu li').forEach(item => item.classList.remove('active'));
    const activeMenu = Array.from(document.querySelectorAll('.admin-menu li')).find(item => item.getAttribute('onclick')?.includes(tabName));
    if (activeMenu) activeMenu.classList.add('active');

    document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none');
    document.getElementById('section-' + tabName).style.display = 'block';

    const titleEl = document.getElementById("admin-page-title");
    if (tabName === 'dashboard') {
        titleEl.innerText = "總覽數據";
        loadDashboardData();
    }
    else if (tabName === 'users') { titleEl.innerText = "管理使用者"; loadUsers(); }
    else if (tabName === 'bottles') { titleEl.innerText = "漂流瓶審核"; loadBottles(); }
    else if (tabName === 'reports') { titleEl.innerText = "檢舉處理"; loadReports(); }
    else if (tabName === 'daily-notes') { titleEl.innerText = "便利貼審核"; loadDailyNotes(); }
    else if (tabName === 'game-reports') { titleEl.innerText = "遊戲檢舉"; loadGameReports(); }
    else if (tabName === 'redeem-codes') { titleEl.innerText = "遊戲兌換碼"; loadRedeemCodes(); }
    else if (tabName === 'daily-question') { titleEl.innerText = "今日一題"; loadDailyQuestions(); }
    else if (tabName === 'broadcasts') { titleEl.innerText = "發送通知"; loadBroadcasts(); }
    else if (tabName === 'customer-service') { titleEl.innerText = "客服問題管理"; loadCustomerServices(); }
}

// ==========================================
// 4. 總覽數據與圖表
// ==========================================
let myDoughnutChart = null;
let myZodiacChart = null; 
let myGenderChart = null;
let myBottleGenderChart = null; // 🌟 新增發文者性別圖表變數
let myTrendChart = null;
let myCsTrendChart = null; // 🌟 新增客服案件趨勢圖表變數
let myCommentTypeChart = null; // 🌟 新增留言類型圖表變數
window._dashboardBottles = []; // 🌟 新增：用來暫存文章資料，切換時間時就不用重新打 API
window._dashboardCs = []; // 🌟 新增：用來暫存客服資料，供切換趨勢圖時間使用
let myCommentGenderChart = null; // 🌟 新增：留言男女圖表變數

function genderOf(raw) {
    const g = String(raw || '').toLowerCase().trim();
    if (!g) return 'other';
    if (g === 'male' || g === 'm' || g === '1' || (g.includes('男') && !g.includes('女'))) return 'male';
    if (g === 'female' || g === 'f' || g === '2' || (g.includes('女') && !g.includes('男'))) return 'female';
    return 'other';
}

async function loadDashboardData() {
    const token = localStorage.getItem("authToken");
    try {
        const [usersRes, bottlesRes, commentsRes, csRes, allReports] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/members`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }),
            fetch(`${API_BASE_URL}/admin/bottles`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }),
            fetch(`${API_BASE_URL}/admin/comments`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }).catch(() => null),
            fetch(`${API_BASE_URL}/admin/customer-services`, { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }).catch(() => null),
            fetchAllReports().catch(() => null) // 貼文、留言、便利貼的檢舉
        ]);

        const usersData = await usersRes.json();
        const bottlesData = await bottlesRes.json();
        const commentsData = commentsRes ? await commentsRes.json() : [];
        const csData = csRes ? await csRes.json() : [];

        const users = (usersData.data || usersData || []).filter(u => u.status !== 'DELETED');
        const bottles = bottlesData.data || bottlesData.bottles || bottlesData || [];
        const comments = commentsData.data || commentsData || []; 
        const customerServices = csData.data || csData || [];

        // 1. 更新頂部卡片數字
        document.getElementById('stat-users').innerText = users.length;
        document.getElementById('stat-bottles').innerText = bottles.length;

        // 待處理檢舉：以前只有切到「檢舉處理」分頁才會抓資料，總覽一直顯示預設的假數字
        if (allReports) {
            window._allReports = allReports;
            updateDashboardReportCount();
        } else {
            document.getElementById('stat-reports').innerText = '—';
        }

        const pendingCsCount = customerServices.filter(cs => Number(cs.status || 0) === 0).length;
        const statCsPendingEl = document.getElementById('stat-cs-pending');
        if (statCsPendingEl) statCsPendingEl.innerText = pendingCsCount;

        // 2. 🌟 將文章與客服資料存入全域變數，供切換時間範圍時使用
        window._dashboardBottles = bottles;
        window._dashboardCs = customerServices;

        // --- 準備資料變數 ---
        let angry = 0, secret = 0, broken = 0, apathy = 0, happy = 0;
        const zodiacCounts = { '牡羊座': 0, '金牛座': 0, '雙子座': 0, '巨蟹座': 0, '獅子座': 0, '處女座': 0, '天秤座': 0, '天蠍座': 0, '射手座': 0, '摩羯座': 0, '水瓶座': 0, '雙魚座': 0 };
        let zodiacUnknown = 0; // 沒填、選「不透露」或認不得的寫法
        let maleCount = 0, femaleCount = 0, otherCount = 0;
        let bottleMale = 0, bottleFemale = 0, bottleOther = 0; 
        const userGenderMap = {};

        // --- 分析會員資料 ---
        users.forEach(u => {
            const z = zodiacOf(u.constellation || u.zodiac);
            if (z) zodiacCounts[z]++;
            else zodiacUnknown++;

            const g = genderOf(u.gender || u.sex);
            const uId = u.id || u.member_id;
            if (uId) userGenderMap[uId] = g;

            if (g === 'male') maleCount++;
            else if (g === 'female') femaleCount++;
            else otherCount++;
        });

        // --- 分析文章資料 ---
        bottles.forEach(b => {
            // 情緒統計
            let rawCat = b.category_name || null;
            if (!rawCat && b.categories && b.categories.length > 0) rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
            if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
            if (!rawCat) rawCat = '綜合閒聊';

            if (rawCat.includes("開心") || rawCat.includes("喜悅") || rawCat.includes("快樂")) happy++;
            else if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) angry++;
            else if (rawCat.includes("秘密") || rawCat.includes("程式")) secret++;
            else if (rawCat.includes("破碎") || rawCat.includes("碎片") || rawCat.includes("美食")) broken++;
            else apathy++;
          
            // 發文者性別統計
            let bg = 'other';
            let authorId = b.member_id || b.author_id;
            
            if (b.member_gender) {
                bg = genderOf(b.member_gender);
            } else if (b.gender || (b.author && b.author.gender)) {
                bg = genderOf(b.gender || b.author.gender);
            } else if (authorId && userGenderMap[authorId]) {
                bg = userGenderMap[authorId];
            }

            if (bg === 'male') bottleMale++;
            else if (bg === 'female') bottleFemale++;
            else bottleOther++;
        });

        // --- 統計留言數據 ---
        let realCommentCount = 0, anonCommentCount = 0;
        let commentMale = 0, commentFemale = 0, commentOther = 0; 

        comments.forEach(c => {
            if (c.is_anonymous || c.isAnonymous) anonCommentCount++;
            else realCommentCount++;

            let cg = 'other';
            let authorId = c.member_id || c.author_id;
            
            if (c.member_gender) {
                cg = genderOf(c.member_gender);
            } else if (c.gender || (c.author && c.author.gender)) {
                cg = genderOf(c.gender || c.author.gender);
            } else if (authorId && userGenderMap[authorId]) {
                cg = userGenderMap[authorId];
            }

            if (cg === 'male') commentMale++;
            else if (cg === 'female') commentFemale++;
            else commentOther++;
        });

        // --- 繪製所有圖表 ---
        changeTrendTimeRange('7'); // 畫發文趨勢圖
        changeCsTrendTimeRange('7'); // 畫客服案件趨勢圖
        drawDoughnutChart([angry, secret, broken, apathy, happy]);
        drawZodiacChart([...Object.keys(zodiacCounts), '未填寫'], [...Object.values(zodiacCounts), zodiacUnknown]);
        drawGenderChart([maleCount, femaleCount, otherCount]);
        drawBottleGenderChart([bottleMale, bottleFemale, bottleOther]); 
        drawCommentTypeChart([realCommentCount, anonCommentCount]); 
        drawCommentGenderChart([commentMale, commentFemale, commentOther]); 

    } catch (error) {
        console.error("載入總覽數據失敗", error);
    }
}
function drawTrendChart(labels, dataArray) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (myTrendChart) myTrendChart.destroy();
    myTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '每日發文數量', data: dataArray, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, tension: 0.3, fill: true, pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}
// 🌟 新增：動態切換發文趨勢時間範圍
window.changeTrendTimeRange = function(rangeValue) {
    const bottles = window._dashboardBottles || [];
    const trendLabels = [];
    const trendCounts = {};
    const days = parseInt(rangeValue);

    if (days === 7 || days === 30) {
        // 📅 短期統計：以「天」為單位 (例如: 8/1, 8/2)
        for (let i = days - 1; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            trendLabels.push(dateStr);
            trendCounts[dateStr] = 0;
        }
        
        bottles.forEach(b => {
            if (b.created_at) {
                let bDate = new Date(b.created_at);
                let bDateStr = `${bDate.getMonth() + 1}/${bDate.getDate()}`;
                if (trendCounts[bDateStr] !== undefined) trendCounts[bDateStr]++;
            }
        });
    } else {
        // 🗓️ 長期統計：以「月」為單位 (半年=6個月, 一年=12個月)
        const months = days === 180 ? 6 : 12;
        for (let i = months - 1; i >= 0; i--) {
            let d = new Date();
            d.setMonth(d.getMonth() - i);
            let monthStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            trendLabels.push(monthStr);
            trendCounts[monthStr] = 0;
        }
        
        bottles.forEach(b => {
            if (b.created_at) {
                let bDate = new Date(b.created_at);
                let monthStr = `${bDate.getFullYear()}/${String(bDate.getMonth() + 1).padStart(2, '0')}`;
                if (trendCounts[monthStr] !== undefined) trendCounts[monthStr]++;
            }
        });
    }

    // 重新繪製折線圖
    drawTrendChart(trendLabels, Object.values(trendCounts));
};

// 🌟 新增：繪製客服案件折線圖 (總案件數 vs 未處理案件數)
function drawCsTrendChart(labels, totalDataArray, pendingDataArray) {
    const ctx = document.getElementById('csTrendChart');
    if (!ctx) return;
    if (myCsTrendChart) myCsTrendChart.destroy();
    myCsTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '💬 客服總案件數',
                    data: totalDataArray,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#0284c7',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: '⏳ 未處理案件數',
                    data: pendingDataArray,
                    borderColor: '#eab308',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    borderWidth: 2.5,
                    borderDash: [5, 5],
                    tension: 0.35,
                    fill: false,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#eab308',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 14,
                        font: { size: 12, weight: 'bold' },
                        color: '#334155'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0, color: '#64748b' },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: { color: '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}

// 🌟 新增：動態切換客服案件趨勢時間範圍
window.changeCsTrendTimeRange = function(rangeValue) {
    const csList = window._dashboardCs || [];
    const trendLabels = [];
    const totalCounts = {};
    const pendingCounts = {};
    const days = parseInt(rangeValue);

    if (days === 7 || days === 30) {
        // 📅 短期統計：以「天」為單位
        for (let i = days - 1; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            trendLabels.push(dateStr);
            totalCounts[dateStr] = 0;
            pendingCounts[dateStr] = 0;
        }

        csList.forEach(cs => {
            if (cs.created_at) {
                let csDate = new Date(cs.created_at);
                let csDateStr = `${csDate.getMonth() + 1}/${csDate.getDate()}`;
                if (totalCounts[csDateStr] !== undefined) {
                    totalCounts[csDateStr]++;
                    if (Number(cs.status || 0) === 0) {
                        pendingCounts[csDateStr]++;
                    }
                }
            }
        });
    } else {
        // 🗓️ 長期統計：以「月」為單位 (半年=6個月, 一年=12個月)
        const months = days === 180 ? 6 : 12;
        for (let i = months - 1; i >= 0; i--) {
            let d = new Date();
            d.setMonth(d.getMonth() - i);
            let monthStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            trendLabels.push(monthStr);
            totalCounts[monthStr] = 0;
            pendingCounts[monthStr] = 0;
        }

        csList.forEach(cs => {
            if (cs.created_at) {
                let csDate = new Date(cs.created_at);
                let monthStr = `${csDate.getFullYear()}/${String(csDate.getMonth() + 1).padStart(2, '0')}`;
                if (totalCounts[monthStr] !== undefined) {
                    totalCounts[monthStr]++;
                    if (Number(cs.status || 0) === 0) {
                        pendingCounts[monthStr]++;
                    }
                }
            }
        });
    }

    drawCsTrendChart(trendLabels, Object.values(totalCounts), Object.values(pendingCounts));
};

function drawDoughnutChart(dataArray) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    if (myDoughnutChart) myDoughnutChart.destroy();
    myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels], // 🌟 1. 註冊外掛
        data: {
            labels: ['😡 憤怒', '🤫 秘密', '💔 破碎', '😑 厭世', '😁 開心'],
            datasets: [{
                data: dataArray, backgroundColor: ['#fff1f0', '#f9f0ff', '#fff7e6', '#f6ffed', '#e6f7ff'], borderColor: ['#ffa39e', '#d3adf7', '#ffd591', '#b7eb8f', '#91d5ff'], borderWidth: 2, hoverOffset: 10
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'right', labels: { font: { size: 14 } } },
                // 🌟 2. 加入數字標籤設定
                datalabels: {
                    color: '#475569', // 深色文字
                    font: { weight: 'bold', size: 14 },
                    formatter: (value) => value > 0 ? value : '' // 數值是 0 就自動隱藏，畫面更乾淨
                }
            } 
        }
    });
}

// 星座寫法統一：後端用生日算出來的是「魔羯座」，註冊選單是「摩羯座」，也接受常見別名和沒寫「座」的
const ZODIAC_ALIASES = { '魔羯': '摩羯', '山羊': '摩羯', '白羊': '牡羊', '天平': '天秤', '人馬': '射手', '寶瓶': '水瓶' };
const ZODIAC_NAMES = ['牡羊座', '金牛座', '雙子座', '巨蟹座', '獅子座', '處女座', '天秤座', '天蠍座', '射手座', '摩羯座', '水瓶座', '雙魚座'];
function zodiacOf(raw) {
    let z = String(raw || '').trim().replace(/座$/, '');
    z = ZODIAC_ALIASES[z] || z;
    return ZODIAC_NAMES.includes(z + '座') ? z + '座' : null;
}

function drawZodiacChart(labels, dataArray) {
    const ctx = document.getElementById('zodiacChart');
    if (!ctx) return;
    if (myZodiacChart) myZodiacChart.destroy();
    
    // 💡 保持把「座」字過濾掉，節省 X 軸空間
    const shortLabels = labels.map(label => label.replace(/座$/, ''));

    myZodiacChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shortLabels,
            // 最後一根「未填寫」用灰色，跟 12 星座區分
            datasets: [{ label: '會員人數', data: dataArray, backgroundColor: labels.map(l => l === '未填寫' ? '#cbd5e1' : '#8b5cf6'), borderRadius: 4, borderWidth: 0 }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { bottom: 15 } }, // 🌟 稍微留一點底部空間給手機版傾斜時使用
            plugins: { legend: { display: false } }, 
            scales: { 
                x: {
                    grid: { display: false },
                    ticks: {
                        autoSkip: false,  // 強制顯示全部 12 個星座＋未填寫
                        maxRotation: 45,  // 🌟 關鍵：允許在手機版螢幕太窄時，傾斜 45 度排版
                        minRotation: 0,   // 🌟 關鍵：在電腦版螢幕夠寬時，自動保持 0 度水平
                        font: { size: 11 },
                        color: '#64748b'
                    }
                },
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0 } 
                } 
            } 
        }
    });
}

function drawGenderChart(dataArray) {
    const ctx = document.getElementById('genderChart');
    if (!ctx) return;
    if (myGenderChart) myGenderChart.destroy();
    myGenderChart = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels], // 🌟 1. 註冊外掛
        data: {
            labels: ['👦 男生', '👧 女生', '🤫 未填寫 / 不公開'],
            datasets: [{ data: dataArray, backgroundColor: ['#60a5fa', '#f472b6', '#e2e8f0'], borderWidth: 1, borderColor: '#ffffff', hoverOffset: 10 }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { font: { size: 14 }, padding: 10 } },
                // 🌟 2. 加入數字標籤設定
                datalabels: {
                    color: '#ffffff', // 白色文字
                    font: { weight: 'bold', size: 14 },
                    formatter: (value) => value > 0 ? value : '' // 數值是 0 就自動隱藏
                }
            } 
        }
    });
}

// 🌟 幫您加回被誤刪的發文者性別圖表，並補上數字標籤外掛
function drawBottleGenderChart(dataArray) {
    const ctx = document.getElementById('bottleGenderChart');
    if (!ctx) return;
    if (myBottleGenderChart) myBottleGenderChart.destroy();
    myBottleGenderChart = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels], // 🌟 1. 註冊外掛
        data: {
            labels: ['👦 發文男', '👧 發文女', '🤫 未填寫 / 不公開'],
            datasets: [{ 
                data: dataArray, 
                backgroundColor: ['#60a5fa', '#f472b6', '#e2e8f0'], 
                borderWidth: 1, 
                borderColor: '#ffffff', 
                hoverOffset: 10 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { font: { size: 14 }, padding: 10 } },
                // 🌟 2. 加入數字標籤設定
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 14 },
                    formatter: (value) => value > 0 ? value : ''
                }
            } 
        }
    });
}

// 🌟 修正版：繪製留言身份比例圓餅圖
function drawCommentTypeChart(dataArray) {
    const ctx = document.getElementById('commentTypeChart');
    if (!ctx) return;
    if (myCommentTypeChart) myCommentTypeChart.destroy();
    
    // 防呆：如果完全沒留言就不畫
    if (dataArray[0] === 0 && dataArray[1] === 0) return;

    myCommentTypeChart = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels], // 🌟 1. 註冊外掛
        data: {
            labels: ['👤 實名留言', '🎭 匿名留言'],
            datasets: [{ 
                data: dataArray, 
                backgroundColor: ['#60a5fa', '#cbd5e1'], 
                borderWidth: 1, 
                borderColor: '#ffffff', 
                hoverOffset: 10 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { font: { size: 14 }, padding: 10 } },
                // 🌟 2. 加入數字標籤設定
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 14 },
                    formatter: (value) => value > 0 ? value : ''
                }
            } 
        }
    });
}

// 🌟 新增：繪製留言者男女比例圓餅圖
function drawCommentGenderChart(dataArray) {
    const ctx = document.getElementById('commentGenderChart');
    if (!ctx) return;
    if (myCommentGenderChart) myCommentGenderChart.destroy();
    
    if (dataArray[0] === 0 && dataArray[1] === 0 && dataArray[2] === 0) return;

    myCommentGenderChart = new Chart(ctx, {
        type: 'pie',
        plugins: [ChartDataLabels], // 🌟 1. 註冊外掛
        data: {
            labels: ['👦 留言男', '👧 留言女', '🤫 未填寫 / 不公開'],
            datasets: [{ 
                data: dataArray, 
                backgroundColor: ['#60a5fa', '#f472b6', '#e2e8f0'], 
                borderWidth: 1, 
                borderColor: '#ffffff', 
                hoverOffset: 10 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { font: { size: 14 }, padding: 10 } },
                // 🌟 2. 加入數字標籤設定
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 14 },
                    formatter: (value) => value > 0 ? value : ''
                }
            } 
        }
    });
}
// ==========================================
// 5. 管理使用者
// ==========================================
window._allUsers = [];
window._filteredUsersCache = [];
window._currentUserStatusFilter = 'all';
window._currentUserPage = 1;
window._userSortOrder = 'desc'; // 'desc' (由新到舊) 或 'asc' (由舊到新)

window.toggleUserSort = function () {
    window._userSortOrder = window._userSortOrder === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('sort-user-btn');
    if (btn) {
        btn.innerHTML = window._userSortOrder === 'desc' ? '⏳ 由新到舊 ⬇️' : '⏳ 由舊到新 ⬆️';
    }
    filterUsers();
};

// 會員管理的「重新整理」：重新抓資料，但保留搜尋、分類與目前頁數；抓的時候表格不會先清空
window.refreshUsers = async function () {
    const btn = document.getElementById('refresh-users-btn');
    if (!btn || btn.disabled) return;
    const text = btn.querySelector('.refresh-text');
    const page = window._currentUserPage || 1;
    btn.disabled = true;
    btn.classList.add('is-loading');
    text.textContent = '更新中…';
    const ok = await loadUsers({ keepTable: true });
    if (ok) {
        // filterUsers 會跳回第 1 頁，這裡把頁數放回去（資料變少時停在最後一頁）
        const totalPages = Math.max(1, Math.ceil((window._filteredUsersCache || []).length / PAGE_SIZE));
        changeUserPage(Math.min(page, totalPages));
    }
    btn.classList.remove('is-loading');
    // 手機只顯示圖示，所以圖示也要換
    const icon = btn.querySelector('.refresh-icon');
    text.textContent = ok ? '已更新' : '更新失敗';
    icon.textContent = ok ? '✅' : '⚠️';
    setTimeout(() => { text.textContent = '重新整理'; icon.textContent = '🔄'; btn.disabled = false; }, 1500);
};

async function loadUsers({ keepTable = false } = {}) {
    const tbody = document.getElementById('admin-users-body');
    const token = localStorage.getItem("authToken");
    if (!keepTable) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">載入中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/members`, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) throw new Error();

        const result = await response.json();
        window._allUsers = result.data || result || [];
        filterUsers();
        return true;
    } catch (e) {
        // 重新整理失敗時保留原本的表格，按鈕會顯示「更新失敗」
        if (!keepTable) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">無法載入，請確認是否有管理員權限</td></tr>`;
        return false;
    }
}

window.filterUserByStatus = function (status) {
    window._currentUserStatusFilter = status;
    const statusMap = { 'all': 'all', 'ACTIVE': 'active', 'INACTIVE': 'inactive', 'BANNED': 'banned', 'PENDING_DELETION': 'pending-deletion', 'DELETED': 'deleted' };
    const btns = ['all', 'active', 'inactive', 'banned', 'pending-deletion', 'deleted'];

    btns.forEach(id => {
        const el = document.getElementById('filter-user-' + id);
        if (!el) return;
        if (id === statusMap[status]) {
            el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6';
        } else {
            el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0';
        }
    });
    filterUsers();
}

window.filterUsers = function () {
    const keyword = document.getElementById('search-users').value.toLowerCase();
    window._filteredUsersCache = window._allUsers.filter(u => {
        const matchKeyword = String(u.member_id || '').includes(keyword) || String(u.name || '').toLowerCase().includes(keyword) || String(u.email || '').toLowerCase().includes(keyword);
        let matchStatus = true;
        if (window._currentUserStatusFilter !== 'all') {
            const currentStatus = u.status || 'ACTIVE';
            matchStatus = (currentStatus === window._currentUserStatusFilter);
        }
        return matchKeyword && matchStatus;
    });

    window._filteredUsersCache.sort((a, b) => {
        const timeA = getItemTimestamp(a, 'member_id');
        const timeB = getItemTimestamp(b, 'member_id');
        return window._userSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    window._currentUserPage = 1; 
    applyUserPagination();
}

window.changeUserPage = function (newPage) {
    window._currentUserPage = newPage;
    applyUserPagination();
}

function applyUserPagination() {
    const startIndex = (window._currentUserPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredUsersCache.slice(startIndex, endIndex);
    
    renderUsers(pagedData);
    renderPagination(window._filteredUsersCache.length, window._currentUserPage, 'users-pagination', 'changeUserPage');
}

// 會員帳號狀態（後端 UserStatus）
const MEMBER_STATUS = {
    ACTIVE: { text: '🟢 正常', bg: '#e6f7ff', color: '#0066cc', border: '#91d5ff' },
    INACTIVE: { text: '🟡 停用／未驗證', bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
    BANNED: { text: '🔴 封鎖', bg: '#fff1f0', color: '#cf1322', border: '#ffa39e' },
    PENDING_DELETION: { text: '🟣 註銷中', bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' },
    DELETED: { text: '⚫ 已註銷', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

function renderUsers(users) {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">目前沒有符合條件的使用者</td></tr>`;
        return;
    }

    // 目前登入的管理員 ID：自己那一列不顯示權限按鈕 (後端也會擋)
    let myMemberId = null;
    try { myMemberId = Number(JSON.parse(localStorage.getItem("currentUser") || "{}").member_id) || null; } catch (e) {}

    tbody.innerHTML = users.map(u => {
        const uid = u.member_id || u.id;
        const safeName = escapeHTML(u.name || '未命名');
        const nameArg = jsArg(u.name || '未命名');
        const isAdmin = u.role === 'ADMIN';
        const isSelf = myMemberId !== null && Number(uid) === myMemberId;

        const roleBadge = isAdmin
            ? `<span class="badge" style="background:#f5f3ff; color:#6d28d9; border:1px solid #c4b5fd;">🛡️ 管理員</span>`
            : `<span class="badge" style="background:#f8fafc; color:#64748b; border:1px solid #e2e8f0;">👤 一般會員</span>`;

        let roleBtn = '';
        if (isSelf) {
            roleBtn = `<span style="margin-left: 5px; font-size: 0.8rem; color: #94a3b8;">（本人）</span>`;
        } else if (isAdmin) {
            roleBtn = `<button class="btn-action" style="margin-left: 5px; background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;" onclick="changeUserRole('${uid}', ${nameArg}, 'USER')">取消管理員</button>`;
        } else {
            roleBtn = `<button class="btn-action" style="margin-left: 5px; background:#f5f3ff; color:#6d28d9; border:1px solid #c4b5fd;" onclick="changeUserRole('${uid}', ${nameArg}, 'ADMIN')">升為管理員</button>`;
        }

        const currentStatus = u.status || 'ACTIVE';
        const st = MEMBER_STATUS[currentStatus] || { text: currentStatus, bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
        const statusBadge = `<span class="badge" style="background:${st.bg}; color:${st.color}; border:1px solid ${st.border};">${st.text}</span>`;
        const isDeleted = currentStatus === 'DELETED';

        return `
        <tr>
            <td data-label="會員 ID">${escapeHTML(String(u.member_id || u.id || '未知'))}</td>
            <td data-label="姓名暱稱">${escapeHTML(u.name || '未命名')}</td>
            <td data-label="登入 Email">${escapeHTML(u.email || '無')}</td>
            <td data-label="註冊時間">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="帳號狀態">${statusBadge}</td>
            <td data-label="帳號權限">${roleBadge}</td>
            <td data-label="項目操作" class="user-actions">
                ${isDeleted
                    ? `<span style="font-size: 0.85rem; color: #94a3b8;">已註銷，無法操作</span>`
                    : `<button class="btn-action btn-secondary" onclick="changeUserStatus('${uid}', ${nameArg})">更改狀態</button>
                ${roleBtn}
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteUserAsAdmin('${uid}', ${nameArg})">刪除</button>`}
            </td>
        </tr>
        `;
    }).join('');
}

let currentEditingUserId = null;
window.changeUserStatus = function (userId, userName) {
    currentEditingUserId = userId;
    const user = (window._allUsers || []).find(u => String(u.member_id || u.id) === String(userId));
    const pendingNote = user && user.status === 'PENDING_DELETION'
        ? '\n⚠️ 這個帳號正在註銷的 7 天後悔期，變更狀態會取消他的註銷申請'
        : '';
    document.getElementById('status-modal-user-name').innerText = `正在修改帳號：${userName}${pendingNote}`;
    document.getElementById('status-modal').style.display = 'flex';
}
window.closeStatusModal = function () { document.getElementById('status-modal').style.display = 'none'; currentEditingUserId = null; }
window.confirmChangeStatus = async function (newStatus) {
    if (!currentEditingUserId) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${currentEditingUserId}/status`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ newStatus: newStatus })
        });
        if (response.ok) { alert('✅ 狀態已成功更新！'); closeStatusModal(); loadUsers(); }
        else {
            const err = await response.json().catch(() => ({}));
            alert('更新失敗：' + (err.message || '請確認權限或網路狀態'));
            closeStatusModal();
        }
    } catch (e) { alert('伺服器連線失敗'); }
}
// 升為管理員 / 取消管理員
window.changeUserRole = async function (userId, userName, newRole) {
    const msg = newRole === 'ADMIN'
        ? `🛡️ 確定要將「${userName} (ID: ${userId})」升為管理員嗎？\n升級後對方可以進入後台，管理所有會員、文章與客服。`
        : `⚠️ 確定要取消「${userName} (ID: ${userId})」的管理員權限嗎？\n取消後對方將無法再進入後台。`;
    if (!await oceanConfirm(msg)) return;

    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${userId}/role`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ role: newRole })
        });
        const res = await response.json().catch(() => ({}));
        if (response.ok) {
            alert(`✅ ${res.message || '權限已更新'}`);
            loadUsers();
        } else {
            alert("變更權限失敗：" + (res.message || "權限不足或伺服器錯誤"));
        }
    } catch (e) {
        alert("伺服器連線失敗，請檢查網路狀態！");
    }
};

window.deleteUserAsAdmin = async function (userId, userName) {
    if (!await oceanConfirm(`⚠️ 確定要強制刪除使用者「${userName} (ID: ${userId})」嗎？\n刪除後將無法復原，請三思！`)) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/members/${userId}/delete`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) { alert(`🗑️ 成功將使用者「${userName}」從資料庫抹除！`); loadUsers(); }
        else {
            const err = await response.json().catch(() => ({}));
            // 會員發過漂流瓶、登出過等等，資料庫裡還有連著他的紀錄時，後端目前刪不掉
            const hint = response.status >= 500
                ? '\n\n這個會員可能發過漂流瓶或有其他紀錄，目前無法直接刪除。\n要停止他使用，可以改用「更改狀態 → 永久封鎖」；或請會員自己在網站設定註銷帳號。'
                : '';
            alert("刪除失敗：" + (err.message || "權限不足或伺服器錯誤") + hint);
        }
    } catch (error) { alert("伺服器連線失敗，請檢查網路狀態！"); }
};

// ==========================================
// 6. 漂流瓶文章審核
// ==========================================
window._allBottles = [];
window._filteredBottlesCache = [];
window._currentStatusFilter = 'all';
window._currentCategoryFilter = 'all'; 
window._currentBottlePage = 1;
window._bottleSortOrder = 'desc'; // 'desc' (由新到舊) 或 'asc' (由舊到新)

window.toggleBottleSort = function () {
    window._bottleSortOrder = window._bottleSortOrder === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('sort-bottle-btn');
    if (btn) {
        btn.innerHTML = window._bottleSortOrder === 'desc' ? '⏳ 由新到舊 ⬇️' : '⏳ 由舊到新 ⬆️';
    }
    filterBottles();
};

function getBottleCategoryType(b) {
    let rawCat = b.category_name || null;
    if (!rawCat && b.categories && b.categories.length > 0) rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
    if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
    if (!rawCat) rawCat = '綜合閒聊';

    if (rawCat.includes("開心") || rawCat.includes("快樂") || rawCat.includes("喜悅")) return 'happy';
    if (rawCat.includes("憤怒") || rawCat.includes("閒聊")) return 'angry';
    if (rawCat.includes("秘密") || rawCat.includes("程式")) return 'secret';
    if (rawCat.includes("破碎") || rawCat.includes("碎片")) return 'broken';
    return 'apathy'; 
}

async function loadBottles() {
    const tbody = document.getElementById('admin-bottles-body');
    const token = localStorage.getItem("authToken");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles`, {
            headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        if (!response.ok) throw new Error();

        const data = await response.json();
        window._allBottles = data.data || data.bottles || data || []; 
        filterBottles();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入，請確認權限或後端是否啟動</td></tr>`;
    }
}

window.filterByStatus = function (status) {
    window._currentStatusFilter = status;
    const btns = ['all', 'pending', 'passed', 'rejected'];
    btns.forEach(id => {
        const el = document.getElementById('filter-btn-' + id);
        if (!el) return;
        if (id === status) { el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6'; } 
        else { el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0'; }
    });
    filterBottles();
}

window.filterByCategory = function (category) {
    window._currentCategoryFilter = category;
    filterBottles();
}

window.filterBottles = function () {
    const keyword = document.getElementById('search-bottles').value.toLowerCase();
    
    window._filteredBottlesCache = window._allBottles.filter(b => {
        const matchKeyword = String(b.bottle_id || '').includes(keyword) || String(b.title || '').toLowerCase().includes(keyword) || String(b.member_name || b.author?.name || '').toLowerCase().includes(keyword);
        
        let matchStatus = true;
        const currentStatus = Number(b.status);
        if (window._currentStatusFilter === 'pending') matchStatus = (currentStatus !== 1 && currentStatus !== 2);
        else if (window._currentStatusFilter === 'passed') matchStatus = (currentStatus === 1);
        else if (window._currentStatusFilter === 'rejected') matchStatus = (currentStatus === 2);
        
        let matchCategory = true;
        if (window._currentCategoryFilter !== 'all') {
            const catType = getBottleCategoryType(b);
            matchCategory = (catType === window._currentCategoryFilter);
        }

        return matchKeyword && matchStatus && matchCategory;
    });

    window._filteredBottlesCache.sort((a, b) => {
        const timeA = getItemTimestamp(a, 'bottle_id');
        const timeB = getItemTimestamp(b, 'bottle_id');
        return window._bottleSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    window._currentBottlePage = 1;
    applyBottlePagination();
}

window.changeBottlePage = function (newPage) {
    window._currentBottlePage = newPage;
    applyBottlePagination();
}

function applyBottlePagination() {
    const startIndex = (window._currentBottlePage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredBottlesCache.slice(startIndex, endIndex);
    
    renderBottles(pagedData);
    renderPagination(window._filteredBottlesCache.length, window._currentBottlePage, 'bottles-pagination', 'changeBottlePage');
}

function renderBottles(bottles) {
    const tbody = document.getElementById('admin-bottles-body');
    if (!tbody) return;
    if (bottles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">目前沒有符合條件的文章唷 🏖️</td></tr>`;
        return;
    }

    tbody.innerHTML = bottles.map(b => {
        let rawCat = b.category_name || null;
        if (!rawCat && b.categories && b.categories.length > 0) rawCat = (typeof b.categories[0] === 'string') ? b.categories[0] : b.categories[0].category?.name;
        if (!rawCat && b.category_list && b.category_list.length > 0) rawCat = b.category_list[0];
        if (!rawCat) rawCat = '綜合閒聊';

        let catHtml = rawCat.includes("開心") || rawCat.includes("快樂") ? `<span class="badge" style="background:#e6f7ff; color:#0050b3; border:1px solid #91d5ff;">😁 開心的事</span>` :
                      rawCat.includes("憤怒") || rawCat.includes("閒聊") ? `<span class="badge" style="background:#fff1f0; color:#cf1322; border:1px solid #ffa39e;">😡 極度憤怒中</span>` :
                      rawCat.includes("秘密") || rawCat.includes("程式") ? `<span class="badge" style="background:#f9f0ff; color:#531dab; border:1px solid #d3adf7;">🤫 沒人懂的秘密</span>` :
                      rawCat.includes("破碎") || rawCat.includes("碎片") ? `<span class="badge" style="background:#fff7e6; color:#d46b08; border:1px solid #ffd591;">💔 破碎的碎片</span>` :
                      `<span class="badge" style="background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f;">😑 極度厭世/躺平</span>`;

        const currentStatus = Number(b.status);
        let statusBadge = currentStatus === 1 ? `<span class="badge" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0;">✅ 已通過</span>` :
                          currentStatus === 2 ? `<span class="badge" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca;">❌ 已下架 / 拒絕</span>` :
                          `<span class="badge" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;">⏳ 待審核</span>`;
        const pollBadge = pollOptionsOf(b).length > 0 ? `<span class="badge" style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe;">📊 投票</span>` : '';
        let rowStyle = currentStatus === 1 || currentStatus === 2 ? `opacity: 0.8; background: #f8fafc;` : `opacity: 1; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04);`;

        // 🌟 這裡已幫您還原回最直覺的並排按鈕！
        return `
        <tr style="${rowStyle} transition: 0.3s;">
            <td data-label="文章 ID" style="color: #64748b; font-weight: 600;">#${escapeHTML(String(b.bottle_id || b.id))}</td>
            <td data-label="發文者">${escapeHTML(String(b.member_name || b.author_name || '匿名'))}</td>
            <td data-label="標題"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-weight: 600; color: #1e293b; font-size: 1.05rem;">${escapeHTML(String(b.title))}</span>${statusBadge}${pollBadge}</div></td>
            <td data-label="看板分類">${catHtml}</td>
            <td data-label="發布時間" style="color: #64748b;">${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</td>
            <td data-label="項目操作">
                <button class="btn-action btn-primary" onclick="openBottleModalFromCache('${b.bottle_id || b.id}')">${currentStatus !== 0 ? '查看' : '審核'}</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteBottleAsAdmin('${b.bottle_id || b.id}')">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

window.openBottleModalFromCache = function (bottleId) {
    const b = window._allBottles.find(item => String(item.bottle_id || item.id) === String(bottleId));
    if (!b) return;
    document.getElementById('modal-title').innerHTML = `<div style="display: flex; align-items: center; gap: 10px; font-size: 1.4rem; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 0;"><span style="font-size: 1.6rem;">📝</span> ${escapeHTML(b.title)}</div>`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin: 15px 0; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">👤 作者：${escapeHTML(b.member_name || b.author_name || '匿名')}</span>
            <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">📅 ${b.created_at ? new Date(b.created_at).toLocaleDateString() : '未知'}</span>
        </div>
        <div style="background: #ffffff; border-left: 5px solid #3b82f6; padding: 24px; border-radius: 0 12px 12px 0; font-size: 1.05rem; color: #334155; white-space: pre-wrap; line-height: 1.8; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-top: 20px;">${escapeHTML(b.content)}</div>
        ${renderPollBlock(pollOptionsOf(b))}`;
    window._reviewBottleId = b.bottle_id || b.id; window._reviewBottleTitle = b.title;
    document.getElementById('modal-actions').innerHTML = `
        <button class="btn-action btn-secondary" onclick="closeAdminModal()">返回</button>
        <div style="margin-left: auto; display: flex; gap: 12px;">
            <button class="btn-action btn-danger" onclick="reviewBottle(window._reviewBottleId, 2, window._reviewBottleTitle);">❌ 拒絕 (違規)</button>
            <button class="btn-action btn-primary" onclick="reviewBottle(window._reviewBottleId, 1, window._reviewBottleTitle);">✅ 審核通過</button>
        </div>`;
    document.getElementById('admin-modal').style.display = 'flex';
}
window.reviewBottle = async function (bottleId, status, title) { window._pendingReviewId = bottleId; window._pendingReviewTitle = title; if (status === 2) { document.getElementById('reject-reason-input').value = '內容不當'; document.getElementById('reject-modal').style.display = 'flex'; } else { if (!await oceanConfirm(`✅ 確定要通過「${title}」嗎？`)) return; executeReviewAction(bottleId, 1, ""); } }
window.closeRejectModal = function () { document.getElementById('reject-modal').style.display = 'none'; }
window.confirmRejectAction = function () { const reason = document.getElementById('reject-reason-input').value.trim(); if (!reason) { alert("必須填寫原因！"); return; } executeReviewAction(window._pendingReviewId, 2, reason); closeRejectModal(); }
window.executeReviewAction = async function (bottleId, status, reason) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ "bottle_id": Number(bottleId), "status": status, "violation_reason": reason }) });
        if (response.ok) { alert(`🎉 審核完成！`); closeAdminModal(); loadBottles(); } else { const err = await response.json(); alert(`審核失敗: ${err.message}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}
window.deleteBottleAsAdmin = async function (bottleId) {
    if (!await oceanConfirm(`⚠️ 確定刪除 #${bottleId} 嗎？無法復原！`)) return;
    const token = localStorage.getItem("authToken");
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${bottleId}/delete`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) { alert("🗑️ 成功刪除！"); window._allBottles = window._allBottles.filter(b => String(b.bottle_id || b.id) !== String(bottleId)); filterBottles(); } else { const err = await response.json(); alert("刪除失敗：" + err.message); }
    } catch (error) { alert("伺服器連線失敗！"); }
};
window.closeAdminModal = function () { const modal = document.getElementById('admin-modal'); if (modal) modal.style.display = 'none'; window._reviewBottleId = null; window._reviewBottleTitle = null; }
window.adminLogout = async function () { if (await oceanConfirm("👋 確定要登出嗎？", { okText: "登出" })) { localStorage.removeItem("authToken"); localStorage.removeItem("currentUser"); localStorage.removeItem("adminLastTab"); window.location.href = "login.html"; } }

// ==========================================
// 7. 檢舉處理 
// ==========================================
window._allReports = [];
window._filteredReportsCache = [];
window._currentReportStatusFilter = 'pending';
window._currentReportPage = 1;
window._reportSortOrder = 'desc'; // 'desc' (由新到舊) 或 'asc' (由舊到新)

window.toggleReportSort = function () {
    window._reportSortOrder = window._reportSortOrder === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('sort-report-btn');
    if (btn) {
        btn.innerHTML = window._reportSortOrder === 'desc' ? '⏳ 由新到舊 ⬇️' : '⏳ 由舊到新 ⬆️';
    }
    filterReports();
};

/* 瓶子檢舉的處理結果：瓶子被下架或檢舉成立算「已下架」，檢舉不成立算「沒問題」，其餘待處理 */
function getReportState(r) {
    if (Number(r.bottle?.status) === 2 || Number(r.status) === 1) return 'banned';
    if (Number(r.status) === 2) return 'dismissed';
    return 'pending';
}

// 留言、便利貼的檢舉狀態：0 待處理、1 成立（已刪除／已下架）、2 不成立
function reportStateOf(status) {
    return Number(status) === 1 ? 'banned' : Number(status) === 2 ? 'dismissed' : 'pending';
}

// 被檢舉內容的作者：一律顯示真名，匿名的加上標記
function reportAuthorLine(member, isAnonymous, anonLabel) {
    if (!member) return '';
    return `<div style="margin-top: 6px; font-size: 0.85rem; color: #475569; white-space: normal;">✍️ 作者：<b>${escapeHTML(member.name || '未命名')}</b> <span style="color:#94a3b8;">(ID ${escapeHTML(member.member_id)})</span>${isAnonymous ? ` <span class="badge" style="background:#f3e8ff; color:#7e22ce; border:1px solid #e9d5ff; padding: 1px 8px;">🎭 ${anonLabel}</span>` : ''}</div>`;
}

function reporterLabel(reporter, reporterId) {
    if (reporter?.name) return `${reporter.name}${reporterId ? ` (ID ${reporterId})` : ''}`;
    return reporterId ? `ID ${reporterId}` : '未知';
}

const REPORT_KIND = {
    bottle: { text: '🍾 貼文', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
    comment: { text: '💬 留言', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    note: { text: '📝 便利貼', bg: '#fce7f3', color: '#be185d', border: '#fbcfe8' },
};

/* 貼文、留言、便利貼三種檢舉抓下來，整理成同一種格式（一筆檢舉一列） */
async function fetchAllReports() {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem("authToken")}`, 'ngrok-skip-browser-warning': 'true' };
    const get = async (path) => {
        const res = await fetch(`${API_BASE_URL}${path}`, { headers });
        if (!res.ok) throw new Error(path);
        const data = await res.json();
        return data.data || [];
    };
    const [bottleReports, reportedComments, notes] = await Promise.all([
        get('/admin/bottles/reported'),
        get('/admin/comment-reports'),
        get('/admin/daily-notes'),
    ]);

    const list = [];
    bottleReports.forEach(r => {
        const poll = pollOptionsOf(r.bottle);
        list.push({
            kind: 'bottle',
            targetId: r.bottle_id,
            created_at: r.created_at,
            reason: r.reason || '未提供原因',
            reporter: reporterLabel(r.reporter, r.member_id),
            state: getReportState(r),
            content: r.bottle?.content || '（無法取得文章內容）',
            contextHtml: `<div style="margin-bottom: 4px; font-weight: 700; color: #1e293b;">#${escapeHTML(r.bottle_id)}「${escapeHTML(r.bottle?.title || '')}」</div>`,
            extraHtml: (poll.length > 0
                ? `<div style="margin-top: 6px; color: #4338ca; font-size: 0.85rem; line-height: 1.5; white-space: normal;">📊 投票：${poll.map(o => escapeHTML(o.text)).join(' ／ ')}</div>`
                : '') + reportAuthorLine(r.bottle?.author, r.bottle?.is_anonymous, '匿名發文'),
            search: [r.bottle_id, r.bottle?.title, r.bottle?.content, r.bottle?.author?.name],
        });
    });
    reportedComments.forEach(c => {
        (c.reports || []).forEach(r => {
            list.push({
                kind: 'comment',
                targetId: c.id,
                created_at: r.created_at,
                reason: r.reason,
                reporter: reporterLabel(r.reporter, r.member_id),
                state: reportStateOf(r.status),
                content: c.content || '（空白）',
                contextHtml: `<div style="margin-bottom: 4px; font-size: 0.85rem; color: #b45309; white-space: normal;">在貼文 <b>#${escapeHTML(c.bottle?.bottle_id ?? '')}「${escapeHTML(c.bottle?.title || '')}」</b>底下的${c.parent_id ? '回覆' : '留言'}</div>`,
                extraHtml: reportAuthorLine(c.member, c.is_anonymous, '匿名留言'),
                search: [c.id, c.content, c.member?.name, c.bottle?.bottle_id, c.bottle?.title],
            });
        });
    });
    notes.forEach(n => {
        (n.reports || []).forEach(r => {
            list.push({
                kind: 'note',
                targetId: n.id,
                created_at: r.created_at,
                reason: r.reason,
                reporter: reporterLabel(r.reporter, r.member_id),
                state: reportStateOf(r.status),
                content: n.content,
                contextHtml: '<div style="margin-bottom: 4px; font-size: 0.85rem; color: #be185d;">今天的便利貼</div>',
                extraHtml: reportAuthorLine(n.member, true, '便利貼都是匿名的'),
                search: [n.id, n.content, n.member?.name],
            });
        });
    });
    return list;
}

window.updateDashboardReportCount = function () {
    if (!window._allReports) return;
    const pendingCount = window._allReports.filter(r => r.state === 'pending').length;
    const statReports = document.getElementById('stat-reports');
    if (statReports) statReports.innerText = pendingCount;
}

async function loadReports() {
    const tbody = document.getElementById('admin-reports-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">讀取中...</td></tr>`;

    try {
        window._allReports = await fetchAllReports();
        updateDashboardReportCount();
        filterReports();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">無法載入</td></tr>`;
    }
}

window.filterReportByStatus = function (status) {
    window._currentReportStatusFilter = status;
    const btns = ['all', 'pending', 'processed'];
    btns.forEach(id => {
        const el = document.getElementById('filter-report-' + id);
        if (!el) return;
        if (id === status) { el.style.background = '#3b82f6'; el.style.color = '#fff'; el.style.borderColor = '#3b82f6'; } 
        else { el.style.background = '#f8fafc'; el.style.color = '#64748b'; el.style.borderColor = '#e2e8f0'; }
    });
    filterReports();
}

window.filterReports = function () {
    const keyword = document.getElementById('search-reports')?.value.toLowerCase() || '';
    window._filteredReportsCache = window._allReports.filter(r => {
        const haystack = [REPORT_KIND[r.kind].text, r.reason, r.reporter, ...r.search].join(' ').toLowerCase();
        const matchKeyword = haystack.includes(keyword);
        const isProcessed = r.state !== 'pending';
        let matchStatus = true;
        if (window._currentReportStatusFilter === 'pending') matchStatus = !isProcessed;
        else if (window._currentReportStatusFilter === 'processed') matchStatus = isProcessed;
        return matchKeyword && matchStatus;
    });

    window._filteredReportsCache.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return window._reportSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    window._currentReportPage = 1;
    applyReportPagination();
}

window.changeReportPage = function (newPage) {
    window._currentReportPage = newPage;
    applyReportPagination();
}

function applyReportPagination() {
    const startIndex = (window._currentReportPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredReportsCache.slice(startIndex, endIndex);
    
    renderReports(pagedData);
    renderPagination(window._filteredReportsCache.length, window._currentReportPage, 'reports-pagination', 'changeReportPage');
}

function renderReports(reports) {
    const tbody = document.getElementById('admin-reports-body');
    if (!tbody) return;
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">☕</span><p>目前這個分類沒有資料唷！</p></div></td></tr>`;
        return;
    }

    // 處理後的標籤文字：貼文、便利貼是「下架」，留言是「刪除」
    const BANNED_TEXT = { bottle: '✅ 已下架', comment: '✅ 留言已刪除', note: '✅ 已下架' };
    // 待處理時的按鈕：依類型打不同的接口
    const ACTIONS = {
        bottle: id => [`banReportedBottle(${id})`, '🚫 強制下架 (留存紀錄)', `dismissReportedBottle(${id})`],
        comment: id => [`resolveReportedComment(${id}, 'delete')`, '🗑️ 刪除留言 (留存紀錄)', `resolveReportedComment(${id}, 'dismiss')`],
        note: id => [`resolveReportedNote(${id}, 'ban')`, '🚫 下架便利貼', `resolveReportedNote(${id}, 'dismiss')`],
    };

    tbody.innerHTML = reports.map(r => {
        const kind = REPORT_KIND[r.kind];
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '未知';
        const isProcessed = r.state !== 'pending';

        let actionHtml;
        if (r.state === 'banned') actionHtml = `<span class="badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding: 6px 12px;">${BANNED_TEXT[r.kind]}</span>`;
        else if (r.state === 'dismissed') actionHtml = `<span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding: 6px 12px;">❎ 檢舉不成立</span>`;
        else {
            const [banCall, banText, dismissCall] = ACTIONS[r.kind](Number(r.targetId));
            actionHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-action btn-danger" onclick="${banCall};">${banText}</button>
                <button class="btn-action" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;" onclick="${dismissCall};">❎ 沒問題 (檢舉不成立)</button>
            </div>`;
        }
        const rowBg = isProcessed ? '#f8fafc' : '#fffafa';
        const rowOpacity = isProcessed ? '0.7' : '1';

        return `
        <tr style="background: ${rowBg}; opacity: ${rowOpacity}; transition: 0.3s;">
            <td data-label="類型" style="white-space: nowrap;"><span class="badge" style="background:${kind.bg}; color:${kind.color}; border:1px solid ${kind.border}; padding: 4px 10px;">${kind.text}</span></td>
            <td data-label="被檢舉內容" style="min-width: 220px; max-width: 350px;">${r.contextHtml}<div style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; white-space: normal; color: #334155; line-height: 1.5; font-size: 0.95rem;">${escapeHTML(String(r.content))}</div>${r.extraHtml}</td>
            <td data-label="檢舉原因" style="color: #ef4444; font-weight: bold; white-space: normal; min-width: 150px;">${escapeHTML(String(r.reason))}</td>
            <td data-label="檢舉者">${escapeHTML(String(r.reporter))}</td>
            <td data-label="檢舉時間" style="color: #64748b;">${date}</td>
            <td data-label="操作">${actionHtml}</td>
        </tr>
        `;
    }).join('');
}

window.banReportedBottle = async function (bottleId) {
    if (!await oceanConfirm(`⚠️ 確定要將 #${bottleId} 號文章「強制下架」嗎？\n(保留在資料庫)`)) return;
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/bottles/review`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ "bottle_id": Number(bottleId), "status": 2, "violation_reason": "遭檢舉違規，管理員強制下架" }) });
        if (response.ok) {
            alert("✅ 文章已成功下架！");
            loadReports(); loadBottles();
        } else { const err = await response.json(); alert(`下架失敗: ${err.message}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}

window.dismissReportedBottle = async function (bottleId) {
    if (!await oceanConfirm(`確定 #${bottleId} 號文章沒有違規，將這篇的待處理檢舉判定為「不成立」嗎？
(文章維持原狀)`)) return;
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/bottles/${Number(bottleId)}/reports/dismiss`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) {
            alert("✅ 已標記為檢舉不成立！");
            loadReports();
        } else { const err = await response.json(); alert(`處理失敗: ${err.message}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}

/* 💬 留言檢舉：delete 刪除留言（後台留著內容、通知留言者）、dismiss 不成立 */
window.resolveReportedComment = async function (commentId, action) {
    const msg = action === 'delete'
        ? `⚠️ 確定要刪除 #${commentId} 號留言嗎？\n前台會看不到這則留言，留言者會收到通知；後台留著內容當紀錄。`
        : `確定 #${commentId} 號留言沒有違規，將待處理的檢舉判定為「不成立」嗎？\n(留言維持原狀)`;
    if (!await oceanConfirm(msg)) return;
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/comments/${Number(commentId)}/reports/resolve`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        if (response.ok) {
            alert(action === 'delete' ? "✅ 留言已刪除！" : "✅ 已標記為檢舉不成立！");
            loadReports();
        } else { const err = await response.json().catch(() => ({})); alert(`處理失敗: ${err.message || '請確認權限或網路狀態'}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}

/* 📝 便利貼檢舉：ban 下架（要寫原因，會通知作者）、dismiss 不成立（便利貼維持通過） */
window.resolveReportedNote = async function (noteId, action) {
    let violationReason = '';
    if (action === 'ban') {
        const reason = await oceanPrompt(`⚠️ 要下架 #${noteId} 號便利貼嗎？\n請寫下架原因（會通知作者）`, { title: '下架便利貼', okText: '下架', danger: true, defaultValue: '遭檢舉違規' });
        if (reason == null) return;
        if (!reason.trim()) { alert("必須填寫原因！"); return; }
        violationReason = reason.trim();
    } else if (!await oceanConfirm(`確定 #${noteId} 號便利貼沒有違規，將待處理的檢舉判定為「不成立」嗎？\n(便利貼維持原狀)`)) return;
    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/daily-notes/${Number(noteId)}/status`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action === 'ban' ? 2 : 1, violation_reason: violationReason }) });
        if (response.ok) {
            alert(action === 'ban' ? "✅ 便利貼已下架！" : "✅ 已標記為檢舉不成立！");
            loadReports();
            if (typeof loadDailyNotes === 'function') loadDailyNotes(); // 便利貼審核分頁的數字也要更新
        } else { const err = await response.json().catch(() => ({})); alert(`處理失敗: ${err.message || '請確認權限或網路狀態'}`); }
    } catch (e) { alert("伺服器連線失敗"); }
}

// ==========================================
// 8. 客服問題與意見回饋管理 (Customer Service)
// ==========================================
window._allCustomerServices = [];
window._filteredCsCache = [];
window._currentCsStatusFilter = 'all';
window._currentCsPage = 1;
window._csSortOrder = 'desc'; // 'desc' (由新到舊) 或 'asc' (由舊到新)
window._activeCsTicketId = null;

window.toggleCustomerServiceSort = function () {
    window._csSortOrder = window._csSortOrder === 'desc' ? 'asc' : 'desc';
    const btn = document.getElementById('sort-cs-btn');
    if (btn) {
        btn.innerHTML = window._csSortOrder === 'desc' ? '⏳ 由新到舊 ⬇️' : '⏳ 由舊到新 ⬆️';
    }
    filterCustomerServices();
};

window.updateDashboardCsCount = function () {
    if (!window._allCustomerServices) return;
    const pendingCount = window._allCustomerServices.filter(cs => Number(cs.status || 0) === 0).length;
    const badge = document.getElementById('cs-pending-count-badge');
    if (badge) {
        badge.innerText = `${pendingCount} 件待處理`;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
};

window.loadCustomerServices = async function () {
    const tbody = document.getElementById('admin-cs-body');
    const token = localStorage.getItem("authToken");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">讀取客服資料中...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/customer-services`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) throw new Error();
        const resData = await response.json();
        window._allCustomerServices = resData.data || resData || [];
        updateDashboardCsCount();
        filterCustomerServices();
    } catch (e) {
        console.error("載入客服紀錄失敗:", e);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">無法載入客服紀錄</td></tr>`;
    }
};

window.filterCsByStatus = function (status) {
    window._currentCsStatusFilter = status;
    const btnKeys = ['all', 0, 1, 2];
    btnKeys.forEach(key => {
        const el = document.getElementById('filter-cs-' + key);
        if (!el) return;
        if (String(key) === String(status)) {
            el.style.background = '#3b82f6';
            el.style.color = '#fff';
            el.style.borderColor = '#3b82f6';
        } else {
            el.style.background = '#f8fafc';
            el.style.color = '#64748b';
            el.style.borderColor = '#e2e8f0';
        }
    });
    filterCustomerServices();
};

window.filterCustomerServices = function () {
    const keyword = document.getElementById('search-cs')?.value.toLowerCase().trim() || '';

    window._filteredCsCache = window._allCustomerServices.filter(cs => {
        const id = String(cs.id || '');
        const title = String(cs.title || '').toLowerCase();
        const message = String(cs.message || '').toLowerCase();
        const reply = String(cs.reply || '').toLowerCase();
        const memberName = String(cs.member?.name || cs.member_name || '').toLowerCase();
        const memberEmail = String(cs.member?.email || cs.email || '').toLowerCase();

        const matchKeyword = id.includes(keyword) ||
                             title.includes(keyword) ||
                             message.includes(keyword) ||
                             reply.includes(keyword) ||
                             memberName.includes(keyword) ||
                             memberEmail.includes(keyword);

        let matchStatus = true;
        if (window._currentCsStatusFilter !== 'all') {
            matchStatus = (Number(cs.status || 0) === Number(window._currentCsStatusFilter));
        }

        return matchKeyword && matchStatus;
    });

    window._filteredCsCache.sort((a, b) => {
        const timeA = getItemTimestamp(a, 'id');
        const timeB = getItemTimestamp(b, 'id');
        return window._csSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    window._currentCsPage = 1;
    applyCsPagination();
};

window.changeCsPage = function (newPage) {
    window._currentCsPage = newPage;
    applyCsPagination();
};

function applyCsPagination() {
    const startIndex = (window._currentCsPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pagedData = window._filteredCsCache.slice(startIndex, endIndex);

    renderCustomerServices(pagedData);
    renderPagination(window._filteredCsCache.length, window._currentCsPage, 'cs-pagination', 'changeCsPage');
}

function renderCustomerServices(tickets) {
    const tbody = document.getElementById('admin-cs-body');
    if (!tbody) return;

    if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">☕</span><p>目前沒有符合條件的客服案件唷！</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = tickets.map(ticket => {
        const id = ticket.id;
        const member = ticket.member || {};
        const memberDisplayName = member.name || ticket.member_name || `會員 #${ticket.member_id}`;
        const memberEmail = member.email || ticket.email || '';
        const date = ticket.created_at ? new Date(ticket.created_at).toLocaleString("zh-TW") : '未知';
        const statusNum = Number(ticket.status || 0);

        let statusBadge = "";
        if (statusNum === 0) {
            statusBadge = `<span class="badge" style="background:#fef9c3; color:#854d0e; border:1px solid #fde047;">⏳ 待處理</span>`;
        } else if (statusNum === 1) {
            statusBadge = `<span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">⚙️ 處理中</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; border:1px solid #86efac;">✅ 已結案</span>`;
        }

        const hasReply = Boolean(ticket.reply && ticket.reply.trim());
        const replyBadge = hasReply
            ? `<span class="badge" style="background:#ecfeff; color:#0891b2; border:1px solid #a5f3fc;" title="${escapeHTML(ticket.reply)}">💬 已有回覆</span>`
            : `<span class="badge" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3;">❌ 尚未回覆</span>`;

        const rowBg = statusNum === 0 ? '#ffffff' : '#f8fafc';

        const imageCount = Array.isArray(ticket.images) ? ticket.images.length : 0;
        const imageTag = imageCount > 0
            ? `<span class="badge" style="margin-top: 6px; display: inline-block; background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe; font-size: 0.75rem;">📎 ${imageCount} 張圖片</span>`
            : '';

        return `
        <tr style="background: ${rowBg}; transition: 0.25s;">
            <td data-label="案件 ID" style="color: #64748b; font-weight: 700;">#${id}</td>
            <td data-label="提問會員">
                <div style="font-weight: 600; color: #1e293b;">${escapeHTML(memberDisplayName)}</div>
                ${memberEmail ? `<div style="font-size: 0.8rem; color: #94a3b8;">${escapeHTML(memberEmail)}</div>` : ''}
            </td>
            <td data-label="問題主旨" style="min-width: 200px; max-width: 320px;">
                <div style="font-weight: 600; color: #0f172a; line-height: 1.4; word-break: break-word;">${escapeHTML(ticket.title)}</div>
                <div style="font-size: 0.82rem; color: #64748b; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHTML(ticket.message)}</div>
                ${imageTag}
            </td>
            <td data-label="提交時間" style="color: #64748b; font-size: 0.85rem; white-space: nowrap;">${date}</td>
            <td data-label="案件狀態">${statusBadge}</td>
            <td data-label="回覆狀況">${replyBadge}</td>
            <td data-label="操作" style="white-space: nowrap;">
                <button class="btn-action btn-primary" onclick="openCsReplyModal(${id})">${hasReply ? '查看 / 重覆' : '💬 回覆'}</button>
                <button class="btn-action" style="margin-left: 5px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;" onclick="openCsStatusModal(${id})">🔄 狀態</button>
                <button class="btn-action btn-danger" style="margin-left: 5px;" onclick="deleteCustomerServiceAsAdmin(${id})">刪除</button>
            </td>
        </tr>
        `;
    }).join('');
}

// 彈窗 1：回覆客服案件
window.openCsReplyModal = function (ticketId) {
    const ticket = window._allCustomerServices.find(t => Number(t.id) === Number(ticketId));
    if (!ticket) return;

    window._activeCsTicketId = ticketId;

    const member = ticket.member || {};
    const memberName = member.name || ticket.member_name || `會員 #${ticket.member_id}`;
    const memberEmail = member.email || ticket.email || '無提供';
    const date = ticket.created_at ? new Date(ticket.created_at).toLocaleString("zh-TW") : '未知';

    document.getElementById('cs-modal-title').innerText = `💬 案件 #${ticket.id}：${ticket.title}`;

    const statusNum = Number(ticket.status || 0);
    let statusText = statusNum === 0 ? "⏳ 待處理" : statusNum === 1 ? "⚙️ 處理中" : "✅ 已結案";
    let statusColor = statusNum === 0 ? "#854d0e" : statusNum === 1 ? "#475569" : "#166534";
    let statusBg = statusNum === 0 ? "#fef9c3" : statusNum === 1 ? "#f1f5f9" : "#dcfce7";
    document.getElementById('cs-modal-status-badge').innerHTML = `<span class="badge" style="background:${statusBg}; color:${statusColor}; font-weight:bold;">${statusText}</span>`;

    document.getElementById('cs-modal-user-info').innerText = `👤 提問者：${memberName} (${memberEmail}) ｜ 📅 提交時間：${date}`;
    document.getElementById('cs-modal-message-box').innerText = ticket.message || '（無內容）';

    // 附加圖片：有圖才顯示區塊，點縮圖開新分頁看原圖
    const images = Array.isArray(ticket.images) ? ticket.images : [];
    document.getElementById('cs-modal-images-wrap').style.display = images.length > 0 ? 'block' : 'none';
    document.getElementById('cs-modal-images').innerHTML = images.map((url, i) => {
        const fullUrl = escapeHTML(API_BASE_URL + url);
        return `<a href="${fullUrl}" target="_blank" rel="noopener" title="查看原圖">
            <img src="${fullUrl}" alt="附加圖片 ${i + 1}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 10px; border: 1.5px solid #e2e8f0; display: block;" />
        </a>`;
    }).join('');

    const replyTextarea = document.getElementById('cs-reply-textarea');
    replyTextarea.value = ticket.reply || '';

    const statusSelect = document.getElementById('cs-reply-status-select');
    statusSelect.value = ticket.reply ? String(ticket.status || 2) : "2";

    document.getElementById('cs-reply-modal').style.display = 'flex';
    replyTextarea.focus();
};

window.closeCsReplyModal = function () {
    const modal = document.getElementById('cs-reply-modal');
    if (modal) modal.style.display = 'none';
    window._activeCsTicketId = null;
};

window.submitCsReply = async function () {
    if (!window._activeCsTicketId) return;

    const reply = document.getElementById('cs-reply-textarea').value.trim();
    const status = Number(document.getElementById('cs-reply-status-select').value);

    if (!reply) {
        alert("請輸入回覆內容！");
        document.getElementById('cs-reply-textarea').focus();
        return;
    }

    const btn = document.getElementById('btn-submit-cs-reply');
    btn.disabled = true;
    btn.innerText = "傳送中...";

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/customer-services/${window._activeCsTicketId}/reply`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ reply, status })
        });

        const res = await response.json();

        if (response.ok) {
            alert("🎉 回覆成功！系統已同步發送通知至會員通知中心。");
            closeCsReplyModal();
            loadCustomerServices(); // 重新拉取最新資料
        } else {
            alert("回覆失敗：" + (res.message || "伺服器錯誤"));
        }
    } catch (e) {
        console.error("回覆失敗:", e);
        alert("連線伺服器失敗，請稍後再試！");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 確認回覆並發送通知";
    }
};

// 彈窗 2：快速更改客服案件狀態
window.openCsStatusModal = function (ticketId) {
    window._activeCsTicketId = ticketId;
    document.getElementById('cs-status-modal-ticket-id').innerText = `正在修改案件 #${ticketId} 的處理狀態`;
    document.getElementById('cs-status-modal').style.display = 'flex';
};

window.closeCsStatusModal = function () {
    const modal = document.getElementById('cs-status-modal');
    if (modal) modal.style.display = 'none';
    window._activeCsTicketId = null;
};

window.confirmChangeCsStatus = async function (statusNum) {
    if (!window._activeCsTicketId) return;

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/customer-services/${window._activeCsTicketId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ status: statusNum })
        });

        if (response.ok) {
            alert("✅ 案件狀態已成功更新！");
            closeCsStatusModal();
            loadCustomerServices();
        } else {
            const err = await response.json();
            alert("更新狀態失敗：" + (err.message || "未知錯誤"));
        }
    } catch (e) {
        console.error("更新狀態連線失敗:", e);
        alert("連線伺服器失敗！");
    }
};

// 刪除客服案件
window.deleteCustomerServiceAsAdmin = async function (ticketId) {
    if (!await oceanConfirm(`⚠️ 確定要刪除客服案件 #${ticketId} 嗎？此操作無法復原！`)) return;

    try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(`${API_BASE_URL}/admin/customer-services/${ticketId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'ngrok-skip-browser-warning': 'true'
            }
        });

        if (response.ok) {
            alert("🗑️ 客服案件已成功刪除！");
            window._allCustomerServices = window._allCustomerServices.filter(t => Number(t.id) !== Number(ticketId));
            filterCustomerServices();
            updateDashboardCsCount();
        } else {
            const err = await response.json();
            alert("刪除失敗：" + (err.message || "未知錯誤"));
        }
    } catch (e) {
        console.error("刪除案件失敗:", e);
        alert("連線伺服器失敗！");
    }
};

