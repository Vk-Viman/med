import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (uid) => `@aggStats:${uid}`;

export async function getCachedAggStats(uid){
  try {
    if(!uid) return null;
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(obj && typeof obj === 'object') return obj;
    return null;
  } catch { return null; }
}

export async function setCachedAggStats(uid, stats){
  try {
    if(!uid) return;
    const clean = {
      totalMinutes: Number(stats?.totalMinutes||0),
      streak: Number(stats?.streak||0)
    };
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify(clean));
  } catch {}
}
