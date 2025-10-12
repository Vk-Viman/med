/**
 * Centralized Error Handler
 * Provides consistent error logging, user notifications, and optional analytics
 */

import { Alert } from 'react-native';
import { ERROR_MESSAGES } from './constants';

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',       // Recoverable, user can continue
  MEDIUM: 'medium', // Degraded experience
  HIGH: 'high',     // Feature unavailable
  CRITICAL: 'critical', // App crash or data loss risk
};

/**
 * Determine if error is network-related
 */
function isNetworkError(error) {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('offline') ||
    message.includes('timeout') ||
    code === 'network_error' ||
    code === 'econnrefused' ||
    code === 'etimedout'
  );
}

/**
 * Determine if error is authentication-related
 */
function isAuthError(error) {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('unauthorized') ||
    message.includes('unauthenticated') ||
    message.includes('permission denied') ||
    code === 'auth/unauthorized' ||
    code === 'permission-denied' ||
    code === 'unauthenticated'
  );
}

/**
 * Determine if error is rate limit
 */
function isRateLimitError(error) {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('rate limit') ||
    message.includes('too many') ||
    code === 'rate_limit' ||
    code === 'too_many_requests' ||
    error.status === 429
  );
}

/**
 * Get user-friendly error message
 */
function getUserMessage(error) {
  if (!error) return ERROR_MESSAGES.UNKNOWN;
  
  // Check specific error types
  if (isNetworkError(error)) return ERROR_MESSAGES.NETWORK_ERROR;
  if (isAuthError(error)) return ERROR_MESSAGES.AUTH_REQUIRED;
  if (isRateLimitError(error)) return ERROR_MESSAGES.RATE_LIMIT;
  
  // Use error message if it's user-friendly (not technical)
  const msg = error.message || '';
  if (msg && msg.length < 100 && !msg.includes('Error:') && !msg.includes('Exception')) {
    return msg;
  }
  
  return ERROR_MESSAGES.UNKNOWN;
}

/**
 * Log error to console in development
 */
function logError(context, error, metadata = {}) {
  if (__DEV__) {
    console.group(`❌ Error in ${context}`);
    console.error('Error:', error);
    if (Object.keys(metadata).length > 0) {
      console.log('Metadata:', metadata);
    }
    console.groupEnd();
  }
}

/**
 * Send error to analytics/crash reporting service
 * (Placeholder - integrate with Sentry, Firebase Crashlytics, etc.)
 */
function reportToAnalytics(context, error, severity, metadata = {}) {
  // TODO: Integrate with your analytics service
  // Example:
  // if (FEATURES.ENABLE_CRASH_REPORTING) {
  //   crashlytics().recordError(error, context);
  //   analytics().logEvent('app_error', {
  //     context,
  //     severity,
  //     error_message: error.message,
  //     ...metadata
  //   });
  // }
  
  if (__DEV__) {
    console.log(`📊 Would report to analytics: ${context}`, { severity, ...metadata });
  }
}

/**
 * Main error handler function
 * 
 * @param {Error} error - The error object
 * @param {string} context - Where the error occurred (e.g., 'MoodTracker:saveMood')
 * @param {Object} options - Configuration options
 * @param {boolean} options.showAlert - Whether to show alert to user (default: true)
 * @param {string} options.severity - Error severity level
 * @param {Object} options.metadata - Additional context data
 * @param {boolean} options.silent - If true, only logs, doesn't show UI
 */
export function handleError(error, context = 'Unknown', options = {}) {
  const {
    showAlert = true,
    severity = ERROR_SEVERITY.MEDIUM,
    metadata = {},
    silent = false,
  } = options;
  
  // Always log in development
  logError(context, error, metadata);
  
  // Report to analytics (except for low severity)
  if (severity !== ERROR_SEVERITY.LOW) {
    reportToAnalytics(context, error, severity, metadata);
  }
  
  // Show user-facing alert if requested and not silent
  if (showAlert && !silent) {
    const userMessage = getUserMessage(error);
    
    Alert.alert(
      severity === ERROR_SEVERITY.CRITICAL ? 'Critical Error' : 'Error',
      userMessage,
      [{ text: 'OK', style: 'default' }]
    );
  }
  
  return {
    handled: true,
    userMessage: getUserMessage(error),
    isNetworkError: isNetworkError(error),
    isAuthError: isAuthError(error),
    isRateLimitError: isRateLimitError(error),
  };
}

/**
 * Async wrapper that handles errors automatically
 * 
 * @example
 * const result = await withErrorHandler(
 *   async () => await saveMood(mood),
 *   'MoodTracker:saveMood',
 *   { showAlert: true }
 * );
 */
export async function withErrorHandler(fn, context, options = {}) {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context, options);
    return null;
  }
}

/**
 * Create a bound error handler for a specific component
 * 
 * @example
 * const errorHandler = createErrorHandler('MoodTracker');
 * 
 * try {
 *   await saveMood();
 * } catch (e) {
 *   errorHandler(e, 'saveMood');
 * }
 */
export function createErrorHandler(componentName) {
  return (error, action, options = {}) => {
    const context = `${componentName}:${action}`;
    return handleError(error, context, options);
  };
}

/**
 * Error boundary hook helper
 * Use with React Error Boundaries
 */
export function onErrorBoundaryError(error, errorInfo) {
  handleError(error, 'ErrorBoundary', {
    showAlert: false,
    severity: ERROR_SEVERITY.CRITICAL,
    metadata: {
      componentStack: errorInfo.componentStack,
    },
  });
}

/**
 * Quick error handlers for common scenarios
 */
export const ErrorHandlers = {
  /**
   * Handle network request errors
   */
  network: (error, context) => handleError(error, context, {
    showAlert: true,
    severity: ERROR_SEVERITY.MEDIUM,
  }),
  
  /**
   * Handle authentication errors
   */
  auth: (error, context) => handleError(error, context, {
    showAlert: true,
    severity: ERROR_SEVERITY.HIGH,
  }),
  
  /**
   * Handle silent background errors
   */
  silent: (error, context) => handleError(error, context, {
    showAlert: false,
    severity: ERROR_SEVERITY.LOW,
  }),
  
  /**
   * Handle critical errors
   */
  critical: (error, context) => handleError(error, context, {
    showAlert: true,
    severity: ERROR_SEVERITY.CRITICAL,
  }),
};

export default handleError;
