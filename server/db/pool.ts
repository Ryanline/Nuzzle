import pg from "pg";

const { Pool } = pg;

export function createPool(connectionString: string) {
  return new Pool({ connectionString, max: 5 });
}

