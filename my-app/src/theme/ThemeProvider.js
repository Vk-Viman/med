import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const light = {
  bg: "#E1F5FE",
  card: "#ffffff",
  text: "#0D47A1",
  textMuted: "#0277BD",
  primary: "#0288D1",
  primaryContrast: "#ffffff",
};

const dark = {
  bg: "#0B1722",
  card: "#101D2B",
  text: "#E3F2FD",
  textMuted: "#90CAF9",
  primary: "#4FC3F7",
  primaryContrast: "#0B1722",
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
