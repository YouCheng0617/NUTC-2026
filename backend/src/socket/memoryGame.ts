import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';

/*
 * 記憶翻牌對決（連線房間裡的小遊戲）
 *
 * 牌的位置只存在伺服器，翻開時才告訴大家那張是什麼，避免有人從前端偷看答案。
 * 輪流翻牌：翻對加分並可以繼續翻（最多連續 maxStreak 組），翻錯或時間到就換下一位。
 * 全部翻完分數最高的人贏；只有一個最高分、而且至少兩個不同的登入帳號參加，才記一場勝場。
 */

const cfg = gameConfig.memoryGame;
const JOKER = 'joker';
const MISMATCH_SHOW_MS = 1200; // 翻錯時兩張牌給大家看多久再蓋回去

interface MemoryPlayer {
    socketId: string;
    petName: string;
    petColor: string;
    score: number;
}

interface MemoryGame {
    roomId: string;
    pairs: number;
    faces: string[];              // 每個位置的牌面（寵物顏色 key 或 joker），不會整包送給前端
    matchedBy: (string | null)[]; // 被誰翻對（socketId），null = 還沒翻對
    revealed: number[];           // 這回合翻開中的牌（最多 2 張）
    players: MemoryPlayer[];      // 依輪流順序
    turnIndex: number;
    streak: number;               // 這回合已連續翻對幾組
    locked: boolean;              // 翻錯後展示中，暫時不能翻
    turnTimer: NodeJS.Timeout | null;
    turnEndsAt: number;
    turnSeq: number;              // 每換一次人 +1，延遲執行的動作用來確認還是同一回合
}

const games = new Map<string, MemoryGame>();
/* 用登入憑證確認身分：socketId -> 會員 ID（沒登入的人可以玩，但不記勝場） */
const verifiedMembers = new Map<string, number>();

type RoomLookup = (roomId: string) => { players: Map<string, { petName: string; petColor: string }> } | undefined;

const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
};

const pairValue = (face: string) => (face === JOKER ? cfg.joker.value : 1);

const currentPlayer = (game: MemoryGame) => game.players[game.turnIndex];

/* 給前端的公開狀態：只包含已翻對與目前翻開中的牌面 */
const publicState = (game: MemoryGame) => ({
    roomId: game.roomId,
    pairs: game.pairs,
    cardCount: game.faces.length,
    matched: game.matchedBy.map((by, i) => (by ? { index: i, face: game.faces[i], by } : null)).filter(Boolean),
    revealed: game.revealed.map(i => ({ index: i, face: game.faces[i] })),
    players: game.players,
    turn: currentPlayer(game)?.socketId ?? null,
    streak: game.streak,
    maxStreak: cfg.maxStreak,
    turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()),
    jokerValue: cfg.joker.value,
});

const startTurnTimer = (io: Server, game: MemoryGame) => {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    game.turnEndsAt = Date.now() + cfg.turnSeconds * 1000;
    game.turnTimer = setTimeout(() => {
        if (games.get(game.roomId) !== game) return;
        const timedOut = currentPlayer(game);
        game.revealed = [];
        game.locked = false;
        nextTurn(io, game, timedOut ? `${timedOut.petName} 想太久了，換下一位！` : undefined);
    }, cfg.turnSeconds * 1000);
};

const nextTurn = (io: Server, game: MemoryGame, notice?: string) => {
    game.turnSeq++;
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    game.streak = 0;
    startTurnTimer(io, game);
    io.to(game.roomId).emit('memory_turn', {
        turn: currentPlayer(game)!.socketId,
        turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()),
        revealed: [],
        notice: notice ?? null,
    });
};

const stopGame = (roomId: string) => {
    const game = games.get(roomId);
    if (game?.turnTimer) clearTimeout(game.turnTimer);
    games.delete(roomId);
};

/* 勝場 +1，滿 jokerSkin.winsRequired 場送小丑皮膚 */
const recordWin = async (memberId: number) => {
    const pet = await prisma.pet.upsert({
        where: { member_id: memberId },
        update: { memory_wins: { increment: 1 } },
        create: { member_id: memberId, memory_wins: 1 },
    });

    let jokerSkinUnlocked = false;
    if (pet.memory_wins >= cfg.jokerSkin.winsRequired) {
        const owned = await prisma.petInventory.findUnique({
            where: { pet_id_category_item_name: { pet_id: pet.pet_id, category: 'pet_color', item_name: cfg.jokerSkin.itemName } },
        });
        if (!owned) {
            await prisma.petInventory.create({
                data: { pet_id: pet.pet_id, category: 'pet_color', item_name: cfg.jokerSkin.itemName },
            });
            jokerSkinUnlocked = true;
        }
    }
    return { wins: pet.memory_wins, jokerSkinUnlocked };
};

const finishGame = async (io: Server, game: MemoryGame) => {
    stopGame(game.roomId);

    const topScore = Math.max(...game.players.map(p => p.score));
    const winners = game.players.filter(p => p.score === topScore);

    io.to(game.roomId).emit('memory_ended', {
        players: game.players,
        winners: winners.map(p => p.socketId),
        draw: winners.length > 1,
    });

    /* 平手不算；同一個帳號開兩個分頁也不算 */
    const distinctMembers = new Set(game.players.map(p => verifiedMembers.get(p.socketId)).filter(Boolean));
    const winner = winners.length === 1 ? winners[0]! : null;
    const winnerMemberId = winner ? verifiedMembers.get(winner.socketId) : undefined;
    if (!winner || !winnerMemberId || distinctMembers.size < cfg.minPlayers) return;

    try {
        const result = await recordWin(winnerMemberId);
        io.to(winner.socketId).emit('memory_win_recorded', {
            ...result,
            winsRequired: cfg.jokerSkin.winsRequired,
        });
    } catch (error) {
        console.error('❌ [翻牌對決] 記錄勝場失敗:', error);
    }
};

export const setupMemoryGame = (io: Server, socket: Socket, getRoom: RoomLookup, getRoomIdOf: (socketId: string) => string | undefined) => {

    /* 登入身分：前端連線後把登入憑證送來，驗證通過才記勝場 */
    socket.on('memory_identify', ({ token }: { token?: string } = {}) => {
        if (typeof token !== 'string') return;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as { member_id?: number };
            if (typeof decoded.member_id === 'number') verifiedMembers.set(socket.id, decoded.member_id);
        } catch {
            verifiedMembers.delete(socket.id);
        }
    });

    /* 房主開局 */
    socket.on('memory_start', ({ pairs }: { pairs?: number } = {}) => {
        const roomId = getRoomIdOf(socket.id);
        const room = roomId ? getRoom(roomId) : undefined;
        if (!roomId || !room) return socket.emit('memory_error', { message: '請先進入房間！' });

        const hostId = room.players.keys().next().value;
        if (hostId !== socket.id) return socket.emit('memory_error', { message: '只有房主可以開始翻牌對決喔！' });
        if (games.has(roomId)) return socket.emit('memory_error', { message: '翻牌對決已經在進行中了！' });
        if (room.players.size < cfg.minPlayers) return socket.emit('memory_error', { message: `至少要 ${cfg.minPlayers} 個人才能開始對決！` });

        const pairCount = Number(pairs);
        if (!cfg.pairOptions.includes(pairCount)) return socket.emit('memory_error', { message: '請選擇正確的組數！' });

        const allFaces = Object.keys(gameConfig.shop.pet_color);
        if (allFaces.length < pairCount) return socket.emit('memory_error', { message: '寵物種類不夠，無法開這麼多組！' });

        const chosen = shuffle([...allFaces]).slice(0, pairCount);
        if (cfg.joker.enabled) chosen[0] = JOKER; // 小丑取代其中一組，總張數不變
        const faces = shuffle(chosen.flatMap(f => [f, f]));

        const game: MemoryGame = {
            roomId,
            pairs: pairCount,
            faces,
            matchedBy: faces.map(() => null),
            revealed: [],
            players: shuffle(Array.from(room.players.entries()).map(([socketId, p]) => ({
                socketId, petName: p.petName, petColor: p.petColor, score: 0,
            }))),
            turnIndex: 0,
            streak: 0,
            locked: false,
            turnTimer: null,
            turnEndsAt: 0,
            turnSeq: 0,
        };
        games.set(roomId, game);
        startTurnTimer(io, game);
        io.to(roomId).emit('memory_started', publicState(game));
    });

    /* 翻牌 */
    socket.on('memory_flip', ({ index }: { index?: number } = {}) => {
        const roomId = getRoomIdOf(socket.id);
        const game = roomId ? games.get(roomId) : undefined;
        if (!game) return;

        if (currentPlayer(game)?.socketId !== socket.id) return socket.emit('memory_error', { message: '還沒輪到你喔！' });
        if (game.locked || game.revealed.length >= 2) return;
        if (!Number.isInteger(index) || index! < 0 || index! >= game.faces.length) return;
        const i = index!;
        if (game.matchedBy[i] || game.revealed.includes(i)) return;

        game.revealed.push(i);
        io.to(game.roomId).emit('memory_revealed', { index: i, face: game.faces[i], by: socket.id });
        if (game.revealed.length < 2) return;

        // 機會／命運牌：規則定好後在這裡處理（cfg.chanceCards.enabled）

        const [a, b] = game.revealed as [number, number];
        const player = currentPlayer(game)!;

        if (game.faces[a] === game.faces[b]) {
            game.matchedBy[a] = socket.id;
            game.matchedBy[b] = socket.id;
            game.revealed = [];
            game.streak++;
            player.score += pairValue(game.faces[a]!);

            io.to(game.roomId).emit('memory_matched', {
                indices: [a, b], face: game.faces[a], by: socket.id, players: game.players, streak: game.streak,
            });

            if (game.matchedBy.every(Boolean)) {
                void finishGame(io, game);
                return;
            }
            if (game.streak >= cfg.maxStreak) {
                nextTurn(io, game, `${player.petName} 連續翻對 ${cfg.maxStreak} 組，換下一位！`);
            } else {
                startTurnTimer(io, game); // 繼續翻，重新計時
                io.to(game.roomId).emit('memory_turn', {
                    turn: socket.id, turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()), revealed: [], notice: null, streak: game.streak,
                });
            }
            return;
        }

        /* 翻錯：先讓大家看一下，再蓋回去換人 */
        game.locked = true;
        const seq = game.turnSeq;
        io.to(game.roomId).emit('memory_mismatch', { indices: [a, b], showMs: MISMATCH_SHOW_MS });
        setTimeout(() => {
            if (games.get(game.roomId) !== game || game.turnSeq !== seq) return; // 期間有人離開已經換過人了
            game.revealed = [];
            game.locked = false;
            nextTurn(io, game);
        }, MISMATCH_SHOW_MS);
    });

    /* 中途加入或斷線重連：要目前的盤面 */
    socket.on('memory_sync', () => {
        const roomId = getRoomIdOf(socket.id);
        const game = roomId ? games.get(roomId) : undefined;
        if (game) socket.emit('memory_state', publicState(game));
    });
};

/* 玩家離開房間：從對決中移除，剩不到兩人就結束（不記勝場） */
export const memoryHandleLeave = (io: Server, roomId: string, socketId: string) => {
    verifiedMembers.delete(socketId);
    const game = games.get(roomId);
    if (!game) return;

    const idx = game.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return;
    const wasTurn = idx === game.turnIndex;
    const leaver = game.players[idx]!;
    game.players.splice(idx, 1);

    if (game.players.length < cfg.minPlayers) {
        stopGame(roomId);
        io.to(roomId).emit('memory_aborted', { message: `${leaver.petName} 離開了，人數不足，翻牌對決結束。` });
        return;
    }

    if (idx < game.turnIndex) game.turnIndex--;
    if (wasTurn) {
        game.revealed = [];
        game.locked = false;
        game.turnIndex = (game.turnIndex - 1 + game.players.length) % game.players.length; // nextTurn 會再 +1
        nextTurn(io, game, `${leaver.petName} 離開了，換下一位！`);
    } else {
        io.to(roomId).emit('memory_players', { players: game.players });
    }
};

/* socket 斷線但不在房間裡時，也要清掉身分紀錄 */
export const memoryForget = (socketId: string) => {
    verifiedMembers.delete(socketId);
};
