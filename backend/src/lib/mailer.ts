import { Resend } from 'resend';
import 'dotenv/config';
const resend = new Resend(process.env.RESEND_API_KEY!);

export const sendEmailVerification = async (toEmail: string, token: string) => {
    try {
        const verifyUrl = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '📧 【Drift Bottle】請驗證你的電子信箱',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>歡迎加入心情漂流瓶</h1>
                    <h2>此連結僅供本人使用，請勿將此連結分享給他人</h2>
                    <p>請點擊下方按鈕完成信箱驗證並啟用帳號（此連結將在 30 分鐘後失效）：</p>
                    <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #000000; text-decoration: none; border-radius: 5px;">
                        驗證信箱
                    </a>
                    <p style="margin-top: 20px; color: #666;">若你沒有註冊本服務，請直接忽略這封信。</p>
                </div>
            `
        });

        if (error) {
            console.error('❌ 發送驗證信失敗:', error);
            return false;
        }

        console.log('✅ 驗證信發送成功:', data);
        return true;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        throw error;
    }
};

export const sendEmailLoginLocked = async (toEmail: string, token: string, lockedIp: string) => {
    try {
        const unlockUrl = `${process.env.FRONTEND_URL}/unlock-account.html?token=${token}`;
        const forgotUrl = `${process.env.FRONTEND_URL}/login.html?tab=forgot&email=${encodeURIComponent(toEmail)}`;
        const time = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });

        const { data, error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '🔒 【Drift Bottle】你的帳號登入已暫停',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>帳號登入已暫停</h1>
                    <p>我們在 <b>${time}</b> 偵測到有人從 IP <b>${lockedIp}</b> 連續輸入錯誤密碼登入你的帳號，該裝置已暫停登入 15 分鐘。</p>

                    <h2>是你本人嗎？</h2>
                    <p>請在原本登入的裝置上點擊下方按鈕，立即解除暫停（此連結將在 30 分鐘後失效）：</p>
                    <a href="${unlockUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #000000; text-decoration: none; border-radius: 5px;">
                        是我本人，解除暫停
                    </a>
                    <p>想不起密碼的話，也可以直接 <a href="${forgotUrl}">使用忘記密碼重設</a>。</p>

                    <h2>不是你？</h2>
                    <p><b>不用做任何事，也請不要點上面的解除按鈕。</b>被暫停的只有對方那台裝置，你自己登入完全不受影響，對方也沒有猜中你的密碼。</p>
                    <p>只有當你的密碼和其他網站共用、或曾經告訴過別人時，才建議 <a href="${forgotUrl}">重設一組新密碼</a>。</p>

                    <p style="margin-top: 20px; color: #666;">此連結僅供本人使用，請勿將此連結分享給他人。</p>
                </div>
            `
        });

        if (error) {
            console.error('❌ 發送登入暫停通知失敗:', error);
            return false;
        }

        console.log('✅ 登入暫停通知發送成功:', data);
        return true;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        throw error;
    }
};

export const sendEmailResetPassword =async (toEmail: string, token: string) => {
    try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

        const { data, error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '🔑 【Drift Bottle】密碼重設申請',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>密碼重設申請</h1>
                    <h2>此連結僅供本人使用，請勿將此連結分享給他人</h2>
                    <p>請點擊下方按鈕前往重設密碼（此連結將在 20 分鐘後失效）：</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #000000; text-decoration: none; border-radius: 5px;">
                        重設密碼
                    </a>
                </div>
            `
        });

        if (error) {
            console.error('❌ 發送郵件失敗:', error);
            return false;
        }

        console.log('✅ 郵件發送成功:', data);
        return true;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        throw error;
    }
};
const taipeiTime = (date: Date) => date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });

/*寄出註銷確認信：信裡有「確認註銷」與「這不是我」兩條路*/
export const sendEmailAccountDeletion = async (toEmail: string, token: string, requestIp: string) => {
    try {
        const confirmUrl = `${process.env.FRONTEND_URL}/delete-account-confirm.html?token=${token}&action=confirm`;
        const denyUrl = `${process.env.FRONTEND_URL}/delete-account-confirm.html?token=${token}&action=deny`;

        const { data, error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '⚠️ 【Drift Bottle】註銷帳號申請確認',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>註銷帳號申請確認</h1>
                    <p>我們在 <b>${taipeiTime(new Date())}</b> 收到從 IP <b>${requestIp}</b> 送出的註銷帳號申請。</p>

                    <h2>是你本人申請的嗎？</h2>
                    <p>點擊下方按鈕確認後，帳號會進入 <b>7 天後悔期</b>，期間登入就能取消；7 天後個人資料會永久刪除（此連結將在 24 小時後失效）：</p>
                    <a href="${confirmUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #c0392b; text-decoration: none; border-radius: 5px;">
                        是我本人，確認註銷
                    </a>

                    <h2>不是你？</h2>
                    <p><b>代表有人知道你的密碼並登入了你的帳號。</b>請點擊下方按鈕，我們會取消這次申請、登出所有裝置，並寄一封重設密碼信給你：</p>
                    <a href="${denyUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #000000; text-decoration: none; border-radius: 5px;">
                        這不是我，保護我的帳號
                    </a>

                    <p style="margin-top: 20px; color: #666;">不點任何按鈕的話，這次申請會在 24 小時後自動失效，帳號不會被註銷。此連結僅供本人使用，請勿分享給他人。</p>
                </div>
            `
        });

        if (error) {
            console.error('❌ 發送註銷確認信失敗:', error);
            return false;
        }
        console.log('✅ 註銷確認信發送成功:', data);
        return true;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        throw error;
    }
};

/*確認註銷後寄出：告知預定註銷時間，附上取消連結*/
export const sendEmailDeletionScheduled = async (toEmail: string, cancelToken: string, scheduledAt: Date) => {
    try {
        const cancelUrl = `${process.env.FRONTEND_URL}/delete-account-confirm.html?token=${cancelToken}&action=cancel`;

        const { error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '🕊️ 【Drift Bottle】帳號將於 7 天後註銷',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>帳號已進入註銷後悔期</h1>
                    <p>你的帳號將在 <b>${taipeiTime(scheduledAt)}</b> 註銷，在那之前無法登入。如果改變心意，點擊下方按鈕就能立刻恢復帳號：</p>
                    <a href="${cancelUrl}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #000000; text-decoration: none; border-radius: 5px;">
                        我後悔了，取消註銷
                    </a>
                    <p style="color: #666;">請保留這封信。如果信不見了，到登入頁用原本的帳號密碼登入一次，我們會重新寄送取消連結。</p>
                    <p style="margin-top: 20px; color: #666;">註銷後個人資料、寵物、收藏與遊戲紀錄會永久刪除；發過的漂流瓶與留言會保留，但作者改顯示為「已註銷使用者」。</p>
                </div>
            `
        });
        if (error) {
            console.error('❌ 發送註銷排程通知失敗:', error);
            return false;
        }
        return true;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        throw error;
    }
};

/*正式註銷前寄出最後一封信（寄完就會清掉信箱）*/
export const sendEmailAccountDeleted = async (toEmail: string) => {
    try {
        const { error } = await resend.emails.send({
            from: 'Drift Bottle <service@drift-bottles.xyz>',
            to: toEmail,
            subject: '👋 【Drift Bottle】你的帳號已註銷',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>帳號已註銷</h1>
                    <p>你的帳號已在 <b>${taipeiTime(new Date())}</b> 完成註銷，個人資料已全部刪除，這封信也是我們寄給你的最後一封信。</p>
                    <p>謝謝你曾經在心情漂流瓶留下的每一則心情，希望未來還有機會在海上相遇。🌊</p>
                </div>
            `
        });
        if (error) console.error('❌ 發送註銷完成通知失敗:', error);
        return !error;

    } catch (error) {
        console.error('❌ mailer.ts 執行發生例外錯誤:', error);
        return false;
    }
};
