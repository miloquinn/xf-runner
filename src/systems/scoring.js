import { EFFECTS } from "../config/powerups.js?v=20260616-1350";

export function scorePressure(state, difficulty) {
  const scoreCurve = Math.sqrt(Math.max(0, state.baseScore) / 1800) * difficulty.scoreScale;
  const timeCurve = Math.min(0.45, state.elapsed / 180);
  return Math.min(1.65, scoreCurve + timeCurve);
}

export function speedScoreMultiplier(pressure) {
  return 1 + Math.min(0.6, Math.max(0, pressure) * 0.38);
}

export function activePowerMultiplier(state) {
  if (state.effects.score10?.remaining > 0) {
    return EFFECTS.score10.scoreMultiplier;
  }
  if (state.effects.score5?.remaining > 0) {
    return EFFECTS.score5.scoreMultiplier;
  }
  return 1;
}

export function totalScoreMultiplier(state, pressure) {
  return speedScoreMultiplier(pressure) * activePowerMultiplier(state);
}

export function addScore(state, amount, pressure) {
  state.baseScore += amount;
  state.score += amount * totalScoreMultiplier(state, pressure);
}

export function formatMultiplier(value) {
  const fixed = Math.round(value * 10) / 10;
  return `x${fixed.toFixed(1)}`;
}
