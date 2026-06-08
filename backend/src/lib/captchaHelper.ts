import svgCaptcha from 'svg-captcha';
import { v4 as uuidv4 } from 'uuid';
const captchaMap = new Map<string, string>();

/*生成 CAPTCHA 圖片*/
export const generateCaptcha = () => {
    const captcha = svgCaptcha.create({
        size: 5,
        ignoreChars: '0o1il',
        noise: 5,
        color: true,
        background: '#a1a1a1',
        width: 150,
        height: 50,
    });
    const captchaId = uuidv4();
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