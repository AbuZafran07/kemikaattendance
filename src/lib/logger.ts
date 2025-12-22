// Production-safe logger that only logs in development
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

interface LoggerOptions {
  // Allow specific loggers to be enabled in production for critical debugging
  forceLog?: boolean;
}

/**
 * Production-safe logger utility
 * - In development: logs everything normally
 * - In production: suppresses all logs to prevent information disclosure
 */
export const logger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  },
  
  info: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.info(message, ...args);
    }
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(message, ...args);
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.error(message, ...args);
    }
  },
  
  debug: (message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(message, ...args);
    }
  },
  
  // For critical errors that should always be logged (use sparingly)
  critical: (message: string, ...args: unknown[]) => {
    // Only log the message, not the full error object in production
    if (isDevelopment) {
      console.error('[CRITICAL]', message, ...args);
    } else {
      // In production, log minimal info without sensitive details
      console.error('[CRITICAL]', message);
    }
  },
};

export default logger;
