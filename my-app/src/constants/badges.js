// Centralized badge IDs for consistency
export const BADGE_IDS = {
  CHALLENGE_WEEKLY_COMPLETE: 'challenge_weekly_complete',
  CHALLENGE_MONTHLY_COMPLETE: 'challenge_monthly_complete',
  FIRST_POST: 'first_post',
  NOVICE_50: 'novice_50',
  ADEPT_100: 'adept_100',
  MARATHON_300: 'marathon_300',
  STREAK_3: 'streak_3',
  STREAK_7: 'streak_7',
  STREAK_14: 'streak_14',
};

// Built-in badge catalog with metadata used across user and admin UIs.
// type: 'minute' | 'streak' | 'event' | 'challenge'
let RUNTIME_CATALOG = null; // merged at runtime with admin_badges
export const BADGE_CATALOG = {
  [BADGE_IDS.NOVICE_50]: {
    id: BADGE_IDS.NOVICE_50,
    name: 'Calm Novice',
    type: 'minute',
    threshold: 50,
    emoji: '🌱',
    description: 'Accumulate 50 minutes of meditation time.'
  },
  [BADGE_IDS.ADEPT_100]: {
    id: BADGE_IDS.ADEPT_100,
    name: 'Mindful Adept',
    type: 'minute',
    threshold: 100,
    emoji: '🎯',
    description: 'Reach 100 total minutes meditated.'
  },
  [BADGE_IDS.MARATHON_300]: {
    id: BADGE_IDS.MARATHON_300,
    name: 'Marathon Meditator',
    type: 'minute',
    threshold: 300,
    emoji: '🏅',
    description: 'Achieve 300 total minutes meditated.'
  },
  [BADGE_IDS.STREAK_3]: {
    id: BADGE_IDS.STREAK_3,
    name: '3-Day Streak',
    type: 'streak',
    threshold: 3,
    emoji: '🔥',
    description: 'Meditate for 3 days in a row.'
  },
  [BADGE_IDS.STREAK_7]: {
    id: BADGE_IDS.STREAK_7,
    name: '7-Day Streak',
    type: 'streak',
    threshold: 7,
    emoji: '⚡',
    description: 'Meditate for 7 consecutive days.'
  },
  [BADGE_IDS.STREAK_14]: {
    id: BADGE_IDS.STREAK_14,
    name: '14-Day Streak',
    type: 'streak',
    threshold: 14,
    emoji: '🌟',
    description: 'Meditate for 14 days in a row.'
  },
  [BADGE_IDS.FIRST_POST]: {
    id: BADGE_IDS.FIRST_POST,
    name: 'First Reflection',
    type: 'event',
    emoji: '🗒️',
    description: 'Share your first anonymous community post.'
  },
  // Challenge badges are dynamic per-challenge (id prefixed by "challenge_")
};

export const MINUTE_THRESHOLDS = [50, 100, 300];
export const STREAK_THRESHOLDS = [3, 7, 14];

export function getBadgeMeta(id){
  if(!id) return null;
  // Dynamic challenge badge names fallback
  if(String(id).startsWith('challenge_')){
    return { id, name: 'Challenge Finisher', type: 'challenge', emoji: '🏆', description: 'Completed a group challenge.' };
  }
  const cat = RUNTIME_CATALOG || BADGE_CATALOG;
  return cat[id] || null;
}

export function nextMinuteThreshold(totalMinutes=0){
  const t = MINUTE_THRESHOLDS.find(v => totalMinutes < v);
  return t ?? null;
}

export function nextStreakThreshold(streak=0){
  const t = STREAK_THRESHOLDS.find(v => streak < v);
  return t ?? null;
}

export function progressTowards(target, current){
  if(!target || target <= 0) return 0;
  const p = Math.max(0, Math.min(100, Math.round((Number(current||0) / target) * 100)));
  return p;
}

// Internationalization helper – expects i18n maps like { en: 'Name', si: 'නම' }
function pickI18n(val, locale){
  if(!val) return val;
  if(typeof val === 'string') return val;
  if(typeof val === 'object'){
    const key = (locale||'en').toLowerCase();
    return val[key] || val.en || Object.values(val)[0];
  }
  return String(val);
}

// Merge admin_badges into catalog at runtime (read-only on user side)
// Each admin_badge doc may include: { id, name, description, type, threshold, emoji, iconUrl, i18n: { name: {en:..}, description:{..} } }
export async function loadAdminBadgesIntoCatalog({ fetchAdminBadges, locale='en' } = {}){
  if(typeof fetchAdminBadges !== 'function') return;
  try{
    const list = await fetchAdminBadges();
    const merged = { ...BADGE_CATALOG };
    for(const b of list){
      const id = b.id || b.slug || b.key;
      if(!id) continue;
      const item = {
        id,
        name: pickI18n(b.i18n?.name || b.name, locale),
        description: pickI18n(b.i18n?.description || b.description, locale) || '',
        type: b.type || 'event',
        threshold: b.threshold != null ? Number(b.threshold) : undefined,
        emoji: b.emoji || undefined,
        iconUrl: b.iconUrl || undefined,
      };
      merged[id] = item;
    }
    RUNTIME_CATALOG = merged;
    return Object.keys(list||{}).length;
  } catch { /* ignore */ }
}

export function getRuntimeCatalog(){ return RUNTIME_CATALOG || BADGE_CATALOG; }
