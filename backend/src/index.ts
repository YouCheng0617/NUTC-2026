/*nodeJS套件引用區*/
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import multer from 'multer';

/*Router引用區*/
import { initCron } from './lib/cron.js';
import { authRouter } from './modules/auth/auth.router.js';
import { bottleRouter } from './modules/bottle/bottle.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
import { categoryRouter } from './modules/category/category.router.js';
import { commentRouter } from './modules/comment/comment.router.js';
import { gameRouter } from './modules/game/game.router.js';
import { notificationRouter } from './modules/notification/notification.router.js';
import { petGameRouter } from './socket/petGame.router.js';
import { CSRouter } from './modules/customer-service/CS.router.js';
import { blockRouter } from './modules/block/block.router.js';
import { announcementRouter } from './modules/announcement/announcement.router.js';


import { setupPetSocket } from './socket/petServer.js';

/*其他套件引用區*/
import { generateCaptcha } from './lib/captchaHelper.js';
import { writeLimiter, captchaLimiter } from './lib/rateLimiter.js';
import prisma from './lib/prisma.js';
import "dotenv/config";


const app = express();
app.disable('x-powered-by'); /*不在回應標頭透露使用 Express*/
const httpServer = createServer(app);

export const io = new Server(httpServer, {
    cors: {
        origin: "*", // 開發環境先全開
        methods: ["GET", "POST"]
    }
});

/*正式環境跑在 nginx 反向代理後面，信任一層代理才抓得到使用者的真實 IP（流量限制需要）*/
app.set('trust proxy', 1);

app.use(cors()); /*允許跨域請求(ngrok)*/
app.use(writeLimiter); /*所有寫入類請求 (POST/PUT/PATCH/DELETE) 的全站流量限制*/
app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));/*圖片處裡*/

app.use('/auth', authRouter());
app.use('/bottles', bottleRouter());
app.use('/admin', adminRouter());
app.use('/category', categoryRouter());
app.use('/comments', commentRouter());
app.use('/game', gameRouter());
app.use('/notifications', notificationRouter());
app.use('/pet-games', petGameRouter());
app.use('/customer-service', CSRouter());
app.use('/block', blockRouter());
app.use('/announcements', announcementRouter()); /*首頁揪團彈幕（寵物遊戲房號）*/
if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not defined in env.");
}

app.get('/', (req, res) => {
    res.send('🌊 漂流瓶 API 伺服器正常運作中！請對接 /auth 或 /bottles 或 /admin');
});

app.get('/captcha', captchaLimiter, (req, res) => {
    const { captchaId, image } = generateCaptcha();
    res.json({ captchaId, image });
});

/*
 * 全域錯誤處理：放在所有路由之後
 * 壞掉的 JSON、太大的請求或沒接住的例外，對外只回固定的 JSON 訊息，
 * 完整堆疊只寫在伺服器 log，不洩漏主機路徑與套件版本
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    const status = Number(err?.status ?? err?.statusCode);
    const isClientError = status >= 400 && status < 500;

    let message = "伺服器發生錯誤，請稍後再試";
    if (err?.type === "entity.parse.failed") message = "請求內容格式錯誤";
    else if (err?.type === "entity.too.large") message = "請求內容太大";
    else if (err instanceof multer.MulterError) message = "上傳檔案不符合規定";
    else if (isClientError) message = "請求有誤";

    if (isClientError || err instanceof multer.MulterError) {
        console.warn(`⚠️ [請求錯誤] ${req.method} ${req.originalUrl}：${err?.message}`);
    } else {
        console.error(`❌ [未處理例外] ${req.method} ${req.originalUrl}`, err);
    }
    res.status(isClientError ? status : err instanceof multer.MulterError ? 400 : 500).json({ message });
});

io.on("connection", (socket) => {
    console.log(`[WebSocket] 有隻小豬連線了！Socket ID: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`[WebSocket] 小豬離線了：${socket.id}`);
    });
});

/*掛載寵物多人連線 Socket 伺服器 */
setupPetSocket(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`💬 WebSocket 伺服器已同步啟動！`); // 多加一行 log 讓自己知道
    initCron();
});

/*0001100*/