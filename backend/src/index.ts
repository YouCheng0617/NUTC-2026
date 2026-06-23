import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router.js';
import { bottleRouter } from './modules/bottle/bottle.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { generateCaptcha } from './lib/captchaHelper.js';
import prisma from './lib/prisma.js';
import "dotenv/config";
const app = express();
app.use(cors()); /*允許跨域請求(ngrok)*/
app.use(express.json());
app.use('/auth', authRouter());
app.use('/bottles', bottleRouter());
app.use('/admin', adminRouter());

if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not defined in env.");
}

app.get('/', (req, res) => {
    res.send('🌊 漂流瓶 API 伺服器正常運作中！請對接 /auth 或 /bottles');
});

app.get('/captcha', (req, res) => {
    const { captchaId, image } = generateCaptcha();
    res.json({ captchaId, image });
});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

/*0001100*/