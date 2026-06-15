export async function fetchCloudLeaderboard() {
  const response = await fetch("/api/leaderboard", {
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`leaderboard ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data.scores)) {
    throw new Error("invalid leaderboard response");
  }
  return {
    scores: data.scores,
    totalGames: Number(data.total_games ?? data.totalGames ?? data.scores.length) || 0,
    totalPlayers: Number(data.total_players ?? data.totalPlayers ?? 0) || 0
  };
}

export async function submitCloudScore(entry) {
  const response = await fetch("/api/score", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(entry)
  });
  if (!response.ok) {
    throw new Error(`score ${response.status}`);
  }
  const data = await response.json();
  return {
    scores: Array.isArray(data.scores) ? data.scores : [],
    totalGames: Number(data.total_games ?? data.totalGames ?? 0) || 0,
    totalPlayers: Number(data.total_players ?? data.totalPlayers ?? 0) || 0
  };
}
