/** One JSON line per event on stdout. Contract rule 7: every line carries app, ts, level, event. */
const APP = process.env.APP_NAME ?? "__APP_NAME__";
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (LEVELS[level] < threshold) return;
  process.stdout.write(JSON.stringify({ app: APP, ts: new Date().toISOString(), level, event, ...fields }) + "\n");
}
