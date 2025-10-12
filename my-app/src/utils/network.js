/**
 * Network Utilities
 * Provides fetch with timeout, retry logic, and error handling
 */

import { TIME, ERROR_MESSAGES } from './constants';
import { handleError, ERROR_SEVERITY } from './errorHandler';

/**
 * Fetch with timeout
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = TIME.API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      const timeoutError = new Error(ERROR_MESSAGES.TIMEOUT_ERROR);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    
    throw error;
  }
}

/**
 * Retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2, // Exponential backoff
  retryOnStatus: [408, 429, 500, 502, 503, 504], // HTTP status codes to retry
};

/**
 * Calculate delay for retry attempt using exponential backoff
 * 
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, config) {
  const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, config.maxDelay);
}

/**
 * Determine if error is retryable
 * 
 * @param {Error} error - The error to check
 * @param {Response} response - Fetch response (if available)
 * @param {Object} config - Retry configuration
 * @returns {boolean}
 */
function isRetryable(error, response, config) {
  // Network errors are retryable
  if (error && (
    error.message?.includes('network') ||
    error.message?.includes('timeout') ||
    error.code === 'TIMEOUT' ||
    error.code === 'ECONNREFUSED'
  )) {
    return true;
  }
  
  // Check HTTP status codes
  if (response && config.retryOnStatus.includes(response.status)) {
    return true;
  }
  
  return false;
}

/**
 * Fetch with retry logic and exponential backoff
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryConfig - Retry configuration (optional)
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retryConfig = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError;
  let lastResponse;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // If response is OK or not retryable, return it
      if (response.ok || !isRetryable(null, response, config)) {
        return response;
      }
      
      // Store response for retry decision
      lastResponse = response;
      
      // If not last attempt, wait before retry
      if (attempt < config.maxRetries) {
        const delay = calculateRetryDelay(attempt, config);
        if (__DEV__) {
          console.log(`Retrying request (attempt ${attempt + 1}/${config.maxRetries}) after ${delay}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error;
      
      // If not retryable or last attempt, throw
      if (!isRetryable(error, null, config) || attempt === config.maxRetries) {
        throw error;
      }
      
      // Wait before retry
      const delay = calculateRetryDelay(attempt, config);
      if (__DEV__) {
        console.log(`Retrying after error (attempt ${attempt + 1}/${config.maxRetries}) after ${delay}ms...`, error.message);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we got here, all retries failed
  if (lastResponse) {
    return lastResponse;
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Safe JSON fetch with error handling
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function fetchJSON(url, options = {}, config = {}) {
  const {
    retry = true,
    timeout = TIME.API_TIMEOUT_MS,
    showError = true,
    context = 'API Request',
  } = config;
  
  try {
    const fetchFn = retry ? fetchWithRetry : fetchWithTimeout;
    const response = await fetchFn(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, timeout);
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (showError) {
      handleError(error, context, {
        showAlert: true,
        severity: ERROR_SEVERITY.MEDIUM,
      });
    }
    
    return { success: false, error };
  }
}

/**
 * POST request helper
 */
export async function postJSON(url, body, config = {}) {
  return fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }, config);
}

/**
 * PUT request helper
 */
export async function putJSON(url, body, config = {}) {
  return fetchJSON(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, config);
}

/**
 * DELETE request helper
 */
export async function deleteJSON(url, config = {}) {
  return fetchJSON(url, {
    method: 'DELETE',
  }, config);
}

/**
 * Check if device is online
 * Uses NetInfo if available
 */
export async function isOnline() {
  try {
    // Try to import NetInfo
    const NetInfo = await import('@react-native-community/netinfo');
    const state = await NetInfo.default.fetch();
    return state.isConnected && state.isInternetReachable !== false;
  } catch {
    // Fallback: assume online if NetInfo not available
    return true;
  }
}

/**
 * Wait for network connection
 * Useful for offline queue processing
 */
export async function waitForOnline(maxWaitMs = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    if (await isOnline()) {
      return true;
    }
    
    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

export default {
  fetchWithTimeout,
  fetchWithRetry,
  fetchJSON,
  postJSON,
  putJSON,
  deleteJSON,
  isOnline,
  waitForOnline,
};
