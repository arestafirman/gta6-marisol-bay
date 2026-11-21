// The screenshot scenes behind ?shot=cover|drive|chase|mission. Each one
// plays the real game forward from a staged state for a fixed number of
// steps with the accelerator held, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { LOCATIONS } from './missions.js';

const STEP = 1 / 30;

/** Put the player in a car at (x, z) facing `yaw`, at `speed`. */
function stageInCar(game, x, z, yaw, speed) {
  const car = game.parkedCars.cars[0];
  game.parkedCars.cars = game.parkedCars.cars.filter((c) => c !== car);
  car.parked = false;
  car.speed = speed;
  car.x = x;
  car.z = z;
  car.yaw = yaw;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = yaw;
  // A vivid red coupe so the player's car reads at a glance.
  car.mesh.children[0].material.color.setHex(0xc22e1e);
  game.player.car = car;
  game.player.onFoot = false;
  game.player.mesh.visible = false;
  game.player.position.set(x, 0, z);
  game.player.yaw = yaw;
  game.player.camYaw = yaw;
  game.player.camPitch = 0.3;
  game.player.camDistIndex = 0;
  game.player.lastLookAt = -999;
}

/** After a chase has been driven, pull the hunters into the camera's view:
 *  chase cars come at the player head-on from up the road, the helicopter
 *  hangs high over the road ahead, clear of the rooftops. */
function frameChase(game) {
  const p = game.player;
  const speed = p.car ? p.car.speed : 0;
  game.police.chaseCars.slice(0, 2).forEach((car, i) => {
    const side = i === 0 ? -8 : 9;
    car.x = p.position.x + side;
    car.z = p.position.z + (i === 0 ? 16 : 28);
    car.yaw = p.yaw + Math.PI;
    car.speed = speed;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
  });
  if (game.police.heli) {
    // Low over the road ahead, left of the centred mission banner: the
    // camera pitches down, so a high helicopter flies out of the top of
    // the frame — this one stays in view.
    game.police.heli.position.set(p.position.x - 16, 13, p.position.z + 50);
    game.police.heli.rotation.y = Math.PI;
  }
}

/** Run the game forward `steps` fixed steps with W held. */
function driveForward(game, steps) {
  for (let i = 0; i < steps; i += 1) {
    game.input.keys.add('KeyW');
    game.update(STEP);
    game.input.keys.delete('KeyW');
    game.input.endFrame();
  }
}

/**
 * Set the game to the named scene (cover, drive, chase or mission) and
 * leave it staged; main.js paints it twice and sets window.__shotReady.
 */
export function stageShot(name, game) {
  game.state = 'play';
  game.hud.hideScreens();
  game.hud.showHud();
  game.audio.setRadio(false);

  if (name === 'drive') {
    // Coastal cruise: the z=240 boulevard past the docks, beach on the right.
    game.missions.startMission(2);
    stageInCar(game, -220, 240, Math.PI / 2, 30);
    driveForward(game, 75);
  } else if (name === 'chase') {
    // Full heat: 4 stars, chase cars closing in, helicopter overhead.
    game.missions.startMission(4);
    stageInCar(game, 0, -60, 0, 26);
    game.police.addWanted(2, game.time);
    driveForward(game, 120);
    frameChase(game);
  } else if (name === 'mission') {
    // On foot at the marina, rivals closing in — the Marina Job shootout.
    // The player starts south of the marina and walks north into it, so the
    // goto step completes and the kill step (with rivals) begins.
    game.player.position.set(0, 0, -236);
    game.player.yaw = Math.PI;
    game.player.camYaw = Math.PI;
    game.player.camPitch = 0.28;
    game.player.camDistIndex = 1;
    game.player.mesh.position.copy(game.player.position);
    game.player.mesh.rotation.y = Math.PI;
    game.missions.startMission(3);
    // Walk into the objective so the kill step starts and rivals spawn.
    for (let i = 0; i < 90 && game.missions.currentStep && game.missions.currentStep.type !== 'kill'; i += 1) {
      game.input.keys.add('KeyW');
      game.update(STEP);
      game.input.keys.delete('KeyW');
      game.input.endFrame();
    }
    for (let i = 0; i < 45; i += 1) {
      game.input.keys.add('KeyW');
      game.update(STEP);
      game.input.keys.delete('KeyW');
      game.input.endFrame();
    }
    // One shot for the muzzle flash in the frame.
    game.combat.shoot(game);
    game.updateCamera(10);
  } else {
    // Cover: driving south down Marina Row toward the pier beacon,
    // 3 stars, police behind, helicopter above, city all around.
    game.missions.startMission(1);
    stageInCar(game, 0, -140, 0.02, 18);
    game.police.addWanted(3, game.time);
    driveForward(game, 90);
    frameChase(game);
  }

  game.hud.update(game, 0);
  game.updateCamera(10);
  game.renderFrame();
  game.renderFrame();
  window.__shotReady = true;
}

export const SHOT_NAMES = ['cover', 'drive', 'chase', 'mission'];
export const SHOT_LOCATIONS = LOCATIONS;
