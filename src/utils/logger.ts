export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function debug(msg: string, ...args: unknown[]): void {
  if (currentLevel === 'debug') console.log(`[DEBUG] ${msg}`, ...args);
}

export function info(msg: string, ...args: unknown[]): void {
  if (currentLevel <= 'info') console.log(`[INFO] ${msg}`, ...args);
}

export function warn(msg: string, ...args: unknown[]): void {
  if (currentLevel <= 'warn') console.warn(`[WARN] ${msg}`, ...args);
}

export function error(msg: string, ...args: unknown[]): void {
  console.error(`[ERROR] ${msg}`, ...args);
}

export function progress(current: number, total: number, msg: string): void {
  if (current % 50 === 0 || current === total) {
    console.log(`[${current}/${total}] ${msg}`);
  }
}