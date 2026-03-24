import { useState, useCallback, useEffect } from 'react';
import { 
  AppError, 
  ErrorBoundary, 
  ErrorReportingService, 
  ErrorType, 
  ErrorSeverity,
  RecoveryStrategy 
} from '../services/ErrorHandling';

export interface ErrorHandlerOptions {
  enableReporting?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  customStrategies?: RecoveryStrategy[];
}

export interface ErrorState {
  error: AppError | null;
  isRetrying: boolean;
  retryCount: number;
  isResolved: boolean;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    enableReporting = true,
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    customStrategies = []
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    isResolved: false
  });

  const [recoveryStrategies] = useState<RecoveryStrategy[]>([
    ...customStrategies
  ]);

  // Initialize error handling
  useEffect(() => {
    const errorBoundary = ErrorBoundary.getInstance();
    const reportingService = ErrorReportingService.getInstance();

    // Register global error handler
    errorBoundary.registerGlobalHandler((error) => {
      if (enableReporting) {
        reportingService.reportError(error);
      }
      
      setErrorState(prev => ({
        ...prev,
        error,
        isResolved: false
      }));
    });

    // Register specific handlers for different error types
    errorBoundary.registerHandler(ErrorType.NETWORK, (error) => {
      console.log('Network error handled:', error.message);
      handleNetworkError(error);
    });

    errorBoundary.registerHandler(ErrorType.AUTHENTICATION, (error) => {
      console.log('Auth error handled:', error.message);
      handleAuthError(error);
    });

    errorBoundary.registerHandler(ErrorType.OFFLINE, (error) => {
      console.log('Offline error handled:', error.message);
      handleOfflineError(error);
    });
  }, [enableReporting, recoveryStrategies]);

  // Handle network errors
  const handleNetworkError = useCallback(async (error: AppError) => {
    if (enableRetry && error.retryable && errorState.retryCount < maxRetries) {
      await attemptRetry(error);
    }
  }, [enableRetry, errorState.retryCount, maxRetries]);

  // Handle authentication errors
  const handleAuthError = useCallback(async (error: AppError) => {
    // Redirect to login or attempt token refresh
    console.log('Handling authentication error...');
    // Implementation would depend on auth system
  }, []);

  // Handle offline errors
  const handleOfflineError = useCallback(async (error: AppError) => {
    // Queue operation for when back online
    console.log('Handling offline error...');
    // Implementation would depend on sync system
  }, []);

  // Attempt retry
  const attemptRetry = useCallback(async (error: AppError) => {
    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }));

    // Find applicable recovery strategy
    const strategy = recoveryStrategies.find(s => s.canRecover(error));
    
    if (strategy) {
      try {
        await strategy.recover(error);
        setErrorState(prev => ({
          ...prev,
          isRetrying: false,
          isResolved: true,
          error: null
        }));
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        setErrorState(prev => ({
          ...prev,
          isRetrying: false
        }));
      }
    } else {
      // Simple delay retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * errorState.retryCount));
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [recoveryStrategies, retryDelay, errorState.retryCount]);

  // Manual retry
  const retry = useCallback(async () => {
    if (errorState.error && !errorState.isRetrying) {
      await attemptRetry(errorState.error);
    }
  }, [errorState.error, errorState.isRetrying, attemptRetry]);

  // Clear error
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      isResolved: true
    });
  }, []);

  // Create and handle error
  const handleError = useCallback((
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: any
  ) => {
    const error = new AppError(message, type, severity, context);
    
    if (enableReporting) {
      ErrorReportingService.getInstance().reportError(error);
    }
    
    setErrorState({
      error,
      isRetrying: false,
      retryCount: 0,
      isResolved: false
    });
  }, [enableReporting]);

  // Handle async operations with error catching
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    errorHandler?: (error: AppError) => void
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const appError = error instanceof AppError 
        ? error 
        : new AppError(
            error instanceof Error ? error.message : 'Unknown error',
            ErrorType.UNKNOWN,
            ErrorSeverity.MEDIUM,
            { component: 'AsyncOperation' },
            error instanceof Error ? error : undefined
          );

      if (errorHandler) {
        errorHandler(appError);
      } else {
        handleError(appError.message, appError.type, appError.severity, appError.context);
      }

      return null;
    }
  }, [handleError]);

  // Validate input and create validation error
  const validateInput = useCallback((
    value: any,
    validator: (value: any) => string | null,
    fieldName: string
  ): boolean => {
    const errorMessage = validator(value);
    if (errorMessage) {
      handleError(
        errorMessage,
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        { component: 'Validation', action: 'validateInput', fieldName }
      );
      return false;
    }
    return true;
  }, [handleError]);

  // Check network status
  const checkNetworkStatus = useCallback((): boolean => {
    if (typeof navigator !== 'undefined') {
      const isOnline = navigator.onLine;
      if (!isOnline) {
        handleError(
          'No internet connection',
          ErrorType.OFFLINE,
          ErrorSeverity.MEDIUM,
          { component: 'Network', action: 'checkNetworkStatus' }
        );
      }
      return isOnline;
    }
    return true; // Assume online if navigator is not available
  }, [handleError]);

  // Safe async operation with network check
  const safeAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      requireNetwork?: boolean;
      timeout?: number;
      retries?: number;
    } = {}
  ): Promise<T | null> => {
    const { requireNetwork = true, timeout = 30000, retries = 1 } = options;

    // Check network if required
    if (requireNetwork && !checkNetworkStatus()) {
      return null;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timeout
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), timeout)
          )
        ]);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    // Handle final error
    const appError = lastError instanceof AppError 
      ? lastError 
      : new AppError(
          lastError?.message || 'Operation failed',
          ErrorType.UNKNOWN,
          ErrorSeverity.MEDIUM,
          { component: 'SafeAsyncOperation', attempts: retries + 1 },
          lastError || undefined
        );

    handleError(appError.message, appError.type, appError.severity, appError.context);
    return null;
  }, [checkNetworkStatus, handleError]);

  return {
    errorState,
    handleError,
    clearError,
    retry,
    withErrorHandling,
    validateInput,
    checkNetworkStatus,
    safeAsyncOperation
  };
}
