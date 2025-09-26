import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, TextInput, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../../firebase/firebaseConfig";

const meditations = [
  { id: 1, title: "Morning Calm", category: "Morning", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Stress Relief", category: "Stress", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Deep Relaxation", category: "Relaxation", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];
const CATEGORIES = ["All", "Favorites", ...Array.from(new Set(meditations.map(m => m.category)))];

function Item({ med, selected, onPress, onToggleFavorite, isFav }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.item, selected && styles.selected]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`Meditation ${med.title}${selected ? ', selected' : ''}`}
      >
        <View style={styles.itemRow}>
          <View>
            <Text style={styles.text}>{med.title}</Text>
            <Text style={styles.category}>{med.category}</Text>
          </View>
          <TouchableOpacity
            onPress={onToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Text style={[styles.fav, isFav && styles.favActive]}>{isFav ? "★" : "☆"}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MeditationList({ onSelect, selected }) {
  const uid = auth.currentUser?.uid || "local";
  const favKey = `@med:favorites:${uid}`;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(favKey);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, [favKey]);

  const toggleFavorite = async (id) => {
    const next = favorites.includes(id)
      ? favorites.filter(x => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try { await AsyncStorage.setItem(favKey, JSON.stringify(next)); } catch {}
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meditations.filter(m => {
      const matchesCategory =
        category === "All"
          ? true
          : category === "Favorites"
          ? favorites.includes(m.id)
          : m.category === category;
      const matchesQuery = q.length === 0 || m.title.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category, favorites]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.search}
        placeholder="Search meditations..."
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
            accessibilityRole="button"
            accessibilityLabel={`Filter category ${cat}`}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.list}>
        {filtered.map(med => (
          <Item
            key={med.id}
            med={med}
            selected={selected?.id === med.id}
            onPress={() => onSelect(med)}
            onToggleFavorite={() => toggleFavorite(med.id)}
            isFav={favorites.includes(med.id)}
          />
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>No meditations match your search.</Text>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  search: { backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: "#E0F2F1" },
  categories: { marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#E0F2F1", borderRadius: 16, marginRight: 8 },
  chipActive: { backgroundColor: "#80DEEA" },
  chipText: { color: "#006064", fontWeight: "600" },
  chipTextActive: { color: "#004D40" },
  list: { marginBottom: 8 },
  item: { padding: 12, backgroundColor: "#B3E5FC", marginBottom: 8, borderRadius: 8 },
  selected: { backgroundColor: "#81D4FA" },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  text: { fontSize: 16, color: "#01579B", fontWeight: "700" },
  category: { fontSize: 12, color: "#004D40", opacity: 0.8, marginTop: 2 },
  fav: { fontSize: 20, color: "#006064" },
  favActive: { color: "#FFB300" },
  empty: { textAlign: "center", color: "#607D8B", marginTop: 8 }
});
