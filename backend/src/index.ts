/*nodeJS套件引用區*/
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

/*Router引用區*/
import { initCron } from './lib/cron.js';
import { authRouter } from './modules/auth/auth.router.js';
import { bottleRouter } from './modules/bottle/bottle.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { categoryRouter } from './modules/category/category.router.js';
import { commentRouter } from './modules/comment/comment.router.js';
import { gameRouter } from './modules/game/game.router.js';
import { notificationRouter } from './modules/notification/notification.router.js';

/*其他套件引用區*/
import { generateCaptcha } from './lib/captchaHelper.js';
import prisma from './lib/prisma.js';
import "dotenv/config";


const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
    cors: {
        origin: "*", // 開發環境先全開
        methods: ["GET", "POST"]
    }
});

app.use(cors()); /*允許跨域請求(ngrok)*/
app.use(express.json());

app.use('/auth', authRouter());
app.use('/bottles', bottleRouter());
app.use('/admin', adminRouter());
app.use('/category', categoryRouter());
app.use('/comments', commentRouter());
app.use('/game', gameRouter());
app.use('/notifications', notificationRouter());

if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not defined in env.");
}

app.get('/', (req, res) => {
    res.send('🌊 漂流瓶 API 伺服器正常運作中！請對接 /auth 或 /bottles 或 /admin');
});

app.get('/captcha', (req, res) => {
    const { captchaId, image } = generateCaptcha();
    res.json({ captchaId, image });
});

io.on("connection", (socket) => {
    console.log(`[WebSocket] 有隻小豬連線了！Socket ID: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`[WebSocket] 小豬離線了：${socket.id}`);
    });
});


const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`💬 WebSocket 伺服器已同步啟動！`); // 多加一行 log 讓自己知道
    initCron();
});

/*0001100*/