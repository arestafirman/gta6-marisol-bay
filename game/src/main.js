// Marisol Bay — boot, main loop, screens, player movement and camera.
// The world is built from the seeded RNG, then the loop runs the city,
// traffic, police, missions and combat, and paints the HUD on top.
import * as THREE from 'three';
import { WORLD, PLAYER, START_CASH, WANTED } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { Traffic, ParkedCars, updatePlayerCar } from './vehicles.js';
import { Pedestrians, makePedMesh } from './pedestrians.js';
import { Police } from './police.js';
import { MissionSystem, LOCATIONS } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const CAM_DISTANCES = [7, 11, 16];

function makePlayerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2a9c8a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
  hair.position.y = 1.68;
  hair.scale.set(1, 0.6, 1);
  group.add(hair);
  const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(-0.14, 0.33, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export class Game {
  constructor(canvas) {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed')) || WORLD.seed;
    this.shotName = params.get('shot');
    this.rng = new RNG(this.seed);
    this.time = 0;
    this.state = 'title';
    this.cash = START_CASH;
    this.completed = 0;
    this.shotStaged = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.rng, this.city);
    this.parkedCars = new ParkedCars(this.scene, this.rng, this.city);
    this.peds = new Pedestrians(this.scene, this.rng, this.city);
    this.police = new Police(this.scene, this.rng, this.city);
    this.combat = new Combat(this.scene, this.rng);
    this.missions = new MissionSystem(this);

    this.player = {
      mesh: makePlayerMesh(),
      position: new THREE.Vector3(-170, 0, -170),
      yaw: Math.PI / 2,
      health: PLAYER.maxHealth,
      onFoot: true,
      car: null,
      speed: 0,
      walkPhase: 0,
      camYaw: Math.PI / 2,
      camPitch: 0.32,
      camDistIndex: 1,
      lastLookAt: 0,
    };
    this.player.mesh.position.copy(this.player.position);
    this.player.mesh.rotation.y = this.player.yaw;
    this.scene.add(this.player.mesh);

    this.hud = new HUD(this, {
      onStart: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onResume: () => this.resumeGame(),
      onSave: () => {
        this.saveProgress();
        this.hud.showMessage('Game saved.', 2);
      },
      onRestartMission: () => {
        this.missions.restartMission();
        this.resumeGame();
      },
      onQuit: () => this.showTitle(),
      onRespawn: () => this.respawn(),
      onKeepPlaying: () => {
        this.hud.hideScreens();
        this.hud.showHud();
        this.state = 'play';
      },
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const saved = loadGame();
    this.showTitle(saved);
    if (this.shotName) {
      this.hud.hideScreens();
      this.hud.showHud();
      this.state = 'play';
      stageShot(this.shotName, this);
      this.shotStaged = true;
      this.renderFrame();
      this.renderFrame();
      window.__shotReady = true;
    }
  }

  showTitle(saved) {
    this.state = 'title';
    this.hud.showTitle(Boolean(saved));
    this.hud.root.style.display = 'none';
  }

  startNewGame() {
    clearSave();
    this.cash = START_CASH;
    this.completed = 0;
    this.player.health = PLAYER.maxHealth;
    this.player.position.set(-170, 0, -170);
    this.player.yaw = Math.PI / 2;
    this.player.camYaw = Math.PI / 2;
    this.player.onFoot = true;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.police.clearWanted();
    this.combat.clearEnemies();
    this.audio.ensure();
    this.audio.setRadio(true, 0);
    this.hud.hideScreens();
    this.hud.showHud();
    this.state = 'play';
    this.missions.startMission(0);
    this.hud.showMessage('Welcome back to Marisol Bay, Dario.', 4);
  }

  continueGame() {
    const saved = loadGame();
    this.startNewGame();
    if (!saved) return;
    this.cash = saved.cash;
    this.completed = saved.completed;
    this.player.health = saved.health;
    if (saved.position) this.player.position.set(saved.position.x, 0, saved.position.z);
    this.player.mesh.position.copy(this.player.position);
    this.missions.index = Math.min(saved.missionIndex, 7);
    this.missions.startMission(this.missions.index);
    this.hud.showMessage(`Welcome back — ${this.completed} mission${this.completed === 1 ? '' : 's'} done.`, 4);
  }

  saveProgress() {
    saveGame({
      cash: this.cash,
      missionIndex: this.missions.index,
      completed: this.completed,
      health: this.player.health,
      position: { x: this.player.position.x, z: this.player.position.z },
    });
  }

  resumeGame() {
    this.hud.hideScreens();
    this.hud.showHud();
    this.state = 'play';
  }

  onStoryComplete() {
    this.saveProgress();
    this.state = 'complete';
    this.hud.showComplete(this.cash, this.completed);
  }

  damagePlayer(amount) {
    if (this.state !== 'play') return;
    this.player.health -= amount;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.wasted();
    }
  }

  wasted() {
    const lost = Math.floor(this.cash * 0.15);
    this.cash -= lost;
    this.police.clearWanted();
    this.audio.playBusted();
    this.state = 'wasted';
    this.hud.showWasted(lost);
  }

  busted() {
    const lost = Math.floor(this.cash * 0.2);
    this.cash -= lost;
    this.police.clearWanted();
    this.audio.playBusted();
    this.state = 'busted';
    this.hud.showBusted(lost);
  }

  respawn() {
    if (this.player.car) {
      this.parkedCars.cars.push({ ...this.player.car, parked: true });
      this.player.car = null;
    }
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    this.player.health = PLAYER.maxHealth;
    this.player.position.set(LOCATIONS.hospital.x, 0, LOCATIONS.hospital.z);
    this.player.mesh.position.copy(this.player.position);
    this.police.touchTimer = 0;
    this.hud.hideScreens();
    this.hud.showHud();
    this.state = 'play';
  }

  nearestStealableCar(maxDist) {
    const p = this.player.position;
    let best = null;
    let bestD = maxDist;
    for (const car of this.parkedCars.cars) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { car, parked: true };
      }
    }
    for (const car of this.traffic.cars) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { car, parked: false };
      }
    }
    return best;
  }

  enterCar(found) {
    const { car, parked } = found;
    if (parked) {
      this.parkedCars.cars = this.parkedCars.cars.filter((c) => c !== car);
    } else {
      this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    }
    car.parked = false;
    car.speed = 0;
    this.player.car = car;
    this.player.onFoot = false;
    this.player.mesh.visible = false;
    this.player.position.set(car.x, 0, car.z);
    this.player.yaw = car.yaw;
    this.police.addWanted(WANTED.stealCar, this.time);
    this.audio.setRadio(true);
    this.hud.showMessage(car.isTarget ? 'That is the coupe — get it to Tito.' : 'You took the car. The city noticed.', 2.5);
  }

  exitCar() {
    const car = this.player.car;
    car.speed = 0;
    car.parked = true;
    this.parkedCars.cars.push(car);
    this.player.car = null;
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    const sideX = car.x + Math.cos(car.yaw) * 2.2;
    const sideZ = car.z - Math.sin(car.yaw) * 2.2;
    this.player.position.set(sideX, 0, sideZ);
    this.player.mesh.position.copy(this.player.position);
    this.audio.setRadio(false);
  }

  updatePlayerOnFoot(dt) {
    const input = this.input;
    const axis = input.moveAxis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const cy = this.player.camYaw;
    const fx = Math.sin(cy);
    const fz = Math.cos(cy);
    const rx = Math.cos(cy);
    const rz = -Math.sin(cy);
    let mx = fx * axis.y + rx * axis.x;
    let mz = fz * axis.y + rz * axis.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.player.position.x += mx * speed * dt;
      this.player.position.z += mz * speed * dt;
      this.player.yaw = cy;
      this.player.speed = speed;
      this.player.walkPhase += dt * speed * 2.4;
      const swing = Math.sin(this.player.walkPhase) * 0.55;
      this.player.mesh.userData.legL.rotation.x = swing;
      this.player.mesh.userData.legR.rotation.x = -swing;
    } else {
      this.player.speed = 0;
      this.player.mesh.userData.legL.rotation.x *= 0.8;
      this.player.mesh.userData.legR.rotation.x *= 0.8;
    }
    const pushed = this.city.pushOutOfBuildings(this.player.position.x, this.player.position.z, PLAYER.radius, this.city.colliders);
    this.player.position.x = pushed.x;
    this.player.position.z = pushed.z;
    this.player.position.x = Math.max(-WORLD.half + 4, Math.min(WORLD.half - 4, this.player.position.x));
    this.player.position.z = Math.max(-WORLD.half + 4, Math.min(WORLD.beachZ + 26, this.player.position.z));
    this.player.mesh.position.copy(this.player.position);
    this.player.mesh.rotation.y = this.player.yaw;
  }

  updateCamera(dt) {
    const p = this.player;
    const targetYaw = p.onFoot ? p.camYaw : p.car.yaw;
    if (dt >= 1) {
      p.camYaw = targetYaw;
    } else if (this.time - p.lastLookAt > 2.5) {
      p.camYaw = angleLerp(p.camYaw, targetYaw, dt * 1.6);
    }
    const dist = CAM_DISTANCES[p.camDistIndex] + (p.onFoot ? 0 : 3.5);
    const height = 3.2 + p.camPitch * 6 + (p.onFoot ? 0 : 1.2);
    const cx = p.position.x - Math.sin(p.camYaw) * dist;
    const cz = p.position.z - Math.cos(p.camYaw) * dist;
    this.camera.position.set(cx, height, cz);
    // Look well ahead of the player, not at their feet: the horizon and the
    // city stay in frame instead of only the road.
    this.camera.lookAt(p.position.x + Math.sin(p.camYaw) * 6, 2.2, p.position.z + Math.cos(p.camYaw) * 6);
  }

  update(dt) {
    this.time += dt;
    const input = this.input;
    const look = input.takeLook();
    if (look.dx !== 0 || look.dy !== 0) {
      this.player.camYaw -= look.dx * 0.0032;
      this.player.camPitch = Math.max(0.05, Math.min(0.85, this.player.camPitch + look.dy * 0.002));
      this.player.lastLookAt = this.time;
    }

    if (input.wasPressed('Escape')) {
      this.state = 'pause';
      this.hud.showPause();
      return;
    }
    if (input.wasPressed('KeyM')) {
      const station = this.audio.cycleStation();
      void station;
      this.hud.showMessage(`Radio: ${this.audio.stationName()}`, 1.5);
    }
    if (input.wasPressed('KeyC')) {
      this.player.camDistIndex = (this.player.camDistIndex + 1) % CAM_DISTANCES.length;
    }
    if (input.wasPressed('KeyR')) {
      this.missions.restartMission();
      this.hud.showMessage('Mission restarted.', 2);
    }
    if (input.wasPressed('KeyE')) {
      if (this.player.onFoot) {
        const found = this.nearestStealableCar(5.5);
        if (found) this.enterCar(found);
        else this.hud.showMessage('No car close enough — walk up to one and press E.', 2);
      } else {
        this.exitCar();
      }
    }
    if (input.wasPressed('KeyF')) this.combat.punch(this);
    if (input.takeClick() && this.player.onFoot) this.combat.shoot(this);

    if (this.player.onFoot) this.updatePlayerOnFoot(dt);
    else updatePlayerCar(this, dt);

    this.traffic.update(dt, this.player.position, this.player.car);
    this.peds.update(dt, this.player.position);
    this.police.update(dt, this);
    this.combat.update(dt, this);
    this.missions.update(dt);

    if (this.police.touchTimer > 1.6) {
      this.busted();
      return;
    }

    const speed01 = this.player.onFoot ? 0 : Math.abs(this.player.car.speed) / 44;
    this.audio.setEngine(speed01, !this.player.onFoot);
    this.audio.setSiren(this.police.wanted > 0);

    this.updateCamera(dt);
  }

  ambientUpdate(dt) {
    this.time += dt;
    const t = this.time * 0.045;
    this.camera.position.set(Math.cos(t) * 190, 62, Math.sin(t) * 190);
    this.camera.lookAt(0, 8, 0);
    this.traffic.update(dt, this.player.position, null);
    this.peds.update(dt, this.player.position);
  }

  renderFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.shotStaged) {
      if (this.state === 'play') {
        this.update(dt);
        this.hud.update(this, dt);
      } else if (this.state === 'title') {
        this.ambientUpdate(dt);
      }
    }
    this.renderFrame();
    this.input.endFrame();
    window.requestAnimationFrame(this.loop);
  };

  start() {
    this.clock = new THREE.Clock();
    this.updateCamera(10);
    window.requestAnimationFrame(this.loop);
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
game.start();
