import { Prisma } from "../../generated/prisma/index.js";
import prisma from "../../lib/prisma.js";
import { getTodayDateStr } from "../../socket/petGame.service.js";

/*
 * 今日一題：每天一個 emoji 小問題，投完直接看大家的比例
 * - 後台可以排程某一天的題目；沒排的日子從下面的題庫依日期輪替
 * - 每個帳號每天一票，投了不能改；結果只給比例和人數，不透露誰投什麼
 */

export interface DailyOption { emoji: string; label: string }
interface BankQuestion { question: string; options: DailyOption[] }

const o = (emoji: string, label: string): DailyOption => ({ emoji, label });

/* 內建題庫：沒有排程的日子照日期輪流出題（加新題目往後面加就好） */
export const QUESTION_BANK: BankQuestion[] = [
    { question: "今天的心情是？", options: [o("😄", "超開心"), o("🙂", "還不錯"), o("😐", "普普通通"), o("😔", "有點低落"), o("😡", "很煩躁")] },
    { question: "今天的能量剩多少？", options: [o("🔋", "滿格"), o("🪫", "快沒電"), o("💤", "只想睡"), o("☕", "靠咖啡撐")] },
    { question: "現在最想做什麼？", options: [o("🛌", "躺平"), o("🍜", "吃東西"), o("🎮", "打電動"), o("🚶", "出去走走"), o("📚", "認真做事")] },
    { question: "今天的天氣讓你覺得？", options: [o("☀️", "心情好"), o("🌧️", "有點憂鬱"), o("🥵", "太熱了"), o("🥶", "好冷"), o("🌈", "沒差")] },
    { question: "今天有沒有好好吃飯？", options: [o("🍱", "有，吃很飽"), o("🍙", "隨便吃吃"), o("🥤", "只喝飲料"), o("🙅", "還沒吃")] },
    { question: "此刻最像哪種動物？", options: [o("🐨", "無尾熊（想睡）"), o("🐿️", "松鼠（很忙）"), o("🐶", "狗狗（很嗨）"), o("🐱", "貓咪（不想理人）"), o("🐢", "烏龜（慢慢來）")] },
    { question: "今天跟誰說話最多？", options: [o("👫", "朋友"), o("👨‍👩‍👧", "家人"), o("🧑‍🏫", "同學或同事"), o("🤖", "AI"), o("🪞", "自己")] },
    { question: "今天的壓力指數？", options: [o("🍃", "很輕鬆"), o("🌊", "有一點"), o("🌋", "快爆炸"), o("🫠", "已經融化")] },
    { question: "現在最想聽什麼音樂？", options: [o("🎸", "搖滾"), o("🎹", "輕音樂"), o("🎤", "流行歌"), o("🎧", "Lo-fi"), o("🔇", "安靜就好")] },
    { question: "今天有沒有被誰溫暖到？", options: [o("🥰", "有！"), o("🤔", "好像有"), o("😶", "沒有"), o("🫶", "我溫暖了別人")] },
    { question: "睡前最常做什麼？", options: [o("📱", "滑手機"), o("📖", "看書"), o("🎬", "追劇"), o("💭", "胡思亂想"), o("😴", "秒睡")] },
    { question: "今天最想對自己說？", options: [o("💪", "辛苦了"), o("🌱", "慢慢來"), o("🎉", "做得好"), o("🫂", "抱抱自己")] },
    { question: "現在想喝什麼？", options: [o("🧋", "珍奶"), o("☕", "咖啡"), o("🍵", "茶"), o("🥛", "牛奶"), o("💧", "白開水")] },
    { question: "這週過得怎麼樣？", options: [o("🚀", "很順利"), o("🎢", "起起伏伏"), o("🐌", "好漫長"), o("🌪️", "一團亂")] },
    { question: "如果現在能瞬間移動，想去哪？", options: [o("🏖️", "海邊"), o("⛰️", "山上"), o("🏠", "回家"), o("🌃", "國外城市"), o("🛏️", "床上")] },
    { question: "今天有好好休息嗎？", options: [o("😌", "有"), o("😵", "沒時間"), o("🙃", "休息過頭了"), o("🤷", "不知道")] },
    { question: "最近最常出現的情緒？", options: [o("😊", "開心"), o("😰", "焦慮"), o("😤", "生氣"), o("😢", "難過"), o("😶‍🌫️", "麻木")] },
    { question: "今天的你比較想？", options: [o("🗣️", "找人聊天"), o("🎧", "一個人靜靜"), o("🍰", "吃點甜的"), o("🏃", "動一動")] },
    { question: "今天有讓你笑出來的事嗎？", options: [o("🤣", "笑到不行"), o("😆", "有一點"), o("😑", "沒有"), o("🥲", "苦笑也算吧")] },
    { question: "明天最期待什麼？", options: [o("😴", "睡到自然醒"), o("🍽️", "好吃的"), o("👋", "見到某個人"), o("📦", "收到包裹"), o("🫥", "沒什麼期待")] },
    { question: "現在的你需要什麼？", options: [o("🫂", "一個擁抱"), o("💤", "睡一覺"), o("💸", "一點錢"), o("🌞", "曬太陽"), o("🍫", "巧克力")] },
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/* 依日期決定用題庫的哪一題（同一天每個人看到的都一樣） */
const bankIndexFor = (date: string) => {
    const days = Math.floor(new Date(`${date}T00:00:00+08:00`).getTime() / 86400000);
    return ((days % QUESTION_BANK.length) + QUESTION_BANK.length) % QUESTION_BANK.length;
};

/* 拿某一天的題目；沒有排程就從題庫補一題存起來（投票要有題目 id 可以掛） */
const ensureQuestion = async (date: string) => {
    const existing = await prisma.dailyQuestion.findUnique({ where: { date } });
    if (existing) return existing;
    const bank = QUESTION_BANK[bankIndexFor(date)]!;
    // 兩個人同時打開也只會建一筆（date 是 unique）
    return prisma.dailyQuestion.upsert({
        where: { date },
        update: {},
        create: { date, question: bank.question, options: bank.options as unknown as Prisma.InputJsonValue },
    });
};

const optionsOf = (q: { options: Prisma.JsonValue }) => (Array.isArray(q.options) ? q.options : []) as unknown as DailyOption[];

/* 各選項的票數與比例 */
const resultsFor = async (questionId: number, optionCount: number) => {
    const grouped = await prisma.dailyVote.groupBy({
        by: ["option_index"],
        where: { question_id: questionId },
        _count: { _all: true },
    });
    const counts = Array.from({ length: optionCount }, (_, i) => grouped.find(g => g.option_index === i)?._count._all ?? 0);
    const total = counts.reduce((a, b) => a + b, 0);
    // 百分比四捨五入後湊成 100（餘數給小數最大的）
    const raw = counts.map(c => (total ? (c / total) * 100 : 0));
    const percents = raw.map(Math.floor);
    let left = total ? 100 - percents.reduce((a, b) => a + b, 0) : 0;
    raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => {
        if (left > 0) { percents[i]!++; left--; }
    });
    return { counts, percents, total };
};

/* 今天的題目；投過票才附上結果 */
export const getTodayQuestion = async (memberId?: number) => {
    const date = getTodayDateStr();
    const q = await ensureQuestion(date);
    const options = optionsOf(q);
    const myVote = memberId
        ? (await prisma.dailyVote.findUnique({ where: { question_id_member_id: { question_id: q.id, member_id: memberId } } }))?.option_index ?? null
        : null;
    return {
        date,
        question: q.question,
        options,
        myVote,
        results: myVote === null ? null : await resultsFor(q.id, options.length),
    };
};

export const voteToday = async (memberId: number, optionIndex: unknown) => {
    const date = getTodayDateStr();
    const q = await ensureQuestion(date);
    const options = optionsOf(q);
    const index = Number(optionIndex);
    if (!Number.isInteger(index) || index < 0 || index >= options.length) throw new Error("請選擇一個選項");

    try {
        await prisma.dailyVote.create({ data: { question_id: q.id, member_id: memberId, option_index: index } });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("今天已經投過囉，明天再來！");
        }
        throw error;
    }
    return { date, question: q.question, options, myVote: index, results: await resultsFor(q.id, options.length) };
};

/* ---------- 後台 ---------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (date: string, n: number) => {
    const d = new Date(`${date}T00:00:00+08:00`);
    d.setUTCDate(d.getUTCDate() + n);
    return getTodayDateStr(d);
};

/* 列出今天前 7 天到後 13 天：有排程的顯示排程，沒排的標示會用題庫哪一題 */
export const listSchedule = async () => {
    const today = getTodayDateStr();
    const from = addDays(today, -7), to = addDays(today, 13);
    const rows = await prisma.dailyQuestion.findMany({
        where: { date: { gte: from, lte: to } },
        include: { _count: { select: { votes: true } } },
    });
    const byDate = new Map(rows.map(r => [r.date, r]));

    const days = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
        const row = byDate.get(date);
        const isPast = date < today;
        if (row) {
            const options = optionsOf(row);
            days.push({
                date, isToday: date === today, isPast,
                source: row.created_by ? "scheduled" : "bank",
                question: row.question, options,
                totalVotes: row._count.votes,
                results: row._count.votes ? await resultsFor(row.id, options.length) : null,
            });
        } else {
            const bank = QUESTION_BANK[bankIndexFor(date)]!;
            days.push({ date, isToday: date === today, isPast, source: isPast ? "none" : "bank-preview", question: bank.question, options: bank.options, totalVotes: 0, results: null });
        }
    }
    return { today, days };
};

const parseOptions = (raw: unknown): DailyOption[] => {
    if (!Array.isArray(raw)) throw new Error("請設定選項");
    const options = raw.map((x: any) => ({
        emoji: typeof x?.emoji === "string" ? x.emoji.trim().slice(0, 16) : "",
        label: typeof x?.label === "string" ? x.label.trim().slice(0, 20) : "",
    })).filter(x => x.emoji || x.label);
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) throw new Error(`選項要 ${MIN_OPTIONS} ~ ${MAX_OPTIONS} 個`);
    if (options.some(x => !x.emoji)) throw new Error("每個選項都要有 emoji");
    return options;
};

/* 排程（新增或覆蓋）某一天的題目：只能排今天以後；那天已經有人投票就不能改 */
export const scheduleQuestion = async (date: string, input: { question?: unknown; options?: unknown }, adminId: number) => {
    if (!DATE_PATTERN.test(date)) throw new Error("日期格式錯誤");
    if (date < getTodayDateStr()) throw new Error("不能排過去的日子");
    const question = typeof input.question === "string" ? input.question.trim().slice(0, 100) : "";
    if (!question) throw new Error("請輸入題目");
    const options = parseOptions(input.options);

    const existing = await prisma.dailyQuestion.findUnique({ where: { date }, include: { _count: { select: { votes: true } } } });
    if (existing && existing._count.votes > 0) throw new Error(`這天已經有 ${existing._count.votes} 人投票，不能再改題目`);

    return prisma.dailyQuestion.upsert({
        where: { date },
        update: { question, options: options as unknown as Prisma.InputJsonValue, created_by: adminId },
        create: { date, question, options: options as unknown as Prisma.InputJsonValue, created_by: adminId },
    });
};

/* 取消排程：回到用題庫；已經有人投票的不能取消 */
export const unscheduleQuestion = async (date: string) => {
    if (!DATE_PATTERN.test(date)) throw new Error("日期格式錯誤");
    const existing = await prisma.dailyQuestion.findUnique({ where: { date }, include: { _count: { select: { votes: true } } } });
    if (!existing) throw new Error("這天沒有排程");
    if (existing._count.votes > 0) throw new Error("這天已經有人投票，不能取消");
    await prisma.dailyQuestion.delete({ where: { date } });
};
