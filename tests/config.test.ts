import { describe, expect, it } from "vitest";
import { getConfig } from "../server/config.js";

describe("configuration", () => {
  it("uses safe local defaults", () => {
    const config = getConfig({});
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(3000);
    expect(config.databaseUrl).toContain("127.0.0.1");
  });

  it("rejects an invalid port", () => {
    expect(() => getConfig({ NUZZLE_PORT: "70000" })).toThrow(/valid TCP port/);
  });
});

