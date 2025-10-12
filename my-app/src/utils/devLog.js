/**
 * Development-only logging utilities
 * These functions only log in development mode to avoid performance overhead in production
 */

/**
 * Log message (only in development)
 * @param {...any} args - Arguments to log
 */
export const devLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

/**
 * Log warning (only in development)
 * @param {...any} args - Arguments to log
 */
export const devWarn = (...args) => {
  if (__DEV__) {
    console.warn(...args);
  }
};

/**
 * Log error (only in development)
 * @param {...any} args - Arguments to log
 */
export const devError = (...args) => {
  if (__DEV__) {
    console.error(...args);
  }
};

/**
 * Log with emoji prefix for better visibility
 */
export const devLogEmoji = (emoji, ...args) => {
  if (__DEV__) {
    console.log(emoji, ...args);
  }
};

// Specific logging categories
export const logNetwork = (...args) => devLogEmoji('🌐', ...args);
export const logData = (...args) => devLogEmoji('📊', ...args);
export const logAuth = (...args) => devLogEmoji('🔐', ...args);
export const logError = (...args) => devLogEmoji('❌', ...args);
export const logSuccess = (...args) => devLogEmoji('✅', ...args);
export const logRetry = (...args) => devLogEmoji('🔄', ...args);
