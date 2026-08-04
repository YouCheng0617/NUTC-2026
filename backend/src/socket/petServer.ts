import { Server, Socket } from 'socket.io';

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
const activeMembers = new Map<number, string>(); // 記錄 memberId -> roomId
const socketRoomMap = new Map<string, string>(); // 優化：記錄 socketId -> roomId，讓離開房間的尋找時間變成 O(1)
const ABSOLUTE_MAX_PLAYERS = 6;


export const setupPetSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`[Socket] 玩家連線: ${socket.id}`);
        console.log(`[WebSocket] 有隻海兔跳進來了！Socket ID: ${socket.id}`);
        // 1. 創立房間
        socket.on('create_room', (data: {
            playerData: Omit<Player, 'socketId' | 'x' | 'y'>,
            maxPlayers?: number
        }) => {
            const { playerData, maxPlayers } = data;

            if (activeMembers.has(playerData.memberId)) {
                return socket.emit('error', { message: '您已經在另一個房間中了，請先退出再開新房間！' });
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
        socket.on('join_room', ({ roomId, playerData }: { roomId: string, playerData: Omit<Player, 'socketId' | 'x' | 'y'> }) => {

            if (activeMembers.has(playerData.memberId)) {
                return socket.emit('error', { message: '您已經在另一個房間中了，請先退出再加入！' });
            }

            const room = rooms.get(roomId);
            if (!room) {
                return socket.emit('error', { message: '找不到該房間！請確認邀請碼是否正確。' });
            }

            if (room.players.size >= room.maxCapacity) {
                return socket.emit('error', { message: `房間已滿！(此房間上限為 ${room.maxCapacity} 人)` });
            }

            joinRoomLogic(socket, roomId, playerData);
        });

        socket.on('disconnect', () => {
            handleLeave(socket, io);
        });

        socket.on('leave_room', () => {
            handleLeave(socket, io);
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

        // 4. 發送訊息
        socket.on('send_message', ({ roomId, message }: { roomId: string; message: string }) => {
            const room = rooms.get(roomId);
            if (room) {
                const player = room.players.get(socket.id);
                if (player && message.trim() !== '') { // 優化：防止發送空訊息
                    io.to(roomId).emit('receive_message', {
                        senderName: player.petName,
                        message: message.trim(),
                        timestamp: new Date()
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

    activeMembers.set(playerData.memberId, roomId);
    socketRoomMap.set(socket.id, roomId); // 記錄 socketId -> roomId 的對應

    const allPlayers = Array.from(room.players.values());
    socket.emit('room_joined', {
        roomId,
        maxCapacity: room.maxCapacity,
        players: allPlayers
    });

    socket.to(roomId).emit('player_joined', newPlayer);

    socket.to(roomId).emit('receive_message', {
        senderName: '系統',
        message: `${newPlayer.petName} 蹦蹦跳跳地進入了房間！`,
        timestamp: new Date()
    });
}

function handleLeave(socket: Socket, io: Server) {
    // 優化：直接透過 socket.id 找到所在的 roomId，不需要使用 for 迴圈遍歷所有房間 (時間複雜度由 O(N) 降為 O(1))
    const roomId = socketRoomMap.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.players.has(socket.id)) {
        const player = room.players.get(socket.id)!;

        // 清理資料
        activeMembers.delete(player.memberId);
        socketRoomMap.delete(socket.id);
        room.players.delete(socket.id);
        socket.leave(roomId);

        io.to(roomId).emit('player_left', { socketId: socket.id });
        io.to(roomId).emit('receive_message', {
            senderName: '系統',
            message: `${player.petName} 離開了房間。`,
            timestamp: new Date()
        });

        // 房間沒人就刪除
        if (room.players.size === 0) {
            rooms.delete(roomId);
            console.log(`[Socket] 房間 ${roomId} 已清空並自動銷毀`);
        }
    }
}