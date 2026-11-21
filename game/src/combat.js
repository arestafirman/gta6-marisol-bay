// Combat: fists and a pistol on foot. Punching hits the nearest person in
// range; shooting is a hitscan ray from the camera with a muzzle flash.
// Enemies chase and shoot back; killing a bystander raises the wanted level.
import * as THREE from 'three';
import { PLAYER, WANTED } from './config.js';

function makeEnemyMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.75, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2e }),
  );
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98a5c }),
  );
  head.position.y = 1.62;
  group.add(head);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xd81e1e }),
  );
  band.position.y = 1.78;
  group.add(band);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.3, 1.1, 0.3);
  group.add(gun);
  const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(0.14, 0.33, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(-0.14, 0.33, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export class Combat {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.enemies = [];
    this.killsThisStep = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.flashTimer = 0;
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9 }),
    );
    this.flash.visible = false;
    scene.add(this.flash);
  }

  spawnEnemies(x, z, count) {
    this.clearEnemies();
    this.killsThisStep = 0;
    for (let i = 0; i < count; i += 1) {
      const mesh = makeEnemyMesh();
      const ex = x + this.rng.range(-14, 14);
      const ez = z + this.rng.range(-14, 14);
      mesh.position.set(ex, 0, ez);
      this.scene.add(mesh);
      this.enemies.push({
        mesh,
        x: ex,
        z: ez,
        yaw: 0,
        health: 100,
        alive: true,
        shootTimer: this.rng.range(0.6, 1.6),
        walkPhase: this.rng.range(0, 6),
        deadTimer: 0,
      });
    }
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.mesh);
    this.enemies = [];
    this.killsThisStep = 0;
  }

  /** Damage one person; returns true when it died. */
  damagePerson(target, amount, isEnemy, game) {
    target.health -= amount;
    if (target.health > 0) return false;
    target.alive = false;
    if (isEnemy) {
      this.killsThisStep += 1;
      target.deadTimer = 4;
      target.mesh.rotation.x = -Math.PI / 2;
      target.mesh.position.y = 0.3;
    } else {
      // A bystander went down: the city notices.
      game.police.addWanted(WANTED.killPed, game.time);
      target.mesh.visible = false;
    }
    return true;
  }

  punch(game) {
    if (this.punchCooldown > 0 || !game.player.onFoot) return;
    this.punchCooldown = PLAYER.punchCooldown;
    const p = game.player.position;
    const fx = Math.sin(game.player.yaw);
    const fz = Math.cos(game.player.yaw);
    game.audio.playPunch();
    const tryHit = (target, isEnemy) => {
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > PLAYER.punchRange) return false;
      if ((dx * fx + dz * fz) / (d || 1) < 0.2) return false;
      this.damagePerson(target, PLAYER.punchDamage, isEnemy, game);
      game.peds.scare(p.x, p.z, 18);
      game.police.addWanted(WANTED.punch, game.time);
      return true;
    };
    for (const enemy of this.enemies) {
      if (enemy.alive && tryHit(enemy, true)) return;
    }
    const ped = game.peds.nearest(p.x, p.z, PLAYER.punchRange);
    if (ped) tryHit(ped, false);
  }

  /** Hitscan shot from the camera: nearest enemy or pedestrian near the
   *  crosshair line takes the hit. */
  shoot(game) {
    if (this.shootCooldown > 0 || !game.player.onFoot) return;
    this.shootCooldown = 0.28;
    const camera = game.camera;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const muzzle = game.player.position.clone().add(new THREE.Vector3(Math.sin(game.player.yaw) * 1.1, 1.45, Math.cos(game.player.yaw) * 1.1));
    this.flash.position.copy(muzzle);
    this.flash.visible = true;
    this.flashTimer = 0.07;
    game.audio.playShot();
    game.peds.scare(game.player.position.x, game.player.position.z, 30);
    game.police.addWanted(WANTED.shoot, game.time);

    let best = null;
    let bestAlong = 70;
    const consider = (target, isEnemy) => {
      if (!target.alive) return;
      const to = new THREE.Vector3(target.x - origin.x, 1.2 - origin.y, target.z - origin.z);
      const along = to.dot(dir);
      if (along < 1 || along > 70) return;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp > 1.6) return;
      if (along < bestAlong) {
        bestAlong = along;
        best = { target, isEnemy };
      }
    };
    for (const enemy of this.enemies) consider(enemy, true);
    for (const ped of game.peds.peds) consider(ped, false);
    if (best) {
      this.damagePerson(best.target, 34, best.isEnemy, game);
      game.hud.flashDamage();
    }
  }

  update(dt, game) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    const p = game.player.position;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        if (enemy.deadTimer > 0) {
          enemy.deadTimer -= dt;
          if (enemy.deadTimer <= 0) {
            this.scene.remove(enemy.mesh);
            enemy.mesh = null;
          }
        }
        continue;
      }
      const dx = p.x - enemy.x;
      const dz = p.z - enemy.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      enemy.yaw = Math.atan2(dx, dz);
      enemy.mesh.rotation.y = enemy.yaw;
      if (dist > 9) {
        const speed = 4.2;
        enemy.x += Math.sin(enemy.yaw) * speed * dt;
        enemy.z += Math.cos(enemy.yaw) * speed * dt;
        enemy.walkPhase += dt * speed * 3;
        enemy.mesh.userData.legL.rotation.x = Math.sin(enemy.walkPhase) * 0.5;
        enemy.mesh.userData.legR.rotation.x = -Math.sin(enemy.walkPhase) * 0.5;
      }
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = 1.5;
        if (dist < 46 && game.player.onFoot) {
          if (this.rng.float() < 0.38) {
            game.damagePlayer(7);
            game.hud.flashDamage();
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.mesh !== null);
  }
}
