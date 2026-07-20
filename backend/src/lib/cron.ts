import cron from "node-cron";
import prisma from "../lib/prisma.js";

export function initCron() {
    cron.schedule("0 0 * * *", async () => {
        console.log("🧹 [每日排程] 00:00 到了，開始清空昨天的每日便利貼...")
        try {
            const deleted = await prisma.daliyNote.deleteMany({})
            console.log(`✅ 清理成功，共清除了 ${deleted.count} 筆便利貼`);
        } catch (error: any) {
            console.error("❌ 清除每日便利貼失敗:", error);
        }
    }, {
        timezone: "Asia/Taipei",
    });
}