// WebAudio synthesis only — no audio files, no copyrighted music.
// Engine hum, two-tone sirens, gunshots and three original radio stations
// (synthwave, latin, talk) are all oscillators and noise built at runtime.
import { RADIO_STATIONS } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// [midi note, beats] step patterns, 16 steps a bar, looped per station.
const PATTERNS = {
  synthwave: {
    bpm: 96,
    bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0],
    lead: [69, 0, 72, 76, 0, 72, 69, 0, 67, 0, 69, 0, 74, 72, 0, 0],
    wave: 'sawtooth',
  },
  latin: {
    bpm: 112,
    bass: [41, 0, 41, 48, 0, 41, 0, 46, 41, 0, 41, 48, 53, 0, 48, 46],
    lead: [65, 68, 0, 72, 0, 68, 65, 0, 63, 65, 0, 68, 72, 0, 71, 68],
    wave: 'triangle',
  },
  talk: {
    bpm: 80,
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    wave: 'sine',
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.station = 0;
    this.radioGain = null;
    this.radioOn = false;
    this.step = 0;
    this.nextStepTime = 0;
    this.scheduler = null;
  }

  /** Must be called from a user gesture; safe to call twice. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();

      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0;
      this.radioGain.connect(this.master);
      this.nextStepTime = this.ctx.currentTime + 0.1;
      this.scheduler = window.setInterval(() => this.scheduleRadio(), 90);
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on) {
    if (!this.ctx || on === this.sirenOn) return;
    this.sirenOn = on;
    const now = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, now, 0.2);
    if (on) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 170;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      lfo.start();
      lfo.stop(now + 30);
    }
  }

  setRadio(on, stationIndex) {
    if (stationIndex !== undefined) this.station = stationIndex;
    this.radioOn = on;
    if (!this.ctx) return;
    this.radioGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.15);
  }

  cycleStation() {
    this.station = (this.station + 1) % RADIO_STATIONS.length;
    if (this.ctx) this.radioGain.gain.setTargetAtTime(this.radioOn ? 0.16 : 0, this.ctx.currentTime, 0.05);
    return this.station;
  }

  stationName() {
    return RADIO_STATIONS[this.station].name;
  }

  scheduleRadio() {
    if (!this.ctx || !this.radioOn) return;
    const pattern = PATTERNS[RADIO_STATIONS[this.station].style];
    const stepDur = 60 / pattern.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.35) {
      const i = this.step % 16;
      const bass = pattern.bass[i];
      const lead = pattern.lead[i];
      if (bass) this.blip(midiToFreq(bass), this.nextStepTime, stepDur * 1.8, pattern.wave, 0.5);
      if (lead) this.blip(midiToFreq(lead), this.nextStepTime, stepDur * 1.4, 'square', 0.16);
      if (i % 4 === 0) this.blip(1200, this.nextStepTime, 0.03, 'square', 0.05);
      this.step += 1;
      this.nextStepTime += stepDur;
    }
  }

  blip(freq, when, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(this.radioGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  playShot() {
    this.noiseBurst(0.14, 0.5, 2600);
  }

  playPunch() {
    this.noiseBurst(0.09, 0.35, 500);
  }

  playPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.blip(660, now, 0.12, 'sine', 0.25);
    this.blip(990, now + 0.09, 0.18, 'sine', 0.25);
  }

  playMissionComplete() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.blip(freq, now + i * 0.12, 0.22, 'triangle', 0.3);
    });
  }

  playBusted() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [392, 330, 262].forEach((freq, i) => {
      this.blip(freq, now + i * 0.18, 0.3, 'sawtooth', 0.2);
    });
  }
}
