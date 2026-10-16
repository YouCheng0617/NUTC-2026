/*
 * AI 特助聊天：由後端轉給本機的 Python AI 服務（api_server.py，只聽 127.0.0.1:5000）
 * 以前前端直接打 /api/chat（nginx 轉給 Python），沒有登入檢查，知道網址就能一直叫 AI；
 * 改成登入後經過這裡才叫得到，跟塔羅解牌（/game/tarot/reading）同一套做法
 */
const AI_CHAT_URL = "http://127.0.0.1:5000/api/chat";
const AI_TIMEOUT_MS = 60 * 1000; // AI 生成比較慢，最多等 60 秒

export const MAX_CHAT_LENGTH = 1000; // 一則訊息最多幾個字
export const CHAT_LANGUAGES = ["zh-TW", "zh-CN", "en", "ja"];

export const requestAiChat = async (message: string, language: string): Promise<string> => {
    let response: Response;
    try {
        response = await fetch(AI_CHAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, language }),
            signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        });
    } catch (error) {
        console.error("❌ 無法連線到 AI 特助服務 (請確認 python api_server.py 是否有啟動):", error);
        throw new Error("AI_UNAVAILABLE");
    }
    if (!response.ok) {
        console.error("⚠️ AI 特助服務回傳異常狀態碼:", response.status);
        throw new Error("AI_UNAVAILABLE");
    }
    const data = await response.json().catch(() => null) as { reply?: unknown } | null;
    if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("AI_UNAVAILABLE");
    }
    return data.reply;
};
