# 🚀 匿名漂流瓶廣播站 - 後端系統 (Backend)

這是基於 Node.js 與 Prisma 開發的後端專案。本文件旨在幫助開發人員快速理解專案架構與開發流程。

---

## 📂 檔案架構說明

專案採用「功能模組化」設計，讓邏輯清晰且易於擴充。

### 📁 資料夾規則

* **`src/lib/`**：存放通用工具與函式庫（例如：`prisma.ts` 資料庫實例）。
* **`src/modules/`**：存放各項功能定義。
* **`auth/`**：處理使用者登入、註冊、驗證與授權。
* **`member/`**：處理會員資料與相關個人功能。

### 📄 檔案命名與職責

每個模組資料夾內通常包含以下三類檔案：

1. **`*.router.ts` (路由)**：定義對外的 API 接口（如：GET /members）。
2. **`*.controller.ts` (控制)**：負責處理請求（Request）與回應（Response）的進出。
3. **`*.service.ts` (邏輯)**：商業邏輯核心，負責調用資料庫並進行數據判斷。

---

## 🛠️ 開發與指令

### 1. 啟動流程

1. 確保根目錄已有 `.env` 檔案並設定好 `DATABASE_URL`。
2. 執行 `npm install` 安裝依賴。
3. 執行 `npm run dev` 啟動開發伺服器。

### 2. 資料庫指令

如果你修改了 `schema.prisma`，請務必執行：

```bash
# 同步資料庫結構並產生遷移紀錄 (Migration)
npx prisma migrate dev

* **安全性規範**：所有使用者密碼嚴禁明文存入資料庫，必須使用 `bcrypt` 進行雜湊處理後方可儲存。

postman 測試用語

註冊： POST /auth/register
{
  "email": "",
  "password": "",
  "name": "",
  "birthday": "1995-01-01T00:00:00.000Z",
  "gender": "",
  "bio": "",
  "blood_type": "",
  "constellation": "" /*可填可不填因為有函式自動判別*/
}

登入： POST /auth/login
{
  "email": "",
  "password": ""
}

登出： POST /auth/logout
給Token就好

驗證Token： /auth/profile
不需要放東西給Token就好

發文： POST /bottles
{
    "title": "",
    "content": "",
    "isAnonymous": false,
    "category_id": []
    "pollOptions": []
}

看文： GET /bottles/random
一樣給Token就行

審核瓶子: PATCH /bottles/review
Headers要給 x-api-key (跟我拿)
{
    "bottle_id":,
    "status":1 /*只能輸入1 or 2*/
}

忘記密碼申請： POST /auth/forgot-password
{
  "email": ""
}

重設密碼： POST /auth/reset-password
{
  "token": "",
  "newPassword": ""
}
查看我的瓶子  GET 給Token /bottles/mybottles

按讚瓶子 POST 給Token /bottles:/like (:後是他的id，例如給id 11文章點讚，/bottles/11/like)
收藏瓶子 POST 給Token /:bottleId/save (:後是他的id，例如給id 11文章收藏，/bottles/11/save)
查看按讚瓶子 GET 給Token /bottles/liked
查看收藏瓶子 GET 給Token /bottles/saved

管理員查看使用者名單 GET 給Token /admin/members

更改使用者狀態 PUT 給Token /admin/members/8/status
{
  "newStatus": "" /*只能填ACTIVE、INACTIVE 或 BANNED*/
}
管理員查看  瓶子清單 GET 給Token  /admin/bottles

更改瓶子狀態 PUT 給Token /admin/bottles/review
{
    "bottle_id": 1,
    "status": 1, 
    "violation_reason": "" /*如果輸入1就不用填，輸入2就要填*/
}

刪除自己的文章 DELETE 給Token /:bottleId/delete (:後是他的id，例如給id 11文章刪除，/bottles/11/delete)
管理員刪除文章 DELETE 給Token /admin/bottles/:bottleId/delete (:後是他的id，例如給id 11文章刪除，/admin/bottles/11/delete)
管理員刪除使用者 DELETE 給Token /admin/members/:memberId/delete (:後是他的id，例如給id 11使用者刪除，/admin/members/11/delete)


類別新增 POST 給Token /category/create
{
    "name": ""
}

會員資料更改 PATCH 給Token /auth/update-data
{
  "name": "",           
  "birthday": "",  
  "blood_type": "",         
  "bio": "" 
}

使用者檢舉瓶子 POST 給Token /bottles/:bottleId/report (:bottleId 是被檢舉的瓶子id，例如要檢舉 id 84 的瓶子，/bottles/84/report)
{
"reason": "這篇文章包含惡意攻擊與髒話"
}

管理員獲取檢舉列表 GET 給Token /admin/bottles/reported

新增留言 POST 給Token /comments/bottles/:bottleId
(要留言給 ID 84 的瓶子/comments/bottles/84)
{
    "content": "這是一則溫暖的回覆。"
    "isAnonymous": false,
}

獲取特定瓶子的所有留言 GET /comments/bottles/:bottleId
(要拿 ID 84 瓶子的所有留言，網址為 /comments/bottles/84)

儲存或更新遊戲分數 POST 給Token /game/:gameName
(例如漂流瓶遊戲：/game/little-bottle)
{
    "difficulty": "EASY",
    "score": 150
}

獲取個人特定難度最高分 GET 給Token /game/:gameName/:difficulty
(例如獲取漂流瓶 EASY 最高分：/game/little-bottle/EASY)

獲取特定難度排行榜 GET 給Token /game/:gameName/:difficulty/ranking
(例如獲取漂流瓶 EASY 排行榜：/game/little-bottle/EASY/ranking)
Query 參數 (選填)：?limit=20 (預設為 10，如要拿前 20 名可帶此參數)

留言按讚 POST 給Token /comments/:commentId/like
(:後是他的id，例如給id 11留言點讚，/bottles/11/like)

發布每日便利貼 POST 給Token /game/daily-note
{
  "content": "今天又是充滿希望的一天！大家加油！"
}

取得今日所有便利貼 GET 給Token /game/daily-note

搜尋漂流瓶 GET 給Token (或不給也可) /bottles/search
(例如搜尋標題或內容有「開心」的文章：/bottles/search?keyword=開心)
Query 參數 (必填)：?keyword=你要找的字

追蹤 POST 給Token /auth/follow
{
  "followedId": 2
}

取得我的粉絲列表 GET 給Token /auth/followers

取得我追蹤的人列表 GET 給Token /auth/following

獲取熱門文章 GET /bottles/popular

新增回覆-子留言 POST 給Token /comments/bottles/:bottleId/comments/:parentId/reply 
(:bottleId: 漂流瓶的 ID ; :parentId: 要回覆的主留言 ID)

投票 POST 給Token /bottles/:bottleId/vote
{
  "optionId": 2
}

管理員獲取所有留言 GET 給Token /admin/comments

取得當前登入使用者的通知列表 GET 給Token /notifications

將單筆通知標記為已讀 PATCH 給Token /notifications/:id/read
(:id 是通知的 ID，例如：/notifications/1/read)

一鍵全部標記為已讀 PATCH 給Token /notifications/read-all


取得我的寵物與背包資料 GET 給Token /pet-games/my-pet

寵物命名 POST 給Token /pet-games/rename
{
  "newName": "寵物名字"
}

與寵物互動(賺金幣) POST 給Token /pet-games/interact
{
  "actionType": "FEED" /* 可選值: "FEED(餵食海藻)", "PURIFY(淨化水質)", "PET(溫柔撫摸)" */
}

購買或裝備商店物品 POST 給Token /pet-games/buy
{
  "category": "pet_color", /*可選: "pet_color(圖鑑)", "background_color(背景)", "background_effects(特效)" */
  "itemName": "snow"
}

每日簽到 POST 給Token /pet-games/sign-in
(每日限簽到 1 次，14 天一週期循環：每滿 7 天即第 7、14 天獲得 200 金幣，其餘天數每天 100 金幣)

查詢簽到狀態與 14 天獎勵預覽 GET 給Token /pet-games/sign-in-status

---

### 🧩 拼圖收集/圖鑑遊戲 API (`/game/collect`)

> **遊戲機制說明**：
> 每張圖片代表一個拼圖（預設分為 **1 ~ 9 號碎片**，前端可以 3x3 九宮格形式呈現）。
> 使用者抽卡時會隨機獲得某張圖的其中一塊碎片（1~9），收集齊全 1~9 塊碎片即代表完成該張拼圖 (`is_completed: true`)。

#### 1. 隨機抽取拼圖碎片 (抽卡/任務領取)
* **方法與路徑**：`POST /game/collect/unlock`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **機率規則**：普通 (NORMAL) 95%、高級 (PREMIUM) 5%，並隨機獲得該圖 **1~9 號** 其中一塊碎片
* **Request Body** (選填)：
```json
{
  "obtained_from": "DAILY_TASK" /* 獲得管道說明 (選填，預設為 "TASK") */
}
```

* **Response 範例**：

```json
{
  "message": "✨ 恭喜獲得【clown fish】的第 3 號碎片！(4/9)",
  "data": {
    "isNewPiece": true, // 是否為新碎片 (false 代表抽到已擁有的重複碎片)
    "drawnPiece": 3, // 本次抽到的碎片編號 (1~9)
    "isCompleted": false, // 該拼圖目前是否已全部集齊
    "isCompletedNow": false, // 是否在本次抽卡剛好集齊第 9 片完成拼圖
    "picture": {
      "id": 1,
      "title": "clown fish",
      "description": "探索海洋所獲得的 clown fish 拼圖！",
      "image_url": "/uploads/marine-creatures/fish/clown_fish.webp",
      "total_pieces": 9,
      "rarity": "NORMAL", // "NORMAL" (普通) 或 "PREMIUM" (高級)
      "category": "海洋生物",
      "task_requirement": "完成每日海洋任務或基礎活動獲得"
    },
    "puzzleProgress": {
      "unlocked_pieces": [1, 3, 5, 8], // 當前已獲得的碎片編號清單
      "piece_count": 4, // 當前碎片總數
      "total_pieces": 9,
      "progressRate": "44.4%" // 單圖完成進度
    },
    "stats": {
      "completedPuzzles": 2, // 使用者已完整拼出的圖鑑總數
      "totalPuzzles": 20, // 全系統拼圖總數
      "overallCompletionRate": "10.0%" // 全圖鑑總體完成率
    }
  }
}
```

#### 2. 獲取全圖拼圖圖鑑列表 (圖鑑總覽)

* **方法與路徑**：`GET /game/collect/gallery`
* **身份驗證**：非必要 (若有帶 Token 會包含使用者每張圖的 1~9 碎片收集清單)
* **Query 參數** (選填)：`?category=海洋生物`
* **Response 範例**：

```json
{
  "message": "取得拼圖圖鑑清單成功",
  "data": {
    "stats": {
      "total": 20, // 全系統拼圖總數
      "normalCount": 16,
      "premiumCount": 4,
      "completedCount": 2, // 已完整集齊 9 片的拼圖數
      "inProgressCount": 5, // 拼圖收集中的數量
      "unstartedCount": 13, // 尚未獲得任何碎片的數量
      "completionRate": "10.0%"
    },
    "pictures": [
      {
        "id": 1,
        "title": "clown fish",
        "description": "...",
        "image_url": "/uploads/marine-creatures/fish/clown_fish.webp",
        "total_pieces": 9,
        "rarity": "NORMAL",
        "category": "海洋生物",
        "task_requirement": "...",
        "user_progress": {
          "unlocked_pieces": [1, 3, 5, 8], // 已擁有的碎片編號
          "piece_count": 4, // 已解鎖碎片數 (0~9)
          "total_pieces": 9,
          "is_completed": false, // 是否 9 片全齊
          "progress_rate": "44.4%",
          "completed_at": null,
          "obtained_from": "DAILY_TASK"
        }
      }
    ]
  }
}
```

#### 3. 獲取個人拼圖清單 (我的拼圖)

* **方法與路徑**：`GET /game/collect/my`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **Query 參數** (選填)：
  * `?status=ALL` (預設，回傳全部有進度的拼圖) / `?status=COMPLETED` (僅完整集齊) / `?status=IN_PROGRESS` (僅拼圖中)
  * `?rarity=NORMAL` 或 `?rarity=PREMIUM` (依稀有度篩選)
  * `?category=海洋生物` (依主題分類篩選)
* **Response 範例**：

```json
{
  "message": "取得我的拼圖清單成功",
  "data": {
    "total": 7,
    "completedCount": 2,
    "inProgressCount": 5,
    "pictures": [
      {
        "id": 1,
        "title": "clown fish",
        "description": "探索海洋所獲得的 clown fish 拼圖！",
        "image_url": "/uploads/marine-creatures/fish/clown_fish.webp",
        "rarity": "NORMAL",
        "category": "海洋生物",
        "task_requirement": "完成每日海洋任務或基礎活動獲得",
        "unlocked_pieces": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "piece_count": 9,
        "total_pieces": 9,
        "is_completed": true,
        "progress_rate": "100.0%",
        "completed_at": "2026-08-20T12:00:00.000Z",
        "obtained_from": "DAILY_TASK",
        "updated_at": "2026-08-20T12:30:00.000Z"
      }
    ]
  }
}
```

#### 4. 碎片兌換寶箱 (4 種兌換規則)

* **方法與路徑**：`POST /game/collect/exchange`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **兌換規則對照表**：
  * `1`：`10 個普通碎片` 換 `1 個普通寶箱`
  * `2`：`30 個普通碎片` 換 `1 個高級寶箱`
  * `3`：`1 個高級碎片` 換 `10 個普通寶箱`
  * `4`：`5 個高級碎片` 換 `1 個高級寶箱`
* **Request Body**：

```json
{
  "exchange_type": 1, /* 兌換類型: 1, 2, 3 或 4 */
  "times": 1 /* 兌換次數 (預設 1 次) */
}
```

* **Response 範例**：

```json
{
  "message": "🎉 兌換成功！消耗 10 個普通碎片，兌換 1 個普通寶箱",
  "data": {
    "exchangeType": 1,
    "times": 1,
    "exchangeDesc": "消耗 10 個普通碎片，兌換 1 個普通寶箱",
    "inventory": {
      "normal_fragments": 5, // 扣除後的普通碎片餘額
      "premium_fragments": 2, // 高級碎片餘額
      "normal_chests": 3, // 普通寶箱餘額
      "premium_chests": 1 // 高級寶箱餘額
    }
  }
}
```

#### 5. 開啟寶箱 (開出必定為該稀有度的拼圖碎片)

* **方法與路徑**：`POST /game/collect/open-chest`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **說明**：普通寶箱必定抽中普通拼圖碎片，高級寶箱必定抽中高級拼圖碎片。
* **Request Body**：

```json
{
  "chest_type": "NORMAL", /* "NORMAL" (普通寶箱) 或 "PREMIUM" (高級寶箱) */
  "count": 1 /* 開啟數量 (選填，預設 1 個，單次最多 50 個) */
}
```

* **Response 範例**：

```json
{
  "message": "🎁 成功開啟 1 個普通寶箱！",
  "data": {
    "chestType": "NORMAL",
    "count": 1,
    "results": [
      {
        "isNewPiece": true,
        "drawnPiece": 5,
        "isCompleted": false,
        "picture": {
          "id": 2,
          "title": "turtle",
          "rarity": "NORMAL",
          "image_url": "/uploads/marine-creatures/fish/turtle.webp"
        },
        "puzzleProgress": {
          "unlocked_pieces": [2, 5],
          "piece_count": 2,
          "total_pieces": 9
        }
      }
    ],
    "inventory": {
      "normal_fragments": 6,
      "premium_fragments": 2,
      "normal_chests": 2,
      "premium_chests": 1
    }
  }
}
```

#### 6. 查詢個人碎片與寶箱庫存
* **方法與路徑**：`GET /game/collect/inventory`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **Response 範例**：
```json
{
  "message": "取得庫存成功",
  "data": {
    "normal_fragments": 25, // 普通碎片數量
    "premium_fragments": 6, // 高級碎片數量
    "normal_chests": 2, // 普通寶箱數量
    "premium_chests": 1 // 高級寶箱數量
  }
}
```

#### 7. 拼圖每日簽到 (30 天循環)
* **方法與路徑**：`POST /game/collect/sign-in`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **規則與獎勵**：
  * 每日限簽到 1 次（以 30 天為一週期循環）
  * **第 1 ~ 29 天**：每天獲得 **1 個普通寶箱** 🎁
  * **第 30 天（滿簽大獎）**：獲得 **1 個高級寶箱** 🌟
* **Response 範例**：
```json
{
  "message": "✨ 今日拼圖簽到成功！獲得 1 個普通寶箱 🎁 (第 1/30 天)",
  "reward": {
    "chest_type": "NORMAL", // "NORMAL" 或 "PREMIUM"
    "chest_name": "普通寶箱",
    "count": 1
  },
  "streak": 1, // 當前第幾天 (1~30)
  "totalSignInDays": 5, // 累計簽到天數
  "isDay30Bonus": false,
  "inventory": {
    "normal_fragments": 25,
    "premium_fragments": 6,
    "normal_chests": 3, // +1
    "premium_chests": 1
  }
}
```

#### 8. 查詢拼圖簽到狀態與 30 天獎勵清單
* **方法與路徑**：`GET /game/collect/sign-in-status`
* **身份驗證**：需要帶 Token (`Bearer Token`)
* **Response 範例**：
```json
{
  "is_signed_in_today": false, // 今日是否已簽到
  "current_streak": 2, // 當前連續天數 (0~30)
  "total_sign_in_days": 15, // 累計總天數
  "last_sign_in_date": "2026-08-19T14:00:00.000Z",
  "today_date": "2026-08-20",
  "schedule": [
    { "day": 1, "chest_type": "NORMAL", "chest_name": "普通寶箱", "count": 1, "status": "COMPLETED" },
    { "day": 2, "chest_type": "NORMAL", "chest_name": "普通寶箱", "count": 1, "status": "COMPLETED" },
    { "day": 3, "chest_type": "NORMAL", "chest_name": "普通寶箱", "count": 1, "status": "AVAILABLE_TODAY" },
    { "day": 30, "chest_type": "PREMIUM", "chest_name": "高級寶箱", "count": 1, "status": "UPCOMING" }
  ]
}
```

---

## 🐾 寵物多人連線 WebSocket (Socket.IO) 使用說明

### 🔌 連線位址

* **WebSocket 伺服器端點:** 同 HTTP Server 網址及 Port（預設 `https://163.17.135.120:3000`）

---

### 📤 前端發送事件 (Client -> Server)

#### 1. 創立房間 (`create_room`)

```json
// Event: "create_room"
{
  "playerData": {
    "memberId": 1,
    "petName": "海兔小可愛",
    "petColor": "snow"
  },
  "maxPlayers": 6 // 選填，房間人數上限 (2~6 人)，預設為 6
}
```

#### 2. 加入房間 (`join_room`)

```json
// Event: "join_room"
{
  "roomId": "ABC123", // 房間 6 碼邀請碼 (大寫英數)
  "playerData": {
    "memberId": 1,
    "petName": "海兔小可愛",
    "petColor": "snow"
  }
}
```

#### 3. 離開房間 (`leave_room`)

```json
// Event: "leave_room"
// 無需帶 Payload
```

#### 4. 寵物移動 (`move`)

```json
// Event: "move"
{
  "roomId": "ABC123",
  "x": 120, // 寵物 X 座標
  "y": 250  // 寵物 Y 座標
}
```

#### 5. 發送聊天訊息 (`send_message`)

```json
// Event: "send_message"
{
  "roomId": "ABC123",
  "message": "大家好呀！"
}
```

---

### 📥 前端接收事件 (Server -> Client)

#### 1. 創房成功通知 (`room_created`) — *僅發給創房者*

```json
{
  "roomId": "ABC123",
  "maxCapacity": 6
}
```

#### 2. 加入房間成功 (`room_joined`) — *僅發給剛加入者*

```json
{
  "roomId": "ABC123",
  "maxCapacity": 6,
  "players": [
    {
      "socketId": "xyz123...",
      "memberId": 1,
      "petName": "海兔小可愛",
      "petColor": "snow",
      "x": 0,
      "y": 0
    }
  ]
}
```

#### 3. 其他玩家加入 (`player_joined`) — *廣播給房間內其他人*

```json
{
  "socketId": "abc456...",
  "memberId": 2,
  "petName": "小藍海兔",
  "petColor": "blue",
  "x": 0,
  "y": 0
}
```

#### 4. 其他玩家移動 (`player_moved`) — *廣播給房間內其他人*

```json
{
  "socketId": "abc456...",
  "x": 150,
  "y": 300
}
```

#### 5. 玩家離開房間 (`player_left`) — *廣播給房間內所有人*

```json
{
  "socketId": "abc456..."
}
```

#### 6. 收到聊天/系統訊息 (`receive_message`) — *廣播給房間內所有人*

```json
{
  "senderName": "海兔小可愛", // 系統訊息會顯示 "系統"
  "message": "大家好呀！",
  "timestamp": "2026-08-04T14:35:00.000Z"
}
```

#### 7. 錯誤通知 (`error`) — *僅發給觸發錯誤者*

```json
{
  "message": "您已經在另一個房間中了，請先退出再開新房間！"
}
```
