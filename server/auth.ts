import { Router, type Request, type Response } from "express";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import { Store, HttpError } from "./db";
import { id } from "../shared/model";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(passwordHash(password, salt).split(":")[1], "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function getUser(store: Store, req: Request): any {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("op_session="))
    ?.slice(11);
  if (!cookie) return null;
  return (
    store.row(
      "SELECT u.id,u.name,u.email,u.guest FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?",
      hash(cookie),
      Date.now(),
    ) ?? null
  );
}
export function requireUser(store: Store, req: Request) {
  const user = getUser(store, req);
  if (!user) throw new HttpError(401, "Please sign in");
  return user;
}
export function session(store: Store, res: Response, userId: string) {
  const token = randomToken();
  store.run(
    "INSERT INTO sessions VALUES(?,?,?)",
    hash(token),
    userId,
    Date.now() + 7 * 86400000,
  );
  res.cookie("op_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 86400000,
    path: "/",
  });
}
export function authRouter(store: Store) {
  const r = Router();
  const attempts = new Map<string, { count: number; until: number }>();
  r.use((req, res, next) => {
    if (req.method === "GET") return next();
    const key = req.ip ?? "unknown",
      old = attempts.get(key),
      a =
        old && old.until > Date.now()
          ? old
          : { count: 0, until: Date.now() + 60000 };
    attempts.set(key, a);
    if (++a.count > 40)
      return res
        .status(429)
        .json({ error: "Too many attempts; try again shortly" });
    if (attempts.size > 10000) attempts.clear();
    next();
  });
  const fields = z.object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(256),
  });
  r.get("/session", (req, res) => res.json(requireUser(store, req)));
  r.post("/register", (req, res) => {
    const data = fields
      .extend({ name: z.string().trim().min(1).max(100) })
      .parse(req.body);
    if (store.row("SELECT id FROM users WHERE email=?", data.email))
      throw new HttpError(422, "An account with that email already exists");
    const current = getUser(store, req),
      uid = current?.guest ? current.id : id();
    if (current?.guest)
      store.run(
        "UPDATE users SET name=?,email=?,password=?,guest=0 WHERE id=?",
        data.name,
        data.email,
        passwordHash(data.password),
        uid,
      );
    else
      store.run(
        "INSERT INTO users VALUES(?,?,?,?,0)",
        uid,
        data.name,
        data.email,
        passwordHash(data.password),
      );
    session(store, res, uid);
    res
      .status(201)
      .json({ id: uid, name: data.name, email: data.email, guest: 0 });
  });
  r.post("/login", (req, res) => {
    const data = fields.parse(req.body),
      u = store.row("SELECT * FROM users WHERE email=?", data.email);
    if (!u?.password || !verify(data.password, u.password))
      throw new HttpError(401, "Email or password is incorrect");
    session(store, res, u.id);
    res.json({ id: u.id, name: u.name, email: u.email, guest: u.guest });
  });
  r.post("/logout", (req, res) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("op_session="))
      ?.slice(11);
    if (cookie) store.run("DELETE FROM sessions WHERE hash=?", hash(cookie));
    res.clearCookie("op_session", { path: "/" });
    res.sendStatus(204);
  });
  r.post("/demo", (req, res) => {
    const current = getUser(store, req);
    if (current) return res.json(current);
    const uid = id();
    store.run(
      "INSERT INTO users VALUES(?,?,?,?,1)",
      uid,
      "Alex Morgan",
      "demo-" + uid + "@example.invalid",
      null,
    );
    session(store, res, uid);
    res.status(201).json({
      id: uid,
      name: "Alex Morgan",
      email: "Demo workspace",
      guest: 1,
    });
  });
  return r;
}
