-- ══════════════════════════════════════════════════════════════════════
--  SERIALIST — Cloudflare D1 schema
--  Run in: Cloudflare Dashboard → Workers & Pages → D1 → serialist-db → Console
--  (paste the whole file and execute)
-- ══════════════════════════════════════════════════════════════════════

-- Whole app state per user (series/watchlist/episodes WITHOUT covers, JSON)
CREATE TABLE IF NOT EXISTS state (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0   -- ms epoch, supplied by client (last-write-wins)
);

-- Covers stored separately (1 row = 1 cover) to avoid D1 row-size limits
CREATE TABLE IF NOT EXISTS covers (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,                  -- series.id or watchlist.id
  data    TEXT NOT NULL,                  -- base64 data URL
  PRIMARY KEY (user_id, item_id)
);

-- Web Push subscriptions (1 row = 1 device/browser)
CREATE TABLE IF NOT EXISTS push_subs (
  key          TEXT PRIMARY KEY,          -- sha256(endpoint)
  user_id      TEXT NOT NULL,
  subscription TEXT NOT NULL,             -- full PushSubscription JSON
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subs(user_id);

-- Upcoming episodes (uploaded by the client on every sync; read by the cron)
CREATE TABLE IF NOT EXISTS schedule (
  user_id   TEXT NOT NULL,
  date      TEXT NOT NULL,                -- YYYY-MM-DD (user local date)
  time      TEXT NOT NULL,                -- HH:MM      (user local time)
  title     TEXT NOT NULL,
  label     TEXT NOT NULL,                -- e.g. "S02E05"
  tz_offset INTEGER NOT NULL DEFAULT 0,   -- minutes, value of Date.getTimezoneOffset()
  notified  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sched_user ON schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_date ON schedule(date, notified);
