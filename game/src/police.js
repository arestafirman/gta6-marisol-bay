// Wanted 0–5: police dispatch, chase cars that hunt the player, and a
// helicopter from 3 stars up. Wanted decays once the player stays clean
// and out of sight; getting caught on foot means BUSTED.
import * as THREE from 'three';
import { WANTED, WORLD } from './config.js';
import { makeCarMesh } from './vehicles.js';

function angleTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Police {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.wanted = 0;
    this.lastCrimeAt = -999;
    this.chaseCars = [];
    this.heli = null;
    this.heliRotor = null;
    this.flashTimer = 0;
    this.flashOn = false;
    this.touchTimer = 0;
    this.time = 0;
  }

  addWanted(amount, now) {
    this.wanted = Math.min(WANTED.max, this.wanted + amount);
    this.lastCrimeAt = now;
  }

  clearWanted() {
    this.wanted = 0;
    this.touchTimer = 0;
  }

  spawnChaseCar(playerPos) {
    const mesh = makeCarMesh(0xe8e8e8, { police: true });
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(45, 70);
    const car = {
      mesh,
      x: playerPos.x + Math.sin(angle) * dist,
      z: playerPos.z + Math.cos(angle) * dist,
      yaw: 0,
      speed: 0,
    };
    car.x = Math.max(-WORLD.half + 8, Math.min(WORLD.half - 8, car.x));
    car.z = Math.max(-WORLD.half + 8, Math.min(WORLD.beachZ - 8, car.z));
    mesh.position.set(car.x, 0, car.z);
    this.scene.add(mesh);
    this.chaseCars.push(car);
    return car;
  }

  spawnHeli() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x1e2a4a }),
    );
    group.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1e2a4a }),
    );
    tail.position.set(-2.8, 0.2, 0);
    group.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    rotor.position.y = 0.95;
    group.add(rotor);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    lamp.position.set(1.2, -0.8, 0);
    group.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
    );
    beam.position.y = -21;
    beam.rotation.x = Math.PI;
    group.add(beam);
    this.heli = group;
    this.heliRotor = rotor;
    this.scene.add(group);
  }

  update(dt, game) {
    this.time += dt;
    const playerPos = game.player.position;
    const inCar = !game.player.onFoot;

    // Wanted decays when the player has been clean for a while.
    if (this.wanted > 0 && this.time - this.lastCrimeAt > WANTED.decayDelay) {
      this.wanted = Math.max(0, this.wanted - WANTED.decayRate * dt);
      if (this.wanted < 0.5) this.wanted = 0;
    }
    const stars = Math.ceil(this.wanted);

    // Chase cars: one per star up to 3, plus the helicopter from 3 stars.
    const wantCars = stars === 0 ? 0 : Math.min(3, stars);
    while (this.chaseCars.length < wantCars) this.spawnChaseCar(playerPos);
    while (this.chaseCars.length > wantCars) {
      const car = this.chaseCars.pop();
      this.scene.remove(car.mesh);
    }
    if (stars >= 3 && !this.heli) this.spawnHeli();
    if (stars < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.heliRotor = null;
    }

    // Flash the light bars.
    this.flashTimer += dt;
    if (this.flashTimer > 0.28) {
      this.flashTimer = 0;
      this.flashOn = !this.flashOn;
      for (const car of this.chaseCars) {
        const bar = car.mesh.userData.lightBar;
        if (bar) bar.material.color.setHex(this.flashOn ? 0xff2222 : 0x2233ff);
      }
    }

    // Chase cars hunt the player.
    let touching = false;
    for (const car of this.chaseCars) {
      const targetYaw = angleTo(car.x, car.z, playerPos.x, playerPos.z);
      const diff = angleDiff(targetYaw, car.yaw);
      car.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const targetSpeed = dist > 90 ? 30 : dist > 14 ? 26 : 16;
      car.speed += Math.max(-20 * dt, Math.min(14 * dt, targetSpeed - car.speed));
      car.x += Math.sin(car.yaw) * car.speed * dt;
      car.z += Math.cos(car.yaw) * car.speed * dt;
      const pushed = this.city.pushOutOfBuildings(car.x, car.z, 2.4, this.city.colliders);
      if (pushed.x !== car.x || pushed.z !== car.z) {
        car.x = pushed.x;
        car.z = pushed.z;
        car.speed *= 0.5;
        car.yaw += 0.6;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.yaw;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.z -= (car.speed * dt) / 0.38;
      if (dist < 3.4) {
        touching = true;
        if (inCar) {
          // Ram: shove the player's car and slow it.
          const push = 3.2;
          game.player.car.x -= (dx / (dist || 1)) * push * dt * 8;
          game.player.car.z -= (dz / (dist || 1)) * push * dt * 8;
          game.player.car.speed *= 0.92;
        }
      }
      // A chase car that fell far behind respawns closer.
      if (dist > 160) {
        const angle = this.rng.range(0, Math.PI * 2);
        car.x = playerPos.x + Math.sin(angle) * 55;
        car.z = playerPos.z + Math.cos(angle) * 55;
        car.speed = 10;
      }
    }

    // On foot, a touching police car starts the busted timer.
    if (touching && !inCar && stars > 0) {
      this.touchTimer += dt;
    } else {
      this.touchTimer = Math.max(0, this.touchTimer - dt * 2);
    }

    // Helicopter hovers above the player, rotor spinning.
    if (this.heli) {
      const targetX = playerPos.x + 14;
      const targetZ = playerPos.z - 10;
      this.heli.position.x += (targetX - this.heli.position.x) * Math.min(1, dt * 0.8);
      this.heli.position.z += (targetZ - this.heli.position.z) * Math.min(1, dt * 0.8);
      this.heli.position.y = 42 + Math.sin(this.time * 0.7) * 2;
      this.heli.rotation.y = angleTo(this.heli.position.x, this.heli.position.z, playerPos.x, playerPos.z);
      this.heliRotor.rotation.y += dt * 28;
    }
  }
}
