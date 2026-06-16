import { CANVAS, GAME_MODE, PHYSICS, REVIVE_RULES, STORAGE_KEYS } from "../config/constants.js?v=20260616-1435";
import { DIFFICULTIES, difficultyFor } from "../config/difficulties.js?v=20260616-1435";
import { EFFECTS } from "../config/powerups.js?v=20260616-1435";
import { loadAssets } from "./assets.js?v=20260616-1435";
import {
  createAudioController,
  pauseBackgroundMusic,
  playBackgroundMusic,
  playGameOverSound,
  setSoundEnabled,
  unlockAudio
} from "./audio.js?v=20260616-1435";
import {
  cleanName,
  advanceReviveProgress,
  loadHiScore,
  loadPlayerName,
  loadReviveState,
  pad,
  saveHiScore,
  savePlayerName,
  saveReviveState
} from "./storage.js?v=20260616-1435";
import { isTypingTarget } from "../ui/dom.js?v=20260616-1435";
import { createLeaderboard } from "../ui/leaderboard.js?v=20260616-1435";
import { validateCloudName } from "../api/leaderboardApi.js?v=20260616-1435";
import {
  activateEffect,
  hasEffect,
  isInvulnerable,
  updateEffects,
  updateLandingInvulnerability
} from "../systems/effectSystem.js?v=20260616-1435";
import { addScore, formatMultiplier, scorePressure, speedScoreMultiplier } from "../systems/scoring.js?v=20260616-1435";
import { collides, collidesCollectible } from "../systems/collisionSystem.js?v=20260616-1435";
import {
  nextCollectibleDelay,
  spawnCollectible,
  spawnObstacle
} from "../systems/spawnSystem.js?v=20260616-1435";
import { createRenderer } from "../systems/renderSystem.js?v=20260616-1435";

export class Game {
  constructor(dom) {
    this.dom = dom;
    this.assets = loadAssets();
    this.audio = createAudioController();
    this.worldWidth = dom.canvas.width;
    this.state = this.createState();
    this.player = this.createPlayer();
    this.leaderboard = createLeaderboard(
      dom,
      this.state,
      () => this.currentDifficulty().label,
      () => this.state.playerName || loadPlayerName()
    );
    this.renderer = createRenderer(dom, this.assets, this.state, this.player);
  }

  createState() {
    const savedDifficulty = localStorage.getItem(STORAGE_KEYS.difficulty);
    const revive = loadReviveState();
    return {
      mode: GAME_MODE.READY,
      score: 0,
      baseScore: 0,
      hiScore: loadHiScore(),
      speed: 380,
      elapsed: 0,
      nextSpawn: 0.9,
      nextCollectible: 7.5,
      spawnIndex: 0,
      collectibleIndex: 0,
      beltOffset: 0,
      shake: 0,
      lastTime: 0,
      jumpHeld: false,
      duckHeld: false,
      jumpBuffer: 0,
      coyoteTime: 0,
      takeoffAnim: 0,
      landAnim: 0,
      playerName: "",
      hasEntered: false,
      difficulty: DIFFICULTIES[savedDifficulty] ? savedDifficulty : "easy",
      leaderboardDifficulty: "简单",
      leaderboardView: "score",
      moreLeaderboardView: "region",
      totalPlayers: 0,
      effects: {},
      obstacles: [],
      collectibles: [],
      puffs: [],
      invulnerableReason: "",
      invulnerableGrace: 0,
      revive,
      revivesUsedThisRun: 0,
      finalizedRun: false,
      entryChecking: false
    };
  }

  createPlayer() {
    return {
      x: 190,
      y: CANVAS.groundY,
      vy: 0,
      w: 92,
      h: 124,
      duckW: 132,
      duckH: 74,
      onGround: true,
      ducking: false,
      jumpTime: 0,
      runPhase: 0
    };
  }

  currentDifficulty() {
    return difficultyFor(this.state.difficulty);
  }

  syncCanvasLayout() {
    const mobilePortrait = window.matchMedia("(max-width: 680px) and (orientation: portrait)").matches;
    const nextWidth = mobilePortrait ? CANVAS.mobilePortraitWidth : CANVAS.defaultWidth;
    this.worldWidth = nextWidth;
    if (this.dom.canvas.width !== nextWidth) {
      this.dom.canvas.width = nextWidth;
    }
    this.dom.canvas.style.setProperty("--canvas-ratio", `${nextWidth} / ${CANVAS.height}`);
  }

  canChangeDifficulty() {
    return this.state.mode === GAME_MODE.READY || this.state.mode === GAME_MODE.GAME_OVER;
  }

  setMode(mode) {
    this.state.mode = mode;
    this.updateDifficultyButtons();
  }

  setDifficulty(value) {
    if (!DIFFICULTIES[value]) {
      return;
    }
    if (!this.canChangeDifficulty()) {
      this.updateDifficultyButtons();
      return;
    }
    this.state.difficulty = value;
    localStorage.setItem(STORAGE_KEYS.difficulty, value);
    this.updateDifficultyButtons();
  }

  updateDifficultyButtons() {
    const disabled = !this.canChangeDifficulty();
    for (const button of this.dom.difficultyBtns) {
      button.setAttribute("aria-pressed", button.dataset.difficulty === this.state.difficulty ? "true" : "false");
      button.disabled = disabled;
      button.title = disabled ? "本局开始后不能切换难度" : "切换难度";
    }
  }

  updateSoundButton() {
    this.dom.soundBtn.textContent = this.audio.enabled ? "♪" : "×";
    this.dom.soundBtn.title = this.audio.enabled ? "关闭声音" : "打开声音";
    this.dom.soundBtn.setAttribute("aria-label", this.audio.enabled ? "关闭声音" : "打开声音");
  }

  updateHud() {
    this.dom.scoreNode.textContent = pad(this.state.score);
    this.dom.hiScoreNode.textContent = pad(this.state.hiScore);
    const pressure = scorePressure(this.state, this.currentDifficulty());
    const compactHud = window.matchMedia("(max-width: 680px), (max-width: 940px) and (orientation: landscape)").matches;
    const chips = [`<span class="effect-chip">${compactHud ? `速${formatMultiplier(speedScoreMultiplier(pressure)).slice(1)}` : `速度 ${formatMultiplier(speedScoreMultiplier(pressure))}`}</span>`];
    chips.push(`<span class="effect-chip revive">${compactHud ? `复${this.state.revive.tickets}` : `复活 ${this.state.revive.tickets}`}</span>`);
    for (const effect of Object.values(this.state.effects)) {
      if (effect.remaining > 0) {
        const className = effect.power ? "effect-chip power" : "effect-chip";
        const label = compactHud && effect.shortLabel ? effect.shortLabel : effect.label;
        chips.push(`<span class="${className}">${label}${compactHud ? "" : " "}${Math.ceil(effect.remaining)}s</span>`);
      }
    }
    this.dom.effectStrip.innerHTML = chips.join("");
  }

  showMessage(title, text) {
    this.dom.messageTitle.textContent = title;
    this.dom.messageText.textContent = text;
    this.dom.message.hidden = false;
    this.dom.overlay.style.pointerEvents = "none";
  }

  hideMessage() {
    this.dom.message.hidden = true;
  }

  openEntryModal() {
    this.state.hasEntered = false;
    this.state.playerName = loadPlayerName();
    this.dom.playerNameInput.value = this.state.playerName;
    this.dom.entryModal.hidden = false;
    setTimeout(() => this.dom.playerNameInput.focus(), 50);
  }

  async confirmEntryModal() {
    if (this.state.entryChecking) {
      return false;
    }
    const name = cleanName(this.dom.playerNameInput.value);
    if (!name) {
      this.showMessage("换个名字", "名字不能包含联系方式或敏感内容。");
      this.dom.playerNameInput.focus();
      return false;
    }
    this.state.entryChecking = true;
    this.dom.entryStartBtn.disabled = true;
    try {
      const result = await validateCloudName(name);
      if (!result.ok || !result.name) {
        this.showMessage("名字不可用", "这个名字不能使用，请换一个。");
        this.dom.playerNameInput.focus();
        return false;
      }
      this.state.playerName = savePlayerName(result.name);
    } catch {
      this.showMessage("校验失败", "暂时无法确认这个名字，请稍后再试。");
      this.dom.playerNameInput.focus();
      return false;
    } finally {
      this.state.entryChecking = false;
      this.dom.entryStartBtn.disabled = false;
    }
    this.dom.playerNameInput.value = this.state.playerName;
    this.state.hasEntered = true;
    this.dom.entryModal.hidden = true;
    return true;
  }

  resetGame() {
    if (!this.state.hasEntered) {
      this.openEntryModal();
      return;
    }
    const cfg = this.currentDifficulty();
    this.setMode(GAME_MODE.RUNNING);
    this.leaderboard.startSession(cfg.label);
    Object.assign(this.state, {
      score: 0,
      baseScore: 0,
      speed: cfg.baseSpeed,
      elapsed: 0,
      nextSpawn: cfg.firstSpawn,
      nextCollectible: nextCollectibleDelay(this.state, 0) * 0.7,
      spawnIndex: 0,
      collectibleIndex: 0,
      beltOffset: 0,
      shake: 0,
      jumpHeld: false,
      duckHeld: false,
      jumpBuffer: 0,
      coyoteTime: PHYSICS.coyoteSeconds,
      takeoffAnim: 0,
      landAnim: 0,
      obstacles: [],
      collectibles: [],
      puffs: [],
      effects: {},
      invulnerableReason: "",
      invulnerableGrace: 0,
      revivesUsedThisRun: 0,
      finalizedRun: false
    });
    Object.assign(this.player, {
      y: CANVAS.groundY,
      vy: 0,
      onGround: true,
      ducking: false,
      jumpTime: 0,
      runPhase: 0
    });
    this.hideMessage();
    this.closeRevivePrompt();
    this.updateHud();
    unlockAudio(this.audio);
    this.audio.bgm.currentTime = 0;
    playBackgroundMusic(this.audio);
  }

  async startFromEntry() {
    if (await this.confirmEntryModal()) {
      this.resetGame();
    }
  }

  async shareGame() {
    const shareData = {
      title: "雪峰快跑",
      text: "跳冰淇淋，躲雪碧，冲排行榜。来试试这个网页小游戏。",
      url: "https://zxf.oorigo.tech/"
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      this.showMessage("链接已复制", "发给朋友，看看谁能跑进前100。");
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      this.showMessage("分享链接", shareData.url);
    }
  }

  startBufferedJump() {
    if (this.state.jumpBuffer <= 0 || this.state.mode !== GAME_MODE.RUNNING) {
      return false;
    }
    if (!this.player.onGround && this.state.coyoteTime <= 0) {
      return false;
    }
    this.state.jumpBuffer = 0;
    this.state.coyoteTime = 0;
    this.state.takeoffAnim = PHYSICS.takeoffAnimSeconds;
    this.state.landAnim = 0;
    this.player.vy = PHYSICS.jumpVelocity;
    this.player.onGround = false;
    this.player.jumpTime = 0;
    this.player.ducking = false;
    this.addPuff(this.player.x + 24, CANVAS.groundY + 4, 8);
    return true;
  }

  canRevive() {
    return this.state.revive.tickets > 0 && this.state.revivesUsedThisRun < REVIVE_RULES.maxPerRun;
  }

  updateRevivePrompt() {
    if (!this.dom.reviveText) {
      return;
    }
    const remainingInRun = Math.max(0, REVIVE_RULES.maxPerRun - this.state.revivesUsedThisRun);
    const progressText = this.state.revive.tickets >= REVIVE_RULES.maxTickets
      ? "复活次数已攒满。"
      : `再完整玩 ${REVIVE_RULES.gamesPerTicket - this.state.revive.progress} 局可获得 1 次复活。`;
    this.dom.reviveText.textContent = `剩余复活 ${this.state.revive.tickets} 次，本局还能复活 ${remainingInRun} 次。${progressText}`;
  }

  openRevivePrompt() {
    this.setMode(GAME_MODE.REVIVE);
    this.state.shake = 10;
    pauseBackgroundMusic(this.audio);
    this.updateRevivePrompt();
    this.dom.reviveUseBtn.disabled = !this.canRevive();
    this.dom.reviveModal.hidden = false;
    this.dom.reviveUseBtn.focus();
  }

  closeRevivePrompt() {
    if (this.dom.reviveModal) {
      this.dom.reviveModal.hidden = true;
    }
  }

  setGameOver() {
    if (this.canRevive()) {
      this.openRevivePrompt();
      return;
    }
    this.finalizeGameOver();
  }

  useRevive() {
    if (this.state.mode !== GAME_MODE.REVIVE || !this.canRevive()) {
      return;
    }
    this.state.revive = saveReviveState({
      ...this.state.revive,
      tickets: this.state.revive.tickets - 1
    });
    this.state.revivesUsedThisRun += 1;
    this.state.obstacles = this.state.obstacles.filter((obstacle) => obstacle.x > this.player.x + REVIVE_RULES.clearAhead);
    this.state.nextSpawn = Math.max(this.state.nextSpawn, 1);
    this.state.jumpHeld = false;
    this.state.duckHeld = false;
    this.state.jumpBuffer = 0;
    this.state.coyoteTime = PHYSICS.coyoteSeconds;
    this.state.takeoffAnim = 0;
    this.state.landAnim = 0;
    this.state.invulnerableReason = "";
    this.state.invulnerableGrace = REVIVE_RULES.invulnerabilitySeconds;
    Object.assign(this.player, {
      y: CANVAS.groundY,
      vy: 0,
      onGround: true,
      ducking: false,
      jumpTime: 0
    });
    this.closeRevivePrompt();
    this.hideMessage();
    this.setMode(GAME_MODE.RUNNING);
    this.addPuff(this.player.x + 48, CANVAS.groundY + 4, 10);
    this.updateHud();
    unlockAudio(this.audio);
    playBackgroundMusic(this.audio);
  }

  finalizeGameOver() {
    if (this.state.finalizedRun) {
      return;
    }
    this.state.finalizedRun = true;
    this.closeRevivePrompt();
    this.setMode(GAME_MODE.GAME_OVER);
    this.state.shake = 14;
    pauseBackgroundMusic(this.audio);
    playGameOverSound(this.audio);
    this.state.revive = advanceReviveProgress(this.state.revive);
    if (this.state.score > this.state.hiScore) {
      this.state.hiScore = Math.floor(this.state.score);
      saveHiScore(this.state.hiScore);
    }
    this.updateHud();
    this.showMessage("撞上障碍了", "按空格或点跳跃重新开始。空中按下蹲可以快速落地。");
    this.leaderboard.recordScore(this.state.score).finally(() => this.leaderboard.open());
  }

  togglePause() {
    if (this.state.mode === GAME_MODE.RUNNING) {
      this.setMode(GAME_MODE.PAUSED);
      pauseBackgroundMusic(this.audio);
      this.showMessage("暂停中", "按暂停键、P 或空格继续。");
      return;
    }
    if (this.state.mode === GAME_MODE.PAUSED) {
      this.setMode(GAME_MODE.RUNNING);
      this.hideMessage();
      unlockAudio(this.audio);
      playBackgroundMusic(this.audio);
    }
  }

  startJump() {
    if (!this.state.hasEntered) {
      this.openEntryModal();
      return;
    }
    this.state.jumpHeld = true;
    if (this.state.mode === GAME_MODE.READY || this.state.mode === GAME_MODE.GAME_OVER) {
      this.resetGame();
      return;
    }
    if (this.state.mode === GAME_MODE.REVIVE) {
      this.state.jumpHeld = false;
      return;
    }
    if (this.state.mode === GAME_MODE.PAUSED) {
      this.togglePause();
      return;
    }
    this.state.jumpBuffer = PHYSICS.jumpBufferSeconds;
    this.startBufferedJump();
  }

  endJump() {
    this.state.jumpHeld = false;
    if (this.player.vy < PHYSICS.jumpCutVelocity) {
      this.player.vy = PHYSICS.jumpCutVelocity;
    }
  }

  startDuck() {
    if (!this.state.hasEntered) {
      this.openEntryModal();
      return;
    }
    this.state.duckHeld = true;
    if (this.state.mode === GAME_MODE.READY || this.state.mode === GAME_MODE.GAME_OVER) {
      this.resetGame();
      return;
    }
    if (this.state.mode === GAME_MODE.REVIVE) {
      this.state.duckHeld = false;
      return;
    }
    if (this.state.mode !== GAME_MODE.RUNNING) {
      return;
    }
    if (!this.player.onGround) {
      this.state.jumpHeld = false;
      this.player.vy = Math.max(this.player.vy, PHYSICS.airDuckDropVelocity);
    }
  }

  endDuck() {
    this.state.duckHeld = false;
    this.player.ducking = false;
  }

  addPuff(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      this.state.puffs.push({
        x,
        y,
        vx: -70 - Math.random() * 90,
        vy: -50 + Math.random() * 80,
        r: 7 + Math.random() * 8,
        life: 0.5 + Math.random() * 0.25
      });
    }
  }

  update(dt) {
    if (this.state.mode !== GAME_MODE.RUNNING) {
      this.state.shake = Math.max(0, this.state.shake - 28 * dt);
      return;
    }

    this.state.elapsed += dt;
    const cfg = this.currentDifficulty();
    const pressure = scorePressure(this.state, cfg);
    this.state.jumpBuffer = Math.max(0, this.state.jumpBuffer - dt);
    this.state.takeoffAnim = Math.max(0, this.state.takeoffAnim - dt);
    this.state.landAnim = Math.max(0, this.state.landAnim - dt);
    if (this.player.onGround) {
      this.state.coyoteTime = PHYSICS.coyoteSeconds;
    } else {
      this.state.coyoteTime = Math.max(0, this.state.coyoteTime - dt);
    }
    this.startBufferedJump();
    updateEffects(this.state, this.player, dt);
    const jetpackBoost = hasEffect(this.state, "jetpack") ? EFFECTS.jetpack.speedBoost : 1;
    this.state.speed = Math.min(
      (cfg.maxSpeed + pressure * cfg.lateSpeedBonus) * jetpackBoost,
      (cfg.baseSpeed + this.state.elapsed * cfg.ramp + pressure * cfg.speedPressure) * jetpackBoost
    );
    addScore(this.state, dt * (18 + this.state.speed / 28), pressure);
    this.state.beltOffset = (this.state.beltOffset + this.state.speed * dt) % 120;
    this.state.nextSpawn -= dt;
    this.state.nextCollectible -= dt;
    this.player.runPhase += dt * (3.6 + this.state.speed / 220);

    if (this.state.nextSpawn <= 0) {
      spawnObstacle(this.state, cfg, pressure, this.worldWidth);
    }
    if (this.state.nextCollectible <= 0) {
      spawnCollectible(this.state, pressure, this.worldWidth);
    }

    this.player.ducking = this.state.duckHeld && this.player.onGround;
    if (!this.player.onGround && this.state.duckHeld) {
      this.state.jumpHeld = false;
      this.player.vy = Math.min(this.player.vy + PHYSICS.airDuckGravity * dt, PHYSICS.airDuckMaxVelocity);
    }

    const gravity = this.state.jumpHeld && this.player.vy < 0 && this.player.jumpTime < PHYSICS.jumpHoldSeconds
      ? PHYSICS.jumpHoldGravity
      : PHYSICS.gravity;
    this.player.jumpTime += dt;
    this.player.vy += gravity * dt;
    this.player.y += this.player.vy * dt;

    if (this.player.y >= CANVAS.groundY) {
      const wasAirborne = !this.player.onGround;
      if (wasAirborne && this.player.vy > 380) {
        this.addPuff(this.player.x + 35, CANVAS.groundY + 5, 4);
      }
      this.player.y = CANVAS.groundY;
      this.player.vy = 0;
      this.player.onGround = true;
      this.state.coyoteTime = PHYSICS.coyoteSeconds;
      if (wasAirborne) {
        this.state.takeoffAnim = 0;
        this.state.landAnim = PHYSICS.landAnimSeconds;
        this.startBufferedJump();
      }
    } else {
      this.player.onGround = false;
    }
    updateLandingInvulnerability(this.state, this.player);

    for (const obstacle of this.state.obstacles) {
      obstacle.x -= this.state.speed * dt;
      obstacle.bob += dt * 4.2;
      if (!obstacle.passed && obstacle.x + obstacle.w < this.player.x) {
        obstacle.passed = true;
        addScore(this.state, 75, pressure);
      }
    }
    this.state.obstacles = this.state.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -90);

    for (const collectible of this.state.collectibles) {
      collectible.x -= this.state.speed * dt * 0.92;
      collectible.bob += dt * 4.8;
      collectible.spin += dt * 3.4;
      if (!collectible.collected && collidesCollectible(this.player, collectible)) {
        collectible.collected = true;
        activateEffect(this.state, this.player, collectible.effect);
        addScore(this.state, 120, pressure);
        this.addPuff(collectible.x + collectible.w / 2, collectible.y + collectible.h / 2, 7);
      }
    }
    this.state.collectibles = this.state.collectibles.filter((item) => !item.collected && item.x + item.w > -90);

    for (const puff of this.state.puffs) {
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.life -= dt;
      puff.r *= 0.985;
    }
    this.state.puffs = this.state.puffs.filter((puff) => puff.life > 0);

    if (!isInvulnerable(this.state) && this.state.obstacles.some((obstacle) => collides(this.player, obstacle))) {
      this.setGameOver();
    }

    this.updateHud();
  }

  draw() {
    this.renderer.draw(this.worldWidth);
  }

  loop = (time) => {
    const dt = Math.min(0.026, (time - this.state.lastTime) / 1000 || 0);
    this.state.lastTime = time;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  };

  bindHold(button, start, end) {
    let activePointerId = null;
    const finish = (event) => {
      event.preventDefault();
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }
      activePointerId = null;
      end();
      try {
        button.releasePointerCapture?.(event.pointerId);
      } catch {
        // Some mobile browsers can invalidate pointer capture during gesture cancellation.
      }
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (activePointerId !== null) {
        return;
      }
      activePointerId = event.pointerId;
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {
        // The hold state still works without pointer capture.
      }
      start();
    });
    button.addEventListener("pointerup", finish);
    button.addEventListener("pointercancel", finish);
    button.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && event.buttons) {
        finish(event);
      }
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  bindEvents() {
    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target) || event.repeat) {
        return;
      }
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        this.startJump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        this.startDuck();
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        this.togglePause();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        this.endJump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        this.endDuck();
      }
    });

    this.bindHold(this.dom.jumpBtn, () => this.startJump(), () => this.endJump());
    this.bindHold(this.dom.duckBtn, () => this.startDuck(), () => this.endDuck());

    document.querySelector(".game-shell").addEventListener("selectstart", (event) => {
      if (!isTypingTarget(event.target)) {
        event.preventDefault();
      }
    });
    document.querySelector(".game-shell").addEventListener("contextmenu", (event) => {
      if (!isTypingTarget(event.target)) {
        event.preventDefault();
      }
    });
    document.querySelector(".game-shell").addEventListener("dragstart", (event) => {
      if (!isTypingTarget(event.target)) {
        event.preventDefault();
      }
    });

    this.dom.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      try {
        this.dom.canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Canvas jumps still work without pointer capture.
      }
      this.startJump();
    });
    const finishCanvasJump = (event) => {
      event.preventDefault();
      this.endJump();
      try {
        this.dom.canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        // Some mobile browsers clear capture during gesture cancellation.
      }
    };
    this.dom.canvas.addEventListener("pointerup", finishCanvasJump);
    this.dom.canvas.addEventListener("pointercancel", finishCanvasJump);
    this.dom.canvas.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && event.buttons) {
        finishCanvasJump(event);
      }
    });
    for (const button of this.dom.difficultyBtns) {
      button.addEventListener("click", () => this.setDifficulty(button.dataset.difficulty));
    }
    this.dom.entryStartBtn.addEventListener("click", () => this.startFromEntry());
    this.dom.entryRankBtn.addEventListener("click", () => this.leaderboard.open());
    this.dom.playerNameInput.addEventListener("keydown", (event) => {
      if (event.code === "Enter") {
        event.preventDefault();
        this.startFromEntry();
      }
    });
    this.dom.rankBtn.addEventListener("click", () => this.leaderboard.open());
    for (const button of this.dom.leaderboardTabs) {
      button.addEventListener("click", () => {
        if (button.dataset.view === "more") {
          this.state.leaderboardView = "more";
          this.state.moreLeaderboardView ||= "region";
        } else {
          this.state.leaderboardView = "score";
          this.state.leaderboardDifficulty = button.dataset.difficulty;
        }
        this.leaderboard.updateTabs();
        this.leaderboard.render();
      });
    }
    for (const button of this.dom.leaderboardMoreChoiceBtns) {
      button.addEventListener("click", () => {
        this.state.moreLeaderboardView = button.dataset.moreView;
        this.leaderboard.updateTabs();
        this.leaderboard.render();
      });
    }
    this.dom.closeLeaderboardBtn.addEventListener("click", () => this.leaderboard.close());
    this.dom.clearLeaderboardBtn.addEventListener("click", () => this.leaderboard.render());
    this.dom.leaderboardModal.addEventListener("click", (event) => {
      if (event.target === this.dom.leaderboardModal) {
        this.leaderboard.close();
      }
    });
    this.dom.reviveUseBtn.addEventListener("click", () => this.useRevive());
    this.dom.reviveEndBtn.addEventListener("click", () => this.finalizeGameOver());
    this.dom.feedbackBtn.addEventListener("click", () => {
      this.dom.feedbackModal.hidden = false;
    });
    this.dom.shareBtn.addEventListener("click", () => this.shareGame());
    this.dom.closeFeedbackBtn.addEventListener("click", () => {
      this.dom.feedbackModal.hidden = true;
    });
    this.dom.feedbackModal.addEventListener("click", (event) => {
      if (event.target === this.dom.feedbackModal) {
        this.dom.feedbackModal.hidden = true;
      }
    });
    this.dom.soundBtn.addEventListener("click", () => {
      unlockAudio(this.audio);
      setSoundEnabled(this.audio, !this.audio.enabled);
      this.updateSoundButton();
      if (this.audio.enabled && this.state.mode === GAME_MODE.RUNNING) {
        playBackgroundMusic(this.audio);
      } else if (!this.audio.enabled) {
        pauseBackgroundMusic(this.audio);
      }
    });
    this.dom.pauseBtn.addEventListener("click", () => this.togglePause());
    this.dom.restartBtn.addEventListener("click", () => this.resetGame());
    window.addEventListener("resize", () => this.syncCanvasLayout());
    window.addEventListener("orientationchange", () => setTimeout(() => this.syncCanvasLayout(), 120));
  }

  start() {
    this.syncCanvasLayout();
    this.updateHud();
    this.updateSoundButton();
    this.updateDifficultyButtons();
    this.showMessage("开跑！", "后期速度越快得分倍率越高。空中道具很少，跳起来捡。");
    this.openEntryModal();
    this.bindEvents();
    requestAnimationFrame(this.loop);
  }
}
