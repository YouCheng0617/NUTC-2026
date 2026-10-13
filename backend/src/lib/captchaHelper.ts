import svgCaptcha from 'svg-captcha';
// 用 Node 內建的 randomUUID：uuid 套件新版靠全域 crypto，VM 上的 Node 版本沒有，會讓 /captcha 500
import { randomUUID } from 'node:crypto';
const captchaMap = new Map<string, string>();

/*生成 CAPTCHA 圖片*/
export const generateCaptcha = () => {
    const captcha = svgCaptcha.create({
        size: 5,
        charPreset: '123456789',
        noise: 5,
        color: true,
        background: '#a1a1a1',
        width: 150,
        height: 50,
    });
    const captchaId = randomUUID();
    captchaMap.set(captchaId, captcha.text.toLowerCase());

    /* 2 分鐘後自動刪除 CAPTCHA */
    setTimeout(() => {
        captchaMap.delete(captchaId);
    }, 2 * 60 * 1000);

    return {
        captchaId,
        image: captcha.data,
    };
};

export const verifyCaptcha = (captchaId: string, userInput: string): boolean => {
    if (!captchaId || !userInput) return false;

    const captchaAnswer = captchaMap.get(captchaId);
    if (!captchaAnswer) return false;

    if (captchaAnswer === userInput.toLowerCase()) {
        captchaMap.delete(captchaId);
        return true;
    }

    return false;
};