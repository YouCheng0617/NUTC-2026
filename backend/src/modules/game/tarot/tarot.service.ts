import prisma from "../../../lib/prisma.js";

/**
 * 取得台北時區 (UTC+8) 的 YYYY-MM-DD 日期字串
 */
export const getTodayDateStr = (date: Date = new Date()): string => {
    const formatter = new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    return formatter.format(date).replace(/\//g, "-");
};

export interface TarotCardInput {
    name: string;
    position?: string;
    meaning?: string;
}

export interface TarotDrawInput {
    past?: TarotCardInput;
    present?: TarotCardInput;
    future?: TarotCardInput;
}

const DAILY_TAROT_LIMIT = 3;

/**
 * 取得使用者今日塔羅占卜剩餘次數及狀態
 */
export const getTarotDailyStatus = async (memberId: number) => {
    const today = getTodayDateStr();

    // 查詢今天進行的占卜次數
    const count = await prisma.tarotRecord.count({
        where: {
            member_id: memberId,
            date: today
        }
    });

    const remaining = Math.max(0, DAILY_TAROT_LIMIT - count);

    return {
        today,
        dailyLimit: DAILY_TAROT_LIMIT,
        usedCount: count,
        remainingCount: remaining,
        canDraw: remaining > 0
    };
};

/**
 * 記錄一次占卜（扣除一次每日額度）並檢查是否超過上限
 */
export const drawTarot = async (memberId: number, cards?: TarotDrawInput) => {
    const today = getTodayDateStr();

    // 檢查今天已占卜次數
    const count = await prisma.tarotRecord.count({
        where: {
            member_id: memberId,
            date: today
        }
    });

    if (count >= DAILY_TAROT_LIMIT) {
        throw new Error("今日占卜次數已達上限 (每日最多 3 次)，明天 00:00 將會重置！");
    }

    // 建立占卜紀錄
    const newRecord = await prisma.tarotRecord.create({
        data: {
            member_id: memberId,
            date: today,
            past_card: cards?.past?.name || null,
            present_card: cards?.present?.name || null,
            future_card: cards?.future?.name || null
        }
    });

    const remaining = DAILY_TAROT_LIMIT - (count + 1);

    return {
        record: newRecord,
        usedCount: count + 1,
        remainingCount: remaining,
        message: `占卜成功！今日剩餘占卜次數：${remaining} 次`
    };
};


/*
 * AI 解牌：由後端轉給本機的 Python AI 服務（api_server.py，只聽 127.0.0.1:5000）
 * 以前前端直接打 /api/tarot，沒有登入檢查，知道網址就能一直叫 AI；改成登入後經過這裡才叫得到
 */
const AI_TAROT_URL = "http://127.0.0.1:5000/api/tarot";
const AI_TIMEOUT_MS = 60 * 1000; // AI 生成比較慢，最多等 60 秒

export interface TarotReadingInput {
    card_name: string;
    orientation: string;
    question: string;
}

export const requestTarotReading = async (input: TarotReadingInput): Promise<string> => {
    let response: Response;
    try {
        response = await fetch(AI_TAROT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        });
    } catch (error) {
        console.error("❌ 無法連線到 AI 塔羅服務 (請確認 python api_server.py 是否有啟動):", error);
        throw new Error("AI_UNAVAILABLE");
    }
    if (!response.ok) {
        console.error("⚠️ AI 塔羅服務回傳異常狀態碼:", response.status);
        throw new Error("AI_UNAVAILABLE");
    }
    const data = await response.json().catch(() => null) as { analysis?: unknown } | null;
    if (!data || typeof data.analysis !== "string" || !data.analysis.trim()) {
        throw new Error("AI_UNAVAILABLE");
    }
    return data.analysis;
};
