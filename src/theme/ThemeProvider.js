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

const ThemeCtx = createContext({ theme: light, mode: "light", toggle: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("cs_theme");
      if (saved === "dark" || saved === "light") setMode(saved);
    })();
  }, []);

  const toggle = async () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    await AsyncStorage.setItem("cs_theme", next);
  };

  const value = useMemo(() => ({ theme: mode === "light" ? light : dark, mode, toggle }), [mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
