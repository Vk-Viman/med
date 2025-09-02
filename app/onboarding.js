import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, FlatList, Image } from "react-native";
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";

const slides = [
  { key: "1", title: "Welcome to Calm Space", subtitle: "Breathe, relax, and find your balance.",
    lottie: require("../assets/lottie/breathe.json"), fallback: require("../assets/splash-icon.png") },
  { key: "2", title: "Personalized Plans", subtitle: "Answer a few questions and get a tailored routine.",
    lottie: require("../assets/lottie/plan.json"), fallback: require("../assets/icon.png") },
  { key: "3", title: "Daily Reminders", subtitle: "Stay consistent with gentle notifications.",
    lottie: require("../assets/lottie/reminder.json"), fallback: require("../assets/adaptive-icon.png") },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const goNext = () => {
    if (index < slides.length - 1) listRef.current?.scrollToIndex({ index: index + 1 });
    else finish();
  };

  const skip = () => finish();

  const finish = async () => {
    await AsyncStorage.setItem("cs_onboarded", "1");
    router.replace("/login");
  };

  return (
    <View style={[styles.container, { width }]}> 
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(i) => i.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}> 
            <AnimWithFallback lottie={item.lottie} fallback={item.fallback} />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />
      <View style={styles.footer}> 
        <PrimaryButton title="Skip" onPress={skip} style={{ backgroundColor: "#B3E5FC" }} />
        <PrimaryButton title={index === slides.length - 1 ? "Done" : "Next"} onPress={goNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E1F5FE" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  img: { width: 160, height: 160, marginBottom: 18 },
  animWrap: { width: 220, height: 220, marginBottom: 18 },
  anim: { width: "100%", height: "100%" },
  title: { fontSize: 24, fontWeight: "800", color: "#01579B", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#0277BD", textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between" },
});

function AnimWithFallback({ lottie, fallback }) {
  const [err, setErr] = useState(false);
  return (
    <View style={styles.animWrap}>
      {err ? (
        <Image source={fallback} style={styles.img} />
      ) : (
        <LottieView
          source={lottie}
          autoPlay
          loop
          resizeMode="cover"
          onError={() => setErr(true)}
          style={styles.anim}
        />
      )}
    </View>
  );
}
