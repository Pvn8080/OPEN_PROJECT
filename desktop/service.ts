import express from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createApp } from "../server/app";
import { hash } from "../server/auth";
import type { AIProvider } from "../server/ai/provider";
export async function startDesktopService(options: {
  dataDirectory: string;
  clientDirectory?: string;
  provider?: AIProvider;
}) {
  const token = randomBytes(32).toString("hex"),
    sessionToken = randomBytes(32).toString("hex");
  const backend = createApp({
    database: join(options.dataDirectory, "open-project.sqlite"),
    provider: options.provider,
  });
  const store = backend.locals.store;
  const user = {
    id: "desktop-local-owner",
    name: "My workspace",
    email: "local@open-project.invalid",
    guest: 1,
  };
  store.run(
    "INSERT OR IGNORE INTO users(id,name,email,password,guest) VALUES(?,?,?,NULL,1)",
    user.id,
    user.name,
    user.email,
  );
  store.run(
    "INSERT INTO sessions VALUES(?,?,?)",
    hash(sessionToken),
    user.id,
    Number.MAX_SAFE_INTEGER,
  );
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const received = req.get("X-Open-Project-Desktop") ?? "";
    if (
      !/^([a-f0-9]{64})$/.test(received) ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(token))
    )
      return res.status(403).json({
        error: "Open this workspace in the Open Project desktop application.",
      });
    req.headers.cookie = "op_session=" + sessionToken;
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    next();
  });
  app.get("/api/auth/session", (_req, res) => res.json(user));
  app.post("/api/auth/demo", (_req, res) => res.json(user));
  app.use("/api/auth", (_req, res) =>
    res.status(409).json({
      error:
        "This is your local Mac workspace. Online accounts require a hosted workspace.",
    }),
  );
  app.use((req, res, next) => {
    if (/\/invitations(?:\/|$)/.test(req.path))
      return res.status(409).json({
        error:
          "Team sharing requires a hosted workspace. This database stays on your Mac.",
      });
    next();
  });
  app.use(backend);
  if (options.clientDirectory) {
    app.use(express.static(options.clientDirectory));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(options.clientDirectory!, "index.html")),
    );
  }
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Unable to start local workspace");
  let closed = false;
  return {
    origin: "http://127.0.0.1:" + address.port,
    token,
    store,
    async close() {
      if (closed) return;
      closed = true;
      server.closeIdleConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      store.run("DELETE FROM sessions WHERE hash=?", hash(sessionToken));
      store.close();
    },
  };
}
