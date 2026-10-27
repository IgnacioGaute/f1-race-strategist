// Display metadata only. The API gives each team an id, a name and a car
// performance index; colours and monograms are ours (not official logos).

import type { Team } from "./types";

const TEAM_COLORS: { match: RegExp; color: string }[] = [
  // Before "red bull", so the junior team gets its own colour.
  { match: /racing bulls|\brb\b|alphatauri|toro rosso/i, color: "#6692ff" },
  { match: /red bull/i, color: "#3671c6" },
  { match: /mclaren/i, color: "#ff8000" },
  { match: /ferrari/i, color: "#e8002d" },
  { match: /mercedes/i, color: "#27f4d2" },
  { match: /aston/i, color: "#229971" },
  { match: /alpine/i, color: "#ff87bc" },
  { match: /williams/i, color: "#64c4ff" },
  { match: /haas/i, color: "#b6babd" },
  { match: /sauber|kick|audi/i, color: "#52e252" },
];

/** For unknown teams: picked by id, so a team keeps its colour between renders. */
const FALLBACK_COLORS = ["#ff8000", "#27f4d2", "#ff87bc", "#64c4ff", "#52e252", "#e3b341", "#b18cff", "#6692ff"];

export function teamColor(team: Team): string {
  const known = TEAM_COLORS.find(({ match }) => match.test(team.name));
  if (known) return known.color;
  let hash = 0;
  for (const char of team.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** "Red Bull Racing" → "RBR", "Ferrari" → "FER". */
export function teamMonogram(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const monogram = words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map((word) => word[0]).join("");
  return monogram.toUpperCase();
}
