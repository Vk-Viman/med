import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import * as Haptics from 'expo-haptics';

const PREF_KEY = 'pref_haptics_enabled_v1';
let enabled = true; // default on

export async function initHapticsPref() {
  try { const v = await AsyncStorage.getItem(PREF_KEY); if(v !== null) enabled = (v === '1'); } catch {}
  DeviceEventEmitter.addListener('haptics-pref-changed', ({ enabled: e }) => { enabled = !!e; });
}

export async function setHapticsEnabled(val) {
  enabled = !!val;
  try { await AsyncStorage.setItem(PREF_KEY, enabled ? '1' : '0'); } catch {}
  DeviceEventEmitter.emit('haptics-pref-changed', { enabled });
}

export async function getHapticsEnabled(){
  try { const v = await AsyncStorage.getItem(PREF_KEY); return v===null ? true : (v==='1'); } catch { return true; }
}

export async function impact(style = 'light'){
  if(!enabled) return; try {
    const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
    await Haptics.impactAsync(map[style] || Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function selection(){ if(!enabled) return; try { await Haptics.selectionAsync(); } catch {} }
export async function success(){ if(!enabled) return; try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} }
export async function error(){ if(!enabled) return; try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {} }
