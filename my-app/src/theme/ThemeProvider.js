import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const light = {
  bg: "#E1F5FE",
  bgAlt: "#B3E5FC",
  bgGradient: ["#E1F5FE", "#B3E5FC"],
  card: "#ffffff",
  cardHover: "#f5f5f5",
  text: "#0D47A1",
  textSecondary: "#455A64",
  textMuted: "#0277BD",
  primary: "#0288D1",
  primaryLight: "#4FC3F7",
  primaryDark: "#01579B",
  primaryContrast: "#ffffff",
  secondary: "#5C6BC0",
  success: "#4CAF50",
  warning: "#FF9800",
  danger: "#EF5350",
  info: "#4FC3F7",
  border: "#e0e0e0",
  borderLight: "#f5f5f5",
  overlay: "rgba(0,0,0,0.5)",
};

const dark = {
  bg: "#0B1722",
  bgAlt: "#1A2634",
  bgGradient: ["#0B1722", "#1A2634"],
  card: "#101D2B",
  cardHover: "#1A2634",
  text: "#E3F2FD",
  textSecondary: "#B0BEC5",
  textMuted: "#90CAF9",
  primary: "#4FC3F7",
  primaryLight: "#81D4FA",
  primaryDark: "#0288D1",
  primaryContrast: "#0B1722",
  secondary: "#7E57C2",
  success: "#66BB6A",
  warning: "#FFA726",
  danger: "#EF5350",
  info: "#4FC3F7",
  border: "#263238",
  borderLight: "#37474F",
  overlay: "rgba(0,0,0,0.7)",
};

const ThemeCtx = createContext({ theme: light, mode: "light", toggle: () => {}, setThemeMode: ()=>{} });

export function ThemeProvider({ children, initialMode }) {
  const [mode, setMode] = useState(initialMode === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    (async () => {
      // Allow stored override if no explicit initialMode was passed (first mount)
      const saved = await AsyncStorage.getItem("cs_theme");
      if (saved === "dark" || saved === "light") setMode(saved);
    })();
  }, []);

  const persistAndSet = async(next) => {
    setMode(next);
    await AsyncStorage.setItem("cs_theme", next);
  };
  const toggle = async () => { const next = mode === 'light' ? 'dark':'light'; await persistAndSet(next); };
  const setThemeMode = async (next) => { if(next!== 'light' && next!=='dark') return; await persistAndSet(next); };

  const value = useMemo(() => ({ theme: mode === "light" ? light : dark, mode, toggle, setThemeMode }), [mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
