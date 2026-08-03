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
