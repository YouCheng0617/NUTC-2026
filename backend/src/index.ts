import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router.js';
import prisma from './lib/prisma.js';
const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter());

if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not defined in env.");
}

app.get('/test-db', async (req, res) => {
    try {
        const member = await prisma.member.findMany();
        res.json({
            message: "連線成功",
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