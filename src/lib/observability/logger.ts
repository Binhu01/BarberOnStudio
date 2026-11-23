// =============================================================================
// Barber-On Studio — Structured Logger
// =============================================================================
// Logger estruturado com níveis, contexto e formatação JSON para produção.
// Em desenvolvimento, usa console colorido; em produção, JSON parseável.
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  // Metadados automáticos
  environment?: string;
  version?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const isProduction = process.env.NODE_ENV === "production";
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? (isProduction ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatEntry(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Formato legível para desenvolvimento
  const levelTag = `[${entry.level.toUpperCase().padEnd(5)}]`;
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  const err = entry.error ? `\n  └─ ${entry.error.name}: ${entry.error.message}${entry.error.stack ? "\n     " + entry.error.stack.split("\n").slice(1, 3).join("\n     ") : ""}` : "";
  return `${entry.timestamp} ${levelTag} ${entry.message}${ctx}${err}`;
}

function createLogger(defaultContext?: LogContext) {
  function log(level: LogLevel, message: string, contextOrError?: LogContext | Error, maybeError?: Error) {
    if (!shouldLog(level)) return;

    let context: LogContext | undefined;
    let error: Error | undefined;

    if (contextOrError instanceof Error) {
      error = contextOrError;
    } else if (maybeError) {
      context = contextOrError;
      error = maybeError;
    } else {
      context = contextOrError;
    }

    // Merge default context with per-call context
    const mergedContext = defaultContext || context
      ? { ...defaultContext, ...context }
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: mergedContext,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formatted = formatEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
      case "fatal":
        console.error(formatted);
        break;
    }
  }

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, contextOrError?: LogContext | Error, error?: Error) => log("error", message, contextOrError, error),
    fatal: (message: string, contextOrError?: LogContext | Error, error?: Error) => log("fatal", message, contextOrError, error),

    /** Criar child logger com contexto adicional fixo */
    child: (childContext: LogContext) =>
      createLogger({ ...defaultContext, ...childContext }),

    /** Medir duração de uma operação assíncrona */
    async measure<T>(
      operationName: string,
      fn: () => Promise<T>,
      context?: LogContext
    ): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        const duration_ms = Date.now() - start;
        log("info", `${operationName} completed`, { ...context, duration_ms });
        return result;
      } catch (err) {
        const duration_ms = Date.now() - start;
        log("error", `${operationName} failed`, { ...context, duration_ms }, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
  };
}

/** Logger raiz — use diretamente ou crie child loggers por módulo */
export const logger = createLogger();

/** Factory para criar logger com contexto de módulo/feature */
export function createModuleLogger(module: string, extraContext?: LogContext) {
  return createLogger({ module, ...extraContext });
}