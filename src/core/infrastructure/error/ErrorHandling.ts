// Error types and classes
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  OFFLINE = 'OFFLINE',
  SYNC = 'SYNC',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  userAgent?: string;
  platform?: string;
  networkInfo?: {
    isOnline: boolean;
    effectiveType?: string;
  };
  additionalData?: Record<string, any>;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    originalError?: Error,
    retryable: boolean = false,
    userMessage?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.context = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      ...context
    };
    this.originalError = originalError;
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
  }

  private getDefaultUserMessage(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please sign in again.';
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorType.PERMISSION:
        return 'You don\'t have permission to perform this action.';
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorType.OFFLINE:
        return 'You appear to be offline. Please check your connection.';
      case ErrorType.SYNC:
        return 'Data synchronization failed. Your changes will be saved when you\'re back online.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      retryable: this.retryable,
      userMessage: this.userMessage,
      stack: this.stack
    };
  }
}

// Error boundary class
export class ErrorBoundary {
  private static instance: ErrorBoundary;
  private errorHandlers: Map<ErrorType, Array<(error: AppError) => void>> = new Map();
  private globalErrorHandler?: (error: AppError) => void;

  static getInstance(): ErrorBoundary {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary();
    }
    return ErrorBoundary.instance;
  }

  private constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        const error = this.createErrorFromEvent(event);
        this.handleError(error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const error = this.createErrorFromRejection(event);
        this.handleError(error);
      });
    }
  }

  private createErrorFromEvent(event: ErrorEvent): AppError {
    return new AppError(
      event.message || 'Unknown error',
      ErrorType.UNKNOWN,
      ErrorSeverity.HIGH,
      {
        component: 'Global',
        action: 'JavaScript Error',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      },
      event.error
    );
  }

  private createErrorFromRejection(event: PromiseRejectionEvent): AppError {
    const reason = event.reason;
    const message = reason?.message || 'Unhandled promise rejection';
    
    return new AppError(
      message,
      ErrorType.UNKNOWN,
      ErrorSeverity.HIGH,
      {
        component: 'Global',
        action: 'Promise Rejection',
        additionalData: { reason }
      },
      reason instanceof Error ? reason : undefined
    );
  }

  // Register error handler for specific error type
  registerHandler(type: ErrorType, handler: (error: AppError) => void) {
    if (!this.errorHandlers.has(type)) {
      this.errorHandlers.set(type, []);
    }
    this.errorHandlers.get(type)!.push(handler);
  }

  // Register global error handler
  registerGlobalHandler(handler: (error: AppError) => void) {
    this.globalErrorHandler = handler;
  }

  // Handle error
  handleError(error: AppError) {
    console.error('Application Error:', error);

    // Call type-specific handlers
    const handlers = this.errorHandlers.get(error.type) || [];
    handlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });

    // Call global handler
    if (this.globalErrorHandler) {
      try {
        this.globalErrorHandler(error);
      } catch (handlerError) {
        console.error('Error in global error handler:', handlerError);
      }
    }
  }

  // Create specific error types
  static createNetworkError(message: string, context?: Partial<ErrorContext>, originalError?: Error): AppError {
    return new AppError(
      message,
      ErrorType.NETWORK,
      ErrorSeverity.MEDIUM,
      { ...context, component: 'Network' },
      originalError,
      true
    );
  }

  static createAuthError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH,
      { ...context, component: 'Auth' }
    );
  }

  static createValidationError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.LOW,
      { ...context, component: 'Validation' }
    );
  }

  static createNotFoundError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.NOT_FOUND,
      ErrorSeverity.MEDIUM,
      { ...context, component: 'Resource' }
    );
  }

  static createTimeoutError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.TIMEOUT,
      ErrorSeverity.MEDIUM,
      { ...context, component: 'Request' },
      undefined,
      true
    );
  }

  static createOfflineError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.OFFLINE,
      ErrorSeverity.MEDIUM,
      { ...context, component: 'Offline' },
      undefined,
      false
    );
  }

  static createSyncError(message: string, context?: Partial<ErrorContext>): AppError {
    return new AppError(
      message,
      ErrorType.SYNC,
      ErrorSeverity.MEDIUM,
      { ...context, component: 'Sync' },
      undefined,
      true
    );
  }
}

// Error recovery strategies
export interface RecoveryStrategy {
  canRecover(error: AppError): boolean;
  recover(error: AppError): Promise<void>;
}

export class RetryStrategy implements RecoveryStrategy {
  constructor(
    private maxRetries: number = 3,
    private delay: number = 1000,
    private backoffMultiplier: number = 2
  ) {}

  canRecover(error: AppError): boolean {
    return error.retryable && this.maxRetries > 0;
  }

  async recover(error: AppError): Promise<void> {
    // This would be implemented based on the specific error context
    // For now, we'll just wait and let the caller retry
    await new Promise(resolve => setTimeout(resolve, this.delay));
  }
}

export class OfflineStrategy implements RecoveryStrategy {
  canRecover(error: AppError): boolean {
    return error.type === ErrorType.OFFLINE || error.type === ErrorType.NETWORK;
  }

  async recover(error: AppError): Promise<void> {
    // Queue the operation for when we're back online
    console.log('Operation queued for offline recovery:', error.context);
  }
}

export class RefreshAuthStrategy implements RecoveryStrategy {
  canRecover(error: AppError): boolean {
    return error.type === ErrorType.AUTHENTICATION;
  }

  async recover(error: AppError): Promise<void> {
    // Attempt to refresh authentication token
    console.log('Attempting to refresh authentication...');
    // Implementation would depend on auth system
  }
}

// Error reporting service
export class ErrorReportingService {
  private static instance: ErrorReportingService;
  private errorQueue: AppError[] = [];
  private isOnline: boolean = true;

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  private constructor() {
    this.setupNetworkMonitoring();
  }

  private setupNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.flushErrorQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  reportError(error: AppError) {
    if (this.isOnline) {
      this.sendError(error);
    } else {
      this.errorQueue.push(error);
    }
  }

  private async sendError(error: AppError) {
    try {
      // Send to error reporting service (e.g., Sentry, LogRocket, custom endpoint)
      console.log('Reporting error:', error.toJSON());
      
      // In a real implementation, this would send to an error tracking service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error.toJSON())
      // });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
      this.errorQueue.push(error);
    }
  }

  private async flushErrorQueue() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    for (const error of errors) {
      await this.sendError(error);
    }
  }
}
