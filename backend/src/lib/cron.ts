import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { executeDueDeletions } from "../modules/account-deletion/accountDeletion.service.js";

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

    cron.schedule("10 0 * * *", async () => {
        console.log("🧹 [每日排程] 開始清除過期的信箱驗證與密碼重設憑證...")
        try {
            const now = new Date();
            const [verifications, resets] = await Promise.all([
                prisma.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } }),
                prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: now } } }),
            ]);
            console.log(`✅ 清理成功，驗證憑證 ${verifications.count} 筆、重設憑證 ${resets.count} 筆`);
        } catch (error: any) {
            console.error("❌ 清除過期憑證失敗:", error);
        }
    }, {
        timezone: "Asia/Taipei",
    });

    /*每小時整點：後悔期滿 7 天的帳號正式註銷*/
    cron.schedule("0 * * * *", async () => {
        try {
            const count = await executeDueDeletions();
            if (count > 0) console.log(`✅ [註銷排程] 已註銷 ${count} 個帳號`);
        } catch (error: any) {
            console.error("❌ 執行帳號註銷排程失敗:", error);
        }
    }, {
        timezone: "Asia/Taipei",
    });
}
