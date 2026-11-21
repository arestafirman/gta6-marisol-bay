// Procedural Marisol Bay: street grid, district buildings with lit windows,
// beach, sea, pier, palms, lamps and a golden-hour sun. All geometry is
// generated from the seeded RNG, so the city is identical for a given seed.
import * as THREE from 'three';
import { WORLD, DISTRICTS, COLORS } from './config.js';

/** Canvas texture of a facade: dark wall with many small warm lit windows. */
function makeFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c5348';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 20; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const lit = Math.random() < 0.5;
      ctx.fillStyle = lit ? '#ffd98a' : '#191a20';
      ctx.fillRect(6 + col * 25, 6 + row * 12, 13, 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // One shared texture: a fixed repeat keeps every facade's windows the same size.
  tex.repeat.set(3, 4);
  return tex;
}

/** Canvas texture of an asphalt strip with a dashed centre line. */
function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2e2e33';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#8f8f8f';
  for (let y = 0; y < 256; y += 64) ctx.fillRect(30, y + 8, 4, 20);
  ctx.fillStyle = '#e8b23a';
  ctx.fillRect(2, 0, 2, 256);
  ctx.fillRect(60, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 10);
  return tex;
}

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d;
  }
  return DISTRICTS[0];
}

function pushOutOfBuildings(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        x = c.maxX + radius;
      } else {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      }
    }
  }
  return { x, z };
}

export function buildCity(scene, rng) {
  const colliders = [];
  const facadeTex = makeFacadeTexture();
  const roadTex = makeRoadTexture();
  const materials = new Map();
  const materialFor = (color) => {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshLambertMaterial({ color, map: facadeTex }));
    }
    return materials.get(color);
  };

  // Golden-hour sky, fog and sun.
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, 180, 720);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x5c4a3a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.1);
  sun.position.set(-260, 90, -120);
  sun.castShadow = false;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7a86c8, 0.35);
  fill.position.set(200, 120, 200);
  scene.add(fill);

  // Ground, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x7d7460 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, 64),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, WORLD.beachZ + 18);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 400, 420),
    new THREE.MeshLambertMaterial({ color: COLORS.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, WORLD.waterZ + 210);
  scene.add(sea);

  // Streets: sidewalk strips, then asphalt with dashes.
  const streetCoords = [];
  for (let i = -5; i <= 5; i += 1) streetCoords.push(i * WORLD.roadSpacing);
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of streetCoords) {
    for (const alongX of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.roadWidth + 6), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.rotation.z = alongX ? 0 : Math.PI / 2;
      walk.position.set(alongX ? 0 : c, 0.01, alongX ? c : 0);
      scene.add(walk);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = alongX ? 0 : Math.PI / 2;
      road.position.set(alongX ? 0 : c, 0.03, alongX ? c : 0);
      scene.add(road);
    }
  }

  // Buildings, one or two per block, with a roof cap and a collider each.
  // Block centres sit midway between streets (streets at -300 + 60k, so
  // blocks at -270 + 60k) and footprints stay inside the block, so no
  // building ever intrudes into a street.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
  const blockMin = -270; // first midpoint between streets (-300 and -240)
  for (let bx = 0; bx < 10; bx += 1) {
    for (let bz = 0; bz < 10; bz += 1) {
      const cx = blockMin + bx * WORLD.roadSpacing;
      const cz = blockMin + bz * WORLD.roadSpacing;
      if (cz > WORLD.beachZ - 40) continue;
      const district = districtAt(cx, cz);
      const count = rng.chance(0.45) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(14, 24);
        const d = rng.range(14, 24);
        const h = rng.range(9, district.name === 'The Strip' ? 46 : 30);
        const ox = count === 1 ? 0 : (k === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (k === 0 ? -7 : 7);
        const x = cx + ox + rng.range(-3, 3);
        const z = cz + oz + rng.range(-3, 3);
        const color = rng.pick(district.palette);
        const mesh = new THREE.Mesh(boxGeo, materialFor(color));
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        scene.add(mesh);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        // A few rooftops carry a glowing sign box.
        if (rng.chance(0.22)) {
          const sign = new THREE.Mesh(
            boxGeo,
            new THREE.MeshBasicMaterial({ color: rng.pick([0xff5c8a, 0x37e0c8, 0xffc23a, 0x7ab8ff]) }),
          );
          sign.scale.set(w * 0.5, 1.6, 1);
          sign.position.set(x, h + 1.6, z);
          scene.add(sign);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Landmark: the Bay Tower, tallest in town, at the Strip's edge.
  const tower = new THREE.Mesh(boxGeo, materialFor(0x3a4a6b));
  tower.scale.set(26, 78, 26);
  tower.position.set(-30, 39, -30);
  scene.add(tower);
  const beaconTop = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc23a }),
  );
  beaconTop.position.set(-30, 79, -30);
  scene.add(beaconTop);
  colliders.push({ minX: -43, maxX: -17, minZ: -43, maxZ: -17 });

  // Pier: wooden deck on posts, out into the sea, with lamps.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const deck = new THREE.Mesh(boxGeo, pierMat);
  deck.scale.set(14, 1, 120);
  deck.position.set(WORLD.pierX, 1.2, WORLD.beachZ + 60);
  scene.add(deck);
  const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 3, 6);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5c4632 });
  for (let z = WORLD.beachZ + 8; z < WORLD.beachZ + 118; z += 14) {
    for (const x of [-6, 6]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 0, z);
      scene.add(post);
    }
  }

  // Palms along the beach and a few on the boulevards.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
  const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  const palmSpots = [];
  for (let x = -300; x <= 300; x += 24) palmSpots.push([x + rng.range(-4, 4), WORLD.beachZ + 6 + rng.range(0, 8)]);
  for (let i = 0; i < 26; i += 1) {
    palmSpots.push([rng.range(-300, 300), rng.pick(streetCoords) + 9]);
  }
  for (const [x, z] of palmSpots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    scene.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 7.6, z);
    leaves.scale.y = 0.55;
    scene.add(leaves);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  // Street lamps along the main boulevards.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  for (const c of [-120, 0, 120]) {
    for (let t = -270; t <= 270; t += 60) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(c + 8, 3, t);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      lamp.position.set(c + 8, 6.2, t);
      scene.add(lamp);
    }
  }

  // Objective beacon: a glowing pillar the player drives toward.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 5, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  arrow.position.y = 62;
  arrow.rotation.x = Math.PI;
  beacon.add(arrow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.25, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  return {
    colliders,
    streetCoords,
    beacon,
    districtAt,
    pushOutOfBuildings,
    randomStreetPoint(rng2) {
      const c = rng2.pick(streetCoords);
      const t = rng2.range(-270, 270);
      return rng2.chance(0.5) ? { x: t, z: c } : { x: c, z: t };
    },
  };
}
