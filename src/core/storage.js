import { REVIVE_RULES, STORAGE_KEYS } from "../config/constants.js?v=20260616-1350";

export function pad(value) {
  return String(Math.max(0, Math.floor(value))).padStart(5, "0");
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

const contactPatterns = [
  /(?:\+?86[-_\s]*)?1[3-9](?:[-_\s]*\d){9}/,
  /(^|\D)\d{5,12}($|\D)/,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:https?:\/\/|www\.|\.com|\.cn|\.net|\.top|\.shop)/i
];

const blockedNameWords = [
  "政治敏感",
  "敏感政治",
  "政治内容",
  "政治口号",
  "反动",
  "台独",
  "港独",
  "疆独",
  "藏独",
  "法轮功",
  "六四",
  "天安门事件",
  "qq",
  "q号",
  "vx",
  "v信",
  "wx",
  "微信",
  "手机号",
  "电话",
  "加我",
  "私聊",
  "联系我",
  "群号"
];

function normalizeNameText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z\u4e00-\u9fff]/g, "");
}

export function isAllowedPlayerName(value) {
  const raw = String(value || "").trim().normalize("NFKC");
  const normalized = normalizeNameText(raw);
  if (!raw || raw.startsWith("__")) {
    return false;
  }
  if (contactPatterns.some((pattern) => pattern.test(raw))) {
    return false;
  }
  return !blockedNameWords.some((word) => normalized.includes(normalizeNameText(word)));
}

export function cleanName(value) {
  const raw = String(value || "").trim();
  const name = raw.replace(/\s+/g, " ").slice(0, 12);
  return isAllowedPlayerName(raw) && isAllowedPlayerName(name) ? name : "";
}

export function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

export function setCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function loadPlayerName() {
  return cleanName(localStorage.getItem(STORAGE_KEYS.playerName) || getCookie(STORAGE_KEYS.playerName) || "");
}

export function savePlayerName(name) {
  const playerName = cleanName(name) || "同学";
  localStorage.setItem(STORAGE_KEYS.playerName, playerName);
  setCookie(STORAGE_KEYS.playerName, playerName);
  return playerName;
}

export function loadLeaderboard() {
  try {
    const rows = JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row && row.name && Number.isFinite(Number(row.score))) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(rows, bestScoresByPlayer) {
  localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(bestScoresByPlayer(rows, null).slice(0, 500)));
}

export function loadTotalGames() {
  return Number(localStorage.getItem(STORAGE_KEYS.totalGames) || 0) || 0;
}

export function saveTotalGames(value) {
  const total = Math.max(0, Number(value) || 0);
  localStorage.setItem(STORAGE_KEYS.totalGames, String(total));
  return total;
}

function normalizeReviveState(value) {
  const tickets = Math.min(
    REVIVE_RULES.maxTickets,
    Math.max(0, Math.floor(Number(value?.tickets) || 0))
  );
  const progress = Math.min(
    REVIVE_RULES.gamesPerTicket - 1,
    Math.max(0, Math.floor(Number(value?.progress) || 0))
  );
  return { tickets, progress };
}

export function loadReviveState() {
  try {
    return normalizeReviveState(JSON.parse(localStorage.getItem(STORAGE_KEYS.reviveState) || "{}"));
  } catch {
    return normalizeReviveState({});
  }
}

export function saveReviveState(value) {
  const reviveState = normalizeReviveState(value);
  localStorage.setItem(STORAGE_KEYS.reviveState, JSON.stringify(reviveState));
  return reviveState;
}

export function advanceReviveProgress(value) {
  const next = normalizeReviveState(value);
  next.progress += 1;
  if (next.progress >= REVIVE_RULES.gamesPerTicket) {
    next.progress = 0;
    next.tickets = Math.min(REVIVE_RULES.maxTickets, next.tickets + 1);
  }
  return saveReviveState(next);
}

export function loadHiScore() {
  return Number(localStorage.getItem(STORAGE_KEYS.hiScore) || 0) || 0;
}

export function saveHiScore(value) {
  localStorage.setItem(STORAGE_KEYS.hiScore, String(Math.floor(value)));
}
