export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;

  /**
   * Set the log level
   * @param level Log level
   */
  public static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  /**
   * Log a debug message
   * @param message Message to log
   * @param args Additional arguments
   */
  public static debug(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Log an info message
   * @param message Message to log
   * @param args Additional arguments
   */
  public static info(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param args Additional arguments
   */
  public static warn(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param args Additional arguments
   */
  public static error(message: string, ...args: any[]): void {
    if (Logger.logLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}
