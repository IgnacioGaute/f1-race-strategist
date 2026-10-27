// Display metadata only. Compound list and numbers come from the backend;
// translated names live in the i18n dictionaries (t.compounds).

interface CompoundStyle {
  letter: string;
  color: string;
}

const COMPOUND_STYLES: Record<string, CompoundStyle> = {
  SOFT: { letter: "S", color: "#ff3b30" },
  MEDIUM: { letter: "M", color: "#ffc400" },
  // Light grey, like the white sidewall, on the dark theme.
  HARD: { letter: "H", color: "#e6e6e6" },
  INTERMEDIATE: { letter: "I", color: "#36c95f" },
  WET: { letter: "W", color: "#3d8bff" },
};

export function compoundStyle(compound: string): CompoundStyle {
  return (
    COMPOUND_STYLES[compound] ?? {
      letter: compound.charAt(0).toUpperCase(),
      color: "#b18cff",
    }
  );
}
