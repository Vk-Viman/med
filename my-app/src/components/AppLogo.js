import React from "react";
import { Image } from "react-native";

export default function AppLogo({ size = 64, style }) {
  return (
    <Image
      source={require("../../assets/icon.png")}
      style={[{ width: size, height: size, borderRadius: 16 }, style]}
      resizeMode="contain"
      accessible
      accessibilityLabel="App logo"
    />
  );
}
