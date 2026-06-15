export const CANVAS = {
  defaultWidth: 1280,
  mobilePortraitWidth: 860,
  height: 488,
  groundY: 338,
  floorY: 414
};

export const PHYSICS = {
  jumpVelocity: -910,
  jumpHoldGravity: 1320,
  gravity: 3050,
  jumpHoldSeconds: 0.18,
  jumpCutVelocity: -370,
  jumpBufferSeconds: 0.16,
  coyoteSeconds: 0.105,
  takeoffAnimSeconds: 0.09,
  landAnimSeconds: 0.11,
  airDuckDropVelocity: 920,
  airDuckGravity: 7000,
  airDuckMaxVelocity: 1680,
  jetpackHoverY: CANVAS.groundY - 150,
  jetpackCeilingY: CANVAS.groundY - 185
};

export const GAME_MODE = {
  READY: "ready",
  RUNNING: "running",
  PAUSED: "paused",
  REVIVE: "revive",
  GAME_OVER: "gameover"
};

export const ENTITY_KIND = {
  GROUND: "ground",
  DOUBLE: "double",
  FLY: "fly",
  SODA: "soda"
};

export const COLLECTIBLE_KIND = {
  SCORE5: "score5",
  SCORE10: "score10",
  JETPACK: "jetpack"
};

export const STORAGE_KEYS = {
  hiScore: "zxf-runner-hi-score",
  sound: "zxf-runner-sound-enabled",
  difficulty: "zxf-runner-difficulty",
  playerName: "xuefeng-runner-player-name",
  leaderboard: "xuefeng-runner-leaderboard",
  totalGames: "xuefeng-runner-total-games",
  reviveState: "zxf-runner-revive-state"
};

export const REVIVE_RULES = {
  gamesPerTicket: 5,
  maxTickets: 3,
  maxPerRun: 2,
  invulnerabilitySeconds: 1.35,
  clearAhead: 340
};

export const PATHS = {
  assets: "assets/",
  audio: "assets/audio/"
};
