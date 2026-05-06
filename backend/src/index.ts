import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router.js';
import { bottleRouter } from './modules/bottle/bottle.router.js';
import prisma from './lib/prisma.js';
import "dotenv/config";
const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter());
app.use('/bottles', bottleRouter());

if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not defined in env.");
}

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


app.listen(3001, () => {
    console.log('Server is running on port 3001');
})