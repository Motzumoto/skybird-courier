// Tuning for the whole sortie: one place, so the flight model, the missions and the HUD agree.

export const WORLD = {
  size: 5200,          // metres across the archipelago
  seaLevel: 0,
  grid: 400,           // heightfield resolution per side
  maxHeight: 620,
  fogNear: 1500,
  fogFar: 9600,
  sunElevation: 0.075, // last light, sun hard on the water
};

export const FLIGHT = {
  cruise: 74,          // m/s the airframe settles at when level, full throttle
  idle: 26,
  throttleRate: 0.62,
  pitchRate: 1.15,
  rollRate: 1.95,
  yawRate: 0.5,
  authority: 0.062,    // control authority per m/s of airspeed
  gravityBleed: 11.5,  // speed gained/lost with pitch
  stallSpeed: 33,
  flapDrag: 0.72,
  fuelBurn: 0.0052,    // per second at full throttle
  fuelBurnIdle: 0.0012,
  maxBank: 1.42,
  groundFriction: 0.62,
};

export const PLAY = {
  startFuel: 1,
  hullValue: 100,
  crashImpact: 16,     // m/s of sink that breaks an airframe
  ringRadius: 46,
  ringValue: 1,
  flakRange: 900,
  birdCount: 64,
  boatCount: 14,
  lodFar: 3400,
};

export const MISSION_KINDS = ['courier', 'survey', 'drop', 'medevac'];

export const CAMERA = {
  chaseBack: 17,
  chaseUp: 4.4,
  chaseLag: 0.09,
  cockpitUp: 1.02,
  cockpitForward: 3.35,
  fov: 62,
};
