import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { gameConfig } from './gameConfig.js';
import { isMemoryBusy } from './memoryGame.js';

/*
 * 海兔疊疊樂（連線房間裡的小遊戲）
 *
 * 每個人疊自己的塔、同時開始：積木在塔頂上方左右移動，按一下放下。
 * 放歪了沒關係，但某一層上面所有積木的重心超出那一層的邊緣，上面那一截就會倒掉，這個人的這局就結束。
 * 時間到（gameSeconds）或參加的人都倒了，就比誰的塔最高；一樣高算平手。不記勝場、沒有中途離開的處罰。
 *
 * 防作弊：積木位置不是前端說了算。前端只回報「這塊出現後過了幾毫秒才按」，
 * 伺服器用自己記的出現時間檢查（容許網路延遲 lateToleranceMs），再用同一條公式算出位置與會不會倒。
 * 每一塊的起始位置（phases）開局時隨機產生，大家都一樣，比較公平。
 *
 * 開局邀請、觀戰跟翻牌對決一樣：房主開局後問大家要不要加入，沒加入的人當觀眾。
 * 同一個房間同時只能玩一種小遊戲（翻牌對決進行中不能開疊疊樂，反過來也是）。
 *
 * 🤫 隱藏小遊戲：只給自己人玩。房間裡有人在聊天打出暗號（STACK_SECRET）才解鎖這個房間，
 * 解鎖到房間沒人為止；暗號那則訊息不會傳給其他人（petServer 的 send_message 直接吞掉），沒解鎖的房間不能開局。
 */

const cfg = gameConfig.stackGame;

interface StackPlayer {
    socketId: string;
    petName: string;
    petColor: string;
    memberId: number | undefined; // 斷線重連找回位置用；不會送給前端
    blocks: number[];             // 每一層積木的中心位置，blocks[0] 是地基（固定 0）
    out: 'fell' | 'left' | null;  // 倒了或離開就不能再放
    spawnAt: number;              // 目前這塊積木開始移動的時間（伺服器時間）
    connected: boolean;
}

interface StackGame {
    roomId: string;
    phases: number[];             // 每一層積木一開始在來回的哪個位置（0～1）
    players: StackPlayer[];
    endsAt: number;
    endTimer: NodeJS.Timeout | null;
}

interface StackInvite {
    roomId: string;
    hostId: string;
    accepted: Set<string>;
    declined: Set<string>;
    timer: NodeJS.Timeout | null;
    endsAt: number;
}

const games = new Map<string, StackGame>();
const unlockedRooms = new Set<string>();

/* 暗號：前後的【】、空白、半形逗號都不計較 */
const STACK_SECRET = '不想做報告拉，自己玩就好';
const normalizeSecret = (text: string) => text.replace(/[【】\[\]\s]/g, '').replace(/,/g, '，');

/* 聊天訊息是暗號就解鎖這個房間並回 true（呼叫的人就不要把這則訊息廣播出去） */
export const tryUnlockStack = (io: Server, roomId: string, message: string) => {
    if (normalizeSecret(message) !== STACK_SECRET) return false;
    unlockedRooms.add(roomId);
    io.to(roomId).emit('stack_unlocked');
    return true;
};
const invites = new Map<string, StackInvite>();

type RoomLookup = (roomId: string) => { players: Map<string, { petName: string; petColor: string; memberId?: number }> } | undefined;
let roomLookup: RoomLookup = () => undefined;

export const isStackBusy = (roomId: string) => games.has(roomId) || invites.has(roomId);

/* 開局時送給前端的規則：前端用同一套公式畫積木位置、判斷倒塌 */
const rules = () => ({
    blockWidth: cfg.blockWidth,
    swingRange: cfg.swingRange,
    periodStartMs: cfg.periodStartMs,
    periodStepMs: cfg.periodStepMs,
    periodMinMs: cfg.periodMinMs,
    dropGapMs: cfg.dropGapMs,
});

/* 第 level 層（從 1 開始）的積木出現 elapsed 毫秒後的中心位置：來回移動（三角波），越高越快 */
const blockX = (game: StackGame, level: number, elapsed: number) => {
    const period = Math.max(cfg.periodMinMs, cfg.periodStartMs - (level - 1) * cfg.periodStepMs);
    const u = elapsed / period + (game.phases[level - 1] ?? 0);
    const f = u - Math.floor(u);
    return cfg.swingRange * (4 * Math.abs(f - 0.5) - 1);
};

/* 從下往上找第一個撐不住的層：第 k 層以上所有積木的重心，超出第 k-1 層的邊緣就從第 k 層開始倒；都撐得住回 -1 */
const collapseLevel = (blocks: number[]) => {
    const n = blocks.length;
    let sum = 0;
    let lowest = -1;
    for (let k = n - 1; k >= 1; k--) {
        sum += blocks[k]!;
        if (Math.abs(sum / (n - k) - blocks[k - 1]!) > cfg.blockWidth / 2) lowest = k; // 往下走，最後記到的就是最低的
    }
    return lowest;
};

const heightOf = (p: StackPlayer) => p.blocks.length - 1;

const publicPlayers = (game: StackGame) => game.players.map(p => ({
    socketId: p.socketId, petName: p.petName, petColor: p.petColor,
    blocks: p.blocks, height: heightOf(p), out: p.out, connected: p.connected,
}));

const publicState = (game: StackGame, forSocketId?: string) => {
    const me = game.players.find(p => p.socketId === forSocketId);
    return {
        rules: rules(),
        phases: game.phases,
        players: publicPlayers(game),
        endsInMs: Math.max(0, game.endsAt - Date.now()),
        // 自己這塊積木再過多久開始動（負的代表已經動了多久）
        mySpawnInMs: me ? me.spawnAt - Date.now() : null,
    };
};

const stopGame = (roomId: string) => {
    const game = games.get(roomId);
    if (game?.endTimer) clearTimeout(game.endTimer);
    games.delete(roomId);
};

const finishGame = (io: Server, game: StackGame) => {
    if (games.get(game.roomId) !== game) return;
    stopGame(game.roomId);
    const ranked = game.players.filter(p => p.out !== 'left');
    const top = ranked.length ? Math.max(...ranked.map(heightOf)) : 0;
    const winners = ranked.filter(p => heightOf(p) === top && top > 0);
    io.to(game.roomId).emit('stack_ended', {
        players: publicPlayers(game),
        winners: winners.map(p => p.socketId),
        draw: winners.length > 1,
    });
};

/* 參加的人都倒了（或離開了）就提早結束 */
const checkAllOut = (io: Server, game: StackGame) => {
    if (game.players.every(p => p.out)) finishGame(io, game);
};

const publicInvite = (invite: StackInvite) => {
    const room = roomLookup(invite.roomId);
    const players = room ? Array.from(room.players.entries()) : [];
    return {
        hostId: invite.hostId,
        hostName: room?.players.get(invite.hostId)?.petName ?? '',
        msLeft: Math.max(0, invite.endsAt - Date.now()),
        joined: players.filter(([id]) => invite.accepted.has(id)).map(([socketId, p]) => ({ socketId, petName: p.petName })),
        watching: players.filter(([id]) => invite.declined.has(id)).map(([socketId]) => socketId),
        waiting: players.filter(([id]) => !invite.accepted.has(id) && !invite.declined.has(id)).length,
    };
};

const beginGame = (io: Server, invite: StackInvite) => {
    if (invites.get(invite.roomId) !== invite) return;
    if (invite.timer) clearTimeout(invite.timer);
    invites.delete(invite.roomId);

    const room = roomLookup(invite.roomId);
    if (!room) return;
    const seats = Array.from(room.players.entries()).filter(([id]) => invite.accepted.has(id));
    if (seats.length < cfg.minPlayers) {
        io.to(invite.roomId).emit('stack_invite_cancelled', { message: `加入的人不到 ${cfg.minPlayers} 位，這局先取消了。` });
        return;
    }

    const startAt = Date.now() + cfg.countdownMs;
    const game: StackGame = {
        roomId: invite.roomId,
        phases: Array.from({ length: cfg.maxBlocks }, () => crypto.randomInt(1000) / 1000),
        players: seats.map(([socketId, p]) => ({
            socketId, petName: p.petName, petColor: p.petColor,
            memberId: p.memberId ?? io.sockets.sockets.get(socketId)?.data.memberId,
            blocks: [0], out: null, spawnAt: startAt, connected: true,
        })),
        endsAt: startAt + cfg.gameSeconds * 1000,
        endTimer: null,
    };
    games.set(invite.roomId, game);
    game.endTimer = setTimeout(() => finishGame(io, game), game.endsAt - Date.now());

    // 每個人的 mySpawnInMs 不一樣（觀眾是 null），所以一個一個送
    for (const socketId of room.players.keys()) {
        io.to(socketId).emit('stack_started', publicState(game, socketId));
    }
};

const checkInviteDone = (io: Server, invite: StackInvite) => {
    const room = roomLookup(invite.roomId);
    if (!room) return;
    if (Array.from(room.players.keys()).every(id => invite.accepted.has(id) || invite.declined.has(id))) beginGame(io, invite);
};

export const setupStackGame = (io: Server, socket: Socket, getRoom: RoomLookup, getRoomIdOf: (socketId: string) => string | undefined) => {
    roomLookup = getRoom;

    /* 房主開局：先問大家要不要加入 */
    socket.on('stack_start', () => {
        const roomId = getRoomIdOf(socket.id);
        const room = roomId ? getRoom(roomId) : undefined;
        if (!roomId || !room) return socket.emit('stack_error', { message: '請先進入房間！' });
        if (!unlockedRooms.has(roomId)) return; // 還沒解鎖：當作沒有這個遊戲
        if (room.players.keys().next().value !== socket.id) return socket.emit('stack_error', { message: '只有房主可以開始疊疊樂喔！' });
        if (isStackBusy(roomId)) return socket.emit('stack_error', { message: '疊疊樂已經在進行中了！' });
        if (isMemoryBusy(roomId)) return socket.emit('stack_error', { message: '翻牌對決還在進行中，結束後才能開疊疊樂喔！' });
        if (room.players.size < cfg.minPlayers) return socket.emit('stack_error', { message: `至少要 ${cfg.minPlayers} 個人才能開始疊疊樂！` });

        const invite: StackInvite = {
            roomId, hostId: socket.id,
            accepted: new Set([socket.id]), declined: new Set(),
            timer: null, endsAt: Date.now() + cfg.inviteSeconds * 1000,
        };
        invites.set(roomId, invite);
        invite.timer = setTimeout(() => beginGame(io, invite), cfg.inviteSeconds * 1000);
        io.to(roomId).emit('stack_invite', publicInvite(invite));
    });

    socket.on('stack_invite_reply', ({ join }: { join?: boolean } = {}) => {
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
        io.to(invite.roomId).emit('stack_invite_update', publicInvite(invite));
        checkInviteDone(io, invite);
    });

    /* 放下積木：前端送第幾層、這塊出現後過了幾毫秒 */
    socket.on('stack_drop', ({ level, elapsed }: { level?: number; elapsed?: number } = {}) => {
        const roomId = getRoomIdOf(socket.id);
        const game = roomId ? games.get(roomId) : undefined;
        const player = game?.players.find(p => p.socketId === socket.id);
        if (!game || !player || player.out) return;
        if (level !== player.blocks.length || level > cfg.maxBlocks) return; // 重複送或順序不對
        if (typeof elapsed !== 'number' || !Number.isFinite(elapsed)) return;

        const now = Date.now();
        const serverElapsed = now - player.spawnAt;
        if (serverElapsed < -cfg.earlyToleranceMs) return; // 積木還沒出現
        const used = Math.max(0, Math.min(serverElapsed + cfg.earlyToleranceMs, Math.max(serverElapsed - cfg.lateToleranceMs, elapsed)));

        const x = blockX(game, level, used);
        player.blocks.push(x);
        const fallFrom = collapseLevel(player.blocks);
        if (fallFrom !== -1) {
            player.blocks = player.blocks.slice(0, fallFrom);
            player.out = 'fell';
        } else if (level >= cfg.maxBlocks) {
            player.out = 'fell'; // 疊到上限就停（幾乎不可能），塔照樣算高度
        } else {
            player.spawnAt = now + cfg.dropGapMs;
        }

        io.to(game.roomId).emit('stack_dropped', {
            socketId: socket.id, level, x, fallFrom, height: heightOf(player), out: player.out,
        });
        checkAllOut(io, game);
    });

    socket.on('stack_sync', () => {
        const roomId = getRoomIdOf(socket.id);
        if (roomId && unlockedRooms.has(roomId)) socket.emit('stack_unlocked');
        const game = roomId ? games.get(roomId) : undefined;
        if (game) socket.emit('stack_state', publicState(game, socket.id));
        const invite = roomId ? invites.get(roomId) : undefined;
        if (invite) socket.emit('stack_invite', publicInvite(invite));
    });
};

/* 玩家離開房間：按離開就出局（不處罰，只是不算排名）；斷線先保留位置，連回來接著疊 */
export const stackHandleLeave = (io: Server, roomId: string, socketId: string, reason: 'leave' | 'disconnect', roomEmpty: boolean) => {
    if (roomEmpty) unlockedRooms.delete(roomId);
    const invite = invites.get(roomId);
    if (invite) {
        if (roomEmpty) {
            if (invite.timer) clearTimeout(invite.timer);
            invites.delete(roomId);
        } else if (socketId === invite.hostId) {
            if (invite.timer) clearTimeout(invite.timer);
            invites.delete(roomId);
            io.to(roomId).emit('stack_invite_cancelled', { message: '房主離開了，這局疊疊樂取消。' });
        } else {
            invite.accepted.delete(socketId);
            invite.declined.delete(socketId);
            io.to(roomId).emit('stack_invite_update', publicInvite(invite));
            checkInviteDone(io, invite);
        }
    }

    const game = games.get(roomId);
    if (!game) return;
    if (roomEmpty) { stopGame(roomId); return; }
    const player = game.players.find(p => p.socketId === socketId);
    if (!player) return;

    if (reason === 'disconnect' && player.memberId && !player.out) {
        player.connected = false;
        io.to(roomId).emit('stack_players', { players: publicPlayers(game), notice: `${player.petName} 斷線了，塔先幫他留著。` });
        return;
    }
    if (!player.out) player.out = 'left';
    io.to(roomId).emit('stack_players', { players: publicPlayers(game), notice: `${player.petName} 離開了疊疊樂。` });
    checkAllOut(io, game);
};

/* 斷線的人用同一個帳號回到房間：接回原本的塔，下一塊積木稍等一下再出現 */
export const stackHandleJoin = (io: Server, socket: Socket, roomId: string, memberId: number) => {
    const game = games.get(roomId);
    const seat = game?.players.find(p => p.memberId === memberId);
    if (!game || !seat) return;
    seat.socketId = socket.id;
    seat.connected = true;
    if (!seat.out) seat.spawnAt = Math.max(seat.spawnAt, Date.now() + 1500);
    socket.emit('stack_state', publicState(game, socket.id));
    socket.to(roomId).emit('stack_players', { players: publicPlayers(game), notice: `${seat.petName} 回來了！` });
};
