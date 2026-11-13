-- No raw IP addresses, user agents, or plaintext confirmation tokens.
CREATE TABLE IF NOT EXISTS waitlist_subscribers (
  email TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'unsubscribed')),
  confirm_hash TEXT UNIQUE,
  unsubscribe_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  last_sent_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  notified_at INTEGER
);
CREATE INDEX IF NOT EXISTS waitlist_status ON waitlist_subscribers(status, updated_at);
CREATE TABLE IF NOT EXISTS waitlist_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
