// Pedestrians: townsfolk who stroll the sidewalks, cross at corners, and
// run away when a fight, a gunshot or a speeding car gets too close.
import * as THREE from 'three';
import { WORLD } from './config.js';

const SHIRT_COLORS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xe8d84a, 0xd84ad8, 0xe8e8e8, 0x3a3a3a, 0xe88a2a];
const SKIN_COLORS = [0xe8b88a, 0xc98a5c, 0x8a5c3a, 0xf0c8a0];

export function makePedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick([0x2a3a5c, 0x3a3a3a, 0x5c4a2a]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
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

export class Pedestrians {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.peds = [];
    for (let i = 0; i < 26; i += 1) this.spawn();
  }

  spawn(near) {
    const p = near || this.city.randomStreetPoint(this.rng);
    const mesh = makePedMesh(this.rng);
    const ped = {
      mesh,
      x: p.x + this.rng.range(-6, 6),
      z: p.z + this.rng.range(-6, 6),
      yaw: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.2),
      walkPhase: this.rng.range(0, 6),
      state: 'walk',
      panic: 0,
      health: 100,
      alive: true,
    };
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.yaw;
    this.scene.add(mesh);
    this.peds.push(ped);
    return ped;
  }

  /** Scare everyone within `radius` of a point: they run away from it. */
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < radius) {
        ped.state = 'flee';
        ped.panic = 4;
        ped.yaw = Math.atan2(dx, dz);
      }
    }
  }

  nearest(x, z, maxDist, aliveOnly = true) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.peds) {
      if (aliveOnly && !ped.alive) continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  update(dt, playerPos) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      if (ped.panic > 0) {
        ped.panic -= dt;
        if (ped.panic <= 0) ped.state = 'walk';
      }
      const speed = ped.state === 'flee' ? 6.5 : ped.speed;
      ped.x += Math.sin(ped.yaw) * speed * dt;
      ped.z += Math.cos(ped.yaw) * speed * dt;
      ped.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      // Wander: at a corner, sometimes pick a new heading.
      const onGridX = Math.abs(((ped.x % WORLD.roadSpacing) + WORLD.roadSpacing) % WORLD.roadSpacing) < 2;
      const onGridZ = Math.abs(((ped.z % WORLD.roadSpacing) + WORLD.roadSpacing) % WORLD.roadSpacing) < 2;
      if (onGridX && onGridZ && this.rng.chance(0.02)) {
        ped.yaw = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      // Stay in town, off the sea.
      if (ped.x < -WORLD.half + 8 || ped.x > WORLD.half - 8) ped.yaw = Math.PI - ped.yaw;
      if (ped.z < -WORLD.half + 8 || ped.z > WORLD.beachZ + 20) ped.yaw = -ped.yaw;
      ped.x = Math.max(-WORLD.half + 6, Math.min(WORLD.half - 6, ped.x));
      ped.z = Math.max(-WORLD.half + 6, Math.min(WORLD.beachZ + 26, ped.z));
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.yaw;
      // Too far from the player: respawn nearby to keep the streets alive.
      const dx = ped.x - playerPos.x;
      const dz = ped.z - playerPos.z;
      if (dx * dx + dz * dz > 220 * 220) {
        ped.x = playerPos.x + this.rng.range(-70, 70);
        ped.z = playerPos.z + this.rng.range(-70, 70);
      }
    }
  }
}
