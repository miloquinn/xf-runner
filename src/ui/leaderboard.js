import { fetchCloudLeaderboard, submitCloudScore } from "../api/leaderboardApi.js?v=20260615-1015";
import {
  cleanName,
  escapeHtml,
  loadLeaderboard,
  loadTotalGames,
  pad,
  saveLeaderboard,
  saveTotalGames
} from "../core/storage.js?v=20260615-1015";

export function bestScoresByPlayer(rows, difficulty) {
  const best = new Map();
  for (const row of rows) {
    if (difficulty && row.difficulty !== difficulty) {
      continue;
    }
    const name = cleanName(row.name || "同学");
    const score = Number(row.score) || 0;
    const previous = best.get(name);
    if (!previous || score > previous.score) {
      best.set(name, {
        name,
        score,
        difficulty: row.difficulty || "",
        at: row.at || ""
      });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || String(a.at).localeCompare(String(b.at)));
}

export function createLeaderboard(dom, state, getDifficultyLabel, getPlayerName) {
  function updateMeta(totalGames = loadTotalGames(), totalPlayers = state.totalPlayers) {
    const games = Math.max(0, Number(totalGames) || 0);
    const players = Math.max(0, Number(totalPlayers) || 0);
    state.totalPlayers = players;
    dom.totalGamesNode.textContent = `总玩家 ${players} · 总局数 ${games}`;
  }

  function updateTabs() {
    for (const button of dom.leaderboardTabs) {
      button.setAttribute("aria-pressed", button.dataset.difficulty === state.leaderboardDifficulty ? "true" : "false");
    }
  }

  const visibleLimit = 100;

  function rowHtml(row, rank, current) {
    const suffix = current ? " · 你" : "";
    return `
      <div class="leaderboard-row${current ? " current-player" : ""}">
        <span>${rank}</span>
        <span>${escapeHtml(row.name)}${suffix}</span>
        <span class="score">${pad(row.score)}</span>
      </div>
    `;
  }

  async function render() {
    dom.leaderboardList.innerHTML = "<p>正在读取排行榜...</p>";
    dom.currentRankSummary.hidden = true;
    dom.currentRankSummary.innerHTML = "";
    updateMeta(loadTotalGames(), state.totalPlayers);
    let rows;
    try {
      const result = await fetchCloudLeaderboard();
      rows = result.scores;
      saveLeaderboard(rows, bestScoresByPlayer);
      saveTotalGames(result.totalGames);
      updateMeta(result.totalGames, result.totalPlayers);
    } catch (error) {
      console.warn("排行榜读取失败，显示本地缓存", error);
      rows = loadLeaderboard();
    }

    rows = bestScoresByPlayer(rows, state.leaderboardDifficulty);
    if (!rows.length) {
      dom.leaderboardList.innerHTML = '<p>这个难度还没有成绩，先跑一局。</p>';
      return;
    }

    const playerName = cleanName(getPlayerName());
    const currentIndex = playerName ? rows.findIndex((row) => row.name === playerName) : -1;
    const visibleRows = rows.slice(0, visibleLimit);
    const html = visibleRows.map((row, index) => rowHtml(row, index + 1, index === currentIndex));
    if (currentIndex >= visibleLimit) {
      dom.currentRankSummary.hidden = false;
      dom.currentRankSummary.innerHTML = `
        <span>你的排名</span>
        ${rowHtml(rows[currentIndex], currentIndex + 1, true)}
      `;
    }
    const remaining = Math.max(0, rows.length - visibleRows.length);
    html.push(`<div class="leaderboard-summary">本难度共 ${rows.length} 人，显示前 ${visibleRows.length} 名，剩余 ${remaining} 人未显示</div>`);
    dom.leaderboardList.innerHTML = html.join("");
  }

  async function recordScore(score) {
    const finalScore = Math.floor(score);
    if (finalScore <= 0) {
      return;
    }
    const entry = {
      name: getPlayerName() || "同学",
      score: finalScore,
      difficulty: getDifficultyLabel()
    };
    const rows = loadLeaderboard();
    rows.push({ ...entry, at: new Date().toISOString() });
    saveLeaderboard(rows, bestScoresByPlayer);
    updateMeta(saveTotalGames(loadTotalGames() + 1), state.totalPlayers);
    try {
      const result = await submitCloudScore(entry);
      if (result.scores.length) {
        saveLeaderboard(result.scores, bestScoresByPlayer);
      }
      if (result.totalGames) {
        saveTotalGames(result.totalGames);
      }
      if (result.totalPlayers) {
        updateMeta(result.totalGames || loadTotalGames(), result.totalPlayers);
      }
    } catch (error) {
      console.warn("成绩提交失败，已保留本地缓存", error);
    }
  }

  function open() {
    state.leaderboardDifficulty = getDifficultyLabel();
    updateTabs();
    dom.leaderboardModal.hidden = false;
    render();
  }

  function close() {
    dom.leaderboardModal.hidden = true;
  }

  return {
    updateMeta,
    updateTabs,
    render,
    recordScore,
    open,
    close
  };
}
