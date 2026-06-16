import { fetchCloudLeaderboard, submitCloudScore } from "../api/leaderboardApi.js?v=20260616-1220";
import {
  cleanName,
  escapeHtml,
  loadLeaderboard,
  loadTotalGames,
  pad,
  saveLeaderboard,
  saveTotalGames
} from "../core/storage.js?v=20260616-1220";

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
  const emptyInsights = { regionStats: [], playerGames: [] };

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

  function normalizeCountRows(rows, labelKey) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        label: String(row?.[labelKey] || row?.name || "").trim(),
        games: Math.max(0, Math.floor(Number(row?.games) || 0))
      }))
      .filter((row) => row.label && row.games > 0);
  }

  function renderRegionStats(rows) {
    const regions = normalizeCountRows(rows, "region").slice(0, 8);
    if (!regions.length) {
      return `
        <section class="insight-card">
          <h3>地区分布</h3>
          <small>从新版上线后开始按地区统计，不保存明文 IP。</small>
          <p>暂无地区数据。</p>
        </section>
      `;
    }
    const max = Math.max(...regions.map((row) => row.games), 1);
    const bars = regions.map((row) => {
      const width = Math.max(8, Math.round((row.games / max) * 100));
      return `
        <div class="insight-bar">
          <span>${escapeHtml(row.label)}</span>
          <span class="insight-track"><span class="insight-fill" style="width:${width}%"></span></span>
          <span>${row.games}</span>
        </div>
      `;
    });
    return `
      <section class="insight-card">
        <h3>地区分布</h3>
        <small>按提交成绩时的网络地区聚合，不展示 IP。</small>
        <div class="insight-bars">${bars.join("")}</div>
      </section>
    `;
  }

  function renderPlayerGames(rows) {
    const players = normalizeCountRows(rows, "name").slice(0, 8);
    if (!players.length) {
      return `
        <section class="insight-card">
          <h3>局数排名</h3>
          <small>从新版上线后开始累计每个玩家提交局数。</small>
          <p>暂无局数数据。</p>
        </section>
      `;
    }
    const list = players.map((row, index) => `
      <div class="insight-rank-row">
        <span>${index + 1}</span>
        <span>${escapeHtml(row.label)}</span>
        <span>${row.games}局</span>
      </div>
    `);
    return `
      <section class="insight-card">
        <h3>局数排名</h3>
        <small>历史旧数据只保留最高分，完整局数从新版开始累计。</small>
        <div class="insight-rank">${list.join("")}</div>
      </section>
    `;
  }

  function renderInsights(insights = emptyInsights) {
    dom.leaderboardInsights.hidden = false;
    dom.leaderboardInsights.innerHTML = [
      renderRegionStats(insights.regionStats),
      renderPlayerGames(insights.playerGames)
    ].join("");
  }

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
    dom.leaderboardInsights.hidden = true;
    dom.leaderboardInsights.innerHTML = "";
    dom.currentRankSummary.hidden = true;
    dom.currentRankSummary.innerHTML = "";
    updateMeta(loadTotalGames(), state.totalPlayers);
    let rows;
    let insights = emptyInsights;
    try {
      const result = await fetchCloudLeaderboard();
      rows = result.scores;
      insights = {
        regionStats: result.regionStats,
        playerGames: result.playerGames
      };
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
      renderInsights(insights);
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
    renderInsights(insights);
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
