import { CANVAS, COLLECTIBLE_KIND } from "./constants.js?v=20260616-1320";

export const EFFECTS = {
  score5: {
    label: "5倍",
    duration: 10,
    scoreMultiplier: 5,
    power: true
  },
  score10: {
    label: "10倍",
    duration: 10,
    scoreMultiplier: 10,
    power: true
  },
  jetpack: {
    label: "小飞机",
    shortLabel: "飞",
    duration: 5,
    liftVelocity: -360,
    speedBoost: 1.14
  }
};

export const COLLECTIBLES = {
  score5: {
    label: "5x",
    asset: "power5x",
    effect: COLLECTIBLE_KIND.SCORE5,
    w: 74,
    h: 74,
    weight: 0.28,
    y: [CANVAS.groundY - 230, CANVAS.groundY - 176]
  },
  score10: {
    label: "10x",
    asset: "power10x",
    effect: COLLECTIBLE_KIND.SCORE10,
    w: 78,
    h: 78,
    weight: 0.08,
    y: [CANVAS.groundY - 246, CANVAS.groundY - 190]
  },
  jetpack: {
    label: "小飞机",
    asset: "powerPlane",
    effect: COLLECTIBLE_KIND.JETPACK,
    w: 106,
    h: 66,
    weight: 0.64,
    y: [CANVAS.groundY - 224, CANVAS.groundY - 166]
  }
};
