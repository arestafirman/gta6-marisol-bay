// Save / load through localStorage: cash, mission progress, player spot.
// Plain JSON, versioned key, every failure swallowed so a blocked store
// never breaks the game.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      missionIndex: state.missionIndex,
      completed: state.completed,
      health: state.health,
      position: state.position,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // A blocked store is not the player's problem.
  }
}
