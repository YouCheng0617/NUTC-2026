import { sendEmailAdminCaseAlert } from "./mailer.js";

/*
 * 🚨 有新的檢舉或客服案件時寄信提醒管理員
 * 收件人：.env 的 ADMIN_ALERT_EMAILS，用逗號分隔（不寫在程式裡，repo 公開也不會把信箱放出去）
 * 不等寄信結果：信寄不出去也不影響使用者送出檢舉或客服
 * 用到時才讀環境變數（index.ts 是先載入各模組、後讀 .env）
 */
export const alertAdmins = (alert: Parameters<typeof sendEmailAdminCaseAlert>[1]) => {
    const to = (process.env.ADMIN_ALERT_EMAILS || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    if (to.length === 0) {
        console.warn(`⚠️ 沒設定 ADMIN_ALERT_EMAILS，不寄「${alert.kind}」案件提醒`);
        return;
    }
    sendEmailAdminCaseAlert(to, alert).catch(err => console.error("案件提醒寄送失敗:", err));
};
