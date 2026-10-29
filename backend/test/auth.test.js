import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AuthStore } from "../auth-store.js";

async function authFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-auth-"));
  const filename = path.join(directory, "auth.json");
  const auth = new AuthStore(filename);
  await auth.initialize();
  return { auth, filename };
}

test("registration stores a password hash and creates a persistent session", async () => {
  const { auth, filename } = await authFixture();
  const password = "correct horse battery staple";
  const registration = await auth.register("NuzzleFan", password);

  assert.equal(registration.user.username, "NuzzleFan");
  assert.equal(registration.user.avatarSpriteId, null);
  assert.equal(registration.user.welcomeSeen, false);
  assert.equal(registration.user.passwordHash, undefined);
  assert.equal(auth.userForToken(registration.token)?.id, registration.user.id);
  assert.doesNotMatch(await readFile(filename, "utf8"), new RegExp(password));

  const restored = new AuthStore(filename);
  await restored.initialize();
  assert.deepEqual(restored.userForToken(registration.token), registration.user);
});

test("the welcome message is acknowledged once per account", async () => {
  const { auth, filename } = await authFixture();
  const registration = await auth.register("WelcomeFan", "correct horse battery staple");

  const acknowledged = await auth.acknowledgeWelcome(registration.user.id);
  assert.equal(acknowledged.welcomeSeen, true);

  const restored = new AuthStore(filename);
  await restored.initialize();
  assert.equal(restored.userForToken(registration.token)?.welcomeSeen, true);
});

test("trainer avatars persist and reject unknown sprite ids", async () => {
  const { auth, filename } = await authFixture();
  const registration = await auth.register("AvatarFan", "correct horse battery staple");
  const updated = await auth.updateAvatar(registration.user.id, "misty");
  assert.equal(updated.avatarSpriteId, "misty");

  const restored = new AuthStore(filename);
  await restored.initialize();
  assert.equal(restored.userForToken(registration.token)?.avatarSpriteId, "misty");
  await assert.rejects(auth.updateAvatar(registration.user.id, "not-a-real-trainer"), /trainer sprite list/);
  assert.equal((await auth.updateAvatar(registration.user.id, null)).avatarSpriteId, null);
});

test("login is case-insensitive and rejects an incorrect password", async () => {
  const { auth } = await authFixture();
  await auth.register("BrockFan", "this is a long password");

  await assert.rejects(auth.login("brockfan", "this is the wrong password"), /incorrect/);
  const login = await auth.login("brockfan", "this is a long password");
  assert.equal(login.user.username, "BrockFan");
});

test("usernames are unique regardless of capitalization", async () => {
  const { auth } = await authFixture();
  await auth.register("TrainerOne", "this is a long password");
  await assert.rejects(auth.register("trainerone", "another long password"), /already registered/);
});

test("only the configured ryanline account is an administrator", async () => {
  const { auth } = await authFixture();
  const owner = await auth.register("RyanLine", "this is a long password");
  const member = await auth.register("AnotherTrainer", "another long password");
  assert.equal(owner.user.isAdmin, true);
  assert.equal(member.user.isAdmin, false);
  await assert.rejects(auth.register("RYANLINE", "yet another password"), /already registered/);
});

test("logout invalidates only the supplied session", async () => {
  const { auth } = await authFixture();
  const registration = await auth.register("MistyFan", "this is a long password");
  const second = await auth.login("MistyFan", "this is a long password");

  await auth.logout(registration.token);
  assert.equal(auth.userForToken(registration.token), null);
  assert.equal(auth.userForToken(second.token)?.username, "MistyFan");
});

test("registration enforces simple usernames and seven-character passwords", async () => {
  const { auth } = await authFixture();
  await assert.rejects(auth.register("no spaces", "this is a long password"), /Username/);
  await assert.rejects(auth.register("ValidName", "short6"), /at least 7/);
  const registration = await auth.register("ValidName", "seven77");
  assert.equal(auth.userForToken(registration.token)?.username, "ValidName");
});

test("numbered guests persist and registration adopts their player identity", async () => {
  const { auth, filename } = await authFixture();
  const first = await auth.createGuest();
  const second = await auth.createGuest();
  assert.equal(first.user.username, "Guest 1");
  assert.equal(first.user.isGuest, true);
  assert.equal(second.user.username, "Guest 2");
  assert.deepEqual(auth.guestForToken(first.token), first.user);

  const registration = await auth.register("ConvertedGuest", "correct horse battery staple", { guestId: first.user.id });
  assert.equal(registration.user.id, first.user.id);
  assert.equal(registration.user.isGuest, false);
  assert.equal(auth.guestForToken(first.token), null);
  assert.equal(auth.identityById(first.user.id)?.username, "ConvertedGuest");

  const restored = new AuthStore(filename);
  await restored.initialize();
  assert.equal(restored.identityById(first.user.id)?.username, "ConvertedGuest");
  assert.equal(restored.guestForToken(second.token)?.username, "Guest 2");
  await assert.rejects(restored.register("Guest2423", "correct horse battery staple"), /reserved/i);
});
