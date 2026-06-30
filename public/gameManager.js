export class GameManager {
  constructor() {
    this.gameState = 'lobby'; // lobby, hiding, seeking, ended
    this.currentPhase = null;
    this.timer = 0;
  }

  setGameState(state) {
    this.gameState = state;
  }

  setPhase(phase) {
    this.currentPhase = phase;
  }

  setTimer(time) {
    this.timer = time;
  }
}
