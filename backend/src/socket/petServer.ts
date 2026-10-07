import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { setupMemoryGame, memoryHandleLeave, memoryHandleJoin, memoryForget, setRoomKicker } from './memoryGame.js';
import { getRoomBanMinutesLeft } from './quitPenalty.js';
import { loadConflicts, hasConflict, isBlockedByHost, blockPlayer, reportPlayer, recordRoomChat, clearRoomChat } from './gameSafety.js';

// ... (Player 和 Room 介面保持不變) ...
interface Player {
    socketId: string;
    memberId: number;
    petName: string;
    petColor: string;
    x: number;
    y: number;
}

interface Room {
    roomId: string;
    maxCapacity: number;
    players: Map<string, Player>;
}

const rooms = new Map<string, Room>();
const activeMembers = new Map<number, { roomId: string; socketId: string }>(); // 記錄登入帳號 -> 所在房間與連線，同一個帳號只能在一個房間
const socketRoomMap = new Map<string, string>(); // 優化：記錄 socketId -> roomId，讓離開房間的尋找時間變成 O(1)
const ABSOLUTE_MAX_PLAYERS = 6;

/* 唯讀查詢房間現況：給首頁「揪團彈幕」確認房號存在、顯示人數用，不會改動房間 */
export const getRoomInfo = (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return null;
    return { roomId: room.roomId, players: room.players.size, maxCapacity: room.maxCapacity };
};


/*
 * 用登入憑證確認是哪個帳號
 * 以前用前端隨機產生的編號，同一個帳號換台裝置就被當成另一個人，可以重複進房
 */
const verifySocketMember = async (socket: Socket): Promise<number | null> => {
    if (typeof socket.data.memberId === 'number') return socket.data.memberId;

    /* 連線時帶的 auth.token；目前前端沒帶，改用 memory_game.js 一連線就送的 memory_identify 憑證 */
    const token = socket.handshake.auth?.token ?? socket.data.identifyToken;
    if (typeof token !== 'string' || !token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as { member_id?: number };
        if (typeof decoded.member_id !== 'number') return null;

        const [blacklisted, member] = await Promise.all([
            prisma.blacklistedToken.findUnique({ where: { token } }),
            prisma.member.findUnique({ where: { member_id: decoded.member_id }, select: { status: true } }),
        ]);
        if (blacklisted || member?.status !== 'ACTIVE') return null;

        socket.data.memberId = decoded.member_id;
        return decoded.member_id;
    } catch {
        return null;
    }
};

/* 同一個帳號已經在房間裡：舊連線還活著就擋下；舊連線其實已經斷了（網路閃斷還沒清掉）就幫它離開 */
const isAlreadyInRoom = (io: Server, memberId: number) => {
    const existing = activeMembers.get(memberId);
    if (!existing) return false;
    const oldSocket = io.sockets.sockets.get(existing.socketId);
    if (oldSocket?.connected) return true;
    removeFromRoom(io, existing.socketId, 'disconnect');
    activeMembers.delete(memberId);
    return false;
};

/* 翻牌對決中途離開被處罰：禁玩期間不能開房、進房 */
const banMessage = async (memberId: number) => {
    const minutes = await getRoomBanMinutesLeft(memberId);
    return minutes ? `你中途離開翻牌對決，還要 ${minutes} 分鐘才能進連線房間喔！` : null;
};

export const setupPetSocket = (io: Server) => {
    /* 掛機被請出對決時，人還在房間裡就斷開他的連線，讓他離開房間（重連回來會被禁玩擋住） */
    setRoomKicker((socketId) => io.sockets.sockets.get(socketId)?.disconnect(true));

    io.on('connection', (socket: Socket) => {
        console.log(`[Socket] 玩家連線: ${socket.id}`);
        console.log(`[WebSocket] 有隻海兔跳進來了！Socket ID: ${socket.id}`);
        // 1. 創立房間
        socket.on('create_room', async (data: {
            playerData: Omit<Player, 'socketId' | 'x' | 'y'>,
            maxPlayers?: number
        }) => {
            const { maxPlayers } = data ?? {};
            const memberId = await verifySocketMember(socket);
            if (!memberId) {
                return socket.emit('error', { message: '請先登入帳號才能開房間！' });
            }
            const playerData = { ...data?.playerData, memberId };
            const banned = await banMessage(memberId);
            await loadConflicts(memberId);
            if (!socket.connected) return; // 驗證期間已經斷線
            if (banned) return socket.emit('error', { message: banned });

            if (isAlreadyInRoom(io, memberId)) {
                return socket.emit('error', { message: '這個帳號已經在其他裝置或分頁的房間裡了，請先在那邊離開房間！' });
            }

            let capacity = maxPlayers ? Number(maxPlayers) : ABSOLUTE_MAX_PLAYERS;
            capacity = Math.max(2, Math.min(capacity, ABSOLUTE_MAX_PLAYERS));

            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

            rooms.set(roomId, {
                roomId,
                maxCapacity: capacity,
                players: new Map()
            });

            // 優化：先告訴前端房間創建成功，再執行加入房間邏輯，符合直覺的先後順序
            socket.emit('room_created', { roomId, maxCapacity: capacity });
            joinRoomLogic(socket, roomId, playerData);
        });

        // 2. 加入房間
        socket.on('join_room', async ({ roomId, playerData: rawPlayerData }: { roomId: string, playerData: Omit<Player, 'socketId' | 'x' | 'y'> }) => {
            const memberId = await verifySocketMember(socket);
            if (!memberId) {
                return socket.emit('error', { message: '請先登入帳號才能加入房間！' });
            }
            const playerData = { ...rawPlayerData, memberId };
            const banned = await banMessage(memberId);
            await loadConflicts(memberId);
            if (!socket.connected) return; // 驗證期間已經斷線
            if (banned) return socket.emit('error', { message: banned });

            if (isAlreadyInRoom(io, memberId)) {
                return socket.emit('error', { message: '這個帳號已經在其他裝置或分頁的房間裡了，請先在那邊離開房間！' });
            }

            const room = rooms.get(roomId);
            if (!room) {
                return socket.emit('error', { message: '找不到該房間！請確認邀請碼是否正確。' });
            }

            if (room.players.size >= room.maxCapacity) {
                return socket.emit('error', { message: `房間已滿！(此房間上限為 ${room.maxCapacity} 人)` });
            }

            // 房主（最早進房的人）封鎖了你就不能進；訊息不說是被封鎖，避免尷尬
            const host = room.players.values().next().value;
            if (host && await isBlockedByHost(host.memberId, memberId)) {
                return socket.emit('error', { message: '無法加入這個房間。' });
            }
            if (!socket.connected || !rooms.has(roomId)) return;

            joinRoomLogic(socket, roomId, playerData);
        });

        socket.on('disconnect', () => {
            handleLeave(socket, io, 'disconnect');
            memoryForget(socket.id);
        });

        socket.on('leave_room', () => {
            handleLeave(socket, io, 'leave');
        });

        // 3. 移動寵物 (廣播給同房間其他人)
        socket.on('move', ({ roomId, x, y }: { roomId: string; x: number; y: number }) => {
            const room = rooms.get(roomId);
            if (room) {
                const player = room.players.get(socket.id);
                if (player) {
                    player.x = x;
                    player.y = y;
                    // 廣播給房間內「除了自己以外」的人
                    socket.to(roomId).emit('player_moved', { socketId: socket.id, x, y });
                }
            }
        });

        // 4. 記憶翻牌對決（邏輯在 memoryGame.ts）
        setupMemoryGame(io, socket, (roomId) => rooms.get(roomId), (socketId) => socketRoomMap.get(socketId));

        // 5. 封鎖、檢舉同房間的玩家（邏輯在 gameSafety.ts）
        //    前端送 { socketId }，可帶 ack 回呼拿結果：{ ok, message }
        const findTarget = (targetSocketId: unknown) => {
            const roomId = socketRoomMap.get(socket.id);
            const room = roomId ? rooms.get(roomId) : undefined;
            const me = room?.players.get(socket.id);
            const target = typeof targetSocketId === 'string' ? room?.players.get(targetSocketId) : undefined;
            return { roomId, me, target };
        };
        const reply = (ack: unknown, result: { ok: boolean; message: string }) => {
            if (typeof ack === 'function') ack(result);
            else socket.emit(result.ok ? 'game_safety_result' : 'error', result);
        };

        socket.on('game_block_player', async (data: { socketId?: string } = {}, ack?: unknown) => {
            const { me, target } = findTarget(data?.socketId);
            if (!me || !target) return reply(ack, { ok: false, message: '找不到這位玩家，他可能已經離開房間了。' });
            try {
                await blockPlayer(me.memberId, target.memberId, target.petName);
                reply(ack, { ok: true, message: `已封鎖 ${target.petName}，你們之後互相看不到對方說話，他也進不了你當房主的房間。` });
            } catch (error) {
                reply(ack, { ok: false, message: error instanceof Error ? error.message : '封鎖失敗，請稍後再試。' });
            }
        });

        socket.on('game_report_player', async (data: { socketId?: string; reason?: string; detail?: string } = {}, ack?: unknown) => {
            const { roomId, me, target } = findTarget(data?.socketId);
            if (!roomId || !me || !target) return reply(ack, { ok: false, message: '找不到這位玩家，他可能已經離開房間了。' });
            try {
                await reportPlayer({
                    reporterId: me.memberId, reportedId: target.memberId, reportedPetName: target.petName,
                    roomId, reason: String(data?.reason ?? ''), detail: data?.detail ?? '',
                });
                reply(ack, { ok: true, message: `已送出對 ${target.petName} 的檢舉，管理員會盡快處理，謝謝你！` });
            } catch (error) {
                reply(ack, { ok: false, message: error instanceof Error ? error.message : '檢舉失敗，請稍後再試。' });
            }
        });

        // 6. 發送訊息
        socket.on('send_message', ({ roomId, message }: { roomId: string; message: string }) => {
            const room = rooms.get(roomId);
            if (room) {
                const player = room.players.get(socket.id);
                if (player && typeof message === 'string' && message.trim() !== '') { // 優化：防止發送空訊息
                    const payload = {
                        senderName: player.petName,
                        message: message.trim(),
                        timestamp: new Date()
                    };
                    recordRoomChat(roomId, { memberId: player.memberId, petName: player.petName, message: payload.message, at: payload.timestamp });
                    // 跟發話者有封鎖關係的人收不到（雙向）
                    room.players.forEach((p, sid) => {
                        if (!hasConflict(player.memberId, p.memberId)) io.to(sid).emit('receive_message', payload);
                    });
                }
            }
        });
    });
};

/* --- 輔助邏輯函式 --- */
function joinRoomLogic(socket: Socket, roomId: string, playerData: Omit<Player, 'socketId' | 'x' | 'y'>) {
    const room = rooms.get(roomId)!;

    const newPlayer: Player = {
        ...playerData,
        socketId: socket.id,
        x: 0,
        y: 0
    };

    room.players.set(socket.id, newPlayer);
    socket.join(roomId);

    activeMembers.set(playerData.memberId, { roomId, socketId: socket.id });
    socketRoomMap.set(socket.id, roomId); // 記錄 socketId -> roomId 的對應

    /* 送給其他玩家的資料不帶會員 ID，避免從寵物名字對回是哪個帳號 */
    const publicPlayer = ({ memberId: _memberId, ...rest }: Player) => rest;
    const allPlayers = Array.from(room.players.values()).map(publicPlayer);
    socket.emit('room_joined', {
        roomId,
        maxCapacity: room.maxCapacity,
        players: allPlayers
    });

    socket.to(roomId).emit('player_joined', publicPlayer(newPlayer));
    memoryHandleJoin(socket.nsp.server, socket, roomId, playerData.memberId); // 翻牌對決斷線回來：接回原本的位置

    socket.to(roomId).emit('receive_message', {
        senderName: '系統',
        message: `${newPlayer.petName} 蹦蹦跳跳地進入了房間！`,
        timestamp: new Date()
    });
}

function handleLeave(socket: Socket, io: Server, reason: 'leave' | 'disconnect') {
    const roomId = socketRoomMap.get(socket.id);
    if (roomId) socket.leave(roomId);
    removeFromRoom(io, socket.id, reason);
}

/* 依 socketId 把玩家移出房間（連線物件可能已經不在了，所以只用 id 處理） */
function removeFromRoom(io: Server, socketId: string, reason: 'leave' | 'disconnect') {
    // 直接透過 socket.id 找到所在的 roomId，不需要使用 for 迴圈遍歷所有房間
    const roomId = socketRoomMap.get(socketId);
    if (!roomId) return;
    socketRoomMap.delete(socketId);

    const room = rooms.get(roomId);
    if (room && room.players.has(socketId)) {
        const player = room.players.get(socketId)!;

        // 清理資料（只清自己這條連線的紀錄，避免把同帳號新連線的紀錄刪掉）
        if (activeMembers.get(player.memberId)?.socketId === socketId) activeMembers.delete(player.memberId);
        room.players.delete(socketId);
        memoryHandleLeave(io, roomId, socketId, reason, room.players.size === 0);

        io.to(roomId).emit('player_left', { socketId });
        io.to(roomId).emit('receive_message', {
            senderName: '系統',
            message: `${player.petName} 離開了房間。`,
            timestamp: new Date()
        });

        // 房間沒人就刪除
        if (room.players.size === 0) {
            rooms.delete(roomId);
            clearRoomChat(roomId);
            console.log(`[Socket] 房間 ${roomId} 已清空並自動銷毀`);
        }
    }
}