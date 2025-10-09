export const colors = {
  bg: "#E1F5FE",
  bgAlt: "#B3E5FC",
  bgGradient: ["#E1F5FE", "#B3E5FC", "#81D4FA"],
  primary: "#0288D1",
  primaryDark: "#01579B",
  primaryLight: "#4FC3F7",
  secondary: "#5C6BC0",
  secondaryDark: "#3949AB",
  text: "#0D47A1",
  textSecondary: "#455A64",
  textMuted: "#0277BD",
  white: "#ffffff",
  card: "#ffffff",
  cardHover: "#f5f5f5",
  success: "#2e7d32",
  successLight: "#4caf50",
  warning: "#f57c00",
  warningLight: "#ff9800",
  danger: "#c62828",
  dangerLight: "#ef5350",
  info: "#0288D1",
  infoLight: "#4FC3F7",
  border: "#e0e0e0",
  borderLight: "#f5f5f5",
  overlay: "rgba(0,0,0,0.5)",
};

export const gradients = {
  primary: ["#4FC3F7", "#0288D1", "#01579B"],
  secondary: ["#7E57C2", "#5C6BC0", "#3949AB"],
  calm: ["#81D4FA", "#4FC3F7", "#29B6F6"],
  sunset: ["#FFAB91", "#FF7043", "#F4511E"],
  success: ["#66BB6A", "#4CAF50", "#388E3C"],
  card: ["#ffffff", "#fafafa"],
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: "700", lineHeight: 40 },
  h2: { fontSize: 28, fontWeight: "700", lineHeight: 36 },
  h3: { fontSize: 24, fontWeight: "600", lineHeight: 32 },
  h4: { fontSize: 20, fontWeight: "600", lineHeight: 28 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  bodyLarge: { fontSize: 18, fontWeight: "400", lineHeight: 28 },
  caption: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  small: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
};

export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
};

export const animations = {
  fast: 150,
  normal: 250,
  slow: 400,
};
