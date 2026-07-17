/** Esquema en Postgres estándar (compatible con pg-mem para tests). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS match (
  id          text PRIMARY KEY,
  competition text,
  matchday    int,
  played_at   timestamptz,
  status      text NOT NULL DEFAULT 'new',
  mode        text NOT NULL DEFAULT 'video',
  period_minutes int,
  video_ref   text
);

CREATE TABLE IF NOT EXISTS team (
  match_id text NOT NULL,
  side     text NOT NULL,
  name     text NOT NULL,
  PRIMARY KEY (match_id, side)
);

CREATE TABLE IF NOT EXISTS player (
  match_id text NOT NULL,
  side     text NOT NULL,
  number   int  NOT NULL,
  name     text NOT NULL,
  gk       boolean NOT NULL DEFAULT false,
  starter  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (match_id, side, number)
);

-- Capa canónica: fuente de verdad. Todo agregado se recalcula desde aquí.
CREATE TABLE IF NOT EXISTS match_event (
  match_id      text NOT NULL,
  seq           int  NOT NULL,
  game_clock_ms int  NOT NULL,
  period        int  NOT NULL,
  side          text NOT NULL,
  player_number int,
  type          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (match_id, seq)
);

-- Read-models persistidos al "extraer estadística" (recalculados desde match_event).
CREATE TABLE IF NOT EXISTS match_read_model (
  match_id   text PRIMARY KEY,
  summary    jsonb NOT NULL,
  players    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

/**
 * DDL específico de TimescaleDB (NO se aplica en tests ni en pg-mem).
 * En producción, tras crear las tablas, convertir match_event en hypertable.
 */
export const TIMESCALE_SQL = `
SELECT create_hypertable('match_event', by_range('game_clock_ms'), if_not_exists => TRUE);
`;
