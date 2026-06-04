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
}

看文： GET /bottles/random
一樣給Token就行

審核瓶子: PATCH /bottles/review
Headers要給 x-api-key (跟我拿)
{
    "bottle_id":,
    "status":1 /*只能輸入0 or 1*/
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
