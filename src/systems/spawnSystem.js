import { CANVAS, ENTITY_KIND } from "../config/constants.js?v=20260616-1420";
import { COLLECTIBLES } from "../config/powerups.js?v=20260616-1420";

export function groundObstaclePool(cfg, pressure) {
  const pool = cfg.groundHeights.map((entry) => ({ ...entry }));
  if (Math.random() < Math.min(0.48, cfg.doubleChance + pressure * 0.18)) {
    pool.push({ ...cfg.doubleObstacle });
  }
  return pool;
}

export function aerialObstaclePool() {
  return [
    { kind: ENTITY_KIND.SODA, w: 150, h: 54, y: CANVAS.groundY - 120 },
    { kind: ENTITY_KIND.SODA, w: 164, h: 58, y: CANVAS.groundY - 136 },
    { kind: ENTITY_KIND.FLY, w: 130, h: 52, y: CANVAS.groundY - 132 }
  ];
}

export function shouldSpawnAerial(state, cfg, pressure) {
  const readyForAerial = state.spawnIndex >= Math.max(2, cfg.flyAfter - Math.floor(pressure * 2));
  const chance = Math.min(0.62, cfg.flyMax + pressure * 0.18, cfg.flyBase + state.elapsed / 120 + pressure * 0.2);
  return readyForAerial && Math.random() < chance;
}

export function chooseObstacleTemplate(state, cfg, pressure) {
  const pool = shouldSpawnAerial(state, cfg, pressure) ? aerialObstaclePool() : groundObstaclePool(cfg, pressure);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function nextObstacleDelay(state, cfg, pressure) {
  const gapBonus = Math.max(0, 1 - state.elapsed / 75) * cfg.earlyBonus;
  const pressureGapCut = Math.min(cfg.minGap - cfg.lateMinGap, pressure * cfg.gapRamp);
  const randomGap = Math.max(0.18, cfg.randomGap - pressure * cfg.randomRamp);
  return Math.max(cfg.lateMinGap, cfg.minGap - pressureGapCut) + Math.random() * randomGap + gapBonus;
}

export function spawnObstacle(state, cfg, pressure, worldWidth) {
  const choice = chooseObstacleTemplate(state, cfg, pressure);
  state.obstacles.push({
    ...choice,
    x: worldWidth + 60,
    passed: false,
    bob: Math.random() * Math.PI * 2
  });
  state.spawnIndex += 1;
  state.nextSpawn = nextObstacleDelay(state, cfg, pressure);
}

function collectibleDelayRange(difficultyKey) {
  if (difficultyKey === "hard") {
    return [9.5, 14.5];
  }
  if (difficultyKey === "normal") {
    return [11.5, 16.5];
  }
  return [13, 19];
}

export function nextCollectibleDelay(state, pressure) {
  const [min, max] = collectibleDelayRange(state.difficulty);
  const lateCut = Math.min(2.5, pressure * 1.4);
  const low = Math.max(7.5, min - lateCut);
  const high = Math.max(low + 2, max - lateCut);
  return low + Math.random() * (high - low);
}

export function chooseCollectibleTemplate() {
  const entries = Object.values(COLLECTIBLES);
  const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of entries) {
    roll -= item.weight;
    if (roll <= 0) {
      return item;
    }
  }
  return entries[0];
}

export function spawnCollectible(state, pressure, worldWidth) {
  if (state.collectibles.length > 0 || state.elapsed < 5.5) {
    state.nextCollectible = nextCollectibleDelay(state, pressure);
    return;
  }
  const choice = chooseCollectibleTemplate();
  const [minY, maxY] = choice.y;
  state.collectibles.push({
    ...choice,
    x: worldWidth + 90,
    y: minY + Math.random() * (maxY - minY),
    bob: Math.random() * Math.PI * 2,
    spin: Math.random() * Math.PI * 2
  });
  state.collectibleIndex += 1;
  state.nextCollectible = nextCollectibleDelay(state, pressure);
}
