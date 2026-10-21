import { DomainError } from "../shared/errors";
import express from "express";
import { ZodError } from "zod";
import { Store, HttpError } from "./db";
import { authRouter } from "./auth";
import { projectsRouter } from "./projects";
import { membersRouter } from "./members";
import { aiRouter } from "./ai/service";
import { configuredProvider, type AIProvider } from "./ai/provider";
export function createApp(
  options: {
    database?: string;
    provider?: AIProvider;
    aiTimeoutMs?: number;
  } = {},
) {
  const app = express(),
    store = new Store(
      options.database ??
        process.env.DATABASE_PATH ??
        "data/open-project.sqlite",
    );
  app.locals.store = store;
  store.run(
    "UPDATE proposals SET status='failed',document=? WHERE status='running'",
    JSON.stringify({
      error:
        "The server restarted. Your project is unchanged; retry the request.",
    }),
  );
  app.disable("x-powered-by");
  app.use(express.json({ limit: "5mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const origin = req.get("origin");
    const allowed = [
      process.env.APP_ORIGIN,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      `http://${req.get("host")}`,
      `https://${req.get("host")}`,
    ].filter(Boolean);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      origin &&
      !allowed.includes(origin)
    )
      throw new HttpError(403, "Untrusted request origin");
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter(store));
  app.use("/api", projectsRouter(store));
  app.use("/api", membersRouter(store));
  app.use(
    "/api",
    aiRouter(
      store,
      options.provider ?? configuredProvider(),
      options.aiTimeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? 60000),
    ),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof ZodError || error instanceof DomainError
            ? 422
            : error.type === "entity.too.large"
              ? 413
              : error.type === "entity.parse.failed"
                ? 400
                : 500;
      const message =
        status === 500
          ? "An internal error prevented this request. Please retry."
          : error instanceof ZodError
            ? error.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .slice(0, 4)
                .join("; ")
            : status === 413
              ? "Request is too large"
              : status === 400
                ? "Invalid JSON request"
                : error.message;
      res.status(status).json({ error: message });
    },
  );
  return app;
}
