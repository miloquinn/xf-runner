export function getDom() {
  const dom = {
    canvas: document.getElementById("gameCanvas"),
    scoreNode: document.getElementById("score"),
    hiScoreNode: document.getElementById("hiScore"),
    effectStrip: document.getElementById("effectStrip"),
    overlay: document.getElementById("overlay"),
    message: document.getElementById("message"),
    messageTitle: document.getElementById("messageTitle"),
    messageText: document.getElementById("messageText"),
    jumpBtn: document.getElementById("jumpBtn"),
    duckBtn: document.getElementById("duckBtn"),
    soundBtn: document.getElementById("soundBtn"),
    rankBtn: document.getElementById("rankBtn"),
    feedbackBtn: document.getElementById("feedbackBtn"),
    shareBtn: document.getElementById("shareBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    restartBtn: document.getElementById("restartBtn"),
    difficultyBtns: [...document.querySelectorAll(".difficultyBtn")],
    entryModal: document.getElementById("entryModal"),
    entryStartBtn: document.getElementById("entryStartBtn"),
    entryRankBtn: document.getElementById("entryRankBtn"),
    playerNameInput: document.getElementById("playerNameInput"),
    leaderboardModal: document.getElementById("leaderboardModal"),
    leaderboardList: document.getElementById("leaderboardList"),
    leaderboardMoreChoices: document.getElementById("leaderboardMoreChoices"),
    leaderboardMoreChoiceBtns: [...document.querySelectorAll(".leaderboardMoreChoice")],
    currentRankSummary: document.getElementById("currentRankSummary"),
    totalGamesNode: document.getElementById("totalGames"),
    closeLeaderboardBtn: document.getElementById("closeLeaderboardBtn"),
    clearLeaderboardBtn: document.getElementById("clearLeaderboardBtn"),
    leaderboardTabs: [...document.querySelectorAll(".leaderboardTab")],
    reviveModal: document.getElementById("reviveModal"),
    reviveText: document.getElementById("reviveText"),
    reviveUseBtn: document.getElementById("reviveUseBtn"),
    reviveEndBtn: document.getElementById("reviveEndBtn"),
    feedbackModal: document.getElementById("feedbackModal"),
    closeFeedbackBtn: document.getElementById("closeFeedbackBtn")
  };
  dom.ctx = dom.canvas.getContext("2d");
  return dom;
}

export function isTypingTarget(target) {
  return target && (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
