export interface AppConfig {
  host: string;
  port: number;
  databaseUrl: string;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.NUZZLE_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("NUZZLE_PORT must be a valid TCP port");
  }

  return {
    host: env.NUZZLE_HOST ?? "127.0.0.1",
    port,
    databaseUrl: env.DATABASE_URL ?? "postgresql://nuzzle:nuzzle_local@127.0.0.1:5432/nuzzle",
  };
}

