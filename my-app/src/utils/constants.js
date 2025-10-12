/**
 * Application Constants
 * Centralized location for magic numbers, timeouts, and configuration values
 */

// ============ Time & Duration ============
export const TIME = {
  // Cache TTLs
  CHART_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  USER_PROFILE_CACHE_MS: 2 * 60 * 1000, // 2 minutes
  
  // Rate limiting
  RATE_LIMIT_POST_MS: 10000, // 10 seconds between posts
  RATE_LIMIT_REPLY_MS: 8000, // 8 seconds between replies
  RATE_LIMIT_SENSITIVE_MS: 3000, // 3 seconds for sensitive actions
  
  // Network timeouts
  API_TIMEOUT_MS: 30000, // 30 seconds
  UPLOAD_TIMEOUT_MS: 60000, // 60 seconds
  
  // Polling intervals
  REMOTE_WIPE_CHECK_MS: 30000, // 30 seconds
  NOTIFICATION_POLL_MS: 60000, // 1 minute
  
  // Debounce/Throttle
  SEARCH_DEBOUNCE_MS: 300,
  SCROLL_THROTTLE_MS: 100,
  
  // Animation durations
  ANIMATION_FAST_MS: 200,
  ANIMATION_NORMAL_MS: 400,
  ANIMATION_SLOW_MS: 600,
};

// ============ Limits & Thresholds ============
export const LIMITS = {
  // Content lengths
  MAX_NOTE_LENGTH: 500,
  MAX_POST_LENGTH: 2000,
  MAX_COMMENT_LENGTH: 500,
  MAX_BIO_LENGTH: 150,
  
  // Mood values
  MIN_MOOD_VALUE: 0,
  MAX_MOOD_VALUE: 10,
  MIN_STRESS_VALUE: 0,
  MAX_STRESS_VALUE: 10,
  
  // Pagination
  POSTS_PER_PAGE: 20,
  NOTIFICATIONS_PER_PAGE: 25,
  SESSIONS_PER_PAGE: 50,
  
  // Moderation thresholds
  TOXICITY_FLAG_THRESHOLD: 0.6,
  TOXICITY_BLOCK_THRESHOLD: 0.8,
  
  // Streak & Goals
  MAX_STREAK_DAYS: 365,
  DEFAULT_DAILY_GOAL_MINUTES: 20,
};

// ============ Mood Utilities ============
export const MOOD_EMOJIS = {
  0: '😢', 1: '😢', 2: '😢',
  3: '🙁', 4: '🙁',
  5: '😐', 6: '😐',
  7: '🙂', 8: '🙂',
  9: '😄', 10: '😄',
};

export const MOOD_LABELS = {
  VERY_LOW: 'Very Low',
  LOW: 'Low',
  NEUTRAL: 'Neutral',
  GOOD: 'Good',
  EXCELLENT: 'Excellent',
};

export const MOOD_TEXT_TO_SCORE = {
  'sad': 2,
  'stressed': 3,
  'anxious': 3,
  'calm': 7,
  'happy': 9,
  'peaceful': 8,
  'neutral': 5,
};

/**
 * Get emoji for mood score (0-10)
 */
export function getMoodEmoji(score) {
  if (score == null || typeof score !== 'number') return '🌀';
  const clamped = Math.max(0, Math.min(10, Math.round(score)));
  return MOOD_EMOJIS[clamped] || '😐';
}

/**
 * Convert mood text to numeric score
 */
export function moodTextToScore(text) {
  if (typeof text !== 'string') return 5;
  const normalized = text.toLowerCase().trim();
  return MOOD_TEXT_TO_SCORE[normalized] ?? 5;
}

/**
 * Get mood label for score
 */
export function getMoodLabel(score) {
  if (score <= 2) return MOOD_LABELS.VERY_LOW;
  if (score <= 4) return MOOD_LABELS.LOW;
  if (score <= 6) return MOOD_LABELS.NEUTRAL;
  if (score <= 8) return MOOD_LABELS.GOOD;
  return MOOD_LABELS.EXCELLENT;
}

// ============ Date Utilities ============

/**
 * Format date to YYYY-MM-DD HH:MM
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  try {
    let d;
    // Handle Firestore Timestamp
    if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/**
 * Format date to readable string (e.g., "Jan 15, 2025")
 */
export function formatDate(date) {
  if (!date) return '';
  
  try {
    let d;
    if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return '';
  }
}

/**
 * Format date to time string (e.g., "2:30 PM")
 */
export function formatTime(date) {
  if (!date) return '';
  
  try {
    let d;
    if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return '';
  }
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date) {
  if (!date) return '';
  
  try {
    let d;
    if (date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(d);
  } catch {
    return '';
  }
}

// ============ Accessibility ============
export const ACCESSIBILITY = {
  MIN_TOUCH_TARGET: 44, // iOS/Android minimum (44x44pt)
  RECOMMENDED_TOUCH_TARGET: 48, // Material Design recommendation
  MIN_CONTRAST_RATIO: 4.5, // WCAG AA for normal text
  MIN_LARGE_TEXT_CONTRAST: 3, // WCAG AA for large text (18pt+)
};

// ============ Storage Keys ============
export const STORAGE_KEYS = {
  THEME: 'cs_theme',
  BIOMETRIC_PREF: 'biometric_login_enabled',
  ONBOARDING_COMPLETE: 'onboarding_v1_complete',
  SECURE_MOOD_KEY: 'secure_mood_key_v1',
  OFFLINE_MOOD_QUEUE: 'offlineMoodQueue',
  LAST_SYNC: 'last_sync_timestamp',
  CHART_CACHE_VERSION: 'cache_chart_ver_v1',
  PENDING_REMOTE_WIPE: 'pending_remote_wipe_v1',
  LAST_RETENTION_RUN: 'last_retention_run_v1',
};

// ============ Error Messages ============
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  AUTH_REQUIRED: 'You must be logged in to perform this action.',
  PERMISSION_DENIED: 'You don\'t have permission to perform this action.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
  UNKNOWN: 'Something went wrong. Please try again.',
  OFFLINE: 'You are currently offline. Changes will sync when connected.',
};

// ============ Feature Flags ============
export const FEATURES = {
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_DEBUG_LOGS: __DEV__,
};

// ============ Colors (for accessibility checks) ============
export const COLORS = {
  // Light mode
  LIGHT_BG: '#F5F7FA',
  LIGHT_TEXT: '#1A1A1A',
  LIGHT_TEXT_MUTED: '#64748B',
  
  // Dark mode
  DARK_BG: '#0B1722',
  DARK_TEXT: '#E2E8F0',
  DARK_TEXT_MUTED: '#94A3B8',
  
  // Semantic
  PRIMARY: '#0288D1',
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  WARNING: '#F59E0B',
};

export default {
  TIME,
  LIMITS,
  MOOD_EMOJIS,
  MOOD_LABELS,
  MOOD_TEXT_TO_SCORE,
  ACCESSIBILITY,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  FEATURES,
  COLORS,
  getMoodEmoji,
  moodTextToScore,
  getMoodLabel,
  formatDateTime,
  formatDate,
  formatTime,
  getRelativeTime,
};
