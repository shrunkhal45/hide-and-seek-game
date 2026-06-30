import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
app.use(express.static('dist'));
app.use(express.static('public'));

// Game state
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create room
  socket.on('createRoom', (playerName, callback) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      players: new Map(),
      gameState: 'lobby', // lobby, hiding, seeking, ended
      seeker: null,
      timer: 60,
      maxPlayers: 10
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      position: { x: 0, y: 0, z: 0 },
      isSeeker: false,
      isEliminated: false
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerName = playerName;

    console.log(`Room created: ${roomCode}`);
    callback({ success: true, roomCode, room: serializeRoom(room) });
  });

  // Join room
  socket.on('joinRoom', (roomCode, playerName, callback) => {
    const room = rooms.get(roomCode);

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    if (room.players.size >= room.maxPlayers) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      position: { x: Math.random() * 20 - 10, y: 0, z: Math.random() * 20 - 10 },
      isSeeker: false,
      isEliminated: false
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerName = playerName;

    io.to(roomCode).emit('playerJoined', {
      players: Array.from(room.players.values()),
      playerCount: room.players.size
    });

    callback({ success: true, room: serializeRoom(room) });
  });

  // Start game
  socket.on('startGame', (callback) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    room.gameState = 'hiding';
    
    // Select random seeker
    const playerIds = Array.from(room.players.keys());
    const seekerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    
    const seeker = room.players.get(seekerId);
    seeker.isSeeker = true;
    room.seeker = seekerId;
    room.timer = 60;

    io.to(socket.roomCode).emit('gameStarted', {
      gameState: 'hiding',
      seeker: seeker.name,
      seekerId: seekerId,
      timer: room.timer,
      players: Array.from(room.players.values())
    });

    // Start hiding phase timer
    startHidingPhase(socket.roomCode);
    callback({ success: true });
  });

  // Player position update
  socket.on('updatePosition', (position) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.position = position;

    // Check if seeker is touching any player
    if (player.isSeeker) {
      checkCollisions(socket.roomCode);
    }

    io.to(socket.roomCode).emit('playerMoved', {
      playerId: socket.id,
      position: position
    });
  });

  // Player tagged
  socket.on('tagPlayer', (targetId) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.seeker || room.seeker !== socket.id) return;

    const target = room.players.get(targetId);
    if (target) {
      target.isEliminated = true;
      io.to(socket.roomCode).emit('playerEliminated', {
        playerId: targetId,
        playerName: target.name
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (room) {
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(roomCode);
        console.log(`Room deleted: ${roomCode}`);
      } else {
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          playerCount: room.players.size,
          players: Array.from(room.players.values())
        });
      }
    }

    console.log(`Player disconnected: ${socket.id}`);
  });
});

function startHidingPhase(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  let timeLeft = 60;
  const interval = setInterval(() => {
    timeLeft--;
    io.to(roomCode).emit('timerUpdate', { timer: timeLeft, phase: 'hiding' });

    if (timeLeft <= 0) {
      clearInterval(interval);
      startSeekingPhase(roomCode);
    }
  }, 1000);
}

function startSeekingPhase(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'seeking';
  io.to(roomCode).emit('phaseChanged', { phase: 'seeking', timer: 120 });

  let timeLeft = 120;
  const interval = setInterval(() => {
    timeLeft--;
    io.to(roomCode).emit('timerUpdate', { timer: timeLeft, phase: 'seeking' });

    if (timeLeft <= 0) {
      clearInterval(interval);
      endGame(roomCode);
    }
  }, 1000);
}

function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'ended';
  const survivors = Array.from(room.players.values()).filter(p => !p.isEliminated);

  io.to(roomCode).emit('gameEnded', {
    survivors: survivors,
    seeker: room.players.get(room.seeker).name
  });
}

function checkCollisions(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.seeker) return;

  const seeker = room.players.get(room.seeker);
  const TOUCH_DISTANCE = 2;

  room.players.forEach((player, playerId) => {
    if (playerId === room.seeker || player.isEliminated) return;

    const dx = player.position.x - seeker.position.x;
    const dy = player.position.y - seeker.position.y;
    const dz = player.position.z - seeker.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < TOUCH_DISTANCE) {
      player.isEliminated = true;
      io.to(roomCode).emit('playerEliminated', {
        playerId: playerId,
        playerName: player.name
      });
    }
  });
}

function serializeRoom(room) {
  return {
    code: room.code,
    gameState: room.gameState,
    players: Array.from(room.players.values()),
    playerCount: room.players.size,
    seeker: room.seeker ? room.players.get(room.seeker).name : null,
    timer: room.timer
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
