import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function authError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt, avatarVersion: user.avatarVersion || null };
}

function sessionHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function passwordHash(password, salt = crypto.randomBytes(16)) {
  const derived = await scrypt(password.normalize("NFC"), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function passwordMatches(password, encoded) {
  const [algorithm, cost, blockSize, parallelism, salt, expected] = String(encoded).split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(password.normalize("NFC"), Buffer.from(salt, "base64url"), Buffer.from(expected, "base64url").length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
  });
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected, "base64url"));
}

export class AuthStore {
  constructor(filename) {
    this.filename = filename;
    this.data = { users: [], sessions: [] };
    this.pendingUsernames = new Set();
    this.pendingWrite = Promise.resolve();
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    try {
      const stored = JSON.parse(await readFile(this.filename, "utf8"));
      this.data.users = Array.isArray(stored.users) ? stored.users : [];
      this.data.sessions = Array.isArray(stored.sessions) ? stored.sessions : [];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    this.data.sessions = this.data.sessions.filter((session) => Date.parse(session.expiresAt) > Date.now());
  }

  async persist() {
    const sequence = ++this.writeSequence;
    this.pendingWrite = this.pendingWrite.then(async () => {
      await mkdir(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.${process.pid}.${sequence}.tmp`;
      await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filename);
    });
    return this.pendingWrite;
  }

  validateRegistration(username, password) {
    const trimmedUsername = String(username || "").trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmedUsername)) authError("Username must be 3–20 characters using only letters, numbers, or underscores.");
    if (String(password || "").length < 15) authError("Password must be at least 15 characters.");
    if (String(password).length > 128) authError("Password must be 128 characters or fewer.");
    return trimmedUsername;
  }

  async register(username, password) {
    const displayUsername = this.validateRegistration(username, password);
    const usernameKey = displayUsername.toLowerCase();
    if (this.pendingUsernames.has(usernameKey) || this.data.users.some((user) => user.usernameKey === usernameKey)) {
      authError("That username is already registered.", 409);
    }
    this.pendingUsernames.add(usernameKey);
    try {
      const user = {
        id: crypto.randomUUID(),
        username: displayUsername,
        usernameKey,
        passwordHash: await passwordHash(String(password)),
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(user);
      const session = this.createSession(user.id);
      await this.persist();
      return { user: publicUser(user), ...session };
    } finally {
      this.pendingUsernames.delete(usernameKey);
    }
  }

  async login(username, password) {
    const usernameKey = String(username || "").trim().toLowerCase();
    const user = this.data.users.find((candidate) => candidate.usernameKey === usernameKey);
    if (!user || !await passwordMatches(String(password || ""), user.passwordHash)) authError("Username or password is incorrect.", 401);
    const session = this.createSession(user.id);
    await this.persist();
    return { user: publicUser(user), ...session };
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    this.data.sessions.push({ id: crypto.randomUUID(), userId, tokenHash: sessionHash(token), createdAt: new Date().toISOString(), expiresAt });
    return { token, expiresAt };
  }

  userForToken(token) {
    if (!token) return null;
    const now = Date.now();
    const hash = sessionHash(token);
    const session = this.data.sessions.find((candidate) => candidate.tokenHash === hash && Date.parse(candidate.expiresAt) > now);
    if (!session) return null;
    const user = this.data.users.find((candidate) => candidate.id === session.userId);
    return user ? publicUser(user) : null;
  }

  async logout(token) {
    if (!token) return;
    const hash = sessionHash(token);
    const previousLength = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.tokenHash !== hash);
    if (this.data.sessions.length !== previousLength) await this.persist();
  }

  async setAvatar(userId, avatarVersion) {
    const user = this.data.users.find((candidate) => candidate.id === userId);
    if (!user) authError("Account not found.", 404);
    user.avatarVersion = avatarVersion || null;
    await this.persist();
    return publicUser(user);
  }
}

export { SESSION_LIFETIME_MS };
