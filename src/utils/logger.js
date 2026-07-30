const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

function formatTimestamp() {
  return new Date().toISOString();
}

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) console.error(`[${formatTimestamp()}] [ERROR]`, ...args);
  },
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) console.warn(`[${formatTimestamp()}] [WARN]`, ...args);
  },
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) console.info(`[${formatTimestamp()}] [INFO]`, ...args);
  },
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) console.debug(`[${formatTimestamp()}] [DEBUG]`, ...args);
  },
};

module.exports = logger;
