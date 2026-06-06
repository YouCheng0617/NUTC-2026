import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router.js';
import { bottleRouter } from './modules/bottle/bottle.router.js';
import { adminRouter } from './modules/admin/admin.router.js';
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

app.get('/test-db', async (req, res) => {
    try {
        const member = await prisma.member.findMany({
            select: {
                member_id: true,
                email: true,
                name: true,
                birthday: true,
                blood_type: true,
                constellation: true,
                bio: true,
            }
        });

        res.json({
            data: member
        });

    } catch {
        console.error
        res.status(500).json({
            message: "連線失敗",
            data: String("error")
        });
    }
});


app.listen(80, () => {
    console.log('Server is running on port 80');
})

/*0001100*/