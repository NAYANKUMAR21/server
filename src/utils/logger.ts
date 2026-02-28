type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data ? { data: data instanceof Error ? { message: data.message, stack: data.stack } : data } : {}),
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
  debug: (msg: string, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") log("debug", msg, data);
  },
};
