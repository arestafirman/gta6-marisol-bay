// Cars: a box-built car model, arcade driving physics for the player,
// traffic that cruises the street grid, and parked cars the player can steal.
import * as THREE from 'three';
import { CAR, COLORS, WORLD } from './config.js';

const CAR_COLORS = [0xc23a3a, 0x3a6bc2, 0xe8e8e8, 0x222226, 0x3a9c5c, 0xe8a23a, 0x8a5cc2, 0xc2c2b8, 0x2a8a8a];

/** A low-poly car: body, cabin, wheels, headlights and taillights. */
export function makeCarMesh(color, options = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.length, 0.72, CAR.width), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.75), glassMat);
  cabin.position.set(-0.25, 1.28, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wz of [0.6, -0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.4), lightMat);
    head.position.set(CAR.length / 2 + 0.02, 0.66, wz);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd81e1e });
  for (const wz of [0.6, -0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.4), tailMat);
    tail.position.set(-CAR.length / 2 - 0.02, 0.66, wz);
    group.add(tail);
  }
  if (options.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(-0.25, 1.68, 0);
    group.add(bar);
    group.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.length + 0.02, 0.16, CAR.width + 0.02), new THREE.MeshLambertMaterial({ color: COLORS.police }));
    stripe.position.y = 0.9;
    group.add(stripe);
  }
  if (options.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe23a }));
    sign.position.set(-0.25, 1.68, 0);
    group.add(sign);
  }
  group.userData.wheels = wheels;
  return group;
}

function placeOnRoad(mesh, x, z, yaw) {
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
}

/** Traffic: cars that cruise the street grid, brake for what is ahead, and
 *  respawn near the player when they drift too far away. */
export class Traffic {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.cars = [];
    for (let i = 0; i < 16; i += 1) this.spawnCar();
  }

  spawnCar(near) {
    const p = near || this.city.randomStreetPoint(this.rng);
    const taxi = this.rng.chance(0.12);
    const mesh = makeCarMesh(taxi ? COLORS.taxi : this.rng.pick(CAR_COLORS), { taxi });
    const alongX = this.rng.chance(0.5);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const lane = this.rng.pick([-3, 3]);
    const car = {
      mesh,
      x: alongX ? p.x : p.x + lane,
      z: alongX ? p.z + lane : p.z,
      yaw: alongX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0,
      cruise: this.rng.range(8, 13),
      alongX,
      dir,
      lane,
    };
    placeOnRoad(mesh, car.x, car.z, car.yaw);
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  /** Cars directly ahead of `car` within `dist`, on the same lane. */
  aheadBlocked(car, others, dist) {
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    for (const other of others) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 2.6) return true;
    }
    return false;
  }

  update(dt, playerPos, playerCar) {
    const all = this.cars.slice();
    if (playerCar) all.push(playerCar);
    for (const car of this.cars) {
      const blocked = this.aheadBlocked(car, all, 11);
      const target = blocked ? 0 : car.cruise;
      car.speed += Math.max(-14 * dt, Math.min(8 * dt, target - car.speed));
      car.x += Math.sin(car.yaw) * car.speed * dt;
      car.z += Math.cos(car.yaw) * car.speed * dt;
      // At an intersection, sometimes turn onto the cross street.
      const onGridX = Math.abs(((car.x % WORLD.roadSpacing) + WORLD.roadSpacing) % WORLD.roadSpacing) < 1.2;
      const onGridZ = Math.abs(((car.z % WORLD.roadSpacing) + WORLD.roadSpacing) % WORLD.roadSpacing) < 1.2;
      if ((car.alongX && onGridX && onGridZ) || (!car.alongX && onGridZ && onGridX)) {
        if (this.rng.chance(0.25)) {
          const turn = this.rng.chance(0.5) ? 1 : -1;
          car.alongX = !car.alongX;
          car.yaw += turn * Math.PI / 2;
          car.dir = 1;
        }
      }
      // Keep inside the city; bounce back at the edge.
      if (car.x < -WORLD.half + 10 || car.x > WORLD.half - 10 || car.z < -WORLD.half + 10 || car.z > WORLD.beachZ - 10) {
        car.yaw += Math.PI;
        car.x = Math.max(-WORLD.half + 12, Math.min(WORLD.half - 12, car.x));
        car.z = Math.max(-WORLD.half + 12, Math.min(WORLD.beachZ - 12, car.z));
      }
      placeOnRoad(car.mesh, car.x, car.z, car.yaw);
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.z -= (car.speed * dt) / 0.38;
      // Too far from the player: respawn on a street nearby.
      const dx = car.x - playerPos.x;
      const dz = car.z - playerPos.z;
      if (dx * dx + dz * dz > 200 * 200) {
        const p = this.city.randomStreetPoint(this.rng);
        const near = { x: playerPos.x + this.rng.range(-90, 90), z: playerPos.z + this.rng.range(-90, 90) };
        const spot = { x: (p.x + near.x) / 2, z: (p.z + near.z) / 2 };
        const snapped = Math.abs(spot.x % WORLD.roadSpacing) < Math.abs(spot.z % WORLD.roadSpacing)
          ? { x: Math.round(spot.x / WORLD.roadSpacing) * WORLD.roadSpacing, z: spot.z }
          : { x: spot.x, z: Math.round(spot.z / WORLD.roadSpacing) * WORLD.roadSpacing };
        car.x = snapped.x;
        car.z = snapped.z;
        car.speed = 0;
      }
    }
  }
}

/** Parked cars the player can walk up to and steal with E. */
export class ParkedCars {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.cars = [];
    for (let i = 0; i < 14; i += 1) {
      const p = city.randomStreetPoint(rng);
      const alongX = rng.chance(0.5);
      const lane = rng.pick([-7.5, 7.5]);
      const mesh = makeCarMesh(rng.pick(CAR_COLORS));
      const car = {
        mesh,
        x: alongX ? p.x : p.x + lane,
        z: alongX ? p.z + lane : p.z,
        yaw: alongX ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
        speed: 0,
        parked: true,
        stolen: false,
        isTarget: false,
      };
      placeOnRoad(mesh, car.x, car.z, car.yaw);
      scene.add(mesh);
      this.cars.push(car);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      const dx = car.x - x;
      const dz = car.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
}

/** Arcade driving for the player's car: accel, brake, reverse, steering
 *  that tightens with speed, and push-out from buildings and other cars. */
export function updatePlayerCar(game, dt) {
  const car = game.player.car;
  const input = game.input;
  const axis = input.moveAxis();
  const handbrake = input.down('Space');
  if (axis.y > 0) car.speed += CAR.accel * dt;
  else if (axis.y < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerInput = axis.x;
  const steerFactor = Math.min(1, Math.abs(car.speed) / 10);
  car.yaw += steerInput * CAR.steerAngle * steerFactor * Math.sign(car.speed || 1) * dt * (handbrake ? 1.7 : 1);
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  car.x = Math.max(-WORLD.half + 6, Math.min(WORLD.half - 6, car.x));
  car.z = Math.max(-WORLD.half + 6, Math.min(WORLD.beachZ + 30, car.z));
  const pushed = game.city.pushOutOfBuildings(car.x, car.z, 2.4, game.city.colliders);
  if (pushed.x !== car.x || pushed.z !== car.z) {
    car.x = pushed.x;
    car.z = pushed.z;
    car.speed *= 0.45;
  }
  // Bump into traffic cars: both slow down, neither passes through.
  for (const other of game.traffic.cars) {
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 4.6 && d > 0.001) {
      const push = (4.6 - d) / 2;
      car.x -= (dx / d) * push;
      car.z -= (dz / d) * push;
      other.x += (dx / d) * push;
      other.z += (dz / d) * push;
      car.speed *= 0.7;
      other.speed *= 0.7;
    }
  }
  placeOnRoad(car.mesh, car.x, car.z, car.yaw);
  for (const wheel of car.mesh.userData.wheels) wheel.rotation.z -= (car.speed * dt) / 0.38;
  game.player.position.set(car.x, 0, car.z);
  game.player.yaw = car.yaw;
}
