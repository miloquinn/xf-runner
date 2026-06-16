import { PATHS } from "../config/constants.js?v=20260616-1435";

function loadAsset(name) {
  const img = new Image();
  img.src = PATHS.assets + name;
  return img;
}

export function loadAssets() {
  return {
    runnerRun1: loadAsset("runner-run-1.png"),
    runnerRun2: loadAsset("runner-run-2.png"),
    runnerJump: loadAsset("runner-jump.png"),
    runnerDuck: loadAsset("runner-duck.png"),
    iceGround: loadAsset("icecream-ground.png"),
    iceDouble: loadAsset("icecream-double.png"),
    iceFly: loadAsset("icecream-fly.png"),
    sodaBottle: loadAsset("soda-bottle.png"),
    power5x: loadAsset("power-5x.png"),
    power10x: loadAsset("power-10x.png"),
    powerPlane: loadAsset("power-plane.png")
  };
}

export function assetReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}
