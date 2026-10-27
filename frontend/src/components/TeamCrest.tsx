import { teamColor, teamMonogram } from "@/lib/teams";
import type { Team } from "@/lib/types";

/** Shield in the team colour with its monogram. Decorative: the name is always shown next to it. */
export function TeamCrest({ team, size = 48 }: { team: Team; size?: number }) {
  const color = teamColor(team);
  return (
    <svg
      className="team-crest"
      viewBox="0 0 48 56"
      width={size}
      height={(size * 56) / 48}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 1 L46 7 V27 C46 41 36 50 24 55 C12 50 2 41 2 27 V7 Z" fill={color} />
      <path d="M24 6 L41 10.8 V27 C41 38.5 33 46 24 50 C15 46 7 38.5 7 27 V10.8 Z" className="team-crest__field" />
      <path d="M7 10.8 L24 6 L41 10.8 V17 L24 12.2 L7 17 Z" fill={color} />
      <text x="24" y="38" textAnchor="middle" className="team-crest__monogram" fill={color}>
        {teamMonogram(team.name)}
      </text>
    </svg>
  );
}
