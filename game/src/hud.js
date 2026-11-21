// HUD: health, cash, wanted stars, minimap, objective, speed and radio —
// all DOM on top of the WebGL canvas — plus the title, pause, busted,
// wasted and story-complete screens.
import { DISTRICTS, WORLD } from './config.js';

function el(tag, id, parent, text) {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function button(parent, text, onClick) {
  const b = el('button', '', parent, text);
  b.className = 'menu-btn';
  b.addEventListener('click', onClick);
  return b;
}

export class HUD {
  constructor(game, callbacks) {
    this.game = game;
    this.callbacks = callbacks;
    this.messageTimer = 0;
    this.bannerTimer = 0;
    this.districtName = '';

    const hud = el('div', 'hud', document.body);
    this.root = hud;

    const topLeft = el('div', 'hud-topleft', hud);
    this.healthWrap = el('div', 'health-wrap', topLeft);
    this.healthBar = el('div', 'health-bar', this.healthWrap);
    this.cashEl = el('div', 'cash', topLeft, '$250');
    this.districtEl = el('div', 'district', topLeft, 'Marisol Bay');

    const topRight = el('div', 'hud-topright', hud);
    this.starsEl = el('div', 'wanted', topRight);
    this.starSpans = [];
    for (let i = 0; i < 5; i += 1) {
      const star = el('span', '', this.starsEl, '★');
      star.className = 'star';
      this.starSpans.push(star);
    }

    this.bannerEl = el('div', 'banner', hud);
    this.bannerTitle = el('div', 'banner-title', this.bannerEl);
    this.bannerTitle.className = 'banner-title';
    this.bannerSub = el('div', 'banner-sub', this.bannerEl);
    this.bannerSub.className = 'banner-sub';

    this.toastEl = el('div', 'toast', hud);
    this.objectiveEl = el('div', 'objective', hud);
    this.objectiveText = el('span', 'objective-text', this.objectiveEl);
    this.objectiveDist = el('span', 'objective-dist', this.objectiveEl);

    const bottomRight = el('div', 'hud-bottomright', hud);
    this.speedEl = el('div', 'speed', bottomRight, '0 mph');
    this.radioEl = el('div', 'radio', bottomRight, 'Bay FM 88');
    el('div', 'hint', bottomRight, 'WASD drive/walk · E enter car · F punch · Click shoot · M radio · C camera · R restart mission · Esc pause');

    const mapWrap = el('div', 'minimap-wrap', hud);
    mapWrap.className = 'minimap-wrap';
    this.mapCanvas = el('canvas', 'minimap', mapWrap);
    this.mapCanvas.width = 190;
    this.mapCanvas.height = 190;
    this.mapCtx = this.mapCanvas.getContext('2d');

    this.damageEl = el('div', 'damage-flash', document.body);
    this.crosshairEl = el('div', 'crosshair', document.body);

    // Screens.
    this.titleScreen = this.buildScreen('screen-title', 'MARISOL BAY', 'A sun-soaked open-world crime story. Dario Cole is back in the bay — and the bay never forgets a debt.');
    const titleBtns = el('div', '', this.titleScreen);
    titleBtns.className = 'btn-row';
    this.continueBtn = button(titleBtns, 'Continue', () => callbacks.onContinue());
    button(titleBtns, 'New Game', () => callbacks.onStart());
    el('div', 'controls', this.titleScreen, 'WASD move / drive · Mouse look · E enter or steal a car · F punch · Click to shoot · Space handbrake · M radio · C camera · R restart mission · Esc pause');

    this.pauseScreen = this.buildScreen('screen-pause', 'PAUSED', 'Take a breath. The bay will wait.');
    const pauseBtns = el('div', '', this.pauseScreen);
    pauseBtns.className = 'btn-row';
    button(pauseBtns, 'Resume', () => callbacks.onResume());
    button(pauseBtns, 'Save Game', () => callbacks.onSave());
    button(pauseBtns, 'Restart Mission', () => callbacks.onRestartMission());
    button(pauseBtns, 'Quit to Title', () => callbacks.onQuit());

    this.bustedScreen = this.buildScreen('screen-busted', 'BUSTED', '');
    this.bustedText = el('div', 'screen-sub', this.bustedScreen);
    const bustedBtns = el('div', '', this.bustedScreen);
    bustedBtns.className = 'btn-row';
    button(bustedBtns, 'Get Out — Lose Bail', () => callbacks.onRespawn());

    this.wastedScreen = this.buildScreen('screen-wasted', 'WASTED', '');
    this.wastedText = el('div', 'screen-sub', this.wastedScreen);
    const wastedBtns = el('div', '', this.wastedScreen);
    wastedBtns.className = 'btn-row';
    button(wastedBtns, 'Wake Up at Bay General', () => callbacks.onRespawn());

    this.completeScreen = this.buildScreen('screen-complete', 'GOLDEN HOUR', 'All eight missions done. The bay is yours, Dario.');
    this.completeText = el('div', 'screen-sub', this.completeScreen);
    const completeBtns = el('div', '', this.completeScreen);
    completeBtns.className = 'btn-row';
    button(completeBtns, 'Keep Playing', () => callbacks.onKeepPlaying());
  }

  buildScreen(id, title, sub) {
    const screen = el('div', id, document.body);
    screen.className = 'screen';
    el('h1', '', screen, title);
    if (sub) el('div', 'screen-sub', screen, sub);
    return screen;
  }

  hideScreens() {
    for (const s of [this.titleScreen, this.pauseScreen, this.bustedScreen, this.wastedScreen, this.completeScreen]) {
      s.style.display = 'none';
    }
  }

  showTitle(hasSave) {
    this.hideScreens();
    this.continueBtn.style.display = hasSave ? '' : 'none';
    this.titleScreen.style.display = 'flex';
    this.root.style.display = 'none';
  }

  showPause() {
    this.hideScreens();
    this.pauseScreen.style.display = 'flex';
  }

  showBusted(lostCash) {
    this.hideScreens();
    this.bustedText.textContent = `The Marisol Bay PD caught up with you. Bail cost $${lostCash}.`;
    this.bustedScreen.style.display = 'flex';
  }

  showWasted(lostCash) {
    this.hideScreens();
    this.wastedText.textContent = `You woke up at Bay General, $${lostCash} lighter. The crew is waiting.`;
    this.wastedScreen.style.display = 'flex';
  }

  showComplete(cash, missionsDone) {
    this.hideScreens();
    this.completeText.textContent = `Missions completed: ${missionsDone}/8 · Cash: $${cash}`;
    this.completeScreen.style.display = 'flex';
  }

  showHud() {
    this.root.style.display = 'block';
  }

  setObjective(text) {
    this.objectiveText.textContent = text;
  }

  showMessage(text, seconds = 3) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.messageTimer = seconds;
  }

  showBanner(title, sub) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.bannerEl.style.opacity = '1';
    this.bannerTimer = 4.5;
  }

  flashDamage() {
    this.damageEl.style.opacity = '0.55';
    window.setTimeout(() => {
      this.damageEl.style.opacity = '0';
    }, 120);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 190;
    const scale = S / (WORLD.half * 2 + 90);
    const toX = (x) => (x + WORLD.half + 45) * scale;
    const toY = (z) => (z + WORLD.half + 45) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, S, S);
    // Sea and sand at the south edge.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, toY(WORLD.waterZ), S, S - toY(WORLD.waterZ));
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(0, toY(WORLD.beachZ), S, toY(WORLD.waterZ) - toY(WORLD.beachZ));
    // District blocks.
    ctx.fillStyle = '#3a3f4a';
    for (const d of DISTRICTS) {
      ctx.fillRect(toX(d.minX + 6), toY(d.minZ + 6), (d.maxX - d.minX - 12) * scale, (d.maxZ - d.minZ - 12) * scale);
    }
    // Roads.
    ctx.strokeStyle = '#8a8f9a';
    ctx.lineWidth = 2;
    for (const c of game.city.streetCoords) {
      ctx.beginPath();
      ctx.moveTo(toX(-WORLD.half), toY(c));
      ctx.lineTo(toX(WORLD.half), toY(c));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(c), toY(-WORLD.half));
      ctx.lineTo(toX(c), toY(WORLD.half));
      ctx.stroke();
    }
    // Objective marker.
    const marker = game.missions.markerPosition();
    if (marker) {
      const pulse = 5 + Math.sin(game.time * 5) * 2;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(toX(marker.x), toY(marker.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◆', toX(marker.x), toY(marker.z) + 4);
    }
    // Traffic, police, enemies, target car.
    const dot = (x, z, color, r = 2) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const car of game.traffic.cars) dot(car.x, car.z, '#e8e8e8', 2);
    for (const car of game.parkedCars.cars) dot(car.x, car.z, car.isTarget ? '#ffd23a' : '#9a9a9a', car.isTarget ? 3.5 : 1.6);
    for (const enemy of game.combat.enemies) {
      if (enemy.alive) dot(enemy.x, enemy.z, '#ff3a3a', 2.5);
    }
    for (const car of game.police.chaseCars) dot(car.x, car.z, '#3a7aff', 3);
    if (game.police.heli) {
      ctx.strokeStyle = '#3a7aff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(toX(game.police.heli.position.x), toY(game.police.heli.position.z), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Player arrow.
    const p = game.player.position;
    const yaw = game.player.yaw;
    ctx.save();
    ctx.translate(toX(p.x), toY(p.z));
    ctx.rotate(-yaw + Math.PI);
    ctx.fillStyle = '#37e0c8';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }

  update(game, dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.toastEl.style.opacity = '0';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.style.opacity = '0';
    }
    const healthPct = Math.max(0, Math.round((game.player.health / 100) * 100));
    this.healthBar.style.width = `${healthPct}%`;
    this.healthBar.style.background = healthPct > 50 ? '#37c86a' : healthPct > 25 ? '#e8a23a' : '#d81e1e';
    this.cashEl.textContent = `$${game.cash}`;
    const district = game.city.districtAt(game.player.position.x, game.player.position.z);
    if (district.name !== this.districtName) {
      this.districtName = district.name;
      this.districtEl.textContent = district.name;
    }
    const stars = Math.ceil(game.police.wanted);
    this.starSpans.forEach((span, i) => {
      span.classList.toggle('lit', i < stars);
    });
    const speed = game.player.onFoot
      ? Math.round(game.player.speed * 2.2)
      : Math.round(Math.abs(game.player.car ? game.player.car.speed : 0) * 2.2);
    this.speedEl.textContent = game.player.onFoot ? 'On foot' : `${speed} mph`;
    this.radioEl.textContent = `♪ ${game.audio.stationName()}`;
    const dist = game.missions.distanceToMarker();
    this.objectiveDist.textContent = game.missions.active && dist > 0 ? `${Math.round(dist)}m` : '';
    this.crosshairEl.style.display = game.player.onFoot && game.state === 'play' ? 'block' : 'none';
    this.drawMinimap(game);
  }
}
