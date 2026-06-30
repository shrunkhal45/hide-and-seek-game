export class InputManager extends EventTarget {
  constructor() {
    super();
    
    this.keys = {};
    this.mouseMovement = { x: 0, y: 0 };
    this.pointerLocked = false;

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.handleInput();
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseMovement.x = e.movementX;
        this.mouseMovement.y = e.movementY;
        this.dispatchEvent(new CustomEvent('look', { 
          detail: { x: e.movementX, y: e.movementY } 
        }));
      }
    });

    // Pointer lock
    document.addEventListener('click', () => {
      if (!this.pointerLocked) {
        document.documentElement.requestPointerLock();
        this.pointerLocked = true;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement !== null;
    });

    // Fullscreen / Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.exitPointerLock();
      }
    });
  }

  on(event, callback) {
    this.addEventListener(event, (e) => callback(e.detail));
  }

  handleInput() {
    const direction = { x: 0, y: 0, z: 0 };

    if (this.keys['w']) direction.z -= 1;
    if (this.keys['s']) direction.z += 1;
    if (this.keys['a']) direction.x -= 1;
    if (this.keys['d']) direction.x += 1;

    if (direction.x !== 0 || direction.z !== 0) {
      this.dispatchEvent(new CustomEvent('move', { detail: direction }));
    }

    if (this.keys[' ']) {
      this.dispatchEvent(new CustomEvent('jump', {}));
      this.keys[' '] = false; // Prevent holding
    }
  }
}
