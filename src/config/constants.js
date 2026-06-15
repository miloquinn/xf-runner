export const CANVAS = {
  defaultWidth: 1280,
  mobilePortraitWidth: 860,
  height: 488,
  groundY: 338,
  floorY: 414
};

export const PHYSICS = {
  jumpVelocity: -855,
  jumpHoldGravity: 1450,
  gravity: 2850,
  jumpHoldSeconds: 0.17,
  jumpCutVelocity: -330,
  jumpBufferSeconds: 0.12,
  coyoteSeconds: 0.08,
  takeoffAnimSeconds: 0.11,
  landAnimSeconds: 0.13,
  airDuckDropVelocity: 760,
  airDuckGravity: 6200,
  airDuckMaxVelocity: 1500,
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
