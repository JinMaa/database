export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class Logger {
    private static logLevel;
    /**
     * Set the log level
     * @param level Log level
     */
    static setLogLevel(level: LogLevel): void;
    /**
     * Log a debug message
     * @param message Message to log
     * @param args Additional arguments
     */
    static debug(message: string, ...args: any[]): void;
    /**
     * Log an info message
     * @param message Message to log
     * @param args Additional arguments
     */
    static info(message: string, ...args: any[]): void;
    /**
     * Log a warning message
     * @param message Message to log
     * @param args Additional arguments
     */
    static warn(message: string, ...args: any[]): void;
    /**
     * Log an error message
     * @param message Message to log
     * @param args Additional arguments
     */
    static error(message: string, ...args: any[]): void;
}
