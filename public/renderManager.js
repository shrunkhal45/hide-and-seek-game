import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r160/build/three.module.js';

export class RenderManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 1000);

    // Camera - First person
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Build world
    this.buildWorld();

    // Player physics
    this.playerVelocity = new THREE.Vector3();
    this.playerOnGround = true;
    this.gravity = -0.01;
    this.moveSpeed = 0.3;
    this.lookSensitivity = 0.005;

    this.playerObjects = new Map();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  buildWorld() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Obstacles - boxes
    const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xa8e6cf, 0xff8b94];
    for (let i = 0; i < 8; i++) {
      const size = Math.random() * 5 + 3;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshStandardMaterial({ color: colors[i % colors.length] });
      const box = new THREE.Mesh(geometry, material);
      box.position.set(
        Math.random() * 80 - 40,
        size / 2,
        Math.random() * 80 - 40
      );
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
    }

    // Trees (cones)
    for (let i = 0; i < 12; i++) {
      const trunkGeometry = new THREE.CylinderGeometry(1, 1, 5, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      
      const foliageGeometry = new THREE.ConeGeometry(6, 12, 8);
      const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x27ae60 });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 8;

      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(foliage);
      
      tree.position.set(
        Math.random() * 150 - 75,
        0,
        Math.random() * 150 - 75
      );
      
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      
      this.scene.add(tree);
    }

    // Sky
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(sky);
  }

  addPlayersToScene(players) {
    players.forEach(player => {
      if (!this.playerObjects.has(player.id)) {
        const geometry = new THREE.CapsuleGeometry(0.5, 2, 4, 8);
        const material = new THREE.MeshStandardMaterial({
          color: player.isSeeker ? 0xff0000 : 0x00ff00
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(player.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.playerObjects.set(player.id, { mesh, player });
      }
    });
  }

  updatePlayerPosition(playerId, position) {
    const obj = this.playerObjects.get(playerId);
    if (obj) {
      obj.mesh.position.copy(position);
      obj.player.position = position;
    }
  }

  eliminatePlayer(playerId) {
    const obj = this.playerObjects.get(playerId);
    if (obj) {
      obj.mesh.material.color.set(0x888888);
      obj.player.isEliminated = true;
    }
  }

  removePlayer(playerId) {
    const obj = this.playerObjects.get(playerId);
    if (obj) {
      this.scene.remove(obj.mesh);
      this.playerObjects.delete(playerId);
    }
  }

  movePlayer(direction) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(this.camera.up, forward).normalize();

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, -direction.z);
    moveDir.addScaledVector(right, direction.x);

    this.camera.position.addScaledVector(moveDir, this.moveSpeed);
  }

  rotateCamera(delta) {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    
    euler.setFromVector3(new THREE.Vector3(
      euler.x - delta.y * this.lookSensitivity,
      euler.y - delta.x * this.lookSensitivity,
      0
    ));
    
    this.camera.quaternion.setFromEuler(euler);
  }

  jump() {
    if (this.playerOnGround) {
      this.playerVelocity.y = 0.15;
      this.playerOnGround = false;
    }
  }

  getPlayerPosition() {
    return {
      x: this.camera.position.x,
      y: this.camera.position.y - 1.5, // Adjust to feet
      z: this.camera.position.z
    };
  }

  render() {
    // Apply gravity
    this.playerVelocity.y += this.gravity;
    this.camera.position.y += this.playerVelocity.y;

    // Ground collision
    if (this.camera.position.y <= 1) {
      this.camera.position.y = 1;
      this.playerVelocity.y = 0;
      this.playerOnGround = true;
    } else {
      this.playerOnGround = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
