CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED', 'REMOVED');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'MEMBER',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX sessions_active_lookup_idx ON sessions (session_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  ip_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX security_events_created_at_idx ON security_events (created_at DESC);
