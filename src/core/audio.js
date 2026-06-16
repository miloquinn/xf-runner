import { PATHS, STORAGE_KEYS } from "../config/constants.js?v=20260616-1350";

export function createAudioController() {
  const controller = {
    enabled: localStorage.getItem(STORAGE_KEYS.sound) !== "0",
    unlocked: false,
    bgm: new Audio(PATHS.audio + "background-music.m4a"),
    gameOver: new Audio(PATHS.audio + "game-over-sfx.m4a")
  };
  controller.bgm.loop = true;
  controller.bgm.preload = "auto";
  controller.bgm.volume = 0.42;
  controller.gameOver.preload = "auto";
  controller.gameOver.volume = 0.9;
  return controller;
}

export function unlockAudio(audio) {
  if (audio.unlocked) {
    return;
  }
  audio.unlocked = true;
  audio.bgm.muted = !audio.enabled;
  audio.gameOver.muted = !audio.enabled;
}

export function playBackgroundMusic(audio) {
  if (!audio.enabled || !audio.unlocked) {
    return;
  }
  if (!audio.bgm.paused && !audio.bgm.ended) {
    return;
  }
  if (audio.playPromise) {
    return;
  }
  audio.playPromise = audio.bgm.play().catch(() => {
    audio.unlocked = false;
  }).finally(() => {
    audio.playPromise = null;
  });
}

export function pauseBackgroundMusic(audio) {
  audio.bgm.pause();
}

export function playGameOverSound(audio) {
  if (!audio.enabled || !audio.unlocked) {
    return;
  }
  audio.gameOver.currentTime = 0;
  audio.gameOver.play().catch(() => {});
}

export function setSoundEnabled(audio, enabled) {
  audio.enabled = enabled;
  localStorage.setItem(STORAGE_KEYS.sound, enabled ? "1" : "0");
  audio.bgm.muted = !enabled;
  audio.gameOver.muted = !enabled;
}
