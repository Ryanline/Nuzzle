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
  assert.equal(registration.user.passwordHash, undefined);
  assert.equal(auth.userForToken(registration.token)?.id, registration.user.id);
  assert.doesNotMatch(await readFile(filename, "utf8"), new RegExp(password));

  const restored = new AuthStore(filename);
  await restored.initialize();
  assert.deepEqual(restored.userForToken(registration.token), registration.user);
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

test("registration enforces simple usernames and long passwords", async () => {
  const { auth } = await authFixture();
  await assert.rejects(auth.register("no spaces", "this is a long password"), /Username/);
  await assert.rejects(auth.register("ValidName", "too short"), /at least 15/);
});
