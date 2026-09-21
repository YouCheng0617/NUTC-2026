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

export const sendEmailResetPassword = async (toEmail: string, token: string) => {
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