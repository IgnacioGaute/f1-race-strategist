// Presentation-only rounding: the backend keeps full precision.

export interface Formatters {
  number: (value: number, decimals?: number) => string;
  seconds: (value: number, decimals?: number) => string;
  signedSeconds: (value: number, decimals?: number) => string;
  /** 5214.2575 → "1:26:54,258" (es) / "1:26:54.258" (en); 91.5 → "1:31,500". */
  raceTime: (totalSeconds: number) => string;
  /** Up to `maxDecimals` decimals (0 by default): 0.0161 → "2 %", or "1,6 %" with 1. */
  percent: (value: number, maxDecimals?: number) => string;
  /** Race dates are calendar dates (YYYY-MM-DD); formatted in UTC to avoid shifts. */
  date: (isoDate: string) => string;
  dateTime: (isoDateTime: string) => string;
}

export function createFormatters(intlLocale: string): Formatters {
  const number = (value: number, decimals = 2) =>
    value.toLocaleString(intlLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  const decimalSeparator = number(1.5, 1).charAt(1);

  return {
    number,
    seconds: (value, decimals = 3) => `${number(value, decimals)} s`,
    signedSeconds: (value, decimals = 3) => {
      const sign = value > 0 ? "+" : value < 0 ? "−" : "";
      return `${sign}${number(Math.abs(value), decimals)} s`;
    },
    raceTime: (totalSeconds) => {
      const totalMs = Math.round(totalSeconds * 1000);
      const hours = Math.floor(totalMs / 3_600_000);
      const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
      const seconds = Math.floor((totalMs % 60_000) / 1000);
      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");
      const ms = String(totalMs % 1000).padStart(3, "0");
      const tail = `${ss}${decimalSeparator}${ms}`;
      return hours > 0 ? `${hours}:${mm}:${tail}` : `${minutes}:${tail}`;
    },
    // Locale-aware spacing: "69 %" in Spanish, "69%" in English.
    percent: (value, maxDecimals = 0) =>
      value.toLocaleString(intlLocale, { style: "percent", maximumFractionDigits: maxDecimals }),
    date: (isoDate) =>
      new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    dateTime: (isoDateTime) =>
      new Date(isoDateTime).toLocaleString(intlLocale, {
        dateStyle: "short",
        timeStyle: "short",
      }),
  };
}
