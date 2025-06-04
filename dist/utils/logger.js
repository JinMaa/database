"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    /**
     * Set the log level
     * @param level Log level
     */
    static setLogLevel(level) {
        Logger.logLevel = level;
    }
    /**
     * Log a debug message
     * @param message Message to log
     * @param args Additional arguments
     */
    static debug(message, ...args) {
        if (Logger.logLevel <= LogLevel.DEBUG) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }
    /**
     * Log an info message
     * @param message Message to log
     * @param args Additional arguments
     */
    static info(message, ...args) {
        if (Logger.logLevel <= LogLevel.INFO) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }
    /**
     * Log a warning message
     * @param message Message to log
     * @param args Additional arguments
     */
    static warn(message, ...args) {
        if (Logger.logLevel <= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }
    /**
     * Log an error message
     * @param message Message to log
     * @param args Additional arguments
     */
    static error(message, ...args) {
        if (Logger.logLevel <= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }
}
exports.Logger = Logger;
Logger.logLevel = LogLevel.INFO;
