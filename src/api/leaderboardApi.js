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
    totalPlayers: Number(data.total_players ?? data.totalPlayers ?? 0) || 0,
    regionStats: Array.isArray(data.region_stats) ? data.region_stats : [],
    playerGames: Array.isArray(data.player_games) ? data.player_games : []
  };
}

export async function createCloudSession(difficulty) {
  const params = new URLSearchParams({ difficulty });
  const response = await fetch(`/api/session?${params.toString()}`, {
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`session ${response.status}`);
  }
  const data = await response.json();
  if (!data.session) {
    throw new Error("invalid session response");
  }
  return {
    session: String(data.session),
    expiresIn: Number(data.expires_in ?? data.expiresIn ?? 0) || 0
  };
}

export async function validateCloudName(name) {
  const params = new URLSearchParams({ name });
  const response = await fetch(`/api/name-check?${params.toString()}`, {
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`name-check ${response.status}`);
  }
  const data = await response.json();
  return {
    ok: Boolean(data.ok),
    name: String(data.name || ""),
    reason: String(data.reason || data.error || "")
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
    totalPlayers: Number(data.total_players ?? data.totalPlayers ?? 0) || 0,
    regionStats: Array.isArray(data.region_stats) ? data.region_stats : [],
    playerGames: Array.isArray(data.player_games) ? data.player_games : []
  };
}
