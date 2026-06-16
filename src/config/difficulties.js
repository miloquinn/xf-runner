import { ENTITY_KIND } from "./constants.js?v=20260616-1320";

export const DIFFICULTIES = {
  easy: {
    label: "简单",
    baseSpeed: 300,
    ramp: 6.8,
    maxSpeed: 540,
    lateSpeedBonus: 120,
    speedPressure: 86,
    firstSpawn: 1.15,
    minGap: 1.38,
    lateMinGap: 0.76,
    gapRamp: 0.46,
    randomGap: 0.76,
    randomRamp: 0.3,
    earlyBonus: 0.48,
    flyAfter: 5,
    flyBase: 0.1,
    flyMax: 0.28,
    scoreScale: 0.72,
    doubleChance: 0.1,
    groundHeights: [
      { kind: ENTITY_KIND.GROUND, w: 62, h: 96 },
      { kind: ENTITY_KIND.GROUND, w: 58, h: 104 }
    ],
    doubleObstacle: { kind: ENTITY_KIND.DOUBLE, w: 108, h: 106 }
  },
  normal: {
    label: "普通",
    baseSpeed: 340,
    ramp: 9.2,
    maxSpeed: 650,
    lateSpeedBonus: 155,
    speedPressure: 112,
    firstSpawn: 0.98,
    minGap: 1.12,
    lateMinGap: 0.62,
    gapRamp: 0.5,
    randomGap: 0.62,
    randomRamp: 0.28,
    earlyBonus: 0.34,
    flyAfter: 4,
    flyBase: 0.16,
    flyMax: 0.38,
    scoreScale: 1,
    doubleChance: 0.18,
    groundHeights: [
      { kind: ENTITY_KIND.GROUND, w: 62, h: 108 },
      { kind: ENTITY_KIND.GROUND, w: 58, h: 116 }
    ],
    doubleObstacle: { kind: ENTITY_KIND.DOUBLE, w: 110, h: 120 }
  },
  hard: {
    label: "困难",
    baseSpeed: 385,
    ramp: 12.4,
    maxSpeed: 780,
    lateSpeedBonus: 190,
    speedPressure: 140,
    firstSpawn: 0.78,
    minGap: 0.88,
    lateMinGap: 0.52,
    gapRamp: 0.38,
    randomGap: 0.5,
    randomRamp: 0.24,
    earlyBonus: 0.22,
    flyAfter: 3,
    flyBase: 0.22,
    flyMax: 0.48,
    scoreScale: 1.22,
    doubleChance: 0.28,
    groundHeights: [
      { kind: ENTITY_KIND.GROUND, w: 62, h: 118 },
      { kind: ENTITY_KIND.GROUND, w: 58, h: 126 }
    ],
    doubleObstacle: { kind: ENTITY_KIND.DOUBLE, w: 112, h: 128 }
  }
};

export function difficultyFor(value) {
  return DIFFICULTIES[value] || DIFFICULTIES.easy;
}
