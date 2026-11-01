import { createRequire } from 'node:module';
import { pino } from 'pino';

const dev = process.env.NODE_ENV !== 'production';

/** pino-pretty is a dev dependency: a production image without it logs JSON instead of failing to start. */
const prettyInstalled = (() => {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
})();

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (dev ? 'debug' : 'info'),
  transport: dev && prettyInstalled ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } : undefined,
});
