export class NetworkManager extends EventTarget {
  constructor() {
    super();
    this.socket = io();
    this.roomCode = null;

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('playerJoined', (data) => {
      this.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
    });

    this.socket.on('gameStarted', (data) => {
      this.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
    });

    this.socket.on('playerMoved', (data) => {
      this.dispatchEvent(new CustomEvent('playerMoved', { detail: data }));
    });

    this.socket.on('playerEliminated', (data) => {
      this.dispatchEvent(new CustomEvent('playerEliminated', { detail: data }));
    });

    this.socket.on('timerUpdate', (data) => {
      this.dispatchEvent(new CustomEvent('timerUpdate', { detail: data }));
    });

    this.socket.on('phaseChanged', (data) => {
      this.dispatchEvent(new CustomEvent('phaseChanged', { detail: data }));
    });

    this.socket.on('gameEnded', (data) => {
      this.dispatchEvent(new CustomEvent('gameEnded', { detail: data }));
    });

    this.socket.on('playerLeft', (data) => {
      this.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
    });
  }

  on(event, callback) {
    this.addEventListener(event, (e) => callback(e.detail));
  }

  createRoom(playerName) {
    this.socket.emit('createRoom', playerName, (response) => {
      if (response.success) {
        this.roomCode = response.roomCode;
        this.dispatchEvent(new CustomEvent('roomCreated', { detail: response }));
      } else {
        alert(response.error);
      }
    });
  }

  joinRoom(roomCode, playerName) {
    this.socket.emit('joinRoom', roomCode, playerName, (response) => {
      if (response.success) {
        this.roomCode = roomCode;
        this.dispatchEvent(new CustomEvent('roomJoined', { detail: response }));
      } else {
        alert(response.error);
      }
    });
  }

  startGame() {
    this.socket.emit('startGame', (response) => {
      if (!response.success) {
        alert(response.error);
      }
    });
  }

  updatePosition(position) {
    this.socket.emit('updatePosition', position);
  }

  tagPlayer(playerId) {
    this.socket.emit('tagPlayer', playerId);
  }
}
