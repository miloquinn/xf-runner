import { CANVAS, ENTITY_KIND } from "../config/constants.js?v=20260616-1235";
import { assetReady } from "../core/assets.js?v=20260616-1235";

export function createRenderer(dom, assets, state, player) {
  const ctx = dom.ctx;
  const playerDraw = {
    uprightW: 148,
    uprightH: 170,
    duckW: 178,
    duckH: 104
  };

  function varColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawSky(worldWidth) {
    ctx.fillStyle = "#f8f9f3";
    ctx.fillRect(0, 0, worldWidth, CANVAS.floorY);

    const clouds = [
      [130, 108, 150],
      [435, 72, 140],
      [690, 116, 142],
      [980, 78, 150]
    ];
    for (const [x, y, size] of clouds) {
      const drift = (state.beltOffset * 0.18 + x) % (worldWidth + 240) - 120;
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#c7e7d8";
      roundedRect(drift, y, size, 20, 18);
      ctx.fill();
      ctx.fillStyle = "#dcefe7";
      roundedRect(drift + size * 0.12, y - 8, size * 0.54, 18, 18);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(22, 115, 74, 0.06)";
    ctx.fillRect(0, CANVAS.floorY, worldWidth, CANVAS.height - CANVAS.floorY);
  }

  function drawRoller(x, y) {
    ctx.fillStyle = "#52625d";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f1716";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#94a39d";
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f1716";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  function drawConveyor(worldWidth) {
    const beltY = CANVAS.groundY + 8;
    const beltH = 80;
    ctx.strokeStyle = "#111816";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS.groundY + 3);
    ctx.lineTo(worldWidth, CANVAS.groundY + 3);
    ctx.stroke();

    roundedRect(32, beltY, worldWidth - 64, beltH, 12);
    ctx.fillStyle = varColor("--belt");
    ctx.fill();
    ctx.strokeStyle = "#101817";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    roundedRect(44, beltY + 8, worldWidth - 88, beltH - 16, 8);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = -140 - state.beltOffset; x < worldWidth + 140; x += 86) {
      ctx.beginPath();
      ctx.moveTo(x, beltY + beltH);
      ctx.lineTo(x + 38, beltY);
      ctx.lineTo(x + 78, beltY);
      ctx.lineTo(x + 38, beltY + beltH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "#0f1a17";
    ctx.fillRect(96, beltY + beltH - 4, worldWidth - 192, 13);
    drawRoller(48, beltY + beltH / 2);
    drawRoller(worldWidth - 48, beltY + beltH / 2);

    ctx.fillStyle = "#55645e";
    ctx.fillRect(145, beltY + beltH, 18, 62);
    ctx.fillRect(worldWidth - 164, beltY + beltH, 18, 62);
  }

  function drawAssetObstacle(obstacle) {
    const img = obstacle.kind === ENTITY_KIND.SODA
      ? assets.sodaBottle
      : obstacle.kind === ENTITY_KIND.FLY
        ? assets.iceFly
        : obstacle.kind === ENTITY_KIND.DOUBLE
          ? assets.iceDouble
          : assets.iceGround;
    if (!assetReady(img)) {
      return false;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (obstacle.kind === ENTITY_KIND.FLY || obstacle.kind === ENTITY_KIND.SODA) {
      const flyY = obstacle.y + Math.sin(obstacle.bob) * 5;
      const targetW = obstacle.w;
      const targetH = targetW * (img.naturalHeight / img.naturalWidth);
      ctx.translate(obstacle.x + obstacle.w / 2, flyY + obstacle.h / 2);
      ctx.rotate(obstacle.kind === ENTITY_KIND.SODA ? -0.02 : -0.04);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
      return true;
    }

    const targetH = obstacle.h + 18;
    const targetW = targetH * (img.naturalWidth / img.naturalHeight);
    const centerX = obstacle.x + obstacle.w / 2;
    const bottomY = CANVAS.groundY + 38;
    ctx.drawImage(img, centerX - targetW / 2, bottomY - targetH, targetW, targetH);
    ctx.restore();
    return true;
  }

  function drawFallbackObstacle(obstacle) {
    ctx.save();
    const isFlying = obstacle.kind === ENTITY_KIND.FLY || obstacle.kind === ENTITY_KIND.SODA;
    const y = isFlying ? obstacle.y + Math.sin(obstacle.bob) * 5 : CANVAS.groundY - obstacle.h;
    roundedRect(obstacle.x, y, obstacle.w, isFlying ? obstacle.h : obstacle.h + 20, 8);
    ctx.fillStyle = isFlying ? "#287580" : "#7a3f24";
    ctx.fill();
    ctx.strokeStyle = "#171b1d";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(obstacle) {
    if (!drawAssetObstacle(obstacle)) {
      drawFallbackObstacle(obstacle);
    }
  }

  function drawCollectible(collectible) {
    const img = assets[collectible.asset];
    const bobY = collectible.y + Math.sin(collectible.bob) * 7;
    const pulse = 1 + Math.sin(collectible.spin) * 0.045;
    const centerX = collectible.x + collectible.w / 2;
    const centerY = bobY + collectible.h / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = collectible.effect === "score10" ? "#f4d35e" : "#4fc3a1";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(collectible.w, collectible.h) * 0.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (assetReady(img)) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -collectible.w / 2, -collectible.h / 2, collectible.w, collectible.h);
    } else {
      roundedRect(-collectible.w / 2, -collectible.h / 2, collectible.w, collectible.h, 8);
      ctx.fillStyle = "#fff7d9";
      ctx.fill();
      ctx.strokeStyle = "#171b1d";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#171b1d";
      ctx.font = "900 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(collectible.label, 0, 0);
    }
    ctx.restore();
  }

  function drawPlayer() {
    let img;
    if (player.ducking) {
      img = assets.runnerDuck;
    } else if (!player.onGround) {
      img = assets.runnerJump;
    } else {
      img = Math.floor(player.runPhase) % 2 === 0 ? assets.runnerRun1 : assets.runnerRun2;
    }
    if (!assetReady(img)) {
      img = player.ducking
        ? assets.runnerDuck
        : !player.onGround
          ? assets.runnerJump
            : Math.floor(player.runPhase) % 2 === 0
            ? assets.runnerRun1
            : assets.runnerRun2;
    }
    const bob = player.onGround ? Math.sin(player.runPhase * Math.PI) * 1.8 : 0;
    const takeoffLift = state.takeoffAnim > 0 ? -5 * (state.takeoffAnim / 0.09) : 0;
    const landPress = state.landAnim > 0 ? 3 * (state.landAnim / 0.11) : 0;

    ctx.save();
    if (state.invulnerableReason || state.invulnerableGrace > 0) {
      const glowX = player.x + 38;
      const glowY = player.y - (player.ducking ? 42 : 86) + bob;
      const pulse = 1 + Math.sin(state.elapsed * 18) * 0.08;
      const radius = (player.ducking ? 54 : 76) * pulse;
      const gradient = ctx.createRadialGradient(glowX, glowY, radius * 0.25, glowX, glowY, radius);
      gradient.addColorStop(0, "rgba(255, 238, 112, 0.78)");
      gradient.addColorStop(0.58, "rgba(255, 194, 46, 0.42)");
      gradient.addColorStop(1, "rgba(255, 194, 46, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(glowX, glowY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 217, 74, 0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(glowX, glowY, radius * 0.66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 248, 174, 0.86)";
      for (let i = 0; i < 12; i += 1) {
        const a = state.elapsed * 6 + i * Math.PI * 0.25;
        const r = radius * (0.46 + (i % 4) * 0.09);
        ctx.beginPath();
        ctx.arc(glowX + Math.cos(a) * r, glowY + Math.sin(a) * r * 0.82, 3.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#0b1512";
    ctx.beginPath();
    ctx.ellipse(player.x + 42, CANVAS.groundY + 4, player.ducking ? 48 : 38, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (assetReady(img)) {
      const targetW = player.ducking ? playerDraw.duckW : playerDraw.uprightW;
      const targetH = player.ducking ? playerDraw.duckH : playerDraw.uprightH;
      const centerX = player.x + (player.ducking ? 50 : 42);
      const left = centerX - targetW / 2;
      const bottom = player.y + (player.ducking ? 11 : 10) + bob + takeoffLift + landPress;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, left, bottom - targetH, targetW, targetH);
      ctx.restore();
      return;
    }

    ctx.translate(player.x, player.y + bob);
    roundedRect(8, -120, 72, 118, 18);
    ctx.fillStyle = "#f7f7f0";
    ctx.fill();
    ctx.strokeStyle = "#171b1d";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPuffs() {
    for (const puff of state.puffs) {
      ctx.globalAlpha = Math.max(0, puff.life * 1.8);
      ctx.fillStyle = "#d8dfd9";
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawForegroundLine(worldWidth) {
    ctx.strokeStyle = "rgba(23, 27, 29, 0.08)";
    ctx.lineWidth = 2;
    for (let x = -state.beltOffset; x < worldWidth; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, CANVAS.floorY + 18);
      ctx.lineTo(x + 35, CANVAS.floorY + 18);
      ctx.stroke();
    }
  }

  return {
    draw(worldWidth) {
      ctx.save();
      ctx.clearRect(0, 0, worldWidth, CANVAS.height);
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawSky(worldWidth);
      drawConveyor(worldWidth);
      for (const obstacle of state.obstacles) {
        drawObstacle(obstacle);
      }
      for (const collectible of state.collectibles) {
        drawCollectible(collectible);
      }
      drawPuffs();
      drawPlayer();
      drawForegroundLine(worldWidth);
      ctx.restore();
    }
  };
}
