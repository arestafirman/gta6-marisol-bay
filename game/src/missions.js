// The story: 8 missions for Dario Cole and his crew in Marisol Bay.
// Each mission is a chain of steps — goto, steal, kill, escape, race —
// with a beacon in the world and a line on the HUD for the current step.
import { MISSION_REWARD } from './config.js';

export const LOCATIONS = {
  maraOffice: { x: -200, z: -200, label: "Mara's office, Old Harbor" },
  pierEnd: { x: 0, z: 392, label: 'Pier end, Marisol Bay' },
  titoGarage: { x: 200, z: 240, label: "Tito's garage, Industrial Docks" },
  marina: { x: 0, z: -260, label: 'Marina Row' },
  casino: { x: -200, z: 60, label: 'The Strip casino' },
  safehouse: { x: 200, z: 100, label: 'Safehouse, Coral Hills' },
  bank: { x: -160, z: 100, label: 'Bay National Bank' },
  docks: { x: 280, z: 240, label: 'Industrial Docks' },
  hospital: { x: -260, z: -260, label: 'Bay General Hospital' },
};

export const MISSIONS = [
  {
    title: 'The Long Way Home',
    giver: 'Mara Voss',
    briefing: 'Dario is back in the bay. Mara needs a driver she can trust — get to her office in Old Harbor.',
    steps: [{ type: 'goto', at: LOCATIONS.maraOffice, label: 'Drive to Mara\'s office' }],
  },
  {
    title: 'Harbor Lights',
    giver: 'Mara Voss',
    briefing: 'A package for the harbor master. No questions, no stops — take it to the end of the pier.',
    steps: [{ type: 'goto', at: LOCATIONS.pierEnd, label: 'Deliver the package to the pier' }],
  },
  {
    title: 'Hot Wire',
    giver: 'Tito Ramos',
    briefing: 'Tito needs a gold coupe for a client. It is parked on Marina Row — take it, then bring it to his garage.',
    steps: [
      { type: 'steal', label: 'Steal the gold coupe' },
      { type: 'goto', at: LOCATIONS.titoGarage, label: 'Deliver the coupe to Tito\'s garage' },
    ],
  },
  {
    title: 'The Marina Job',
    giver: 'Juno Park',
    briefing: 'Rivals are moving on Juno\'s marina deal. Clear them out, then get back to the safehouse.',
    steps: [
      { type: 'goto', at: LOCATIONS.marina, label: 'Get to the marina' },
      { type: 'kill', count: 4, at: LOCATIONS.marina, label: 'Deal with the rivals (4)' },
      { type: 'goto', at: LOCATIONS.safehouse, label: 'Get back to the safehouse' },
    ],
  },
  {
    title: 'Heat Wave',
    giver: 'Mara Voss',
    briefing: 'The casino job went loud. The whole bay is looking for you — reach the safehouse and go quiet.',
    steps: [
      { type: 'goto', at: LOCATIONS.casino, label: 'Pick up the casino take', wanted: 2 },
      { type: 'goto', at: LOCATIONS.safehouse, label: 'Reach the safehouse' },
      { type: 'escape', label: 'Lose the police' },
    ],
  },
  {
    title: 'Ghost Racer',
    giver: 'Tito Ramos',
    briefing: 'A ghost car is running the bay at night and nobody can catch it. Beat its route before the clock runs out.',
    steps: [{ type: 'race', checkpoints: [
      { x: -240, z: -240 }, { x: 240, z: -240 }, { x: 240, z: 240 }, { x: -240, z: 240 }, { x: 0, z: 0 },
    ], time: 95, label: 'Race the ghost route' }],
  },
  {
    title: 'Dockside',
    giver: 'Mara Voss',
    briefing: 'Juno is pinned down at the docks. Get her out — then drive her home in one piece.',
    steps: [
      { type: 'goto', at: LOCATIONS.docks, label: 'Get to the docks' },
      { type: 'kill', count: 5, at: LOCATIONS.docks, label: 'Clear the dock crew (5)' },
      { type: 'goto', at: LOCATIONS.safehouse, label: 'Drive Juno to the safehouse' },
    ],
  },
  {
    title: 'Golden Hour',
    giver: 'Mara Voss',
    briefing: 'One last job: the Bay National Bank at golden hour. Hit it, then vanish down the pier.',
    steps: [
      { type: 'goto', at: LOCATIONS.bank, label: 'Get to the bank' },
      { type: 'kill', count: 6, at: LOCATIONS.bank, label: 'Hold off the guards (6)' },
      { type: 'goto', at: LOCATIONS.pierEnd, label: 'Escape to the pier', wanted: 4 },
    ],
  },
];

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.stepIndex = 0;
    this.active = false;
    this.raceTimeLeft = 0;
    this.raceCheckpoint = 0;
    this.targetCar = null;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get currentStep() {
    const mission = this.current;
    return mission ? mission.steps[this.stepIndex] : null;
  }

  startMission(index) {
    this.index = index;
    this.stepIndex = 0;
    this.active = true;
    this.raceCheckpoint = 0;
    const mission = this.current;
    if (!mission) {
      this.active = false;
      return;
    }
    this.game.hud.showBanner(mission.title, `${mission.giver}: ${mission.briefing}`);
    this.beginStep();
  }

  beginStep() {
    const step = this.currentStep;
    if (!step) return;
    const game = this.game;
    if (step.type === 'steal') {
      // The gold coupe is the mission's target car.
      const car = game.parkedCars.cars[2];
      this.targetCar = car;
      car.isTarget = true;
      game.city.beacon.visible = true;
      game.city.beacon.position.set(car.x, 0, car.z);
    } else if (step.type === 'kill') {
      game.combat.spawnEnemies(step.at.x, step.at.z, step.count);
      game.city.beacon.visible = true;
      game.city.beacon.position.set(step.at.x, 0, step.at.z);
    } else if (step.type === 'goto') {
      game.city.beacon.visible = true;
      game.city.beacon.position.set(step.at.x, 0, step.at.z);
      if (step.wanted) game.police.addWanted(step.wanted, game.time);
    } else if (step.type === 'race') {
      this.raceTimeLeft = step.time;
      this.raceCheckpoint = 0;
      game.city.beacon.visible = true;
      const cp = step.checkpoints[0];
      game.city.beacon.position.set(cp.x, 0, cp.z);
    } else if (step.type === 'escape') {
      game.city.beacon.visible = false;
    }
    game.hud.setObjective(this.objectiveText());
  }

  objectiveText() {
    const mission = this.current;
    const step = this.currentStep;
    if (!mission || !step) return 'Free roam — explore Marisol Bay';
    let extra = '';
    if (step.type === 'kill') extra = ` (${this.game.combat.killsThisStep}/${step.count})`;
    if (step.type === 'race') extra = ` — ${Math.ceil(this.raceTimeLeft)}s left`;
    return `${mission.title}: ${step.label}${extra}`;
  }

  markerPosition() {
    const step = this.currentStep;
    if (!step) return null;
    if (step.type === 'steal' && this.targetCar) return { x: this.targetCar.x, z: this.targetCar.z };
    if (step.type === 'race') return step.checkpoints[this.raceCheckpoint];
    if (step.type === 'goto' || step.type === 'kill') return step.at;
    return null;
  }

  distanceToMarker() {
    const m = this.markerPosition();
    if (!m) return 0;
    const p = this.game.player.position;
    return Math.sqrt((m.x - p.x) ** 2 + (m.z - p.z) ** 2);
  }

  advanceStep() {
    this.stepIndex += 1;
    if (this.stepIndex >= this.current.steps.length) {
      this.completeMission();
      return;
    }
    this.beginStep();
    this.game.audio.playPickup();
  }

  failStep(reason) {
    this.game.hud.showMessage(reason, 3);
    this.restartMission();
  }

  restartMission() {
    this.game.combat.clearEnemies();
    this.game.city.beacon.visible = false;
    this.startMission(this.index);
  }

  completeMission() {
    const mission = this.current;
    const reward = MISSION_REWARD[this.index] || 500;
    this.game.cash += reward;
    this.game.completed += 1;
    this.game.hud.showBanner('Mission complete', `${mission.title} — $${reward} earned`);
    this.game.audio.playMissionComplete();
    this.game.city.beacon.visible = false;
    this.active = false;
    this.index += 1;
    if (this.index >= MISSIONS.length) {
      this.game.onStoryComplete();
      return;
    }
    this.game.saveProgress();
    this.startMission(this.index);
  }

  update(dt) {
    if (!this.active) return;
    const step = this.currentStep;
    if (!step) return;
    const game = this.game;
    if (step.type === 'goto') {
      if (this.distanceToMarker() < 8) this.advanceStep();
    } else if (step.type === 'steal') {
      if (!game.player.onFoot && game.player.car === this.targetCar) this.advanceStep();
    } else if (step.type === 'kill') {
      if (game.combat.killsThisStep >= step.count) this.advanceStep();
    } else if (step.type === 'escape') {
      if (game.police.wanted === 0) this.advanceStep();
    } else if (step.type === 'race') {
      this.raceTimeLeft -= dt;
      const cp = step.checkpoints[this.raceCheckpoint];
      const p = game.player.position;
      const d = Math.sqrt((cp.x - p.x) ** 2 + (cp.z - p.z) ** 2);
      if (d < 10) {
        this.raceCheckpoint += 1;
        game.audio.playPickup();
        if (this.raceCheckpoint >= step.checkpoints.length) {
          this.advanceStep();
          return;
        }
        const next = step.checkpoints[this.raceCheckpoint];
        game.city.beacon.position.set(next.x, 0, next.z);
      }
      if (this.raceTimeLeft <= 0) {
        this.failStep('Out of time — the ghost got away. Restarting the race.');
        return;
      }
    }
    game.hud.setObjective(this.objectiveText());
  }
}
