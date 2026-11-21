// Marisol Bay — shared constants for the whole game.
// The city is a hand-tuned grid: streets every 60 units, six named districts,
// a beach and a pier on the south edge, golden-hour light from the west.
export const WORLD = {
  half: 320,
  roadSpacing: 60,
  roadWidth: 12,
  beachZ: 292,
  waterZ: 326,
  pierX: 0,
  seed: 1,
};

export const DISTRICTS = [
  { name: 'Old Harbor', minX: -320, maxX: -120, minZ: -320, maxZ: -60, palette: [0x8a6f5c, 0x9c7f66, 0x7a5f4e] },
  { name: 'Marina Row', minX: -120, maxX: 120, minZ: -320, maxZ: -120, palette: [0x5c7a8a, 0x6b8a99, 0x4e6a78] },
  { name: 'Palm Heights', minX: 120, maxX: 320, minZ: -320, maxZ: -60, palette: [0xd8c49a, 0xc9b184, 0xe2d0a8] },
  { name: 'The Strip', minX: -320, maxX: -60, minZ: -60, maxZ: 180, palette: [0xb85c7a, 0xc96a8a, 0xa84e68] },
  { name: 'Coral Hills', minX: -60, maxX: 320, minZ: -60, maxZ: 180, palette: [0x7a9c6b, 0x8aad7a, 0x6b8a5c] },
  { name: 'Industrial Docks', minX: -320, maxX: 320, minZ: 180, maxZ: 292, palette: [0x6b6f75, 0x7a7e85, 0x5c6066] },
];

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11.5,
  radius: 0.7,
  height: 1.8,
  maxHealth: 100,
  punchRange: 2.2,
  punchDamage: 25,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 24,
  brake: 38,
  reverseAccel: 12,
  maxSpeed: 44,
  maxReverse: 13,
  steerAngle: 0.55,
  turnGrip: 5.5,
  length: 4.4,
  width: 2.0,
};

export const WANTED = {
  max: 5,
  decayDelay: 18,
  decayRate: 0.2,
  stealCar: 1,
  punch: 1,
  shoot: 2,
  killPed: 2,
};

export const COLORS = {
  sky: 0xff9e57,
  fog: 0xf2a35e,
  sun: 0xffb36b,
  ground: 0x8a7a5e,
  asphalt: 0x3a3a40,
  sidewalk: 0x9a938a,
  sand: 0xe8cf9a,
  sea: 0x2e7f9e,
  police: 0x1e4fd8,
  taxi: 0xf2c200,
};

export const RADIO_STATIONS = [
  { name: 'Bay FM 88', style: 'synthwave' },
  { name: 'Onda 101', style: 'latin' },
  { name: 'Bay Talk', style: 'talk' },
];

export const SAVE_KEY = 'marisol-bay-save-v1';
export const START_CASH = 250;
export const MISSION_REWARD = [400, 600, 800, 1200, 1500, 1800, 2200, 5000];
