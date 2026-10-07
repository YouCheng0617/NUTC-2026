import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';
import { applyQuitPenalty } from './quitPenalty.js';
import { milestonesReached, MILESTONES } from './memoryRewards.js';

/*
 * 記憶翻牌對決（連線房間裡的小遊戲）
 *
 * 牌的位置只存在伺服器，翻開時才告訴大家那張是什麼，避免有人從前端偷看答案。
 * 輪流翻牌：翻對加分並可以繼續翻（最多連續 maxStreak 組），翻錯或時間到就換下一位。
 * 全部翻完分數最高的人贏；只有一個最高分、而且至少兩個不同的登入帳號參加，才記一場勝場。
 * 鬼牌（開關在 gameConfig）：牌堆多一對，但不用配對，翻到任何一張就把還沒配對的牌重洗，不加分、直接換下一位。
 *
 * 開局邀請（觀戰模式）：
 * - 房主按開始後先問房間裡每個人要不要加入（memory_invite），房主自己自動加入
 * - 大家都回覆完、或 inviteSeconds 秒到了，就用有加入的人開局；不到 minPlayers 人就取消
 * - 沒加入、沒回覆、開局後才進房的人都是觀眾：收得到盤面，但不能翻牌、不算勝場、不會被處罰
 * - 參加的人比房主選的組數需要的多時，自動加到 minPairsByPlayers 的最低組數
 *
 * 中途退出：
 * - 按離開房間 → 直接出局；斷線 → 位置先保留，連回來可以接著玩
 * - 輪到你一整回合都沒翻牌記一次警告，累計 idleStrikesToKick 次就被請出對決
 * - 有人出局後剩 2 人以上繼續玩；只剩 1 人時，寵物牌翻完 forfeitWinRatio（80%）才算他贏，不到就整局作廢
 * - 出局的人照 quitPenalties 扣積分、一段時間不能進連線房間（quitPenalty.ts）
 */

const cfg = gameConfig.memoryGame;
const JOKER = 'joker';
const MISMATCH_SHOW_MS = 1200; // 翻錯時兩張牌給大家看多久再蓋回去
const JOKER_SHOW_MS = 1500;    // 翻到鬼牌時先給大家看一下再洗牌
const JOKER_REMOVED = '__joker__'; // 鬼牌翻開後在 matchedBy 的標記（不屬於任何玩家）

interface MemoryPlayer {
    socketId: string;
    petName: string;
    petColor: string;
    score: number;
    memberId: number | undefined; // 登入帳號，用來斷線重連找回位置、記勝場；不會送給前端
    strikes: number;     // 輪到時整回合沒翻牌的次數
    connected: boolean;  // 斷線中位置先保留
}

interface MemoryGame {
    roomId: string;
    pairs: number;
    faces: string[];              // 每個位置的牌面（寵物顏色 key 或 joker），不會整包送給前端
    matchedBy: (string | null)[]; // 被誰翻對（socketId），null = 還沒翻對；鬼牌翻開後是 JOKER_REMOVED
    revealed: number[];           // 這回合翻開中的牌（最多 2 張）
    players: MemoryPlayer[];      // 依輪流順序
    turnIndex: number;
    streak: number;               // 這回合已連續翻對幾組
    locked: boolean;              // 翻錯後展示中，暫時不能翻
    turnTimer: NodeJS.Timeout | null;
    turnEndsAt: number;
    turnSeq: number;              // 每換一次人 +1，延遲執行的動作用來確認還是同一回合
    flippedThisTurn: boolean;     // 這回合有沒有翻過牌（沒翻就記警告）
    distinctMembersAtStart: number; // 開局時有幾個不同的登入帳號（記勝場用）
}

const games = new Map<string, MemoryGame>();

/* 開局前的邀請：等大家回覆要加入還是觀戰 */
interface MemoryInvite {
    roomId: string;
    pairs: number;
    hostId: string;
    accepted: Set<string>;  // 要加入的 socketId（房主一開始就在裡面）
    declined: Set<string>;  // 選觀戰的 socketId
    timer: NodeJS.Timeout | null;
    endsAt: number;
}
const invites = new Map<string, MemoryInvite>();

/* 掛機被請出、人還在房間裡時，由 petServer 把他請出房間（避免 import 互相引用） */
let kickFromRoom: (socketId: string) => void = () => {};
export const setRoomKicker = (fn: (socketId: string) => void) => { kickFromRoom = fn; };
/* 用登入憑證確認身分：socketId -> 會員 ID（沒登入的人可以玩，但不記勝場） */
const verifiedMembers = new Map<string, number>();

type RoomLookup = (roomId: string) => { players: Map<string, { petName: string; petColor: string }> } | undefined;
/* 房間查詢：setupMemoryGame 時記下來，玩家離開時（memoryHandleLeave）也用得到 */
let roomLookup: RoomLookup = () => undefined;

const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
};

const currentPlayer = (game: MemoryGame) => game.players[game.turnIndex];

/* 房間人數對應的最低組數（不含鬼牌）；表上沒有的人數就用比它少的人數裡最高的那個 */
const minPairsFor = (playerCount: number) => {
    const table = cfg.minPairsByPlayers;
    const counts = Object.keys(table).map(Number).filter(n => n <= playerCount);
    return counts.length ? table[Math.max(...counts)]! : Math.min(...Object.values(table));
};

/* 送給前端的玩家清單：拿掉會員 ID */
const publicPlayers = (game: MemoryGame) => game.players.map(({ memberId: _memberId, ...p }) => p);

/* 給前端的公開狀態：只包含已翻對與目前翻開中的牌面 */
const publicState = (game: MemoryGame) => ({
    roomId: game.roomId,
    pairs: game.pairs,
    cardCount: game.faces.length,
    matched: game.matchedBy.map((by, i) => (by ? { index: i, face: game.faces[i], by } : null)).filter(Boolean),
    revealed: game.revealed.map(i => ({ index: i, face: game.faces[i] })),
    players: publicPlayers(game),
    turn: currentPlayer(game)?.socketId ?? null,
    streak: game.streak,
    maxStreak: cfg.maxStreak,
    turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()),
});

const startTurnTimer = (io: Server, game: MemoryGame) => {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    game.turnEndsAt = Date.now() + cfg.turnSeconds * 1000;
    game.turnTimer = setTimeout(() => {
        if (games.get(game.roomId) !== game) return;
        const timedOut = currentPlayer(game);
        game.revealed = [];
        game.locked = false;
        if (!timedOut) return nextTurn(io, game);

        if (game.flippedThisTurn) {
            nextTurn(io, game, `${timedOut.petName} 想太久了，換下一位！`);
            return;
        }
        // 整回合一張都沒翻：記警告，累計到上限就請出對決
        timedOut.strikes++;
        if (timedOut.strikes >= cfg.idleStrikesToKick) {
            removePlayer(io, game, game.turnIndex, `${timedOut.petName} 輪到時 ${cfg.idleStrikesToKick} 次都沒翻牌，被請出對決了！`, true);
            return;
        }
        nextTurn(io, game, `${timedOut.petName} 這回合沒有翻牌（警告 ${timedOut.strikes}/${cfg.idleStrikesToKick}），再一次就會被請出對決！`);
    }, cfg.turnSeconds * 1000);
};

const nextTurn = (io: Server, game: MemoryGame, notice?: string) => {
    game.turnSeq++;
    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    game.streak = 0;
    game.flippedThisTurn = false;
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

/* 勝場 +1，滿 jokerSkin.winsRequired 場送小丑皮膚；其他里程碑（卡背、披風皇冠、王座）見 memoryRewards.ts */
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
    // 這一場剛好跨過的里程碑，前端用來跳「獲得卡背自選箱」或播王座動畫
    const newRewards = milestonesReached(pet.memory_wins - 1, pet.memory_wins);
    const next = MILESTONES.find(m => pet.memory_wins < m.wins) ?? null;
    return { wins: pet.memory_wins, jokerSkinUnlocked, newRewards, nextMilestone: next };
};

/* 連線時已驗證的帳號（petServer 存在 socket.data.memberId），沒有才看 memory_identify 的紀錄 */
const memberOf = (io: Server, socketId: string): number | undefined => {
    const fromSocket = io.sockets.sockets.get(socketId)?.data.memberId;
    return typeof fromSocket === 'number' ? fromSocket : verifiedMembers.get(socketId);
};

/* 寵物牌都配對完就結束（鬼牌沒翻到也算結束） */
const allPairsMatched = (game: MemoryGame) => game.faces.every((f, i) => f === JOKER || game.matchedBy[i]);

/* 翻到鬼牌：先給大家看，再把還沒配對的牌（包含這回合翻開的另一張、另一張鬼牌）位置全部打亂，換下一位 */
const triggerJoker = (io: Server, game: MemoryGame, jokerIndex: number) => {
    game.locked = true;
    if (game.turnTimer) clearTimeout(game.turnTimer); // 展示期間不要被逾時換人打斷
    const player = currentPlayer(game);
    const seq = game.turnSeq;

    setTimeout(() => {
        if (games.get(game.roomId) !== game) return;
        game.matchedBy[jokerIndex] = JOKER_REMOVED;
        game.revealed = [];

        const open = game.faces.map((_, i) => i).filter(i => !game.matchedBy[i]);
        const reshuffled = shuffle(open.map(i => game.faces[i]!));
        open.forEach((pos, k) => { game.faces[pos] = reshuffled[k]!; });

        // 前端把翻到的鬼牌當成「已拿走」顯示，已配對的牌組位置不動
        io.to(game.roomId).emit('memory_matched', {
            indices: [jokerIndex], face: JOKER, by: JOKER_REMOVED, players: publicPlayers(game), streak: 0,
        });
        game.locked = false;
        const notice = `🃏 ${player?.petName ?? ''} 翻到鬼牌！還沒配對的牌全部重新洗過，換下一位！`;
        if (game.turnSeq === seq) {
            nextTurn(io, game, notice);
        } else {
            // 展示期間翻牌的人離開、已經換過人了：不要再跳過一位，只重新計時
            startTurnTimer(io, game);
            io.to(game.roomId).emit('memory_turn', {
                turn: currentPlayer(game)!.socketId, turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()), revealed: [], notice,
            });
        }
    }, JOKER_SHOW_MS);
};

const finishGame = async (io: Server, game: MemoryGame) => {
    stopGame(game.roomId);

    const topScore = Math.max(...game.players.map(p => p.score));
    const winners = game.players.filter(p => p.score === topScore);

    io.to(game.roomId).emit('memory_ended', {
        players: publicPlayers(game),
        winners: winners.map(p => p.socketId),
        draw: winners.length > 1,
    });

    /* 平手不算；開局時要有兩個以上不同的登入帳號（同一個帳號開兩個分頁不算） */
    const winner = winners.length === 1 ? winners[0]! : null;
    const winnerMemberId = winner ? (winner.memberId ?? memberOf(io, winner.socketId)) : undefined;
    if (!winner || !winnerMemberId || game.distinctMembersAtStart < cfg.minPlayers) return;

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

/* 給前端的邀請狀態：誰加入了、還有幾個人沒回覆 */
const publicInvite = (invite: MemoryInvite) => {
    const room = roomLookup(invite.roomId);
    const players = room ? Array.from(room.players.entries()) : [];
    const nameOf = (id: string) => room?.players.get(id)?.petName ?? '';
    return {
        pairs: invite.pairs,
        hostId: invite.hostId,
        hostName: nameOf(invite.hostId),
        msLeft: Math.max(0, invite.endsAt - Date.now()),
        joined: players.filter(([id]) => invite.accepted.has(id)).map(([socketId, p]) => ({ socketId, petName: p.petName })),
        watching: players.filter(([id]) => invite.declined.has(id)).map(([socketId]) => socketId),
        waiting: players.filter(([id]) => !invite.accepted.has(id) && !invite.declined.has(id)).length,
    };
};

const cancelInvite = (io: Server, invite: MemoryInvite, message: string) => {
    if (invite.timer) clearTimeout(invite.timer);
    invites.delete(invite.roomId);
    io.to(invite.roomId).emit('memory_invite_cancelled', { message });
};

/* 邀請結束：用有加入、而且還在房間裡的人開局 */
const beginGame = (io: Server, invite: MemoryInvite) => {
    if (invites.get(invite.roomId) !== invite) return;
    if (invite.timer) clearTimeout(invite.timer);
    invites.delete(invite.roomId);

    const room = roomLookup(invite.roomId);
    if (!room) return;
    const seats = Array.from(room.players.entries()).filter(([id]) => invite.accepted.has(id));
    if (seats.length < cfg.minPlayers) {
        io.to(invite.roomId).emit('memory_invite_cancelled', { message: `加入的人不到 ${cfg.minPlayers} 位，這局先取消了。` });
        return;
    }

    const allFaces = Object.keys(gameConfig.shop.pet_color);
    const minPairs = minPairsFor(seats.length);
    const pairCount = Math.min(allFaces.length, Math.max(invite.pairs, minPairs));
    const chosen = shuffle([...allFaces]).slice(0, pairCount);
    const deck = chosen.flatMap(f => [f, f]);
    if (cfg.joker.enabled) deck.push(JOKER, JOKER); // 鬼牌一對，但翻到一張就觸發洗牌
    const faces = shuffle(deck);

    const game: MemoryGame = {
        roomId: invite.roomId,
        pairs: pairCount,
        faces,
        matchedBy: faces.map(() => null),
        revealed: [],
        players: shuffle(seats.map(([socketId, p]) => ({
            socketId, petName: p.petName, petColor: p.petColor, score: 0,
            memberId: memberOf(io, socketId), strikes: 0, connected: true,
        }))),
        turnIndex: 0,
        streak: 0,
        locked: false,
        turnTimer: null,
        turnEndsAt: 0,
        turnSeq: 0,
        flippedThisTurn: false,
        distinctMembersAtStart: 0,
    };
    game.distinctMembersAtStart = new Set(game.players.map(p => p.memberId).filter(Boolean)).size;
    games.set(invite.roomId, game);
    startTurnTimer(io, game);
    io.to(invite.roomId).emit('memory_started', {
        ...publicState(game),
        notice: pairCount > invite.pairs ? `有 ${seats.length} 個人參加，組數自動加到 ${pairCount} 組！` : null,
    });
};

/* 房間裡每個人都回覆了就不用等倒數 */
const checkInviteDone = (io: Server, invite: MemoryInvite) => {
    const room = roomLookup(invite.roomId);
    if (!room) return;
    const allAnswered = Array.from(room.players.keys()).every(id => invite.accepted.has(id) || invite.declined.has(id));
    if (allAnswered) beginGame(io, invite);
};

export const setupMemoryGame = (io: Server, socket: Socket, getRoom: RoomLookup, getRoomIdOf: (socketId: string) => string | undefined) => {
    roomLookup = getRoom;

    /* 登入身分：前端連線後把登入憑證送來，驗證通過才記勝場 */
    socket.on('memory_identify', ({ token }: { token?: string } = {}) => {
        if (typeof token !== 'string') return;
        socket.data.identifyToken = token; // petServer 開房、進房時也用這個憑證認帳號
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as { member_id?: number };
            if (typeof decoded.member_id === 'number') verifiedMembers.set(socket.id, decoded.member_id);
        } catch {
            verifiedMembers.delete(socket.id);
        }
    });

    /* 房主開局：先問大家要不要加入 */
    socket.on('memory_start', ({ pairs }: { pairs?: number } = {}) => {
        const roomId = getRoomIdOf(socket.id);
        const room = roomId ? getRoom(roomId) : undefined;
        if (!roomId || !room) return socket.emit('memory_error', { message: '請先進入房間！' });

        const hostId = room.players.keys().next().value;
        if (hostId !== socket.id) return socket.emit('memory_error', { message: '只有房主可以開始翻牌對決喔！' });
        if (games.has(roomId)) return socket.emit('memory_error', { message: '翻牌對決已經在進行中了！' });
        if (invites.has(roomId)) return socket.emit('memory_error', { message: '正在等大家回覆要不要加入，請稍等！' });
        if (room.players.size < cfg.minPlayers) return socket.emit('memory_error', { message: `至少要 ${cfg.minPlayers} 個人才能開始對決！` });

        // 組數先用兩人局的最低組數檢查；開局時再依實際加入的人數自動補到最低組數
        const pairCount = Number(pairs);
        const allFaces = Object.keys(gameConfig.shop.pet_color);
        const minPairs = minPairsFor(cfg.minPlayers);
        if (!Number.isInteger(pairCount)) return socket.emit('memory_error', { message: '請選擇正確的組數！' });
        if (pairCount < minPairs) {
            return socket.emit('memory_error', { message: `至少要選 ${minPairs} 組才能開始喔！` });
        }
        if (pairCount > allFaces.length) {
            return socket.emit('memory_error', { message: `最多只能選 ${allFaces.length} 組喔！` });
        }

        const invite: MemoryInvite = {
            roomId, pairs: pairCount, hostId: socket.id,
            accepted: new Set([socket.id]), declined: new Set(),
            timer: null, endsAt: Date.now() + cfg.inviteSeconds * 1000,
        };
        invites.set(roomId, invite);
        invite.timer = setTimeout(() => beginGame(io, invite), cfg.inviteSeconds * 1000);
        io.to(roomId).emit('memory_invite', publicInvite(invite));
    });

    /* 回覆邀請：join = true 加入，false 觀戰 */
    socket.on('memory_invite_reply', ({ join }: { join?: boolean } = {}) => {
        const roomId = getRoomIdOf(socket.id);
        const invite = roomId ? invites.get(roomId) : undefined;
        if (!invite || socket.id === invite.hostId) return;
        if (join === true) {
            invite.declined.delete(socket.id);
            invite.accepted.add(socket.id);
        } else {
            invite.accepted.delete(socket.id);
            invite.declined.add(socket.id);
        }
        io.to(invite.roomId).emit('memory_invite_update', publicInvite(invite));
        checkInviteDone(io, invite);
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
        game.flippedThisTurn = true;
        io.to(game.roomId).emit('memory_revealed', { index: i, face: game.faces[i], by: socket.id });

        if (game.faces[i] === JOKER) {
            triggerJoker(io, game, i);
            return;
        }
        if (game.revealed.length < 2) return;

        // 機會／命運牌：規則定好後在這裡處理（cfg.chanceCards.enabled）

        const [a, b] = game.revealed as [number, number];
        const player = currentPlayer(game)!;

        if (game.faces[a] === game.faces[b]) {
            game.matchedBy[a] = socket.id;
            game.matchedBy[b] = socket.id;
            game.revealed = [];
            game.streak++;
            player.score += 1;

            io.to(game.roomId).emit('memory_matched', {
                indices: [a, b], face: game.faces[a], by: socket.id, players: publicPlayers(game), streak: game.streak,
            });

            if (allPairsMatched(game)) {
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
        const invite = roomId ? invites.get(roomId) : undefined;
        if (invite) socket.emit('memory_invite', publicInvite(invite));
    });
};

/* 出局處罰：扣積分、禁止進房一段時間，人還連著就告訴他並請出房間 */
const penalize = async (io: Server, player: MemoryPlayer, kick: boolean) => {
    if (!player.memberId) return;
    try {
        const p = await applyQuitPenalty(player.memberId);
        const socket = io.sockets.sockets.get(player.socketId);
        if (!socket?.connected) return;
        socket.emit('error', {
            message: `你今天第 ${p.count} 次中途離開翻牌對決，扣 ${p.deducted} 積分，${p.banMinutes} 分鐘內不能進連線房間。`,
        });
        if (kick) kickFromRoom(player.socketId);
    } catch (error) {
        console.error('❌ [翻牌對決] 中途離開處罰失敗:', error);
    }
};

/* 把玩家請出對決（主動離開、或警告滿了），出局的人照 quitPenalties 處罰 */
const removePlayer = (io: Server, game: MemoryGame, idx: number, message: string, kick = false) => {
    const wasTurn = idx === game.turnIndex;
    const [removed] = game.players.splice(idx, 1);
    if (removed) void penalize(io, removed, kick);

    if (game.players.length === 0) {
        stopGame(game.roomId);
        return;
    }
    if (game.players.length < cfg.minPlayers) {
        finishByForfeit(io, game, message);
        return;
    }

    if (idx < game.turnIndex) game.turnIndex--;
    if (wasTurn) {
        game.revealed = [];
        game.locked = false;
        game.turnIndex = (game.turnIndex - 1 + game.players.length) % game.players.length; // nextTurn 會再 +1
        nextTurn(io, game, message);
    } else {
        io.to(game.roomId).emit('memory_players', { players: publicPlayers(game), notice: message });
    }
};

/* 只剩一個人：寵物牌（不含鬼牌）翻完 forfeitWinRatio 才算他贏，不到就整局作廢 */
const finishByForfeit = (io: Server, game: MemoryGame, message: string) => {
    const matchedPairs = game.faces.filter((f, i) => f !== JOKER && game.matchedBy[i]).length / 2;
    if (matchedPairs >= game.pairs * cfg.forfeitWinRatio) {
        void finishGame(io, game);
        return;
    }
    stopGame(game.roomId);
    io.to(game.roomId).emit('memory_aborted', {
        message: `${message} 只剩一個人，牌還沒翻到 ${Math.round(cfg.forfeitWinRatio * 100)}%，這局不算。`,
    });
};

/* 玩家離開房間：按離開就出局；斷線先保留位置，輪到沒翻一樣記警告 */
export const memoryHandleLeave = (io: Server, roomId: string, socketId: string, reason: 'leave' | 'disconnect', roomEmpty: boolean) => {
    verifiedMembers.delete(socketId);

    const invite = invites.get(roomId);
    if (invite) {
        if (roomEmpty) {
            if (invite.timer) clearTimeout(invite.timer);
            invites.delete(roomId);
        } else if (socketId === invite.hostId) {
            cancelInvite(io, invite, '房主離開了，這局翻牌對決取消。');
        } else {
            invite.accepted.delete(socketId);
            invite.declined.delete(socketId);
            io.to(roomId).emit('memory_invite_update', publicInvite(invite));
            checkInviteDone(io, invite);
        }
    }

    const game = games.get(roomId);
    if (!game) return;
    if (roomEmpty) {
        stopGame(roomId); // 房間裡都沒人了
        return;
    }

    const idx = game.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return;
    const player = game.players[idx]!;

    if (reason === 'disconnect' && player.memberId) {
        player.connected = false;
        io.to(roomId).emit('memory_players', { players: publicPlayers(game), notice: `${player.petName} 斷線了，位置先幫他保留。` });
        return;
    }
    removePlayer(io, game, idx, `${player.petName} 離開了對決。`);
};

/* 斷線的人用同一個帳號回到房間：接回原本的位置與分數 */
export const memoryHandleJoin = (io: Server, socket: Socket, roomId: string, memberId: number) => {
    const game = games.get(roomId);
    const seat = game?.players.find(p => p.memberId === memberId);
    if (!game || !seat) return;

    const oldId = seat.socketId;
    seat.socketId = socket.id;
    seat.connected = true;
    game.matchedBy = game.matchedBy.map(by => (by === oldId ? socket.id : by));

    socket.emit('memory_state', publicState(game));
    // 其他人的畫面用 socketId 判斷輪到誰，換了連線要重新告訴大家
    socket.to(roomId).emit('memory_turn', {
        turn: currentPlayer(game)!.socketId,
        turnMsLeft: Math.max(0, game.turnEndsAt - Date.now()),
        revealed: game.revealed.map(i => ({ index: i, face: game.faces[i] })),
        notice: `${seat.petName} 回來了！`,
        streak: game.streak,
    });
};

/* socket 斷線但不在房間裡時，也要清掉身分紀錄 */
export const memoryForget = (socketId: string) => {
    verifiedMembers.delete(socketId);
};
