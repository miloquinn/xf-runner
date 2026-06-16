import { PHYSICS } from "../config/constants.js?v=20260616-1320";
import { EFFECTS } from "../config/powerups.js?v=20260616-1320";

export function hasEffect(state, type) {
  return Boolean(state.effects[type]?.remaining > 0);
}

export function isInvulnerable(state) {
  return Boolean(state.invulnerableReason || state.invulnerableGrace > 0);
}

export function activateEffect(state, player, type) {
  const effect = EFFECTS[type];
  if (!effect) {
    return;
  }
  if (type === "score10") {
    delete state.effects.score5;
  }
  if (type === "score5" && hasEffect(state, "score10")) {
    state.effects.score10.remaining = Math.max(state.effects.score10.remaining, effect.duration * 0.5);
    return;
  }
  state.effects[type] = {
    ...effect,
    remaining: effect.duration
  };
  if (type === "jetpack") {
    state.jumpHeld = false;
    state.duckHeld = false;
    state.invulnerableReason = "jetpack-takeoff";
    state.invulnerableGrace = 0;
    player.onGround = false;
    player.ducking = false;
    player.vy = Math.min(player.vy, effect.liftVelocity);
  }
}

export function updateEffects(state, player, dt) {
  state.invulnerableGrace = Math.max(0, (state.invulnerableGrace || 0) - dt);
  const hadJetpack = hasEffect(state, "jetpack");

  for (const [type, effect] of Object.entries(state.effects)) {
    effect.remaining -= dt;
    if (effect.remaining <= 0) {
      delete state.effects[type];
    }
  }

  const jetpackActive = hasEffect(state, "jetpack");
  if (hadJetpack && !jetpackActive && !player.onGround) {
    state.invulnerableReason = "jetpack-landing";
  }

  if (jetpackActive && !state.duckHeld) {
    state.jumpHeld = false;
    player.onGround = false;
    player.ducking = false;
    if (player.y > PHYSICS.jetpackHoverY) {
      player.vy = Math.min(player.vy, EFFECTS.jetpack.liftVelocity);
    } else if (player.y < PHYSICS.jetpackCeilingY) {
      player.y = PHYSICS.jetpackCeilingY;
      player.vy = Math.max(player.vy, 120);
    } else {
      player.vy = Math.min(Math.max(player.vy, -80), 80);
    }
    if (state.invulnerableReason === "jetpack-takeoff" && player.y <= PHYSICS.jetpackHoverY + 8) {
      state.invulnerableReason = "";
    }
  }
}

export function updateLandingInvulnerability(state, player) {
  if (state.invulnerableReason === "jetpack-landing" && player.onGround) {
    state.invulnerableGrace = 0.32;
    state.invulnerableReason = "";
  }
}
