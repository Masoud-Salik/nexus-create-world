/**
 * Error utility functions for consistent, secure error handling
 * Prevents information leakage by mapping internal errors to user-friendly messages
 */

// Map of known error messages to user-friendly versions
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'User not authenticated': 'Please sign in to continue.',
  'Authentication required': 'Please sign in to continue.',
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'Email not confirmed': 'Please verify your email address.',
  
  // Rate limiting
  'Rate limits exceeded': 'Too many requests. Please wait a moment and try again.',
  'rate limit': 'Too many requests. Please wait a moment and try again.',
  
  // Network errors
  'Failed to fetch': 'Connection error. Please check your internet connection.',
  'Network request failed': 'Connection error. Please check your internet connection.',
  'No response body': 'Connection error. Please try again.',
  
  // Payment/credits
  'Payment required': 'Please add funds to continue.',
  'Insufficient credits': 'Please add credits to continue.',
  
  // Generic API errors
  'Failed to start stream': 'Something went wrong. Please try again.',
  'Internal server error': 'Something went wrong. Please try again later.',
};

/**
 * Converts any error to a user-friendly message
 * Logs the original error for debugging while showing safe messages to users
 */
export function getUserFriendlyError(error: unknown): string {
  // Default message for unknown errors
  const defaultMessage = 'Something went wrong. Please try again.';
  
  if (!error) return defaultMessage;
  
  // Extract error message
  let errorMessage = '';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message);
  }
  
  // Check for exact matches first
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }
  
  // Check for partial matches (case-insensitive)
  const lowerMessage = errorMessage.toLowerCase();
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Return default for any unrecognized error
  // This prevents leaking internal details like file paths, SQL errors, etc.
  return defaultMessage;
}

/**
 * Safely logs an error for debugging without exposing it to users
 */
export function logError(context: string, error: unknown): void {
  // Only log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  } else {
    // In production, log minimal info
    console.error(`[${context}] Error occurred`);
  }
}
