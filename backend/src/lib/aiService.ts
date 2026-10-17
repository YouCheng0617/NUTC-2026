/*
 * Python AI 服務（AI/src/api_server.py）的位置
 * 預設跟 Node 在同一台機器：http://127.0.0.1:5000
 * AI 服務放在別台機器時，在 backend/.env 設 AI_SERVICE_URL=http://<那台的內網 IP>:5000
 * 用到時才讀環境變數（index.ts 是先載入各模組、後讀 .env，在檔案開頭讀會讀到空的）
 */
export const aiServiceUrl = (path: string) =>
    (process.env.AI_SERVICE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "") + path;
