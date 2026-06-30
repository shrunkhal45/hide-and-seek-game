import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('.'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

// Game state
const rooms = new Map();
const clients = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function serializeRoom(room) {
  return {
    code: room.code,
    players: Array.from(room.players.values()),
    gameState: room.gameState,
    seeker: room.seeker,
    maxPlayers: room.maxPlayers
  };
}

// WebSocket events
wss.on('connection', (ws) => {
  let clientId = null;
  let roomCode = null;

  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      clientId = data.playerId;
      clients.set(clientId, { ws, roomCode });

      switch (data.action) {
        case 'createRoom':
          createRoom(ws, data);
          break;
        case 'joinRoom':
          joinRoom(ws, data);
          break;
        case 'startGame':
          startGame(ws, roomCode);
          break;
        case 'updatePosition':
          updatePosition(clientId, roomCode, data.position);
          break;
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  });

  ws.on('close', () => {
    if (roomCode && clientId) {
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(clientId);
        
        if (room.players.size === 0) {
          rooms.delete(roomCode);
        } else {
          broadcastToRoom(roomCode, {
            action: 'playerJoined',
            players: Array.from(room.players.values())
          });
        }
      }
    }
    clients.delete(clientId);
    console.log('Client disconnected');
  });
});

function createRoom(ws, data) {
  const code = generateRoomCode();
  const room = {
    code,
    players: new Map(),
    gameState: 'lobby',
    seeker: null,
    seekerId: null,
    timer: 0,
    maxPlayers: 10,
    timerInterval: null
  };

  room.players.set(data.playerId, {
    id: data.playerId,
    name: data.playerName,
    position: { x: 0, y: 0, z: 0 },
    isSeeker: false,
    isEliminated: false
  });

  rooms.set(code, room);
  const client = clients.get(data.playerId);
  if (client) client.roomCode = code;

  ws.send(JSON.stringify({
    action: 'roomCreated',
    roomCode: code,
    room: serializeRoom(room)
  }));
}

function joinRoom(ws, data) {
  const room = rooms.get(data.roomCode);

  if (!room) {
    ws.send(JSON.stringify({ action: 'error', message: 'Room not found' }));
    return;
  }

  if (room.players.size >= room.maxPlayers) {
    ws.send(JSON.stringify({ action: 'error', message: 'Room is full' }));
    return;
  }

  room.players.set(data.playerId, {
    id: data.playerId,
    name: data.playerName,
    position: { x: Math.random() * 30 - 15, y: 0, z: Math.random() * 30 - 15 },
    isSeeker: false,
    isEliminated: false
  });

  const client = clients.get(data.playerId);
  if (client) client.roomCode = data.roomCode;

  ws.send(JSON.stringify({
    action: 'roomJoined',
    roomCode: data.roomCode,
    room: serializeRoom(room)
  }));

  broadcastToRoom(data.roomCode, {
    action: 'playerJoined',
    players: Array.from(room.players.values())
  });
}

function startGame(ws, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'hiding';
  
  // Select random seeker
  const playerIds = Array.from(room.players.keys());
  const seekerId = playerIds[Math.floor(Math.random() * playerIds.length)];
  
  const seeker = room.players.get(seekerId);
  seeker.isSeeker = true;
  room.seeker = seeker.name;
  room.seekerId = seekerId;

  broadcastToRoom(roomCode, {
    action: 'gameStarted',
    gameState: 'hiding',
    seeker: seeker.name,
    seekerId: seekerId,
    timer: 60,
    players: Array.from(room.players.values())
  });

  startHidingPhase(roomCode);
}

function startHidingPhase(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  let timeLeft = 60;
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    timeLeft--;
    broadcastToRoom(roomCode, {
      action: 'timerUpdate',
      timer: timeLeft,
      phase: 'hiding'
    });

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      startSeekingPhase(roomCode);
    }
  }, 1000);
}

function startSeekingPhase(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'seeking';
  broadcastToRoom(roomCode, { action: 'phaseChanged', phase: 'seeking' });

  let timeLeft = 120;
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    timeLeft--;
    broadcastToRoom(roomCode, {
      action: 'timerUpdate',
      timer: timeLeft,
      phase: 'seeking'
    });

    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      endGame(roomCode);
    }
  }, 1000);
}

function endGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.gameState = 'ended';
  const survivors = Array.from(room.players.values()).filter(p => !p.isEliminated);

  broadcastToRoom(roomCode, {
    action: 'gameEnded',
    survivors,
    seeker: room.seeker
  });
}

function updatePosition(clientId, roomCode, position) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.get(clientId);
  if (player) {
    player.position = position;

    // Broadcast position
    broadcastToRoom(roomCode, {
      action: 'playerMoved',
      playerId: clientId,
      position
    });

    // Check collision with seeker
    if (room.gameState === 'seeking' && room.seekerId !== clientId) {
      const seeker = room.players.get(room.seekerId);
      if (seeker) {
        const dx = player.position.x - seeker.position.x;
        const dy = player.position.y - seeker.position.y;
        const dz = player.position.z - seeker.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 2 && !player.isEliminated) {
          player.isEliminated = true;
          broadcastToRoom(roomCode, {
            action: 'playerEliminated',
            playerId: clientId,
            playerName: player.name
          });
        }
      }
    }
  }
}

function broadcastToRoom(roomCode, data) {
  clients.forEach((client) => {
    if (client.roomCode === roomCode && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Hide & Seek .IO Server running on http://localhost:${PORT}`);
});
