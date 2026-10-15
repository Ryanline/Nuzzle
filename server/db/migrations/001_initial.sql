CREATE TABLE IF NOT EXISTS app_health (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_health (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS battle_fixture_runs (
  id UUID PRIMARY KEY,
  format_id TEXT NOT NULL,
  simulator_version TEXT NOT NULL,
  winner TEXT,
  turn_count INTEGER NOT NULL,
  transcript JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

