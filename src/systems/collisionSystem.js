import { CANVAS, ENTITY_KIND } from "../config/constants.js?v=20260616-1405";

export function playerBox(player) {
  if (player.ducking) {
    return {
      x: player.x + 8,
      y: player.y - player.duckH + 12,
      w: player.duckW - 18,
      h: player.duckH - 16
    };
  }
  return {
    x: player.x + 12,
    y: player.y - player.h + 10,
    w: player.w - 22,
    h: player.h - 16
  };
}

export function obstacleBox(obstacle) {
  if (obstacle.kind === ENTITY_KIND.FLY || obstacle.kind === ENTITY_KIND.SODA) {
    const insetX = obstacle.kind === ENTITY_KIND.SODA ? 18 : 8;
    const insetY = 8;
    return {
      x: obstacle.x + insetX,
      y: obstacle.y + Math.sin(obstacle.bob) * 5 + insetY,
      w: obstacle.w - insetX * 2,
      h: obstacle.h - insetY * 2
    };
  }
  return {
    x: obstacle.x + 9,
    y: CANVAS.groundY - obstacle.h + 12,
    w: obstacle.w - 18,
    h: obstacle.h - 18
  };
}

export function collectibleBox(collectible) {
  const insetX = collectible.w * 0.18;
  const insetY = collectible.h * 0.18;
  return {
    x: collectible.x + insetX,
    y: collectible.y + Math.sin(collectible.bob) * 7 + insetY,
    w: collectible.w - insetX * 2,
    h: collectible.h - insetY * 2
  };
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function collides(player, obstacle) {
  return boxesOverlap(playerBox(player), obstacleBox(obstacle));
}

export function collidesCollectible(player, collectible) {
  return boxesOverlap(playerBox(player), collectibleBox(collectible));
}
