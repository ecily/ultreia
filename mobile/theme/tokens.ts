// stepsmatch/mobile/theme/tokens.ts
// Centralized design tokens for Ultreia (no new deps). Compatible with JS & TS consumers.

export type ColorPalette = {
  background: string;
  surface: string;
  elevated: string;
  card: string;
  primary: string;
  primaryTextOn: string;
  accent: string;
  warning: string;
  danger: string;
  success: string;
  inkHigh: string;
  ink: string;
  inkLow: string;
  divider: string;
  muted: string;
};

export type Motion = {
  tap: number;
  card: number;
  sheet: number;
  map: number;
  easing: string;
};

export type TextScale = {
  display: { size: number; lineHeight: number; weight: "600" | "700" | "800" };
  title: { size: number; lineHeight: number; weight: "600" | "700" };
  subtitle: { size: number; lineHeight: number; weight: "500" | "600" };
  body: { size: number; lineHeight: number; weight: "400" | "500" };
  label: { size: number; lineHeight: number; weight: "500" | "600" };
  number: { size: number; lineHeight: number; weight: "700" | "800" };
};

export type Tokens = {
  colors: { light: ColorPalette; dark: ColorPalette };
  spacing: number[];
  radius: { sm: number; md: number; lg: number; pill: number };
  shadow: { card: number; sheet: number; fab: number };
  text: TextScale;
  motion: Motion;
  zIndex: { sheet: number; toast: number; fab: number; banner: number };
};

export const tokens: Tokens = {
  colors: {
    light: {
      background: "#FFFCF8",
      surface: "#FAF6EF",
      elevated: "#FFFFFF",
      card: "#FFFFFF",
      primary: "#1D4ED8",
      primaryTextOn: "#0B1220",
      accent: "#0EA5A4",
      warning: "#F59E0B",
      danger: "#EF4444",
      success: "#16A34A",
      inkHigh: "#0B1220",
      ink: "#2A3446",
      inkLow: "#6A7282",
      divider: "rgba(15,23,42,0.08)",
      muted: "#E9EEF8",
    },
    dark: {
      background: "#0A0F16",
      surface: "#0F1623",
      elevated: "#141C2B",
      card: "#0F1623",
      primary: "#1F6FEB",
      primaryTextOn: "#0B1220",
      accent: "#22C55E",
      warning: "#F59E0B",
      danger: "#EF4444",
      success: "#22C55E",
      inkHigh: "#E8F0FF",
      ink: "#C5D2E8",
      inkLow: "#9FB0C6",
      divider: "rgba(255,255,255,0.08)",
      muted: "rgba(255,255,255,0.04)",
    },
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40],
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadow: { card: 8, sheet: 16, fab: 24 },
  text: {
    display: { size: 32, lineHeight: 38, weight: "700" },
    title: { size: 24, lineHeight: 30, weight: "700" },
    subtitle: { size: 18, lineHeight: 24, weight: "600" },
    body: { size: 16, lineHeight: 22, weight: "400" },
    label: { size: 13, lineHeight: 18, weight: "600" },
    number: { size: 28, lineHeight: 34, weight: "800" },
  },
  motion: { tap: 120, card: 200, sheet: 260, map: 400, easing: "cubic-bezier(0.4, 0.0, 0.2, 1)" },
  zIndex: { sheet: 20, toast: 30, fab: 40, banner: 50 },
};

export default tokens;
