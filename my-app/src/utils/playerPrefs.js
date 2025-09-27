import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  defaultBg: 'pref_player_default_bg_v1',
  autoplayLast: 'pref_player_autoplay_last_v1',
  keepAwake: 'pref_player_keep_awake_v1',
  haptics: 'pref_haptics_enabled_v1', // reuse haptics pref key
  autoPauseOnCall: 'pref_player_auto_pause_call_v1',
  dailyReminderTime: 'pref_daily_reminder_time_v1', // HH:MM
  quietStart: 'pref_quiet_start_v1', // HH:MM
  quietEnd: 'pref_quiet_end_v1',     // HH:MM
};

export async function setDefaultBg(val){ try{ await AsyncStorage.setItem(KEYS.defaultBg, String(val||'none')); }catch{} }
export async function getDefaultBg(){ try{ return (await AsyncStorage.getItem(KEYS.defaultBg)) || 'none'; }catch{ return 'none'; } }

export async function setAutoplayLast(val){ try{ await AsyncStorage.setItem(KEYS.autoplayLast, val?'1':'0'); }catch{} }
export async function getAutoplayLast(){ try{ const v = await AsyncStorage.getItem(KEYS.autoplayLast); return v===null? false : v==='1'; }catch{ return false; } }

export async function setKeepAwake(val){ try{ await AsyncStorage.setItem(KEYS.keepAwake, val?'1':'0'); }catch{} }
export async function getKeepAwake(){ try{ const v = await AsyncStorage.getItem(KEYS.keepAwake); return v===null? false : v==='1'; }catch{ return false; } }

export async function setAutoPauseOnCall(val){ try{ await AsyncStorage.setItem(KEYS.autoPauseOnCall, val?'1':'0'); }catch{} }
export async function getAutoPauseOnCall(){ try{ const v = await AsyncStorage.getItem(KEYS.autoPauseOnCall); return v===null? true : v==='1'; }catch{ return true; } }

export async function setDailyReminderTime(hhmm){ try{ await AsyncStorage.setItem(KEYS.dailyReminderTime, hhmm || ''); }catch{} }
export async function getDailyReminderTime(){ try{ return (await AsyncStorage.getItem(KEYS.dailyReminderTime)) || ''; }catch{ return ''; } }

export async function setQuietHours(startHHMM,endHHMM){ try{ await AsyncStorage.multiSet([[KEYS.quietStart,startHHMM||''],[KEYS.quietEnd,endHHMM||'']]); }catch{} }
export async function getQuietHours(){ try{ const [s,e] = await AsyncStorage.multiGet([KEYS.quietStart, KEYS.quietEnd]); return { start: s?.[1]||'', end: e?.[1]||'' }; }catch{ return { start:'', end:'' }; } }

export const PlayerPrefKeys = KEYS;
