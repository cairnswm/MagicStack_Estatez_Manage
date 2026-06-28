import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  hostname?: string;
}

export const requestStorage = new AsyncLocalStorage<RequestContext>();

export function generateRequestId(): string {
  const port = process.env.PORT || '3097';
  return `${port}-${Date.now()}`;
}

export function getRequestId(): string {
  return requestStorage.getStore()?.requestId ?? generateRequestId();
}

export function getHostname(): string | undefined {
  return requestStorage.getStore()?.hostname;
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
type LogLevel = typeof LOG_LEVELS[number];

function getConfiguredLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return (LOG_LEVELS as readonly string[]).includes(env) ? (env as LogLevel) : 'info';
}

export function log(level: Exclude<LogLevel, 'silent'>, message: string): void {
  if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(getConfiguredLevel())) {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}
