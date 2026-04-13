/**
 * Dev-only logger — all output is silenced in production builds.
 * React Native sets __DEV__ = false when bundled with --no-dev (release mode).
 */
const logger = {
  log:   (...args) => { if (__DEV__) console.log(...args); },
  warn:  (...args) => { if (__DEV__) console.warn(...args); },
  error: (...args) => { if (__DEV__) console.error(...args); },
};

export default logger;
