import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { requestAiChat, MAX_CHAT_LENGTH, CHAT_LANGUAGES } from "./aiChat.service.js";

export const aiChatController = {
    /* AI 特助聊天（要登入，經過後端才叫得到 AI） */
    async postChat(req: AuthRequest, res: Response) {
        try {
            const { message, language } = req.body ?? {};
            /*只收字串並限制長度，避免被拿來塞超長內容給 AI*/
            if (typeof message !== "string" || !message.trim()) {
                return res.status(400).json({ message: "訊息不能是空的喔" });
            }
            if (message.length > MAX_CHAT_LENGTH) {
                return res.status(400).json({ message: `訊息太長了，最多 ${MAX_CHAT_LENGTH} 個字` });
            }
            const lang = CHAT_LANGUAGES.includes(language) ? language : "zh-TW";

            const reply = await requestAiChat(message.trim(), lang);
            return res.status(200).json({ status: "success", reply });
        } catch (error: any) {
            if (error.message === "AI_UNAVAILABLE") {
                return res.status(503).json({ message: "AI 特助暫時休息中，請稍後再試" });
            }
            console.error("postChat 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    },
};
