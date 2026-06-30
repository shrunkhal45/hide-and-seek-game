import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r160/build/three.module.js';
import { GameManager } from './gameManager.js';
import { InputManager } from './inputManager.js';
import { RenderManager } from './renderManager.js';
import { NetworkManager } from './networkManager.js';

// Global state
let game = null;

// UI Functions
window.createRoom = function() {
  const playerName = document.getElementById('playerNameInput').value.trim();
  if (!playerName) {
    alert('Please enter your name');
    return;
  }
  if (game) {
    game.networkManager.createRoom(playerName);
  }
};

window.showJoinPanel = function() {
  document.getElementById('joinPanel').style.display = 'block';
};

window.hideJoinPanel = function() {
  document.getElementById('joinPanel').style.display = 'none';
};

window.joinRoom = function() {
  const playerName = document.getElementById('playerNameInput').value.trim();
  const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  
  if (!playerName) {
    alert('Please enter your name');
    return;
  }
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  
  if (game) {
    game.networkManager.joinRoom(roomCode, playerName);
  }
};

window.startGame = function() {
  if (game) {
    game.networkManager.startGame();
  }
};

// Initialize game
function init() {
  const container = document.getElementById('gameContainer');
  
  game = {
    networkManager: new NetworkManager(),
    inputManager: new InputManager(),
    renderManager: new RenderManager(container),
    gameManager: new GameManager(),
    currentPlayer: null,
    players: new Map(),
    gameState: 'lobby'
  };

  // Setup network callbacks
  game.networkManager.on('roomCreated', (data) => {
    game.currentPlayer = {
      id: game.networkManager.socket.id,
      name: data.roomCode ? 'You' : 'Player',
      isSeeker: false,
      isEliminated: false
    };
    game.gameState = 'lobby';
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    updateRoomDisplay(data);
  });

  game.networkManager.on('roomJoined', (data) => {
    game.currentPlayer = {
      id: game.networkManager.socket.id,
      name: document.getElementById('playerNameInput').value,
      isSeeker: false,
      isEliminated: false
    };
    game.gameState = 'lobby';
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    updateRoomDisplay(data);
  });

  game.networkManager.on('playerJoined', (data) => {
    game.players.clear();
    data.players.forEach(player => {
      game.players.set(player.id, player);
      if (player.id === game.networkManager.socket.id) {
        game.currentPlayer = player;
      }
    });
    updatePlayerList();
    document.getElementById('playerCount').textContent = data.playerCount;
  });

  game.networkManager.on('gameStarted', (data) => {
    game.gameState = 'hiding';
    game.players.clear();
    data.players.forEach(player => {
      game.players.set(player.id, player);
      if (player.id === game.networkManager.socket.id) {
        game.currentPlayer = player;
      }
    });
    document.getElementById('phaseInfo').textContent = 'Hiding Phase';
    document.getElementById('seekerInfo').textContent = `Seeker: ${data.seeker}`;
    game.renderManager.addPlayersToScene(Array.from(game.players.values()));
  });

  game.networkManager.on('playerMoved', (data) => {
    const player = game.players.get(data.playerId);
    if (player) {
      player.position = data.position;
      game.renderManager.updatePlayerPosition(data.playerId, data.position);
    }
  });

  game.networkManager.on('playerEliminated', (data) => {
    const player = game.players.get(data.playerId);
    if (player) {
      player.isEliminated = true;
      game.renderManager.eliminatePlayer(data.playerId);
    }
    updatePlayerList();
  });

  game.networkManager.on('timerUpdate', (data) => {
    const minutes = Math.floor(data.timer / 60);
    const seconds = data.timer % 60;
    document.getElementById('timer').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  game.networkManager.on('phaseChanged', (data) => {
    game.gameState = 'seeking';
    document.getElementById('phaseInfo').textContent = 'Seeking Phase';
  });

  game.networkManager.on('gameEnded', (data) => {
    game.gameState = 'ended';
    showGameOver(data);
  });

  game.networkManager.on('playerLeft', (data) => {
    game.players.delete(data.playerId);
    game.renderManager.removePlayer(data.playerId);
    updatePlayerList();
    document.getElementById('playerCount').textContent = data.playerCount;
  });

  // Setup input
  game.inputManager.on('move', (direction) => {
    if (game.gameState === 'hiding' || game.gameState === 'seeking') {
      game.renderManager.movePlayer(direction);
      const pos = game.renderManager.getPlayerPosition();
      game.networkManager.updatePosition(pos);
    }
  });

  game.inputManager.on('look', (delta) => {
    game.renderManager.rotateCamera(delta);
  });

  game.inputManager.on('jump', () => {
    game.renderManager.jump();
  });

  // Start render loop
  animate();
}

function updateRoomDisplay(data) {
  document.getElementById('roomCodeDisplay').textContent = data.code;
  document.getElementById('playerCount').textContent = data.playerCount;
  updatePlayerList();

  // Show start button if room creator
  const statusInfo = document.getElementById('statusInfo');
  statusInfo.innerHTML = '<button onclick="startGame()" style="width: 100%;">Start Game</button>';
}

function updatePlayerList() {
  const listContainer = document.getElementById('playerList');
  listContainer.innerHTML = '';
  
  game.players.forEach((player) => {
    const item = document.createElement('div');
    item.className = 'player-item';
    if (player.isSeeker) {
      item.classList.add('seeker');
    }
    if (player.isEliminated) {
      item.classList.add('eliminated');
    }
    
    let label = player.name;
    if (player.isSeeker) label += ' (Seeker)';
    if (player.isEliminated) label += ' (Eliminated)';
    
    item.textContent = label;
    listContainer.appendChild(item);
  });
}

function showGameOver(data) {
  const screen = document.getElementById('gameOverScreen');
  const title = document.getElementById('gameOverTitle');
  const message = document.getElementById('gameOverMessage');
  const list = document.getElementById('survivorsList');

  const isWinner = data.survivors.some(p => p.id === game.networkManager.socket.id);
  title.textContent = isWinner ? '🎉 You Won!' : '❌ Game Over';
  message.textContent = `Seeker was: ${data.seeker}`;

  list.innerHTML = '';
  data.survivors.forEach(survivor => {
    const item = document.createElement('div');
    item.className = 'survivor-item';
    item.textContent = survivor.name;
    list.appendChild(item);
  });

  screen.style.display = 'flex';
}

function animate() {
  requestAnimationFrame(animate);
  game.renderManager.render();
}

// Start the game
init();
