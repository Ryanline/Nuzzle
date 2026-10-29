import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { trainerSpriteIds } from "./trainer-sprite-ids.js";

const scrypt = promisify(crypto.scrypt);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_USERNAME_KEY = String(process.env.NUZZLE_ADMIN_USERNAME || "ryanline").trim().toLowerCase();
const avatarSpriteIds = new Set(trainerSpriteIds);

function authError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    avatarSpriteId: avatarSpriteIds.has(user.avatarSpriteId) ? user.avatarSpriteId : null,
    welcomeSeen: Boolean(user.welcomeSeenAt),
    createdAt: user.createdAt,
    streakStartDate: user.streakStartDate || null,
    isAdmin: user.usernameKey === ADMIN_USERNAME_KEY,
    isGuest: false,
  };
}

function publicGuest(guest) {
  return {
    id: guest.id,
    username: `Guest ${guest.number}`,
    avatarSpriteId: null,
    welcomeSeen: true,
    createdAt: guest.createdAt,
    isAdmin: false,
    isGuest: true,
  };
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
    this.data = { users: [], sessions: [], guests: [], nextGuestNumber: 1 };
    this.pendingUsernames = new Set();
    this.pendingWrite = Promise.resolve();
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    try {
      const stored = JSON.parse(await readFile(this.filename, "utf8"));
      this.data.users = Array.isArray(stored.users) ? stored.users.map((user) => ({ ...user, usernameKey: user.usernameKey || String(user.username || "").toLowerCase() })) : [];
      this.data.sessions = Array.isArray(stored.sessions) ? stored.sessions : [];
      this.data.guests = Array.isArray(stored.guests) ? stored.guests : [];
      this.data.nextGuestNumber = Math.max(Number(stored.nextGuestNumber) || 1, ...this.data.guests.map((guest) => Number(guest.number) + 1));
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
    if (/^guest\d+$/i.test(trimmedUsername)) authError("Usernames in the Guest number format are reserved.");
    if (String(password || "").length < 7) authError("Password must be at least 7 characters.");
    if (String(password).length > 128) authError("Password must be 128 characters or fewer.");
    return trimmedUsername;
  }

  async register(username, password, { guestId = null, streakStartDate = null } = {}) {
    const displayUsername = this.validateRegistration(username, password);
    const usernameKey = displayUsername.toLowerCase();
    if (this.pendingUsernames.has(usernameKey) || this.data.users.some((user) => user.usernameKey === usernameKey)) {
      authError("That username is already registered.", 409);
    }
    this.pendingUsernames.add(usernameKey);
    try {
      const user = {
        id: this.data.guests.some((guest) => guest.id === guestId) ? guestId : crypto.randomUUID(),
        username: displayUsername,
        usernameKey,
        avatarSpriteId: null,
        passwordHash: await passwordHash(String(password)),
        createdAt: new Date().toISOString(),
        streakStartDate,
      };
      this.data.users.push(user);
      this.data.guests = this.data.guests.filter((guest) => guest.id !== user.id);
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

  async createGuest() {
    const token = crypto.randomBytes(32).toString("base64url");
    const guest = {
      id: crypto.randomUUID(),
      number: this.data.nextGuestNumber++,
      tokenHash: sessionHash(token),
      createdAt: new Date().toISOString(),
    };
    this.data.guests.push(guest);
    await this.persist();
    return { user: publicGuest(guest), token };
  }

  guestForToken(token) {
    if (!token) return null;
    const hash = sessionHash(token);
    const guest = this.data.guests.find((candidate) => candidate.tokenHash === hash);
    return guest ? publicGuest(guest) : null;
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

  userById(userId) {
    const user = this.data.users.find((candidate) => candidate.id === userId);
    return user ? publicUser(user) : null;
  }

  identityById(playerId) {
    return this.userById(playerId) || (() => {
      const guest = this.data.guests.find((candidate) => candidate.id === playerId);
      return guest ? publicGuest(guest) : null;
    })();
  }

  async updateAvatar(userId, spriteId) {
    const avatarSpriteId = String(spriteId || "").trim() || null;
    if (avatarSpriteId && !avatarSpriteIds.has(avatarSpriteId)) authError("Choose an avatar from the trainer sprite list.");
    const user = this.data.users.find((candidate) => candidate.id === userId);
    if (!user) authError("Account not found.", 404);
    user.avatarSpriteId = avatarSpriteId;
    await this.persist();
    return publicUser(user);
  }

  async acknowledgeWelcome(userId) {
    const user = this.data.users.find((candidate) => candidate.id === userId);
    if (!user) authError("Account not found.", 404);
    if (!user.welcomeSeenAt) {
      user.welcomeSeenAt = new Date().toISOString();
      await this.persist();
    }
    return publicUser(user);
  }

  async logout(token) {
    if (!token) return;
    const hash = sessionHash(token);
    const previousLength = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.tokenHash !== hash);
    if (this.data.sessions.length !== previousLength) await this.persist();
  }

}

export { SESSION_LIFETIME_MS };
