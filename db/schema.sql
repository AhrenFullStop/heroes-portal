-- HEROES Alumni Portal schema. Single source of truth; executed at server boot.
-- Additive only: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'alumnus' CHECK (role IN ('admin','alumnus')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive migrations (schema.sql re-runs at boot; these are safe no-ops when fresh)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS checkins (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  mood text,
  note text,
  source text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS goals (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

CREATE TABLE IF NOT EXISTS goal_steps (
  id serial PRIMARY KEY,
  goal_id integer NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goal_steps_goal ON goal_steps(goal_id);

CREATE TABLE IF NOT EXISTS commitments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','kept','missed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS money_snapshots (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  income numeric NOT NULL DEFAULT 0,
  expenses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_year)
);

CREATE TABLE IF NOT EXISTS circle_posts (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_comments (
  id serial PRIMARY KEY,
  post_id integer NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coach_messages (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('to_coach','from_coach')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS workouts (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  level text NOT NULL CHECK (level IN ('home','gym')),
  duration_min integer NOT NULL DEFAULT 20,
  sort integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id integer REFERENCES workouts(id) ON DELETE SET NULL,
  note text,
  done_on date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS opportunities (
  id serial PRIMARY KEY,
  title text NOT NULL,
  org text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('job','learnership','bursary','training')),
  location text,
  apply_url text,
  description text,
  closes_on date,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS session (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Admin-editable Bra Hero personality (amended AFTER the core harness prompt)
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Member-created savings goals (Money v2)
CREATE TABLE IF NOT EXISTS savings_goals (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  saved_amount numeric NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Circle v2: votes, edits, soft-delete, images
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS circle_votes (
  post_id integer NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value integer NOT NULL CHECK (value = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
-- Direct messages (small community: everyone may DM everyone; admin can too)
CREATE TABLE IF NOT EXISTS direct_messages (
  id serial PRIMARY KEY,
  from_user integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON direct_messages(from_user, to_user, created_at);
-- Opportunities: admin images
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_url text;

-- Post images stored as bytes (container FS is ephemeral)
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS image_data bytea;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS image_mime text;

-- Opportunity images (admin-uploaded, bytes in DB)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_data bytea;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_mime text;
