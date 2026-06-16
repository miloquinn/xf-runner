import { createCloudSession, fetchCloudLeaderboard, submitCloudScore } from "../api/leaderboardApi.js?v=20260616-1420";
import {
  cleanName,
  escapeHtml,
  loadLeaderboard,
  loadTotalGames,
  pad,
  saveLeaderboard,
  saveTotalGames
} from "../core/storage.js?v=20260616-1420";

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
  let latestInsights = emptyInsights;
  let activeSession = "";
  let sessionRequestId = 0;

  function updateMeta(totalGames = loadTotalGames(), totalPlayers = state.totalPlayers) {
    const games = Math.max(0, Number(totalGames) || 0);
    const players = Math.max(0, Number(totalPlayers) || 0);
    state.totalPlayers = players;
    dom.totalGamesNode.textContent = `总玩家 ${players} · 总局数 ${games}`;
  }

  function updateTabs() {
    for (const button of dom.leaderboardTabs) {
      const isMore = button.dataset.view === "more";
      const pressed = isMore
        ? state.leaderboardView === "more"
        : state.leaderboardView !== "more" && button.dataset.difficulty === state.leaderboardDifficulty;
      button.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
    dom.leaderboardMoreChoices.hidden = state.leaderboardView !== "more";
    for (const button of dom.leaderboardMoreChoiceBtns) {
      button.setAttribute("aria-pressed", button.dataset.moreView === state.moreLeaderboardView ? "true" : "false");
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

  function countRowHtml(row, rank, current = false) {
    const suffix = current ? " · 你" : "";
    return `
      <div class="leaderboard-row${current ? " current-player" : ""}">
        <span>${rank}</span>
        <span>${escapeHtml(row.label)}${suffix}</span>
        <span class="score">${row.games}局</span>
      </div>
    `;
  }

  function renderScoreRows(rows) {
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

  function renderCountRows(rows, options) {
    const allRows = normalizeCountRows(rows, options.labelKey);
    if (!allRows.length) {
      dom.leaderboardList.innerHTML = `<p>${options.emptyText}</p>`;
      return;
    }

    const playerName = cleanName(getPlayerName());
    const currentIndex = options.trackCurrent && playerName
      ? allRows.findIndex((row) => row.label === playerName)
      : -1;
    const visibleRows = allRows.slice(0, visibleLimit);
    const html = visibleRows.map((row, index) => countRowHtml(row, index + 1, options.trackCurrent && index === currentIndex));
    if (currentIndex >= visibleLimit) {
      dom.currentRankSummary.hidden = false;
      dom.currentRankSummary.innerHTML = `
        <span>你的排名</span>
        ${countRowHtml(allRows[currentIndex], currentIndex + 1, true)}
      `;
    }
    const remaining = Math.max(0, allRows.length - visibleRows.length);
    html.push(`<div class="leaderboard-summary">${options.summaryLabel}共 ${allRows.length} ${options.unit}，显示前 ${visibleRows.length} 名，剩余 ${remaining} ${options.unit}未显示</div>`);
    dom.leaderboardList.innerHTML = html.join("");
  }

  function renderMoreRows() {
    if (state.moreLeaderboardView === "games") {
      renderCountRows(latestInsights.playerGames, {
        labelKey: "name",
        emptyText: "暂无局数数据，先跑一局。",
        summaryLabel: "局数榜",
        unit: "人",
        trackCurrent: true
      });
      return;
    }
    renderCountRows(latestInsights.regionStats, {
      labelKey: "region",
      emptyText: "暂无地区数据，先跑一局。",
      summaryLabel: "地区榜",
      unit: "个地区",
      trackCurrent: false
    });
  }

  async function render() {
    dom.leaderboardList.innerHTML = "<p>正在读取排行榜...</p>";
    dom.currentRankSummary.hidden = true;
    dom.currentRankSummary.innerHTML = "";
    updateMeta(loadTotalGames(), state.totalPlayers);
    updateTabs();
    let rows;
    latestInsights = emptyInsights;
    try {
      const result = await fetchCloudLeaderboard();
      rows = result.scores;
      latestInsights = {
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

    if (state.leaderboardView === "more") {
      renderMoreRows();
      return;
    }
    renderScoreRows(rows);
  }

  async function recordScore(score) {
    const finalScore = Math.floor(score);
    if (finalScore <= 0) {
      return;
    }
    const entry = {
      name: getPlayerName() || "同学",
      score: finalScore,
      difficulty: getDifficultyLabel(),
      session: activeSession
    };
    activeSession = "";
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
    state.leaderboardView = "score";
    state.moreLeaderboardView = state.moreLeaderboardView || "region";
    state.leaderboardDifficulty = getDifficultyLabel();
    updateTabs();
    dom.leaderboardModal.hidden = false;
    render();
  }

  function startSession(difficulty) {
    activeSession = "";
    const requestId = ++sessionRequestId;
    createCloudSession(difficulty)
      .then((result) => {
        if (requestId === sessionRequestId) {
          activeSession = result.session;
        }
      })
      .catch((error) => {
        console.warn("开局令牌获取失败，本局可能只保留本地成绩", error);
      });
  }

  function close() {
    dom.leaderboardModal.hidden = true;
  }

  return {
    updateMeta,
    updateTabs,
    render,
    recordScore,
    startSession,
    open,
    close
  };
}
